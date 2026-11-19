import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountStatus } from '../../core/account/access'
import type { CreatePaymentResponse } from '../../core/generate/protocol'

// The platform seams the modal talks to. Nothing here reaches a real server or a real clock.
vi.mock('../../platform/account', () => ({
  createPayment: vi.fn(),
  purchaseStatus: vi.fn(),
  refreshAccountStatus: vi.fn(),
}))

import { createPayment, purchaseStatus, refreshAccountStatus } from '../../platform/account'
import { BuyCreditsModal } from './BuyCreditsModal'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const NOW = '2026-11-19T10:01:19.000Z'
const created = (change: Partial<Extract<CreatePaymentResponse, { ok: true }>> = {}): CreatePaymentResponse => ({
  ok: true, purchaseId: 'p1', qrUrl: 'https://api.midtrans.com/v2/qris/p1/qr-code', amountIdr: 10800, credits: 50, expiresAt: '2026-11-19T10:30:00.000Z', ...change,
})
const refused: CreatePaymentResponse = { ok: false, error: 'gateway', message: 'apa pun' }
const after = (credits: number): AccountStatus => ({ credits, paid: true, trialGranted: true, expiresAt: '2027-11-19T10:05:00.000Z', checkedAt: NOW })

let container: HTMLElement | null = null
let root: Root | null = null
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null
const text = () => dialog()?.textContent ?? ''
const buttons = (label: string) => [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label) as HTMLButtonElement[]
const button = (label: string) => buttons(label)[0]
const click = (el: Element | undefined) => act(async () => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
const flush = () => advance(0)

// A modal opened from a "Beli kredit" button, as the page does it.
function Page({ onPaid, onClose = () => {} }: { onPaid: () => void; onClose?: () => void }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Beli kredit</button>
      {open && <BuyCreditsModal onPaid={onPaid} onClose={() => { setOpen(false); onClose() }} />}
    </>
  )
}
async function mount(node: React.ReactNode) {
  await act(async () => root?.unmount())
  container?.remove()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root!.render(node))
  await flush()
}
async function open(onPaid: () => void = () => {}, onClose?: () => void) {
  await mount(<Page onPaid={onPaid} onClose={onClose} />)
  const opener = button('Beli kredit')!
  opener.focus()
  await click(opener)
  await flush()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
  vi.mocked(createPayment).mockResolvedValue(created())
  vi.mocked(purchaseStatus).mockResolvedValue('pending')
  vi.mocked(refreshAccountStatus).mockResolvedValue(after(53))
})

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  container = null
  root = null
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('BuyCreditsModal: the steps', () => {
  it('says the code is being made while the request runs, with the price and the note', async () => {
    let finish: (res: CreatePaymentResponse) => void = () => {}
    vi.mocked(createPayment).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    await open()

    expect(text()).toContain('Rp10.800')
    expect(text()).toContain('50 kredit ≈ 25 CV + 25 surat')
    expect(text()).toContain('Sudah termasuk semua biaya')
    expect(text()).toContain('Membuat kode QR…')
    expect(text()).toContain('Catatan: kredit tidak bisa diuangkan, dan hangus 1 tahun sejak pembelian terakhir.')
    expect(dialog()?.querySelector('img')).toBeNull()

    await act(async () => finish(created()))
  })

  it('shows the QR from the server, the countdown, and what to do', async () => {
    await open()

    const img = dialog()?.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('https://api.midtrans.com/v2/qris/p1/qr-code')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(img.getAttribute('alt')).toBe('Kode QR untuk pembayaran QRIS')
    expect(text()).toContain('Rp10.800')
    expect(text()).toContain('Sudah termasuk semua biaya')
    expect(text()).toContain('Berlaku 28:41')
    expect(text()).toContain('Menunggu pembayaran…')
    expect(text()).toContain('Menutup jendela tidak membatalkan pembelian; kredit masuk begitu pembayaran diterima.')
    expect(text()).toContain('Catatan: kredit tidak bisa diuangkan, dan hangus 1 tahun sejak pembelian terakhir.')
    expect(text().toLowerCase()).not.toContain('admin')
    const bar = dialog()?.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-label')).toBe('Sisa waktu kode QR')
    expect(bar?.getAttribute('aria-valuenow')).toBe('28')
  })

  it('counts down every second', async () => {
    await open()
    await advance(5000)
    expect(text()).toContain('Berlaku 28:36')
  })

  it('shows the paid screen, reads the balance again, and tells the page', async () => {
    const onPaid = vi.fn()
    await open(onPaid)
    vi.mocked(purchaseStatus).mockResolvedValue('paid')
    await advance(3000)

    expect(purchaseStatus).toHaveBeenCalledWith('p1')
    expect(refreshAccountStatus).toHaveBeenCalledTimes(1)
    expect(onPaid).toHaveBeenCalledTimes(1)
    expect(text()).toContain('Pembayaran diterima')
    expect(text()).toContain('50 kredit sudah masuk. Kamu bisa memakai AI lagi.')
    expect(text()).toContain('Saldo sekarang')
    expect(text()).toContain('53')
    expect(text()).toContain('+50')
    expect(text()).toContain('Hangus 19 Nov 2027')
    expect(dialog()?.querySelector('img')).toBeNull()
    expect(button('Selesai')).toBeTruthy()
  })

  it('closes from Selesai', async () => {
    const onClose = vi.fn()
    await open(() => {}, onClose)
    vi.mocked(purchaseStatus).mockResolvedValue('paid')
    await advance(3000)
    await click(button('Selesai'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(dialog()).toBeNull()
  })

  it('still tells the page when the modal was closed before the balance came back', async () => {
    const onPaid = vi.fn()
    let balance: (status: AccountStatus) => void = () => {}
    vi.mocked(refreshAccountStatus).mockReturnValue(new Promise((resolve) => (balance = resolve)))
    await open(onPaid)
    vi.mocked(purchaseStatus).mockResolvedValue('paid')
    await advance(3000)
    await click(button('Tutup'))
    await act(async () => balance(after(53)))

    expect(onPaid).toHaveBeenCalledTimes(1)
  })

  it('moves to the expired screen at expiresAt, with the way on', async () => {
    await open()
    await advance(28 * 60_000 + 41_000)

    expect(text()).toContain('Kode QR sudah kedaluwarsa. Kalau kamu sudah membayar, kredit tetap masuk. Kalau belum, buat kode baru.')
    expect(text()).toContain('Kode kedaluwarsa')
    expect(button('Buat kode baru')).toBeTruthy()
    expect(dialog()?.querySelector('img')).toBeNull()
    expect(text()).not.toContain('Menunggu pembayaran')
  })

  it('moves to the expired screen when the server says so', async () => {
    await open()
    vi.mocked(purchaseStatus).mockResolvedValue('expired')
    await advance(3000)
    expect(text()).toContain('Kode QR sudah kedaluwarsa.')
  })

  it('makes a new code from Buat kode baru and goes back to waiting', async () => {
    await open()
    await advance(30 * 60_000)
    vi.mocked(createPayment).mockResolvedValue(created({ purchaseId: 'p2', qrUrl: 'https://api.midtrans.com/v2/qris/p2/qr-code', expiresAt: '2026-11-19T11:00:00.000Z' }))
    await click(button('Buat kode baru'))
    await flush()

    expect(createPayment).toHaveBeenCalledTimes(2)
    expect(dialog()?.querySelector('img')?.getAttribute('src')).toBe('https://api.midtrans.com/v2/qris/p2/qr-code')
    expect(text()).toContain('Menunggu pembayaran…')
  })

  it('says nothing was charged when the code could not be made, and Coba lagi tries again', async () => {
    vi.mocked(createPayment).mockResolvedValue(refused)
    await open()

    expect(text()).toContain('Kode QR belum bisa dibuat. Kamu belum ditagih. Cek koneksi internetmu, lalu coba lagi.')
    expect(text()).toContain('Sudah termasuk semua biaya')
    expect(text()).toContain('Catatan: kredit tidak bisa diuangkan, dan hangus 1 tahun sejak pembelian terakhir.')
    vi.mocked(createPayment).mockResolvedValue(created())
    await click(button('Coba lagi'))
    await flush()
    expect(createPayment).toHaveBeenCalledTimes(2)
    expect(text()).toContain('Berlaku 28:41')
  })
})

describe('BuyCreditsModal: one request at a time', () => {
  it('disables Coba lagi while the request runs, and a second click makes no second request', async () => {
    vi.mocked(createPayment).mockResolvedValue(refused)
    await open()
    let finish: (res: CreatePaymentResponse) => void = () => {}
    vi.mocked(createPayment).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const retry = button('Coba lagi')!
    await act(async () => {
      retry.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      retry.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(createPayment).toHaveBeenCalledTimes(2)
    expect(button('Coba lagi')?.disabled).toBe(true)
    await act(async () => finish(created()))
    await flush()
    expect(text()).toContain('Menunggu pembayaran…')
  })

  it('disables Buat kode baru while the request runs', async () => {
    await open()
    await advance(30 * 60_000)
    let finish: (res: CreatePaymentResponse) => void = () => {}
    vi.mocked(createPayment).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    await click(button('Buat kode baru'))

    expect(button('Buat kode baru')?.disabled).toBe(true)
    await click(button('Buat kode baru'))
    expect(createPayment).toHaveBeenCalledTimes(2)
    await act(async () => finish(created()))
  })

  it('does not start a second request when the modal is opened again while the first still runs', async () => {
    let finish: (res: CreatePaymentResponse) => void = () => {}
    vi.mocked(createPayment).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    await open()
    await click(button('Tutup'))
    await click(button('Beli kredit'))

    expect(createPayment).toHaveBeenCalledTimes(1)
    await act(async () => finish(created()))
    await flush()
    expect(text()).toContain('Menunggu pembayaran…')
  })
})

describe('BuyCreditsModal: polling', () => {
  it('asks for the status at once, then every 3 seconds', async () => {
    await open()
    expect(purchaseStatus).toHaveBeenCalledTimes(1)
    await advance(3000)
    expect(purchaseStatus).toHaveBeenCalledTimes(2)
    await advance(6000)
    expect(purchaseStatus).toHaveBeenCalledTimes(4)
  })

  it('keeps going after a round that failed', async () => {
    vi.mocked(purchaseStatus).mockRejectedValueOnce(new Error('offline')).mockResolvedValue('pending')
    await open()
    await advance(3000)
    expect(purchaseStatus).toHaveBeenCalledTimes(2)
    vi.mocked(purchaseStatus).mockResolvedValue('paid')
    await advance(3000)
    expect(text()).toContain('Pembayaran diterima')
  })

  it('gives up on a call that hangs after 10 seconds and goes on with the next round', async () => {
    vi.mocked(purchaseStatus).mockReturnValueOnce(new Promise(() => {})).mockResolvedValue('pending')
    await open()
    expect(purchaseStatus).toHaveBeenCalledTimes(1)
    await advance(9_999)
    expect(purchaseStatus).toHaveBeenCalledTimes(1)
    await advance(1)
    await advance(3000)
    expect(purchaseStatus).toHaveBeenCalledTimes(2)
  })

  it('stops when the modal is closed, and the next opening shows the same code and asks again', async () => {
    await open()
    await advance(3000)
    const calls = vi.mocked(purchaseStatus).mock.calls.length
    const src = dialog()?.querySelector('img')?.getAttribute('src')
    await click(button('Tutup'))
    await advance(30_000)
    expect(purchaseStatus).toHaveBeenCalledTimes(calls)

    await click(button('Beli kredit'))
    await flush()
    expect(dialog()?.querySelector('img')?.getAttribute('src')).toBe(src)
    expect(purchaseStatus).toHaveBeenCalledTimes(calls + 1)
  })
})

describe('BuyCreditsModal: the dialog contract', () => {
  it('is a modal dialog with a name', async () => {
    await open()
    expect(dialog()?.getAttribute('aria-modal')).toBe('true')
    expect(dialog()?.getAttribute('aria-label')).toBe('Beli kredit AI')
  })

  it('moves focus inside when opened', async () => {
    await open()
    expect(dialog()?.contains(document.activeElement)).toBe(true)
  })

  it('closes on Escape and gives focus back to the Beli kredit button', async () => {
    const onClose = vi.fn()
    await open(() => {}, onClose)
    await act(async () => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(button('Beli kredit'))
  })

  it('closes from the cross and from Tutup, and gives focus back', async () => {
    await open()
    await click(buttons('Tutup')[0])
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(button('Beli kredit'))
  })

  it('keeps Tab inside the dialog', async () => {
    await open()
    const focusable = [...dialog()!.querySelectorAll<HTMLElement>('button:not([disabled])')]
    focusable[focusable.length - 1]!.focus()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    await act(async () => void dialog()!.dispatchEvent(tab))

    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(focusable[0])
  })
})
