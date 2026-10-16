import { describe, expect, it } from 'vitest'
import {
  BOARD_STATUSES,
  appliedLabel,
  closedSummary,
  DETAIL_TABS,
  describeApplications,
  documentMarks,
  formatShortDate,
  groupBoard,
  searchApplications,
  sourceLabel,
  STATUS_LABEL,
  STATUS_TONE,
} from './view'
import { APP_STATUSES, type AppStatus, type Application } from './types'

const AT = '2026-10-10T08:00:00.000Z'

function app(id: string, status: AppStatus = 'draft', extra: Partial<Application> = {}): Application {
  return {
    id, jobId: `job-${id}`, status, cvId: null, letterId: null, followUpAt: null, notes: '', createdAt: AT, updatedAt: AT,
    job: { title: `Judul ${id}`, company: `PT ${id}`, url: `https://x.test/${id}`, source: 'lever', description: '', capturedAt: AT },
    events: [{ at: AT, type: 'created' }],
    ...extra,
  }
}

describe('status words and tones', () => {
  it('names every status in Indonesian', () => {
    expect(APP_STATUSES.map((status) => STATUS_LABEL[status])).toEqual(['Draft', 'Dilamar', 'Direview', 'Interview', 'Offer', 'Ditolak', 'Dibatalkan'])
  })

  it('maps status to badge tone as in the T40 mockup', () => {
    expect(STATUS_TONE).toEqual({ draft: 'dim', applied: 'ok', 'in-review': 'prog', interview: 'warn', offer: 'ok', rejected: 'bad', withdrawn: 'dim' })
  })

  it('has five board columns, with Ditolak and Dibatalkan left out', () => {
    expect(BOARD_STATUSES).toEqual(['draft', 'applied', 'in-review', 'interview', 'offer'])
  })
})

describe('searchApplications', () => {
  const apps = [
    app('a', 'draft', { job: { ...app('a').job, title: 'Frontend Engineer', company: 'Contoh Karya' } }),
    app('b', 'applied', { job: { ...app('b').job, title: 'Backend Developer', company: 'Nusa Teknologi' } }),
  ]

  it('returns everything for an empty or blank search', () => {
    expect(searchApplications(apps, '')).toEqual(apps)
    expect(searchApplications(apps, '   ')).toEqual(apps)
  })

  it('matches the company name, ignoring case', () => {
    expect(searchApplications(apps, 'nusa').map((item) => item.id)).toEqual(['b'])
  })

  it('matches the job title', () => {
    expect(searchApplications(apps, 'FRONTEND').map((item) => item.id)).toEqual(['a'])
  })

  it('returns nothing when nothing matches', () => {
    expect(searchApplications(apps, 'android')).toEqual([])
  })
})

describe('groupBoard', () => {
  it('puts each application in the column of its status, in a fixed order', () => {
    const board = groupBoard([app('a', 'offer'), app('b', 'draft'), app('c', 'interview'), app('d', 'draft')])

    expect(board.columns.map((column) => [column.status, column.label, column.apps.map((item) => item.id)])).toEqual([
      ['draft', 'Draft', ['b', 'd']],
      ['applied', 'Dilamar', []],
      ['in-review', 'Direview', []],
      ['interview', 'Interview', ['c']],
      ['offer', 'Offer', ['a']],
    ])
  })

  it('shows the most recently changed application first in a column', () => {
    const board = groupBoard([
      app('old', 'draft', { updatedAt: '2026-10-01T00:00:00.000Z' }),
      app('new', 'draft', { updatedAt: '2026-10-09T00:00:00.000Z' }),
    ])

    expect(board.columns[0]?.apps.map((item) => item.id)).toEqual(['new', 'old'])
  })

  it('folds rejected and withdrawn applications away from the columns', () => {
    const board = groupBoard([app('a', 'rejected'), app('b', 'withdrawn'), app('c', 'rejected')])

    expect(board.columns.every((column) => column.apps.length === 0)).toBe(true)
    expect(board.rejected.map((item) => item.id).sort()).toEqual(['a', 'c'])
    expect(board.withdrawn.map((item) => item.id)).toEqual(['b'])
  })
})

describe('closedSummary', () => {
  it('counts the folded applications', () => {
    const board = groupBoard([app('a', 'rejected'), app('b', 'rejected'), app('c', 'rejected'), app('d', 'withdrawn')])

    expect(closedSummary(board)).toBe('Ditutup: Ditolak 3 · Dibatalkan 1')
  })

  it('is empty when there is nothing folded', () => {
    expect(closedSummary(groupBoard([app('a', 'draft')]))).toBe('')
  })
})

describe('describeApplications', () => {
  it('is empty when there are no applications at all', () => {
    expect(describeApplications(0, 0)).toBe('empty')
  })

  it('is no-match when a search hides every application', () => {
    expect(describeApplications(5, 0)).toBe('no-match')
  })

  it('is a list otherwise', () => {
    expect(describeApplications(5, 2)).toBe('list')
  })
})

describe('documentMarks', () => {
  it('says whether a CV and a letter exist', () => {
    expect(documentMarks(app('a'))).toEqual({ cv: false, letter: false })
    expect(documentMarks(app('a', 'draft', { cvId: 'c1' }))).toEqual({ cv: true, letter: false })
    expect(documentMarks(app('a', 'draft', { cvId: 'c1', letterId: 'l1' }))).toEqual({ cv: true, letter: true })
  })
})

describe('formatShortDate', () => {
  it('writes the day and an Indonesian month', () => {
    expect(formatShortDate(new Date(2026, 9, 9, 10).toISOString())).toBe('9 Okt')
    expect(formatShortDate(new Date(2026, 4, 21, 10).toISOString())).toBe('21 Mei')
  })

  it('is empty for something that is not a date', () => {
    expect(formatShortDate('')).toBe('')
    expect(formatShortDate('bukan tanggal')).toBe('')
  })
})

describe('appliedLabel', () => {
  const at = new Date(2026, 9, 9, 10).toISOString()

  it('says when the application was sent, from the history', () => {
    const sent = app('a', 'applied', { events: [{ at: AT, type: 'created' }, { at, type: 'status', from: 'draft', to: 'applied' }] })

    expect(appliedLabel(sent)).toBe('Dilamar 9 Okt')
  })

  it('uses the first time it became applied, not a later change', () => {
    const later = new Date(2026, 9, 20, 10).toISOString()
    const sent = app('a', 'interview', {
      events: [{ at, type: 'status', from: 'draft', to: 'applied' }, { at: later, type: 'status', from: 'applied', to: 'interview' }],
    })

    expect(appliedLabel(sent)).toBe('Dilamar 9 Okt')
  })

  it('is empty for a draft, which has not been sent', () => {
    expect(appliedLabel(app('a', 'draft'))).toBe('')
  })

  it('falls back to the creation date for an application that began as applied', () => {
    const began = app('a', 'applied', { createdAt: at })

    expect(appliedLabel(began)).toBe('Dilamar 9 Okt')
  })
})

describe('DETAIL_TABS', () => {
  it('lists the four tabs of Detail Lamaran in order', () => {
    expect(DETAIL_TABS.map((tab) => [tab.id, tab.title])).toEqual([
      ['summary', 'Ringkasan'],
      ['cv', 'CV'],
      ['letter', 'Surat'],
      ['notes', 'Catatan & riwayat'],
    ])
  })
})

describe('sourceLabel', () => {
  it('names the feed sources, and Manual for an application added by hand', () => {
    expect(sourceLabel('lever')).toBe('Lever')
    expect(sourceLabel('greenhouse')).toBe('Greenhouse')
    expect(sourceLabel('manual')).toBe('Manual')
  })
})
