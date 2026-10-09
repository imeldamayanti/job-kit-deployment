import { describe, expect, it } from 'vitest'
import { CLEAN_ID, NO_IDENTITY } from '../../../fixtures/cv/text-fixtures'
import { createEmptyProfile } from '../profile/profile'
import { eventForPdfResult } from './import-event'
import { parseCv } from './parse'
import { buildCvPreview } from './preview'

const file = { name: 'cv-sintetis.pdf', size: 34552 }

describe('eventForPdfResult', () => {
  it('turns the extracted pages into a preview of what would be filled', () => {
    const pages = CLEAN_ID.split('\f')
    const event = eventForPdfResult(file, { ok: true, pages }, createEmptyProfile())
    const draft = parseCv(CLEAN_ID)
    const { rows, unparsed } = buildCvPreview(draft, createEmptyProfile())
    expect(event).toEqual({ type: 'preview-cv', fileName: 'cv-sintetis.pdf', fileSize: 34552, draft, rows, unparsed })
  })

  it('reads the pages of a longer CV as one text', () => {
    const [first, second] = CLEAN_ID.split('Pendidikan') as [string, string]
    const event = eventForPdfResult(file, { ok: true, pages: [first, `Pendidikan${second}`] }, createEmptyProfile())
    expect(event.type === 'preview-cv' && event.rows.some((row) => row.id === 'education.0')).toBe(true)
  })

  it('still previews a readable PDF where nothing was recognised, with no rows', () => {
    const event = eventForPdfResult(file, { ok: true, pages: [NO_IDENTITY] }, createEmptyProfile())
    expect(event).toMatchObject({ type: 'preview-cv', rows: [] })
  })

  it.each([
    ['encrypted', 'encrypted'],
    ['no-text-layer', 'no-text-layer'],
    ['unreadable', 'unreadable'],
    ['not-pdf', 'unreadable'],
  ] as const)('rejects a %s PDF as %s, naming the file', (reason, expected) => {
    expect(eventForPdfResult(file, { ok: false, reason }, createEmptyProfile())).toEqual({
      type: 'reject-import',
      fileName: 'cv-sintetis.pdf',
      reason: expected,
      detail: '',
    })
  })
})
