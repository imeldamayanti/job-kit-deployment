import { parseCv } from '../cv/parse'
import { buildCvPreview } from '../cv/preview'
import { createEmptyProfile } from '../profile/profile'
import { initialDataState, reduceData, type DataState } from './state'

// Made-up CV text that shows every kind of row: a clash with a filled field, a "Periksa lagi",
// a skipped entry that cannot be placed.
const SAMPLE_CV = `Rani Wijaya Contoh
rani.contoh@example.test | 0812 0000 0001 | Bandung
linkedin.com/in/rani-contoh-
sintetis
Pendidikan
Universitas Contoh Nusantara
S1 Teknik Informatika, IPK 3,62
2018 - 2022
Pengalaman Kerja
Software Engineer, PT Contoh Teknologi
Agustus 2022 - Sekarang
Membangun fitur web.
Kasir
2019 - 2020`

function sampleCvPreview(): DataState {
  const profile = createEmptyProfile()
  profile.personal.lastName = 'Wijaya'
  const draft = parseCv(SAMPLE_CV)
  const { rows, unparsed } = buildCvPreview(draft, profile)
  return reduceData(initialDataState, { type: 'preview-cv', fileName: 'cv-rani.pdf', fileSize: 34552, draft, rows, unparsed })
}

const cvError = (reason: 'no-text-layer' | 'encrypted' | 'unreadable'): DataState => ({
  kind: 'import-error',
  fileName: 'cv-rani.pdf',
  reason,
  detail: '',
})

// Sample states for looking at D2-D5 in a dev build. Never reachable from a production build.
export const PREVIEW_STATES: Record<string, DataState> = {
  'import-preview': {
    kind: 'import-preview',
    fileName: 'job-kit-export-2026-08-19.json',
    fileSize: 4300,
    mode: 'merge',
    profile: createEmptyProfile(),
    applications: null,
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
  parsing: { kind: 'parsing', fileName: 'cv-rani.pdf' },
  'cv-preview': sampleCvPreview(),
  'cv-empty': reduceData(initialDataState, {
    type: 'preview-cv',
    fileName: 'cv-kosong.pdf',
    fileSize: 12000,
    draft: parseCv(''),
    rows: [],
    unparsed: [],
  }),
  'cv-error-scan': cvError('no-text-layer'),
  'cv-error-locked': cvError('encrypted'),
  'cv-error-broken': cvError('unreadable'),
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
