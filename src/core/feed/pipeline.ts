import type { AiFailure } from '../ai/errors'
import { AiError } from '../ai/errors'
import { scoreJobs, type AiUsage, type ScoringClient } from '../ai/score'
import type { Profile } from '../profile/types'
import { mergeFeed } from './merge'
import { pruneFeed } from './prune'
import { passesRules } from './rules'
import type { FeedSettings } from './settings'
import { shouldPause } from './sources/health'
import { runSource } from './sources/run'
import type { FetchContext, JobSource } from './sources/types'
import type { FeedStage } from './schedule'
import type { Job, JobSourceId, RawJob, SourceRun } from './types'

const RUN_HISTORY = 20

export type PipelineOptions = {
  profile: Profile
  settings: FeedSettings
  key: string
  feed: Job[]
  runs: SourceRun[]
  now: Date
  ctx: FetchContext
  client: ScoringClient
  sources: JobSource[]
  onStage?: (stage: FeedStage) => void
}

export type PipelineResult = {
  feed: Job[]
  runs: SourceRun[]
  thisRuns: SourceRun[]
  paused: JobSourceId[]
  newJobs: number
  aiProblem: AiFailure | null
  usage: AiUsage
}

const refusing: ScoringClient = { complete: async () => { throw new AiError('no-key') } }

// One run of the daily feed: sources in parallel, then rules, merge, score. A source that fails
// is recorded and the rest carry on (FR-27).
export async function runFeed({ profile, settings, key, feed, runs, now, ctx, client, sources, onStage }: PipelineOptions): Promise<PipelineResult> {
  const stamp = now.toISOString()
  const fetchCtx: FetchContext = { ...ctx, now, companies: settings.companies }

  onStage?.('fetch')
  const enabled = sources.filter((source) => settings.sources[source.id])
  const paused = enabled.filter((source) => shouldPause(runs, source.id)).map((source) => source.id)
  const active = enabled.filter((source) => !paused.includes(source.id))
  const outcomes = await Promise.all(active.map((source) => runSource(source, profile.jobPrefs, fetchCtx)))
  const thisRuns = outcomes.map((outcome) => outcome.run)

  onStage?.('merge')
  const raws: RawJob[] = outcomes.flatMap((outcome) => outcome.jobs).filter((job) => passesRules(job, profile.jobPrefs))
  const known = new Set(feed.map((job) => job.id))
  const merged = pruneFeed(mergeFeed(feed, raws, stamp), now)
  const newJobs = merged.filter((job) => !known.has(job.id)).length

  onStage?.('score')
  const scorable = merged.filter((job) => job.status !== 'hidden')
  const scored = await scoreJobs({ jobs: scorable, profile, client: key.trim() === '' ? refusing : client, key, model: settings.ai.model, now })
  const byId = new Map(scored.jobs.map((job) => [job.id, job]))

  return {
    feed: merged.map((job) => byId.get(job.id) ?? job),
    runs: trimRuns([...runs, ...thisRuns]),
    thisRuns,
    paused,
    newJobs,
    aiProblem: scored.aiProblem ?? null,
    usage: scored.usage,
  }
}

function trimRuns(runs: SourceRun[]): SourceRun[] {
  const perSource = new Map<JobSourceId, SourceRun[]>()
  for (const run of runs) perSource.set(run.source, [...(perSource.get(run.source) ?? []), run])
  return [...perSource.values()].flatMap((list) => list.sort((a, b) => a.at.localeCompare(b.at)).slice(-RUN_HISTORY))
}

// Turning a source back on forgets its failures, so it is not paused again at once.
export const clearRunsFor = (runs: SourceRun[], source: JobSourceId): SourceRun[] => runs.filter((run) => run.source !== source)
