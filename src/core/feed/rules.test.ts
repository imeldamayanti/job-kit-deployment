import { describe, expect, it } from 'vitest'
import { createEmptyJobPreferences, type JobPreferences } from '../profile/job-preferences'
import { passesRules } from './rules'
import type { RawJob } from './types'

function job(change: Partial<RawJob> = {}): RawJob {
  return {
    source: 'ashby', title: 'Frontend Engineer', company: 'PT Contoh', location: 'Jakarta', workplace: 'hybrid', contract: '',
    level: '', salary: '', experience: '', postedAt: '', deadline: '', url: 'https://x.test/1',
    description: 'Bangun UI dengan React dan TypeScript.', logoUrl: '', ...change,
  }
}
const prefs = (change: Partial<JobPreferences>): JobPreferences => ({ ...createEmptyJobPreferences(), ...change })

describe('passesRules', () => {
  it('passes everything when preferences ask for nothing', () => {
    expect(passesRules(job(), createEmptyJobPreferences())).toBe(true)
  })

  it('drops a job that mentions an avoided word in title or description', () => {
    expect(passesRules(job({ description: 'Stack: PHP dan Laravel' }), prefs({ avoid: ['php'] }))).toBe(false)
    expect(passesRules(job({ title: 'Magang Frontend' }), prefs({ avoid: ['magang'] }))).toBe(false)
  })

  it('matches an avoided word as a whole word', () => {
    expect(passesRules(job({ description: 'JavaScript modern' }), prefs({ avoid: ['java'] }))).toBe(true)
  })

  it('drops a job whose work type the user did not pick', () => {
    expect(passesRules(job({ workplace: 'onsite' }), prefs({ workModes: ['Remote', 'Hybrid'] }))).toBe(false)
    expect(passesRules(job({ workplace: 'hybrid' }), prefs({ workModes: ['Remote', 'Hybrid'] }))).toBe(true)
  })

  it('keeps a job whose work type is unknown', () => {
    expect(passesRules(job({ workplace: 'unknown' }), prefs({ workModes: ['Remote'] }))).toBe(true)
  })

  it('drops a job outside the wanted locations', () => {
    expect(passesRules(job({ workplace: 'onsite', location: 'Surabaya' }), prefs({ locations: ['Jakarta'] }))).toBe(false)
    expect(passesRules(job({ workplace: 'onsite', location: 'Jakarta Selatan, Indonesia' }), prefs({ locations: ['jakarta'] }))).toBe(true)
  })

  it('keeps a remote job whatever its location says, when remote is wanted or nothing is picked', () => {
    expect(passesRules(job({ workplace: 'remote', location: 'Worldwide' }), prefs({ locations: ['Jakarta'] }))).toBe(true)
    expect(passesRules(job({ workplace: 'remote', location: 'Worldwide' }), prefs({ locations: ['Jakarta'], workModes: ['Remote'] }))).toBe(true)
  })

  it('does not rescue a remote job when remote is not wanted', () => {
    expect(passesRules(job({ workplace: 'remote' }), prefs({ workModes: ['On-site'] }))).toBe(false)
  })

  it('keeps a job with no location', () => {
    expect(passesRules(job({ location: '' }), prefs({ locations: ['Jakarta'] }))).toBe(true)
  })
})
