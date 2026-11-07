import { describe, expect, it } from 'vitest'
import { reconcileProfile } from './reconcile'
import { createEmptyProfile } from './profile'
import type { Profile } from './types'

const base = (): Profile => createEmptyProfile()

const withName = (profile: Profile, firstName: string): Profile => ({ ...profile, personal: { ...profile.personal, firstName } })
const withRoles = (profile: Profile, roles: string[]): Profile => ({ ...profile, jobPrefs: { ...profile.jobPrefs, roles } })

describe('reconcileProfile (a tab saves only what it changed)', () => {
  it('keeps what another tab saved in a section this tab did not touch', () => {
    // This tab loaded an empty profile and only typed a name. Meanwhile another tab saved the job preferences.
    const mine = withName(base(), 'Sari')
    const theirs = withRoles(base(), ['Frontend Engineer'])
    const result = reconcileProfile(base(), mine, theirs)
    expect(result.personal.firstName).toBe('Sari')
    expect(result.jobPrefs.roles).toEqual(['Frontend Engineer'])
  })

  it('keeps this tab\'s own change when both tabs changed the same section', () => {
    const result = reconcileProfile(base(), withRoles(base(), ['A']), withRoles(base(), ['B']))
    expect(result.jobPrefs.roles).toEqual(['A'])
  })

  it('is just this tab\'s profile when nothing else was saved in the meantime', () => {
    const mine = withName(base(), 'Sari')
    expect(reconcileProfile(base(), mine, base())).toEqual(mine)
  })

  it('lets this tab empty a section on purpose', () => {
    const before = withRoles(base(), ['A'])
    const mine = withRoles(before, [])
    expect(reconcileProfile(before, mine, before).jobPrefs.roles).toEqual([])
  })

  it('takes an optional part another tab added, and leaves it out when nobody has it', () => {
    const theirs = { ...base(), summary: 'Ringkasan dari tab lain.' }
    expect(reconcileProfile(base(), withName(base(), 'Sari'), theirs).summary).toBe('Ringkasan dari tab lain.')
    expect(reconcileProfile(base(), withName(base(), 'Sari'), base())).not.toHaveProperty('summary')
  })

  it('does not change the profiles it was given', () => {
    const mine = withName(base(), 'Sari')
    const theirs = withRoles(base(), ['B'])
    const copies = [structuredClone(mine), structuredClone(theirs)]
    reconcileProfile(base(), mine, theirs)
    expect([mine, theirs]).toEqual(copies)
  })
})
