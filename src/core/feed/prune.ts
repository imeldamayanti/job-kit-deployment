import type { Job } from './types'

export type PruneLimits = { maxAgeDays: number; maxJobs: number }
export const DEFAULT_LIMITS: PruneLimits = { maxAgeDays: 30, maxJobs: 500 }

const DAY = 24 * 60 * 60 * 1000
const disposable = (job: Job) => job.status === 'new' || job.status === 'hidden'

// Keeps the feed small (PRD §8). Only new and hidden jobs are ever dropped; saved and applied stay.
export function pruneFeed(feed: readonly Job[], now: Date, limits: PruneLimits = DEFAULT_LIMITS): Job[] {
  const cutoff = now.getTime() - limits.maxAgeDays * DAY
  let kept = feed.filter((job) => !(disposable(job) && Date.parse(job.lastSeenAt) < cutoff))
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
