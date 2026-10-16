import type { AppEvent, Application } from './types'
import { appliedLabel, formatShortDate, STATUS_LABEL } from './view'

export type HistoryTone = 'ok' | 'prog' | 'dim'
export type HistoryLine = { text: string; tone: HistoryTone }

// One line of the automatic history (FR-37). Green is for results that went well, violet for a review, grey for the rest.
export function describeEvent(event: AppEvent): HistoryLine {
  switch (event.type) {
    case 'created':
      return { text: 'Lamaran disiapkan dari Lowongan', tone: 'dim' }
    case 'status': {
      const to = event.to ? STATUS_LABEL[event.to] : ''
      const move = event.from ? `${STATUS_LABEL[event.from]} → ${to}` : to
      const reason = event.text ? ` (${event.text})` : ''
      const tone = event.to === 'applied' || event.to === 'offer' ? 'ok' : event.to === 'in-review' ? 'prog' : 'dim'
      return { text: `Status: ${move}${reason}`, tone }
    }
    case 'cv':
      return { text: event.text === 'CV dibuat ulang' ? 'CV disesuaikan dibuat ulang' : 'CV disesuaikan dibuat', tone: 'dim' }
    case 'letter':
      return { text: event.text === 'Surat dibuat ulang' ? 'Surat lamaran dibuat ulang' : 'Surat lamaran dibuat', tone: 'dim' }
    case 'download':
      return { text: 'CV diunduh sebagai PDF', tone: 'dim' }
    case 'fill':
      return { text: event.text || 'Form diisi', tone: 'dim' }
  }
}

export type HistoryRow = HistoryLine & { when: string }

// Newest first. The list is append-only, so reversing it also keeps events of one moment in the order they happened.
export function historyOf(app: Application): HistoryRow[] {
  return [...app.events].reverse().map((event) => ({ ...describeEvent(event), when: formatShortDate(event.at) }))
}

export type SummaryStep = { id: 'cv' | 'letter' | 'fill'; title: string; note: string; done: boolean; current: boolean }

function madeNote(app: Application, type: 'cv' | 'letter'): string {
  const last = [...app.events].reverse().find((event) => event.type === type)
  const day = last ? formatShortDate(last.at) : ''
  return day ? `Dibuat ${day}` : 'Dibuat'
}

// "Siap melamar" (Ringkasan): not a wizard, only what is done and what comes next.
export function summarySteps(app: Application): SummaryStep[] {
  const sent = appliedLabel(app)
  const steps = [
    { id: 'cv' as const, title: 'CV disesuaikan', done: app.cvId !== null, note: app.cvId !== null ? madeNote(app, 'cv') : 'Belum dibuat' },
    { id: 'letter' as const, title: 'Surat lamaran', done: app.letterId !== null, note: app.letterId !== null ? madeNote(app, 'letter') : 'Belum dibuat' },
    { id: 'fill' as const, title: 'Buka & isi form', done: sent !== '', note: sent || 'Form diisi dari profil; surat ikut bila field-nya ada.' },
  ]
  const next = steps.findIndex((step) => !step.done)
  return steps.map((step, index) => ({ ...step, current: index === next }))
}
