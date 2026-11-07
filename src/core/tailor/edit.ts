import type { TailoredCv } from '../applications/types'
import type { CvParts } from './diff'
import { DEFAULT_CV_ORDER, type CvOrder } from './types'

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

// Which section leads the CV. It is a layout choice, not wording, so the edited mark and the AI version stay as they are.
// The default is not stored: a CV that never chose has no `order`.
export function withCvOrder(cv: TailoredCv, order: CvOrder): TailoredCv {
  const { order: _previous, ...rest } = cv
  return order === DEFAULT_CV_ORDER ? rest : { ...rest, order }
}

// "Kembalikan ke versi AI": the wording the AI returned, as a copy so later edits never reach it.
export function restoreAiVersion(cv: TailoredCv): TailoredCv {
  const ai = structuredClone(cv.aiVersion)
  return { ...cv, ...ai, aiVersion: structuredClone(cv.aiVersion), edited: false }
}

// Buat ulang on an edited CV or letter would throw the edits away, so it asks first (FR-45).
export const overwritesEdits = (doc: { edited: boolean } | null): boolean => doc?.edited === true
