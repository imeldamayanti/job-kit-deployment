import { describe, expect, it } from 'vitest'
import { importIntoFeed, importMessage } from './import'
import { mergeFeed } from './merge'
import type { RawJob } from './types'

const NOW = '2026-11-06T08:00:00.000Z'

const entry = (change: Record<string, unknown> = {}) => ({
  title: 'Backend Developer',
  company: 'PT Contoh Bank',
  url: 'https://karir.example.test/jobs/1',
  ...change,
})

const run = (data: unknown, existing: Parameters<typeof importIntoFeed>[0] = []) => importIntoFeed(existing, JSON.stringify(data), NOW)

describe('importIntoFeed', () => {
  it('adds each valid entry as a new, unread job marked as imported, so it shows on Rekomendasi', () => {
    const result = run([entry(), entry({ title: 'Data Engineer', url: 'https://karir.example.test/jobs/2' })])
    expect(result).toMatchObject({ ok: true, added: 2, updated: 0, skipped: 0 })
    if (!result.ok) return
    expect(result.feed.map((job) => [job.status, job.imported])).toEqual([['new', true], ['new', true]])
    expect(result.feed[0]).toMatchObject({ title: 'Backend Developer', company: 'PT Contoh Bank', score: null, firstSeenAt: NOW })
  })

  it('also reads a { jobs: [...] } wrapper', () => {
    expect(run({ jobs: [entry()] })).toMatchObject({ ok: true, added: 1 })
  })

  it('fills the fields an entry leaves out with empty values', () => {
    const result = run([entry()])
    if (!result.ok) throw new Error('expected ok')
    expect(result.feed[0]).toMatchObject({ location: '', workplace: 'unknown', contract: '', salary: '', description: '', source: 'jobstreet' })
  })

  it('keeps a known source and workplace, and drops an unknown one', () => {
    const result = run([entry({ source: 'linkedin', workplace: 'hybrid' }), entry({ title: 'QA Engineer', url: 'https://x.test/2', source: 'nope', workplace: 'anywhere' })])
    if (!result.ok) throw new Error('expected ok')
    expect(result.feed.map((job) => [job.source, job.workplace])).toEqual([['linkedin', 'hybrid'], ['jobstreet', 'unknown']])
  })

  it('skips an entry with no title, no company or a url that is not http(s), and counts it', () => {
    const result = run([entry(), entry({ title: '' }), entry({ company: ' ' }), entry({ url: 'javascript:alert(1)' }), 'text', null])
    expect(result).toMatchObject({ ok: true, added: 1, skipped: 5 })
  })

  it('cuts a very long description to the feed limit', () => {
    const result = run([entry({ description: 'a'.repeat(9000) })])
    if (!result.ok) throw new Error('expected ok')
    // truncateText ends a cut text with one ellipsis character, like every other source.
    expect(result.feed[0]?.description.length).toBeLessThanOrEqual(4001)
  })

  it('refreshes a job already in the feed and keeps its status', () => {
    const base = { ...(entry() as unknown as RawJob), source: 'jobstreet' as const, location: '', workplace: 'unknown' as const, contract: '', level: '', salary: '', experience: '', postedAt: '', deadline: '', description: '', logoUrl: '' }
    const [existing] = mergeFeed([], [base], '2026-10-01T00:00:00.000Z')
    const applied = { ...existing!, status: 'applied' as const }
    const result = run([entry({ location: 'Jakarta' })], [applied])
    expect(result).toMatchObject({ ok: true, added: 0, updated: 1 })
    if (!result.ok) return
    expect(result.feed).toHaveLength(1)
    expect(result.feed[0]).toMatchObject({ status: 'applied', location: 'Jakarta', firstSeenAt: '2026-10-01T00:00:00.000Z', lastSeenAt: NOW })
  })

  it('does not duplicate jobs when the same file is imported twice', () => {
    const first = run([entry()])
    if (!first.ok) throw new Error('expected ok')
    const second = run([entry()], first.feed)
    expect(second).toMatchObject({ ok: true, added: 0, updated: 1 })
    if (second.ok) expect(second.feed).toHaveLength(1)
  })

  it('leaves the other jobs in the feed untouched', () => {
    const first = run([entry()])
    if (!first.ok) throw new Error('expected ok')
    const second = run([entry({ title: 'QA Engineer', url: 'https://karir.example.test/jobs/9' })], first.feed)
    if (!second.ok) throw new Error('expected ok')
    expect(second.feed).toHaveLength(2)
    expect(second.feed[0]).toEqual(first.feed[0])
  })

  it('refuses text that is not JSON', () => {
    expect(importIntoFeed([], 'bukan json', NOW)).toEqual({ ok: false, reason: 'invalid-json' })
  })

  it('refuses a file with no usable job', () => {
    expect(run([])).toEqual({ ok: false, reason: 'no-jobs' })
    expect(run({ foo: 1 })).toEqual({ ok: false, reason: 'no-jobs' })
    expect(run([entry({ title: '' })])).toEqual({ ok: false, reason: 'no-jobs' })
  })
})

describe('importMessage', () => {
  it('says what was added, refreshed and skipped', () => {
    expect(importMessage({ ok: true, feed: [], added: 3, updated: 1, skipped: 2 })).toBe('3 lowongan ditambahkan ke Rekomendasi, 1 diperbarui, 2 dilewati karena datanya tidak lengkap.')
    expect(importMessage({ ok: true, feed: [], added: 1, updated: 0, skipped: 0 })).toBe('1 lowongan ditambahkan ke Rekomendasi.')
  })

  it('explains each failure', () => {
    expect(importMessage({ ok: false, reason: 'invalid-json' })).toBe('Berkas bukan JSON yang valid.')
    expect(importMessage({ ok: false, reason: 'no-jobs' })).toBe('Tidak ada lowongan yang bisa diimpor. Tiap lowongan butuh title, company, dan url (http atau https).')
  })
})
