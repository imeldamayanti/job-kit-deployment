import { describe, expect, it } from 'vitest'
import { CV_VIEW_NAMES, cvViewFor } from './view'
import { validateGrounded } from './grounded'
import { cvParts } from './edit'
import { SAMPLE_WEB_DEV } from './sample-profiles'

describe('cvViewFor (the dev preview states of the CV tab, T40 / PRD §8)', () => {
  it('has one state for each situation the mockup shows', () => {
    expect([...CV_VIEW_NAMES].sort()).toEqual(['busy', 'edited', 'empty', 'limit', 'noexp', 'notice', 'off', 'pdffailed', 'pdfnote', 'rejected', 'result', 'stale'])
    for (const name of CV_VIEW_NAMES) expect(cvViewFor(name)).toBeDefined()
  })

  it('result: a CV that the fact checker would accept, with covered and missing requirements', () => {
    const view = cvViewFor('result')
    expect(view.cv).not.toBeNull()
    expect(view.availability).toEqual({ ok: true })
    expect(view.stale).toBe(false)
    expect(validateGrounded(cvParts(view.cv!), SAMPLE_WEB_DEV).ok).toBe(true)
    expect(view.cv!.coverage.covered.length).toBeGreaterThan(0)
    expect(view.cv!.coverage.missing.length).toBeGreaterThan(0)
    expect(view.cv!.coverage.covered.length + view.cv!.coverage.missing.length).toBe(view.cv!.coverage.required.length)
  })

  it('empty: no CV yet, button on', () => {
    expect(cvViewFor('empty')).toMatchObject({ cv: null, availability: { ok: true }, busy: false, message: null })
  })

  it('busy: no CV and the button shows that it is working', () => {
    expect(cvViewFor('busy')).toMatchObject({ cv: null, busy: true })
  })

  it('rejected: no CV shown, and the message names what the Profile lacks (FR-40)', () => {
    const view = cvViewFor('rejected')
    expect(view.cv).toBeNull()
    expect(view.rejected).toBe(true)
    expect(view.message).toContain('Kubernetes')
    expect(view.message).toContain('50%')
  })

  it('stale: the CV is kept and marked as made from an older Profile', () => {
    expect(cvViewFor('stale')).toMatchObject({ stale: true })
    expect(cvViewFor('stale').cv).not.toBeNull()
  })

  it('off: the button is off with its reason and a link', () => {
    expect(cvViewFor('off').availability).toMatchObject({ ok: false, reason: 'no-key', link: 'settings' })
  })

  it('limit: the daily limit is reached', () => {
    expect(cvViewFor('limit').availability).toMatchObject({ ok: false, reason: 'daily-limit' })
  })

  it('notice: a model that may train on the data, asked before going on', () => {
    expect(cvViewFor('notice').notice).toMatch(/melatih/)
  })

  it('noexp: a Profile without experience', () => {
    const view = cvViewFor('noexp')
    expect(view.availability).toMatchObject({ ok: false, reason: 'no-experience', link: 'profile' })
    expect(view.profile?.experience).toEqual([])
  })

  it('edited: a CV the person changed, which Buat ulang must ask about', () => {
    const view = cvViewFor('edited')
    expect(view.cv?.edited).toBe(true)
    expect(view.cv?.aiVersion).not.toEqual(cvParts(view.cv!))
  })

  it('pdffailed: the CV stays and the reason the PDF failed is given (PRD §8)', () => {
    const view = cvViewFor('pdffailed')
    expect(view.cv).not.toBeNull()
    expect(view.downloadError).toMatch(/PDF gagal dibuat/)
    expect(view.downloadError).toMatch(/bisa disalin/)
  })

  it('pdfnote: letters the PDF fonts lack were replaced, and the person is told', () => {
    expect(cvViewFor('pdfnote').downloadNote).toMatch(/diganti/)
  })

  it('the other states download nothing', () => {
    for (const name of CV_VIEW_NAMES.filter((n) => n !== 'pdffailed' && n !== 'pdfnote')) {
      const view = cvViewFor(name)
      expect([name, view.downloading, view.downloadError, view.downloadNote]).toEqual([name, false, null, null])
    }
  })
})
