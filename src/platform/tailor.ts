import type { AiFailure } from '../core/ai/errors'
import type { AiUsage, ScoringClient } from '../core/ai/score'
import { attachCv } from '../core/applications/applications'
import type { SaveOutcome } from '../core/profile/autosave'
import type { CvParts } from '../core/tailor/diff'
import { editCv, restoreAiVersion, withCvOrder } from '../core/tailor/edit'
import type { CvOrder } from '../core/tailor/types'
import type { TailoredCv } from '../core/applications/types'
import { acknowledgeNotice, needsNotice, trainingNotice } from '../core/tailor/privacy'
import { countDocument, cvAvailability, type CvAvailability, type CvBlockReason } from '../core/tailor/limits'
import { tailorCv, type TailorFailure } from '../core/tailor/pipeline'
import { AI_ENABLED, AI_MODE } from '../core/build'
import { documentModel } from '../core/feed/settings'
import { documentSource } from './ai-source'
import { loadApplicationData, loadDocumentUsage, saveApplicationData, saveApplications, saveCvs, saveDocumentUsage } from './application-storage'
import { loadAiKey, loadSettings, loadState, saveState } from './feed-storage'
import { serverAccess } from './remote'
import { loadProfile } from './storage'
import { noteEvent } from './telemetry'

const newId = () => crypto.randomUUID()

// Problems that a retry cannot fix: the button stays off until the person fixes the key (FR-46).
export const LASTING: AiFailure[] = ['invalid-key', 'quota', 'no-permission']

export type BuildCvResult =
  // `note` is the line to show with a CV that came out of the Profile as written (T45), or null.
  | { ok: true; cv: TailoredCv; fallback: boolean; note: string | null; usage: AiUsage }
  | { ok: false; reason: 'missing' | 'storage-full'; message: string }
  | { ok: false; reason: 'blocked'; block: CvBlockReason; message: string; link: 'profile' | 'description' | 'settings' | 'none' }
  | { ok: false; reason: 'notice'; message: string }
  | TailorFailure

// The own-key build keeps the key, the provider's problems and the daily count; the server build asks the account instead.
export async function availabilityOf(applicationId: string, now: Date): Promise<CvAvailability> {
  const [data, profile, settings, key, state, usage, server] = await Promise.all([
    loadApplicationData(), loadProfile(), loadSettings(), AI_MODE === 'byok' ? loadAiKey() : Promise.resolve(''), loadState(), loadDocumentUsage(),
    AI_MODE === 'server' ? serverAccess() : Promise.resolve(undefined),
  ])
  const app = data.applications.find((item) => item.id === applicationId)
  if (!app) return { ok: true }
  return cvAvailability({ key, aiProblem: state.aiProblem, usage, now, limit: settings.documentLimit, jobText: app.job.description, profile, aiEnabled: AI_ENABLED, server })
}

// Whether this failure is the fact-check or the reader turning the answer down, which shows as "CV tidak ditampilkan".
export const isRejection = (failure: { reason: string; refused?: string }): boolean =>
  failure.reason === 'ungrounded' || failure.reason === 'unreadable' || (failure.reason === 'refused' && (failure.refused === 'ungrounded' || failure.refused === 'unreadable'))

export const FALLBACK_NOTE = {
  server: 'CV disusun dari profilmu apa adanya; kredit tidak terpakai.',
  byok: 'AI tidak mengembalikan butir; isi Profile dipakai apa adanya.',
} as const

// Whether "Buat CV" is on for this application, and if not why (FR-46). The screen calls this to draw the button.
export const cvStatus = (applicationId: string, now = new Date()): Promise<CvAvailability> => availabilityOf(applicationId, now)

type Options = { client?: ScoringClient; now?: Date; acknowledged?: boolean }

// "Buat CV" (FR-39): one AI call, then the CV is stored and the application points at it. A refused or failed answer
// changes nothing, so an earlier CV stays (PRD §8). In the own-key build a call that got an answer counts for the day, even if
// it was refused; in the server build the credits count instead and the server refunds what it refuses (spec §6).
export async function buildCv(applicationId: string, { client, now = new Date(), acknowledged = false }: Options = {}): Promise<BuildCvResult> {
  const [data, profile, settings, key, usage] = await Promise.all([
    loadApplicationData(), loadProfile(), loadSettings(), AI_MODE === 'byok' ? loadAiKey() : Promise.resolve(''), loadDocumentUsage(),
  ])
  const app = data.applications.find((item) => item.id === applicationId)
  if (!app) return { ok: false, reason: 'missing', message: 'Lamaran tidak ditemukan.' }

  const status = await availabilityOf(applicationId, now)
  if (!status.ok) return { ok: false, reason: 'blocked', block: status.reason, message: status.message, link: status.link }

  // The notice is about a provider that may train on the data; the server's model is ours, so it has none.
  if (AI_MODE === 'byok') {
    const docChoice = { provider: settings.ai.provider, model: documentModel(settings) }
    if (needsNotice(app, docChoice)) {
      if (!acknowledged) return { ok: false, reason: 'notice', message: trainingNotice(docChoice)?.message ?? '' }
      const saved = await saveApplications(data.applications.map((item) => (item.id === app.id ? acknowledgeNotice(item, docChoice) : item)))
      if (!saved.ok) return { ok: false, reason: 'storage-full', message: 'Penyimpanan penuh. Hapus data lama atau ekspor dulu.' }
    }
  }

  const result = await tailorCv({
    profile, application: app, now, newId,
    ...(await documentSource(settings, key, client)),
  })

  if (AI_MODE === 'byok' && (result.ok || result.reason === 'ungrounded' || result.reason === 'unreadable')) await saveDocumentUsage(countDocument(usage, now))
  const state = await loadState()
  if (!result.ok) {
    if (AI_MODE === 'byok' && result.reason === 'ai' && result.ai && LASTING.includes(result.ai)) await saveState({ ...state, aiProblem: result.ai })
    return result
  }

  const saved = await saveApplicationData(attachCv(await loadApplicationData(), result.cv, now))
  if (!saved.ok) return { ok: false, reason: 'storage-full', message: 'Penyimpanan penuh. CV belum tersimpan; hapus data lama atau ekspor dulu.' }
  if (state.aiProblem !== null) await saveState({ ...state, aiProblem: null })
  await noteEvent('cv_built')
  return { ...result, note: result.fallback ? FALLBACK_NOTE[AI_MODE === 'server' ? 'server' : 'byok'] : null }
}

async function updateCv(cvId: string, change: (cv: TailoredCv) => TailoredCv): Promise<SaveOutcome> {
  const { cvs } = await loadApplicationData()
  if (!cvs.some((cv) => cv.id === cvId)) return { ok: true }
  return saveCvs(cvs.map((cv) => (cv.id === cvId ? change(cv) : cv)))
}

// The person's hand edit, and "Kembalikan ke versi AI" (FR-41).
export const saveCvEdit = (cvId: string, parts: CvParts): Promise<SaveOutcome> => updateCv(cvId, (cv) => editCv(cv, parts))
export const restoreCv = (cvId: string): Promise<SaveOutcome> => updateCv(cvId, restoreAiVersion)
// Which of Education and Work Experience leads the CV.
export const saveCvOrder = (cvId: string, order: CvOrder): Promise<SaveOutcome> => updateCv(cvId, (cv) => withCvOrder(cv, order))
