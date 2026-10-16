import type { CoverLetter } from '../applications/types'

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter((w) => w !== '').length

const same = (a: string, b: string) => a.trim() === b.trim()

// The person's edit (FR-43): saved as written, not checked again. Writing the AI's text back removes the mark.
export function editLetter(letter: CoverLetter, body: string): CoverLetter {
  return { ...letter, body, edited: !same(body, letter.aiBody) }
}

// "Kembalikan ke versi AI".
export const restoreAiLetter = (letter: CoverLetter): CoverLetter => ({ ...letter, body: letter.aiBody, edited: false })
