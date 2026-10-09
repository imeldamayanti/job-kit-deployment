import { describe, expect, it } from 'vitest'
import { PROFILE_SECTIONS, sectionForKey, sectionFromHash } from './sections'

describe('sectionForKey', () => {
  it('sends a missing personal value to Personal Info', () => {
    expect(sectionForKey('fullName')).toBe('personal')
    expect(sectionForKey('birthDate')).toBe('personal')
  })

  it('sends a missing contact value to Contact & Address', () => {
    expect(sectionForKey('email')).toBe('contact')
    expect(sectionForKey('postalCode')).toBe('contact')
  })

  it('sends a custom key to Custom Field', () => {
    expect(sectionForKey('custom:abc')).toBe('custom')
  })
})

describe('sectionFromHash', () => {
  it('reads a section from the page address', () => {
    expect(sectionFromHash('#contact')).toBe('contact')
  })

  it('falls back to the first section for anything else', () => {
    expect(sectionFromHash('')).toBe('personal')
    expect(sectionFromHash('#nope')).toBe('personal')
  })
})

describe('PROFILE_SECTIONS', () => {
  it('puts Preferensi kerja after Custom Field', () => {
    expect(PROFILE_SECTIONS.at(-1)).toEqual({ id: 'preferences', title: 'Preferensi kerja' })
    expect(sectionFromHash('#preferences')).toBe('preferences')
  })

  it('lists the v1 sections in the order of the spec, then Preferensi kerja', () => {
    expect(PROFILE_SECTIONS.map((s) => s.title)).toEqual([
      'Personal Info',
      'Contact & Address',
      'Education',
      'Work Experience',
      'Custom Field',
      'Preferensi kerja',
    ])
  })
})
