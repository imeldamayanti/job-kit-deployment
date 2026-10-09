import { createEmptyProfile } from '../profile/profile'
import type { DataState } from './state'

// Sample states for looking at D2-D5 in a dev build. Never reachable from a production build.
export const PREVIEW_STATES: Record<string, DataState> = {
  'import-preview': {
    kind: 'import-preview',
    fileName: 'job-kit-export-2026-08-19.json',
    fileSize: 4300,
    mode: 'merge',
    profile: createEmptyProfile(),
    changes: {
      merge: [
        { label: 'Personal Info', before: '2 field', after: '5 field' },
        { label: 'Education', before: '1 entri', after: '2 entri' },
        { label: 'Work Experience', before: '3 entri', after: '5 entri' },
        { label: 'Custom Field', before: '2 field', after: '4 field' },
      ],
      replace: [
        { label: 'Personal Info', before: '2 field', after: '5 field' },
        { label: 'Education', before: '1 entri', after: '2 entri' },
        { label: 'Work Experience', before: '3 entri', after: '2 entri' },
        { label: 'Custom Field', before: '2 field', after: '4 field' },
      ],
    },
  },
  'import-error': {
    kind: 'import-error',
    fileName: 'job-kit-export-2027-01-02.json',
    reason: 'unknown-version',
    detail: '3',
  },
  'confirm-delete': { kind: 'confirm-delete', typed: '' },
  done: { kind: 'done', title: '9 entri diimpor', detail: '1 profil digabung · 2 pendidikan dan 5 pengalaman ditambah.' },
}

// "#data?state=import-preview" -> the sample state of that name, or undefined.
export function previewStateFromHash(hash: string): DataState | undefined {
  const query = hash.split('?')[1]
  const name = new URLSearchParams(query ?? '').get('state')
  return name ? PREVIEW_STATES[name] : undefined
}

export function isDataHash(hash: string): boolean {
  return hash.replace(/^#/, '').split('?')[0] === 'data'
}
