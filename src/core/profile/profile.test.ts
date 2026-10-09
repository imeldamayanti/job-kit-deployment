import { describe, expect, it } from 'vitest'
import { createEmptyProfile, setPersonalField } from './profile'

describe('createEmptyProfile', () => {
  it('starts at version 1 with every personal field empty', () => {
    const profile = createEmptyProfile()

    expect(profile.version).toBe(1)
    expect(Object.values(profile.personal).every((value) => value === '')).toBe(true)
  })
})

describe('setPersonalField', () => {
  it('returns a new profile with the field changed and leaves the original alone', () => {
    const before = createEmptyProfile()

    const after = setPersonalField(before, 'firstName', 'Imelda')

    expect(after.personal.firstName).toBe('Imelda')
    expect(before.personal.firstName).toBe('')
  })

  it('allows a field to be cleared again', () => {
    const filled = setPersonalField(createEmptyProfile(), 'firstName', 'Imelda')

    expect(setPersonalField(filled, 'firstName', '').personal.firstName).toBe('')
  })
})
