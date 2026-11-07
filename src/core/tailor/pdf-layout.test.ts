import { describe, expect, it } from 'vitest'
import { assemble } from './grounded'
import { A4, INDENT, SIZE, cvFileName, describeReplaced, layoutCv, toWinAnsi, winAnsiDocument, type Measure, type PdfOp } from './pdf-layout'
import { SAMPLE_DATA_ANALYST, SAMPLE_WEB_DEV } from './sample-profiles'
import type { CvDocument } from './types'

// Every character is half a point-size wide: simple, and the same for regular and bold.
const measure: Measure = (text, _bold, size) => text.length * size * 0.5

const empty = { skills: [], experience: [], education: [] }
const web = (): CvDocument => assemble(SAMPLE_WEB_DEV, empty)
const texts = (page: PdfOp[]) => page.flatMap((op) => (op.kind === 'text' ? [op] : []))
const all = (pages: PdfOp[][]) => pages.flatMap(texts)

describe('layoutCv', () => {
  it('starts with the name in capitals, large, bold and centred, and the contacts centred under it in one line', () => {
    const [first] = layoutCv(web(), 'id', measure)
    const [name, ...rest] = texts(first!)
    expect(name).toMatchObject({ text: 'SARI CONTOHWATI', size: SIZE.name, bold: true })
    expect(name!.x).toBeCloseTo((A4.width - measure(name!.text, true, SIZE.name)) / 2)
    expect(name!.y).toBeLessThan(A4.height - A4.top)
    // Each contact is its own piece, with a bar between, so one of them can be coloured as a link.
    const line = rest.slice(0, 5)
    expect(line.map((op) => op.text).join('')).toBe('081200000000  |  sari@example.test  |  Denpasar')
    expect(new Set(line.map((op) => op.y)).size).toBe(1)
    expect(line[0]!.x).toBeCloseTo((A4.width - line.reduce((sum, op) => sum + measure(op.text, false, SIZE.contact), 0)) / 2)
    expect(line[0]!.y).toBeLessThan(name!.y)
    expect(line.every((op) => op.gray < 0.2 && op.size === SIZE.contact)).toBe(true)
  })

  it('colours a web address in the contacts as a link, and leaves the rest plain', () => {
    const doc = web()
    doc.header.contacts = ['sari@example.test', 'linkedin.com/in/sari']
    const ops = all(layoutCv(doc, 'id', measure))
    expect(ops.find((op) => op.text === 'linkedin.com/in/sari')).toMatchObject({ link: true })
    expect(ops.find((op) => op.text === 'sari@example.test')?.link).toBeUndefined()
  })

  it('names the sections in the language of the CV, education first', () => {
    const sections = (lang: 'id' | 'en') => all(layoutCv(web(), lang, measure)).filter((op) => op.size === SIZE.heading && op.bold).map((op) => op.text)
    expect(sections('id')).toEqual(['Pendidikan', 'Pengalaman Kerja', 'Skill'])
    expect(sections('en')).toEqual(['Education', 'Work Experience', 'Skills'])
  })

  it('puts Work Experience above Education when the CV is set to lead with experience', () => {
    const doc = { ...web(), order: 'experience-first' as const }
    const sections = all(layoutCv(doc, 'en', measure)).filter((op) => op.size === SIZE.heading && op.bold).map((op) => op.text)
    expect(sections).toEqual(['Work Experience', 'Education', 'Skills'])
  })

  it('ends with Certifications, one bullet each, when the CV has them', () => {
    const doc = { ...web(), certifications: ['Dicoding, Belajar Dasar AI', 'Google Cloud, Prompt Design'] }
    const ops = all(layoutCv(doc, 'en', measure))
    const sections = ops.filter((op) => op.size === SIZE.heading && op.bold).map((op) => op.text)
    expect(sections).toEqual(['Education', 'Work Experience', 'Skills', 'Certifications'])
    const certHeading = ops.find((op) => op.text === 'Certifications')!
    const below = ops.filter((op) => op.y < certHeading.y)
    expect(below.filter((op) => op.text === '•')).toHaveLength(2)
    expect(below.map((op) => op.text)).toContain('Dicoding, Belajar Dasar AI')
  })

  it('writes the place after the company in grey with an en dash, and nested achievements with en dashes', () => {
    const doc = web()
    doc.experience[0]!.location = 'Denpasar'
    doc.education[0]!.achievements = ['Juara 1 Lomba Contoh (2024)']
    const ops = all(layoutCv(doc, 'id', measure))
    expect(ops.find((op) => op.text === '– Denpasar')).toMatchObject({ bold: true, gray: 0.5 })
    expect(ops.find((op) => op.text === '–' && op.x < A4.margin + 2 * INDENT)).toBeDefined()
    expect(ops.find((op) => op.text === 'Juara 1 Lomba Contoh (2024)')!.x).toBe(A4.margin + 2 * INDENT + 2)
  })

  it('writes each job with the company bold on the left, the dates flush right, and the title in italics under it', () => {
    const ops = all(layoutCv(web(), 'id', measure))
    const company = ops.find((op) => op.text === 'PT Contoh Teknologi')!
    const dates = ops.find((op) => op.text === 'Agu 2023 – sekarang')!
    expect(company).toMatchObject({ x: A4.margin, bold: true })
    expect(dates.y).toBe(company.y)
    expect(dates.x + measure(dates.text, false, dates.size)).toBeCloseTo(A4.width - A4.margin)
    const title = ops.find((op) => op.text === 'Software Engineer')!
    expect(title).toMatchObject({ italic: true, bold: false })
    expect(title.y).toBeLessThan(company.y)
    expect(ops.map((op) => op.text)).toContain('Jan 2022 – Jun 2022')
    const english = all(layoutCv(assemble(SAMPLE_DATA_ANALYST, empty), 'en', measure)).map((op) => op.text)
    expect(english).toContain('Mar 2021 – present')
  })

  it('puts a bullet mark before each bullet and indents the text', () => {
    const ops = all(layoutCv(web(), 'id', measure))
    const marks = ops.filter((op) => op.text === '•')
    const gpas = web().education.filter((school) => school.gpa !== '').length
    expect(marks).toHaveLength(web().experience.reduce((n, e) => n + e.bullets.length, 0) + gpas)
    expect(ops.some((op) => op.text.startsWith('Membangun fitur dashboard') && op.x === A4.margin + INDENT)).toBe(true)
    expect(marks.every((op) => op.x === A4.margin && op.bold)).toBe(true)
  })

  it('keeps every line inside the margins', () => {
    const pages = layoutCv(web(), 'id', measure)
    for (const op of all(pages)) {
      expect(op.x).toBeGreaterThanOrEqual(A4.margin)
      expect(op.x + measure(op.text, op.bold, op.size)).toBeLessThanOrEqual(A4.width - A4.margin + 0.001)
      expect(op.y).toBeGreaterThanOrEqual(A4.margin)
    }
  })

  it('wraps a long bullet onto more lines, none wider than the column', () => {
    const doc = web()
    doc.experience[0]!.bullets = ['kata '.repeat(120).trim()]
    const lines = all(layoutCv(doc, 'id', measure)).filter((op) => op.text.startsWith('kata') && op.x === A4.margin + INDENT)
    expect(lines.length).toBeGreaterThan(2)
    for (const line of lines) expect(measure(line.text, false, line.size)).toBeLessThanOrEqual(A4.width - 2 * A4.margin - INDENT)
  })

  it('breaks a word that is longer than the line instead of running past the margin', () => {
    const doc = web()
    doc.experience[0]!.bullets = ['x'.repeat(400)]
    for (const op of all(layoutCv(doc, 'id', measure))) expect(op.x + measure(op.text, op.bold, op.size)).toBeLessThanOrEqual(A4.width - A4.margin + 0.001)
  })

  it('goes on a second page when the first is full, and never leaves a heading alone at the foot of a page', () => {
    const doc = web()
    doc.experience = Array.from({ length: 9 }, (_, i) => ({ ...doc.experience[0]!, sourceId: `e${i}`, bullets: ['Satu butir yang cukup panjang untuk mengisi baris.', 'Butir kedua.', 'Butir ketiga.'] }))
    const pages = layoutCv(doc, 'id', measure)
    expect(pages.length).toBeGreaterThan(1)
    for (const page of pages.slice(0, -1)) {
      // A bullet mark is drawn after its text, so it is skipped: what matters is the last line of text.
      const last = texts(page).filter((op) => op.text !== '•').at(-1)!
      expect(last.bold && (last.size === SIZE.heading || last.size === SIZE.body), `last line of a page: ${last.text}`).toBe(false)
    }
    for (const page of pages) expect(texts(page).length).toBeGreaterThan(0)
  })

  it('draws a rule under each section title', () => {
    const rules = layoutCv(web(), 'id', measure).flat().filter((op) => op.kind === 'rule')
    expect(rules).toHaveLength(3)
    for (const rule of rules) expect(rule).toMatchObject({ x1: A4.margin, x2: A4.width - A4.margin })
  })

  it('leaves out a section the CV does not have', () => {
    const doc = web()
    doc.education = []
    doc.skills = []
    const sections = all(layoutCv(doc, 'id', measure)).filter((op) => op.size === SIZE.heading && op.bold).map((op) => op.text)
    expect(sections).toEqual(['Pengalaman Kerja'])
  })

  it('writes a school as institution and year on one line, then level and major in italics', () => {
    const ops = all(layoutCv(web(), 'id', measure))
    const school = ops.find((op) => op.text === 'Universitas Contoh Nusantara')!
    expect(school.bold).toBe(true)
    expect(ops.find((op) => op.text === '2022')!.y).toBe(school.y)
    expect(ops.find((op) => op.text === 'S1 Teknik Informatika')).toMatchObject({ italic: true })
  })

  it('makes the same pages for the same CV', () => {
    expect(layoutCv(web(), 'id', measure)).toEqual(layoutCv(web(), 'id', measure))
  })
})

describe('toWinAnsi (the standard PDF fonts write only these characters)', () => {
  it('leaves Latin text, accents, dashes, quotes and bullets as they are', () => {
    const text = 'Agu 2023 – sekarang • “kutip” ’ é à ñ ü 40% © ® Rp 1,5 juta'
    expect(toWinAnsi(text)).toEqual({ text, replaced: [] })
  })

  it('turns an accent the fonts lack into its plain letter, and says which it changed', () => {
    expect(toWinAnsi('Nguyễn Văn')).toEqual({ text: 'Nguyen Van', replaced: ['ễ', 'ă'] })
  })

  it('turns letters of another script into a question mark, once each in the report', () => {
    expect(toWinAnsi('李公司 Иван')).toEqual({ text: '??? ????', replaced: ['李', '公', '司', 'И', 'в', 'а', 'н'] })
  })

  it('keeps line breaks and removes control characters and emoji', () => {
    expect(toWinAnsi('a\nb\u0000c 🙂').text).toBe('a\nbc ?')
  })
})

describe('winAnsiDocument', () => {
  it('cleans every string of the CV and reports each character once', () => {
    const doc = web()
    doc.header.name = 'Nguyễn Contoh'
    doc.experience[0]!.bullets = ['Dashboard 李 untuk ễ']
    const { doc: clean, replaced } = winAnsiDocument(doc)
    expect(clean.header.name).toBe('Nguyen Contoh')
    expect(clean.experience[0]!.bullets).toEqual(['Dashboard ? untuk e'])
    expect(replaced).toEqual(['ễ', '李'])
    expect(doc.header.name).toBe('Nguyễn Contoh')
  })

  it('cleans the certifications too and keeps the order', () => {
    const doc = { ...web(), certifications: ['Kursus 李'], order: 'experience-first' as const }
    const { doc: clean, replaced } = winAnsiDocument(doc)
    expect(clean.certifications).toEqual(['Kursus ?'])
    expect(clean.order).toBe('experience-first')
    expect(replaced).toEqual(['李'])
  })

  it('changes nothing for plain text', () => {
    expect(winAnsiDocument(web())).toEqual({ doc: web(), replaced: [] })
  })
})

describe('cvFileName (FR-42)', () => {
  const NAME = 'Imelda Damayanti'

  it('is cv_{name}_{company}.pdf: the name without spaces, the company short, all lower case with underscores', () => {
    expect(cvFileName('PT Inovasi Daya', NAME)).toBe('cv_imeldadamayanti_inovasi_daya.pdf')
    expect(cvFileName('MedRoyale', NAME)).toBe('cv_imeldadamayanti_medroyale.pdf')
  })

  it('leaves the legal form out of the company: PT, CV, Tbk, Pte, Ltd, Inc', () => {
    expect(cvFileName('PT Smartfren Telecom Tbk', NAME)).toBe('cv_imeldadamayanti_smartfren_telecom.pdf')
    expect(cvFileName('Maju Jaya Pte. Ltd.', NAME)).toBe('cv_imeldadamayanti_maju_jaya.pdf')
    expect(cvFileName('Acme, Inc.', NAME)).toBe('cv_imeldadamayanti_acme.pdf')
  })

  it('keeps at most three words of the company', () => {
    expect(cvFileName('Apple Developer Academy Bali Indonesia', NAME)).toBe('cv_imeldadamayanti_apple_developer_academy.pdf')
  })

  it('turns accents into plain letters', () => {
    expect(cvFileName('Café Müller & Söhne', 'Dewi Sri')).toBe('cv_dewisri_cafe_muller_sohne.pdf')
  })

  it('removes what a file name cannot hold', () => {
    expect(cvFileName('Acme/Co: "X"? <Y>|*', NAME)).toBe('cv_imeldadamayanti_acme_x_y.pdf')
    expect(cvFileName('..\\..\\etc', NAME)).toBe('cv_imeldadamayanti_etc.pdf')
  })

  it('stays short for a very long name', () => {
    const name = cvFileName('Perusahaan '.repeat(30), NAME)
    expect(name.length).toBeLessThanOrEqual(64)
    expect(name.startsWith('cv_imeldadamayanti_perusahaan')).toBe(true)
    expect(name.endsWith('.pdf')).toBe(true)
  })

  it('leaves out the part it does not have, and is cv.pdf when nothing usable is left', () => {
    expect(cvFileName('PT Inovasi Daya')).toBe('cv_inovasi_daya.pdf')
    expect(cvFileName('', NAME)).toBe('cv_imeldadamayanti.pdf')
    expect(cvFileName('   ')).toBe('cv.pdf')
    expect(cvFileName('李公司')).toBe('cv.pdf')
    expect(cvFileName('...')).toBe('cv.pdf')
  })

  it('keeps a company that is only a legal form, so it still has a name', () => {
    expect(cvFileName('PT', NAME)).toBe('cv_imeldadamayanti_pt.pdf')
  })

  it('does not end in an underscore before the extension', () => {
    expect(cvFileName('Acme -', NAME)).toBe('cv_imeldadamayanti_acme.pdf')
  })
})

describe('describeReplaced', () => {
  it('names the characters that were changed so the person can check the PDF', () => {
    expect(describeReplaced(['ễ', '李'])).toBe('Huruf yang tidak ada di font PDF standar diganti: ễ, 李. Periksa hasilnya sebelum dikirim.')
  })

  it('says nothing when nothing was changed', () => {
    expect(describeReplaced([])).toBeNull()
  })
})
