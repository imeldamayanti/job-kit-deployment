import { describe, expect, it } from 'vitest'
import {
  addCustomField,
  createEmptyProfile,
  removeCustomField,
  setContactField,
  setPersonalField,
  updateCustomField,
} from './profile'

describe('createEmptyProfile', () => {
  it('starts at version 2 with every personal field empty and no job preferences', () => {
    const profile = createEmptyProfile()

    expect(profile.version).toBe(2)
    expect(profile.jobPrefs.roles).toEqual([])
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

describe('setContactField', () => {
  it('changes one contact field and keeps personal info', () => {
    const before = setPersonalField(createEmptyProfile(), 'firstName', 'Imelda')

    const after = setContactField(before, 'email', 'nama@example.test')

    expect(after.contact.email).toBe('nama@example.test')
    expect(after.personal.firstName).toBe('Imelda')
    expect(before.contact.email).toBe('')
  })
})

describe('custom fields', () => {
  it('adds an empty pair with the given id', () => {
    const profile = addCustomField(createEmptyProfile(), 'c1')

    expect(profile.custom).toEqual([{ id: 'c1', key: '', value: '' }])
  })

  it('updates only the pair with that id', () => {
    const start = addCustomField(addCustomField(createEmptyProfile(), 'c1'), 'c2')

    const next = updateCustomField(start, 'c2', { key: 'Ekspektasi gaji', value: '10 juta' })

    expect(next.custom).toEqual([
      { id: 'c1', key: '', value: '' },
      { id: 'c2', key: 'Ekspektasi gaji', value: '10 juta' },
    ])
  })

  it('removes a pair', () => {
    const start = addCustomField(addCustomField(createEmptyProfile(), 'c1'), 'c2')

    expect(removeCustomField(start, 'c1').custom.map((c) => c.id)).toEqual(['c2'])
  })
})
