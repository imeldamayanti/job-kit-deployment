import { formatPeriod } from './format'
import { CV_LABELS, type Lang } from './language'
import type { CvDocument } from './types'

// The one CV template (FR-42), as data: where each line goes on each A4 page. Pure, so it is tested without a PDF;
// `platform/cv-pdf.ts` draws these operations with pdf-lib. Coordinates are points from the bottom left, as in PDF.
export const A4 = { width: 595.28, height: 841.89, margin: 51 } as const

export type PdfOp =
  | { kind: 'text'; text: string; x: number; y: number; size: number; bold: boolean; gray: number }
  | { kind: 'rule'; x1: number; x2: number; y: number }

// Width of a text in points. The real one comes from the font; tests pass a simple one.
export type Measure = (text: string, bold: boolean, size: number) => number

const LINE = 1.4
const INK = 0.07
const QUIET = 0.27
const INDENT = 14

// A line is cut at spaces; a word wider than the line is cut inside the word, so nothing runs past the margin.
function wrap(text: string, bold: boolean, size: number, width: number, measure: Measure): string[] {
  const lines: string[] = []
  let line = ''
  const push = () => {
    if (line !== '') lines.push(line)
    line = ''
  }
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    const joined = line === '' ? word : `${line} ${word}`
    if (measure(joined, bold, size) <= width) {
      line = joined
      continue
    }
    push()
    let rest = word
    while (measure(rest, bold, size) > width && rest.length > 1) {
      let cut = rest.length - 1
      while (cut > 1 && measure(rest.slice(0, cut), bold, size) > width) cut -= 1
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    line = rest
  }
  push()
  return lines
}

export function layoutCv(doc: CvDocument, lang: Lang, measure: Measure): PdfOp[][] {
  const labels = CV_LABELS[lang]
  const pages: PdfOp[][] = [[]]
  const top = A4.height - A4.margin
  const full = A4.width - 2 * A4.margin
  let y = top

  const room = (height: number) => y - height >= A4.margin
  // A block that must not be split from what follows (a heading, a job's title): start a page if it does not all fit.
  const keep = (height: number) => {
    if (!room(height) && y !== top) {
      pages.push([])
      y = top
    }
  }
  const lineHeight = (size: number) => size * LINE
  const draw = (text: string, bold: boolean, size: number, x: number, gray = INK) => {
    keep(lineHeight(size))
    y -= lineHeight(size)
    pages.at(-1)!.push({ kind: 'text', text, x, y, size, bold, gray })
  }
  const paragraph = (text: string, { bold = false, size = 10, x = A4.margin, gray = INK } = {}) => {
    for (const line of wrap(text, bold, size, A4.width - A4.margin - x, measure)) draw(line, bold, size, x, gray)
  }
  const rule = () => {
    y -= 3
    pages.at(-1)!.push({ kind: 'rule', x1: A4.margin, x2: A4.width - A4.margin, y })
    y -= 4
  }
  // The title of a section stays with the first thing under it.
  const section = (title: string, firstBlock: number) => {
    keep(6 + lineHeight(11) + 7 + firstBlock)
    y -= 6
    draw(title.toUpperCase(), true, 11, A4.margin)
    rule()
  }

  paragraph(doc.header.name, { bold: true, size: 20 })
  if (doc.header.contacts.length > 0) paragraph(doc.header.contacts.join(' · '), { size: 9.5, gray: QUIET })
  y -= 6

  if (doc.skills.length > 0) {
    section(labels.skills, lineHeight(10))
    paragraph(doc.skills.join(', '))
  }

  if (doc.experience.length > 0) {
    section(labels.experience, lineHeight(10.5) + lineHeight(9) + lineHeight(10))
    for (const job of doc.experience) {
      keep(lineHeight(10.5) + lineHeight(9) + lineHeight(10))
      paragraph(job.title, { bold: true, size: 10.5 })
      const meta = [job.company, formatPeriod(job.start, job.end, job.current, lang)].filter((part) => part !== '').join(' · ')
      if (meta !== '') paragraph(meta, { size: 9, gray: QUIET })
      for (const bullet of job.bullets) {
        const lines = wrap(bullet, false, 10, full - INDENT, measure)
        keep(lineHeight(10) * Math.min(lines.length, 2))
        lines.forEach((line, index) => {
          draw(line, false, 10, A4.margin + INDENT)
          if (index === 0) pages.at(-1)!.push({ kind: 'text', text: '•', x: A4.margin + 3, y, size: 10, bold: false, gray: INK })
        })
      }
      y -= 4
    }
  }

  if (doc.education.length > 0) {
    section(labels.education, lineHeight(10.5) + lineHeight(9))
    for (const school of doc.education) {
      keep(lineHeight(10.5) + lineHeight(9))
      const title = [school.level, school.major].filter((part) => part !== '').join(' ')
      if (title !== '') paragraph(title, { bold: true, size: 10.5 })
      const meta = [school.institution, school.year].filter((part) => part !== '').join(' · ')
      if (meta !== '') paragraph(meta, { size: 9, gray: QUIET })
    }
  }
  return pages
}

// --- what the standard PDF fonts can write -------------------------------------------------------------------------

// Windows-1252 beyond Latin-1: the dashes, quotes, bullet and a few letters that are common in text.
const CP1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

const isWinAnsi = (ch: string) => {
  const code = ch.codePointAt(0) ?? 0
  return ch === '\n' || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.has(ch)
}
const isControl = (ch: string) => {
  const code = ch.codePointAt(0) ?? 0
  return (code < 0x20 && ch !== '\n') || (code >= 0x7f && code < 0xa0)
}

// The fonts built into every PDF viewer write only these characters, so the CV needs no font file. A letter with an
// accent they lack becomes its plain letter; a letter of another script becomes "?". `replaced` says which, so the
// person can be told.
export function toWinAnsi(text: string): { text: string; replaced: string[] } {
  const replaced: string[] = []
  let out = ''
  for (const ch of text) {
    if (isWinAnsi(ch)) {
      out += ch
      continue
    }
    if (isControl(ch)) continue
    const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
    out += plain !== '' && [...plain].every(isWinAnsi) ? plain : '?'
    if (!replaced.includes(ch)) replaced.push(ch)
  }
  return { text: out, replaced }
}

export function winAnsiDocument(doc: CvDocument): { doc: CvDocument; replaced: string[] } {
  const replaced: string[] = []
  const clean = (text: string) => {
    const result = toWinAnsi(text)
    for (const ch of result.replaced) if (!replaced.includes(ch)) replaced.push(ch)
    return result.text
  }
  const next: CvDocument = {
    header: { name: clean(doc.header.name), contacts: doc.header.contacts.map(clean) },
    skills: doc.skills.map(clean),
    experience: doc.experience.map((e) => ({
      sourceId: e.sourceId, title: clean(e.title), company: clean(e.company), start: clean(e.start), end: clean(e.end), current: e.current, bullets: e.bullets.map(clean),
    })),
    education: doc.education.map((e) => ({ id: e.id, institution: clean(e.institution), level: clean(e.level), major: clean(e.major), gpa: clean(e.gpa), year: clean(e.year) })),
  }
  return { doc: next, replaced }
}

// "CV-{perusahaan}.pdf" (FR-42): letters and digits only, accents turned into plain letters, runs of anything else one dash.
const MAX_NAME = 56
export function cvFileName(company: string): string {
  const base = company
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME)
    .replace(/-+$/g, '')
  return base === '' ? 'CV.pdf' : `CV-${base}.pdf`
}

// What to tell the person after a download in which some characters had to be replaced; nothing when none were.
export const describeReplaced = (replaced: string[]): string | null =>
  replaced.length === 0 ? null : `Huruf yang tidak ada di font PDF standar diganti: ${replaced.join(', ')}. Periksa hasilnya sebelum dikirim.`
