import type { Profile } from '../profile/types'
import { DEFAULT_CV_ORDER, type CvDocument, type CvOrder, type Grounding, type TailorOutput, type Violation } from './types'

// FR-40: nothing in a CV or letter may be absent from the Profile. The checks are mechanical, so they
// catch an invented skill, number or technical term, not a stretched claim such as "memimpin tim"
// (RFC D12): that is left to the side-by-side diff (FR-41) and the `edited` mark.

const LEXICON = new Set(
  ('kubernetes docker aws gcp azure kotlin swift java python typescript javascript react vue angular svelte node nodejs sql postgres postgresql mysql mongodb redis ' +
    'graphql terraform jenkins tableau powerbi excel pandas spark hadoop tensorflow pytorch linux git github jira figma agile scrum android ios flutter django flask ' +
    'laravel spring golang rust php ruby rails kafka rabbitmq elasticsearch nginx ansible helm prometheus grafana datadog sentry firebase supabase oauth jest cypress ' +
    'playwright selenium webpack vite nextjs redux tailwind sass bigquery snowflake airflow dbt looker numpy scikitlearn sklearn cisco vmware citrix okta ' +
    'intune sccm powershell bash vpn dns dhcp activedirectory').split(/\s+/),
)
const NOT_TECHNICAL = new Set(['i', 'a', 'cv', 'ui', 'ux', 'id', 'it', 'ok'])

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "1,5" and "1.5" are one number; "1.500" and "1.500.000" are thousands (Indonesian format); "1.234,56" has its decimal at the comma.
function canonicalNumber(raw: string): string {
  let text = raw
  const hasDot = text.includes('.')
  const hasComma = text.includes(',')
  if (hasDot && hasComma) {
    const decimalAt = Math.max(text.lastIndexOf('.'), text.lastIndexOf(','))
    text = `${text.slice(0, decimalAt).replace(/[.,]/g, '')}.${text.slice(decimalAt + 1)}`
  } else if (/^[1-9]\d{0,2}([.,]\d{3})+$/.test(text)) {
    text = text.replace(/[.,]/g, '')
  } else {
    text = text.replace(',', '.')
  }
  return /^\d{1,15}(\.\d+)?$/.test(text) ? String(Number(text)) : text
}

const numbersIn = (text: string): string[] => [...text.matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => canonicalNumber(m[0]))
export const wordsIn = (text: string): string[] => [...text.matchAll(/[A-Za-z][A-Za-z0-9.+#/-]*[A-Za-z0-9+#]|[A-Za-z]/g)].map((m) => m[0])
// Node.js, nodejs and NODE.JS are one word; REST-API and REST API are two words either way.
export const keyOf = (word: string) => word.toLowerCase().replace(/[.\-/]/g, '')

// A word is a technical term when it is in the lexicon, camelCase, ALLCAPS (2+), has a dot or a digit inside, or ends in + or #.
export function isTechnical(word: string): boolean {
  const key = keyOf(word)
  if (NOT_TECHNICAL.has(key)) return false
  return LEXICON.has(key) || /[a-z][A-Z]/.test(word) || /^[A-Z]{2,}$/.test(word) || /[A-Za-z]\.[A-Za-z]/.test(word) || /[A-Za-z]\d|\d[A-Za-z]/.test(word) || /[+#]$/.test(word)
}

// What the Profile calls things: skills, employers, schools, titles. After restore() these names sit in the text
// again, and their digits and capitals ("PT", "Microsoft 365", "S1") are not claims to check.
function ownNames(profile: Profile): string[] {
  const names = [
    ...profile.skills.map((s) => s.name),
    ...profile.experience.flatMap((e) => [e.company, e.title]),
    ...profile.education.flatMap((e) => [e.institution, e.level, e.major]),
  ]
  return [...new Set(names.map((n) => n.trim()).filter((n) => n !== ''))].sort((a, b) => b.length - a.length)
}

function withoutNames(text: string, names: string[]): string {
  let out = text
  for (const name of names) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'giu'), ' ')
  return out
}

// Numbers and technical terms in `text` that `sourceText` and the Profile's skills do not contain. Shared with the cover letter (T51).
export function checkText(text: string, sourceText: string, profile: Profile, where: string): Violation[] {
  const violations: Violation[] = []
  const claim = withoutNames(text, ownNames(profile))
  const allowedNumbers = new Set(numbersIn(sourceText))
  for (const number of new Set(numbersIn(claim))) if (!allowedNumbers.has(number)) violations.push({ type: 'number', value: number, where })
  const allowedWords = new Set(wordsIn(`${sourceText} ${profile.skills.map((s) => s.name).join(' ')}`).map(keyOf))
  const reported = new Set<string>()
  for (const word of wordsIn(claim)) {
    const key = keyOf(word)
    if (reported.has(key) || !isTechnical(word) || allowedWords.has(key)) continue
    reported.add(key)
    violations.push({ type: 'term', value: word.toLowerCase().replace(/\.$/, ''), where })
  }
  return violations
}

const squash = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()

// A bad answer is rejected whole, never repaired: the person sees why and nothing half-true is saved.
export function validateGrounded(output: TailorOutput, profile: Profile): Grounding {
  const violations: Violation[] = []
  const skillNames = new Set(profile.skills.map((s) => squash(s.name)))
  for (const skill of output.skills) if (!skillNames.has(squash(String(skill)))) violations.push({ type: 'skill', value: String(skill).trim(), where: 'skills' })

  const experience = new Map(profile.experience.map((e) => [e.id, e]))
  const seen = new Set<string>()
  for (const item of output.experience) {
    const source = experience.get(item.sourceId)
    const repeated = seen.has(item.sourceId)
    seen.add(item.sourceId)
    if (!source || repeated) {
      violations.push({ type: 'source', value: item.sourceId, where: 'experience' })
      continue
    }
    item.bullets.forEach((bullet, index) => violations.push(...checkText(bullet, source.description, profile, `${item.sourceId}#${index + 1}`)))
  }

  const education = new Set(profile.education.map((e) => e.id))
  const seenEducation = new Set<string>()
  for (const id of output.education) {
    if (!education.has(id) || seenEducation.has(id)) violations.push({ type: 'source', value: id, where: 'education' })
    seenEducation.add(id)
  }
  return { ok: violations.length === 0, violations }
}

export function violationMessage(violation: Violation): string {
  switch (violation.type) {
    case 'skill':
      return `Skill "${violation.value}" tidak ada di Profile.`
    case 'source':
      return `Pengalaman atau pendidikan "${violation.value}" tidak ada di Profile atau ganda.`
    case 'number':
      return `Angka "${violation.value}" tidak ada di pengalaman asalnya.`
    case 'term':
      return `Istilah "${violation.value}" tidak ada di pengalaman asalnya maupun daftar skill.`
  }
}

// A description as bullets, for when the AI returns none (small models do, T45). One sentence or line each.
export function bulletsFromDescription(description: string): string[] {
  return description
    .split(/\n+/)
    .flatMap((line) => line.replace(/^\s*[-•*]\s*/, '').split(/(?<=[.!?])\s+/))
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

const lines = (text: string | undefined) => (text ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '')

// "2025-04" as a month number; a bare year too. Anything else is null: a date is never guessed.
function monthOf(value: string): number | null {
  const month = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (month) return Number(month[1]) * 12 + Number(month[2]) - 1
  const year = /^\d{4}$/.exec(value.trim())
  return year ? Number(year[0]) * 12 : null
}

const wordsOf = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []

// Brings `bullets` up to `target` with facts from the Profile that the bullets do not already say. A fact counts as said
// when most of its longer words already appear in the AI's bullets, so a reworded bullet is not repeated beside its source.
function topUp(bullets: string[], facts: string[], target: number): string[] {
  if (bullets.length >= target) return bullets
  const said = new Set(bullets.flatMap(wordsOf))
  const unsaid = facts.filter((fact) => {
    const words = wordsOf(fact)
    return words.length === 0 || words.filter((word) => said.has(word)).length / words.length < 0.6
  })
  return [...bullets, ...unsaid].slice(0, target)
}

// The jobs the person still holds (no end date, marked as current) come first; then the rest, by when each started.
// Within each group the newest start is on top, the way the person's own CV lists them, and a tie goes to the later
// end. When a start date cannot be read the Profile's own order is kept, because a guess could put the wrong job on top.
function newestFirst<T extends { start: string; end: string; current: boolean }>(jobs: readonly T[]): T[] {
  const keyed = jobs.map((job, index) => ({
    job, index, held: job.current ? 1 : 0, start: monthOf(job.start), end: job.current ? Number.MAX_SAFE_INTEGER : (monthOf(job.end) ?? 0),
  }))
  if (keyed.some((k) => k.start === null)) return [...jobs]
  return keyed.sort((a, b) => b.held - a.held || (b.start as number) - (a.start as number) || b.end - a.end || a.index - b.index).map((k) => k.job)
}

// Joins the AI's wording with the Profile's facts. Job title, employer, school and dates come from the Profile only (D12).
// What the AI left empty falls back to the Profile as written, so a weak answer never yields an empty CV.
export function assemble(profile: Profile, output: TailorOutput, order: CvOrder = DEFAULT_CV_ORDER): CvDocument {
  const skillByKey = new Map(profile.skills.map((s) => [squash(s.name), s.name]))
  const chosenSkills = [...new Set(output.skills.map((s) => skillByKey.get(squash(String(s)))).filter((s): s is string => s !== undefined))]

  const experienceById = new Map(profile.experience.map((e) => [e.id, e]))
  // The AI supplies only the wording of each job. Which jobs there are and in what order is the Profile's, so no
  // experience is dropped and none is moved: newest first by date, whatever order the AI listed them in.
  const written = new Map<string, string[]>()
  for (const item of output.experience) {
    if (experienceById.has(item.sourceId) && !written.has(item.sourceId)) written.set(item.sourceId, item.bullets.map((b) => b.trim()).filter((b) => b !== ''))
  }
  const entryOf = (source: Profile['experience'][number], bullets: string[]): CvDocument['experience'][number] => ({
    sourceId: source.id, title: source.title, company: source.company, location: (source.location ?? '').trim(), start: source.start, end: source.end, current: source.current, bullets,
  })
  const experience = newestFirst(profile.experience).map((source) => {
    const bullets = written.get(source.id) ?? []
    const fromProfile = bulletsFromDescription(source.description)
    // Every job keeps three bullets so the CV looks even: when the AI wrote fewer, the Profile's own facts that its
    // bullets do not already carry fill the gap. Never more than the Profile has.
    if (bullets.length > 0) return entryOf(source, topUp(bullets, fromProfile, Math.min(3, fromProfile.length)))
    // What the AI left empty falls back to the Profile as written. A job the AI left out of a real answer gets at most
    // 3 bullets, like the AI's own.
    return entryOf(source, !written.has(source.id) && written.size > 0 ? fromProfile.slice(0, 3) : fromProfile)
  })

  const educationById = new Map(profile.education.map((e) => [e.id, e]))
  const pickedEducation = [...new Set(output.education)].map((id) => educationById.get(id)).filter((e) => e !== undefined)
  const education = (pickedEducation.length > 0 ? pickedEducation : profile.education).map((e) => ({
    id: e.id, institution: e.institution, location: (e.location ?? '').trim(), level: e.level, major: e.major, gpa: e.gpa, year: e.year,
    publication: (e.publication ?? '').trim(), achievements: lines(e.achievements),
  }))

  const { personal, contact } = profile
  const certifications = profile.custom
    .filter((field) => /^(certifications?|sertifikasi|sertifikat)$/i.test(field.key.trim()) && field.value.trim() !== '')
    .map((field) => field.value.trim())
  return {
    order,
    certifications,
    header: {
      name: [personal.firstName, personal.middleName, personal.lastName].map((p) => p.trim()).filter((p) => p !== '').join(' '),
      contacts: [contact.phone, contact.email, contact.linkedin, contact.website, contact.city].map((c) => c.trim()).filter((c) => c !== ''),
    },
    summary: (profile.summary ?? '').trim(),
    skills: chosenSkills.length > 0 ? chosenSkills : profile.skills.map((s) => s.name),
    experience,
    education,
    projects: (profile.projects ?? [])
      .filter((p) => p.name.trim() !== '')
      .map((p) => ({ id: p.id, name: p.name.trim(), role: p.role.trim(), date: p.date.trim(), bullets: lines(p.description) })),
  }
}
