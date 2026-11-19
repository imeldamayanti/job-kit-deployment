import { canStartRun, type FeedStage } from '../core/feed/schedule'
import { runFeed } from '../core/feed/pipeline'
import { ashbySource } from '../core/feed/sources/ashby'
import { greenhouseSource } from '../core/feed/sources/greenhouse'
import { leverSource } from '../core/feed/sources/lever'
import { createLinkedInSource } from '../core/feed/sources/linkedin'
import { remotiveSource } from '../core/feed/sources/remotive'
import { createThreadSource } from '../core/feed/sources/thread'
import { wellfoundSource } from '../core/feed/sources/wellfound'
import { jobStreetSource } from '../core/feed/sources/jobstreet'
import { mcfSource } from '../core/feed/sources/mycareersfuture'
import { ycSource } from '../core/feed/sources/yc'
import { openThreadSession } from './thread-collector'
import { loadFeed, loadAiKey, loadRuns, loadSettings, loadState, saveFeed, saveRuns, saveState } from './feed-storage'
import { AI_MODE, THREAD_ENABLED } from '../core/build'
import { clientWithPermission } from './ai-client'
import { offscreenParsers } from './linkedin-parser'
import { loadProfile } from './storage'
import { storedUserId } from './sync'
import { noteEvent } from './telemetry'

// `signed-out`: the server build asks for an account before it does anything, so nothing runs for nobody.
export type RunStart = 'started' | 'busy' | 'no-prefs' | 'signed-out'

export type RunHandle = { status: RunStart; finished: Promise<void> }

// Runs the whole feed and keeps `feedState` current so every open page can follow it.
// `status` answers at once (started, already running, nothing to search); `finished` ends with the run.
// The server build never asks an AI here: the daily feed is scored by rules, and "Nilai dengan AI" is the person's own, paid action.
export async function executeRun({ auto }: { auto: boolean }): Promise<RunHandle> {
  const none = { finished: Promise.resolve() }
  if (AI_MODE === 'server' && (await storedUserId()) === null) return { status: 'signed-out', ...none }
  const now = new Date()
  const [profile, settings, key, feed, runs, state] = await Promise.all([
    loadProfile(), loadSettings(), AI_MODE === 'byok' ? loadAiKey() : Promise.resolve(''), loadFeed(), loadRuns(), loadState(),
  ])
  if (profile.jobPrefs.roles.length === 0) return { status: 'no-prefs', ...none }
  if (!canStartRun(state, now)) return { status: 'busy', ...none }

  const stage = (next: FeedStage) => void saveState({ ...state, running: true, startedAt: now.toISOString(), stage: next })
  await saveState({ ...state, running: true, startedAt: now.toISOString(), stage: 'fetch' })
  const finished = (async () => {
    try {
      const result = await runFeed({
        profile, settings, key, feed, runs, now,
        ctx: { fetch: (url, init) => fetch(url, init), now, companies: settings.companies },
        client: AI_MODE === 'byok' ? await clientWithPermission(key, settings.ai.provider) : undefined,
        aiScoring: AI_MODE === 'byok',
        sources: [
          greenhouseSource, leverSource, ashbySource, remotiveSource, createLinkedInSource(offscreenParsers), ycSource, wellfoundSource, jobStreetSource, mcfSource,
          ...(THREAD_ENABLED ? [createThreadSource({ open: openThreadSession })] : []),
        ],
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
        aiProblem: AI_MODE === 'byok' ? result.aiProblem : null, paused: result.paused, newJobs: result.newJobs, usage: result.usage,
      })
    } catch (error) {
      await noteEvent('error')
      await saveState({ ...(await loadState()), running: false, stage: 'idle' })
      throw error
    }
  })()
  return { status: 'started', finished }
}
