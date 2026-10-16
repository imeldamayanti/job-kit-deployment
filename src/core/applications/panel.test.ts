import { describe, expect, it } from 'vitest'
import { panelContext, resolveApplication, uploadNote } from './panel'
import type { Application, ApplicationData, CoverLetter, TailoredCv } from './types'

const AT = '2026-10-16T08:00:00.000Z'
const app = (change: Partial<Application> = {}): Application => ({
  id: 'a1', jobId: 'j1', status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', createdAt: AT, updatedAt: AT, events: [{ at: AT, type: 'created' }],
  job: { title: 'Frontend Engineer (React)', company: 'PT Contoh Karya', url: 'https://x.test/1', source: 'greenhouse', description: 'x', capturedAt: AT },
  ...change,
})
const letter = (change: Partial<CoverLetter> = {}): CoverLetter => ({
  id: 'l1', applicationId: 'a1', createdAt: AT, profileHash: 'h', lang: 'en', tone: 'formal', body: 'Dear team,\n\nI apply.', aiBody: 'Dear team,\n\nI apply.', edited: false, ...change,
})
const cv = { id: 'c1', applicationId: 'a1' } as TailoredCv
const data = (apps: Application[], letters: CoverLetter[] = [], cvs: TailoredCv[] = []): ApplicationData => ({ applications: apps, cvs, letters })

describe('resolveApplication', () => {
  it('prefers the application the tab was opened from', () => {
    const apps = [app({ id: 'a1', jobId: 'j1' }), app({ id: 'a2', jobId: 'j1' })]
    expect(resolveApplication({ applicationId: 'a2', jobId: 'j1' }, apps)?.id).toBe('a2')
  })

  it('finds the application of a feed job when the tab names only the job', () => {
    expect(resolveApplication({ jobId: 'j1' }, [app()])?.id).toBe('a1')
  })

  it('finds a manual application by its id, and nothing when there is none', () => {
    expect(resolveApplication({ applicationId: 'm1', jobId: '' }, [app({ id: 'm1', jobId: null })])?.id).toBe('m1')
    expect(resolveApplication({ jobId: 'zzz' }, [app()])).toBeUndefined()
    expect(resolveApplication({ jobId: '' }, [app({ jobId: null })])).toBeUndefined()
  })
})

describe('panelContext', () => {
  it('says what is ready: the letter text, and the CV marker', () => {
    const a = app({ cvId: 'c1', letterId: 'l1' })
    expect(panelContext(a, data([a], [letter()], [cv]))).toMatchObject({
      applicationId: 'a1', company: 'PT Contoh Karya', cvReady: true, letterReady: true, coverLetter: 'Dear team,\n\nI apply.',
      cvFile: 'CV-PT-Contoh-Karya.pdf', cvDownloaded: false,
    })
  })

  it('has no letter text when the application has none', () => {
    const a = app()
    expect(panelContext(a, data([a]))).toMatchObject({ cvReady: false, letterReady: false, coverLetter: '' })
  })

  it('does not hand over the letter of another application', () => {
    const a = app({ letterId: 'l9' })
    expect(panelContext(a, data([a], [letter({ id: 'l9', applicationId: 'other' })])).coverLetter).toBe('')
  })

  it('knows the CV was downloaded from the history', () => {
    const a = app({ cvId: 'c1', events: [{ at: AT, type: 'created' }, { at: AT, type: 'download' }] })
    expect(panelContext(a, data([a], [], [cv])).cvDownloaded).toBe(true)
  })

  it('sends the edited text, not the AI text', () => {
    const a = app({ letterId: 'l1' })
    expect(panelContext(a, data([a], [letter({ body: 'Saya edit', edited: true })])).coverLetter).toBe('Saya edit')
  })
})

describe('uploadNote', () => {
  const base = { cvFile: 'CV-PT-Contoh-Karya.pdf', cvReady: true, cvDownloaded: true }

  it('names the downloaded CV file on a CV upload', () => {
    for (const label of ['Resume/CV', 'Resume / CV (unggah file)', 'Curriculum Vitae', 'Upload your CV']) {
      expect(uploadNote(label, base)).toBe('CV-PT-Contoh-Karya.pdf sudah diunduh — pilih sendiri')
    }
  })

  it('tells the person to download first when the CV was made but not downloaded', () => {
    expect(uploadNote('Resume', { ...base, cvDownloaded: false })).toBe('Unduh CV-PT-Contoh-Karya.pdf dari Lamaran, lalu pilih sendiri')
  })

  it('says to choose a file when there is no CV yet', () => {
    expect(uploadNote('Resume', { cvFile: 'CV.pdf', cvReady: false, cvDownloaded: false })).toBe('Pilih berkasmu sendiri')
  })

  it('points a cover letter upload to Salin, since only text is filled', () => {
    expect(uploadNote('Cover Letter (attach a file)', base)).toBe('Salin surat dari Lamaran, lalu unggah sendiri')
  })

  it('has a plain note for any other upload', () => {
    expect(uploadNote('Portfolio', base)).toBe('Pilih berkasmu sendiri')
  })

  it('knows nothing about the application when the tab did not come from one', () => {
    expect(uploadNote('Resume/CV', undefined)).toBe('Pilih berkasmu sendiri')
  })
})
