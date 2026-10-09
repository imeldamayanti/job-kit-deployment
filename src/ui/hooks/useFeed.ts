import { useEffect, useState } from 'react'
import { initialFeedState, type FeedState } from '../../core/feed/schedule'
import type { Job, SourceRun } from '../../core/feed/types'
import { loadFeed, loadRuns, loadState, saveState, watchFeed, watchRuns, watchState } from '../../platform/feed-storage'

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

  return { feed, runs, state, markSeen }
}
