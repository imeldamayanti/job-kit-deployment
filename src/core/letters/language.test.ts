import { describe, expect, it } from 'vitest'
import { LETTER_LANG } from './language'

describe('LETTER_LANG', () => {
  it('is English, whatever language the posting is in', () => {
    expect(LETTER_LANG).toBe('en')
  })
})
