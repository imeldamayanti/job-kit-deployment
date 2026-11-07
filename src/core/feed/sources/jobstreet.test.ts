import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmptyJobPreferences, type JobPreferences } from '../../profile/job-preferences'
import { passesRules } from '../rules'
import { JOBSTREET_SITES, jobStreetSites, jobStreetSource, jobStreetUrl, parseJobStreet } from './jobstreet'
import { runSource } from './run'
import type { FetchContext, FetchLike } from './types'

const fixture = (name: string) => readFileSync(resolve(__dirname, `../../../../fixtures/jobs/${name}`), 'utf8')
const ID_BODY = fixture('jobstreet-id.json')
const SG_BODY = fixture('jobstreet-sg.json')
const prefs = (change: Partial<JobPreferences> = {}): JobPreferences => ({ ...createEmptyJobPreferences(), roles: ['Software Engineer'], ...change })

function setup(handler: (url: string) => Response) {
  const urls: string[] = []
  const fetch: FetchLike = async (url) => (urls.push(url), handler(url))
  const ctx: FetchContext = { fetch, now: new Date('2026-11-04T08:00:00Z'), companies: {}, sleep: async () => {}, timeoutMs: 100 }
  return { ctx, urls }
}

describe('parseJobStreet', () => {
  it('maps a search result to a job with its own page, country on the location', () => {
    const [job] = parseJobStreet(JSON.parse(ID_BODY), JOBSTREET_SITES.id)
    expect(job).toMatchObject({
      source: 'jobstreet',
      title: 'Software Engineer',
      company: 'PetroSYNC',
      location: 'West Jakarta, Jakarta, Indonesia',
      workplace: 'onsite',
      contract: 'Full-time',
      salary: 'Rp 5.800.000 – Rp 7.000.000 per month',
      postedAt: '2026-10-08',
      url: 'https://id.jobstreet.com/job/95140055',
    })
    expect(job?.description).toContain('Maintenance website perusahaan.')
  })

  it('reads remote and contract work, and does not repeat a country already named', () => {
    const sg = parseJobStreet(JSON.parse(SG_BODY), JOBSTREET_SITES.sg)
    expect(sg[0]).toMatchObject({ location: 'West Region, Singapore', workplace: 'remote' })
    expect(sg[1]?.location).toBe('Singapore')
    const id = parseJobStreet(JSON.parse(ID_BODY), JOBSTREET_SITES.id)
    expect(id[3]?.contract).toBe('Contract')
  })

  it('skips results without an id or title, and fails on a body that is not a search', () => {
    expect(parseJobStreet({ data: [{ id: '1' }, { title: 'X' }] }, JOBSTREET_SITES.id)).toEqual([])
    expect(() => parseJobStreet({ error: 'nope' }, JOBSTREET_SITES.id)).toThrow()
  })
})

describe('jobStreetSites', () => {
  it('searches Indonesia, and Singapore only when it is a wanted place', () => {
    expect(jobStreetSites(['Jakarta'])).toEqual([JOBSTREET_SITES.id])
    expect(jobStreetSites(['Jakarta', 'Singapore'])).toEqual([JOBSTREET_SITES.id, JOBSTREET_SITES.sg])
    expect(jobStreetSites(['Singapura'])).toHaveLength(2)
  })
})

describe('jobStreetSource', () => {
  it('searches the last two weeks per role and country, without repeating a job', async () => {
    const { ctx, urls } = setup((url) => new Response(url.includes('sg.jobstreet') ? SG_BODY : ID_BODY))
    const jobs = await jobStreetSource.fetch(prefs({ roles: ['Software Engineer', 'Backend Engineer'], locations: ['Jakarta', 'Singapore'] }), ctx)
    expect(urls).toEqual([
      jobStreetUrl(JOBSTREET_SITES.id, 'Software Engineer'),
      jobStreetUrl(JOBSTREET_SITES.id, 'Backend Engineer'),
      jobStreetUrl(JOBSTREET_SITES.sg, 'Software Engineer'),
      jobStreetUrl(JOBSTREET_SITES.sg, 'Backend Engineer'),
    ])
    expect(urls[0]).toContain('sortmode=KeywordRelevance&daterange=14')
    expect(new Set(jobs.map((job) => job.url)).size).toBe(jobs.length)
    expect(jobs).toHaveLength(8)
  })

  it('keeps Jakarta jobs for a Jakarta search and drops Singapore on-site jobs for it', async () => {
    const { ctx } = setup((url) => new Response(url.includes('sg.jobstreet') ? SG_BODY : ID_BODY))
    const want = prefs({ locations: ['Jakarta'] })
    const jakarta = await jobStreetSource.fetch(want, ctx)
    expect(jakarta.filter((job) => passesRules(job, want)).map((job) => job.location)).toContain('West Jakarta, Jakarta, Indonesia')
    const sg = parseJobStreet(JSON.parse(SG_BODY), JOBSTREET_SITES.sg).filter((job) => job.workplace === 'onsite')
    expect(sg.filter((job) => passesRules(job, want))).toEqual([])
  })

  it('records a refusal as blocked', async () => {
    const { ctx } = setup(() => new Response('', { status: 403 }))
    const outcome = await runSource(jobStreetSource, prefs(), ctx)
    expect(outcome.run).toMatchObject({ ok: false, reason: 'blocked' })
  })
})
