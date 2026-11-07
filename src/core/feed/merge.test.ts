import { describe, expect, it } from 'vitest'
import { dedupeFeed, mergeFeed } from './merge'
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

describe('dedupeFeed', () => {
  const job = (id: string, change: Partial<Job> = {}): Job => ({
    ...raw({ url: `https://boards.example.test/jobs/${id}` }), id, status: 'new', score: null, aiFilled: [], firstSeenAt: NOW, lastSeenAt: NOW, ...change,
  })
  const score = (value: number) => ({ value, matches: [], gaps: [], summary: '', rough: false, inputHash: 'h' })
  const ids = (jobs: Job[]) => jobs.map((j) => j.id)

  it('drops a new job that has the same title and company as an earlier one, even from another source', () => {
    const feed = [job('a'), job('b', { source: 'lever', company: 'Contoh Karya' })]
    expect(ids(dedupeFeed(feed))).toEqual(['a'])
  })

  it('drops a new job with the same link as another one', () => {
    const feed = [job('a'), job('b', { title: 'Other title', company: 'Other', url: 'https://boards.example.test/jobs/a?utm_source=x' })]
    expect(ids(dedupeFeed(feed))).toEqual(['a'])
  })

  it('keeps the copy that has a score', () => {
    const feed = [job('a'), job('b', { score: score(70) })]
    expect(ids(dedupeFeed(feed))).toEqual(['b'])
  })

  it('keeps the saved, applied or hidden copy and drops the new one', () => {
    for (const status of ['saved', 'applied', 'hidden'] as const) {
      expect(ids(dedupeFeed([job('new-copy'), job('kept', { status })]))).toEqual(['kept'])
    }
  })

  it('never drops a job the user has acted on, even when two of them look the same', () => {
    const feed = [job('a', { status: 'saved' }), job('b', { status: 'applied' })]
    expect(ids(dedupeFeed(feed))).toEqual(['a', 'b'])
  })

  it('leaves different jobs alone and does not change the list it was given', () => {
    const feed = [job('a'), job('b', { title: 'Backend Engineer' }), job('c', { company: 'PT Lain' })]
    expect(ids(dedupeFeed(feed))).toEqual(['a', 'b', 'c'])
    const copy = [job('a'), job('b')]
    dedupeFeed(copy)
    expect(copy).toHaveLength(2)
  })
})
