import type { JobPreferences, WorkMode } from '../profile/job-preferences'
import type { RawJob, Workplace } from './types'

const MODE_TO_WORKPLACE: Record<WorkMode, Workplace> = { Remote: 'remote', Hybrid: 'hybrid', 'On-site': 'onsite' }

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function hasWord(text: string, word: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, 'iu').test(text)
}

// Words in a remote job's location that say it can be worked from Indonesia.
const OPEN_REGIONS = ['worldwide', 'anywhere', 'global', 'international', 'apac', 'asia', 'asia pacific', 'asean', 'southeast asia', 'sea', 'indonesia']
// What is left of a location once these are taken out says whether any region is named at all ("Remote" alone names none).
const NO_REGION = /(?<![\p{L}\p{N}])(remote|fully|work from home|wfh|distributed|home|based)(?![\p{L}\p{N}])|[^\p{L}\p{N}]+/giu

// A remote job is only useful if the candidate may take it. "USA Only" or "Europe" says they may not.
function remoteOpenTo(location: string, wanted: string[]): boolean {
  if (wanted.length === 0 || location.replace(NO_REGION, '') === '') return true
  return [...OPEN_REGIONS, ...wanted].some((place) => hasWord(location, place))
}

// The cheap filter that runs before any AI call (FR-29): avoided words, work type, location.
export function passesRules(job: RawJob, prefs: JobPreferences): boolean {
  const text = `${job.title}\n${job.description}`
  if (prefs.avoid.some((word) => hasWord(text, word))) return false
  if (job.workplace === 'remote' && !remoteOpenTo(job.location, prefs.locations)) return false

  const wanted = prefs.workModes.map((mode) => MODE_TO_WORKPLACE[mode])
  if (wanted.length > 0 && job.workplace !== 'unknown' && !wanted.includes(job.workplace)) return false

  // Only a job known to be at a place can be ruled out by that place. When the work type is unknown, a location like
  // "Indonesia" or "APAC" often sits on a remote role, so the score decides instead of a guess here.
  const placed = job.workplace === 'onsite' || job.workplace === 'hybrid'
  if (prefs.locations.length > 0 && job.location.trim() !== '' && placed) {
    const place = job.location.toLowerCase()
    if (!prefs.locations.some((wantedPlace) => place.includes(wantedPlace.toLowerCase()))) return false
  }
  return true
}
