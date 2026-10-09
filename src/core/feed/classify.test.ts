import { describe, expect, it } from 'vitest'
import { classifyWorkplace } from './classify'

describe('classifyWorkplace', () => {
  it('trusts the structured field of the source first', () => {
    expect(classifyWorkplace({ structured: 'hybrid', location: 'Remote', title: 'Engineer' })).toBe('hybrid')
    expect(classifyWorkplace({ structured: 'onsite', location: 'Anywhere', title: 'Engineer' })).toBe('onsite')
    expect(classifyWorkplace({ structured: 'Remote', location: 'Jakarta', title: 'Engineer' })).toBe('remote')
    expect(classifyWorkplace({ structured: true, location: 'Jakarta', title: 'Engineer' })).toBe('remote')
  })

  it('reads on-site spelled several ways', () => {
    for (const value of ['On-site', 'on site', 'Office', 'in_office']) {
      expect(classifyWorkplace({ structured: value, location: '', title: '' })).toBe('onsite')
    }
  })

  it('falls back to the words in location and title', () => {
    expect(classifyWorkplace({ location: 'Remote - US', title: 'Designer' })).toBe('remote')
    expect(classifyWorkplace({ location: 'Worldwide', title: 'Designer' })).toBe('remote')
    expect(classifyWorkplace({ location: 'Jakarta', title: 'WFH Customer Support' })).toBe('remote')
    expect(classifyWorkplace({ location: 'Jakarta (Hybrid)', title: 'Designer' })).toBe('hybrid')
    expect(classifyWorkplace({ location: 'Bandung', title: 'Engineer, Hybrid 3 days' })).toBe('hybrid')
  })

  it('prefers hybrid over remote when both words appear', () => {
    expect(classifyWorkplace({ location: 'Remote or Hybrid, Jakarta', title: 'Engineer' })).toBe('hybrid')
  })

  it('says unknown when nothing says', () => {
    expect(classifyWorkplace({ location: 'Seattle, San Francisco', title: 'Abuse Investigator' })).toBe('unknown')
    expect(classifyWorkplace({ structured: 'something else', location: '', title: '' })).toBe('unknown')
  })

  it('does not read a word that only contains the keyword', () => {
    expect(classifyWorkplace({ location: 'Remoteville Road', title: 'Engineer' })).toBe('unknown')
  })
})
