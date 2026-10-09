import { roughScore, yearsOfExperience } from '../feed/rough-score'
import { truncateText } from '../feed/text'
import type { AiFilled, Job, JobScore, Workplace } from '../feed/types'
import type { JobLevel, WorkMode } from '../profile/job-preferences'
import type { Profile } from '../profile/types'
import { AiError, type AiFailure } from './errors'

export type AiUsage = { inputTokens: number; outputTokens: number }
export type ScoringClient = {
  complete: (request: { key: string; model: string; system: string; user: string; maxTokens: number }) => Promise<{ text: string; usage: AiUsage }>
}

// The only facts about the user that leave the browser (PRD §4.1). No name, email, phone, address,
// birth date, school or employer: they say nothing about whether a job fits.
export type ProfileSummary = {
  roles: string[]
  level: JobLevel | ''
  skills: string[]
  experience: { titles: string[]; years: number }
  education: string[]
  locations: string[]
  workModes: WorkMode[]
}

const unique = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter((v) => v !== ''))]

export function buildProfileSummary(profile: Profile, now: Date): ProfileSummary {
  return {
    roles: profile.jobPrefs.roles,
    level: profile.jobPrefs.level,
    skills: unique(profile.skills.map((skill) => skill.name)),
    experience: {
      titles: unique(profile.experience.map((entry) => entry.title)),
      years: Math.round(yearsOfExperience(profile, now) * 10) / 10,
    },
    education: unique(profile.education.map((entry) => entry.level)),
    locations: profile.jobPrefs.locations,
    workModes: profile.jobPrefs.workModes,
  }
}

// A short fingerprint: a score is recomputed only when this changes (FR-29).
export function hashSummary(summary: ProfileSummary): string {
  let hash = 0x811c9dc5
  for (const char of JSON.stringify(summary)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const SYSTEM = `You rate how well job postings fit one candidate. Reply with ONLY a JSON array, one object per posting:
{"id": string, "score": integer 0-100, "matches": string[] (max 4, what fits), "gaps": string[] (max 4, what is missing or off), "summary": string (one sentence), "fill": object (optional)}.
Write matches, gaps and summary in Indonesian, short and concrete, based only on the text given. Do not invent facts.
"fill" may hold only fields the posting clearly states in its text and that are empty in the input: "workplace" ("remote"|"hybrid"|"onsite"), "level", "experience", "salary", "contract". Omit anything not clear.`

export type ScoreFill = Partial<{ workplace: Exclude<Workplace, 'unknown'>; level: string; experience: string; salary: string; contract: string }>
export type ScoreResult = { id: string; score: number; matches: string[]; gaps: string[]; summary: string; fill: ScoreFill }

const strings = (value: unknown, max: number): string[] | null =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => truncateText(v.trim(), 160)).slice(0, max) : null

const FILL_TEXT = ['level', 'experience', 'salary', 'contract'] as const

function readFill(raw: unknown): ScoreFill {
  const fill: ScoreFill = {}
  if (typeof raw !== 'object' || raw === null) return fill
  const source = raw as Record<string, unknown>
  if (source.workplace === 'remote' || source.workplace === 'hybrid' || source.workplace === 'onsite') fill.workplace = source.workplace
  for (const key of FILL_TEXT) {
    const value = source[key]
    if (typeof value === 'string' && value.trim() !== '') fill[key] = truncateText(value.trim(), 60)
  }
  return fill
}

// The model's answer, kept only where it is valid. A bad item is dropped, never repaired or invented.
export function parseScoreOutput(text: string, ids: string[]): ScoreResult[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  let data: unknown
  try {
    data = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const results: ScoreResult[] = []
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue
    const row = item as Record<string, unknown>
    const matches = strings(row.matches, 4)
    const gaps = strings(row.gaps, 4)
    if (typeof row.id !== 'string' || !ids.includes(row.id) || results.some((r) => r.id === row.id)) continue
    if (typeof row.score !== 'number' || !Number.isFinite(row.score) || row.score < 0 || row.score > 100) continue
    if (!matches || !gaps || typeof row.summary !== 'string' || row.summary.trim() === '') continue
    results.push({ id: row.id, score: Math.round(row.score), matches, gaps, summary: truncateText(row.summary.trim(), 240), fill: readFill(row.fill) })
  }
  return results
}

function batchPrompt(summary: ProfileSummary, jobs: Job[]): string {
  const postings = jobs.map((job) => ({
    id: job.id, title: job.title, company: job.company, location: job.location, workplace: job.workplace,
    level: job.level, contract: job.contract, salary: job.salary, experience: job.experience,
    text: truncateText(job.description, 1200),
  }))
  return `Candidate:\n${JSON.stringify(summary)}\n\nPostings:\n${JSON.stringify(postings)}`
}

export type ScoreRun = { jobs: Job[]; usage: AiUsage; aiProblem?: AiFailure; aiScored: number; roughScored: number }

type Options = {
  jobs: Job[]
  profile: Profile
  client: ScoringClient
  key: string
  model: string
  now: Date
  limit?: number
  batchSize?: number
}

const FILLED: Record<keyof ScoreFill, AiFilled> = { workplace: 'workplace', level: 'level', experience: 'experience', salary: 'salary', contract: 'contract' }

function withAi(job: Job, result: ScoreResult, hash: string): Job {
  const next: Job = { ...job, score: { value: result.score, matches: result.matches, gaps: result.gaps, summary: result.summary, rough: false, inputHash: hash } }
  const marks = [...job.aiFilled]
  for (const key of Object.keys(result.fill) as (keyof ScoreFill)[]) {
    const current = next[key]
    if (current !== '' && current !== 'unknown') continue
    ;(next as Record<string, unknown>)[key] = result.fill[key]
    marks.push(FILLED[key])
  }
  return { ...next, aiFilled: marks }
}

// Scores the jobs that need it: with the AI up to `limit`, by rules for the rest or when the AI
// cannot be used (PRD §8). Scores for an unchanged profile are kept.
export async function scoreJobs({ jobs, profile, client, key, model, now, limit = 50, batchSize = 5 }: Options): Promise<ScoreRun> {
  const summary = buildProfileSummary(profile, now)
  const hash = hashSummary(summary)
  const current = new Map(jobs.map((job) => [job.id, job]))
  const needs = jobs.filter((job) => !(job.score && !job.score.rough && job.score.inputHash === hash))
  const forAi = needs.slice(0, limit)
  const usage: AiUsage = { inputTokens: 0, outputTokens: 0 }
  const scoredByAi = new Set<string>()
  let aiProblem: AiFailure | undefined

  for (let start = 0; start < forAi.length && !aiProblem; start += batchSize) {
    const batch = forAi.slice(start, start + batchSize)
    try {
      const reply = await client.complete({ key, model, system: SYSTEM, user: batchPrompt(summary, batch), maxTokens: 1500 })
      usage.inputTokens += reply.usage.inputTokens
      usage.outputTokens += reply.usage.outputTokens
      for (const result of parseScoreOutput(reply.text, batch.map((job) => job.id))) {
        const job = current.get(result.id)
        if (!job) continue
        current.set(result.id, withAi(job, result, hash))
        scoredByAi.add(result.id)
      }
    } catch (error) {
      aiProblem = error instanceof AiError ? error.reason : 'network'
    }
  }

  let roughScored = 0
  for (const job of needs) {
    if (scoredByAi.has(job.id)) continue
    current.set(job.id, { ...(current.get(job.id) as Job), score: roughScore(job, profile, now) satisfies JobScore })
    roughScored += 1
  }
  return { jobs: jobs.map((job) => current.get(job.id) as Job), usage, aiProblem, aiScored: scoredByAi.size, roughScored }
}
