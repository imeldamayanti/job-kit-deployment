import { describe, expect, it } from 'vitest'
import { SAMPLE_WEB_DEV } from '../tailor/sample-profiles'
import { validateLetter } from './grounded'
import { LETTER_VIEW_NAMES, letterViewFor } from './view'

describe('letter sample views', () => {
  it('has every state the tab can be in', () => {
    expect(LETTER_VIEW_NAMES).toEqual(expect.arrayContaining(['result', 'empty', 'busy', 'rejected', 'stale', 'off', 'limit', 'notice', 'noexp', 'edited']))
  })

  it('shows a sample letter that passes the same fact check as a real one', () => {
    const letter = letterViewFor('result').letter
    expect(letter).not.toBeNull()
    expect(validateLetter(letter!.body, SAMPLE_WEB_DEV, { title: 'Frontend Engineer (React)', company: 'PT Contoh Karya' }).violations).toEqual([])
  })

  it('marks the edited sample as edited and the stale one as stale', () => {
    expect(letterViewFor('edited').letter?.edited).toBe(true)
    expect(letterViewFor('stale')).toMatchObject({ stale: true })
  })
})
