import { describe, expect, it } from 'vitest'
import { createEmptyJobPreferences, type JobPreferences } from '../../profile/job-preferences'
import { shouldPause } from './health'
import { buildSearchUrl, createLinkedInSource } from './linkedin'
import { isLoginWall, looksLikeResults, parseDetailPage, parseSearchPage } from './linkedin-parse'
import { runSource } from './run'
import type { FetchContext, FetchLike } from './types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (name: string) => readFileSync(resolve(__dirname, '../../../../fixtures/jobs', name), 'utf8')
const SEARCH = read('linkedin-search.html')
const DETAIL = read('linkedin-detail.html')
const BROKEN = read('linkedin-broken.html')
const NOW = new Date('2026-10-10T08:00:00Z')
const prefs = (change: Partial<JobPreferences> = {}): JobPreferences => ({ ...createEmptyJobPreferences(), roles: ['frontend engineer'], ...change })

function setup(handler: (url: string, n: number) => Response | Promise<Response>, options: { maxPages?: number; maxDetails?: number } = {}) {
  const urls: string[] = []
  const inits: (RequestInit | undefined)[] = []
  let pauses = 0
  const fetch: FetchLike = async (url, init) => (urls.push(url), inits.push(init), handler(url, urls.length))
  const ctx: FetchContext = { fetch, now: NOW, companies: {}, sleep: async () => {}, timeoutMs: 100 }
  const source = createLinkedInSource({ parseSearch: parseSearchPage, parseDetail: parseDetailPage, pause: async () => void (pauses += 1), ...options })
  return { ctx, source, urls, inits, pauses: () => pauses }
}
const html = (body: string, status = 200) => new Response(body, { status })

describe('parseSearchPage', () => {
  it('reads every card of a saved results page', () => {
    const jobs = parseSearchPage(SEARCH)
    expect(jobs).toHaveLength(3)
    expect(jobs[0]).toMatchObject({ source: 'linkedin', title: 'Senior Front End Engineer', company: 'Catalyst', location: 'Jakarta, Indonesia', postedAt: '2026-09-18' })
    expect(jobs[0]?.url).toContain('linkedin.com/jobs/view/')
    expect(jobs[0]?.logoUrl).toContain('licdn.com')
  })

  it('finds nothing in a changed layout instead of failing', () => {
    expect(parseSearchPage(BROKEN)).toEqual([])
    expect(looksLikeResults(BROKEN)).toBe(false)
    expect(looksLikeResults(SEARCH)).toBe(true)
  })

  it('recognises a login wall', () => {
    expect(isLoginWall('<html><body class="authwall">')).toBe(true)
    expect(isLoginWall(SEARCH)).toBe(false)
  })
})

describe('parseDetailPage', () => {
  it('reads the description, level and employment type', () => {
    const detail = parseDetailPage(DETAIL)
    expect(detail.level).toBe('Mid-Senior level')
    expect(detail.contract).toBe('Full-time')
    expect(detail.description).toContain('Front End Engineer')
    expect(detail.description).not.toContain('<')
  })

  it('returns empty parts for a page it does not understand', () => {
    expect(parseDetailPage(BROKEN)).toEqual({ description: '', level: '', contract: '' })
  })
})

describe('buildSearchUrl', () => {
  it('builds the query from role, first location and page offset', () => {
    expect(buildSearchUrl(prefs({ locations: ['Jakarta', 'Bandung'] }), 'frontend engineer', 20)).toBe(
      'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=frontend+engineer&location=Jakarta&start=20',
    )
  })

  it('asks for the work types the user picked, and for all when none or all are picked', () => {
    expect(buildSearchUrl(prefs({ workModes: ['Remote'] }), 'x', 0)).toContain('f_WT=2')
    expect(buildSearchUrl(prefs({ workModes: ['Remote', 'Hybrid'] }), 'x', 0)).toContain('f_WT=2%2C3')
    expect(buildSearchUrl(prefs({ workModes: [] }), 'x', 0)).not.toContain('f_WT')
    expect(buildSearchUrl(prefs({ workModes: ['Remote', 'Hybrid', 'On-site'] }), 'x', 0)).not.toContain('f_WT')
  })

  it('falls back to Worldwide without a location', () => {
    expect(buildSearchUrl(prefs(), 'x', 0)).toContain('location=Worldwide')
  })
})

describe('LinkedIn source', () => {
  it('reads at most the page limit, pauses between requests and sends no cookies', async () => {
    const t = setup(() => html(SEARCH), { maxPages: 3, maxDetails: 0 })
    const jobs = await t.source.fetch(prefs(), t.ctx)
    expect(t.urls).toHaveLength(3)
    expect(t.urls.map((u) => new URL(u).searchParams.get('start'))).toEqual(['0', '10', '20'])
    expect(t.pauses()).toBe(2)
    expect(t.inits.every((init) => init?.credentials === 'omit')).toBe(true)
    expect(jobs).toHaveLength(9)
  })

  it('stops when a page has no more results', async () => {
    const t = setup((_u, n) => html(n === 1 ? SEARCH : '<ul></ul>'), { maxPages: 5, maxDetails: 0 })
    await t.source.fetch(prefs(), t.ctx)
    expect(t.urls).toHaveLength(2)
  })

  it('fetches the detail page only for jobs that pass the rules, and fills the description', async () => {
    const t = setup((url) => html(url.includes('/jobPosting/') ? DETAIL : SEARCH), { maxPages: 1 })
    const jobs = await t.source.fetch(prefs({ avoid: ['Senior Front End'] }), t.ctx)
    const details = t.urls.filter((u) => u.includes('/jobPosting/'))
    expect(details).toHaveLength(2)
    expect(jobs.filter((j) => j.description !== '')).toHaveLength(2)
    expect(jobs.find((j) => j.title === 'Senior Front End Engineer')?.description).toBe('')
  })

  it('keeps a job when its detail page fails', async () => {
    const t = setup((url) => (url.includes('/jobPosting/') ? html('', 500) : html(SEARCH)), { maxPages: 1 })
    const jobs = await t.source.fetch(prefs(), t.ctx)
    expect(jobs).toHaveLength(3)
  })

  it('reports blocked when the first page is refused', async () => {
    const t = setup(() => html('', 429))
    const out = await runSource(t.source, prefs(), t.ctx)
    expect(out.run).toMatchObject({ ok: false, reason: 'blocked' })
  })

  it('keeps what it has when it is blocked halfway', async () => {
    const t = setup((_u, n) => (n === 1 ? html(SEARCH) : html('', 429)), { maxPages: 3, maxDetails: 0 })
    const out = await runSource(t.source, prefs(), t.ctx)
    expect(out.run).toMatchObject({ ok: true, count: 3 })
  })

  it('reports blocked on a login wall', async () => {
    const t = setup(() => html('<html><body class="authwall">sign in</body></html>'))
    const out = await runSource(t.source, prefs(), t.ctx)
    expect(out.run).toMatchObject({ ok: false, reason: 'blocked' })
  })

  it('reports parse, not an error, when the layout changed', async () => {
    const t = setup(() => html(`${BROKEN}<!-- ${'x'.repeat(300)} -->`))
    const out = await runSource(t.source, prefs(), t.ctx)
    expect(out.run).toEqual({ source: 'linkedin', at: NOW.toISOString(), ok: false, count: 0, reason: 'parse' })
  })

  it('does nothing without a role', async () => {
    const t = setup(() => html(SEARCH))
    expect(await t.source.fetch(prefs({ roles: [] }), t.ctx)).toEqual([])
    expect(t.urls).toHaveLength(0)
  })
})

describe('shouldPause', () => {
  const run = (at: string, ok: boolean) => ({ source: 'linkedin' as const, at, ok, count: 0 })

  it('pauses a source after three failed runs in a row', () => {
    expect(shouldPause([run('2026-10-08', false), run('2026-10-09', false), run('2026-10-10', false)], 'linkedin')).toBe(true)
  })

  it('does not pause when any of the last three worked', () => {
    expect(shouldPause([run('2026-10-08', false), run('2026-10-09', true), run('2026-10-10', false)], 'linkedin')).toBe(false)
  })

  it('does not pause with fewer than three runs, or for another source', () => {
    expect(shouldPause([run('2026-10-09', false), run('2026-10-10', false)], 'linkedin')).toBe(false)
    expect(shouldPause([run('2026-10-08', false), run('2026-10-09', false), run('2026-10-10', false)], 'lever')).toBe(false)
  })
})
