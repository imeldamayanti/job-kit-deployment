import type { CoverLetter } from '../applications/types'
import { profileHash } from '../tailor/hash'
import type { CvAvailability } from '../tailor/limits'
import { SAMPLE_WEB_DEV } from '../tailor/sample-profiles'
import { editLetter } from './edit'
import type { Lang, Tone } from './language'

// What the Surat tab shows (S8, T52): the letter, why Buat surat is on or off, and the notices around it. The page reads it
// from storage; a dev build reads it from `letterViewFor` to look at every state without an AI key (PRD §8).
export type LetterView = {
  letter: CoverLetter | null
  // null while the reason is still being read.
  availability: CvAvailability | null
  busy: boolean
  // Why the last try made no letter.
  message: string | null
  // The message is a refusal (fact check or unreadable answer), not a failure to reach the provider.
  rejected: boolean
  // A model that may train on the data: asked once per application before the first document (FR-46).
  notice: string | null
  // The Profile changed since the letter was made (FR-45).
  stale: boolean
  // What the next Buat surat will use. They start as the letter's own, or the posting's language and "formal".
  lang: Lang
  tone: Tone
  // The language was read from the posting, not chosen by the person.
  langAuto: boolean
  // After Salin: whether it worked.
  copyNote: string | null
}

export const EMPTY_LETTER_VIEW: LetterView = {
  letter: null, availability: null, busy: false, message: null, rejected: false, notice: null, stale: false,
  lang: 'id', tone: 'formal', langAuto: true, copyNote: null,
}

const AT = '2026-10-14T03:42:00.000Z'

const BODY = `Yth. Tim Rekrutmen PT Contoh Karya,

Saya melamar posisi Frontend Engineer (React). Sejak Agustus 2023 saya membangun fitur dashboard pelanggan dengan React dan TypeScript di PT Contoh Teknologi, dan saya menaikkan cakupan tes dari 40% ke 70% dengan Jest.

Saya juga menulis REST API dengan Node.js dan PostgreSQL, sehingga terbiasa bekerja dari antarmuka sampai data. Setiap pekan saya ikut code review, dan kebiasaan itu membuat saya nyaman bekerja sama dalam tim.

Terima kasih atas waktu Anda. Saya senang bila bisa berdiskusi lebih lanjut.

Hormat saya,
Sari Contohwati`

function sampleLetter(change: Partial<CoverLetter> = {}): CoverLetter {
  return { id: 'l-a1', applicationId: 'a1', createdAt: AT, profileHash: profileHash(SAMPLE_WEB_DEV), lang: 'id', tone: 'formal', body: BODY, aiBody: BODY, edited: false, ...change }
}

const READY: LetterView = { ...EMPTY_LETTER_VIEW, availability: { ok: true } }

const VIEWS = {
  result: { ...READY, letter: sampleLetter() },
  empty: { ...READY },
  busy: { ...READY, busy: true },
  rejected: {
    ...READY, rejected: true,
    message: 'Hasil AI ditolak karena memuat hal yang tidak ada di Profile-mu. Istilah "kubernetes" tidak ada di pengalaman asalnya maupun daftar skill. Angka "95" tidak ada di pengalaman asalnya.',
  },
  stale: { ...READY, letter: sampleLetter({ profileHash: 'berbeda' }), stale: true },
  off: { ...READY, availability: { ok: false, reason: 'no-key', message: 'Kunci API belum diisi. Isi di Atur Lowongan.', link: 'settings' } },
  limit: { ...READY, availability: { ok: false, reason: 'daily-limit', message: 'Batas 20 panggilan AI hari ini tercapai. Batas kembali tengah malam.', link: 'settings' } },
  notice: {
    ...READY,
    notice: 'Model exo-free di OpenCode Zen bisa memakai data untuk melatih. Yang dikirim: skill, butir pengalaman, dan teks lowongan. Nama, kontak, serta nama perusahaan dan kampusmu tidak dikirim. Lanjutkan, atau ganti model di Atur Lowongan.',
  },
  noexp: {
    ...EMPTY_LETTER_VIEW,
    availability: { ok: false, reason: 'no-experience', message: 'Isi Work Experience dulu.', link: 'profile' },
  },
  edited: { ...READY, letter: editLetter(sampleLetter(), BODY.replace('Terima kasih atas waktu Anda.', 'Terima kasih sudah membaca.')) },
  english: { ...READY, lang: 'en', tone: 'casual', langAuto: false },
  copied: { ...READY, letter: sampleLetter(), copyNote: 'Surat disalin.' },
} satisfies Record<string, LetterView>

export type LetterViewName = keyof typeof VIEWS
export const LETTER_VIEW_NAMES = Object.keys(VIEWS) as LetterViewName[]
export const letterViewFor = (name: LetterViewName): LetterView => VIEWS[name]
