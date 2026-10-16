// Greenhouse, Lever and Intikom mark a required field in its label rather than with the attribute (T16, FR-20).
const MARKS = /[*✱]/
const REQUIRED_WORDS = /\b(required|wajib)\b/i
const OPTIONAL_WORDS = /\b(optional|opsional|not required|tidak wajib)\b/i

export function isRequiredLabel(label: string): boolean {
  if (MARKS.test(label)) return true
  if (OPTIONAL_WORDS.test(label)) return false
  return REQUIRED_WORDS.test(label)
}
