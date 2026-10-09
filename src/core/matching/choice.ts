import { normalize, type MatchKey } from './match'

export type ChoiceOption = { label: string; value: string }

// Words that mean the same thing in Indonesian and English, per kind of answer.
// A one-letter item (L, P, M, F) only counts when the whole option is that letter.
const SYNONYMS: Partial<Record<MatchKey, string[][]>> = {
  gender: [
    ['laki laki', 'laki', 'pria', 'male', 'man', 'l', 'm'],
    ['perempuan', 'wanita', 'female', 'woman', 'p', 'f'],
  ],
  educationLevel: [
    ['sma', 'smk', 'slta', 'ma', 'high school', 'senior high school', 'secondary school'],
    ['d3', 'diploma 3', 'diploma iii', 'diploma', 'associate', 'associate s degree', 'associate degree'],
    ['d4', 'diploma 4', 'sarjana terapan'],
    ['s1', 'sarjana', 'strata 1', 'bachelor', 'bachelor s degree', 'bachelor degree', 'bachelors', 'undergraduate'],
    ['s2', 'magister', 'strata 2', 'master', 'master s degree', 'master degree', 'masters', 'postgraduate'],
    ['s3', 'doktor', 'strata 3', 'doctor', 'doctorate', 'phd', 'doctoral'],
  ],
}

const MIN_PREFIX = 4

function hasPhrase(text: string, phrase: string): boolean {
  return phrase.length === 1 ? text === phrase : ` ${text} `.includes(` ${phrase} `)
}

// Returns the index of the option that best fits the value, or null when nothing does.
export function chooseOption(key: MatchKey, value: string, options: ChoiceOption[]): number | null {
  const wanted = normalize(value)
  if (!wanted || options.length === 0) return null
  const normalized = options.map((option) => ({ label: normalize(option.label), value: normalize(option.value) }))

  const exact = normalized.findIndex((o) => o.label === wanted || o.value === wanted)
  if (exact >= 0) return exact

  const group = SYNONYMS[key]?.find((words) => words.some((word) => hasPhrase(wanted, word)))
  if (group) {
    const same = normalized.findIndex((o) => group.includes(o.label) || group.includes(o.value))
    if (same >= 0) return same
    const loose = normalized.findIndex((o) => group.some((word) => hasPhrase(o.label, word)))
    if (loose >= 0) return loose
  }

  const near = normalized.findIndex(
    (o) =>
      hasPhrase(o.label, wanted) ||
      (wanted.length >= MIN_PREFIX && o.label.length >= MIN_PREFIX && (o.label.startsWith(wanted) || wanted.startsWith(o.label))),
  )
  return near >= 0 ? near : null
}
