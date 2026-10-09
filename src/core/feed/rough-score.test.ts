import { describe, expect, it } from 'vitest'
import { createEmptyProfile } from '../profile/profile'
import type { Profile } from '../profile/types'
import { roughScore, yearsOfExperience } from './rough-score'
import type { RawJob } from './types'

const NOW = new Date('2026-10-10T00:00:00Z')

function job(change: Partial<RawJob> = {}): RawJob {
  return {
    source: 'ashby', title: 'Frontend Engineer', company: 'PT Contoh', location: 'Jakarta', workplace: 'remote', contract: '',
    level: 'Mid', salary: '', experience: '', postedAt: '2026-10-08', deadline: '', url: 'https://x.test/1',
    description: 'Bangun UI dengan React dan TypeScript.', logoUrl: '', ...change,
  }
}

function profile(change: (p: Profile) => void = () => {}): Profile {
  const p = createEmptyProfile()
  p.jobPrefs.roles = ['Frontend Engineer']
  p.jobPrefs.level = 'Mid'
  p.skills = [{ group: 'teknis', name: 'React' }, { group: 'teknis', name: 'TypeScript' }]
  change(p)
  return p
}

describe('yearsOfExperience', () => {
  it('adds up the time of every entry, counting a current job until now', () => {
    const p = createEmptyProfile()
    p.experience = [
      { id: '1', company: 'A', title: 'x', start: '2023-01', end: '2024-01', current: false, description: '' },
      { id: '2', company: 'B', title: 'y', start: '2024-10', end: '', current: true, description: '' },
    ]
    expect(yearsOfExperience(p, NOW)).toBeCloseTo(3, 0)
  })

  it('is zero when there are no dates it can read', () => {
    expect(yearsOfExperience(createEmptyProfile(), NOW)).toBe(0)
  })
})

describe('roughScore', () => {
  it('is marked rough and carries a value between 0 and 100', () => {
    const score = roughScore(job(), profile(), NOW)
    expect(score.rough).toBe(true)
    expect(score.value).toBeGreaterThanOrEqual(0)
    expect(score.value).toBeLessThanOrEqual(100)
    expect(score.inputHash).toBe('')
  })

  it('scores a matching job above a mismatched one', () => {
    const good = roughScore(job(), profile(), NOW)
    const bad = roughScore(
      job({ title: 'Account Executive', description: 'Jualan', level: 'Lead', postedAt: '2026-06-01' }),
      profile(),
      NOW,
    )
    expect(good.value).toBeGreaterThan(bad.value)
  })

  it('lists what matched and what is missing', () => {
    const score = roughScore(job({ description: 'React dan GraphQL' }), profile((p) => { p.jobPrefs.mustHave = ['GraphQL', 'Rust'] }), NOW)
    expect(score.matches).toEqual(expect.arrayContaining([expect.stringContaining('React'), expect.stringContaining('GraphQL')]))
    expect(score.gaps).toEqual(expect.arrayContaining([expect.stringContaining('Rust')]))
    expect(score.summary).not.toBe('')
  })

  it('gives a newer job a higher score than the same job posted long ago', () => {
    const fresh = roughScore(job({ postedAt: '2026-10-09' }), profile(), NOW)
    const stale = roughScore(job({ postedAt: '2026-07-01' }), profile(), NOW)
    expect(fresh.value).toBeGreaterThan(stale.value)
  })

  it('does not fail on a job with almost nothing in it', () => {
    const score = roughScore(job({ title: '', description: '', level: '', postedAt: '' }), createEmptyProfile(), NOW)
    expect(score.value).toBeGreaterThanOrEqual(0)
  })
})
