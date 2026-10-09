import { describe, expect, it } from 'vitest'
import { canConfirmDelete, DELETE_WORD, initialDataState, reduceData, type DataState } from './state'

const preview: DataState = {
  kind: 'import-preview',
  fileName: 'job-kit-export.json',
  fileSize: 4096,
  mode: 'merge',
  changes: [{ label: 'Work Experience', before: '3 entri', after: '5 entri' }],
}

describe('reduceData', () => {
  it('starts idle', () => {
    expect(initialDataState).toEqual({ kind: 'idle' })
  })

  it('opens the import preview with merge as the default choice', () => {
    const next = reduceData(initialDataState, {
      type: 'preview-import',
      fileName: 'a.json',
      fileSize: 10,
      changes: [],
    })
    expect(next).toMatchObject({ kind: 'import-preview', fileName: 'a.json', mode: 'merge' })
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
