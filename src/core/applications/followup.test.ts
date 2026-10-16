import { describe, expect, it } from 'vitest'
import { dueApplications, dueCount, dueSummary, isDue, todayKey } from './followup'
import type { AppStatus, Application } from './types'

function app(company: string, followUpAt: string | null, status: AppStatus = 'applied'): Application {
  return {
    id: company, jobId: null, status, cvId: null, letterId: null, followUpAt, notes: '', events: [], createdAt: '2026-10-01T03:00:00.000Z', updatedAt: '2026-10-01T03:00:00.000Z',
    job: { title: `Judul ${company}`, company, url: '', source: 'manual', description: '', capturedAt: '2026-10-01T03:00:00.000Z' },
  }
}

const TODAY = '2026-10-15'

describe('todayKey', () => {
  it('is the calendar day on the person’s own clock, YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05')
    expect(todayKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })
})

describe('isDue', () => {
  it('is due on the day itself and after it', () => {
    expect(isDue(app('A', '2026-10-15'), TODAY)).toBe(true)
    expect(isDue(app('A', '2026-10-10'), TODAY)).toBe(true)
  })

  it('is not due before the day, or with no date', () => {
    expect(isDue(app('A', '2026-10-16'), TODAY)).toBe(false)
    expect(isDue(app('A', null), TODAY)).toBe(false)
  })

  it('is not due once the application is closed: Ditolak or Dibatalkan', () => {
    expect(isDue(app('A', '2026-10-10', 'rejected'), TODAY)).toBe(false)
    expect(isDue(app('A', '2026-10-10', 'withdrawn'), TODAY)).toBe(false)
  })

  it('is due for the open statuses, a draft and an offer included', () => {
    for (const status of ['draft', 'applied', 'in-review', 'interview', 'offer'] as const) expect(isDue(app('A', TODAY, status), TODAY)).toBe(true)
  })
})

describe('dueCount', () => {
  it('counts the applications due today or earlier', () => {
    const apps = [app('A', TODAY), app('B', '2026-10-01'), app('C', '2026-10-30'), app('D', null), app('E', TODAY, 'rejected')]

    expect(dueCount(apps, TODAY)).toBe(2)
  })

  it('is zero with no applications', () => {
    expect(dueCount([], TODAY)).toBe(0)
  })

  it('turns on when the follow-up is set to today', () => {
    expect(dueCount([app('A', '2026-10-16')], TODAY)).toBe(0)
    expect(dueCount([app('A', TODAY)], TODAY)).toBe(1)
  })

  it('turns on by itself when the day comes', () => {
    const apps = [app('A', '2026-10-16')]

    expect(dueCount(apps, '2026-10-15')).toBe(0)
    expect(dueCount(apps, '2026-10-16')).toBe(1)
  })
})

describe('dueApplications', () => {
  it('lists the overdue first, then the ones due today, each by company', () => {
    const apps = [app('Zeta', TODAY), app('Beta', '2026-10-10'), app('Alfa', TODAY), app('Gamma', '2026-10-20')]

    expect(dueApplications(apps, TODAY).map((item) => item.job.company)).toEqual(['Beta', 'Alfa', 'Zeta'])
  })
})

describe('dueSummary', () => {
  it('is null when nothing is due', () => {
    expect(dueSummary([app('A', null)], TODAY)).toBeNull()
  })

  it('names one company', () => {
    expect(dueSummary([app('Studio Contoh', TODAY)], TODAY)).toEqual({ headline: '1 lamaran perlu tindak lanjut hari ini.', names: 'Studio Contoh.' })
  })

  it('names two with "dan", as in the mockup', () => {
    expect(dueSummary([app('Studio Contoh', TODAY), app('Aksara Pagi', TODAY)], TODAY)).toEqual({
      headline: '2 lamaran perlu tindak lanjut hari ini.',
      names: 'Aksara Pagi dan Studio Contoh.',
    })
  })

  it('names three with commas, and shortens a longer list', () => {
    const three = ['A', 'B', 'C'].map((name) => app(name, TODAY))
    const five = ['A', 'B', 'C', 'D', 'E'].map((name) => app(name, TODAY))

    expect(dueSummary(three, TODAY)?.names).toBe('A, B, dan C.')
    expect(dueSummary(five, TODAY)?.names).toBe('A, B, dan 3 lainnya.')
  })
})
