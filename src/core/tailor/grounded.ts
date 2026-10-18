import type { Profile } from '../profile/types'
import type { CvDocument, Grounding, TailorOutput, Violation } from './types'

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

// Joins the AI's wording with the Profile's facts. Job title, employer, school and dates come from the Profile only (D12).
// What the AI left empty falls back to the Profile as written, so a weak answer never yields an empty CV.
export function assemble(profile: Profile, output: TailorOutput): CvDocument {
  const skillByKey = new Map(profile.skills.map((s) => [squash(s.name), s.name]))
  const chosenSkills = [...new Set(output.skills.map((s) => skillByKey.get(squash(String(s)))).filter((s): s is string => s !== undefined))]

  const experienceById = new Map(profile.experience.map((e) => [e.id, e]))
  const chosen = output.experience.filter((item) => experienceById.has(item.sourceId))
  const picked = chosen.length > 0 ? chosen : profile.experience.map((e) => ({ sourceId: e.id, bullets: [] as string[] }))
  const seen = new Set<string>()
  const experience: CvDocument['experience'] = []
  for (const item of picked) {
    const source = experienceById.get(item.sourceId)
    if (!source || seen.has(item.sourceId)) continue
    seen.add(item.sourceId)
    const bullets = item.bullets.map((b) => b.trim()).filter((b) => b !== '')
    experience.push({
      sourceId: source.id, title: source.title, company: source.company, location: (source.location ?? '').trim(), start: source.start, end: source.end, current: source.current,
      bullets: bullets.length > 0 ? bullets : bulletsFromDescription(source.description),
    })
  }

  const educationById = new Map(profile.education.map((e) => [e.id, e]))
  const pickedEducation = [...new Set(output.education)].map((id) => educationById.get(id)).filter((e) => e !== undefined)
  const education = (pickedEducation.length > 0 ? pickedEducation : profile.education).map((e) => ({
    id: e.id, institution: e.institution, location: (e.location ?? '').trim(), level: e.level, major: e.major, gpa: e.gpa, year: e.year,
    publication: (e.publication ?? '').trim(), achievements: lines(e.achievements),
  }))

  const { personal, contact } = profile
  return {
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
