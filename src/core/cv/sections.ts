import { headingKind } from './headings'
import type { Detected, EducationEntry, ExperienceEntry, UnparsedBlock } from './types'

const high = (value: string): Detected => ({ value, confidence: 'high' })
const low = (value: string): Detected => ({ value, confidence: 'low' })

const MONTH =
  'januari|january|jan|februari|february|feb|maret|march|mar|april|apr|mei|may|juni|june|jun|juli|july|jul|agustus|august|agu|aug|agt|september|sept|sep|oktober|october|okt|oct|november|nopember|nov|nop|desember|december|des|dec'
const DATE = `(?:(?:${MONTH})\\.?\\s+)?(?:19|20)\\d{2}|\\d{1,2}[/.]\\s*(?:19|20)\\d{2}|(?:19|20)\\d{2}[-/]\\d{1,2}`
const PRESENT =
  'sampai\\s+sekarang|sampai\\s+saat\\s+ini|hingga\\s+saat\\s+ini|hingga\\s+sekarang|saat\\s+ini|sekarang|kini|present|current|ongoing|now'
const SEPARATOR = '\\s*[-–—]\\s*|\\s+(?:to|sampai|s/d|s\\.d\\.|hingga|until)\\s+'
const PERIOD = new RegExp(`(${DATE})(?:${SEPARATOR})(${DATE}|${PRESENT})`, 'i')
const YEAR = /(?:19|20)\d{2}/
const YEAR_ONLY = /^(?:lulus\s+)?((?:19|20)\d{2})$/i

const INSTITUTION =
  /\b(?:universitas|university|universiti|institut|institute|politeknik|polytechnic|sekolah|akademi|academy|college|school|sma|smk|smp|stmik|stikom|stie)\b/i
const LEVEL =
  /^(S1|S2|S3|D1|D2|D3|D4|SMA|SMK|SMP|Diploma|Bachelor|Master|Doctorate|Doctor|PhD|Sarjana|Magister|Doktor|Associate)(?:['’]s)?\b\.?\s*/i
const GPA = /\b(?:IPK|GPA|IP)\s*[:=]?\s*(\d[.,]\d{1,2})(?:\s*\/\s*4(?:[.,]0+)?)?/i
const MAJOR_PREFIX = /^(?:jurusan|program studi|prodi|major|field of study)\s*[:-]?\s*/i
const COMPANY_MARKER =
  /\b(?:PT|CV|UD|Tbk|Persero|Ltd|Limited|Inc|Corp|Corporation|LLC|Co|Company|Group|Studio|Labs|Bank|Agency|Foundation|Yayasan)\b\.?/i
const BULLET = /^(?:[•·▪●◦]\s*|[-*]\s+)/u
const EDGE_SEPARATORS = /^[\s,|–—-]+|[\s,|–—-]+$/gu
const MAX_HEADER_LENGTH = 80

type Block = { kind: 'education' | 'experience'; lines: string[] }
export type ParsedSections = { education: EducationEntry[]; experience: ExperienceEntry[]; unparsed: UnparsedBlock[] }

function splitBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let current: Block | undefined
  for (const line of lines) {
    const kind = headingKind(line)
    if (kind !== undefined) {
      current = kind === 'education' || kind === 'experience' ? { kind, lines: [] } : undefined
      if (current) blocks.push(current)
    } else {
      current?.lines.push(line)
    }
  }
  return blocks
}

const clean = (text: string) => text.replace(/\s+/g, ' ').replace(EDGE_SEPARATORS, '')
// An end date with no year in it is a word like "Sekarang" or "Present".
const isCurrent = (end: string) => !YEAR.test(end)
const yearOfEnd = (end: string) => (isCurrent(end) ? undefined : end.match(YEAR)?.[0])

// ---- education ----

const isInstitutionLine = (line: string) =>
  INSTITUTION.test(line) && line.length <= MAX_HEADER_LENGTH && !line.endsWith('.')

function readEducation(chunk: string[], hasInstitution = true): { entry: EducationEntry; leftover: string[] } {
  const [firstRaw = '', ...rest] = hasInstitution ? chunk : ['', ...chunk]
  let year: string | undefined
  let gpa: string | undefined
  let level: string | undefined
  let major: Detected | undefined
  const leftover: string[] = []

  const firstPeriod = firstRaw.match(PERIOD)
  if (firstPeriod) year = yearOfEnd(firstPeriod[2] ?? '')
  const parts = firstRaw
    .replace(PERIOD, '')
    .split(/\s*[,|]\s*|\s+[-–—]\s+/)
    .map(clean)
    .filter(Boolean)
  const institutionIndex = Math.max(0, parts.findIndex((part) => INSTITUTION.test(part)))
  const institution = hasInstitution ? (parts[institutionIndex] ?? clean(firstRaw)) : ''
  const details = [...parts.filter((_, index) => index !== institutionIndex), ...rest]

  for (const raw of details) {
    let text = raw.replace(BULLET, '')
    const period = text.match(PERIOD)
    if (period) {
      year = yearOfEnd(period[2] ?? '')
      text = text.replace(PERIOD, '')
    } else if (YEAR_ONLY.test(text.trim())) {
      year = text.trim().match(YEAR)?.[0]
      text = ''
    }
    const gpaMatch = text.match(GPA)
    if (gpaMatch) {
      gpa = gpaMatch[1]
      text = text.replace(GPA, '')
    }
    for (const segment of text.split(',').map(clean).filter(Boolean)) {
      const levelMatch = segment.match(LEVEL)
      if (levelMatch && level === undefined) {
        level = levelMatch[1]
        const remainder = clean(segment.slice(levelMatch[0].length).replace(/^(?:of|in|di|dari)\s+/i, ''))
        if (remainder && !major) major = high(remainder.replace(MAJOR_PREFIX, ''))
      } else if (!major) {
        major = low(segment.replace(MAJOR_PREFIX, ''))
      } else {
        leftover.push(segment)
      }
    }
  }

  const schoolLevel = institution.match(/^(SMA|SMK|SMP)\b/i)?.[1]
  const entry: EducationEntry = institution ? { institution: high(institution) } : {}
  const finalLevel = level ?? schoolLevel
  if (finalLevel) entry.level = high(finalLevel)
  if (major) entry.major = major
  if (gpa) entry.gpa = high(gpa)
  if (year) entry.year = high(year)
  return { entry, leftover }
}

function parseEducation(lines: string[]): { entries: EducationEntry[]; unparsed: string[] } {
  const starts = lines.flatMap((line, index) => (isInstitutionLine(line) ? [index] : []))
  const first = starts[0]
  if (first === undefined) {
    // No institution line: a degree line such as "Bachelor of Informatics" still opens an entry.
    const degrees = lines.flatMap((line, index) => (LEVEL.test(line) && !BULLET.test(line) ? [index] : []))
    const head = degrees[0]
    if (head === undefined) return { entries: [], unparsed: lines.length > 0 ? [lines.join('\n')] : [] }
    const found = degrees.map((start, index) => readEducation(lines.slice(start, degrees[index + 1] ?? lines.length), false))
    const lead = head > 0 ? [lines.slice(0, head).join('\n')] : []
    return { entries: found.map((item) => item.entry), unparsed: [...lead, ...found.flatMap((item) => (item.leftover.length > 0 ? [item.leftover.join('\n')] : []))] }
  }

  const unparsed: string[] = first > 0 ? [lines.slice(0, first).join('\n')] : []
  const entries: EducationEntry[] = []
  starts.forEach((start, index) => {
    const { entry, leftover } = readEducation(lines.slice(start, starts[index + 1] ?? lines.length))
    entries.push(entry)
    if (leftover.length > 0) unparsed.push(leftover.join('\n'))
  })
  return { entries, unparsed }
}

// ---- experience ----

const hasMarker = (text: string) => COMPANY_MARKER.test(text)
const isHeaderLike = (line: string) =>
  line.length <= MAX_HEADER_LENGTH && !line.endsWith('.') && !BULLET.test(line) && !headingKind(line) && !PERIOD.test(line)

function splitSegments(line: string): string[] {
  const separator = line.includes('|')
    ? /\|/
    : /\s+[–—-]\s+/.test(line)
      ? /\s+[–—-]\s+/
      : /\s+(?:@|at)\s+/i.test(line)
        ? /\s+(?:@|at)\s+/i
        : /,/
  return line.split(separator).map(clean).filter(Boolean)
}

function readHeader(headerLines: string[]): Pick<ExperienceEntry, 'title' | 'company'> | undefined {
  if (headerLines.length === 1) {
    const [a, b] = splitSegments(headerLines[0] as string)
    if (a !== undefined && b !== undefined) {
      return hasMarker(a) && !hasMarker(b) ? { company: high(a), title: high(b) } : { title: high(a), company: high(b) }
    }
    return a !== undefined && hasMarker(a) ? { company: high(a) } : undefined
  }
  if (headerLines.length === 2) {
    const [a, b] = headerLines as [string, string]
    if (hasMarker(a) !== hasMarker(b)) {
      return hasMarker(a) ? { company: high(a), title: high(b) } : { title: high(a), company: high(b) }
    }
    return { title: low(a), company: low(b) }
  }
  return undefined
}

function joinDescription(lines: string[]): string {
  return lines
    .map((line) => line.replace(BULLET, '').trim())
    .filter(Boolean)
    .join('\n')
}

// CVs without dates: a short title line followed by bullet lines is one entry.
function parseUndated(lines: string[]): { entries: ExperienceEntry[]; unparsed: string[] } {
  const starts = lines.flatMap((line, index) => (isHeaderLike(line) && BULLET.test(lines[index + 1] ?? '') ? [index] : []))
  const head = starts[0]
  if (head === undefined) return { entries: [], unparsed: lines.length > 0 ? [lines.join('\n')] : [] }
  const entries = starts.map((start, index): ExperienceEntry => {
    const description = joinDescription(lines.slice(start + 1, starts[index + 1] ?? lines.length))
    const entry: ExperienceEntry = { title: low(clean(lines[start] as string)), current: false }
    if (description) entry.description = high(description)
    return entry
  })
  return { entries, unparsed: head > 0 ? [lines.slice(0, head).join('\n')] : [] }
}

type Anchor = { index: number; start: string; end: string; inline: string }

function parseExperience(lines: string[]): { entries: ExperienceEntry[]; unparsed: string[] } {
  const anchors: Anchor[] = lines.flatMap((line, index) => {
    const match = line.match(PERIOD)
    if (!match) return []
    return [{ index, start: clean(match[1] ?? ''), end: clean(match[2] ?? ''), inline: clean(line.replace(PERIOD, '')) }]
  })
  const first = anchors[0]
  if (first === undefined) return parseUndated(lines)

  // Each period anchors one entry. Its heading lines sit above the period, or below it when the CV
  // opens every entry with the period; `from` is where the entry's own lines begin.
  const periodFirst = first.index === 0 && first.inline === ''
  const spans = anchors.map((anchor, k) => {
    const previous = anchors[k - 1]
    const next = anchors[k + 1]
    if (anchor.inline) return { from: anchor.index, headerEnd: anchor.index + 1, headerLines: [anchor.inline] }
    if (periodFirst) {
      let end = anchor.index + 1
      while (end < (next?.index ?? lines.length) && end - anchor.index <= 2 && isHeaderLike(lines[end] as string)) end += 1
      return { from: anchor.index, headerEnd: end, headerLines: lines.slice(anchor.index + 1, end) }
    }
    let from = anchor.index
    while (from > (previous?.index ?? -1) + 1 && anchor.index - from < 2 && isHeaderLike(lines[from - 1] as string)) from -= 1
    return { from, headerEnd: anchor.index + 1, headerLines: lines.slice(from, anchor.index) }
  })

  const entries: ExperienceEntry[] = []
  const unparsed: string[] = []
  const lead = spans[0]?.from ?? 0
  if (lead > 0) unparsed.push(lines.slice(0, lead).join('\n'))

  anchors.forEach((anchor, k) => {
    const span = spans[k] as (typeof spans)[number]
    const nextFrom = spans[k + 1]?.from ?? lines.length
    const header = readHeader(span.headerLines)
    if (!header) {
      unparsed.push(lines.slice(span.from, nextFrom).join('\n'))
      return
    }
    const current = isCurrent(anchor.end)
    const description = joinDescription(lines.slice(span.headerEnd, nextFrom))
    const entry: ExperienceEntry = { ...header, start: high(anchor.start), current }
    if (!current) entry.end = high(anchor.end)
    if (description) entry.description = high(description)
    entries.push(entry)
  })
  return { entries, unparsed }
}

// Reads the education and work-experience sections. What it cannot place comes back as raw text.
export function parseSections(lines: string[]): ParsedSections {
  const result: ParsedSections = { education: [], experience: [], unparsed: [] }
  for (const block of splitBlocks(lines)) {
    if (block.kind === 'education') {
      const { entries, unparsed } = parseEducation(block.lines)
      result.education.push(...entries)
      result.unparsed.push(...unparsed.map((text) => ({ kind: 'education' as const, text })))
    } else {
      const { entries, unparsed } = parseExperience(block.lines)
      result.experience.push(...entries)
      result.unparsed.push(...unparsed.map((text) => ({ kind: 'experience' as const, text })))
    }
  }
  return result
}
