import type { CreatePaymentResponse } from '../generate/protocol'
import { PACKAGE } from './access'

// The steps of buying credits with a QRIS code (spec §5). A pure state machine: time and the server's answers come in as events,
// so the modal only has to feed it. Nothing here reads the clock.
export type FlowState =
  | { step: 'creating' }
  | { step: 'waiting'; purchaseId: string; qrUrl: string; expiresAt: string }
  | { step: 'paid'; credits: number }
  | { step: 'expired' }
  | { step: 'error'; message: string }

export type FlowEvent =
  | { type: 'created'; res: CreatePaymentResponse }
  | { type: 'polled'; status: string; credits?: number }
  | { type: 'tick'; now: Date }

// How often the purchase status is asked while a code waits to be paid.
export const POLL_MS = 3000
// One status call gets this long; a call that hangs counts as a failed round and the next one goes on (the figure is a judgement, not a spec value).
export const STATUS_TIMEOUT_MS = 10_000
// How long a code is valid, for the countdown bar (the server's own `expiresAt` is what ends it).
export const QR_VALID_MINUTES = 30

// Whatever went wrong while making the code (no network, no session, the gateway said no), nothing was charged:
// a QR is only charged when it is paid.
export const CREATE_FAILED_MESSAGE = 'Kode QR belum bisa dibuat. Kamu belum ditagih. Cek koneksi internetmu, lalu coba lagi.'

export function nextState(state: FlowState, event: FlowEvent): FlowState {
  if (event.type === 'created') {
    if (!event.res.ok) return { step: 'error', message: CREATE_FAILED_MESSAGE }
    return { step: 'waiting', purchaseId: event.res.purchaseId, qrUrl: event.res.qrUrl, expiresAt: event.res.expiresAt }
  }
  // Polls and ticks only mean something while a code waits; a late one after paid or expired changes nothing.
  if (state.step !== 'waiting') return state
  if (event.type === 'polled') {
    if (event.status === 'paid') return { step: 'paid', credits: event.credits ?? PACKAGE.credits }
    // A failed payment cannot be paid again: the only way on is a new code, same as an expired one.
    if (event.status === 'expired' || event.status === 'failed') return { step: 'expired' }
    return state
  }
  const expires = Date.parse(state.expiresAt)
  return !Number.isNaN(expires) && event.now.getTime() >= expires ? { step: 'expired' } : state
}

export function remainingMs(expiresAt: string, now: Date): number {
  const expires = Date.parse(expiresAt)
  return Number.isNaN(expires) ? 0 : Math.max(0, expires - now.getTime())
}

// "28:41"; a second that has started counts as a whole one, so the clock reaches 0:00 exactly when the code expires.
export function formatCountdown(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
