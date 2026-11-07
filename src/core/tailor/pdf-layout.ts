import { formatPeriod } from './format'
import { CV_LABELS, type Lang } from './language'
import { cvSections, type CvDocument } from './types'

// The one CV template (FR-42), as data: where each line goes on each A4 page. Pure, so it is tested without a PDF;
// `platform/cv-pdf.ts` draws these operations with pdf-lib. Coordinates are points from the bottom left, as in PDF.
// The look follows the person's own CV: centred name and contacts, a heavy section title with a thin rule, the place
// in bold with its town in grey and the dates flush right, the role in italics, and bold bullets that hang.
export const A4 = { width: 595.28, height: 841.89, margin: 45, top: 36 } as const

// Point sizes. Body text is 9.6 and a line takes 1.34 of it, which is what fits a working life on one page.
export const SIZE = { name: 20, contact: 9, body: 9.6, heading: 11.5 } as const
// How far bullet text sits in from the margin.
export const INDENT = 12.5

export type PdfOp =
  | { kind: 'text'; text: string; x: number; y: number; size: number; bold: boolean; gray: number; italic?: boolean; link?: boolean }
  | { kind: 'rule'; x1: number; x2: number; y: number }

// Width of a text in points. The real one comes from the font; tests pass a simple one.
export type Measure = (text: string, bold: boolean, size: number) => number

const LINE = 1.34
const INK = 0.07
const PLACE = 0.5
const BAR = '  |  '
const isLink = (text: string) => /linkedin\.com|github\.com|^https?:\/\/|^www\./i.test(text)

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
  const top = A4.height - A4.top
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
  const draw = (text: string, bold: boolean, size: number, x: number, gray = INK, italic = false) => {
    keep(lineHeight(size))
    y -= lineHeight(size)
    pages.at(-1)!.push({ kind: 'text', text, x, y, size, bold, gray, ...(italic ? { italic } : {}) })
  }
  const paragraph = (text: string, { bold = false, size = SIZE.body as number, x = A4.margin as number, gray = INK as number, italic = false, center = false } = {}) => {
    for (const line of wrap(text, bold, size, A4.width - A4.margin - x, measure))
      draw(line, bold, size, center ? (A4.width - measure(line, bold, size)) / 2 : x, gray, italic)
  }
  // The contacts in one centred line, each its own piece so a web address can be coloured as a link. A line too long
  // for the page falls back to plain wrapped text.
  const contactLine = (contacts: string[]) => {
    const size = SIZE.contact
    const pieces = contacts.flatMap((contact, index) => (index === 0 ? [contact] : [BAR, contact]))
    const total = pieces.reduce((sum, piece) => sum + measure(piece, false, size), 0)
    if (total > full) {
      paragraph(contacts.join(' | '), { size, center: true })
      return
    }
    keep(lineHeight(size))
    y -= lineHeight(size)
    let x = (A4.width - total) / 2
    for (const piece of pieces) {
      pages.at(-1)!.push({ kind: 'text', text: piece, x, y, size, bold: false, gray: INK, ...(piece !== BAR && isLink(piece) ? { link: true } : {}) })
      x += measure(piece, false, size)
    }
  }
  // A line with the name of the place on the left (and where it is, in grey) and the dates flush right, as on the person's own CV.
  const split = (left: string, right: string, location = '', { size = SIZE.body as number } = {}) => {
    keep(lineHeight(size))
    draw(left, true, size, A4.margin)
    const ops = pages.at(-1)!
    if (location !== '') ops.push({ kind: 'text', text: `– ${location}`, x: A4.margin + measure(`${left} `, true, size) + 2.5, y, size, bold: true, gray: PLACE })
    if (right !== '') ops.push({ kind: 'text', text: right, x: A4.width - A4.margin - measure(right, false, size), y, size, bold: false, gray: INK })
  }
  const rule = () => {
    y -= 4.5
    pages.at(-1)!.push({ kind: 'rule', x1: A4.margin, x2: A4.width - A4.margin, y })
    y -= 0.5
  }
  // The title of a section stays with the first thing under it.
  const section = (title: string, firstBlock: number) => {
    keep(5 + lineHeight(SIZE.heading) + 5 + firstBlock)
    y -= 5
    draw(title, true, SIZE.heading, A4.margin)
    rule()
  }

  // A bullet, optionally led by a bold label ("GPA: 3.87"): the label and the first words share the first line.
  const bullet = (text: string, label = '', x = A4.margin + INDENT, mark = '•') => {
    const lead = label !== '' ? `${label}: ` : ''
    const lines = wrap(`${lead}${text}`, false, SIZE.body, A4.width - A4.margin - x, measure)
    keep(lineHeight(SIZE.body) * Math.min(lines.length, 2))
    lines.forEach((line, index) => {
      const head = lead.trimEnd()
      if (index === 0 && head !== '' && line.startsWith(head)) {
        draw(head, true, SIZE.body, x)
        const rest = line.slice(head.length).trimStart()
        if (rest !== '') pages.at(-1)!.push({ kind: 'text', text: rest, x: x + measure(lead, true, SIZE.body) + 2, y, size: SIZE.body, bold: false, gray: INK })
      } else draw(line, false, SIZE.body, x)
      // The round bullet is drawn larger than the text, as on the person's own CV; the dash is body size.
      if (index === 0) pages.at(-1)!.push({ kind: 'text', text: mark, x: mark === '•' ? x - INDENT : x - 9, y, size: mark === '•' ? 12 : SIZE.body, bold: mark === '•', gray: INK })
    })
  }
  // What a heading and the first line under it need, so a title is never left alone at the foot of a page.
  const firstBlock = lineHeight(SIZE.body) * 2

  const education = () => {
    if (doc.education.length === 0) return
    section(labels.education, firstBlock)
    for (const school of doc.education) {
      keep(lineHeight(SIZE.body) * 3)
      if (school.institution !== '') split(school.institution, school.year, school.location)
      const title = [school.level, school.major].filter((part) => part !== '').join(' ')
      if (title !== '') paragraph(title, { italic: true })
      if (school.gpa !== '') bullet(school.gpa, labels.gpa)
      if (school.publication !== '') bullet(school.publication, labels.publication)
      if (school.achievements.length > 0) {
        bullet('', labels.achievements)
        for (const text of school.achievements) bullet(text, '', A4.margin + 2 * INDENT + 2, '–')
      }
      y -= 4.5
    }
  }

  const experience = () => {
    if (doc.experience.length === 0) return
    section(labels.experience, firstBlock + lineHeight(SIZE.body))
    for (const job of doc.experience) {
      keep(lineHeight(SIZE.body) * 3)
      split(job.company !== '' ? job.company : job.title, formatPeriod(job.start, job.end, job.current, lang), job.company !== '' ? job.location : '')
      if (job.company !== '' && job.title !== '') paragraph(job.title, { italic: true })
      for (const text of job.bullets) bullet(text)
      y -= 4.5
    }
  }

  const projects = () => {
    if (doc.projects.length === 0) return
    section(labels.projects, firstBlock + lineHeight(SIZE.body))
    for (const project of doc.projects) {
      keep(lineHeight(SIZE.body) * 3)
      split(project.name, project.date)
      if (project.role !== '') paragraph(project.role, { italic: true })
      for (const text of project.bullets) bullet(text)
      y -= 4.5
    }
  }

  const skills = () => {
    if (doc.skills.length === 0) return
    section(labels.skills, lineHeight(SIZE.body))
    paragraph(doc.skills.join(', '))
    y -= 4.5
  }

  const certifications = () => {
    if (doc.certifications.length === 0) return
    section(labels.certifications, lineHeight(SIZE.body))
    for (const text of doc.certifications) bullet(text)
  }

  paragraph(doc.header.name.toUpperCase(), { bold: true, size: SIZE.name, center: true })
  if (doc.header.contacts.length > 0) contactLine(doc.header.contacts)
  if (doc.summary !== '') {
    y -= 4
    paragraph(doc.summary, { center: true })
  }
  y -= 4

  const draws = { education, experience, projects, skills, certifications }
  for (const name of cvSections(doc.order)) draws[name]()
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
    order: doc.order,
    certifications: doc.certifications.map(clean),
    header: { name: clean(doc.header.name), contacts: doc.header.contacts.map(clean) },
    summary: clean(doc.summary),
    skills: doc.skills.map(clean),
    experience: doc.experience.map((e) => ({
      sourceId: e.sourceId, title: clean(e.title), company: clean(e.company), location: clean(e.location), start: clean(e.start), end: clean(e.end), current: e.current, bullets: e.bullets.map(clean),
    })),
    education: doc.education.map((e) => ({
      id: e.id, institution: clean(e.institution), location: clean(e.location), level: clean(e.level), major: clean(e.major), gpa: clean(e.gpa), year: clean(e.year),
      publication: clean(e.publication), achievements: e.achievements.map(clean),
    })),
    projects: doc.projects.map((p) => ({ id: p.id, name: clean(p.name), role: clean(p.role), date: clean(p.date), bullets: p.bullets.map(clean) })),
  }
  return { doc: next, replaced }
}

// "CV_{Nama}_{Perusahaan}.pdf" (FR-42), written the way the person names her own files: each word starts with a capital
// and the words run together, CV_ImeldaDamayanti_InovasiDaya.pdf. Letters and digits only, accents turned into plain
// letters. The company is short: a legal form (PT, Tbk, Ltd, ...) is left out and at most three words are kept. A part
// there is nothing usable for is left out, and with neither the file is CV.pdf.
const LEGAL_FORMS = new Set(['pt', 'tbk', 'cv', 'persero', 'ltd', 'pte', 'inc', 'llc', 'co', 'corp', 'limited'])
const MAX_COMPANY_WORDS = 3
const MAX_PART = 40
const plainWords = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[A-Za-z0-9]+/g) ?? []
// "lion" -> "Lion"; the rest of a word stays as written, so "MedRoyale" is not flattened.
const capitalised = (words: string[]) => words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('')

export function cvFileName(company: string, person = ''): string {
  const name = capitalised(plainWords(person)).slice(0, MAX_PART)
  const words = plainWords(company)
  const rest = words.filter((word) => !LEGAL_FORMS.has(word.toLowerCase()))
  const short = capitalised((rest.length > 0 ? rest : words).slice(0, MAX_COMPANY_WORDS)).slice(0, MAX_PART)
  return `${['CV', name, short].filter((part) => part !== '').join('_')}.pdf`
}

// What to tell the person after a download in which some characters had to be replaced; nothing when none were.
export const describeReplaced = (replaced: string[]): string | null =>
  replaced.length === 0 ? null : `Huruf yang tidak ada di font PDF standar diganti: ${replaced.join(', ')}. Periksa hasilnya sebelum dikirim.`
