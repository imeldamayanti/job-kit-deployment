import { describe, expect, it } from 'vitest'
import type { Job, JobStatus } from '../feed/types'
import { createApplication } from './applications'
import { deriveJobStatus, releaseJob, syncFeed, syncJobStatus } from './sync'
import { APP_STATUSES, type AppStatus, type Application } from './types'

const NOW = new Date('2026-10-15T08:00:00.000Z')

function job(id: string, status: JobStatus = 'new'): Job {
  return {
    id, status, score: null, aiFilled: [], firstSeenAt: '', lastSeenAt: '', source: 'lever', title: id, company: 'C',
    location: '', workplace: 'unknown', contract: '', level: '', salary: '', experience: '', postedAt: '', deadline: '',
    url: `https://x.test/${id}`, description: '', logoUrl: '',
  }
}

function app(jobId: string | null, status: AppStatus): Application {
  const { app: made } = createApplication([], job(jobId ?? 'manual'), NOW, () => `app-${jobId}`)
  return { ...made, jobId, status }
}

describe('deriveJobStatus', () => {
  const EXPECTED: Record<AppStatus, JobStatus> = {
    draft: 'saved', withdrawn: 'saved', applied: 'applied', 'in-review': 'applied', interview: 'applied', offer: 'applied', rejected: 'applied',
  }

  it.each(APP_STATUSES)('%s', (status) => {
    expect(deriveJobStatus(app('j', status))).toBe(EXPECTED[status])
  })
})

describe('syncJobStatus', () => {
  it('sets the job of the application to the status the application implies', () => {
    const feed = [job('a', 'new'), job('b', 'new')]

    const next = syncJobStatus(feed, app('a', 'interview'))

    expect(next.map((item) => item.status)).toEqual(['applied', 'new'])
  })

  it('turns a new or hidden job into a saved one while the application is only a draft', () => {
    expect(syncJobStatus([job('a', 'new')], app('a', 'draft'))[0]?.status).toBe('saved')
    expect(syncJobStatus([job('a', 'hidden')], app('a', 'draft'))[0]?.status).toBe('saved')
  })

  it('takes a job back to saved when the application is withdrawn', () => {
    expect(syncJobStatus([job('a', 'applied')], app('a', 'withdrawn'))[0]?.status).toBe('saved')
  })

  it('is fine with a job the feed has already pruned', () => {
    const feed = [job('other')]

    expect(syncJobStatus(feed, app('gone', 'applied'))).toBe(feed)
  })

  it('leaves the feed alone for an application that is not tied to a feed job', () => {
    const feed = [job('a')]

    expect(syncJobStatus(feed, app(null, 'applied'))).toBe(feed)
  })

  it('returns the same feed when the job already agrees', () => {
    const feed = [job('a', 'applied')]

    expect(syncJobStatus(feed, app('a', 'offer'))).toBe(feed)
  })

  it('keeps everything else about the job', () => {
    const feed = [{ ...job('a', 'new'), title: 'Judul', score: { value: 80, matches: [], gaps: [], summary: '', rough: false, inputHash: 'h' } }]

    const [next] = syncJobStatus(feed, app('a', 'applied'))

    expect(next).toMatchObject({ title: 'Judul', score: { value: 80 } })
  })
})

describe('syncFeed', () => {
  it('lines up every job that has an application, and only those', () => {
    const feed = [job('a', 'new'), job('b', 'applied'), job('c', 'new')]

    const next = syncFeed(feed, [app('a', 'draft'), app('b', 'withdrawn'), app('zzz', 'applied')])

    expect(next.map((item) => item.status)).toEqual(['saved', 'saved', 'new'])
  })
})

describe('releaseJob', () => {
  it('makes the job saved when its application is deleted, so it does not vanish', () => {
    const next = releaseJob([job('a', 'applied'), job('b', 'applied')], app('a', 'offer'))

    expect(next.map((item) => item.status)).toEqual(['saved', 'applied'])
  })

  it('is fine when the job is no longer in the feed', () => {
    const feed = [job('b', 'applied')]

    expect(releaseJob(feed, app('a', 'offer'))).toBe(feed)
  })
})
