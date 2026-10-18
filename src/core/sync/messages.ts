import type { ApiFailure } from './api'
import type { Outcome } from './engine'
import type { Kind } from './merge'

export const KIND_LABEL: Record<Kind, string> = { profile: 'Profile', applications: 'Lamaran', cvs: 'CV', letters: 'Surat' }

export function failureText(reason: ApiFailure): string {
  switch (reason) {
    case 'network': return 'Tidak terhubung ke internet atau server. Coba lagi.'
    case 'rate-limit': return 'Terlalu banyak percobaan. Tunggu beberapa menit.'
    case 'rejected': return 'Ditolak server. Periksa email dan kode, lalu coba lagi.'
    case 'signed-out': return 'Sesimu habis. Silakan masuk lagi.'
    case 'conflict': return 'Perangkat lain menulis lebih dulu. Coba lagi.'
    case 'server': return 'Ada masalah di server. Coba lagi nanti.'
  }
}

export const unlockText = (reason: 'signed-out' | 'wrong-password' | 'failed'): string =>
  reason === 'wrong-password'
    ? 'Kata sandi sinkron salah. Kata sandi ini tidak bisa dipulihkan; bila lupa, hapus akun lalu mulai lagi (data di browser ini tetap ada).'
    : reason === 'signed-out'
      ? failureText('signed-out')
      : 'Gagal membuka sinkron. Coba lagi.'

const PROBLEM: Partial<Record<Outcome, string>> = {
  conflict: 'perangkat lain menulis lebih dulu. Sinkronkan lagi.',
  failed: 'gagal. Coba lagi nanti.',
  'wrong-key': 'data online tidak bisa dibuka dengan kata sandi ini.',
}

export type SyncSummary = { text: string; needsConfirm: string[]; problems: string[] }

export function summarizeSync(outcomes: Partial<Record<Kind, Outcome>>): SyncSummary {
  const entries = Object.entries(outcomes) as [Kind, Outcome][]
  const names = (wanted: Outcome) => entries.filter(([, o]) => o === wanted).map(([k]) => KIND_LABEL[k])
  const pushed = names('pushed')
  const pulled = names('pulled')
  const parts = [pushed.length ? `Terkirim: ${pushed.join(', ')}.` : '', pulled.length ? `Diterima: ${pulled.join(', ')}.` : ''].filter(Boolean)
  const problems = entries.flatMap(([kind, outcome]) => (PROBLEM[outcome] ? [`${KIND_LABEL[kind]}: ${PROBLEM[outcome]}`] : []))
  const quiet = entries.every(([, o]) => o === 'same')
  return { text: parts.join(' ') || (quiet ? 'Sudah sama di semua perangkat.' : ''), needsConfirm: names('needs-confirm'), problems }
}
