import { storage } from 'wxt/utils/storage'
import type { SaveOutcome } from '../core/profile/autosave'
import { isQuotaError } from '../core/profile/storage-errors'
import { createDefaultSettings, normalizeSettings, type FeedSettings } from '../core/feed/settings'
import type { Job, SourceRun } from '../core/feed/types'

// Kept apart from the profile: the feed is large, refetchable, and has its own limits.
const feedItem = storage.defineItem<Job[]>('local:feed', { fallback: [] })
const settingsItem = storage.defineItem<FeedSettings>('local:feedSettings', { fallback: createDefaultSettings() })
// The API key stays on this device: it is not part of the profile, the feed, or Export.
const keyItem = storage.defineItem<string>('local:aiKey', { fallback: '' })
const runsItem = storage.defineItem<SourceRun[]>('local:feedRuns', { fallback: [] })

export const loadFeed = () => feedItem.getValue()
export const saveFeed = (jobs: Job[]) => feedItem.setValue(jobs)
export const watchFeed = (onChange: (jobs: Job[]) => void) => feedItem.watch((value) => onChange(value ?? []))

export const loadRuns = () => runsItem.getValue()
export const saveRuns = (runs: SourceRun[]) => runsItem.setValue(runs)
export const watchRuns = (onChange: (runs: SourceRun[]) => void) => runsItem.watch((value) => onChange(value ?? []))

export async function loadSettings(): Promise<FeedSettings> {
  return normalizeSettings(await settingsItem.getValue())
}

export async function saveSettings(settings: FeedSettings): Promise<SaveOutcome> {
  try {
    await settingsItem.setValue(settings)
    return { ok: true }
  } catch (error) {
    if (isQuotaError(error)) return { ok: false, reason: 'storage-full' }
    throw error
  }
}

export const loadAiKey = () => keyItem.getValue()
export const saveAiKey = (key: string) => keyItem.setValue(key.trim())

// Hapus semua: the feed goes with the profile.
export async function clearFeedData(): Promise<void> {
  await Promise.all([feedItem.removeValue(), runsItem.removeValue(), settingsItem.removeValue(), keyItem.removeValue()])
}
