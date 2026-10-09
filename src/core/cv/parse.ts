import { headingKind } from './headings'
import { findCity, isProvince } from './places'

export type Confidence = 'high' | 'low'
export type Detected = { value: string; confidence: Confidence }

export type CvDraft = {
  personal: Partial<Record<'firstName' | 'middleName' | 'lastName', Detected>>
  contact: Partial<Record<'email' | 'phone' | 'linkedin' | 'city', Detected>>
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
const PHONE = /(?<![\d+])\(?\+?\d[\d\s().-]{6,}\d(?!\d)/g
const LINKEDIN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_%.-]+/i
const CITY_LABEL = /^(?:kota|city|domisili|lokasi|location)\s*[:\-]\s*(.+)$/i
// Words that may stay lower-case inside a personal name.
const NAME_PARTICLES = new Set(['bin', 'binti', 'van', 'de', 'der', 'al', 'el', 'la', 'di', 'da', 'dos'])
const NOT_A_NAME = new Set(['curriculum vitae', 'resume', 'daftar riwayat hidup', 'riwayat hidup'])
const MAX_UNHEADED_LINES = 15

const high = (value: string): Detected => ({ value, confidence: 'high' })
const low = (value: string): Detected => ({ value, confidence: 'low' })

function readLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

// Everything above the first education or experience heading: where a CV states who the person is.
function headerOf(lines: string[]): string[] {
  const end = lines.findIndex((line) => {
    const kind = headingKind(line)
    return kind === 'education' || kind === 'experience'
  })
  return end === -1 ? lines.slice(0, MAX_UNHEADED_LINES) : lines.slice(0, end)
}

function detectEmail(lines: string[]): Detected | undefined {
  const found = lines.flatMap((line) => line.match(EMAIL) ?? [])
  const first = found[0]
  if (first === undefined) return undefined
  const distinct = new Set(found.map((email) => email.toLowerCase()))
  return distinct.size === 1 ? high(first) : low(first)
}

function detectPhone(lines: string[]): Detected | undefined {
  for (const line of lines) {
    for (const match of line.matchAll(PHONE)) {
      const raw = match[0].trim()
      const digits = raw.replace(/\D/g, '')
      const plausible = digits.length >= 9 && digits.length <= 15
      const startsLikePhone = raw.startsWith('+') || raw.startsWith('(+') || digits.startsWith('0') || digits.startsWith('62')
      if (plausible && startsLikePhone) return high(raw)
    }
  }
  return undefined
}

function detectLinkedin(lines: string[]): Detected | undefined {
  for (const [index, line] of lines.entries()) {
    const next = lines[index + 1]
    const wraps = /linkedin\.com\/in\//i.test(line) && line.endsWith('-') && next !== undefined
    const match = (wraps ? line + next : line).match(LINKEDIN)
    if (match) {
      const value = match[0].replace(/\.$/, '')
      return wraps ? low(value) : high(value)
    }
  }
  return undefined
}

function detectCity(header: string[]): Detected | undefined {
  for (const line of header) {
    const label = line.match(CITY_LABEL)?.[1]
    if (label) {
      const place = (label.split(',')[0] ?? '').trim()
      if (place) return high(findCity(place) ?? place)
    }
  }
  const segments = header.flatMap((line) => line.split(/[|•·]/u).map((part) => part.trim()))
  for (const segment of segments) {
    const known = findCity(segment.split(',')[0] ?? '')
    if (known && segment.length <= 40) return high(known)
  }
  for (const segment of segments) {
    const [place, region] = segment.split(',').map((part) => part.trim())
    if (place && region && isProvince(region) && /^\p{Lu}[\p{L} ]{1,30}$/u.test(place)) return low(place)
  }
  return undefined
}

const looksLikeNameWord = (word: string) => /^\p{Lu}[\p{L}'.-]*$/u.test(word) || NAME_PARTICLES.has(word)
const titleCase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()

// "BUDI SANTOSO, S.Kom." -> ["Budi", "Santoso"]; undefined when the line is not plausibly a name.
function nameWords(line: string): string[] | undefined {
  if (headingKind(line) || NOT_A_NAME.has(line.toLowerCase())) return undefined
  const beforeComma = (line.split(',')[0] ?? '').trim()
  if (/[\d@:|/]/.test(beforeComma) || beforeComma.length > 45) return undefined
  const words = beforeComma.split(/\s+/)
  if (words.length < 2 || words.length > 4 || !words.every(looksLikeNameWord)) return undefined
  return beforeComma === beforeComma.toUpperCase() ? words.map(titleCase) : words
}

function emailTokens(email: string | undefined): string[] {
  const local = (email ?? '').split('@')[0] ?? ''
  return local.toLowerCase().split(/[^a-z]+/).filter((token) => token.length >= 3)
}

function detectName(lines: string[], header: string[], email: string | undefined): CvDraft['personal'] {
  const tokens = emailTokens(email)
  const candidates = header.flatMap((line) => {
    const words = nameWords(line)
    return words ? [{ words, index: lines.indexOf(line) }] : []
  })
  const vouched = (words: string[]) => words.some((word) => tokens.includes(word.toLowerCase()))
  const chosen = candidates.find((c) => vouched(c.words)) ?? candidates[0]
  if (!chosen) return {}

  const make = chosen.index === 0 || vouched(chosen.words) ? high : low
  const first = chosen.words[0] as string
  const last = chosen.words[chosen.words.length - 1] as string
  const middle = chosen.words.slice(1, -1).join(' ')
  return {
    firstName: make(first),
    ...(middle ? { middleName: make(middle) } : {}),
    lastName: make(last),
  }
}

// Reads who the CV is about and how to reach them. Nothing is guessed silently:
// a value the rules are unsure of comes back with confidence "low".
export function parseCv(text: string): CvDraft {
  const lines = readLines(text)
  const header = headerOf(lines)
  const email = detectEmail(lines)
  const phone = detectPhone(lines)
  const linkedin = detectLinkedin(lines)
  const city = detectCity(header)

  return {
    personal: detectName(lines, header, email?.value),
    contact: {
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(linkedin ? { linkedin } : {}),
      ...(city ? { city } : {}),
    },
  }
}
