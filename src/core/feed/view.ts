import type { FeedState } from './schedule'
import type { Job, JobSourceId, JobStatus, SourceRun } from './types'

export const SOURCE_NAMES: Record<JobSourceId, string> = {
  greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby', remotive: 'Remotive', linkedin: 'LinkedIn',
}

export type ScoreTier = { tier: 'hi' | 'mid' | 'lo'; label: 'Cocok' | 'Lumayan' | 'Kurang' }

export function scoreTier(value: number): ScoreTier {
  if (value >= 75) return { tier: 'hi', label: 'Cocok' }
  if (value >= 50) return { tier: 'mid', label: 'Lumayan' }
  return { tier: 'lo', label: 'Kurang' }
}

// Rekomendasi only shows jobs scored at least this much; unscored jobs wait until they are scored.
export const MIN_RECOMMENDED_SCORE = 50

export type FeedTab = 'recommended' | 'saved'
export type WorkplaceFilter = 'all' | 'remote' | 'hybrid' | 'onsite'
export type SavedStatusFilter = 'all' | 'saved' | 'applied' | 'hidden'
export type FeedFilter = { tab: FeedTab; workplace: WorkplaceFilter; query: string; status: SavedStatusFilter }

export function filterFeed(feed: readonly Job[], { tab, workplace, query, status }: FeedFilter): Job[] {
  const needle = query.trim().toLowerCase()
  return feed.filter((job) => {
    if (tab === 'recommended' ? job.status !== 'new' : status === 'all' ? job.status !== 'saved' && job.status !== 'applied' : job.status !== status) return false
    if (tab === 'recommended' && (job.score?.value ?? -1) < MIN_RECOMMENDED_SCORE) return false
    if (tab === 'recommended' && workplace !== 'all' && job.workplace !== workplace) return false
    if (needle === '') return true
    return [job.title, job.company, job.location, job.source].some((text) => text.toLowerCase().includes(needle))
  })
}

export type FeedOrder = 'score' | 'newest'

const recency = (job: Job) => Date.parse(job.postedAt || job.firstSeenAt) || 0

export function sortFeed(feed: readonly Job[], order: FeedOrder): Job[] {
  return [...feed].sort((a, b) => {
    if (order === 'score') {
      const diff = (b.score?.value ?? -1) - (a.score?.value ?? -1)
      if (diff !== 0) return diff
    }
    return recency(b) - recency(a)
  })
}

export function setJobStatus(feed: readonly Job[], id: string, status: JobStatus): Job[] {
  return feed.map((job) => (job.id === id ? { ...job, status } : job))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const DAY = 24 * 60 * 60 * 1000

function postedText(postedAt: string, now: Date): string {
  const posted = Date.parse(postedAt)
  if (Number.isNaN(posted)) return ''
  const days = Math.max(0, Math.floor((now.getTime() - posted) / DAY))
  return days === 0 ? 'Diposting hari ini' : days < 30 ? `Diposting ${days} hari lalu` : `Diposting ${Math.floor(days / 30)} bulan lalu`
}

function deadlineText(deadline: string): string {
  const time = Date.parse(deadline)
  if (Number.isNaN(time)) return ''
  const date = new Date(time)
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

export type MetaItem = { label: string; value: string }

// The meta line of a card. An item the job does not have is left out, never filled with "Negotiable".
export function jobMeta(job: Job, now: Date): MetaItem[] {
  const items: MetaItem[] = [
    { label: 'Gaji', value: job.salary },
    { label: 'Pengalaman', value: job.experience },
    { label: 'Deadline', value: deadlineText(job.deadline) },
    { label: '', value: postedText(job.postedAt, now) },
  ]
  return items.filter((item) => item.value !== '')
}

export function initialsOf(name: string): string {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('')
  return letters || '?'
}

export function formatUpdated(lastRunAt: string, newCount: number): string {
  if (lastRunAt === '') return 'Belum pernah diperbarui'
  const time = new Date(lastRunAt)
  const clock = `${String(time.getHours()).padStart(2, '0')}.${String(time.getMinutes()).padStart(2, '0')}`
  return newCount > 0 ? `Diperbarui ${clock} · ${newCount} baru` : `Diperbarui ${clock}`
}

const REASON_TEXT: Record<string, string> = {
  blocked: 'diblokir sementara', timeout: 'terlalu lama menjawab', parse: 'struktur halaman berubah', network: 'tidak terhubung',
}

function causeText(reason: string | undefined): string {
  if (reason?.startsWith('http-')) return `server membalas ${reason.slice(5)}`
  return REASON_TEXT[reason ?? ''] ?? 'gagal'
}

const latestRuns = (runs: readonly SourceRun[]) => {
  const latest = new Map<JobSourceId, SourceRun>()
  for (const run of [...runs].sort((a, b) => a.at.localeCompare(b.at))) latest.set(run.source, run)
  return [...latest.values()]
}

// The notices above the list: sources that failed last time, and sources that were paused (PRD §8).
export function sourceNotices(runs: readonly SourceRun[], paused: readonly JobSourceId[]): string[] {
  const failed = latestRuns(runs)
    .filter((run) => !run.ok && !paused.includes(run.source))
    .map((run) => `${SOURCE_NAMES[run.source]} tidak bisa diambil hari ini (${causeText(run.reason)}). Sumber lain tetap jalan.`)
  const stopped = paused.map((source) => `${SOURCE_NAMES[source]} dijeda setelah 3 kali gagal berturut-turut. Nyalakan lagi di Atur Lowongan.`)
  return [...failed, ...stopped]
}

export type FeedView = 'no-prefs' | 'not-enabled' | 'fetching' | 'all-failed' | 'empty-today' | 'no-match' | 'list'

export function describeFeed(input: {
  hasRoles: boolean
  anySourceOn: boolean
  state: FeedState
  runs: readonly SourceRun[]
  recommended: number
  shown: number
}): FeedView {
  if (!input.hasRoles) return 'no-prefs'
  if (!input.anySourceOn) return 'not-enabled'
  if (input.shown > 0) return 'list'
  if (input.recommended > 0) return 'no-match'
  if (input.state.running) return 'fetching'
  const latest = latestRuns(input.runs)
  if (latest.length > 0 && latest.every((run) => !run.ok)) return 'all-failed'
  return 'empty-today'
}
