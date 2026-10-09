import type { Job } from '../feed/types'
import type { Profile } from '../profile/types'

// Jobs the user kept (saved or applied) travel with the profile; the rest of the feed is refetchable.
export function buildExport(profile: Profile, now: Date, feed: readonly Job[] = []): string {
  const jobs = feed.filter((job) => job.status === 'saved' || job.status === 'applied')
  return JSON.stringify({ app: 'job-kit', version: 2, exportedAt: now.toISOString(), profile, jobs }, null, 2)
}

export function exportFileName(now: Date): string {
  return `job-kit-export-${now.toISOString().slice(0, 10)}.json`
}
