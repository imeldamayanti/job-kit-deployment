export const JOB_LEVELS = ['Junior', 'Mid', 'Senior', 'Lead'] as const
export type JobLevel = (typeof JOB_LEVELS)[number]

export const WORK_MODES = ['Remote', 'Hybrid', 'On-site'] as const
export type WorkMode = (typeof WORK_MODES)[number]

// What the daily job feed searches and scores for (PRD FR-26). Fill never reads this.
export type JobPreferences = {
  roles: string[]
  level: JobLevel | ''
  locations: string[]
  workModes: WorkMode[]
  mustHave: string[]
  avoid: string[]
  minSalary: string
}

export function createEmptyJobPreferences(): JobPreferences {
  return { roles: [], level: '', locations: [], workModes: [], mustHave: [], avoid: [], minSalary: '' }
}

const sameWord = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export function addListItem(list: string[], value: string): string[] {
  const word = value.trim()
  if (word === '' || list.some((item) => sameWord(item, word))) return list
  return [...list, word]
}

export function removeListItem(list: string[], value: string): string[] {
  return list.filter((item) => item !== value)
}

export function toggleWorkMode(modes: WorkMode[], mode: WorkMode): WorkMode[] {
  const next = modes.includes(mode) ? modes.filter((m) => m !== mode) : [...modes, mode]
  return WORK_MODES.filter((m) => next.includes(m))
}

function words(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.reduce<string[]>((list, item) => (typeof item === 'string' ? addListItem(list, item) : list), [])
}

// Reads whatever was stored or imported and keeps only what this version knows.
export function normalizeJobPreferences(raw: unknown): JobPreferences {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return createEmptyJobPreferences()
  const source = raw as Record<string, unknown>
  const modes = Array.isArray(source.workModes) ? source.workModes : []
  return {
    roles: words(source.roles),
    level: JOB_LEVELS.find((level) => level === source.level) ?? '',
    locations: words(source.locations),
    workModes: WORK_MODES.filter((mode) => modes.includes(mode)),
    mustHave: words(source.mustHave),
    avoid: words(source.avoid),
    minSalary: typeof source.minSalary === 'string' ? source.minSalary : '',
  }
}

// How many of the seven parts have something in them.
export function countJobPreferences(prefs: JobPreferences): number {
  return [
    prefs.roles.length > 0,
    prefs.level !== '',
    prefs.locations.length > 0,
    prefs.workModes.length > 0,
    prefs.mustHave.length > 0,
    prefs.avoid.length > 0,
    prefs.minSalary.trim() !== '',
  ].filter(Boolean).length
}
