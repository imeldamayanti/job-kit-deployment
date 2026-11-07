import { mergeFeed } from './merge'
import { DESCRIPTION_LIMIT } from './sources/shared'
import { truncateText } from './text'
import { JOB_SOURCE_IDS, type Job, type JobSourceId, type RawJob, type Workplace } from './types'

// Brings jobs the user collected by hand (or with another tool) into the feed, from a JSON file.
// Each entry needs title, company and an http(s) url; every other field is optional.
export type ImportFailure = 'invalid-json' | 'no-jobs'
export type ImportResult =
  | { ok: true; feed: Job[]; added: number; updated: number; skipped: number }
  | { ok: false; reason: ImportFailure }

const WORKPLACES: readonly Workplace[] = ['remote', 'hybrid', 'onsite', 'unknown']
// The feed has no "manual" source, so an entry that names none (or an unknown one) is filed under JobStreet.
const FALLBACK_SOURCE: JobSourceId = 'jobstreet'

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const isHttp = (value: string) => /^https?:\/\/\S+$/i.test(value)

function toRawJob(entry: unknown): RawJob | null {
  if (typeof entry !== 'object' || entry === null) return null
  const item = entry as Record<string, unknown>
  const title = text(item.title)
  const company = text(item.company)
  const url = text(item.url)
  if (title === '' || company === '' || !isHttp(url)) return null
  const source = JOB_SOURCE_IDS.find((id) => id === item.source) ?? FALLBACK_SOURCE
  const workplace = WORKPLACES.find((place) => place === item.workplace) ?? 'unknown'
  return {
    source, title, company, url, workplace,
    location: text(item.location),
    contract: text(item.contract),
    level: text(item.level),
    salary: text(item.salary),
    experience: text(item.experience),
    postedAt: text(item.postedAt),
    deadline: text(item.deadline),
    description: truncateText(text(item.description), DESCRIPTION_LIMIT),
    logoUrl: text(item.logoUrl),
  }
}

function entriesOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  const jobs = (data as { jobs?: unknown } | null)?.jobs
  return Array.isArray(jobs) ? jobs : []
}

// New jobs go in as new, unread jobs on Rekomendasi. That tab hides an unscored job whose title is not a wanted role,
// so each one is marked `imported`, which keeps it visible there. A job already in the feed keeps its status.
export function importIntoFeed(existing: readonly Job[], raw: string, now: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'invalid-json' }
  }
  const entries = entriesOf(data)
  const jobs = entries.map(toRawJob).filter((job): job is RawJob => job !== null)
  if (jobs.length === 0) return { ok: false, reason: 'no-jobs' }

  const before = new Set(existing.map((job) => job.id))
  const merged = mergeFeed(existing, jobs, now)
  const feed = merged.map((job) => (before.has(job.id) ? job : { ...job, imported: true }))
  const added = feed.length - existing.length
  return { ok: true, feed, added, updated: jobs.length - added, skipped: entries.length - jobs.length }
}

export function importMessage(result: ImportResult): string {
  if (!result.ok) {
    return result.reason === 'invalid-json'
      ? 'Berkas bukan JSON yang valid.'
      : 'Tidak ada lowongan yang bisa diimpor. Tiap lowongan butuh title, company, dan url (http atau https).'
  }
  const parts = [`${result.added} lowongan ditambahkan ke Rekomendasi`]
  if (result.updated > 0) parts.push(`${result.updated} diperbarui`)
  if (result.skipped > 0) parts.push(`${result.skipped} dilewati karena datanya tidak lengkap`)
  return parts.join(', ') + '.'
}
