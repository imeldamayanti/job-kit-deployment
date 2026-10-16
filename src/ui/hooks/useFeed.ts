import { useEffect, useState } from 'react'
import { initialFeedState, type FeedState } from '../../core/feed/schedule'
import type { Job, JobStatus, SourceRun } from '../../core/feed/types'
import { setJobStatus } from '../../core/feed/view'
import { markJobApplied } from '../../platform/applications'
import { loadFeed, loadRuns, loadState, saveFeed, saveState, watchFeed, watchRuns, watchState } from '../../platform/feed-storage'

// The feed, the per-source runs and the run state, following what the background writes.
export function useFeed() {
  const [feed, setFeed] = useState<Job[]>([])
  const [runs, setRuns] = useState<SourceRun[]>([])
  const [state, setState] = useState<FeedState>(initialFeedState)

  useEffect(() => {
    void loadFeed().then(setFeed)
    void loadRuns().then(setRuns)
    void loadState().then(setState)
    const stops = [watchFeed(setFeed), watchRuns(setRuns), watchState(setState)]
    return () => stops.forEach((stop) => stop())
  }, [])

  // Opening the Lowongan page clears the badge.
  const markSeen = () => void loadState().then((current) => saveState({ ...current, seenAt: new Date().toISOString() }))

  // Reads the stored feed first: the background may have written a newer one than this page holds.
  // "Applied" goes through an application so the feed and the Lamaran page never disagree (D11).
  const changeStatus = (id: string, status: JobStatus) =>
    status === 'applied'
      ? void markJobApplied(id)
      : void loadFeed().then((stored) => saveFeed(setJobStatus(stored, id, status)))

  return { feed, runs, state, markSeen, changeStatus }
}
