import type { JobPreferences } from '../../profile/job-preferences'
import { SourceError, type FetchContext, type JobSource, type SourceOutcome } from './types'

// LinkedIn alone waits 3-6s between up to 35 requests (about 2.5 minutes of pauses), so the cap sits well above that.
const SOURCE_DEADLINE_MS = 6 * 60 * 1000

// One hung source (a page that never loads, a parser that never answers) must not hold the whole run.
function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SourceError('timeout')), ms)
  })
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer))
}

// Never throws for a source problem: the run records why and the others carry on (FR-27).
export async function runSource(source: JobSource, prefs: JobPreferences, ctx: FetchContext): Promise<SourceOutcome> {
  const at = ctx.now.toISOString()
  try {
    const jobs = await withDeadline(source.fetch(prefs, ctx), ctx.sourceDeadlineMs ?? SOURCE_DEADLINE_MS)
    return { run: { source: source.id, at, ok: true, count: jobs.length }, jobs }
  } catch (error) {
    const reason = error instanceof SourceError ? error.reason : 'parse'
    return { run: { source: source.id, at, ok: false, count: 0, reason }, jobs: [] }
  }
}
