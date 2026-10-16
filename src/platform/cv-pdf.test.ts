import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { Application, TailoredCv } from '../core/applications/types'
import { assemble } from '../core/tailor/grounded'
import { profileHash } from '../core/tailor/hash'
import { SAMPLE_DATA_ANALYST, SAMPLE_WEB_DEV } from '../core/tailor/sample-profiles'
import { loadApplicationData, saveApplicationData } from './application-storage'
import { downloadCv, renderCvPdf } from './cv-pdf'
import { saveProfile } from './storage'

const NOW = new Date(2026, 9, 15, 10, 0)
const AT = NOW.toISOString()
const empty = { skills: [], experience: [], education: [] }

// What a reader of the PDF gets back: the text, found again the way a search or an applicant tracking system would.
async function textOf(bytes: Uint8Array): Promise<string> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 }).promise
  let text = ''
  for (let n = 1; n <= document.numPages; n++) {
    const content = await (await document.getPage(n)).getTextContent()
    text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + ' '
  }
  return text.replace(/\s+/g, ' ')
}

beforeEach(() => {
  fakeBrowser.reset()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('renderCvPdf (FR-42)', () => {
  it('makes one A4 page of real text for an Indonesian CV', async () => {
    const result = await renderCvPdf(assemble(SAMPLE_WEB_DEV, empty), 'id', 'CV-PT-Contoh-Karya')
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe('%PDF-')
    const pdf = await PDFDocument.load(result.bytes)
    expect(pdf.getPageCount()).toBe(1)
    const { width, height } = pdf.getPage(0).getSize()
    expect(width).toBeCloseTo(595.28, 1)
    expect(height).toBeCloseTo(841.89, 1)
    expect(pdf.getTitle()).toBe('CV-PT-Contoh-Karya')
    const text = await textOf(result.bytes)
    for (const phrase of ['Sari Contohwati', 'TypeScript', 'Agu 2023 – sekarang', 'cakupan tes naik dari 40% ke 70%', 'Universitas Contoh Nusantara', 'PENGALAMAN']) {
      expect(text, phrase).toContain(phrase)
    }
    expect(result.replaced).toEqual([])
  })

  it('writes an English CV with English section names and keeps accents the fonts have', async () => {
    const doc = assemble(SAMPLE_DATA_ANALYST, empty)
    doc.experience[1]!.bullets = ['Presented résumé of findings in a café to the store managers.']
    const text = await textOf((await renderCvPdf(doc, 'en', 'CV')).bytes)
    for (const phrase of ['EXPERIENCE', 'EDUCATION', 'Mar 2021 – present', 'from 6 hours to 2 hours', 'résumé of findings', 'café']) expect(text, phrase).toContain(phrase)
  })

  it('goes on to more pages when the CV is long, each of them A4', async () => {
    const doc = assemble(SAMPLE_WEB_DEV, empty)
    doc.experience = Array.from({ length: 14 }, (_, i) => ({ ...doc.experience[0]!, sourceId: `e${i}`, bullets: Array.from({ length: 4 }, (_, n) => `Butir nomor ${n + 1} dari pengalaman ${i + 1} yang cukup panjang untuk membungkus lebih dari satu baris di halaman A4.`) }))
    const pdf = await PDFDocument.load((await renderCvPdf(doc, 'id', 'CV')).bytes)
    expect(pdf.getPageCount()).toBeGreaterThan(1)
    for (const page of pdf.getPages()) expect(page.getSize().width).toBeCloseTo(595.28, 1)
  })

  it('replaces what the standard fonts cannot write and says which characters', async () => {
    const doc = assemble(SAMPLE_WEB_DEV, empty)
    doc.header.name = 'Nguyễn Contoh 李'
    const result = await renderCvPdf(doc, 'id', 'CV')
    expect(result.replaced).toEqual(['ễ', '李'])
    expect(await textOf(result.bytes)).toContain('Nguyen Contoh ?')
  })

  it('makes no network request (FR-42)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const open = vi.spyOn(XMLHttpRequest.prototype, 'open')
    await renderCvPdf(assemble(SAMPLE_WEB_DEV, empty), 'id', 'CV')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})

describe('downloadCv', () => {
  async function seed(cv = true) {
    await saveProfile(SAMPLE_WEB_DEV)
    const doc: TailoredCv = {
      id: 'cv-1', applicationId: 'app-1', createdAt: AT, profileHash: profileHash(SAMPLE_WEB_DEV),
      skills: ['React', 'TypeScript'], experience: [{ sourceId: 'exp-a1', bullets: ['Membangun dashboard pelanggan dengan React dan TypeScript.'] }], education: ['edu-a1'],
      coverage: { required: ['React'], covered: ['React'], missing: [] }, edited: false,
      aiVersion: { skills: ['React', 'TypeScript'], experience: [{ sourceId: 'exp-a1', bullets: ['Membangun dashboard pelanggan dengan React dan TypeScript.'] }], education: ['edu-a1'] },
    }
    const app: Application = {
      id: 'app-1', jobId: 'j1', status: 'draft', cvId: cv ? 'cv-1' : null, letterId: null, followUpAt: null, notes: '', createdAt: AT, updatedAt: AT,
      job: { title: 'Frontend Engineer', company: 'PT Contoh Karya', url: 'https://x.test/1', source: 'ashby', description: 'x', capturedAt: AT },
      events: [{ at: AT, type: 'created' }],
    }
    await saveApplicationData({ applications: [app], cvs: cv ? [doc] : [], letters: [] })
  }

  it('hands over a PDF named for the company and notes the download in the history', async () => {
    await seed()
    const delivered: { name: string; bytes: Uint8Array }[] = []
    const result = await downloadCv('app-1', { now: NOW, deliver: (name, bytes) => void delivered.push({ name, bytes }) })
    expect(result).toEqual({ ok: true, fileName: 'CV-PT-Contoh-Karya.pdf', replaced: [] })
    expect(delivered).toHaveLength(1)
    expect(delivered[0]?.name).toBe('CV-PT-Contoh-Karya.pdf')
    expect(await textOf(delivered[0]!.bytes)).toContain('Membangun dashboard pelanggan dengan React dan TypeScript.')
    const app = (await loadApplicationData()).applications[0]!
    expect(app.events.at(-1)).toEqual({ at: AT, type: 'download' })
  })

  it('draws the stored CV, so a hand edit is what is downloaded', async () => {
    await seed()
    const data = await loadApplicationData()
    await saveApplicationData({ ...data, cvs: [{ ...data.cvs[0]!, experience: [{ sourceId: 'exp-a1', bullets: ['Kalimat hasil suntingan sendiri.'] }], edited: true }] })
    let bytes: Uint8Array = new Uint8Array()
    await downloadCv('app-1', { now: NOW, deliver: (_name, data) => void (bytes = data) })
    const text = await textOf(bytes)
    expect(text).toContain('Kalimat hasil suntingan sendiri.')
    expect(text).not.toContain('Membangun dashboard pelanggan')
  })

  it('reports the characters it had to replace', async () => {
    await seed()
    await saveProfile({ ...SAMPLE_WEB_DEV, personal: { ...SAMPLE_WEB_DEV.personal, lastName: 'Nguyễn' } })
    const result = await downloadCv('app-1', { now: NOW, deliver: () => {} })
    expect(result).toMatchObject({ ok: true, replaced: ['ễ'] })
  })

  it('says why when the PDF cannot be made, hands over nothing and notes nothing in the history', async () => {
    await seed()
    const deliver = vi.fn()
    const result = await downloadCv('app-1', { now: NOW, deliver, render: async () => { throw new Error('boom') } })
    expect(result).toEqual({ ok: false, message: 'PDF gagal dibuat: boom. Isi CV tetap ada di halaman ini dan bisa disalin.' })
    expect(deliver).not.toHaveBeenCalled()
    expect((await loadApplicationData()).applications[0]?.events).toHaveLength(1)
  })

  it('says why when the browser refuses the download, and notes nothing in the history', async () => {
    await seed()
    const result = await downloadCv('app-1', { now: NOW, deliver: () => { throw new Error('diblokir') } })
    expect(result).toMatchObject({ ok: false })
    expect((await loadApplicationData()).applications[0]?.events).toHaveLength(1)
  })

  it('has nothing to download without a CV', async () => {
    await seed(false)
    expect(await downloadCv('app-1', { now: NOW, deliver: () => {} })).toEqual({ ok: false, message: 'Belum ada CV untuk diunduh.' })
    expect(await downloadCv('nope', { now: NOW, deliver: () => {} })).toEqual({ ok: false, message: 'Belum ada CV untuk diunduh.' })
  })
})
