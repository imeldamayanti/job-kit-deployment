import { isTechnical, keyOf, wordsIn } from './grounded'
import type { CvDocument } from './types'

export type Coverage = { required: string[]; covered: string[]; missing: string[] }

// Words too common to show that a requirement is met (Indonesian and English).
const COMMON = new Set(
  ('yang dengan untuk dalam pada dari atau serta dapat dalam memiliki mampu minimal pengalaman kemampuan bekerja ' +
    'with and for the that this have has experience ability years year work working strong good knowledge understanding skills skill using used build building ' +
    'plus including related relevant least within across ensure').split(/\s+/),
)
const MIN_CONTENT_WORDS = 2
const MIN_SHARE = 0.7

// What the CV says about the person: skills, bullets, titles and field of study. A requirement's own words never count.
function cvWords(cv: CvDocument): Set<string> {
  const text = [
    ...cv.skills,
    ...cv.experience.flatMap((e) => [e.title, ...e.bullets]),
    ...cv.education.flatMap((e) => [e.major, e.level]),
  ].join(' ')
  return new Set(wordsIn(text).map(keyOf))
}

const same = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()

// A requirement with a technical term is covered only when the CV backs every such term. One without (a soft skill, a
// duty) is covered when most of its content words are in the CV, or when the model says so: a posting in English and
// a CV in Indonesian share no words, so without the claim every such requirement would read as missing (T48 real run).
// A claim cannot cover a technical term the CV lacks. It stays a claim about meaning that no check can verify, so the
// person reads the CV beside the original (FR-41). The rule otherwise leans toward "missing" (FR-39).
export function coverage(requirements: string[], cv: CvDocument, claimed: string[] = []): Coverage {
  const have = cvWords(cv)
  const claims = new Set(claimed.map(same))
  const seen = new Set<string>()
  const required: string[] = []
  for (const raw of requirements) {
    const requirement = raw.trim()
    const key = requirement.toLowerCase()
    if (requirement === '' || seen.has(key)) continue
    seen.add(key)
    required.push(requirement)
  }

  const covered: string[] = []
  const missing: string[] = []
  for (const requirement of required) {
    const words = wordsIn(requirement)
    const technical = words.filter(isTechnical)
    let met: boolean
    if (technical.length > 0) {
      met = technical.every((word) => have.has(keyOf(word)))
    } else {
      const content = [...new Set(words.map(keyOf).filter((word) => word.length >= 5 && !COMMON.has(word)))]
      met =
        claims.has(same(requirement)) ||
        (content.length >= MIN_CONTENT_WORDS && content.filter((word) => have.has(word)).length / content.length >= MIN_SHARE)
    }
    ;(met ? covered : missing).push(requirement)
  }
  return { required, covered, missing }
}
