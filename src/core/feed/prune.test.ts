import { describe, expect, it } from 'vitest'
import { pruneFeed } from './prune'
import type { Job, JobStatus } from './types'

const NOW = new Date('2026-10-31T00:00:00.000Z')

function job(id: string, status: JobStatus, lastSeen: string): Job {
  return {
    id, status, score: null, aiFilled: [], firstSeenAt: lastSeen, lastSeenAt: lastSeen,
    source: 'greenhouse', title: id, company: 'C', location: '', workplace: 'unknown', contract: '', level: '',
    salary: '', experience: '', postedAt: '', deadline: '', url: `https://x.test/${id}`, description: '', logoUrl: '',
  }
}

describe('pruneFeed', () => {
  it('drops new and hidden jobs not seen for more than 30 days', () => {
    const feed = [job('a', 'new', '2026-09-20T00:00:00.000Z'), job('b', 'hidden', '2026-09-20T00:00:00.000Z'), job('c', 'new', '2026-10-25T00:00:00.000Z')]
    expect(pruneFeed(feed, NOW).map((j) => j.id)).toEqual(['c'])
  })

  it('never drops saved or applied jobs automatically', () => {
    const feed = [job('a', 'saved', '2026-01-01T00:00:00.000Z'), job('b', 'applied', '2026-01-01T00:00:00.000Z')]
    expect(pruneFeed(feed, NOW)).toHaveLength(2)
  })

  it('over the limit, drops the oldest new or hidden jobs first', () => {
    const feed = [
      job('old', 'new', '2026-10-20T00:00:00.000Z'),
      job('mid', 'hidden', '2026-10-25T00:00:00.000Z'),
      job('keep', 'saved', '2026-10-01T00:00:00.000Z'),
      job('fresh', 'new', '2026-10-30T00:00:00.000Z'),
    ]
    expect(pruneFeed(feed, NOW, { maxAgeDays: 30, maxJobs: 3 }).map((j) => j.id)).toEqual(['mid', 'keep', 'fresh'])
  })

  it('may stay over the limit when everything left is saved or applied', () => {
    const feed = [job('a', 'saved', '2026-10-01T00:00:00.000Z'), job('b', 'applied', '2026-10-02T00:00:00.000Z')]
    expect(pruneFeed(feed, NOW, { maxAgeDays: 30, maxJobs: 1 })).toHaveLength(2)
  })

  it('keeps the order of the list it was given', () => {
    const feed = [job('b', 'new', '2026-10-30T00:00:00.000Z'), job('a', 'new', '2026-10-29T00:00:00.000Z')]
    expect(pruneFeed(feed, NOW).map((j) => j.id)).toEqual(['b', 'a'])
  })
})
