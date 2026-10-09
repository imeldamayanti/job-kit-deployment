import { storage } from 'wxt/utils/storage'
import type { Job, SourceRun } from '../core/feed/types'

// Kept apart from the profile: the feed is large, refetchable, and has its own limits.
const feedItem = storage.defineItem<Job[]>('local:feed', { fallback: [] })
const runsItem = storage.defineItem<SourceRun[]>('local:feedRuns', { fallback: [] })

export const loadFeed = () => feedItem.getValue()
export const saveFeed = (jobs: Job[]) => feedItem.setValue(jobs)
export const watchFeed = (onChange: (jobs: Job[]) => void) => feedItem.watch((value) => onChange(value ?? []))

export const loadRuns = () => runsItem.getValue()
export const saveRuns = (runs: SourceRun[]) => runsItem.setValue(runs)
export const watchRuns = (onChange: (runs: SourceRun[]) => void) => runsItem.watch((value) => onChange(value ?? []))

// Hapus semua: the feed goes with the profile.
export async function clearFeedData(): Promise<void> {
  await Promise.all([feedItem.removeValue(), runsItem.removeValue()])
}
