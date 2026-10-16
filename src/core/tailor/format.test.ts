import { describe, expect, it } from 'vitest'
import { formatPeriod } from './format'

describe('formatPeriod', () => {
  it('writes a current job as "Jan 2023 – sekarang"', () => {
    expect(formatPeriod('2023-01', '', true)).toBe('Jan 2023 – sekarang')
  })

  it('writes a finished job with both months', () => {
    expect(formatPeriod('2022-01', '2022-06', false)).toBe('Jan 2022 – Jun 2022')
  })

  it('keeps a bare year as the year', () => {
    expect(formatPeriod('2019', '2021', false)).toBe('2019 – 2021')
  })

  it('shows only the start when a past job has no end', () => {
    expect(formatPeriod('2020-03', '', false)).toBe('Mar 2020')
  })

  it('is empty without a start, and never prints a bad month', () => {
    expect(formatPeriod('', '', false)).toBe('')
    expect(formatPeriod('', '', true)).toBe('sekarang')
    expect(formatPeriod('2023-13', '', true)).toBe('2023-13 – sekarang')
  })
})

describe('formatPeriod in English (T50)', () => {
  it('uses English month names and "present"', () => {
    expect(formatPeriod('2021-03', '', true, 'en')).toBe('Mar 2021 – present')
    expect(formatPeriod('2019-07', '2021-02', false, 'en')).toBe('Jul 2019 – Feb 2021')
    expect(formatPeriod('2022-05', '2022-08', false, 'en')).toBe('May 2022 – Aug 2022')
    expect(formatPeriod('2022-08', '2022-10', false, 'en')).toBe('Aug 2022 – Oct 2022')
  })

  it('keeps the Indonesian month names by default', () => {
    expect(formatPeriod('2022-05', '2022-08', false)).toBe('Mei 2022 – Agu 2022')
  })
})

