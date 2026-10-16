import { describe, expect, it } from 'vitest'
import type { Application } from '../applications/types'
import { bannerText, openedFrom, openedFromApplication, shouldMarkApplied } from './opened'
import type { Job } from './types'

const job = (change: Partial<Job> = {}) => ({ id: 'j1', title: 'Frontend Engineer', score: null, ...change }) as Job
const score = (value: number, rough = false) => ({ value, matches: [], gaps: [], summary: '', rough, inputHash: '' })

describe('openedFrom', () => {
  it('keeps what the panel needs to show and to mark the job', () => {
    expect(openedFrom(job({ score: score(86) }))).toEqual({ jobId: 'j1', title: 'Frontend Engineer', score: 86, rough: false })
  })

  it('has no score when the job has none', () => {
    expect(openedFrom(job())).toEqual({ jobId: 'j1', title: 'Frontend Engineer', score: null, rough: false })
  })
})

describe('openedFromApplication', () => {
  const application = { id: 'a1', jobId: 'j1', job: { title: 'Salinan Judul' } } as Application

  it('takes the title from the application, and the score from the job when the feed still has it', () => {
    expect(openedFromApplication(application, job({ score: score(86) }))).toEqual({ jobId: 'j1', applicationId: 'a1', title: 'Salinan Judul', score: 86, rough: false })
  })

  it('still works when the feed has pruned the job: no score, same job id', () => {
    expect(openedFromApplication(application, undefined)).toEqual({ jobId: 'j1', applicationId: 'a1', title: 'Salinan Judul', score: null, rough: false })
  })

  it('has an empty job id for an application that is not tied to a feed job, but still names the application', () => {
    expect(openedFromApplication({ ...application, jobId: null }, undefined)).toMatchObject({ jobId: '', applicationId: 'a1' })
  })
})

describe('bannerText', () => {
  it('names the score', () => {
    expect(bannerText({ jobId: 'j', title: 't', score: 86, rough: false })).toBe('Dari Lowongan · skor 86')
  })

  it('says when the score is rough', () => {
    expect(bannerText({ jobId: 'j', title: 't', score: 58, rough: true })).toBe('Dari Lowongan · skor kasar 58')
  })

  it('still says where the tab came from without a score', () => {
    expect(bannerText({ jobId: 'j', title: 't', score: null, rough: false })).toBe('Dari Lowongan')
  })
})

describe('shouldMarkApplied', () => {
  const opened = { jobId: 'j', title: 't', score: null, rough: false }

  it('marks only a tab that came from the feed, and only when something was filled', () => {
    expect(shouldMarkApplied(opened, 5)).toBe(true)
    expect(shouldMarkApplied(opened, 0)).toBe(false)
    expect(shouldMarkApplied(undefined, 5)).toBe(false)
  })
})
