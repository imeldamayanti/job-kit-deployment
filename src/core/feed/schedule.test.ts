import { describe, expect, it } from 'vitest'
import { canStartRun, countNew, isRunDue, nextRunTime, type FeedState, initialFeedState } from './schedule'
import type { Job } from './types'

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m) // local time, October 2026

describe('nextRunTime', () => {
  it('is today when the time has not come yet', () => {
    expect(nextRunTime(at(10, 7, 30), '08:00')).toEqual(at(10, 8))
  })

  it('is tomorrow once the time has passed or is now', () => {
    expect(nextRunTime(at(10, 9), '08:00')).toEqual(at(11, 8))
    expect(nextRunTime(at(10, 8), '08:00')).toEqual(at(11, 8))
  })
})

describe('isRunDue', () => {
  it('is not due before the time', () => {
    expect(isRunDue('', at(10, 7), '08:00')).toBe(false)
  })

  it('is due after the time when nothing ran yet', () => {
    expect(isRunDue('', at(10, 8, 1), '08:00')).toBe(true)
  })

  it('is not due again after the automatic run of today', () => {
    expect(isRunDue(at(10, 8, 2).toISOString(), at(10, 20), '08:00')).toBe(false)
  })

  it('is due when the last automatic run was yesterday', () => {
    expect(isRunDue(at(9, 8, 2).toISOString(), at(10, 8, 5), '08:00')).toBe(true)
  })

  it('runs a missed day when Chrome opens late', () => {
    expect(isRunDue(at(8, 8, 2).toISOString(), at(10, 13), '08:00')).toBe(true)
  })

  it('treats a run at 07:00 (before the scheduled time) as not covering today', () => {
    expect(isRunDue(at(10, 7).toISOString(), at(10, 8, 30), '08:00')).toBe(true)
  })
})

describe('canStartRun', () => {
  const running = (startedAt: Date): FeedState => ({ ...initialFeedState(), running: true, startedAt: startedAt.toISOString(), stage: 'fetch' })

  it('allows a run when none is going', () => {
    expect(canStartRun(initialFeedState(), at(10, 8))).toBe(true)
  })

  it('refuses a second run while one is going', () => {
    expect(canStartRun(running(at(10, 8)), at(10, 8, 2))).toBe(false)
  })

  it('allows a new run when the old one looks stuck', () => {
    expect(canStartRun(running(at(10, 8)), at(10, 8, 30))).toBe(true)
  })
})

describe('countNew', () => {
  const job = (id: string, status: Job['status'], firstSeenAt: string) => ({ id, status, firstSeenAt }) as Job

  it('counts new jobs first seen after the page was last opened', () => {
    const feed = [job('a', 'new', '2026-10-10T08:00:00.000Z'), job('b', 'new', '2026-10-09T08:00:00.000Z'), job('c', 'saved', '2026-10-10T08:00:00.000Z')]
    expect(countNew(feed, '2026-10-09T12:00:00.000Z')).toBe(1)
  })

  it('counts every new job when the page was never opened', () => {
    expect(countNew([job('a', 'new', '2026-10-10T08:00:00.000Z')], '')).toBe(1)
  })
})
