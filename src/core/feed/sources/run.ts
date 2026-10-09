import type { JobPreferences } from '../../profile/job-preferences'
import { SourceError, type FetchContext, type JobSource, type SourceOutcome } from './types'

// Never throws for a source problem: the run records why and the others carry on (FR-27).
export async function runSource(source: JobSource, prefs: JobPreferences, ctx: FetchContext): Promise<SourceOutcome> {
  const at = ctx.now.toISOString()
  try {
    const jobs = await source.fetch(prefs, ctx)
    return { run: { source: source.id, at, ok: true, count: jobs.length }, jobs }
  } catch (error) {
    const reason = error instanceof SourceError ? error.reason : 'parse'
    return { run: { source: source.id, at, ok: false, count: 0, reason }, jobs: [] }
  }
}
