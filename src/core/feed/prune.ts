import type { Job } from './types'

export type PruneLimits = { maxAgeDays: number; maxJobs: number; maxPostedDays?: number }
export const DEFAULT_LIMITS: PruneLimits = { maxAgeDays: 30, maxJobs: 500, maxPostedDays: 21 }

const DAY = 24 * 60 * 60 * 1000
const disposable = (job: Job) => job.status === 'new' || job.status === 'hidden'

// A job whose posting date is unknown is never called stale.
export function isStale(postedAt: string, now: Date, maxPostedDays: number): boolean {
  const posted = Date.parse(postedAt)
  return !Number.isNaN(posted) && posted < now.getTime() - maxPostedDays * DAY
}

// Keeps the feed small (PRD §8). Jobs posted more than maxPostedDays ago go too. Only new and hidden jobs are ever dropped; saved and applied stay.
export function pruneFeed(feed: readonly Job[], now: Date, limits: PruneLimits = DEFAULT_LIMITS): Job[] {
  const cutoff = now.getTime() - limits.maxAgeDays * DAY
  const tooOld = (job: Job) => limits.maxPostedDays !== undefined && isStale(job.postedAt, now, limits.maxPostedDays)
  let kept = feed.filter((job) => !(disposable(job) && (Date.parse(job.lastSeenAt) < cutoff || tooOld(job))))
  const surplus = kept.length - limits.maxJobs
  if (surplus > 0) {
    const doomed = new Set(
      kept
        .filter(disposable)
        .sort((a, b) => Date.parse(a.lastSeenAt) - Date.parse(b.lastSeenAt))
        .slice(0, surplus),
    )
    kept = kept.filter((job) => !doomed.has(job))
  }
  return kept
}
