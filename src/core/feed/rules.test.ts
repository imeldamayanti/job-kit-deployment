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

  describe('remote jobs open to a candidate in Indonesia', () => {
    const remote = (location: string) => job({ workplace: 'remote', location })
    const mine = prefs({ locations: ['Jakarta', 'Bali'], workModes: ['Remote'] })

    it('keeps a remote job that names no region, or an open one', () => {
      for (const location of ['', 'Remote', 'Fully remote', 'Worldwide', 'Remote - Anywhere', 'Global', 'APAC', 'Asia Pacific', 'Southeast Asia', 'Remote (SEA)']) {
        expect(passesRules(remote(location), mine), location).toBe(true)
      }
    })

    it('keeps a remote job that names Indonesia or a wanted city, even beside other places', () => {
      for (const location of ['Indonesia', 'Remote - Indonesia', 'Jakarta, Indonesia', 'Bali', 'USA, Canada, Indonesia']) {
        expect(passesRules(remote(location), mine), location).toBe(true)
      }
    })

    it('drops a remote job limited to a region without Indonesia', () => {
      for (const location of ['USA Only', 'Remote (US)', 'United States', 'Europe', 'EMEA', 'Remote - Germany', 'Americas', 'Singapore', 'UK Only']) {
        expect(passesRules(remote(location), mine), location).toBe(false)
      }
    })

    it('asks nothing of the region when no wanted location is set', () => {
      expect(passesRules(remote('USA Only'), prefs({ workModes: ['Remote'] }))).toBe(true)
    })

    it('does not touch a job of unknown work type', () => {
      expect(passesRules(job({ workplace: 'unknown', location: 'United States' }), mine)).toBe(true)
    })
  })

  it('does not rescue a remote job when remote is not wanted', () => {
    expect(passesRules(job({ workplace: 'remote' }), prefs({ workModes: ['On-site'] }))).toBe(false)
  })

  it('leaves a job of unknown work type to the score, whatever its location says', () => {
    // "Indonesia", "APAC" or "Singapore" on a remote role is common and says nothing about where the work is done.
    expect(passesRules(job({ workplace: 'unknown', location: 'Indonesia' }), prefs({ locations: ['Jakarta', 'Bali'] }))).toBe(true)
    expect(passesRules(job({ workplace: 'unknown', location: 'APAC' }), prefs({ locations: ['Jakarta', 'Bali'], workModes: ['Remote'] }))).toBe(true)
  })

  it('still drops a hybrid job outside the wanted locations', () => {
    expect(passesRules(job({ workplace: 'hybrid', location: 'Surabaya' }), prefs({ locations: ['Jakarta', 'Bali'] }))).toBe(false)
  })

  it('keeps a job with no location', () => {
    expect(passesRules(job({ location: '' }), prefs({ locations: ['Jakarta'] }))).toBe(true)
  })
})
