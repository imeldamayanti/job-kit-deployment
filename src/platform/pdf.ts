import {
  checkExtractedPages,
  classifyPdfError,
  itemsToText,
  looksLikePdf,
  type PdfReadResult,
  type PdfTextItem,
} from '../core/cv/pdf-text'

// pdf.js and its worker are loaded here, on first use, so only the options page ever pays for them.
// The worker is bundled with the extension and served from its own origin: no remote script.
async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

// Reads the text of a PDF in this browser. The file never leaves it.
export async function readPdfText(file: File): Promise<PdfReadResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!looksLikePdf(bytes)) return { ok: false, reason: 'not-pdf' }

  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument({ data: bytes })
  try {
    const document = await task.promise
    const pages: string[] = []
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      const items = content.items.filter((item): item is typeof item & PdfTextItem => 'str' in item)
      pages.push(itemsToText(items))
    }
    return checkExtractedPages(pages)
  } catch (error) {
    return { ok: false, reason: classifyPdfError(error) }
  } finally {
    await task.destroy()
  }
}
