import { describe, expect, it } from 'vitest'
import type { Profile } from '../profile/types'
import { isStale, profileHash } from './hash'
import { SAMPLE_WEB_DEV } from './sample-profiles'

const A = SAMPLE_WEB_DEV
const clone = (): Profile => structuredClone(A)

describe('profileHash (FR-45)', () => {
  it('is the same for the same Profile and 8 hex characters long', () => {
    expect(profileHash(A)).toBe(profileHash(clone()))
    expect(profileHash(A)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('changes when anything a CV shows changes', () => {
    const changes: ((p: Profile) => void)[] = [
      (p) => { p.skills[0] = { group: 'teknis', name: 'Vue' } },
      (p) => { p.skills.push({ group: 'teknis', name: 'Docker' }) },
      (p) => { p.experience[0]!.description += ' Tambahan.' },
      (p) => { p.experience[0]!.title = 'Senior Engineer' },
      (p) => { p.experience[0]!.end = '2026-01' },
      (p) => { p.education[0]!.major = 'Sistem Informasi' },
      (p) => { p.personal.lastName = 'Lain' },
      (p) => { p.contact.email = 'baru@example.test' },
    ]
    for (const change of changes) {
      const p = clone()
      change(p)
      expect(profileHash(p)).not.toBe(profileHash(A))
    }
  })

  it('does not change for what a CV does not show: job preferences, custom fields, birth date', () => {
    const p = clone()
    p.jobPrefs.roles = ['Backend Engineer']
    p.custom = [{ id: 'c', key: 'Hobi', value: 'Mendaki' }]
    p.personal.birthDate = '1 Januari 2000'
    expect(profileHash(p)).toBe(profileHash(A))
  })

  it('tells a CV from an older Profile apart', () => {
    const hash = profileHash(A)
    expect(isStale(hash, A)).toBe(false)
    const p = clone()
    p.skills.push({ group: 'teknis', name: 'Docker' })
    expect(isStale(hash, p)).toBe(true)
  })
})
