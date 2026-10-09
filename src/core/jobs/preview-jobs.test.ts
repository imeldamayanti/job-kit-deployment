import { describe, expect, it } from 'vitest'
import { PREVIEW_JOBS, previewJobsStateFromHash } from './preview-jobs'

describe('previewJobsStateFromHash', () => {
  it('reads the sample state named in the hash', () => {
    expect(previewJobsStateFromHash('#jobs?state=list')).toEqual({ jobs: PREVIEW_JOBS, openId: null, status: 'Semua', query: '' })
    expect(previewJobsStateFromHash('#jobs?state=empty')?.jobs).toEqual([])
    expect(previewJobsStateFromHash('#jobs?state=filtered-empty')).toMatchObject({ status: 'Offer', query: 'zzz' })
    expect(previewJobsStateFromHash('#jobs?state=detail')?.openId).toBe('p1')
  })

  it('returns nothing for a missing or unknown name', () => {
    expect(previewJobsStateFromHash('#jobs')).toBeUndefined()
    expect(previewJobsStateFromHash('#jobs?state=nope')).toBeUndefined()
  })
})
