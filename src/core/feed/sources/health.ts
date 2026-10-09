import type { JobSourceId, SourceRun } from '../types'

export const PAUSE_AFTER_FAILURES = 3

// A source that failed its last three runs in a row is paused until the user turns it back on (PRD §8).
export function shouldPause(runs: readonly SourceRun[], source: JobSourceId): boolean {
  const recent = runs.filter((run) => run.source === source).sort((a, b) => b.at.localeCompare(a.at)).slice(0, PAUSE_AFTER_FAILURES)
  return recent.length === PAUSE_AFTER_FAILURES && recent.every((run) => !run.ok)
}
