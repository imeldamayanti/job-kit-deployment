import { describe, expect, it } from 'vitest'
import { formatFillSummary } from './summary'

describe('formatFillSummary', () => {
  it('writes the result as in the screen spec', () => {
    expect(formatFillSummary(9, 1)).toBe('9 field terisi · 1 dilewati')
  })
})
