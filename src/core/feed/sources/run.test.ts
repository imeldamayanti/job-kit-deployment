import { describe, expect, it } from 'vitest'
import { runSource } from './run'
import type { FetchContext, JobSource } from './types'

const ctx = (sourceDeadlineMs: number): FetchContext => ({ fetch: async () => new Response(''), now: new Date('2026-11-10T08:00:00Z'), companies: {}, sourceDeadlineMs })
const prefs = {} as Parameters<typeof runSource>[1]

describe('runSource deadline', () => {
  it('records a source that never answers as a timeout instead of hanging the run', async () => {
    const hung: JobSource = { id: 'linkedin', fetch: () => new Promise(() => {}) }
    const outcome = await runSource(hung, prefs, ctx(20))
    expect(outcome.run).toMatchObject({ source: 'linkedin', ok: false, reason: 'timeout' })
    expect(outcome.jobs).toEqual([])
  })

  it('returns a source that answers in time', async () => {
    const fast: JobSource = { id: 'remotive', fetch: async () => [] }
    const outcome = await runSource(fast, prefs, ctx(1000))
    expect(outcome.run).toMatchObject({ source: 'remotive', ok: true, count: 0 })
  })
})
