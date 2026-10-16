import { describe, expect, it } from 'vitest'
import { formatFillSummary, formatMarkedNotice, matchPercent } from './summary'

describe('formatFillSummary', () => {
  it('writes the result as in the screen spec', () => {
    expect(formatFillSummary(9, 1)).toBe('9 field terisi · 1 dilewati')
  })
})

describe('formatMarkedNotice', () => {
  it('says how many required fields are outlined on the page', () => {
    expect(formatMarkedNotice(3)).toBe('3 field wajib belum terisi, sudah ditandai kuning di halaman.')
  })

  it('says nothing when none are outlined', () => {
    expect(formatMarkedNotice(0)).toBeUndefined()
  })
})

describe('matchPercent', () => {
  it('rounds the matched share to a whole percent', () => {
    expect(matchPercent(9, 12)).toBe(75)
    expect(matchPercent(1, 3)).toBe(33)
  })

  it('is 0 when the form has no fields', () => {
    expect(matchPercent(0, 0)).toBe(0)
  })
})
