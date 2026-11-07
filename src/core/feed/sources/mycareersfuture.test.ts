import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmptyJobPreferences, type JobPreferences } from '../../profile/job-preferences'
import { passesRules } from '../rules'
import { mcfSource, mcfUrl, parseMcf } from './mycareersfuture'
import { runSource } from './run'
import type { FetchContext, FetchLike } from './types'

const BODY = readFileSync(resolve(__dirname, '../../../../fixtures/jobs/mycareersfuture.json'), 'utf8')
const prefs = (change: Partial<JobPreferences> = {}): JobPreferences => ({ ...createEmptyJobPreferences(), roles: ['Software Engineer'], ...change })

function setup(handler: (url: string) => Response) {
  const urls: string[] = []
  const fetch: FetchLike = async (url) => (urls.push(url), handler(url))
  const ctx: FetchContext = { fetch, now: new Date('2026-11-04T08:00:00Z'), companies: {}, sleep: async () => {}, timeoutMs: 100 }
  return { ctx, urls }
}

describe('parseMcf', () => {
  it('maps a job with pay, level, experience, posting and closing dates', () => {
    const [job] = parseMcf(JSON.parse(BODY))
    expect(job).toMatchObject({
      source: 'mycareersfuture',
      title: 'Senior Software Engineer',
      company: 'CODEX SOLUTIONS PTE. LTD.',
      location: 'Singapore',
      workplace: 'onsite',
      contract: 'Full-time',
      level: 'Senior Executive',
      salary: 'S$6,000 – S$7,500 per month',
      experience: '4+ years',
      postedAt: '2026-10-07',
      deadline: '2026-11-06',
    })
    expect(job?.url).toMatch(/^https:\/\/www\.mycareersfuture\.gov\.sg\/job\//)
    expect(job?.description).not.toContain('<p>')
  })

  it('hides pay the employer hid, and reads contract work', () => {
    const body = JSON.parse(BODY)
    body.results[0].metadata.isHideSalary = true
    expect(parseMcf(body)[0]?.salary).toBe('')
    expect(parseMcf(JSON.parse(BODY))[1]?.contract).toBe('Contract')
  })

  it('fails on a body that is not a job list', () => {
    expect(() => parseMcf({ message: 'nope' })).toThrow()
  })
})

describe('mcfSource', () => {
  it('searches newest first, once per role', async () => {
    const { ctx, urls } = setup(() => new Response(BODY))
    const jobs = await mcfSource.fetch(prefs({ roles: ['Software Engineer', 'Frontend Engineer'] }), ctx)
    expect(urls).toEqual([mcfUrl('Software Engineer'), mcfUrl('Frontend Engineer')])
    expect(urls[0]).toContain('sortBy=new_posting_date')
    expect(jobs).toHaveLength(4)
  })

  it('keeps Singapore jobs only for someone who wants Singapore', () => {
    const jobs = parseMcf(JSON.parse(BODY))
    expect(jobs.filter((job) => passesRules(job, prefs({ locations: ['Jakarta'] })))).toEqual([])
    expect(jobs.filter((job) => passesRules(job, prefs({ locations: ['Jakarta', 'Singapore'] })))).toHaveLength(4)
  })

  it('records a refusal as blocked', async () => {
    const { ctx } = setup(() => new Response('', { status: 429 }))
    expect((await runSource(mcfSource, prefs(), ctx)).run).toMatchObject({ ok: false, reason: 'blocked' })
  })
})
