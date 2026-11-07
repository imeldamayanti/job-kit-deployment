import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmptyJobPreferences, type JobPreferences } from '../../profile/job-preferences'
import { passesRules } from '../rules'
import { runSource } from './run'
import type { FetchContext, FetchLike } from './types'
import { roleSlug, wellfoundSource } from './wellfound'

const PAGE = readFileSync(resolve(__dirname, '../../../../fixtures/jobs/wellfound.html'), 'utf8')
const NOW = new Date('2026-10-10T08:00:00Z')
const prefs = (change: Partial<JobPreferences> = {}): JobPreferences => ({ ...createEmptyJobPreferences(), roles: ['Frontend Engineer'], ...change })
const html = (body: string, status = 200) => new Response(body, { status })

function setup(handler: (url: string) => Response | Promise<Response>) {
  const urls: string[] = []
  const fetch: FetchLike = async (url) => (urls.push(url), handler(url))
  const ctx: FetchContext = { fetch, now: NOW, companies: {}, sleep: async () => {}, timeoutMs: 100 }
  return { ctx, urls }
}

describe('roleSlug', () => {
  it('turns a role into the slug Wellfound uses', () => {
    expect(roleSlug('Frontend Engineer')).toBe('frontend-engineer')
    expect(roleSlug('  Full-Stack  Developer! ')).toBe('full-stack-developer')
    expect(roleSlug('???')).toBe('')
  })
})

describe('wellfoundSource', () => {
  it('reads the remote page and the Indonesia page of each role, two roles at most', async () => {
    const t = setup(() => html(PAGE))
    await wellfoundSource.fetch(prefs({ roles: ['Frontend Engineer', 'Full Stack Engineer', 'Backend Engineer'] }), t.ctx)
    expect(t.urls).toEqual([
      'https://wellfound.com/role/r/frontend-engineer',
      'https://wellfound.com/role/l/frontend-engineer/indonesia',
      'https://wellfound.com/role/r/full-stack-engineer',
      'https://wellfound.com/role/l/full-stack-engineer/indonesia',
    ])
  })

  it('reads the listings with their company, pay and posting date', async () => {
    const t = setup(() => html(PAGE))
    const jobs = await wellfoundSource.fetch(prefs(), t.ctx)
    const first = jobs.find((job) => job.url === 'https://wellfound.com/jobs/4748771-frontend-engineer')
    expect(first).toMatchObject({
      source: 'wellfound', title: 'Frontend Engineer', company: 'Confidential Company', workplace: 'remote', location: 'Remote',
      contract: 'Full-time', salary: '$150k – $190k', experience: '3+ years', postedAt: new Date(1791826780 * 1000).toISOString().slice(0, 10),
    })
    expect(first?.description.length).toBeGreaterThan(0)
  })

  it('reads the countries a remote job accepts as its location', async () => {
    const t = setup(() => html(PAGE))
    const jobs = await wellfoundSource.fetch(prefs(), t.ctx)
    expect(jobs.map((job) => job.location)).toEqual(expect.arrayContaining(['Remote', 'United States']))
    expect(jobs.find((job) => job.location.startsWith('Chile'))?.location).toContain('Costa Rica')
  })

  it('lets the rules drop a remote job that does not accept Indonesia', async () => {
    const t = setup(() => html(PAGE))
    const jobs = await wellfoundSource.fetch(prefs(), t.ctx)
    const mine = prefs({ locations: ['Jakarta', 'Bali'], workModes: ['Remote'] })
    expect(jobs.filter((job) => passesRules(job, mine)).map((job) => job.location)).toEqual(['Remote'])
  })

  it('keeps a job once when both pages list it', async () => {
    const t = setup(() => html(PAGE))
    const jobs = await wellfoundSource.fetch(prefs(), t.ctx)
    expect(jobs).toHaveLength(3)
  })

  it('skips a page that is missing and keeps the others', async () => {
    const t = setup((url) => (url.includes('/role/l/') ? html('', 404) : html(PAGE)))
    expect(await wellfoundSource.fetch(prefs(), t.ctx)).toHaveLength(3)
  })

  it('does nothing when no role makes a slug', async () => {
    const t = setup(() => html(PAGE))
    expect(await wellfoundSource.fetch(prefs({ roles: [] }), t.ctx)).toEqual([])
    expect(t.urls).toHaveLength(0)
  })

  it('reports blocked when it is refused, and parse when the page has no data', async () => {
    const blocked = setup(() => html('', 403))
    expect((await runSource(wellfoundSource, prefs(), blocked.ctx)).run).toMatchObject({ ok: false, reason: 'blocked' })
    const changed = setup(() => html('<html><body>Please verify you are human</body></html>'))
    expect((await runSource(wellfoundSource, prefs(), changed.ctx)).run).toMatchObject({ ok: false, reason: 'parse' })
  })
})
