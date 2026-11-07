import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmptyJobPreferences, type JobPreferences } from '../../profile/job-preferences'
import { passesRules } from '../rules'
import { runSource } from './run'
import type { FetchContext, FetchLike } from './types'
import { relativeDate, ycRoleSlugs, ycSource } from './yc'

const PAGE = readFileSync(resolve(__dirname, '../../../../fixtures/jobs/yc-jobs.html'), 'utf8')
const NOW = new Date('2026-10-10T08:00:00Z')
const prefs = (change: Partial<JobPreferences> = {}): JobPreferences => ({ ...createEmptyJobPreferences(), roles: ['Frontend Engineer'], ...change })
const html = (body: string, status = 200) => new Response(body, { status })

function setup(handler: (url: string) => Response | Promise<Response>) {
  const urls: string[] = []
  const fetch: FetchLike = async (url) => (urls.push(url), handler(url))
  const ctx: FetchContext = { fetch, now: NOW, companies: {}, sleep: async () => {}, timeoutMs: 100 }
  return { ctx, urls }
}

describe('ycRoleSlugs', () => {
  it('maps the wanted roles to Y Combinator role pages, once each', () => {
    expect(ycRoleSlugs(['Frontend Engineer', 'Backend Developer'])).toEqual(['software-engineer'])
    expect(ycRoleSlugs(['Product Manager', 'UX Designer', 'Frontend Engineer'])).toEqual(['product-manager', 'designer', 'software-engineer'])
  })

  it('asks for engineering without roles, and for nothing when no role maps', () => {
    expect(ycRoleSlugs([])).toEqual(['software-engineer'])
    expect(ycRoleSlugs(['Barista'])).toEqual([])
  })

  it('asks for at most three pages', () => {
    expect(ycRoleSlugs(['Designer', 'Product Manager', 'Recruiter', 'Sales Lead', 'Engineer'])).toHaveLength(3)
  })
})

describe('relativeDate', () => {
  it('turns "22 days" and the like into a date counted back from now', () => {
    expect(relativeDate('about 22 hours', NOW)).toBe('2026-10-09')
    expect(relativeDate('22 days', NOW)).toBe('2026-09-18')
    expect(relativeDate('8 months', NOW)).toBe('2026-02-10')
    expect(relativeDate('over 2 years', NOW)).toBe('2024-10-10')
    expect(relativeDate('about 1 month', NOW)).toBe('2026-09-10')
  })

  it('gives nothing for text it does not understand', () => {
    expect(relativeDate('', NOW)).toBe('')
    expect(relativeDate('someday', NOW)).toBe('')
  })
})

describe('ycSource', () => {
  it('reads the remote page of each mapped role', async () => {
    const t = setup(() => html(PAGE))
    await ycSource.fetch(prefs({ roles: ['Frontend Engineer', 'Product Manager'] }), t.ctx)
    expect(t.urls).toEqual([
      'https://www.ycombinator.com/jobs/role/software-engineer/remote',
      'https://www.ycombinator.com/jobs/role/product-manager/remote',
    ])
  })

  it('reads the postings, and leaves out those that need a US citizen or visa', async () => {
    const t = setup(() => html(PAGE))
    const jobs = await ycSource.fetch(prefs(), t.ctx)
    expect(jobs).toHaveLength(2)
    expect(jobs[0]).toMatchObject({
      source: 'yc', title: 'Cybersecurity Engineer (Cloud & IT) - Remote', company: 'erad', location: 'Remote', workplace: 'remote',
      contract: 'Full-time', salary: '$2.5K / monthly', experience: '3+ years', postedAt: '2026-10-09',
      url: 'https://www.ycombinator.com/companies/erad/jobs/mcNDG9p-cybersecurity-engineer-cloud-it-remote',
    })
    expect(jobs[0]?.description).toContain('Information Security')
    expect(jobs[1]?.postedAt).toBe('2026-09-18')
  })

  it('reads every posting as remote, so a region limit is judged by the rules', async () => {
    const t = setup(() => html(PAGE.replaceAll('US citizen/visa only', 'Will sponsor')))
    const all = await ycSource.fetch(prefs(), t.ctx)
    expect(all.every((job) => job.workplace === 'remote')).toBe(true)
    const mine = prefs({ locations: ['Jakarta', 'Bali'], workModes: ['Remote'] })
    const kept = all.filter((job) => passesRules(job, mine))
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThan(all.length)
    expect(kept.every((job) => job.location === 'Remote')).toBe(true)
  })

  it('reads one page for the same role asked twice', async () => {
    const t = setup(() => html(PAGE))
    const jobs = await ycSource.fetch(prefs({ roles: ['Frontend Engineer', 'Backend Developer'] }), t.ctx)
    expect(t.urls).toHaveLength(1)
    expect(jobs).toHaveLength(2)
  })

  it('does nothing when no wanted role maps to a page', async () => {
    const t = setup(() => html(PAGE))
    expect(await ycSource.fetch(prefs({ roles: ['Barista'] }), t.ctx)).toEqual([])
    expect(t.urls).toHaveLength(0)
  })

  it('keeps the pages that worked when another fails', async () => {
    const t = setup((url) => (url.includes('product-manager') ? html('', 500) : html(PAGE)))
    const jobs = await ycSource.fetch(prefs({ roles: ['Frontend Engineer', 'Product Manager'] }), t.ctx)
    expect(jobs).toHaveLength(2)
  })

  it('reports blocked when it is refused, and parse when the page has no data', async () => {
    const blocked = setup(() => html('', 403))
    expect((await runSource(ycSource, prefs(), blocked.ctx)).run).toMatchObject({ ok: false, reason: 'blocked' })
    const changed = setup(() => html('<html><body>nothing here</body></html>'))
    expect((await runSource(ycSource, prefs(), changed.ctx)).run).toMatchObject({ ok: false, reason: 'parse' })
  })

  it('sends no cookies', async () => {
    const inits: (RequestInit | undefined)[] = []
    const fetch: FetchLike = async (_url, init) => (inits.push(init), html(PAGE))
    await ycSource.fetch(prefs(), { fetch, now: NOW, companies: {}, sleep: async () => {} })
    expect(inits.every((init) => init?.credentials === 'omit')).toBe(true)
  })
})
