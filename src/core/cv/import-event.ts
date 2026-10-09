import type { DataEvent } from '../data/state'
import type { Profile } from '../profile/types'
import { parseCv } from './parse'
import type { PdfReadResult } from './pdf-text'
import { buildCvPreview } from './preview'

// What the Data page should do once a PDF has been read: preview it, or say why it was refused.
export function eventForPdfResult(
  file: { name: string; size: number },
  result: PdfReadResult,
  current: Profile,
): Extract<DataEvent, { type: 'preview-cv' | 'reject-import' }> {
  if (!result.ok) {
    // A file that is not a PDF never gets this far (the type is decided from the content first).
    const reason = result.reason === 'not-pdf' ? 'unreadable' : result.reason
    return { type: 'reject-import', fileName: file.name, reason, detail: '' }
  }
  const draft = parseCv(result.pages.join('\n'))
  const { rows, unparsed } = buildCvPreview(draft, current)
  return { type: 'preview-cv', fileName: file.name, fileSize: file.size, draft, rows, unparsed }
}
