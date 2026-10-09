export const JOB_SOURCE_IDS = ['greenhouse', 'lever', 'ashby', 'remotive', 'linkedin'] as const
export type JobSourceId = (typeof JOB_SOURCE_IDS)[number]

export type Workplace = 'remote' | 'hybrid' | 'onsite' | 'unknown'

// What the user has done with a job in the feed (FR-30).
export type JobStatus = 'new' | 'saved' | 'applied' | 'hidden'

// Fields a source may leave empty are '' and are simply not shown.
export type RawJob = {
  source: JobSourceId
  title: string
  company: string
  location: string
  workplace: Workplace
  contract: string
  level: string
  salary: string
  experience: string
  postedAt: string
  deadline: string
  url: string
  description: string
  logoUrl: string
}

export type JobScore = {
  value: number
  matches: string[]
  gaps: string[]
  summary: string
  // True when the score comes from the rules, not from the AI ("Skor kasar").
  rough: boolean
  // Hash of the profile and preferences the score was made for.
  inputHash: string
}

// Names of RawJob fields the AI filled in, so the card can mark them.
export type AiFilled = 'workplace' | 'contract' | 'level' | 'salary' | 'experience'

export type Job = RawJob & {
  id: string
  status: JobStatus
  score: JobScore | null
  aiFilled: AiFilled[]
  firstSeenAt: string
  lastSeenAt: string
}

export type FailReason = 'blocked' | 'timeout' | 'parse' | 'network' | `http-${number}`

export type SourceRun = {
  source: JobSourceId
  at: string
  ok: boolean
  count: number
  reason?: FailReason
}
