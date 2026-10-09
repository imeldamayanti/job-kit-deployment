import { describe, expect, it } from 'vitest'
import { createEducation, createExperience } from './entries'
import { addCustomField, createEmptyProfile, setContactField, setPersonalField, updateCustomField } from './profile'
import { isProfileEmpty, summarizeProfile } from './summary'

describe('isProfileEmpty', () => {
  it('is true for a brand new profile', () => {
    expect(isProfileEmpty(createEmptyProfile())).toBe(true)
  })

  it('is false once any personal or contact field has text', () => {
    expect(isProfileEmpty(setPersonalField(createEmptyProfile(), 'firstName', 'Imelda'))).toBe(false)
    expect(isProfileEmpty(setContactField(createEmptyProfile(), 'email', 'a@b.test'))).toBe(false)
  })

  it('ignores whitespace and entries the user added but never filled', () => {
    const blank = {
      ...setPersonalField(createEmptyProfile(), 'firstName', '   '),
      education: [createEducation('e1')],
      experience: [createExperience('x1')],
      custom: addCustomField(createEmptyProfile(), 'c1').custom,
    }

    expect(isProfileEmpty(blank)).toBe(true)
  })

  it('counts a filled education entry or custom pair', () => {
    const withEducation = { ...createEmptyProfile(), education: [{ ...createEducation('e1'), institution: 'ITB' }] }
    const withCustom = updateCustomField(addCustomField(createEmptyProfile(), 'c1'), 'c1', { key: 'Gaji', value: '10 juta' })

    expect(isProfileEmpty(withEducation)).toBe(false)
    expect(isProfileEmpty(withCustom)).toBe(false)
  })
})

describe('summarizeProfile', () => {
  it('shows the name, the email and a count for each section', () => {
    let profile = setPersonalField(createEmptyProfile(), 'firstName', 'Imelda')
    profile = setPersonalField(profile, 'lastName', 'Damayanti')
    profile = setContactField(profile, 'email', 'nama@example.test')
    profile = { ...profile, experience: [createExperience('1'), createExperience('2'), createExperience('3')].map((e) => ({ ...e, title: 'Staf' })) }

    const summary = summarizeProfile(profile)

    expect(summary.name).toBe('Imelda Damayanti')
    expect(summary.email).toBe('nama@example.test')
    expect(summary.sections).toEqual([
      { id: 'personal', text: 'Personal Info · 2' },
      { id: 'contact', text: 'Contact & Address · 1' },
      { id: 'education', text: 'Education · belum diisi' },
      { id: 'experience', text: 'Work Experience · 3' },
      { id: 'custom', text: 'Custom Field · belum diisi' },
    ])
  })
})
