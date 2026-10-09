import type { Profile } from '../profile/types'

export function buildExport(profile: Profile, now: Date): string {
  return JSON.stringify({ app: 'job-kit', version: 1, exportedAt: now.toISOString(), profile }, null, 2)
}

export function exportFileName(now: Date): string {
  return `job-kit-export-${now.toISOString().slice(0, 10)}.json`
}
