import { describe, expect, it } from 'vitest'
import { previewFeedFromHash } from './preview'

describe('previewFeedFromHash', () => {
  it('ignores anything that is not a jobs preview', () => {
    expect(previewFeedFromHash('')).toBeUndefined()
    expect(previewFeedFromHash('#data?state=list')).toBeUndefined()
    expect(previewFeedFromHash('#jobs')).toBeUndefined()
    expect(previewFeedFromHash('#jobs?state=nope')).toBeUndefined()
  })

  it('has a scenario for every state of the T28 mockup', () => {
    for (const name of ['list', 'saved', 'off', 'noprefs', 'fetching', 'empty', 'nomatch', 'onefail', 'paused', 'rough', 'allfail']) {
      expect(previewFeedFromHash(`#jobs?state=${name}`), name).toBeDefined()
    }
  })

  it('the list scenario holds one card of each score tier and one rough score', () => {
    const scenario = previewFeedFromHash('#jobs?state=list')
    const jobs = scenario?.feed ?? []
    expect(jobs.length).toBeGreaterThanOrEqual(3)
    expect(jobs.some((job) => job.score && !job.score.rough && job.score.value >= 75)).toBe(true)
    expect(jobs.some((job) => job.score && !job.score.rough && job.score.value < 75 && job.score.value >= 50)).toBe(true)
    expect(jobs.some((job) => job.score?.rough)).toBe(true)
  })
})
