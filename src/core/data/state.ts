import type { Profile } from '../profile/types'

export const DELETE_WORD = 'HAPUS'

export type ImportMode = 'merge' | 'replace'
export type ImportChange = { label: string; before: string; after: string }
export type ImportErrorReason = 'not-json' | 'unknown-version' | 'wrong-shape'

export type DataState =
  | { kind: 'idle' }
  | {
      kind: 'import-preview'
      fileName: string
      fileSize: number
      mode: ImportMode
      profile: Profile
      changes: Record<ImportMode, ImportChange[]>
    }
  | { kind: 'import-error'; fileName: string; reason: ImportErrorReason; detail: string }
  | { kind: 'confirm-delete'; typed: string }
  | { kind: 'done'; title: string; detail: string }

export type DataEvent =
  | { type: 'preview-import'; fileName: string; fileSize: number; profile: Profile; changes: Record<ImportMode, ImportChange[]> }
  | { type: 'set-mode'; mode: ImportMode }
  | { type: 'reject-import'; fileName: string; reason: ImportErrorReason; detail: string }
  | { type: 'ask-delete' }
  | { type: 'type-confirm'; value: string }
  | { type: 'finish'; title: string; detail: string }
  | { type: 'cancel' }

export const initialDataState: DataState = { kind: 'idle' }

export function canConfirmDelete(typed: string): boolean {
  return typed.trim() === DELETE_WORD
}

// An event that does not apply to the current state returns that same state.
export function reduceData(state: DataState, event: DataEvent): DataState {
  switch (event.type) {
    case 'preview-import':
      return {
        kind: 'import-preview',
        fileName: event.fileName,
        fileSize: event.fileSize,
        mode: 'merge',
        profile: event.profile,
        changes: event.changes,
      }
    case 'set-mode':
      return state.kind === 'import-preview' ? { ...state, mode: event.mode } : state
    case 'reject-import':
      return { kind: 'import-error', fileName: event.fileName, reason: event.reason, detail: event.detail }
    case 'ask-delete':
      return { kind: 'confirm-delete', typed: '' }
    case 'type-confirm':
      return state.kind === 'confirm-delete' ? { kind: 'confirm-delete', typed: event.value } : state
    case 'finish':
      if (state.kind === 'import-preview' || (state.kind === 'confirm-delete' && canConfirmDelete(state.typed))) {
        return { kind: 'done', title: event.title, detail: event.detail }
      }
      return state
    case 'cancel':
      return initialDataState
  }
}
