import { noteDownload } from '../core/applications/applications'
import { cvParts } from '../core/tailor/edit'
import { assemble } from '../core/tailor/grounded'
import { detectLanguage, type Lang } from '../core/tailor/language'
import { A4, cvFileName, layoutCv, winAnsiDocument } from '../core/tailor/pdf-layout'
import type { CvDocument } from '../core/tailor/types'
import { loadApplicationData, saveApplications } from './application-storage'
import { downloadBytes } from './download'
import { loadProfile } from './storage'

export type RenderedPdf = { bytes: Uint8Array; replaced: string[] }

// Draws the CV with pdf-lib (T50, RFC §3.3c). The library is loaded on first use, so only the person who downloads pays
// for it. It writes the standard fonts that every PDF viewer has, so there is no font file and no request: the text is
// real text, which can be selected, searched and read by an applicant tracking system.
export async function renderCvPdf(doc: CvDocument, lang: Lang, title: string): Promise<RenderedPdf> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const { doc: clean, replaced } = winAnsiDocument(doc)
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setCreator('job-kit')
  pdf.setProducer('job-kit')
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const pages = layoutCv(clean, lang, (text, isBold, size) => (isBold ? bold : regular).widthOfTextAtSize(text, size))
  for (const ops of pages) {
    const page = pdf.addPage([A4.width, A4.height])
    for (const op of ops) {
      if (op.kind === 'rule') {
        page.drawLine({ start: { x: op.x1, y: op.y }, end: { x: op.x2, y: op.y }, thickness: 0.6, color: rgb(0.6, 0.6, 0.6) })
      } else {
        page.drawText(op.text, { x: op.x, y: op.y, size: op.size, font: op.bold ? bold : regular, color: rgb(op.gray, op.gray, op.gray) })
      }
    }
  }
  return { bytes: await pdf.save(), replaced }
}

export type DownloadCvResult = { ok: true; fileName: string; replaced: string[] } | { ok: false; message: string }

type Options = {
  now?: Date
  // Hands the file to the browser. Replaced in tests.
  deliver?: (fileName: string, bytes: Uint8Array) => void
  render?: typeof renderCvPdf
}

const describe = (error: unknown) => (error instanceof Error && error.message !== '' ? error.message : 'sebab tidak diketahui')

// "Unduh PDF" (FR-42): draws the stored CV, so a hand edit is what is downloaded, hands it to the browser as
// CV-{perusahaan}.pdf and notes the download in the history. When anything fails, nothing is noted and the person is
// told why; the CV stays on the page to be copied (PRD §8).
export async function downloadCv(applicationId: string, { now = new Date(), deliver = (name, bytes) => downloadBytes(name, bytes, 'application/pdf'), render = renderCvPdf }: Options = {}): Promise<DownloadCvResult> {
  const [data, profile] = await Promise.all([loadApplicationData(), loadProfile()])
  const app = data.applications.find((item) => item.id === applicationId)
  const cv = app ? data.cvs.find((item) => item.id === app.cvId) : undefined
  if (!app || !cv) return { ok: false, message: 'Belum ada CV untuk diunduh.' }

  const doc = assemble(profile, cvParts(cv))
  const lang = detectLanguage(doc.experience.flatMap((job) => [job.title, ...job.bullets]).join(' '))
  const fileName = cvFileName(app.job.company)

  let rendered: RenderedPdf
  try {
    rendered = await render(doc, lang, fileName.replace(/\.pdf$/, ''))
  } catch (error) {
    return { ok: false, message: `PDF gagal dibuat: ${describe(error)}. Isi CV tetap ada di halaman ini dan bisa disalin.` }
  }
  try {
    deliver(fileName, rendered.bytes)
  } catch (error) {
    return { ok: false, message: `PDF gagal diunduh: ${describe(error)}. Isi CV tetap ada di halaman ini dan bisa disalin.` }
  }
  await saveApplications(data.applications.map((item) => (item.id === app.id ? noteDownload(item, now) : item)))
  return { ok: true, fileName, replaced: rendered.replaced }
}
