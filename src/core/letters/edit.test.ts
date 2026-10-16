import { describe, expect, it } from 'vitest'
import type { CoverLetter } from '../applications/types'
import { editLetter, restoreAiLetter, wordCount } from './edit'

const letter = (change: Partial<CoverLetter> = {}): CoverLetter => ({
  id: 'l1', applicationId: 'a1', createdAt: '2026-10-16T08:00:00.000Z', profileHash: 'h', lang: 'id', tone: 'formal',
  body: 'Yth. Tim,\n\nSaya melamar.', aiBody: 'Yth. Tim,\n\nSaya melamar.', edited: false, ...change,
})

describe('wordCount', () => {
  it('counts words across lines and ignores extra spaces', () => {
    expect(wordCount('Satu dua  tiga\n\nempat')).toBe(4)
    expect(wordCount('')).toBe(0)
    expect(wordCount('   \n ')).toBe(0)
  })
})

describe('editLetter', () => {
  it('saves the text as written and marks the letter edited', () => {
    const next = editLetter(letter(), 'Yth. Tim,\n\nSaya sangat ingin melamar.')
    expect(next.body).toBe('Yth. Tim,\n\nSaya sangat ingin melamar.')
    expect(next.edited).toBe(true)
    expect(next.aiBody).toBe('Yth. Tim,\n\nSaya melamar.')
  })

  it('takes the mark away when the edit undoes itself', () => {
    const edited = editLetter(letter(), 'lain')
    expect(editLetter(edited, 'Yth. Tim,\n\nSaya melamar.').edited).toBe(false)
  })

  it('does not count a trailing space or newline as an edit', () => {
    expect(editLetter(letter(), 'Yth. Tim,\n\nSaya melamar.\n').edited).toBe(false)
  })
})

describe('restoreAiLetter', () => {
  it('gives back the AI wording and clears the mark', () => {
    const restored = restoreAiLetter(letter({ body: 'sunting', edited: true }))
    expect(restored.body).toBe('Yth. Tim,\n\nSaya melamar.')
    expect(restored.edited).toBe(false)
  })
})
