import { describe, expect, it } from 'vitest'
import { chooseOption } from './choice'

const labels = (...texts: string[]) => texts.map((label) => ({ label, value: label.toLowerCase() }))

describe('chooseOption', () => {
  it('picks the English option for an Indonesian gender', () => {
    const options = labels('Male', 'Female', 'Prefer not to say')

    expect(options[chooseOption('gender', 'Laki-laki', options) ?? -1]?.label).toBe('Male')
    expect(options[chooseOption('gender', 'Perempuan', options) ?? -1]?.label).toBe('Female')
  })

  it('does not take Female for Male', () => {
    const options = labels('Female', 'Male')

    expect(options[chooseOption('gender', 'Laki-laki', options) ?? -1]?.label).toBe('Male')
  })

  it('picks the Indonesian option for an English gender too', () => {
    const options = labels('Laki-laki', 'Perempuan')

    expect(options[chooseOption('gender', 'Female', options) ?? -1]?.label).toBe('Perempuan')
  })

  it('maps an education level across languages', () => {
    const options = labels('High School', "Bachelor's Degree", "Master's Degree", 'Doctorate')

    expect(options[chooseOption('educationLevel', 'S1', options) ?? -1]?.label).toBe("Bachelor's Degree")
    expect(options[chooseOption('educationLevel', 'Magister', options) ?? -1]?.label).toBe("Master's Degree")
    expect(options[chooseOption('educationLevel', 'SMA', options) ?? -1]?.label).toBe('High School')
  })

  it('prefers an exact match over a loose one', () => {
    const options = labels('S1 Teknik', 'S1')

    expect(chooseOption('educationLevel', 'S1', options)).toBe(1)
  })

  it('matches a country by name', () => {
    const options = labels('Singapore', 'Indonesia', 'Malaysia')

    expect(chooseOption('country', 'Indonesia', options)).toBe(1)
  })

  it('matches a nationality given as the country name', () => {
    const options = labels('Singaporean', 'Indonesian')

    expect(chooseOption('nationality', 'Indonesia', options)).toBe(1)
  })

  it('returns null when nothing fits', () => {
    expect(chooseOption('gender', 'Laki-laki', labels('Yes', 'No'))).toBeNull()
    expect(chooseOption('gender', 'Laki-laki', [])).toBeNull()
  })
})
