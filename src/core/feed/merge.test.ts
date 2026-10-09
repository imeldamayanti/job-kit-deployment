import { describe, expect, it } from 'vitest'
import { mergeFeed } from './merge'
import type { Job, RawJob } from './types'

const NOW = '2026-10-10T08:00:00.000Z'
const LATER = '2026-10-11T08:00:00.000Z'

function raw(change: Partial<RawJob> = {}): RawJob {
  return {
    source: 'greenhouse',
    title: 'Frontend Engineer',
    company: 'PT Contoh Karya',
    location: 'Jakarta',
    workplace: 'remote',
    contract: '',
    level: '',
    salary: '',
    experience: '',
    postedAt: '2026-10-08',
    deadline: '',
    url: 'https://boards.example.test/jobs/1?utm_source=x',
    description: 'Bangun UI dengan React.',
    logoUrl: '',
    ...change,
  }
}

describe('mergeFeed', () => {
  it('adds a job it has not seen as new, with no score', () => {
    const [job] = mergeFeed([], [raw()], NOW)
    expect(job).toMatchObject({ title: 'Frontend Engineer', status: 'new', score: null, aiFilled: [], firstSeenAt: NOW, lastSeenAt: NOW })
    expect(job?.id).toBeTruthy()
  })

  it('updates the data of a job it already has without resetting status or score', () => {
    const score = { value: 80, matches: ['React'], gaps: [], summary: 'Cocok', rough: false, inputHash: 'h1' }
    const [first] = mergeFeed([], [raw()], NOW)
    const saved: Job = { ...(first as Job), status: 'saved', score, aiFilled: ['level'], level: 'Mid' }
    const [again] = mergeFeed([saved], [raw({ location: 'Bandung', url: 'https://boards.example.test/jobs/1' })], LATER)
    expect(again).toMatchObject({ id: saved.id, status: 'saved', score, aiFilled: ['level'], location: 'Bandung', firstSeenAt: NOW, lastSeenAt: LATER })
  })

  it('keeps an old value when the new one is empty', () => {
    const [first] = mergeFeed([], [raw({ salary: 'Rp 20-30 jt' })], NOW)
    const [again] = mergeFeed([first as Job], [raw({ salary: '' })], LATER)
    expect(again?.salary).toBe('Rp 20-30 jt')
  })

  it('treats the same URL with different tracking as one job', () => {
    const feed = mergeFeed([], [raw({ url: 'https://x.test/j/1?utm_source=a' }), raw({ url: 'https://x.test/j/1?utm_source=b' })], NOW)
    expect(feed).toHaveLength(1)
  })

  it('treats the same title and company from two sources as one job', () => {
    const feed = mergeFeed(
      [],
      [raw(), raw({ source: 'linkedin', title: 'Frontend  Engineer', company: 'pt contoh karya', url: 'https://linkedin.test/jobs/view/9' })],
      NOW,
    )
    expect(feed).toHaveLength(1)
    expect(feed[0]?.source).toBe('greenhouse')
  })

  it('does not merge two different jobs at the same company', () => {
    const feed = mergeFeed([], [raw(), raw({ title: 'Backend Engineer', url: 'https://boards.example.test/jobs/2' })], NOW)
    expect(feed).toHaveLength(2)
  })

  it('leaves jobs that were not in this run untouched', () => {
    const [old] = mergeFeed([], [raw()], NOW)
    const feed = mergeFeed([old as Job], [raw({ title: 'Backend Engineer', url: 'https://boards.example.test/jobs/2' })], LATER)
    expect(feed).toHaveLength(2)
    expect(feed.find((job) => job.id === old?.id)?.lastSeenAt).toBe(NOW)
  })

  it('does not change the list it was given', () => {
    const existing: Job[] = []
    mergeFeed(existing, [raw()], NOW)
    expect(existing).toEqual([])
  })
})
