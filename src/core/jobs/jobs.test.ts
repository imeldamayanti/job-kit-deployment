import { describe, expect, it } from 'vitest'
import { filterJobs, formatJobDate, initialsOf } from './jobs'
import type { CapturedJob } from './types'

const job = (over: Partial<CapturedJob>): CapturedJob => ({
  id: 'j',
  title: 'Frontend Engineer',
  company: 'Contoh Karya',
  origin: 'boards.example.test',
  appliedAt: '2026-09-02T10:14:00Z',
  status: 'Applied',
  snapshot: [],
  ...over,
})

describe('filterJobs', () => {
  const jobs = [
    job({ id: '1' }),
    job({ id: '2', title: 'React Developer', company: 'Bumi Mandiri', origin: 'jobs.bumi.test', status: 'Offer' }),
    job({ id: '3', title: 'Fullstack Engineer', company: 'Sinar Data', status: 'Rejected' }),
  ]

  it('keeps everything for an empty query and the Semua status', () => {
    expect(filterJobs(jobs, { query: '', status: 'Semua' })).toHaveLength(3)
  })

  it('narrows by status', () => {
    expect(filterJobs(jobs, { query: '', status: 'Offer' }).map((j) => j.id)).toEqual(['2'])
  })

  it('searches title, company, and site, ignoring case and outer spaces', () => {
    expect(filterJobs(jobs, { query: ' react ', status: 'Semua' }).map((j) => j.id)).toEqual(['2'])
    expect(filterJobs(jobs, { query: 'SINAR', status: 'Semua' }).map((j) => j.id)).toEqual(['3'])
    expect(filterJobs(jobs, { query: 'bumi.test', status: 'Semua' }).map((j) => j.id)).toEqual(['2'])
  })

  it('combines query and status', () => {
    expect(filterJobs(jobs, { query: 'engineer', status: 'Rejected' }).map((j) => j.id)).toEqual(['3'])
    expect(filterJobs(jobs, { query: 'engineer', status: 'Offer' })).toEqual([])
  })
})

describe('formatJobDate', () => {
  it('writes day, short Indonesian month, and year', () => {
    expect(formatJobDate('2026-09-02T10:14:00Z')).toBe('2 Sep 2026')
    expect(formatJobDate('2026-08-29T10:14:00Z')).toBe('29 Agu 2026')
    expect(formatJobDate('2026-05-11T10:14:00Z')).toBe('11 Mei 2026')
  })
})

describe('initialsOf', () => {
  it('takes the first letters of the first two words', () => {
    expect(initialsOf('Contoh Karya')).toBe('CK')
    expect(initialsOf('aksara pagi')).toBe('AP')
    expect(initialsOf('Nusa')).toBe('N')
    expect(initialsOf('  ')).toBe('?')
  })
})
