import { describe, expect, it } from 'vitest'
import { createEmptyProfile } from '../profile/profile'
import type { Job, JobStatus } from '../feed/types'
import { buildExport, exportFileName } from './export'

function job(id: string, status: JobStatus): Job {
  return {
    id, status, score: null, aiFilled: [], firstSeenAt: '', lastSeenAt: '', source: 'lever', title: id, company: 'C',
    location: '', workplace: 'unknown', contract: '', level: '', salary: '', experience: '', postedAt: '', deadline: '',
    url: `https://x.test/${id}`, description: '', logoUrl: '',
  }
}

describe('buildExport', () => {
  it('wraps the profile in a versioned envelope', () => {
    const profile = createEmptyProfile()
    const parsed = JSON.parse(buildExport(profile, new Date('2026-10-09T08:00:00Z')))
    expect(parsed).toEqual({ app: 'job-kit', version: 2, exportedAt: '2026-10-09T08:00:00.000Z', profile, jobs: [] })
  })

  it('adds saved and applied jobs, and leaves out new and hidden ones', () => {
    const feed = [job('a', 'new'), job('b', 'saved'), job('c', 'hidden'), job('d', 'applied')]
    const parsed = JSON.parse(buildExport(createEmptyProfile(), new Date('2026-10-09T08:00:00Z'), feed))
    expect(parsed.jobs.map((j: Job) => j.id)).toEqual(['b', 'd'])
  })
})

describe('exportFileName', () => {
  it('names the file after the export date', () => {
    expect(exportFileName(new Date('2026-10-09T08:00:00Z'))).toBe('job-kit-export-2026-10-09.json')
  })
})
