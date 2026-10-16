import { describe, expect, it } from 'vitest'
import { describeEvent, historyOf, summarySteps } from './detail'
import type { AppEvent, Application } from './types'

const at = (day: number) => new Date(2026, 9, day, 10).toISOString()

function app(extra: Partial<Application> = {}): Application {
  return {
    id: 'a', jobId: 'j', status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', createdAt: at(11), updatedAt: at(11),
    job: { title: 'Judul', company: 'PT A', url: 'https://x.test/a', source: 'lever', description: '', capturedAt: at(11) },
    events: [{ at: at(11), type: 'created' }],
    ...extra,
  }
}

describe('describeEvent', () => {
  it('says the application was prepared from Lowongan', () => {
    expect(describeEvent({ at: at(11), type: 'created' })).toEqual({ text: 'Lamaran disiapkan dari Lowongan', tone: 'dim' })
  })

  it('says where a status moved from and to, with the reason when there is one', () => {
    const event: AppEvent = { at: at(12), type: 'status', from: 'draft', to: 'applied', text: 'Fill berhasil, 11 field' }

    expect(describeEvent(event)).toEqual({ text: 'Status: Draft → Dilamar (Fill berhasil, 11 field)', tone: 'ok' })
  })

  it('colours the move by where it lands: sent and offer green, in review violet, the rest grey', () => {
    const to = (status: AppEvent['to']) => describeEvent({ at: at(12), type: 'status', from: 'draft', to: status }).tone

    expect([to('applied'), to('offer'), to('in-review'), to('interview'), to('rejected'), to('withdrawn')]).toEqual(['ok', 'ok', 'prog', 'dim', 'dim', 'dim'])
  })

  it('copes with a status event that lost its from', () => {
    expect(describeEvent({ at: at(12), type: 'status', to: 'offer' }).text).toBe('Status: Offer')
  })

  it('names the document events', () => {
    expect(describeEvent({ at: at(12), type: 'cv' }).text).toBe('CV disesuaikan dibuat')
    expect(describeEvent({ at: at(12), type: 'letter' }).text).toBe('Surat lamaran dibuat')
    expect(describeEvent({ at: at(12), type: 'download' }).text).toBe('CV diunduh sebagai PDF')
  })

  it('says when a CV was made again (T49)', () => {
    expect(describeEvent({ at: at(12), type: 'cv', text: 'CV dibuat ulang' }).text).toBe('CV disesuaikan dibuat ulang')
    expect(describeEvent({ at: at(12), type: 'cv', text: 'CV dibuat' }).text).toBe('CV disesuaikan dibuat')
  })

  it('says when a letter was made again (T51)', () => {
    expect(describeEvent({ at: at(12), type: 'letter', text: 'Surat dibuat ulang' }).text).toBe('Surat lamaran dibuat ulang')
    expect(describeEvent({ at: at(12), type: 'letter', text: 'Surat dibuat' }).text).toBe('Surat lamaran dibuat')
  })

  it('shows what a fill event says, or a plain line', () => {
    expect(describeEvent({ at: at(12), type: 'fill', text: 'Form diisi, 4 field' }).text).toBe('Form diisi, 4 field')
    expect(describeEvent({ at: at(12), type: 'fill' }).text).toBe('Form diisi')
  })
})

describe('historyOf', () => {
  it('lists the newest first, each with its day', () => {
    const history = historyOf(
      app({ events: [{ at: at(11), type: 'created' }, { at: at(12), type: 'status', from: 'draft', to: 'applied' }, { at: at(14), type: 'status', from: 'applied', to: 'interview' }] }),
    )

    expect(history.map((row) => [row.when, row.text])).toEqual([
      ['14 Okt', 'Status: Dilamar → Interview'],
      ['12 Okt', 'Status: Draft → Dilamar'],
      ['11 Okt', 'Lamaran disiapkan dari Lowongan'],
    ])
  })

  it('keeps events from the same moment in the order they happened', () => {
    const history = historyOf(app({ events: [{ at: at(11), type: 'created' }, { at: at(11), type: 'status', from: 'draft', to: 'applied' }] }))

    expect(history.map((row) => row.text)).toEqual(['Status: Draft → Dilamar', 'Lamaran disiapkan dari Lowongan'])
  })

  it('is empty for an application with no history', () => {
    expect(historyOf(app({ events: [] }))).toEqual([])
  })
})

describe('summarySteps', () => {
  it('starts with nothing done, and the CV as the next step', () => {
    const steps = summarySteps(app())

    expect(steps.map((step) => [step.id, step.done, step.current])).toEqual([['cv', false, true], ['letter', false, false], ['fill', false, false]])
    expect(steps.map((step) => step.note)).toEqual(['Belum dibuat', 'Belum dibuat', 'Form diisi dari profil; surat ikut bila field-nya ada.'])
  })

  it('marks the CV done, with the day it was made, and moves on to the letter', () => {
    const steps = summarySteps(app({ cvId: 'c1', events: [{ at: at(11), type: 'created' }, { at: at(14), type: 'cv' }] }))

    expect(steps[0]).toMatchObject({ id: 'cv', done: true, current: false, note: 'Dibuat 14 Okt' })
    expect(steps[1]).toMatchObject({ id: 'letter', current: true })
  })

  it('marks Buka & isi done once the application was sent', () => {
    const steps = summarySteps(app({ status: 'applied', cvId: 'c1', letterId: 'l1', events: [{ at: at(11), type: 'created' }, { at: at(12), type: 'status', from: 'draft', to: 'applied' }] }))

    expect(steps.map((step) => step.done)).toEqual([true, true, true])
    expect(steps.some((step) => step.current)).toBe(false)
    expect(steps[2]?.note).toBe('Dilamar 12 Okt')
  })

  it('does not call a withdrawn application sent', () => {
    expect(summarySteps(app({ status: 'withdrawn' }))[2]?.done).toBe(false)
  })
})
