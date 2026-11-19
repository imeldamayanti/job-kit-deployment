import { describe, expect, it } from 'vitest'
import type { CreatePaymentResponse } from '../generate/protocol'
import { CREATE_FAILED_MESSAGE, formatCountdown, nextState, POLL_MS, QR_VALID_MINUTES, remainingMs, STATUS_TIMEOUT_MS, type FlowState } from './purchase-flow'

const created: Extract<CreatePaymentResponse, { ok: true }> = {
  ok: true, purchaseId: 'p1', qrUrl: 'https://api.midtrans.com/v2/qris/p1/qr-code', amountIdr: 10800, credits: 50, expiresAt: '2026-11-19T10:30:00.000Z',
}
const waiting: FlowState = { step: 'waiting', purchaseId: 'p1', qrUrl: created.qrUrl, expiresAt: created.expiresAt }
const at = (iso: string) => new Date(iso)

describe('nextState', () => {
  it('goes from creating to waiting with the QR when the code was made', () => {
    expect(nextState({ step: 'creating' }, { type: 'created', res: created })).toEqual(waiting)
  })

  it('goes to error with the honest text when the code could not be made, whatever the reason', () => {
    const refused: CreatePaymentResponse = { ok: false, error: 'gateway', message: 'apa pun dari server' }
    expect(nextState({ step: 'creating' }, { type: 'created', res: refused })).toEqual({ step: 'error', message: CREATE_FAILED_MESSAGE })
    expect(CREATE_FAILED_MESSAGE).toBe('Kode QR belum bisa dibuat. Kamu belum ditagih. Cek koneksi internetmu, lalu coba lagi.')
  })

  it('goes to paid when the purchase is paid, with the credits that came in', () => {
    expect(nextState(waiting, { type: 'polled', status: 'paid', credits: 50 })).toEqual({ step: 'paid', credits: 50 })
    expect(nextState(waiting, { type: 'polled', status: 'paid' })).toEqual({ step: 'paid', credits: 50 })
  })

  it('stays waiting while the purchase is pending, and while a payment that does not match is looked at server-side', () => {
    expect(nextState(waiting, { type: 'polled', status: 'pending' })).toBe(waiting)
    expect(nextState(waiting, { type: 'polled', status: 'mismatch' })).toBe(waiting)
  })

  it('goes to expired when the server says the code expired or failed', () => {
    expect(nextState(waiting, { type: 'polled', status: 'expired' })).toEqual({ step: 'expired' })
    expect(nextState(waiting, { type: 'polled', status: 'failed' })).toEqual({ step: 'expired' })
  })

  it('goes to expired on a tick at or after expiresAt, not before', () => {
    expect(nextState(waiting, { type: 'tick', now: at('2026-11-19T10:29:59.999Z') })).toBe(waiting)
    expect(nextState(waiting, { type: 'tick', now: at('2026-11-19T10:30:00.000Z') })).toEqual({ step: 'expired' })
    expect(nextState(waiting, { type: 'tick', now: at('2026-11-19T11:00:00.000Z') })).toEqual({ step: 'expired' })
  })

  it('ignores events that arrive in a step they do not belong to', () => {
    const paid: FlowState = { step: 'paid', credits: 50 }
    expect(nextState(paid, { type: 'polled', status: 'expired' })).toBe(paid)
    expect(nextState(paid, { type: 'tick', now: at('2030-01-01T00:00:00.000Z') })).toBe(paid)
    const creating: FlowState = { step: 'creating' }
    expect(nextState(creating, { type: 'polled', status: 'paid' })).toBe(creating)
  })

  it('treats an expiresAt it cannot read as not yet expired', () => {
    const odd: FlowState = { ...waiting, expiresAt: 'bukan tanggal' }
    expect(nextState(odd, { type: 'tick', now: at('2030-01-01T00:00:00.000Z') })).toBe(odd)
  })
})

describe('timing', () => {
  it('polls every 3 seconds and gives each status call 10 seconds', () => {
    expect(POLL_MS).toBe(3000)
    expect(STATUS_TIMEOUT_MS).toBe(10_000)
    expect(QR_VALID_MINUTES).toBe(30)
  })

  it('counts down to expiresAt and never below zero', () => {
    expect(remainingMs('2026-11-19T10:30:00.000Z', at('2026-11-19T10:01:19.000Z'))).toBe(28 * 60_000 + 41_000)
    expect(remainingMs('2026-11-19T10:30:00.000Z', at('2026-11-19T10:31:00.000Z'))).toBe(0)
    expect(remainingMs('bukan tanggal', at('2026-11-19T10:31:00.000Z'))).toBe(0)
  })

  it('writes the countdown as minutes:seconds, rounding up a started second', () => {
    expect(formatCountdown(28 * 60_000 + 41_000)).toBe('28:41')
    expect(formatCountdown(61_001)).toBe('1:02')
    expect(formatCountdown(9_000)).toBe('0:09')
    expect(formatCountdown(0)).toBe('0:00')
  })
})
