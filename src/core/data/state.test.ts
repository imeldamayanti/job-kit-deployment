import { describe, expect, it } from 'vitest'
import { CLEAN_ID } from '../../../fixtures/cv/text-fixtures'
import { parseCv } from '../cv/parse'
import { buildCvPreview, defaultSelection } from '../cv/preview'
import { createEmptyProfile } from '../profile/profile'
import { canConfirmDelete, DELETE_WORD, initialDataState, reduceData, type DataState } from './state'

const changes = {
  merge: [{ label: 'Work Experience', before: '3 entri', after: '5 entri' }],
  replace: [{ label: 'Work Experience', before: '3 entri', after: '4 entri' }],
}

const preview: DataState = {
  kind: 'import-preview',
  fileName: 'job-kit-export.json',
  fileSize: 4096,
  mode: 'merge',
  profile: createEmptyProfile(),
  changes,
}

describe('reduceData', () => {
  it('starts idle', () => {
    expect(initialDataState).toEqual({ kind: 'idle' })
  })

  it('opens the import preview with merge as the default choice', () => {
    const profile = createEmptyProfile()
    const next = reduceData(initialDataState, {
      type: 'preview-import',
      fileName: 'a.json',
      fileSize: 10,
      profile,
      changes,
    })
    expect(next).toEqual({ kind: 'import-preview', fileName: 'a.json', fileSize: 10, mode: 'merge', profile, changes })
  })

  it('switches between merge and replace only while previewing', () => {
    expect(reduceData(preview, { type: 'set-mode', mode: 'replace' })).toMatchObject({ mode: 'replace' })
    expect(reduceData(initialDataState, { type: 'set-mode', mode: 'replace' })).toBe(initialDataState)
  })

  it('shows the reason when an import is rejected', () => {
    const next = reduceData(initialDataState, { type: 'reject-import', fileName: 'x.json', reason: 'unknown-version', detail: '3' })
    expect(next).toEqual({ kind: 'import-error', fileName: 'x.json', reason: 'unknown-version', detail: '3' })
  })

  it('asks for the confirmation word before deleting', () => {
    const asked = reduceData(initialDataState, { type: 'ask-delete' })
    expect(asked).toEqual({ kind: 'confirm-delete', typed: '' })
    expect(reduceData(asked, { type: 'type-confirm', value: 'HAP' })).toEqual({ kind: 'confirm-delete', typed: 'HAP' })
  })

  it('ignores typing outside the delete confirmation', () => {
    expect(reduceData(initialDataState, { type: 'type-confirm', value: 'x' })).toBe(initialDataState)
  })

  it('finishes an import from the preview', () => {
    const next = reduceData(preview, { type: 'finish', title: '5 entri diimpor', detail: '1 profil digabung.' })
    expect(next).toEqual({ kind: 'done', title: '5 entri diimpor', detail: '1 profil digabung.' })
  })

  it('refuses to finish a delete until the word is typed', () => {
    const asked: DataState = { kind: 'confirm-delete', typed: 'hapu' }
    expect(reduceData(asked, { type: 'finish', title: 't', detail: 'd' })).toBe(asked)
    const ready: DataState = { kind: 'confirm-delete', typed: DELETE_WORD }
    expect(reduceData(ready, { type: 'finish', title: 't', detail: 'd' }).kind).toBe('done')
  })

  it('cannot finish from idle', () => {
    expect(reduceData(initialDataState, { type: 'finish', title: 't', detail: 'd' })).toBe(initialDataState)
  })

  it('returns to idle on cancel from any state', () => {
    expect(reduceData(preview, { type: 'cancel' })).toEqual({ kind: 'idle' })
    expect(reduceData({ kind: 'confirm-delete', typed: '' }, { type: 'cancel' })).toEqual({ kind: 'idle' })
  })
})

describe('canConfirmDelete', () => {
  it('needs the exact word, ignoring surrounding spaces', () => {
    expect(canConfirmDelete(DELETE_WORD)).toBe(true)
    expect(canConfirmDelete(`  ${DELETE_WORD} `)).toBe(true)
    expect(canConfirmDelete('hapus')).toBe(false)
    expect(canConfirmDelete('')).toBe(false)
  })
})

describe('reduceData Import CV', () => {
  const draft = parseCv(CLEAN_ID)
  const { rows, unparsed } = buildCvPreview(draft, createEmptyProfile())
  const cvPreview = reduceData(initialDataState, { type: 'preview-cv', fileName: 'cv.pdf', fileSize: 100, draft, rows, unparsed })

  it('shows that a file is being read', () => {
    expect(reduceData(initialDataState, { type: 'start-parsing', fileName: 'cv.pdf' })).toEqual({ kind: 'parsing', fileName: 'cv.pdf' })
  })

  it('opens the CV preview with the empty fields selected', () => {
    expect(cvPreview).toEqual({
      kind: 'import-cv-preview',
      fileName: 'cv.pdf',
      fileSize: 100,
      draft,
      rows,
      unparsed,
      selected: defaultSelection(rows),
    })
  })

  it('toggles one field only while previewing a CV', () => {
    const off = reduceData(cvPreview, { type: 'toggle-field', id: 'personal.firstName' })
    expect(off.kind === 'import-cv-preview' && off.selected).not.toContain('personal.firstName')
    const on = reduceData(off, { type: 'toggle-field', id: 'personal.firstName' })
    expect(on.kind === 'import-cv-preview' && on.selected).toContain('personal.firstName')
    expect(reduceData(initialDataState, { type: 'toggle-field', id: 'x' })).toBe(initialDataState)
  })

  it('finishes only when at least one field is selected', () => {
    expect(reduceData(cvPreview, { type: 'finish', title: 't', detail: 'd' }).kind).toBe('done')
    const none = { ...cvPreview, selected: [] } as DataState
    expect(reduceData(none, { type: 'finish', title: 't', detail: 'd' })).toBe(none)
  })

  it('cannot finish a CV preview that detected nothing', () => {
    const empty = reduceData(initialDataState, { type: 'preview-cv', fileName: 'cv.pdf', fileSize: 1, draft, rows: [], unparsed: [] })
    expect(reduceData(empty, { type: 'finish', title: 't', detail: 'd' })).toBe(empty)
  })

  it('turns a read failure into an error screen and leaves from it on cancel', () => {
    const reading = reduceData(initialDataState, { type: 'start-parsing', fileName: 'scan.pdf' })
    const failed = reduceData(reading, { type: 'reject-import', fileName: 'scan.pdf', reason: 'no-text-layer', detail: '' })
    expect(failed).toEqual({ kind: 'import-error', fileName: 'scan.pdf', reason: 'no-text-layer', detail: '' })
    expect(reduceData(reading, { type: 'cancel' })).toEqual({ kind: 'idle' })
  })
})
