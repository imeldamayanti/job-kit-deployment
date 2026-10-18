import type { AiFailure } from '../ai/errors'
import type { Profile } from '../profile/types'

// local:aiUsage (RFC §3.3c): documents (CV and letter) made today. Apart from the 50-call budget of job scoring.
export type DocumentUsage = { date: string; documents: number }

export { DEFAULT_DOCUMENT_LIMIT } from '../feed/settings'
export const initialDocumentUsage = (): DocumentUsage => ({ date: '', documents: 0 })

const two = (n: number) => String(n).padStart(2, '0')
// The person's calendar day: the limit resets at local midnight (PRD §8).
export const localDay = (now: Date) => `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`

export const documentsToday = (usage: DocumentUsage, now: Date): number => (usage.date === localDay(now) ? usage.documents : 0)
export const countDocument = (usage: DocumentUsage, now: Date): DocumentUsage => ({ date: localDay(now), documents: documentsToday(usage, now) + 1 })

// Why Buat CV is off, and where the person can fix it (FR-46, PRD §8). Everything else in Lamaran keeps working.
export type CvBlockReason = 'no-experience' | 'no-text' | 'no-key' | 'invalid-key' | 'quota' | 'no-permission' | 'daily-limit' | 'ai-unavailable'
export type CvAvailability = { ok: true } | { ok: false; reason: CvBlockReason; message: string; link: 'profile' | 'description' | 'settings' | 'none' }

export type CvAvailabilityInput = {
  key: string
  // The last problem the provider reported for this key (feed state), or null.
  aiProblem: AiFailure | null
  usage: DocumentUsage
  now: Date
  limit: number
  jobText: string
  profile: Profile
  // False in the shared build, which has no AI at all. Missing means on.
  aiEnabled?: boolean
}

const off = (reason: CvBlockReason, message: string, link: 'profile' | 'description' | 'settings' | 'none'): CvAvailability => ({ ok: false, reason, message, link })

export function cvAvailability({ key, aiProblem, usage, now, limit, jobText, profile, aiEnabled = true }: CvAvailabilityInput): CvAvailability {
  if (!aiEnabled) return off('ai-unavailable', 'Fitur AI belum tersedia di versi ini.', 'none')
  if (profile.experience.length === 0) return off('no-experience', 'Isi Work Experience dulu.', 'profile')
  if (jobText.trim() === '') return off('no-text', 'Tempel teks lowongan dulu.', 'description')
  if (key.trim() === '') return off('no-key', 'Kunci API belum diisi. Isi di Atur Lowongan.', 'settings')
  if (aiProblem === 'invalid-key') return off('invalid-key', 'Kunci ditolak penyedia. Periksa di Atur Lowongan.', 'settings')
  if (aiProblem === 'quota') return off('quota', 'Kuota atau saldo di penyedia habis. Periksa di Atur Lowongan.', 'settings')
  if (aiProblem === 'no-permission') return off('no-permission', 'Izin untuk penyedia AI belum diberikan. Beri di Atur Lowongan.', 'settings')
  if (documentsToday(usage, now) >= limit) return off('daily-limit', `Batas ${limit} panggilan AI hari ini tercapai. Batas kembali tengah malam.`, 'settings')
  return { ok: true }
}
