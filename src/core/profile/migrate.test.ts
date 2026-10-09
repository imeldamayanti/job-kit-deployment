import { describe, expect, it } from 'vitest'
import { migrateProfile } from './migrate'
import { createEmptyProfile } from './profile'

describe('migrateProfile', () => {
  it('gives a version 1 profile empty job preferences and keeps the rest', () => {
    const old = { ...createEmptyProfile(), version: 1 } as Record<string, unknown>
    delete old.jobPrefs
    old.personal = { ...(old.personal as object), firstName: 'Sari' }
    const result = migrateProfile(old)
    expect(result.version).toBe(2)
    expect(result.personal.firstName).toBe('Sari')
    expect(result.jobPrefs).toEqual(createEmptyProfile().jobPrefs)
  })

  it('leaves a current profile as it is', () => {
    const current = createEmptyProfile()
    current.jobPrefs.roles = ['Frontend Engineer']
    expect(migrateProfile(current)).toEqual(current)
  })

  it('repairs job preferences that are damaged', () => {
    const damaged = { ...createEmptyProfile(), jobPrefs: { roles: 'x', level: 'Wizard' } }
    expect(migrateProfile(damaged).jobPrefs).toEqual(createEmptyProfile().jobPrefs)
  })

  it('returns an empty profile when there is nothing usable', () => {
    expect(migrateProfile(undefined)).toEqual(createEmptyProfile())
    expect(migrateProfile(null)).toEqual(createEmptyProfile())
    expect(migrateProfile('x')).toEqual(createEmptyProfile())
  })
})
