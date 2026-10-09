import { AiError } from '../core/ai/errors'
import type { ScoringClient } from '../core/ai/score'
import { canStartRun, type FeedStage } from '../core/feed/schedule'
import { runFeed } from '../core/feed/pipeline'
import { AI_ORIGINS } from '../core/feed/settings'
import { ashbySource } from '../core/feed/sources/ashby'
import { greenhouseSource } from '../core/feed/sources/greenhouse'
import { leverSource } from '../core/feed/sources/lever'
import { createLinkedInSource } from '../core/feed/sources/linkedin'
import { remotiveSource } from '../core/feed/sources/remotive'
import { loadFeed, loadAiKey, loadRuns, loadSettings, loadState, saveFeed, saveRuns, saveState } from './feed-storage'
import { createAnthropicClient } from './ai-client'
import { offscreenParsers } from './linkedin-parser'
import { hasOrigins } from './permissions'
import { loadProfile } from './storage'

export type RunStart = 'started' | 'busy' | 'no-prefs'

async function aiClient(key: string): Promise<ScoringClient> {
  if (key.trim() !== '' && !(await hasOrigins(AI_ORIGINS))) {
    return { complete: async () => { throw new AiError('no-permission') } }
  }
  return createAnthropicClient()
}

export type RunHandle = { status: RunStart; finished: Promise<void> }

// Runs the whole feed and keeps `feedState` current so every open page can follow it.
// `status` answers at once (started, already running, nothing to search); `finished` ends with the run.
export async function executeRun({ auto }: { auto: boolean }): Promise<RunHandle> {
  const now = new Date()
  const [profile, settings, key, feed, runs, state] = await Promise.all([
    loadProfile(), loadSettings(), loadAiKey(), loadFeed(), loadRuns(), loadState(),
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
        client: await aiClient(key),
        sources: [greenhouseSource, leverSource, ashbySource, remotiveSource, createLinkedInSource(offscreenParsers)],
        onStage: stage,
      })
      await saveFeed(result.feed)
      await saveRuns(result.runs)
      const done = new Date().toISOString()
      await saveState({
        ...(await loadState()),
        running: false, stage: 'idle', lastRunAt: done,
        lastAutoRunAt: auto ? done : state.lastAutoRunAt,
        aiProblem: result.aiProblem, paused: result.paused, newJobs: result.newJobs, usage: result.usage,
      })
    } catch (error) {
      await saveState({ ...(await loadState()), running: false, stage: 'idle' })
      throw error
    }
  })()
  return { status: 'started', finished }
}
