import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { Application, CoverLetter } from '../core/applications/types'
import { loadApplicationData, saveApplicationData } from './application-storage'
import { rememberOpened } from './opened-jobs'
import { loadPanelContext } from './panel-context'

const AT = '2026-10-16T08:00:00.000Z'
const app = (change: Partial<Application> = {}): Application => ({
  id: 'a1', jobId: 'j1', status: 'draft', cvId: null, letterId: 'l1', followUpAt: null, notes: '', createdAt: AT, updatedAt: AT, events: [{ at: AT, type: 'created' }],
  job: { title: 'Frontend Engineer', company: 'PT Contoh Karya', url: 'https://x.test/1', source: 'greenhouse', description: 'x', capturedAt: AT },
  ...change,
})
const letter: CoverLetter = { id: 'l1', applicationId: 'a1', createdAt: AT, profileHash: 'h', lang: 'en', tone: 'formal', body: 'Dear team', aiBody: 'Dear team', edited: false }

beforeEach(() => {
  fakeBrowser.reset()
})

describe('loadPanelContext', () => {
  it('finds the application of a tab opened from the feed, with its letter', async () => {
    await saveApplicationData({ applications: [app()], cvs: [], letters: [letter] })
    await rememberOpened(7, { jobId: 'j1', title: 'Frontend Engineer', score: 86, rough: false })

    const found = await loadPanelContext(7)

    expect(found?.opened.score).toBe(86)
    expect(found?.context).toMatchObject({ applicationId: 'a1', letterReady: true, coverLetter: 'Dear team' })
  })

  it('finds an application added by hand through the id the tab carries', async () => {
    await saveApplicationData({ applications: [app({ id: 'm1', jobId: null, letterId: null })], cvs: [], letters: [] })
    await rememberOpened(8, { jobId: '', applicationId: 'm1', title: 'x', score: null, rough: false })

    expect((await loadPanelContext(8))?.context).toMatchObject({ applicationId: 'm1', letterReady: false, coverLetter: '' })
  })

  it('has an opened job but no context when no application exists yet', async () => {
    await rememberOpened(9, { jobId: 'zzz', title: 'x', score: null, rough: false })
    const found = await loadPanelContext(9)
    expect(found?.opened.jobId).toBe('zzz')
    expect(found?.context).toBeUndefined()
  })

  it('is empty for a tab that was not opened from job-kit, and reads nothing it must not change', async () => {
    expect(await loadPanelContext(10)).toBeUndefined()
    expect(await loadPanelContext(undefined)).toBeUndefined()
    expect((await loadApplicationData()).applications).toEqual([])
  })
})
