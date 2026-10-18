import type { AiUsage, ScoringClient } from '../core/ai/score'
import { attachLetter } from '../core/applications/applications'
import type { CoverLetter } from '../core/applications/types'
import { editLetter, restoreAiLetter } from '../core/letters/edit'
import type { Lang, Tone } from '../core/letters/language'
import { writeLetter, type LetterFailure } from '../core/letters/pipeline'
import type { SaveOutcome } from '../core/profile/autosave'
import { acknowledgeNotice, needsNotice, trainingNotice } from '../core/tailor/privacy'
import { countDocument, type CvAvailability, type CvBlockReason } from '../core/tailor/limits'
import { documentModel } from '../core/feed/settings'
import { clientWithPermission } from './ai-client'
import { loadApplicationData, loadDocumentUsage, saveApplicationData, saveApplications, saveDocumentUsage, saveLetters } from './application-storage'
import { loadAiKey, loadSettings, loadState, saveState } from './feed-storage'
import { loadProfile } from './storage'
import { availabilityOf, LASTING } from './tailor'

const newId = () => crypto.randomUUID()

export type BuildLetterResult =
  | { ok: true; letter: CoverLetter; usage: AiUsage }
  | { ok: false; reason: 'missing' | 'storage-full'; message: string }
  | { ok: false; reason: 'blocked'; block: CvBlockReason; message: string; link: 'profile' | 'description' | 'settings' | 'none' }
  | { ok: false; reason: 'notice'; message: string }
  | LetterFailure

// Whether "Buat surat" is on, and if not why. The same rules as the CV, and the same daily count (FR-46).
export const letterStatus = (applicationId: string, now = new Date()): Promise<CvAvailability> => availabilityOf(applicationId, now)

type Options = { client?: ScoringClient; now?: Date; acknowledged?: boolean; lang?: Lang; tone?: Tone }

// "Buat surat" (FR-43): one AI call, then the letter is stored and the application points at it. A refused or failed answer
// changes nothing, so an earlier letter stays (PRD §8). A call that got an answer counts for the day, even if it was refused.
export async function buildLetter(applicationId: string, { client, now = new Date(), acknowledged = false, lang, tone }: Options = {}): Promise<BuildLetterResult> {
  const [data, profile, settings, key, usage] = await Promise.all([loadApplicationData(), loadProfile(), loadSettings(), loadAiKey(), loadDocumentUsage()])
  const app = data.applications.find((item) => item.id === applicationId)
  if (!app) return { ok: false, reason: 'missing', message: 'Lamaran tidak ditemukan.' }

  const status = await availabilityOf(applicationId, now)
  if (!status.ok) return { ok: false, reason: 'blocked', block: status.reason, message: status.message, link: status.link }

  const docChoice = { provider: settings.ai.provider, model: documentModel(settings) }
  if (needsNotice(app, docChoice)) {
    if (!acknowledged) return { ok: false, reason: 'notice', message: trainingNotice(docChoice)?.message ?? '' }
    const saved = await saveApplications(data.applications.map((item) => (item.id === app.id ? acknowledgeNotice(item, docChoice) : item)))
    if (!saved.ok) return { ok: false, reason: 'storage-full', message: 'Penyimpanan penuh. Hapus data lama atau ekspor dulu.' }
  }

  const result = await writeLetter({
    profile, application: app, lang, tone, client: client ?? (await clientWithPermission(key, settings.ai.provider)), key, model: documentModel(settings), now, newId,
  })

  if (result.ok || result.reason === 'ungrounded' || result.reason === 'unreadable') await saveDocumentUsage(countDocument(usage, now))
  const state = await loadState()
  if (!result.ok) {
    if (result.reason === 'ai' && result.ai && LASTING.includes(result.ai)) await saveState({ ...state, aiProblem: result.ai })
    return result
  }

  const saved = await saveApplicationData(attachLetter(await loadApplicationData(), result.letter, now))
  if (!saved.ok) return { ok: false, reason: 'storage-full', message: 'Penyimpanan penuh. Surat belum tersimpan; hapus data lama atau ekspor dulu.' }
  if (state.aiProblem !== null) await saveState({ ...state, aiProblem: null })
  return result
}

async function updateLetter(letterId: string, change: (letter: CoverLetter) => CoverLetter): Promise<SaveOutcome> {
  const { letters } = await loadApplicationData()
  if (!letters.some((letter) => letter.id === letterId)) return { ok: true }
  return saveLetters(letters.map((letter) => (letter.id === letterId ? change(letter) : letter)))
}

// The person's edit, and "Kembalikan ke versi AI" (FR-43).
export const saveLetterEdit = (letterId: string, body: string): Promise<SaveOutcome> => updateLetter(letterId, (letter) => editLetter(letter, body))
export const restoreLetter = (letterId: string): Promise<SaveOutcome> => updateLetter(letterId, restoreAiLetter)
