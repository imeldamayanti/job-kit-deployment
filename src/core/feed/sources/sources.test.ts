import { describe, expect, it } from 'vitest'
import ashbyFixture from '../../../../fixtures/jobs/ashby.json'
import greenhouseFixture from '../../../../fixtures/jobs/greenhouse.json'
import leverFixture from '../../../../fixtures/jobs/lever.json'
import remotiveFixture from '../../../../fixtures/jobs/remotive.json'
import { createEmptyJobPreferences } from '../../profile/job-preferences'
import { ashbySource } from './ashby'
import { greenhouseSource } from './greenhouse'
import { fetchJson } from './http'
import { leverSource } from './lever'
import { remotiveSource } from './remotive'
import { runSource } from './run'
import type { FetchContext, FetchLike } from './types'

const NOW = new Date('2026-10-10T08:00:00Z')
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function ctx(fetch: FetchLike, companies: FetchContext['companies'] = {}): FetchContext {
  return { fetch, now: NOW, companies, sleep: async () => {}, timeoutMs: 50 }
}
const prefs = createEmptyJobPreferences()

describe('fetchJson', () => {
  it('returns the parsed body', async () => {
    expect(await fetchJson(ctx(async () => json({ a: 1 })), 'https://x.test')).toEqual({ a: 1 })
  })

  it('maps 429 and 403 to blocked, other statuses to http-xxx', async () => {
    await expect(fetchJson(ctx(async () => json({}, 429)), 'https://x.test')).rejects.toMatchObject({ reason: 'blocked' })
    await expect(fetchJson(ctx(async () => json({}, 403)), 'https://x.test')).rejects.toMatchObject({ reason: 'blocked' })
    await expect(fetchJson(ctx(async () => json({}, 404)), 'https://x.test')).rejects.toMatchObject({ reason: 'http-404' })
  })

  it('maps a body that is not JSON to parse', async () => {
    await expect(fetchJson(ctx(async () => new Response('<html>')), 'https://x.test')).rejects.toMatchObject({ reason: 'parse' })
  })

  it('maps a network failure to network', async () => {
    await expect(fetchJson(ctx(async () => { throw new TypeError('Failed to fetch') }), 'https://x.test')).rejects.toMatchObject({ reason: 'network' })
  })

  it('maps a request that never answers to timeout', async () => {
    const hang: FetchLike = (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))
    await expect(fetchJson(ctx(hang), 'https://x.test')).rejects.toMatchObject({ reason: 'timeout' })
  })

  it('tries once more after a server error and then succeeds', async () => {
    let calls = 0
    const flaky: FetchLike = async () => (++calls === 1 ? json({}, 503) : json({ ok: true }))
    expect(await fetchJson(ctx(flaky), 'https://x.test')).toEqual({ ok: true })
    expect(calls).toBe(2)
  })

  it('does not retry a blocked request', async () => {
    let calls = 0
    await fetchJson(ctx(async () => (++calls, json({}, 429))), 'https://x.test').catch(() => {})
    expect(calls).toBe(1)
  })

  it('sends no cookies', async () => {
    let seen: RequestInit | undefined
    await fetchJson(ctx(async (_u, init) => ((seen = init), json({}))), 'https://x.test')
    expect(seen?.credentials).toBe('omit')
  })
})

describe('greenhouseSource', () => {
  it('reads the board of every company and maps the jobs', async () => {
    const urls: string[] = []
    const fake: FetchLike = async (url) => (urls.push(url), json(greenhouseFixture))
    const jobs = await greenhouseSource.fetch(prefs, ctx(fake, { greenhouse: ['stripe'] }))
    expect(urls).toEqual(['https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true'])
    expect(jobs).toHaveLength(3)
    expect(jobs[0]).toMatchObject({
      source: 'greenhouse', title: 'Abuse Investigator', company: 'Stripe', location: 'Seattle, San Francisco, New York City',
      workplace: 'unknown', url: 'https://stripe.com/jobs/search?gh_jid=8172510', postedAt: '2026-09-09',
    })
    expect(jobs[2]?.workplace).toBe('remote')
    expect(jobs[0]?.description).not.toContain('<')
    expect(jobs[0]?.description.length).toBeGreaterThan(50)
  })
})

describe('leverSource', () => {
  it('maps work type, commitment, location and date', async () => {
    const urls: string[] = []
    const fake: FetchLike = async (url) => (urls.push(url), json(leverFixture))
    const jobs = await leverSource.fetch(prefs, ctx(fake, { lever: ['spotify'] }))
    expect(urls[0]).toBe('https://api.lever.co/v0/postings/spotify?mode=json&limit=100')
    expect(jobs[0]).toMatchObject({
      source: 'lever', title: 'Android Engineer - Experience', company: 'spotify', location: 'London, Stockholm',
      workplace: 'hybrid', contract: 'Permanent', url: 'https://jobs.lever.co/spotify/2193db3f-77c5-43b8-b030-8f92c9882bf1',
    })
    expect(jobs[0]?.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(jobs[2]?.workplace).toBe('onsite')
  })
})

describe('ashbySource', () => {
  it('maps work type, employment type and pay summary', async () => {
    const jobs = await ashbySource.fetch(prefs, ctx(async () => json(ashbyFixture), { ashby: ['ashby'] }))
    expect(jobs[0]).toMatchObject({
      source: 'ashby', title: 'Engineering Manager - EU', company: 'ashby', workplace: 'remote', contract: 'Full-time',
      location: 'Remote - European Union', postedAt: '2024-03-04',
    })
    expect(jobs[0]?.salary).toContain('€110K')
    expect(jobs[0]?.url).toContain('jobs.ashbyhq.com')
  })

  it('skips a job that is not listed', async () => {
    const hidden = { ...ashbyFixture, jobs: ashbyFixture.jobs.map((job, i) => ({ ...job, isListed: i !== 0 })) }
    const jobs = await ashbySource.fetch(prefs, ctx(async () => json(hidden), { ashby: ['ashby'] }))
    expect(jobs).toHaveLength(3)
  })
})

describe('remotiveSource', () => {
  it('searches once per wanted role and marks every job remote', async () => {
    const urls: string[] = []
    const fake: FetchLike = async (url) => (urls.push(url), json(remotiveFixture))
    const jobs = await remotiveSource.fetch({ ...prefs, roles: ['Frontend Engineer', 'UI Engineer'] }, ctx(fake))
    expect(urls).toEqual([
      'https://remotive.com/api/remote-jobs?search=Frontend%20Engineer',
      'https://remotive.com/api/remote-jobs?search=UI%20Engineer',
    ])
    expect(jobs[0]).toMatchObject({ source: 'remotive', workplace: 'remote', contract: 'Full-time', company: 'Unio Digital', location: 'Worldwide' })
    expect(jobs[1]?.salary).toBe('$45-$120/Hour')
  })

  it('makes one general request when no role is set', async () => {
    const urls: string[] = []
    await remotiveSource.fetch(prefs, ctx(async (url) => (urls.push(url), json(remotiveFixture))))
    expect(urls).toEqual(['https://remotive.com/api/remote-jobs?category=software-dev'])
  })
})

describe('runSource', () => {
  it('turns a fetch into a run with the count', async () => {
    const out = await runSource(greenhouseSource, prefs, ctx(async () => json(greenhouseFixture), { greenhouse: ['stripe'] }))
    expect(out.run).toEqual({ source: 'greenhouse', at: NOW.toISOString(), ok: true, count: 3 })
    expect(out.jobs).toHaveLength(3)
  })

  it('records the reason instead of throwing', async () => {
    const out = await runSource(greenhouseSource, prefs, ctx(async () => json({}, 429), { greenhouse: ['stripe'] }))
    expect(out.run).toEqual({ source: 'greenhouse', at: NOW.toISOString(), ok: false, count: 0, reason: 'blocked' })
    expect(out.jobs).toEqual([])
  })

  it('succeeds when one company fails and another works', async () => {
    const fake: FetchLike = async (url) => (url.includes('/boards/bad/') ? json({}, 404) : json(greenhouseFixture))
    const out = await runSource(greenhouseSource, prefs, ctx(fake, { greenhouse: ['bad', 'stripe'] }))
    expect(out.run.ok).toBe(true)
    expect(out.run.count).toBe(3)
  })

  it('reads a board in an unexpected shape as parse', async () => {
    const out = await runSource(ashbySource, prefs, ctx(async () => json({ nothing: true }), { ashby: ['ashby'] }))
    expect(out.run).toMatchObject({ ok: false, reason: 'parse' })
  })

  it('treats a source with no companies as an empty successful run', async () => {
    const out = await runSource(leverSource, prefs, ctx(async () => json([])))
    expect(out.run).toMatchObject({ ok: true, count: 0 })
  })
})
