import { SCORE_SYSTEM, parseScoreOutput, scorePrompt, type AiUsage, type ScoreResult } from '../core/ai/score'
import { CREDIT_COST, validateRequest, type CvRequest, type GenerateError, type GenerateRequest, type GenerateResponse, type LetterRequest, type ScoreRequest } from '../core/generate/protocol'
import { profileFromPayload } from '../core/generate/pseudo-profile'
import { withoutSignOff } from '../core/letters/closing'
import { validateLetter } from '../core/letters/grounded'
import { parseLetter } from '../core/letters/parse'
import { letterSystem, letterUserPrompt } from '../core/letters/prompt'
import { validateGrounded } from '../core/tailor/grounded'
import { parseOutput } from '../core/tailor/parse'
import { ungroundedMessage, usesFallback } from '../core/tailor/pipeline'
import { CV_SYSTEM, cvUserPrompt } from '../core/tailor/prompt'
import type { Violation } from '../core/tailor/types'
import type { Complete, Db, ServerEnv } from './ports'

// The body of the `generate` Edge Function, free of any runtime: reserve credits, call the model, check the answer, settle (spec §5.4, §6).
// Every path after a reservation ends in `settle`. Nothing here writes the request to a log: it holds a person's CV.

export type GenerateDeps = {
  db: Db
  complete: Complete
  env: ServerEnv
  // Told which stage failed and with what error, so the Edge Function can log it. Never receives the request.
  report?: (stage: 'guard' | 'reserve' | 'model' | 'settle', error: unknown) => void
}
export type HandlerResult = { status: number; body: GenerateResponse }

export const MAX_TOKENS = { cv: 3000, letter: 2000, score: 1500 } as const
// Jobs per model call. A request holds up to ten (one credit), so a full one is two calls.
export const SCORE_SUB_BATCH = 5

type RefundReason = 'ai' | 'unreadable' | 'ungrounded' | 'fallback'

const MESSAGES = {
  unauthenticated: 'Masuk dulu untuk memakai AI.',
  insufficient: 'Kredit tidak cukup.',
  expired: 'Kreditmu sudah hangus. Beli kredit untuk melanjutkan.',
  budget: 'Layanan AI penuh bulan ini.',
  'rate-limit': 'Terlalu cepat, coba lagi sebentar.',
  ai: 'AI sedang gangguan. Kreditmu tidak terpakai.',
  unreadable: 'Balasan AI tidak bisa dibaca. Kreditmu tidak terpakai.',
} as const

const failure = (status: number, error: GenerateError, message: string, credits: number | null, violations?: Violation[]): HandlerResult => ({
  status,
  body: { ok: false, error, message, credits, ...(violations && { violations }) },
})

// What the model produced and what the server does about the credit: `reason` null keeps the charge, a reason refunds it.
// `respond` builds the answer from the balance after settling.
type Outcome = { reason: RefundReason | null; usage: AiUsage; respond: (credits: number) => HandlerResult }

const NONE: AiUsage = { inputTokens: 0, outputTokens: 0 }
const add = (a: AiUsage, b: AiUsage): AiUsage => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens })
const done = (response: GenerateResponse): HandlerResult => ({ status: 200, body: response })

const refused = (reason: RefundReason, usage: AiUsage, status: number, error: GenerateError, message: string, violations?: Violation[]): Outcome => ({
  reason,
  usage,
  respond: (credits) => failure(status, error, message, credits, violations),
})
const aiFailed = (usage: AiUsage) => refused('ai', usage, 502, 'ai', MESSAGES.ai)
const unreadable = (usage: AiUsage) => refused('unreadable', usage, 502, 'unreadable', MESSAGES.unreadable)
const ungrounded = (usage: AiUsage, violations: Violation[]) =>
  refused('ungrounded', usage, 422, 'ungrounded', `${ungroundedMessage(violations)} Kreditmu tidak terpakai.`, violations)

async function writeCv(request: CvRequest, complete: Complete, report: GenerateDeps['report']): Promise<Outcome> {
  let reply: Awaited<ReturnType<Complete>>
  try {
    reply = await complete(CV_SYSTEM, cvUserPrompt(request.job, request.payload), MAX_TOKENS.cv)
  } catch (error) {
    report?.('model', error)
    return aiFailed(NONE)
  }
  const { text, usage } = reply
  const parsed = parseOutput(text)
  if (!parsed.ok) return unreadable(usage)
  // The same fact checker as the extension, on the payload's own Profile (the names are still codes here).
  const grounding = validateGrounded(parsed.output, profileFromPayload(request.payload))
  if (!grounding.ok) return ungrounded(usage, grounding.violations)
  // An empty answer earns no charge but is still returned: the extension builds the CV from the Profile as written.
  const fallback = usesFallback(parsed.output)
  return { reason: fallback ? 'fallback' : null, usage, respond: (credits) => done({ ok: true, kind: 'cv', text, fallback, credits, usage }) }
}

async function writeLetter(request: LetterRequest, complete: Complete, report: GenerateDeps['report']): Promise<Outcome> {
  let reply: Awaited<ReturnType<Complete>>
  try {
    reply = await complete(letterSystem(request.lang, request.tone), letterUserPrompt(request.job, request.payload), MAX_TOKENS.letter)
  } catch (error) {
    report?.('model', error)
    return aiFailed(NONE)
  }
  const { text, usage } = reply
  const parsed = parseLetter(text)
  if (!parsed.ok) return unreadable(usage)
  // Stricter than the extension's check: the payload holds no dates or years, so a number it never saw is rejected.
  const grounding = validateLetter(withoutSignOff(parsed.body), profileFromPayload(request.payload), request.job)
  if (!grounding.ok) return ungrounded(usage, grounding.violations)
  return { reason: null, usage, respond: (credits) => done({ ok: true, kind: 'letter', text, fallback: false, credits, usage }) }
}

async function scoreJobs(request: ScoreRequest, complete: Complete, report: GenerateDeps['report']): Promise<Outcome> {
  const batches: ScoreRequest['jobs'][] = []
  for (let start = 0; start < request.jobs.length; start += SCORE_SUB_BATCH) batches.push(request.jobs.slice(start, start + SCORE_SUB_BATCH))

  // Together, not one after the other: two calls of up to 60 seconds each must not add up.
  const settled = await Promise.allSettled(batches.map((batch) => complete(SCORE_SYSTEM, scorePrompt(request.summary, batch), MAX_TOKENS.score)))
  let usage = NONE
  const results: ScoreResult[] = []
  let failed = false
  let empty = false
  settled.forEach((outcome, index) => {
    if (outcome.status === 'rejected') {
      report?.('model', outcome.reason)
      failed = true
      return
    }
    usage = add(usage, outcome.value.usage)
    // The extension trusts these results, so each batch is read and range-checked here, against its own ids only.
    const rows = parseScoreOutput(outcome.value.text, (batches[index] ?? []).map((job) => job.id))
    if (rows.length === 0) empty = true
    results.push(...rows)
  })
  // One bad batch refunds the whole credit: the person paid for ten scores, not for some of them.
  if (failed) return aiFailed(usage)
  if (empty) return unreadable(usage)
  return { reason: null, usage, respond: (credits) => done({ ok: true, kind: 'score', results, credits, usage }) }
}

const produce = (request: GenerateRequest, complete: Complete, report: GenerateDeps['report']): Promise<Outcome> =>
  request.kind === 'cv' ? writeCv(request, complete, report) : request.kind === 'letter' ? writeLetter(request, complete, report) : scoreJobs(request, complete, report)

export async function handleGenerate(input: { userId: string | null; body: unknown }, deps: GenerateDeps): Promise<HandlerResult> {
  const { db, complete, env, report } = deps
  const { userId } = input
  if (userId === null) return failure(401, 'unauthenticated', MESSAGES.unauthenticated, null)

  const checked = validateRequest(input.body)
  if (!checked.ok) return failure(400, 'invalid-request', checked.message, null)
  const { request } = checked

  try {
    const guard = await db.guard(userId, env.budgetUsd, env.rateLimit)
    if (guard !== 'ok') return failure(429, guard, MESSAGES[guard], null)
  } catch (error) {
    report?.('guard', error)
    return failure(500, 'ai', MESSAGES.ai, null)
  }

  let reservation: Awaited<ReturnType<Db['reserve']>>
  try {
    reservation = await db.reserve(userId, request.kind, CREDIT_COST[request.kind])
  } catch (error) {
    report?.('reserve', error)
    return failure(500, 'ai', MESSAGES.ai, null)
  }
  if (!reservation.ok) {
    // Nothing was taken. The balance is only there so the screen can show it, so a failed read is not worth failing for.
    const credits = await db.balance(userId).catch(() => null)
    return failure(402, reservation.error, MESSAGES[reservation.error], credits)
  }

  const { id } = reservation
  const costUsd = (usage: AiUsage) => (usage.inputTokens * env.priceIn + usage.outputTokens * env.priceOut) / 1e6
  const settle = (ok: boolean, reason: RefundReason | null, usage: AiUsage) =>
    db.settle(id, ok, reason, env.aiModel, usage.inputTokens, usage.outputTokens, costUsd(usage))

  try {
    const outcome = await produce(request, complete, report)
    return outcome.respond(await settle(outcome.reason === null, outcome.reason, outcome.usage))
  } catch (error) {
    // Something we did not plan for: give the credit back if it is still held, and say nothing about what broke.
    report?.('settle', error)
    const credits = await settle(false, 'ai', NONE).catch((refundError: unknown) => (report?.('settle', refundError), null))
    return failure(500, 'ai', MESSAGES.ai, credits)
  }
}
