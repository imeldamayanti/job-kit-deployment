import { describe, expect, it } from 'vitest'
import { bannerText, openedFrom, shouldMarkApplied } from './opened'
import type { Job } from './types'

const job = (change: Partial<Job> = {}) => ({ id: 'j1', title: 'Frontend Engineer', score: null, ...change }) as Job
const score = (value: number, rough = false) => ({ value, matches: [], gaps: [], summary: '', rough, inputHash: '' })

describe('openedFrom', () => {
  it('keeps what the panel needs to show and to mark the job', () => {
    expect(openedFrom(job({ score: score(86) }))).toEqual({ jobId: 'j1', title: 'Frontend Engineer', score: 86, rough: false })
  })

  it('has no score when the job has none', () => {
    expect(openedFrom(job())).toEqual({ jobId: 'j1', title: 'Frontend Engineer', score: null, rough: false })
  })
})

describe('bannerText', () => {
  it('names the score', () => {
    expect(bannerText({ jobId: 'j', title: 't', score: 86, rough: false })).toBe('Dari Lowongan · skor 86')
  })

  it('says when the score is rough', () => {
    expect(bannerText({ jobId: 'j', title: 't', score: 58, rough: true })).toBe('Dari Lowongan · skor kasar 58')
  })

  it('still says where the tab came from without a score', () => {
    expect(bannerText({ jobId: 'j', title: 't', score: null, rough: false })).toBe('Dari Lowongan')
  })
})

describe('shouldMarkApplied', () => {
  const opened = { jobId: 'j', title: 't', score: null, rough: false }

  it('marks only a tab that came from the feed, and only when something was filled', () => {
    expect(shouldMarkApplied(opened, 5)).toBe(true)
    expect(shouldMarkApplied(opened, 0)).toBe(false)
    expect(shouldMarkApplied(undefined, 5)).toBe(false)
  })
})
