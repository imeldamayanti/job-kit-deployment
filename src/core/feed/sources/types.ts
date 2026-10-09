import type { JobPreferences } from '../../profile/job-preferences'
import type { FailReason, JobSourceId, RawJob, SourceRun } from '../types'

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export type FetchContext = {
  fetch: FetchLike
  now: Date
  // Board names the user picked, per ATS source (S6).
  companies: Partial<Record<JobSourceId, string[]>>
  timeoutMs?: number
  // Waits between retries; tests pass an instant one.
  sleep?: (ms: number) => Promise<void>
}

export type JobSource = {
  id: JobSourceId
  fetch: (prefs: JobPreferences, ctx: FetchContext) => Promise<RawJob[]>
}

export class SourceError extends Error {
  constructor(public reason: FailReason) {
    super(reason)
  }
}

export type SourceOutcome = { run: SourceRun; jobs: RawJob[] }
