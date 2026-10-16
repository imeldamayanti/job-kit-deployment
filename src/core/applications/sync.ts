import type { Job, JobStatus } from '../feed/types'
import type { AppStatus, Application } from './types'

// The application is the source of truth (D11); the status of the job in the feed follows it (FR-36).
// A draft or a withdrawn application means the job is only saved; anything further means it was applied to.
const AS_JOB_STATUS: Record<AppStatus, JobStatus> = {
  draft: 'saved',
  withdrawn: 'saved',
  applied: 'applied',
  'in-review': 'applied',
  interview: 'applied',
  offer: 'applied',
  rejected: 'applied',
}

export const deriveJobStatus = (app: Application): JobStatus => AS_JOB_STATUS[app.status]

function setStatusOf(feed: Job[], jobId: string | null, status: JobStatus): Job[] {
  if (jobId === null) return feed
  const job = feed.find((item) => item.id === jobId)
  // A job the feed already pruned is not an error: the application keeps its own copy.
  if (!job || job.status === status) return feed
  return feed.map((item) => (item.id === jobId ? { ...item, status } : item))
}

export const syncJobStatus = (feed: Job[], app: Application): Job[] => setStatusOf(feed, app.jobId, deriveJobStatus(app))

export const syncFeed = (feed: Job[], apps: readonly Application[]): Job[] => apps.reduce(syncJobStatus, feed)

// The application was deleted: its job goes back to saved, not to Dilamar, so it does not vanish.
export const releaseJob = (feed: Job[], app: Application): Job[] => setStatusOf(feed, app.jobId, 'saved')
