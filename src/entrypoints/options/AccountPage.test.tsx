import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AccountStatus } from '../../core/account/access'
import type { LedgerEntry } from '../../platform/account'
import { AccountPage, type AccountApi, type CreditsProps, type TelemetryApi } from './AccountPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null

const telemetry = (change: Partial<TelemetryApi> = {}): TelemetryApi => ({
  available: () => true,
  isOn: vi.fn().mockResolvedValue(false),
  enable: vi.fn().mockResolvedValue(true),
  disable: vi.fn().mockResolvedValue(undefined),
  pending: vi.fn().mockResolvedValue([]),
  ...change,
})

const api = (change: Partial<AccountApi> = {}): AccountApi => ({
  load: vi.fn().mockResolvedValue({ configured: true, email: null, unlocked: false, lastSyncAt: null }),
  allow: vi.fn().mockResolvedValue(true),
  startLogin: vi.fn().mockResolvedValue({ ok: true }),
  finishLogin: vi.fn().mockResolvedValue({ ok: true }),
  unlock: vi.fn().mockResolvedValue({ ok: true, created: true }),
  sync: vi.fn().mockResolvedValue({ outcomes: { profile: 'pushed', applications: 'same', cvs: 'same', letters: 'same' } }),
  lock: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  deleteAccount: vi.fn().mockResolvedValue({ ok: true }),
  telemetry: telemetry(),
  ...change,
})

async function render(a: AccountApi, credits?: CreditsProps): Promise<string> {
  container?.remove()
  container = document.createElement('div')
  document.body.append(container)
  await act(async () => createRoot(container!).render(<AccountPage api={a} onExport={vi.fn()} credits={credits} />))
  return container.textContent ?? ''
}

const field = (label: string) => [...document.querySelectorAll('label')].find((l) => l.textContent === label)?.control as HTMLInputElement
const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
const click = (el: Element | undefined) => act(async () => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const type = (el: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

afterEach(() => {
  container?.remove()
  container = null
})

describe('AccountPage', () => {
  it('says sync is not available when no server is set up, and offers nothing to sign in to', async () => {
    const text = await render(api({ load: vi.fn().mockResolvedValue({ configured: false, email: null, unlocked: false, lastSyncAt: null }) }))
    expect(text).toContain('Sinkron belum tersedia di versi ini')
    expect(button('Kirim kode')).toBeUndefined()
  })

  it('says what sync does and does not do before asking for an email', async () => {
    const text = await render(api())
    expect(text).toContain('Opsional')
    expect(text).toContain('dienkripsi di browser ini')
    expect(text).toContain('tidak bisa dipulihkan')
  })

  it('asks Chrome for the server host first, then sends the code, then moves to the code step', async () => {
    const a = api()
    await render(a)
    await type(field('Email'), 'a@b.co')
    await click(button('Kirim kode'))
    expect(a.allow).toHaveBeenCalled()
    expect(a.startLogin).toHaveBeenCalledWith('a@b.co')
    expect(field('Kode dari email')).toBeTruthy()
  })

  it('does not send anything when the person refuses the server permission', async () => {
    const a = api({ allow: vi.fn().mockResolvedValue(false) })
    const before = await render(a)
    expect(before).toBeTruthy()
    await type(field('Email'), 'a@b.co')
    await click(button('Kirim kode'))
    expect(a.startLogin).not.toHaveBeenCalled()
    expect(container!.textContent).toContain('Izin ke server sinkron belum diberikan')
  })

  it('shows a clear error for a wrong code and stays on the code step', async () => {
    const a = api({ finishLogin: vi.fn().mockResolvedValue({ ok: false, reason: 'rejected' }) })
    await render(a)
    await type(field('Email'), 'a@b.co')
    await click(button('Kirim kode'))
    await type(field('Kode dari email'), '000000')
    await click(button('Masuk'))
    expect(container!.textContent).toContain('Ditolak server')
    expect(field('Kode dari email')).toBeTruthy()
  })

  it('signed in but locked: asks for the sync password, and keeps the button off until the warning is accepted', async () => {
    const a = api({ load: vi.fn().mockResolvedValue({ configured: true, email: 'a@b.co', unlocked: false, lastSyncAt: null }) })
    await render(a)
    await type(field('Kata sandi sinkron'), 'rahasia123')
    expect(button('Buka sinkron')?.disabled).toBe(true)
    await click(document.querySelector('input[type="checkbox"]') as HTMLInputElement)
    expect(button('Buka sinkron')?.disabled).toBe(false)
    await click(button('Buka sinkron'))
    expect(a.unlock).toHaveBeenCalledWith('rahasia123')
  })

  it('a wrong sync password shows the reason and the warning that it cannot be reset', async () => {
    const a = api({ load: vi.fn().mockResolvedValue({ configured: true, email: 'a@b.co', unlocked: false, lastSyncAt: null }), unlock: vi.fn().mockResolvedValue({ ok: false, reason: 'wrong-password' }) })
    await render(a)
    await type(field('Kata sandi sinkron'), 'salah-sekali')
    await click(document.querySelector('input[type="checkbox"]') as HTMLInputElement)
    await click(button('Buka sinkron'))
    expect(container!.textContent).toContain('Kata sandi sinkron salah')
  })

  const unlocked = { configured: true, email: 'a@b.co', unlocked: true, lastSyncAt: '2026-10-18T10:00:00.000Z' }

  it('syncs and says what moved', async () => {
    const a = api({ load: vi.fn().mockResolvedValue(unlocked) })
    await render(a)
    await click(button('Sinkronkan sekarang'))
    expect(container!.textContent).toContain('Terkirim: Profile.')
  })

  it('asks before overwriting this device, and only overwrites after Timpa', async () => {
    const sync = vi.fn().mockResolvedValueOnce({ outcomes: { profile: 'needs-confirm' } }).mockResolvedValueOnce({ outcomes: { profile: 'pulled' } })
    await render(api({ load: vi.fn().mockResolvedValue(unlocked), sync }))
    await click(button('Sinkronkan sekarang'))
    expect(container!.textContent).toContain('akan menimpa data di perangkat ini')
    expect(container!.textContent).toContain('Profile')
    await click(button('Timpa'))
    expect(sync).toHaveBeenLastCalledWith({ confirmOverwrite: true })
  })

  it('locks, and signs out of this device', async () => {
    const a = api({ load: vi.fn().mockResolvedValue(unlocked) })
    await render(a)
    await click(button('Kunci'))
    expect(a.lock).toHaveBeenCalled()
    await click(button('Keluar dari perangkat ini'))
    expect(a.signOut).toHaveBeenCalled()
  })

  it('deletes the account only after typing HAPUS, and says what stays', async () => {
    const a = api({ load: vi.fn().mockResolvedValue(unlocked) })
    await render(a)
    await click(button('Hapus akun'))
    expect(container!.textContent).toContain('Data di browser ini tidak ikut terhapus')
    expect(container!.textContent).toContain('Akunmu dan data sinkron dihapus dari server')
    expect(container!.textContent).toContain('Catatan pembelian dan pemakaian kredit tetap disimpan, tidak lagi terkait dengan akunmu')
    expect(container!.textContent).not.toContain('Semua data online')
    expect(container!.textContent).not.toContain('kredit akan hilang')
    expect(button('Hapus akun dan data online')?.disabled).toBe(true)
    await type(field('Ketik HAPUS untuk melanjutkan'), 'HAPUS')
    await click(button('Hapus akun dan data online'))
    expect(a.deleteAccount).toHaveBeenCalled()
    expect(container!.textContent).toContain('Akun dihapus. Data sinkron ikut terhapus; catatan pembelian dan pemakaian kredit tetap disimpan, tidak lagi terkait dengan akunmu.')
    expect(container!.textContent).not.toContain('Semua data online')
  })

  it('does not say the account is gone when the server refused', async () => {
    const a = api({ load: vi.fn().mockResolvedValue(unlocked), deleteAccount: vi.fn().mockResolvedValue({ ok: false, reason: 'server' }) })
    await render(a)
    await click(button('Hapus akun'))
    await type(field('Ketik HAPUS untuk melanjutkan'), 'HAPUS')
    await click(button('Hapus akun dan data online'))
    expect(container!.textContent).toContain('Ada masalah di server')
    expect(container!.textContent).not.toContain('Akun dihapus')
  })

  it('telemetry: says what is sent and offers to turn it on, which is off by default', async () => {
    const text = await render(api())
    expect(text).toContain('Bantu perbaiki job-kit')
    expect(text).toContain('mati secara bawaan')
    expect(text).toContain('tidak ada ID pengguna')
    expect(button('Matikan dan hapus hitungan')).toBeUndefined()
  })

  it('telemetry: turns on only through the permission prompt, and says so when refused', async () => {
    const t = telemetry({ enable: vi.fn().mockResolvedValue(false) })
    await render(api({ telemetry: t }))
    await click(button('Nyalakan telemetri'))
    expect(t.enable).toHaveBeenCalled()
    expect(container!.textContent).toContain('telemetri tetap mati')
  })

  it('telemetry: when on, shows exactly what would be sent next and lets the person turn it off', async () => {
    const t = telemetry({ isOn: vi.fn().mockResolvedValue(true), pending: vi.fn().mockResolvedValue(['2026-10-18: Fill dipakai × 2 (versi 0.1.0)']) })
    await render(api({ telemetry: t }))
    expect(container!.textContent).toContain('Fill dipakai × 2')
    await click(button('Matikan dan hapus hitungan'))
    expect(t.disable).toHaveBeenCalled()
  })

  it('telemetry: is not offered when there is no server', async () => {
    const text = await render(api({ telemetry: telemetry({ available: () => false }), load: vi.fn().mockResolvedValue({ configured: false, email: null, unlocked: false, lastSyncAt: null }) }))
    expect(text).not.toContain('Bantu perbaiki job-kit')
  })
})

describe('AccountPage: credit balance and history (mockup S13)', () => {
  const NOW = new Date('2026-11-19T10:00:00.000Z')
  const signedIn = () => api({ load: vi.fn().mockResolvedValue({ configured: true, email: 'nama@example.test', unlocked: true, lastSyncAt: null }) })
  const status = (change: Partial<AccountStatus> = {}): AccountStatus => ({ credits: 42, paid: true, trialGranted: true, expiresAt: '2027-11-19T10:00:00.000Z', checkedAt: NOW.toISOString(), ...change })
  const entry = (reason: string, delta: number, at = '2026-11-19T08:00:00.000Z'): LedgerEntry => ({ at, delta, reason })
  const credits = (change: Partial<CreditsProps> = {}): CreditsProps => ({
    status: status(), now: NOW, onBuy: vi.fn(), loadLedger: vi.fn().mockResolvedValue([]), ...change,
  })
  const ledger = () => [...document.querySelectorAll('ul[aria-label="Riwayat kredit"] li')].map((li) => li.textContent)

  it.each([[42, 'Sisa 42 kredit akan hilang.'], [1, 'Sisa 1 kredit akan hilang.']])('warns in the delete dialog that the %i remaining credits are lost with the account', async (left, warning) => {
    await render(signedIn(), credits({ status: status({ credits: left }) }))
    expect(container!.textContent).not.toContain('akan hilang')
    await click(button('Hapus akun'))
    expect(container!.textContent).toContain(warning)
  })

  it('has no lost-credits warning in the delete dialog without credits or without a known balance', async () => {
    await render(signedIn(), credits({ status: status({ credits: 0 }) }))
    await click(button('Hapus akun'))
    expect(container!.textContent).not.toContain('akan hilang')
    await render(signedIn(), credits({ status: null }))
    await click(button('Hapus akun'))
    expect(container!.textContent).not.toContain('akan hilang')
  })

  it('shows the balance, when it lapses, and what the package is', async () => {
    const text = await render(signedIn(), credits())
    expect(text).toContain('Saldo kredit')
    expect(text).toContain('42kredit')
    expect(text).toContain('Hangus pada 19 Nov 2027, 1 tahun sejak pembelian terakhir')
    expect(text).toContain('Paket 50 kredit, Rp10.800, sudah termasuk semua biaya. 1 CV = 1 kredit, 1 surat = 1 kredit, nilai 10 lowongan = 1 kredit. Kredit tidak bisa diuangkan.')
    expect(text).not.toContain('hari lagi')
  })

  it('marks a balance that lapses within 30 days, with the days left', async () => {
    const text = await render(signedIn(), credits({ status: status({ expiresAt: '2026-12-18T10:00:00.000Z' }) }))
    expect(text).toContain('Hangus pada 18 Des 2026')
    expect(text).toContain('29 hari lagi')
  })

  it('shows no lapse date for a free trial, which has none', async () => {
    const text = await render(signedIn(), credits({ status: status({ credits: 3, paid: false, expiresAt: null }) }))
    expect(text).toContain('3kredit')
    expect(text).not.toContain('Hangus pada')
  })

  it('says the balance is being checked when it is not known yet', async () => {
    const text = await render(signedIn(), credits({ status: null }))
    expect(text).toContain('Memeriksa saldo…')
  })

  it('opens the purchase from Beli kredit', async () => {
    const onBuy = vi.fn()
    await render(signedIn(), credits({ onBuy }))
    await click(button('Beli kredit'))
    expect(onBuy).toHaveBeenCalledTimes(1)
  })

  it('lists the credit history with a Indonesian label for each reason', async () => {
    const loadLedger = vi.fn().mockResolvedValue([
      entry('expire', -12), entry('generate', -1), entry('refund', 1), entry('purchase', 50, '2025-12-18T08:00:00.000Z'), entry('trial', 3, '2025-12-04T08:00:00.000Z'),
    ])
    await render(signedIn(), credits({ loadLedger }))

    expect(loadLedger).toHaveBeenCalledWith(20)
    const lines = ledger()
    expect(lines).toHaveLength(5)
    expect(lines[0]).toContain('Hangus')
    expect(lines[0]).toContain('−12')
    expect(lines[1]).toContain('Pemakaian AI')
    expect(lines[1]).toContain('−1')
    expect(lines[2]).toContain('Dikembalikan')
    expect(lines[2]).toContain('+1')
    expect(lines[3]).toContain('18 Des 2025')
    expect(lines[3]).toContain('Pembelian')
    expect(lines[3]).toContain('Paket 50 kredit · Rp10.800')
    expect(lines[3]).toContain('+50')
    expect(lines[4]).toContain('Percobaan gratis')
    expect(lines[4]).toContain('+3')
    expect(document.body.textContent).toContain('20 catatan terakhir')
  })

  it('says so when there is no history yet', async () => {
    const text = await render(signedIn(), credits())
    expect(text).toContain('Belum ada pemakaian kredit')
    expect(text).toContain('Pembelian dan pemakaian kredit muncul di sini.')
    expect(ledger()).toHaveLength(0)
  })

  it('reads the history again when the balance changed, e.g. after a purchase', async () => {
    const loadLedger = vi.fn().mockResolvedValue([])
    const first = credits({ loadLedger })
    await render(signedIn(), first)
    await act(async () => createRoot(container!).render(<AccountPage api={signedIn()} onExport={vi.fn()} credits={{ ...first, status: status({ credits: 92 }) }} />))
    expect(loadLedger.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('shows nothing about credits in builds without accounts', async () => {
    const text = await render(signedIn())
    expect(text).not.toContain('Saldo kredit')
    expect(text).not.toContain('Riwayat kredit')
  })
})
