// T50 spike: print-to-PDF through CSS (headless Chrome here, the print dialog in the product) against pdf-lib,
// on the same two CVs (Indonesian and English). Prints a comparison; writes nothing into src/.
//   PDF_LIB=<path to pdf-lib/cjs/index.js> OUT=<dir> node spikes/t50/run.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const OUT = process.env.OUT
const PDF_LIB = process.env.PDF_LIB
if (!OUT || !PDF_LIB) throw new Error('set OUT and PDF_LIB')
mkdirSync(OUT, { recursive: true })
const { PDFDocument, StandardFonts, rgb } = createRequire(import.meta.url)(PDF_LIB)

// The shape of CvDocument (src/core/tailor/types.ts), written out so the spike stands alone.
const DOCS = {
  id: {
    lang: 'id', file: 'CV-PT-Contoh-Karya',
    labels: { skills: 'Skill', experience: 'Pengalaman', education: 'Pendidikan', now: 'sekarang' },
    header: { name: 'Sari Contohwati', contacts: ['sari@example.test', '081200000000', 'Denpasar'] },
    skills: ['React', 'TypeScript', 'Node.js', 'Jest', 'PostgreSQL'],
    experience: [
      { title: 'Software Engineer', company: 'PT Contoh Teknologi', period: 'Agu 2023 – sekarang', bullets: [
        'Membangun dashboard pelanggan dengan React dan TypeScript untuk tim operasional dan layanan pelanggan di tiga kota.',
        'Menaikkan cakupan tes dari 40% ke 70% dengan Jest, termasuk tes untuk alur pembayaran yang paling sering gagal.',
        'Menulis REST API memakai Node.js dan PostgreSQL; ikut code review dua kali seminggu.',
      ] },
      { title: 'Staf Magang Pengembangan Web', company: 'CV Contoh Digital', period: 'Jan 2022 – Jun 2022', bullets: ['Membantu memindahkan halaman statis ke React dan memperbaiki bug tampilan di situs perusahaan.'] },
    ],
    education: [{ title: 'S1 Teknik Informatika', meta: 'Universitas Contoh Nusantara · 2022' }],
  },
  en: {
    lang: 'en', file: 'CV-Sample-Analytics',
    labels: { skills: 'Skills', experience: 'Experience', education: 'Education', now: 'present' },
    header: { name: 'Dewi Sampleton', contacts: ['dewi@example.test', '081200000001', 'Denpasar'] },
    skills: ['Python', 'SQL', 'Tableau', 'pandas', 'Excel', 'Statistics', 'English'],
    experience: [
      { title: 'Data Analyst', company: 'Sample Analytics Ltd', period: 'Mar 2021 – present', bullets: [
        'Built weekly sales dashboards in Tableau for the regional team, replacing three spreadsheets that were copied by hand every Monday.',
        'Wrote SQL queries and pandas scripts to clean order data from three sources.',
        'Reduced the weekly reporting time from 6 hours to 2 hours by automating the Excel export.',
      ] },
      { title: 'Junior Analyst', company: 'Contoh Retail Group', period: 'Jul 2019 – Feb 2021', bullets: ['Prepared monthly stock reports in Excel for the store managers; résumé of findings in café-style “plain” language.'] },
    ],
    education: [{ title: 'Bachelor Statistics', meta: 'Sample State University · 2019' }],
  },
}
const PHRASES = {
  id: ['TypeScript', 'Agu 2023 – sekarang', 'cakupan tes dari 40% ke 70% dengan Jest', 'Universitas Contoh Nusantara'],
  en: ['Tableau', 'Mar 2021 – present', 'from 6 hours to 2 hours', 'résumé of findings', 'Sample State University'],
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// --- A. CSS print: one HTML page with a print stylesheet; the print dialog saves it as PDF ---
function html(doc) {
  const { labels: L } = doc
  return `<!doctype html><html lang="${doc.lang}"><head><meta charset="utf-8"><title>${doc.file}</title><style>
@page { size: A4; margin: 18mm 18mm 18mm 18mm }
* { box-sizing: border-box }
body { font: 10pt/1.4 Arial, Helvetica, sans-serif; color: #111; margin: 0 }
h1 { font-size: 20pt; margin: 0 0 2pt }
.c { font-size: 9.5pt; color: #444; margin: 0 0 10pt }
h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #999; padding-bottom: 2pt; margin: 12pt 0 6pt }
h3 { font-size: 10.5pt; margin: 6pt 0 0 } .m { font-size: 9pt; color: #444; margin: 0 0 3pt }
ul { margin: 0 0 4pt; padding-left: 14pt } li { margin: 0 0 2pt } section, li { break-inside: avoid }
</style></head><body>
<h1>${esc(doc.header.name)}</h1><p class="c">${doc.header.contacts.map(esc).join(' · ')}</p>
<h2>${L.skills}</h2><p>${doc.skills.map(esc).join(', ')}</p>
<h2>${L.experience}</h2>${doc.experience.map((e) => `<section><h3>${esc(e.title)}</h3><p class="m">${esc(e.company)} · ${esc(e.period)}</p><ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></section>`).join('')}
<h2>${L.education}</h2>${doc.education.map((e) => `<h3>${esc(e.title)}</h3><p class="m">${esc(e.meta)}</p>`).join('')}
</body></html>`
}

function printWithChrome(doc) {
  const page = `${OUT}/${doc.lang}.html`
  writeFileSync(page, html(doc))
  const pdf = `${OUT}/css-${doc.lang}.pdf`
  const t = Date.now()
  execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(page).href], { stdio: 'ignore' })
  return { pdf, ms: Date.now() - t }
}

// --- B. pdf-lib: the layout is ours (wrapping, page breaks), the fonts are the 14 standard ones ---
async function withPdfLib(doc) {
  const t = Date.now()
  const pdf = await PDFDocument.create()
  pdf.setTitle(doc.file)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28, H = 841.89, M = 51
  let page = pdf.addPage([W, H])
  let y = H - M
  const wrap = (text, font, size, width) => {
    const lines = []
    let line = ''
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word } else line = next
    }
    return line ? [...lines, line] : lines
  }
  const need = (h) => { if (y - h < M) { page = pdf.addPage([W, H]); y = H - M } }
  const text = (s, { font = regular, size = 10, x = M, color = rgb(0.07, 0.07, 0.07), width = W - 2 * M - (x - M), gap = 1.4 } = {}) => {
    for (const line of wrap(s, font, size, width)) { need(size * gap); y -= size * gap; page.drawText(line, { x, y, size, font, color }) }
  }
  const rule = () => { y -= 3; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.6, 0.6, 0.6) }); y -= 4 }
  const L = doc.labels
  text(doc.header.name, { font: bold, size: 20 })
  text(doc.header.contacts.join('  ·  '), { size: 9.5, color: rgb(0.27, 0.27, 0.27) })
  y -= 6
  const section = (title) => { y -= 6; text(title.toUpperCase(), { font: bold, size: 11 }); rule() }
  section(L.skills); text(doc.skills.join(', '))
  section(L.experience)
  for (const e of doc.experience) {
    text(e.title, { font: bold, size: 10.5 }); text(`${e.company} · ${e.period}`, { size: 9, color: rgb(0.27, 0.27, 0.27) })
    for (const b of e.bullets) { const lines = wrap(b, regular, 10, W - 2 * M - 14); need(lines.length * 14); const top = y; text(b, { x: M + 14 }); page.drawText('•', { x: M + 3, y: top - 14, size: 10, font: regular }) }
    y -= 4
  }
  section(L.education)
  for (const e of doc.education) { text(e.title, { font: bold, size: 10.5 }); text(e.meta, { size: 9, color: rgb(0.27, 0.27, 0.27) }) }
  const bytes = await pdf.save()
  const file = `${OUT}/lib-${doc.lang}.pdf`
  writeFileSync(file, bytes)
  return { pdf: file, ms: Date.now() - t }
}

// Characters the 14 standard fonts cannot write (WinAnsi only): a name such as 李 makes pdf-lib throw.
async function unsupported() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const out = {}
  for (const text of ['é à ñ', 'dash – bullet •', 'quotes “x” ’', 'Иван', '李', 'محمد', 'Nguyễn']) {
    try { font.encodeText(text); out[text] = 'ok' } catch (error) { out[text] = `throws: ${String(error.message).slice(0, 60)}` }
  }
  return out
}

// --- measure: pages, size, embedded fonts, and whether the text can be found again (what an ATS does) ---
async function measure(file, lang) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(readFileSync(file))
  const task = getDocument({ data, useSystemFonts: false, standardFontDataUrl: pathToFileURL(`${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`).href })
  const doc = await task.promise
  const pages = doc.numPages
  let text = ''
  for (let n = 1; n <= pages; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    text += content.items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : '') : '')).join(' ') + '\n'
  }
  const flat = text.replace(/\s+/g, ' ')
  const raw = readFileSync(file).toString('latin1')
  return {
    pages, bytes: statSync(file).size,
    embeddedFonts: (raw.match(/\/FontFile\d?/g) ?? []).length,
    found: Object.fromEntries(PHRASES[lang].map((p) => [p, flat.includes(p)])),
  }
}

const result = { css: {}, lib: {}, unsupported: await unsupported() }
for (const doc of Object.values(DOCS)) {
  const a = printWithChrome(doc)
  result.css[doc.lang] = { ms: a.ms, ...(await measure(a.pdf, doc.lang)) }
  const b = await withPdfLib(doc)
  result.lib[doc.lang] = { ms: b.ms, ...(await measure(b.pdf, doc.lang)) }
}
console.log(JSON.stringify(result, null, 1))
