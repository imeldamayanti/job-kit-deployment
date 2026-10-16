import { storage } from 'wxt/utils/storage'
import { normalizeApplicationData } from '../core/applications/data'
import type { Application, ApplicationData, CoverLetter, TailoredCv } from '../core/applications/types'
import type { SaveOutcome } from '../core/profile/autosave'
import { isQuotaError } from '../core/profile/storage-errors'
import { initialDocumentUsage, type DocumentUsage } from '../core/tailor/limits'

// Three keys, apart from the profile and the feed: the list of applications stays small because the
// bodies of CVs and letters live in their own keys (RFC §3.3c).
const applicationsItem = storage.defineItem<Application[]>('local:applications', { fallback: [] })
const cvsItem = storage.defineItem<TailoredCv[]>('local:tailoredCvs', { fallback: [] })
const lettersItem = storage.defineItem<CoverLetter[]>('local:coverLetters', { fallback: [] })
// Documents (CV and letter) the AI wrote today, for the daily limit (FR-46). Not part of Export: it is a counter, not data.
const usageItem = storage.defineItem<DocumentUsage>('local:aiUsage', { fallback: initialDocumentUsage() })

async function guarded(write: () => Promise<unknown>): Promise<SaveOutcome> {
  try {
    await write()
    return { ok: true }
  } catch (error) {
    if (isQuotaError(error)) return { ok: false, reason: 'storage-full' }
    throw error
  }
}

// Read through normalizeApplicationData so a document whose application is gone never reaches the page.
export async function loadApplicationData(): Promise<ApplicationData> {
  const [applications, cvs, letters] = await Promise.all([applicationsItem.getValue(), cvsItem.getValue(), lettersItem.getValue()])
  return normalizeApplicationData({ applications, cvs, letters })
}

export async function loadApplications(): Promise<Application[]> {
  return (await loadApplicationData()).applications
}

// The common case (status, notes): only the list is written.
export function saveApplications(applications: Application[]): Promise<SaveOutcome> {
  return guarded(() => applicationsItem.setValue(applications))
}

// Import and delete touch all three. Documents are written first: if the list write is then refused,
// the documents without an application are ignored on the next read.
export function saveApplicationData(data: ApplicationData): Promise<SaveOutcome> {
  return guarded(async () => {
    await cvsItem.setValue(data.cvs)
    await lettersItem.setValue(data.letters)
    await applicationsItem.setValue(data.applications)
  })
}

// A CV edit writes only the CVs: the list of applications and the letters are not touched.
export function saveCvs(cvs: TailoredCv[]): Promise<SaveOutcome> {
  return guarded(() => cvsItem.setValue(cvs))
}

// A letter edit writes only the letters.
export function saveLetters(letters: CoverLetter[]): Promise<SaveOutcome> {
  return guarded(() => lettersItem.setValue(letters))
}

export const watchApplications = (onChange: (applications: Application[]) => void) =>
  applicationsItem.watch((value) => onChange(value ?? []))

export const loadDocumentUsage = () => usageItem.getValue()
export const saveDocumentUsage = (usage: DocumentUsage) => usageItem.setValue(usage)

// Hapus semua: applications go with the profile and the feed.
export async function clearApplicationData(): Promise<void> {
  await Promise.all([applicationsItem.removeValue(), cvsItem.removeValue(), lettersItem.removeValue(), usageItem.removeValue()])
}
