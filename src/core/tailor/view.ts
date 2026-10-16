import type { TailoredCv } from '../applications/types'
import type { Profile } from '../profile/types'
import { createEmptyProfile } from '../profile/profile'
import { editCv } from './edit'
import type { CvAvailability } from './limits'
import { profileHash } from './hash'
import { SAMPLE_WEB_DEV } from './sample-profiles'

// What the CV tab shows: the CV, why Buat CV is on or off, and the notices around it. The page reads it from storage;
// a dev build reads it from `cvViewFor` to look at every state without an AI key (T40 mockup, PRD §8).
export type CvView = {
  cv: TailoredCv | null
  // null while the reason is still being read.
  availability: CvAvailability | null
  busy: boolean
  // Why the last try made no CV.
  message: string | null
  // The message is a refusal (fact check or unreadable answer), not a failure to reach the provider.
  rejected: boolean
  // A model that may train on the data: asked once per application before the first document (FR-46).
  notice: string | null
  // The Profile changed since the CV was made (FR-45).
  stale: boolean
  // The Profile, for the "Asli" side of the diff.
  profile: Profile | null
  // Unduh PDF (T50): the PDF is being made, why it could not be made, and a note after one in which letters were replaced.
  downloading: boolean
  downloadError: string | null
  downloadNote: string | null
}

export const EMPTY_CV_VIEW: CvView = {
  cv: null, availability: null, busy: false, message: null, rejected: false, notice: null, stale: false, profile: null,
  downloading: false, downloadError: null, downloadNote: null,
}

const AT = '2026-10-14T03:42:00.000Z'

const PARTS = {
  skills: ['React', 'TypeScript', 'Node.js', 'Jest', 'PostgreSQL'],
  experience: [
    {
      sourceId: 'exp-a1',
      bullets: [
        'Membangun dashboard pelanggan dengan React dan TypeScript.',
        'Menaikkan cakupan tes dari 40% ke 70% dengan Jest.',
        'Menulis REST API memakai Node.js dan PostgreSQL.',
      ],
    },
    { sourceId: 'exp-a2', bullets: ['Membantu memindahkan halaman statis ke React.'] },
  ],
  education: ['edu-a1'],
}

function sampleCv(change: Partial<TailoredCv> = {}): TailoredCv {
  return {
    id: 'cv-a1', applicationId: 'a1', createdAt: AT, profileHash: profileHash(SAMPLE_WEB_DEV),
    ...structuredClone(PARTS),
    coverage: {
      required: ['React dan TypeScript', 'Membangun dashboard dan komponen UI', 'Bekerja dengan REST API', 'Menulis tes otomatis', 'GraphQL', '3+ tahun pengalaman'],
      covered: ['React dan TypeScript', 'Membangun dashboard dan komponen UI', 'Bekerja dengan REST API', 'Menulis tes otomatis'],
      missing: ['GraphQL', '3+ tahun pengalaman'],
    },
    edited: false,
    aiVersion: structuredClone(PARTS),
    ...change,
  }
}

const READY: CvView = { ...EMPTY_CV_VIEW, availability: { ok: true }, profile: SAMPLE_WEB_DEV }

const VIEWS = {
  result: { ...READY, cv: sampleCv() },
  empty: { ...READY },
  busy: { ...READY, busy: true },
  rejected: {
    ...READY, rejected: true,
    message: 'Hasil AI ditolak karena memuat hal yang tidak ada di Profile-mu. Istilah "Kubernetes" tidak ada di pengalaman asalnya maupun daftar skill. Angka "50%" tidak ada di pengalaman asalnya.',
  },
  stale: { ...READY, cv: sampleCv({ profileHash: 'berbeda' }), stale: true },
  off: { ...READY, availability: { ok: false, reason: 'no-key', message: 'Kunci API belum diisi. Isi di Atur Lowongan.', link: 'settings' } },
  limit: { ...READY, availability: { ok: false, reason: 'daily-limit', message: 'Batas 20 panggilan AI hari ini tercapai. Batas kembali tengah malam.', link: 'settings' } },
  notice: {
    ...READY,
    notice: 'Model exo-free di OpenCode Zen bisa memakai data untuk melatih. Yang dikirim: skill, butir pengalaman, dan teks lowongan. Nama, kontak, serta nama perusahaan dan kampusmu tidak dikirim. Lanjutkan, atau ganti model di Atur Lowongan.',
  },
  noexp: {
    ...EMPTY_CV_VIEW, profile: createEmptyProfile(),
    availability: { ok: false, reason: 'no-experience', message: 'Isi Work Experience dulu.', link: 'profile' },
  },
  pdffailed: { ...READY, cv: sampleCv(), downloadError: 'PDF gagal dibuat: sebab tidak diketahui. Isi CV tetap ada di halaman ini dan bisa disalin.' },
  pdfnote: { ...READY, cv: sampleCv(), downloadNote: 'Huruf yang tidak ada di font PDF standar diganti: ễ. Periksa hasilnya sebelum dikirim.' },
  edited: {
    ...READY,
    cv: editCv(sampleCv(), {
      ...PARTS,
      experience: [{ sourceId: 'exp-a1', bullets: ['Membangun dashboard pelanggan dengan React dan TypeScript, termasuk komponen tabel.'] }, ...PARTS.experience.slice(1)],
    }),
  },
} satisfies Record<string, CvView>

export type CvViewName = keyof typeof VIEWS
export const CV_VIEW_NAMES = Object.keys(VIEWS) as CvViewName[]
export const cvViewFor = (name: CvViewName): CvView => VIEWS[name]
