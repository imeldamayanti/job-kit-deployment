import type { AiFailure } from '../ai/errors'
import type { Job, JobSourceId } from './types'

export type FeedStage = 'idle' | 'fetch' | 'merge' | 'score' | 'save'

// What the options page needs to know about the feed, kept in storage so any open page can follow it.
export type FeedState = {
  running: boolean
  startedAt: string
  stage: FeedStage
  lastRunAt: string
  // Only automatic runs count here: at most one a day (PRD §8).
  lastAutoRunAt: string
  aiProblem: AiFailure | null
  paused: JobSourceId[]
  newJobs: number
  usage: { inputTokens: number; outputTokens: number }
  // When the Lowongan page was last opened; the sidebar badge counts what arrived after.
  seenAt: string
}

export const initialFeedState = (): FeedState => ({
  running: false, startedAt: '', stage: 'idle', lastRunAt: '', lastAutoRunAt: '', aiProblem: null, paused: [], newJobs: 0,
  usage: { inputTokens: 0, outputTokens: 0 }, seenAt: '',
})

const STUCK_AFTER_MS = 10 * 60 * 1000

function atTime(day: Date, fetchTime: string): Date {
  const [hours, minutes] = fetchTime.split(':').map(Number)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes)
}

export function nextRunTime(now: Date, fetchTime: string): Date {
  const today = atTime(now, fetchTime)
  if (today.getTime() > now.getTime()) return today
  return atTime(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), fetchTime)
}

// An automatic run is due once today's time has come and no automatic run has covered it yet.
// A run missed because Chrome was closed is picked up the next time this is asked (PRD §8).
export function isRunDue(lastAutoRunAt: string, now: Date, fetchTime: string): boolean {
  const scheduled = atTime(now, fetchTime)
  if (now.getTime() < scheduled.getTime()) return false
  return lastAutoRunAt === '' || Date.parse(lastAutoRunAt) < scheduled.getTime()
}

export function canStartRun(state: FeedState, now: Date): boolean {
  if (!state.running) return true
  return now.getTime() - Date.parse(state.startedAt) > STUCK_AFTER_MS
}

export function countNew(feed: readonly Job[], seenAt: string): number {
  return feed.filter((job) => job.status === 'new' && (seenAt === '' || job.firstSeenAt > seenAt)).length
}
