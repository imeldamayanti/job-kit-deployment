import { aiErrorMessage, type AiFailure } from '../core/ai/errors'
import { buildProfileSummary, hashSummary, readScoreResults, scoreJobs, type AiUsage } from '../core/ai/score'
import type { Job } from '../core/feed/types'
import {
  RemoteRefusal, SCORE_BATCH, type GenerateError, type GenerateRequest, type GenerateResponse, type RemoteDocument, type RemoteScore,
} from '../core/generate/protocol'
import type { ServerAccess } from '../core/tailor/limits'
import { callGenerate, loadAccountStatus, noteCredits } from './account'
import { loadFeed, saveFeed } from './feed-storage'
import { loadProfile } from './storage'
import { storedUserId } from './sync'

// The AI that runs on our server (spec §5.4): the pipelines call these instead of the person's own provider. Each call goes
// through `callGenerate`, keeps the cached balance in step with the server, and turns a refusal into a RemoteRefusal that the
// pipelines show as a failure. What comes back is read again here and in the pipelines: the extension trusts a server's
// answer no more than a model's.

// What the person reads for each refusal. The server's own text is kept where it is already the mockup's text
// (a fact-check refusal lists what was rejected); these are the ones the extension words itself.
const MESSAGES: Record<GenerateError, string> = {
  unauthenticated: 'Masuk lagi untuk memakai AI.',
  insufficient: 'Kredit tidak cukup.',
  expired: 'Kreditmu sudah hangus. Beli kredit untuk melanjutkan.',
  budget: 'Layanan AI penuh bulan ini. Kreditmu tidak terpakai.',
  'rate-limit': 'Terlalu cepat, coba lagi sebentar. Kreditmu tidak terpakai.',
  'invalid-request': 'Permintaan tidak bisa diproses.',
  ai: 'AI sedang gangguan. Kreditmu tidak terpakai.',
  unreadable: 'Balasan AI tidak bisa dibaca. Kreditmu tidak terpakai.',
  ungrounded: 'Hasil AI ditolak karena memuat hal yang tidak ada di Profile-mu. Kreditmu tidak terpakai.',
}
// The server's wording of these lacks the sentence about the credit, or says "dulu" where a session has simply run out.
const OWN_WORDING: readonly GenerateError[] = ['unauthenticated', 'budget', 'rate-limit']

export const refusalMessage = (code: GenerateError, serverMessage = ''): string =>
  OWN_WORDING.includes(code) || serverMessage.trim() === '' ? MESSAGES[code] : serverMessage

const BAD_ANSWER = 'Jawaban server tidak terbaca. Coba lagi.'

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0)
const cleanUsage = (usage: unknown): AiUsage => {
  const row = typeof usage === 'object' && usage !== null ? (usage as Record<string, unknown>) : {}
  return { inputTokens: count(row.inputTokens), outputTokens: count(row.outputTokens) }
}

// One call to the server. The balance it reports is noted before anything else, so a refusal that carries one (no credits left)
// updates the screens too. `credits: null` (signed out, a failure before the balance was read) leaves the cache alone.
async function ask(request: GenerateRequest): Promise<GenerateResponse> {
  const response = await callGenerate(request)
  if (typeof response.credits === 'number') await noteCredits(response.credits)
  return response
}

function refuse(response: Extract<GenerateResponse, { ok: false }>): RemoteRefusal {
  return new RemoteRefusal(response.error, refusalMessage(response.error, response.message), response.violations)
}

export const remoteDocument: RemoteDocument = async (request) => {
  const response = await ask(request)
  if (!response.ok) throw refuse(response)
  if (response.kind === 'score' || typeof response.text !== 'string') throw new RemoteRefusal('ai', BAD_ANSWER)
  return { text: response.text, usage: cleanUsage(response.usage), fallback: response.fallback === true }
}

export const remoteScore: RemoteScore = async (request) => {
  const response = await ask(request)
  if (!response.ok) throw refuse(response)
  if (response.kind !== 'score') throw new RemoteRefusal('ai', BAD_ANSWER)
  // The same checks as a model's text gets: only rows for the jobs that were sent, in range, with a reason.
  return { results: readScoreResults(response.results, request.jobs.map((job) => job.id)), usage: cleanUsage(response.usage) }
}

// What the screens need to know before a call: who is signed in, the balance last seen, and whether there is a network. The balance
// can be stale (it is a cache); the server has the last word and refuses when it is short.
export async function serverAccess(): Promise<ServerAccess> {
  const [userId, status] = await Promise.all([storedUserId(), loadAccountStatus()])
  return { signedIn: userId !== null, credits: status?.credits ?? null, online: navigator.onLine }
}

// The line after a document that was paid for, with the balance as the server last reported it (it is noted before this reads it).
export async function doneLine(what: 'CV' | 'Surat'): Promise<string> {
  const status = await loadAccountStatus()
  return status ? `${what} siap. 1 kredit terpakai, sisa ${status.credits}.` : `${what} siap. 1 kredit terpakai.`
}

// `charged`: the server answered and took the credit, but nothing usable came out of it. `aiProblem`: the call itself failed
// on this side.
export type ScoreOutcome = { scored: number; refused?: GenerateError; aiProblem?: AiFailure; charged?: boolean; message?: string }

const NO_USABLE_SCORES = 'AI tidak mengembalikan skor yang bisa dipakai; 1 kredit terpakai.'

// What the AI gave a job is copied onto the job as it is now, not as it was when the call began: a job the person saved, hid or
// opened while the call ran keeps that. Only the score and the fields the AI filled (and their marks) come across.
function withAiResult(fresh: Job, scored: Job): Job {
  const added = scored.aiFilled.filter((key) => !fresh.aiFilled.includes(key))
  const next: Job = { ...fresh, score: scored.score }
  for (const key of added) {
    const empty = fresh[key] === '' || fresh[key] === 'unknown'
    if (empty) (next as Record<string, unknown>)[key] = scored[key]
  }
  return { ...next, aiFilled: [...fresh.aiFilled, ...added.filter((key) => next[key] === scored[key])] }
}

// "Nilai dengan AI" (spec §5.4): the ten best jobs that still have only a rough score go to the server in one call, for one
// credit. Jobs the person hid are left out, and so are those the AI has already scored for this Profile. The feed is read again
// before it is saved, and only the AI's part is merged into each job (see withAiResult).
export async function scoreTopWithAi(now = new Date()): Promise<ScoreOutcome> {
  const [profile, feed] = await Promise.all([loadProfile(), loadFeed()])
  const hash = hashSummary(buildProfileSummary(profile, now))
  const current = (job: Job) => Boolean(job.score && !job.score.rough && job.score.inputHash === hash)
  const top = feed
    .filter((job) => job.status !== 'hidden' && !current(job))
    .sort((a, b) => (b.score?.value ?? -1) - (a.score?.value ?? -1))
    .slice(0, SCORE_BATCH)
  if (top.length === 0) return { scored: 0 }

  // Whether the server answered at all: an answer with nothing usable in it was still paid for.
  let answered = false
  const remote: RemoteScore = async (request) => {
    const reply = await remoteScore(request)
    answered = true
    return reply
  }
  const run = await scoreJobs({ jobs: top, profile, now, limit: SCORE_BATCH, remote })
  if (run.refused) return { scored: 0, refused: run.refused, message: MESSAGES[run.refused] }
  if (run.aiProblem) return { scored: 0, aiProblem: run.aiProblem, message: aiErrorMessage(run.aiProblem) }

  const scoredNow = new Map(run.jobs.filter(current).map((job) => [job.id, job]))
  if (scoredNow.size === 0) return answered ? { scored: 0, charged: true, message: NO_USABLE_SCORES } : { scored: 0 }
  await saveFeed((await loadFeed()).map((job) => {
    const scored = scoredNow.get(job.id)
    return scored ? withAiResult(job, scored) : job
  }))
  return { scored: run.aiScored }
}

// What the Lowongan page says after "Nilai dengan AI" (mockup S4): the result with the balance, or why nothing was spent.
export function describeScore(outcome: ScoreOutcome, credits: number | null): { ok: boolean; text: string } {
  if (outcome.refused) return { ok: false, text: outcome.message ?? MESSAGES[outcome.refused] }
  if (outcome.aiProblem || outcome.charged) return { ok: false, text: outcome.message ?? NO_USABLE_SCORES }
  if (outcome.scored === 0) return { ok: true, text: 'Tidak ada lowongan yang perlu dinilai AI.' }
  const left = credits === null ? '' : `, sisa ${credits}`
  return { ok: true, text: `${outcome.scored} lowongan dinilai. 1 kredit terpakai${left}.` }
}
