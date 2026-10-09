import type { JobPreferences, WorkMode } from '../profile/job-preferences'
import type { RawJob, Workplace } from './types'

const MODE_TO_WORKPLACE: Record<WorkMode, Workplace> = { Remote: 'remote', Hybrid: 'hybrid', 'On-site': 'onsite' }

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function hasWord(text: string, word: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, 'iu').test(text)
}

// The cheap filter that runs before any AI call (FR-29): avoided words, work type, location.
export function passesRules(job: RawJob, prefs: JobPreferences): boolean {
  const text = `${job.title}\n${job.description}`
  if (prefs.avoid.some((word) => hasWord(text, word))) return false

  const wanted = prefs.workModes.map((mode) => MODE_TO_WORKPLACE[mode])
  if (wanted.length > 0 && job.workplace !== 'unknown' && !wanted.includes(job.workplace)) return false

  if (prefs.locations.length > 0 && job.location.trim() !== '' && job.workplace !== 'remote') {
    const place = job.location.toLowerCase()
    if (!prefs.locations.some((wantedPlace) => place.includes(wantedPlace.toLowerCase()))) return false
  }
  return true
}
