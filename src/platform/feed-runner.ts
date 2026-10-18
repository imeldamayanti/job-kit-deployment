import { canStartRun, type FeedStage } from '../core/feed/schedule'
import { runFeed } from '../core/feed/pipeline'
import { ashbySource } from '../core/feed/sources/ashby'
import { greenhouseSource } from '../core/feed/sources/greenhouse'
import { leverSource } from '../core/feed/sources/lever'
import { createLinkedInSource } from '../core/feed/sources/linkedin'
import { remotiveSource } from '../core/feed/sources/remotive'
import { loadFeed, loadAiKey, loadRuns, loadSettings, loadState, saveFeed, saveRuns, saveState } from './feed-storage'
import { AI_ENABLED } from '../core/build'
import { clientWithPermission } from './ai-client'
import { offscreenParsers } from './linkedin-parser'
import { loadProfile } from './storage'
import { noteEvent } from './telemetry'

export type RunStart = 'started' | 'busy' | 'no-prefs'

export type RunHandle = { status: RunStart; finished: Promise<void> }

// Runs the whole feed and keeps `feedState` current so every open page can follow it.
// `status` answers at once (started, already running, nothing to search); `finished` ends with the run.
export async function executeRun({ auto }: { auto: boolean }): Promise<RunHandle> {
  const now = new Date()
  const [profile, settings, key, feed, runs, state] = await Promise.all([
    loadProfile(), loadSettings(), AI_ENABLED ? loadAiKey() : Promise.resolve(''), loadFeed(), loadRuns(), loadState(),
  ])
  const none = { finished: Promise.resolve() }
  if (profile.jobPrefs.roles.length === 0) return { status: 'no-prefs', ...none }
  if (!canStartRun(state, now)) return { status: 'busy', ...none }

  const stage = (next: FeedStage) => void saveState({ ...state, running: true, startedAt: now.toISOString(), stage: next })
  await saveState({ ...state, running: true, startedAt: now.toISOString(), stage: 'fetch' })
  const finished = (async () => {
    try {
      const result = await runFeed({
        profile, settings, key, feed, runs, now,
        ctx: { fetch: (url, init) => fetch(url, init), now, companies: settings.companies },
        client: await clientWithPermission(key, settings.ai.provider), // no key (shared build): the pipeline scores by rules and never calls the client
        sources: [greenhouseSource, leverSource, ashbySource, remotiveSource, createLinkedInSource(offscreenParsers)],
        onStage: stage,
      })
      await saveFeed(result.feed)
      await saveRuns(result.runs)
      const done = new Date().toISOString()
      await noteEvent('feed_run')
      await saveState({
        ...(await loadState()),
        running: false, stage: 'idle', lastRunAt: done,
        lastAutoRunAt: auto ? done : state.lastAutoRunAt,
        aiProblem: AI_ENABLED ? result.aiProblem : null, paused: result.paused, newJobs: result.newJobs, usage: result.usage,
      })
    } catch (error) {
      await noteEvent('error')
      await saveState({ ...(await loadState()), running: false, stage: 'idle' })
      throw error
    }
  })()
  return { status: 'started', finished }
}
