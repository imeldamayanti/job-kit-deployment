import { describe, expect, it } from 'vitest'
import ashby from '../../../fixtures/jobs/ashby.json'
import greenhouse from '../../../fixtures/jobs/greenhouse.json'
import lever from '../../../fixtures/jobs/lever.json'
import remotive from '../../../fixtures/jobs/remotive.json'
import { classifyWorkplace } from './classify'

// Real responses saved during the T27 spike. Each source says "remote" in its own way.
describe('classifyWorkplace on real source data', () => {
  it('Ashby: workplaceType decides', () => {
    const kinds = ashby.jobs.map((job) => classifyWorkplace({ structured: job.workplaceType, location: job.location, title: job.title }))
    expect(kinds).toEqual(['remote', 'remote', 'remote', 'remote'])
  })

  it('Lever: workplaceType decides, hybrid and onsite included', () => {
    const kinds = lever.map((job) => classifyWorkplace({ structured: job.workplaceType, location: job.categories.location, title: job.text }))
    expect(kinds).toEqual(['hybrid', 'hybrid', 'onsite'])
  })

  it('Greenhouse: no structured field, so only the location text says', () => {
    const kinds = greenhouse.jobs.map((job) => classifyWorkplace({ location: job.location.name, title: job.title }))
    expect(kinds).toEqual(['unknown', 'unknown', 'remote'])
  })

  it('Remotive: every job is remote by nature of the board', () => {
    const kinds = remotive.jobs.map((job) => classifyWorkplace({ structured: 'remote', location: job.candidate_required_location, title: job.title }))
    expect(new Set(kinds)).toEqual(new Set(['remote']))
  })
})
