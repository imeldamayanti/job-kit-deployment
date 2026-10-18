import { describe, expect, it } from 'vitest'
import {
  describeFeed,
  filterFeed,
  formatUpdated,
  initialsOf,
  jobMeta,
  scoreTier,
  setJobStatus,
  sortFeed,
  sourceNotices,
} from './view'
import type { FeedState } from './schedule'
import { initialFeedState } from './schedule'
import type { Job, JobStatus, SourceRun, Workplace } from './types'

const NOW = new Date('2026-10-10T08:00:00Z')

function job(id: string, change: Partial<Job> = {}): Job {
  return {
    id, status: 'new', score: null, aiFilled: [], firstSeenAt: '2026-10-10T07:00:00.000Z', lastSeenAt: '2026-10-10T07:00:00.000Z',
    source: 'ashby', title: `Job ${id}`, company: 'PT Contoh', location: 'Jakarta', workplace: 'remote', contract: '', level: '', salary: '',
    experience: '', postedAt: '2026-10-08', deadline: '', url: `https://x.test/${id}`, description: '', logoUrl: '', ...change,
  }
}
const score = (value: number) => ({ value, matches: [], gaps: [], summary: '', rough: false, inputHash: 'h' })

describe('scoreTier', () => {
  it('splits at 75 and 50', () => {
    expect(scoreTier(100)).toEqual({ tier: 'hi', label: 'Cocok' })
    expect(scoreTier(75)).toEqual({ tier: 'hi', label: 'Cocok' })
    expect(scoreTier(74)).toEqual({ tier: 'mid', label: 'Lumayan' })
    expect(scoreTier(50)).toEqual({ tier: 'mid', label: 'Lumayan' })
    expect(scoreTier(49)).toEqual({ tier: 'lo', label: 'Kurang' })
  })
})

describe('filterFeed', () => {
  const feed = [
    job('a', { workplace: 'remote', title: 'Frontend Engineer', score: score(80) }),
    job('b', { workplace: 'hybrid', company: 'Studio Contoh', score: score(50) }),
    job('c', { status: 'saved' }),
    job('d', { status: 'applied' }),
    job('e', { status: 'hidden' }),
  ]
  const ids = (jobs: Job[]) => jobs.map((j) => j.id)

  it('Rekomendasi shows only new jobs', () => {
    expect(ids(filterFeed(feed, { tab: 'recommended', workplace: 'all', query: '', status: 'all' }))).toEqual(['a', 'b'])
  })

  it('Rekomendasi hides jobs scored below 50 and jobs not scored yet', () => {
    const mixed = [job('lo', { score: score(49) }), job('none'), job('ok', { score: score(50) })]
    expect(ids(filterFeed(mixed, { tab: 'recommended', workplace: 'all', query: '', status: 'all' }))).toEqual(['ok'])
  })

  it('Rekomendasi filters by work type', () => {
    expect(ids(filterFeed(feed, { tab: 'recommended', workplace: 'remote', query: '', status: 'all' }))).toEqual(['a'])
    expect(ids(filterFeed(feed, { tab: 'recommended', workplace: 'hybrid', query: '', status: 'all' }))).toEqual(['b'])
  })

  it('searches title, company, location and source, ignoring case', () => {
    expect(ids(filterFeed(feed, { tab: 'recommended', workplace: 'all', query: ' FRONTEND ', status: 'all' }))).toEqual(['a'])
    expect(ids(filterFeed(feed, { tab: 'recommended', workplace: 'all', query: 'studio', status: 'all' }))).toEqual(['b'])
    expect(ids(filterFeed(feed, { tab: 'recommended', workplace: 'all', query: 'ashby', status: 'all' }))).toEqual(['a', 'b'])
  })

  it('Disimpan shows saved and applied, and hidden only when asked', () => {
    expect(ids(filterFeed(feed, { tab: 'saved', workplace: 'all', query: '', status: 'all' }))).toEqual(['c', 'd'])
    expect(ids(filterFeed(feed, { tab: 'saved', workplace: 'all', query: '', status: 'hidden' }))).toEqual(['e'])
    expect(ids(filterFeed(feed, { tab: 'saved', workplace: 'all', query: '', status: 'applied' }))).toEqual(['d'])
  })
})

describe('sortFeed', () => {
  it('puts the highest score first and unscored last', () => {
    const sorted = sortFeed([job('a', { score: score(60) }), job('b'), job('c', { score: score(90) })], 'score')
    expect(sorted.map((j) => j.id)).toEqual(['c', 'a', 'b'])
  })

  it('breaks a tie by the newer posting', () => {
    const sorted = sortFeed([job('old', { score: score(80), postedAt: '2026-10-01' }), job('new', { score: score(80), postedAt: '2026-10-09' })], 'score')
    expect(sorted.map((j) => j.id)).toEqual(['new', 'old'])
  })

  it('sorts by newest, using the first sighting when the posting has no date', () => {
    const sorted = sortFeed([job('a', { postedAt: '2026-10-01' }), job('b', { postedAt: '', firstSeenAt: '2026-10-09T00:00:00.000Z' }), job('c', { postedAt: '2026-10-05' })], 'newest')
    expect(sorted.map((j) => j.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not change the list it was given', () => {
    const list = [job('a', { score: score(1) }), job('b', { score: score(2) })]
    sortFeed(list, 'score')
    expect(list.map((j) => j.id)).toEqual(['a', 'b'])
  })
})

describe('setJobStatus', () => {
  it('changes one job and leaves the rest', () => {
    const next = setJobStatus([job('a'), job('b')], 'b', 'hidden' satisfies JobStatus)
    expect(next.map((j) => j.status)).toEqual(['new', 'hidden'])
  })
})

describe('jobMeta', () => {
  it('lists only what the job has', () => {
    expect(jobMeta(job('a', { postedAt: '2026-10-08' }), NOW)).toEqual([{ label: '', value: 'Diposting 2 hari lalu' }])
  })

  it('shows pay, experience, deadline and the posting age together', () => {
    const meta = jobMeta(job('a', { salary: 'Rp 20-30 jt', experience: '3+ tahun', deadline: '2026-11-12', postedAt: '2026-10-10' }), NOW)
    expect(meta).toEqual([
      { label: 'Gaji', value: 'Rp 20-30 jt' },
      { label: 'Pengalaman', value: '3+ tahun' },
      { label: 'Deadline', value: '12 Nov' },
      { label: '', value: 'Diposting hari ini' },
    ])
  })

  it('is empty when nothing is known', () => {
    expect(jobMeta(job('a', { postedAt: '' }), NOW)).toEqual([])
  })
})

describe('initialsOf', () => {
  it('takes the first letters of the first two words', () => {
    expect(initialsOf('PT Contoh Karya')).toBe('PC')
    expect(initialsOf('   ')).toBe('?')
  })
})

describe('formatUpdated', () => {
  it('says when the feed was updated and how many are new', () => {
    const at = new Date(2026, 9, 10, 8, 5).toISOString()
    expect(formatUpdated(at, 24)).toBe('Diperbarui 08.05 · 24 baru')
    expect(formatUpdated(at, 0)).toBe('Diperbarui 08.05')
    expect(formatUpdated('', 0)).toBe('Belum pernah diperbarui')
  })
})

describe('sourceNotices', () => {
  const run = (source: SourceRun['source'], ok: boolean, reason?: SourceRun['reason'], at = '2026-10-10T08:00:00.000Z'): SourceRun => ({ source, at, ok, count: 0, reason })

  it('names a source that failed in its last run, with the cause', () => {
    expect(sourceNotices([run('linkedin', false, 'blocked'), run('lever', true)], [])).toEqual([
      'LinkedIn tidak bisa diambil hari ini (diblokir sementara). Sumber lain tetap jalan.',
    ])
  })

  it('says a paused source is paused', () => {
    expect(sourceNotices([], ['linkedin'])).toEqual(['LinkedIn dijeda setelah 3 kali gagal berturut-turut. Nyalakan lagi di Atur Lowongan.'])
  })

  it('uses only the latest run of each source', () => {
    expect(sourceNotices([run('lever', false, 'timeout', '2026-10-09T08:00:00.000Z'), run('lever', true, undefined, '2026-10-10T08:00:00.000Z')], [])).toEqual([])
  })

  it('explains http errors', () => {
    expect(sourceNotices([run('ashby', false, 'http-404')], [])[0]).toContain('server membalas 404')
  })
})

describe('describeFeed', () => {
  const base = { hasRoles: true, anySourceOn: true, state: initialFeedState() as FeedState, runs: [] as SourceRun[], recommended: 3, shown: 3 }

  it('asks for preferences first, then for a source', () => {
    expect(describeFeed({ ...base, hasRoles: false })).toBe('no-prefs')
    expect(describeFeed({ ...base, anySourceOn: false })).toBe('not-enabled')
  })

  it('shows a fetching state while a run goes with nothing to show yet', () => {
    expect(describeFeed({ ...base, state: { ...base.state, running: true }, recommended: 0, shown: 0 })).toBe('fetching')
    expect(describeFeed({ ...base, state: { ...base.state, running: true } })).toBe('list')
  })

  it('says all sources failed only when nothing is to show', () => {
    const failed: SourceRun[] = [{ source: 'lever', at: 'x', ok: false, count: 0, reason: 'blocked' }]
    expect(describeFeed({ ...base, runs: failed, recommended: 0, shown: 0 })).toBe('all-failed')
    expect(describeFeed({ ...base, runs: failed })).toBe('list')
  })

  it('tells an empty day from a filter that hides everything', () => {
    expect(describeFeed({ ...base, recommended: 0, shown: 0 })).toBe('empty-today')
    expect(describeFeed({ ...base, recommended: 5, shown: 0 })).toBe('no-match')
    expect(describeFeed(base)).toBe('list')
  })
})

describe('workplace values', () => {
  it('are the same ones the filter uses', () => {
    const all: Workplace[] = ['remote', 'hybrid', 'onsite', 'unknown']
    expect(all).toHaveLength(4)
  })
})
