import { describe, expect, it } from 'vitest'
import { CV_VIEW_NAMES } from '../tailor/view'
import { previewApplicationsFromHash } from './preview'
import { groupBoard } from './view'

describe('previewApplicationsFromHash', () => {
  it('knows nothing for a hash with no state, or a state it does not know', () => {
    expect(previewApplicationsFromHash('#applications')).toBeUndefined()
    expect(previewApplicationsFromHash('#applications?state=nope')).toBeUndefined()
  })

  it('list: fills the board the way the T40 mockup does', () => {
    const preview = previewApplicationsFromHash('#applications?state=list')

    expect(preview?.view).toBe('board')
    const board = groupBoard(preview?.applications ?? [])
    expect(board.columns.map((column) => column.apps.length)).toEqual([2, 3, 1, 1, 0])
    expect(board.rejected).toHaveLength(3)
    expect(board.withdrawn).toHaveLength(1)
  })

  it('empty: no applications at all', () => {
    expect(previewApplicationsFromHash('#applications?state=empty')?.applications).toEqual([])
  })

  it('nomatch: a search that hides everything', () => {
    const preview = previewApplicationsFromHash('#applications?state=nomatch')

    expect(preview?.query).toBe('android')
    expect(preview?.applications.length).toBeGreaterThan(0)
  })

  it('closed: opens the folded Ditolak and Dibatalkan list', () => {
    expect(previewApplicationsFromHash('#applications?state=closed')?.closedOpen).toBe(true)
    expect(previewApplicationsFromHash('#applications?state=list')?.closedOpen).toBe(false)
  })

  it('viz: the Visualisasi view', () => {
    expect(previewApplicationsFromHash('#applications?state=viz')?.view).toBe('viz')
  })

  it('detail: opens one application on a chosen tab', () => {
    const summary = previewApplicationsFromHash('#applications?state=detail')
    const notes = previewApplicationsFromHash('#applications?state=detail-notes')

    expect(summary?.detail?.tab).toBe('summary')
    expect(notes?.detail?.tab).toBe('notes')
    expect(summary?.applications.some((app) => app.id === summary.detail?.id)).toBe(true)
  })

  it('detail-nodesc: an application whose posting has no text, so the paste box shows', () => {
    const preview = previewApplicationsFromHash('#applications?state=detail-nodesc')
    const app = preview?.applications.find((item) => item.id === preview.detail?.id)

    expect(app?.job.description).toBe('')
  })

  it('detail-manual: an application added by hand, with no link yet', () => {
    const preview = previewApplicationsFromHash('#applications?state=detail-manual')
    const app = preview?.applications.find((item) => item.id === preview.detail?.id)

    expect(app).toMatchObject({ jobId: null, job: { source: 'manual', url: '' } })
  })

  it('add: opens the form for adding an application by hand', () => {
    expect(previewApplicationsFromHash('#applications?state=add')?.adding).toBe(true)
    expect(previewApplicationsFromHash('#applications?state=list')?.adding).toBeFalsy()
  })
})

describe('CV tab states in a dev build (T49)', () => {
  it('opens the CV tab with the finished CV for detail-cv', () => {
    const preview = previewApplicationsFromHash('#applications?state=detail-cv')
    expect(preview?.detail).toEqual({ id: 'a1', tab: 'cv' })
    expect(preview?.cv).toBe('result')
  })

  it('has a state for each situation of the mockup: detail-cv-<name>', () => {
    for (const name of CV_VIEW_NAMES.filter((n) => n !== 'result')) {
      const preview = previewApplicationsFromHash(`#applications?state=detail-cv-${name}`)
      expect(preview?.detail?.tab, name).toBe('cv')
      expect(preview?.cv, name).toBe(name)
    }
  })

  it('leaves the other detail states without a CV view', () => {
    expect(previewApplicationsFromHash('#applications?state=detail')?.cv).toBeUndefined()
    expect(previewApplicationsFromHash('#applications?state=detail-notes')?.cv).toBeUndefined()
  })
})
