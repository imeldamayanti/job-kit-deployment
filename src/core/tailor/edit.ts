import type { TailoredCv } from '../applications/types'
import type { CvParts } from './diff'

export const cvParts = (cv: TailoredCv): CvParts => ({ skills: cv.skills, experience: cv.experience, education: cv.education })

const clean = (parts: CvParts): CvParts => ({
  skills: parts.skills.map((s) => s.trim()).filter((s) => s !== ''),
  experience: parts.experience.map((e) => ({ sourceId: e.sourceId, bullets: e.bullets.map((b) => b.trim()).filter((b) => b !== '') })),
  education: [...parts.education],
})

// Same wording, ignoring nothing: an edit that undoes itself is no edit.
const same = (a: CvParts, b: CvParts) => JSON.stringify(a) === JSON.stringify(b)

// The person's hand edit (FR-41). It is saved as written and not checked again: the CV is theirs, and the mark says
// so. Whether it still equals what the AI wrote decides the mark, so undoing an edit takes the mark away.
export function editCv(cv: TailoredCv, parts: CvParts): TailoredCv {
  const next = clean(parts)
  return { ...cv, ...next, edited: !same(next, clean(cv.aiVersion)) }
}

// "Kembalikan ke versi AI": the wording the AI returned, as a copy so later edits never reach it.
export function restoreAiVersion(cv: TailoredCv): TailoredCv {
  const ai = structuredClone(cv.aiVersion)
  return { ...cv, ...ai, aiVersion: structuredClone(cv.aiVersion), edited: false }
}

// Buat ulang on an edited CV or letter would throw the edits away, so it asks first (FR-45).
export const overwritesEdits = (doc: { edited: boolean } | null): boolean => doc?.edited === true
