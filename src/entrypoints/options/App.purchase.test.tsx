import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { AccountStatus } from '../../core/account/access'
import { createEmptyProfile } from '../../core/profile/profile'
import type { Session } from '../../core/sync/api'

// The seams the page talks to. Nothing here reaches a real server.
vi.mock('../../platform/sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../platform/sync')>()),
  currentSession: vi.fn(),
  storedUserId: vi.fn(),
}))
vi.mock('../../platform/account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../platform/account')>()),
  loadAccountStatus: vi.fn(),
  refreshAccountStatus: vi.fn(),
  createPayment: vi.fn(),
  purchaseStatus: vi.fn(),
  loadLedger: vi.fn(),
}))

import { addManualApplication } from '../../platform/applications'
import { createPayment, loadAccountStatus, loadLedger, purchaseStatus, refreshAccountStatus } from '../../platform/account'
import { saveProfile } from '../../platform/storage'
import { currentSession, storedUserId } from '../../platform/sync'
import { App } from './App'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session: Session = { accessToken: 'a', refreshToken: 'r', expiresAt: 9_999_999_999, userId: 'u1', email: 'nama@example.test' }
const status = (credits: number): AccountStatus => ({ credits, paid: credits > 3, trialGranted: true, expiresAt: credits > 3 ? '2027-11-19T10:00:00.000Z' : null, checkedAt: '2026-11-19T00:00:00.000Z' })

// What the server holds: the balance changes when the payment is paid.
let balance = 0

let container: HTMLElement | null = null
let root: Root | null = null
const settle = async () => {
  for (let i = 0; i < 4; i += 1) await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))))
}
async function render(hash: string) {
  location.hash = hash
  await act(async () => root?.unmount())
  container?.remove()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root!.render(<App />))
  await settle()
}
const text = () => container?.textContent ?? ''
const buttons = (label: string) => [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === label) as HTMLButtonElement[]
const click = (el: Element | undefined) => act(async () => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const dialog = () => document.querySelector('[role="dialog"][aria-label="Beli kredit AI"]')
const sidebar = () => document.querySelector('aside') as HTMLElement

// Presses every enabled "Beli kredit" inside `scope` one by one: each must open the modal, and the modal closes between them.
async function everyBuyOpensTheModal(scope: () => ParentNode, expected: number) {
  const count = buttons('Beli kredit').filter((b) => scope().contains(b)).length
  expect(count).toBe(expected)
  for (let index = 0; index < count; index += 1) {
    const target = buttons('Beli kredit').filter((b) => scope().contains(b))[index]
    expect(target?.disabled).toBe(false)
    await click(target)
    await settle()
    expect(dialog(), `button ${index + 1}`).not.toBeNull()
    await click(document.querySelector('[role="dialog"] button[aria-label="Tutup"]') ?? undefined)
    expect(dialog()).toBeNull()
  }
}

beforeEach(() => {
  fakeBrowser.reset()
  balance = 0
  vi.mocked(currentSession).mockResolvedValue(session)
  vi.mocked(storedUserId).mockResolvedValue('u1')
  vi.mocked(loadAccountStatus).mockImplementation(async () => status(balance))
  vi.mocked(refreshAccountStatus).mockImplementation(async () => status(balance))
  vi.mocked(loadLedger).mockResolvedValue([])
  vi.mocked(createPayment).mockResolvedValue({ ok: true, purchaseId: 'p1', qrUrl: 'https://api.midtrans.com/v2/qris/p1/qr-code', amountIdr: 10800, credits: 50, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() })
  vi.mocked(purchaseStatus).mockResolvedValue('pending')
})

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  container = null
  root = null
  location.hash = ''
  vi.clearAllMocks()
})

describe('every Beli kredit opens the purchase modal', () => {
  it('in the sidebar, the banner and the AI note on Lowongan', async () => {
    await render('#jobs?state=list')
    expect(dialog()).toBeNull()
    await everyBuyOpensTheModal(() => document, 3)
  })

  it('on Akun, next to the balance', async () => {
    await saveProfile(createEmptyProfile())
    await render('#account')
    expect(text()).toContain('Saldo kredit')
    await everyBuyOpensTheModal(() => document.querySelector('main')!, 1)
  })

  it('in the sidebar when the balance is not 0 (the secondary button)', async () => {
    balance = 12
    await render('#jobs?state=list')
    await everyBuyOpensTheModal(() => sidebar(), 1)
  })

  it('on the CV and the letter tab of an application', async () => {
    await saveProfile({ ...createEmptyProfile(), experience: [{ id: 'e1', company: 'PT Maju', title: 'Dev', start: '2020-01', end: '', current: true, description: 'Membangun aplikasi web' }] })
    const made = await addManualApplication({ title: 'Frontend Engineer', company: 'PT Contoh', url: '', description: 'Mencari frontend engineer dengan React.', status: 'draft' })
    if (!made.ok) throw new Error('seed failed')
    await render(`#applications/${made.app.id}`)

    for (const tab of ['CV', 'Surat']) {
      await click(buttons(tab)[0])
      await settle()
      expect(buttons('Beli kredit').filter((b) => !sidebar().contains(b)).length, tab).toBe(1)
      await everyBuyOpensTheModal(() => document.querySelector('main')!, 1)
    }
  })
})

describe('buying credits end to end', () => {
  it('shows the new balance in the sidebar once the payment is seen, without a reload', async () => {
    await render('#jobs?state=list')
    expect(sidebar().textContent).toContain('Saldo0')
    await click(buttons('Beli kredit').find((b) => sidebar().contains(b)))
    await settle()
    expect(dialog()?.querySelector('img')?.getAttribute('src')).toBe('https://api.midtrans.com/v2/qris/p1/qr-code')

    balance = 50
    vi.mocked(purchaseStatus).mockResolvedValue('paid')
    await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 3100))))
    await settle()

    expect(dialog()?.textContent).toContain('Pembayaran diterima')
    expect(sidebar().textContent).toContain('50 kredit')
    expect(sidebar().textContent).not.toContain('Saldo0')
    await click(buttons('Selesai')[0])
    expect(dialog()).toBeNull()
  })
})
