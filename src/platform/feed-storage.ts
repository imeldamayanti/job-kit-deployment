import { storage } from 'wxt/utils/storage'
import type { SaveOutcome } from '../core/profile/autosave'
import { isQuotaError } from '../core/profile/storage-errors'
import { createDefaultSettings, normalizeSettings, type FeedSettings } from '../core/feed/settings'
import { initialFeedState, type FeedState } from '../core/feed/schedule'
import type { Job, SourceRun } from '../core/feed/types'

// Kept apart from the profile: the feed is large, refetchable, and has its own limits.
const feedItem = storage.defineItem<Job[]>('local:feed', { fallback: [] })
const settingsItem = storage.defineItem<FeedSettings>('local:feedSettings', { fallback: createDefaultSettings() })
// The API key stays on this device: it is not part of the profile, the feed, or Export.
const keyItem = storage.defineItem<string>('local:aiKey', { fallback: '' })
const stateItem = storage.defineItem<FeedState>('local:feedState', { fallback: initialFeedState() })
const runsItem = storage.defineItem<SourceRun[]>('local:feedRuns', { fallback: [] })

export const loadFeed = () => feedItem.getValue()
export const saveFeed = (jobs: Job[]) => feedItem.setValue(jobs)
export const watchFeed = (onChange: (jobs: Job[]) => void) => feedItem.watch((value) => onChange(value ?? []))

export const loadRuns = () => runsItem.getValue()
export const saveRuns = (runs: SourceRun[]) => runsItem.setValue(runs)
export const watchRuns = (onChange: (runs: SourceRun[]) => void) => runsItem.watch((value) => onChange(value ?? []))

export const loadState = async (): Promise<FeedState> => ({ ...initialFeedState(), ...(await stateItem.getValue()) })
export const saveState = (state: FeedState) => stateItem.setValue(state)
export const watchState = (onChange: (state: FeedState) => void) => stateItem.watch((value) => onChange({ ...initialFeedState(), ...value }))
export const watchSettings = (onChange: (settings: FeedSettings) => void) => settingsItem.watch((value) => onChange(normalizeSettings(value)))

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
// A new key may fix what the provider complained about, so the stored problem is cleared and the next try decides.
export async function saveAiKey(key: string): Promise<void> {
  await keyItem.setValue(key.trim())
  const state = await loadState()
  if (state.aiProblem !== null) await saveState({ ...state, aiProblem: null })
}

// Hapus semua: the feed goes with the profile.
export async function clearFeedData(): Promise<void> {
  await Promise.all([feedItem.removeValue(), runsItem.removeValue(), settingsItem.removeValue(), keyItem.removeValue(), stateItem.removeValue()])
}
