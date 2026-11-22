import type { AiUsage, ProfileSummary, ScoreResult } from '../ai/score'
import type { Job } from '../feed/types'
import type { Lang, Tone } from '../letters/language'
import type { CvPayload } from '../tailor/privacy'
import type { Violation } from '../tailor/types'

// The request and answer of the `generate` Edge Function, shared by the server and the extension (one source in src/core).
// Nothing here is a free-form prompt: the server builds the prompt itself from these fields (spec §5.4).

// Credits one call costs, by kind (spec §5.4).
export const CREDIT_COST = { cv: 1, letter: 1, score: 1 } as const
// Jobs scored in one call, so one credit buys ten scores.
export const SCORE_BATCH = 10
export const MAX_PAYLOAD_CHARS = 60_000

export type ScoreJob = Pick<Job, 'id' | 'title' | 'company' | 'location' | 'workplace' | 'level' | 'contract' | 'salary' | 'experience' | 'description'>

export type CvRequest = { kind: 'cv'; job: { title: string; description: string }; payload: CvPayload }
export type LetterRequest = { kind: 'letter'; job: { title: string; company: string; description: string }; payload: CvPayload; lang: Lang; tone: Tone }
export type ScoreRequest = { kind: 'score'; summary: ProfileSummary; jobs: ScoreJob[] }
export type GenerateRequest = CvRequest | LetterRequest | ScoreRequest

export type GenerateError =
  | 'unauthenticated' | 'insufficient' | 'expired' | 'budget' | 'rate-limit' | 'invalid-request' | 'ai' | 'unreadable' | 'ungrounded'

export type GenerateResponse =
  | { ok: true; kind: 'cv' | 'letter'; text: string; fallback: boolean; credits: number; usage: AiUsage }
  | { ok: true; kind: 'score'; results: ScoreResult[]; credits: number; usage: AiUsage }
  | { ok: false; error: GenerateError; message: string; credits: number | null; violations?: Violation[] }

// The answer of `create-payment`. Here and not in src/server because the extension reads it too.
export type CreatePaymentResponse =
  | { ok: true; purchaseId: string; qrUrl: string; amountIdr: number; credits: number; expiresAt: string }
  | { ok: false; error: 'unauthenticated' | 'invalid-request' | 'gateway'; message: string }

// A refusal from the server, as the pipelines see it: they turn it into a failure result instead of throwing on.
export class RemoteRefusal extends Error {
  constructor(public code: GenerateError, message: string, public violations?: Violation[]) {
    super(message)
  }
}

// Stands in for `ScoringClient.complete` when the server does the call. It returns the model's text, which the
// pipeline reads, restores and checks exactly as it does a local answer. Throws RemoteRefusal when refused.
// `fallback` is the server's own word that it did not charge for an empty answer (spec §6). The extension never works that out
// itself for a credit claim: a server and an extension of different versions could disagree.
export type RemoteDocument = (request: CvRequest | LetterRequest) => Promise<{ text: string; usage: AiUsage; fallback: boolean }>
// The server has already read the answer, so a score comes back as results.
export type RemoteScore = (request: ScoreRequest) => Promise<{ results: ScoreResult[]; usage: AiUsage }>

type Checked<T> = { ok: true; value: T } | { ok: false; message: string }
const fail = (message: string): { ok: false; message: string } => ({ ok: false, message })
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString)
const isRecordOf = (value: unknown, keys: readonly string[]): value is Record<string, string> => isRecord(value) && keys.every((key) => isString(value[key]))

const LANGS: readonly Lang[] = ['id', 'en']
const TONES: readonly Tone[] = ['formal', 'casual']
const SCORE_JOB_KEYS = ['id', 'title', 'company', 'location', 'workplace', 'level', 'contract', 'salary', 'experience', 'description'] as const

const pick = <K extends string>(source: Record<string, string>, keys: readonly K[]): Record<K, string> =>
  Object.fromEntries(keys.map((key) => [key, source[key]])) as Record<K, string>

function readPayload(value: unknown): Checked<CvPayload> {
  if (!isRecord(value) || !isStrings(value.skills) || !Array.isArray(value.experience) || !Array.isArray(value.education)) return fail('Payload CV tidak lengkap.')
  const experienceKeys = ['id', 'title', 'company', 'description'] as const
  const educationKeys = ['id', 'institution', 'level', 'major'] as const
  if (!value.experience.every((e) => isRecordOf(e, experienceKeys)) || !value.education.every((e) => isRecordOf(e, educationKeys))) return fail('Payload CV tidak lengkap.')
  return {
    ok: true,
    value: {
      skills: [...value.skills],
      experience: value.experience.map((e) => pick(e as Record<string, string>, experienceKeys)),
      education: value.education.map((e) => pick(e as Record<string, string>, educationKeys)),
    },
  }
}

function readSummary(value: unknown): Checked<ProfileSummary> {
  if (!isRecord(value) || !isString(value.level) || !isRecord(value.experience)) return fail('Ringkasan profil tidak lengkap.')
  const { roles, skills, education, locations, workModes } = value
  const { titles, years } = value.experience
  if (!isStrings(roles) || !isStrings(skills) || !isStrings(education) || !isStrings(locations) || !isStrings(workModes) || !isStrings(titles)) return fail('Ringkasan profil tidak lengkap.')
  if (typeof years !== 'number' || !Number.isFinite(years)) return fail('Ringkasan profil tidak lengkap.')
  return {
    ok: true,
    value: {
      roles: [...roles], level: value.level as ProfileSummary['level'], skills: [...skills], experience: { titles: [...titles], years },
      education: [...education], locations: [...locations], workModes: [...workModes] as ProfileSummary['workModes'],
    },
  }
}

function readJobs(value: unknown): Checked<ScoreJob[]> {
  if (!Array.isArray(value) || value.length === 0 || value.length > SCORE_BATCH) return fail(`Satu permintaan skor memuat 1 sampai ${SCORE_BATCH} lowongan.`)
  if (!value.every((job) => isRecordOf(job, SCORE_JOB_KEYS))) return fail('Data lowongan tidak lengkap.')
  return { ok: true, value: value.map((job) => pick(job as Record<string, string>, SCORE_JOB_KEYS) as ScoreJob) }
}

// Reads what a caller sent, keeping only the fields of the protocol: an unknown field never reaches the prompt.
export function validateRequest(body: unknown): { ok: true; request: GenerateRequest } | { ok: false; message: string } {
  if (!isRecord(body)) return fail('Permintaan tidak dikenal.')
  if (JSON.stringify(body).length > MAX_PAYLOAD_CHARS) return fail('Permintaan terlalu besar.')

  if (body.kind === 'score') {
    const summary = readSummary(body.summary)
    if (!summary.ok) return summary
    const jobs = readJobs(body.jobs)
    if (!jobs.ok) return jobs
    return { ok: true, request: { kind: 'score', summary: summary.value, jobs: jobs.value } }
  }

  if (body.kind !== 'cv' && body.kind !== 'letter') return fail('Jenis permintaan tidak dikenal.')
  const payload = readPayload(body.payload)
  if (!payload.ok) return payload
  const { job } = body
  if (body.kind === 'cv') {
    if (!isRecordOf(job, ['title', 'description'])) return fail('Data lowongan tidak lengkap.')
    return { ok: true, request: { kind: 'cv', job: { title: job.title as string, description: job.description as string }, payload: payload.value } }
  }
  if (!isRecordOf(job, ['title', 'company', 'description'])) return fail('Data lowongan tidak lengkap.')
  const { lang, tone } = body
  if (!LANGS.includes(lang as Lang)) return fail('Bahasa surat tidak dikenal.')
  if (!TONES.includes(tone as Tone)) return fail('Nada surat tidak dikenal.')
  return {
    ok: true,
    request: {
      kind: 'letter', job: { title: job.title as string, company: job.company as string, description: job.description as string },
      payload: payload.value, lang: lang as Lang, tone: tone as Tone,
    },
  }
}
