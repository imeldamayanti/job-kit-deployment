import { EMPTY_APPLICATION_DATA, type ApplicationData } from '../applications/types'
import type { Job } from '../feed/types'
import type { Profile } from '../profile/types'

// Version 3 added applications, CVs and letters. Versions 1 and 2 are still read (see parseImport).
// The API key is not part of an Export.
// Jobs the user kept (saved or applied) travel with the profile; the rest of the feed is refetchable.
export function buildExport(
  profile: Profile,
  now: Date,
  feed: readonly Job[] = [],
  data: ApplicationData = EMPTY_APPLICATION_DATA,
): string {
  const jobs = feed.filter((job) => job.status === 'saved' || job.status === 'applied')
  const { applications, cvs, letters } = data
  return JSON.stringify({ app: 'job-kit', version: 3, exportedAt: now.toISOString(), profile, jobs, applications, cvs, letters }, null, 2)
}

export function exportFileName(now: Date): string {
  return `job-kit-export-${now.toISOString().slice(0, 10)}.json`
}
