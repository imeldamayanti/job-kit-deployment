// Pure helpers around pdf.js: what it hands us goes in, plain text or a typed reason comes out.
export type PdfErrorReason = 'not-pdf' | 'encrypted' | 'no-text-layer' | 'unreadable'

export type PdfReadResult = { ok: true; pages: string[] } | { ok: false; reason: PdfErrorReason }

// The slice of a pdf.js text item this module reads.
export type PdfTextItem = { str: string; transform: number[]; width: number; hasEOL: boolean }

const SIGNATURE = '%PDF-'
const SIGNATURE_WINDOW = 1024
// A page with fewer visible characters than this is a scan with a stray page number, not a CV.
const MIN_TEXT_CHARS = 20

// Decided from the content, not the file name.
export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, SIGNATURE_WINDOW))
  return head.includes(SIGNATURE)
}

export function classifyPdfError(error: unknown): 'encrypted' | 'unreadable' {
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined
  return name === 'PasswordException' ? 'encrypted' : 'unreadable'
}

export function checkExtractedPages(
  pages: string[],
): { ok: true; pages: string[] } | { ok: false; reason: 'no-text-layer' } {
  const visible = pages.join('').replace(/\s/g, '').length
  return visible < MIN_TEXT_CHARS ? { ok: false, reason: 'no-text-layer' } : { ok: true, pages }
}

// Keeps the order pdf.js reports (the order the file draws in), so columns stay together.
export function itemsToText(items: PdfTextItem[]): string {
  let text = ''
  let prev: { y: number; end: number; height: number; eol: boolean } | undefined

  for (const item of items) {
    if (item.str === '') continue
    const x = item.transform[4] ?? 0
    const y = item.transform[5] ?? 0
    const height = Math.abs(item.transform[3] ?? 0) || 10

    if (prev) {
      const movedLine = prev.eol || Math.abs(y - prev.y) > Math.max(2, prev.height * 0.5)
      if (movedLine) text += '\n'
      else if (x - prev.end > prev.height * 0.25 && !/\s$/.test(text) && !/^\s/.test(item.str)) text += ' '
    }
    text += item.str
    prev = { y, end: x + item.width, height, eol: item.hasEOL }
  }
  return text.trim()
}
