import { describe, expect, it } from 'vitest'
import { AiError } from '../ai/errors'
import type { ScoringClient } from '../ai/score'
import { createEmptyProfile } from '../profile/profile'
import type { Profile } from '../profile/types'
import { runFeed, type PipelineOptions } from './pipeline'
import { createDefaultSettings, setSourceEnabled } from './settings'
import type { FetchContext, JobSource } from './sources/types'
import { SourceError } from './sources/types'
import type { Job, RawJob, SourceRun } from './types'

const NOW = new Date('2026-10-10T08:00:00Z')

function raw(id: string, change: Partial<RawJob> = {}): RawJob {
  return {
    source: 'ashby', title: `Frontend ${id}`, company: 'PT Contoh', location: 'Remote', workplace: 'remote', contract: '', level: '',
    salary: '', experience: '', postedAt: '2026-10-09', deadline: '', url: `https://x.test/${id}`, description: 'React', logoUrl: '', ...change,
  }
}
const source = (id: JobSource['id'], jobs: RawJob[] | SourceError): JobSource => ({
  id,
  fetch: async () => {
    if (jobs instanceof SourceError) throw jobs
    return jobs
  },
})
const profile = (): Profile => {
  const p = createEmptyProfile()
  p.jobPrefs.roles = ['Frontend']
  return p
}
const ctx = {} as FetchContext
const okClient: ScoringClient = {
  complete: async (request) => ({
    text: JSON.stringify([...request.user.matchAll(/"id":"([^"]+)"/g)].map((m) => ({ id: m[1], score: 77, matches: ['React'], gaps: [], summary: 's' }))),
    usage: { inputTokens: 10, outputTokens: 5 },
  }),
}

function options(change: Partial<PipelineOptions> = {}): PipelineOptions {
  const settings = setSourceEnabled(setSourceEnabled(createDefaultSettings(), 'ashby', true), 'remotive', true)
  return {
    profile: profile(), settings, key: 'k', feed: [], runs: [], now: NOW, ctx, client: okClient,
    sources: [source('ashby', [raw('1'), raw('2')]), source('remotive', [raw('3', { source: 'remotive', url: 'https://r.test/3' })])],
    ...change,
  }
}

describe('runFeed', () => {
  it('fetches the enabled sources, merges, scores, and records a run per source', async () => {
    const result = await runFeed(options())
    expect(result.feed).toHaveLength(3)
    expect(result.feed.every((job) => job.score?.rough === false && job.status === 'new')).toBe(true)
    expect(result.thisRuns.map((run) => [run.source, run.ok, run.count])).toEqual([['ashby', true, 2], ['remotive', true, 1]])
    expect(result.newJobs).toBe(3)
    expect(result.usage.inputTokens).toBeGreaterThan(0)
  })

  it('skips a source that is switched off', async () => {
    const settings = setSourceEnabled(createDefaultSettings(), 'ashby', true)
    const result = await runFeed(options({ settings }))
    expect(result.thisRuns.map((run) => run.source)).toEqual(['ashby'])
  })

  it('keeps going when one source fails, and says why', async () => {
    const result = await runFeed(options({ sources: [source('ashby', [raw('1')]), source('remotive', new SourceError('blocked'))] }))
    expect(result.feed).toHaveLength(1)
    expect(result.thisRuns.find((run) => run.source === 'remotive')).toMatchObject({ ok: false, reason: 'blocked', count: 0 })
  })

  it('skips a source that failed its last three runs', async () => {
    const failed = (at: string): SourceRun => ({ source: 'remotive', at, ok: false, count: 0, reason: 'blocked' })
    const result = await runFeed(options({ runs: [failed('2026-10-07'), failed('2026-10-08'), failed('2026-10-09')] }))
    expect(result.thisRuns.map((run) => run.source)).toEqual(['ashby'])
    expect(result.paused).toEqual(['remotive'])
  })

  it('drops jobs the rules refuse before they reach the feed or the AI', async () => {
    const p = profile()
    p.jobPrefs.avoid = ['php']
    const result = await runFeed(options({ profile: p, sources: [source('ashby', [raw('1'), raw('2', { description: 'PHP lama' })])] }))
    expect(result.feed.map((job) => job.id)).toEqual(['https://x.test/1'])
  })

  it('does not call the AI without a key and says so', async () => {
    let called = 0
    const result = await runFeed(options({ key: '', client: { complete: async () => (called++, { text: '[]', usage: { inputTokens: 0, outputTokens: 0 } }) } }))
    expect(called).toBe(0)
    expect(result.aiProblem).toBe('no-key')
    expect(result.feed.every((job) => job.score?.rough === true)).toBe(true)
  })

  it('reports a refused key and still returns every job with a rough score', async () => {
    const result = await runFeed(options({ client: { complete: async () => { throw new AiError('invalid-key') } } }))
    expect(result.aiProblem).toBe('invalid-key')
    expect(result.feed).toHaveLength(3)
  })

  it('does not score hidden jobs', async () => {
    const hidden: Job = { id: 'https://x.test/1', status: 'hidden', score: null, aiFilled: [], firstSeenAt: '', lastSeenAt: '', ...raw('1') }
    const result = await runFeed(options({ feed: [hidden], sources: [source('ashby', [raw('1')])] }))
    expect(result.feed[0]?.score).toBeNull()
  })

  it('reports progress by stage, in order', async () => {
    const stages: string[] = []
    await runFeed(options({ onStage: (stage) => stages.push(stage) }))
    expect(stages).toEqual(['fetch', 'merge', 'score'])
  })

  it('counts only jobs that were not in the feed before as new', async () => {
    const first = await runFeed(options())
    const second = await runFeed(options({ feed: first.feed, runs: first.runs }))
    expect(second.newJobs).toBe(0)
  })
})
