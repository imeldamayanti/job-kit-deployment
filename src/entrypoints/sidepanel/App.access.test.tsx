import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { AccountStatus } from '../../core/account/access'
import type { Session } from '../../core/sync/api'

vi.mock('../../platform/sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../platform/sync')>()),
  currentSession: vi.fn(),
  storedUserId: vi.fn(),
  startLogin: vi.fn(),
  finishLogin: vi.fn(),
}))
vi.mock('../../platform/account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../platform/account')>()),
  loadAccountStatus: vi.fn(),
  refreshAccountStatus: vi.fn(),
}))

import { loadAccountStatus, refreshAccountStatus } from '../../platform/account'
import { currentSession, finishLogin, startLogin, storedUserId } from '../../platform/sync'
import { App } from './App'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session: Session = { accessToken: 'a', refreshToken: 'r', expiresAt: 9_999_999_999, userId: 'u1', email: 'nama@example.test' }
const status: AccountStatus = { credits: 0, paid: false, trialGranted: true, expiresAt: null, checkedAt: '2026-11-19T00:00:00.000Z' }

let container: HTMLElement | null = null
let root: Root | null = null
const settle = async () => {
  for (let i = 0; i < 4; i += 1) await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))))
}
async function render() {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root!.render(<App />))
  await settle()
}
const text = () => container?.textContent ?? ''
const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
const click = (el: Element | undefined) => act(async () => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

beforeEach(() => {
  fakeBrowser.reset()
  vi.mocked(startLogin).mockResolvedValue({ ok: true })
  vi.mocked(finishLogin).mockResolvedValue({ ok: true })
  vi.mocked(currentSession).mockResolvedValue(null)
  vi.mocked(storedUserId).mockResolvedValue(null)
  vi.mocked(loadAccountStatus).mockResolvedValue(null)
  vi.mocked(refreshAccountStatus).mockResolvedValue(null)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  container = null
  root = null
  vi.clearAllMocks()
})

describe('panel access', () => {
  it('no session: sample form, no Fill, and one way in', async () => {
    await render()
    expect(text()).toContain('Ini preview dengan data contoh. Isi form otomatis baru jalan setelah kamu masuk.')
    expect(text()).toContain('Nama Contoh')
    expect(button('Fill')).toBeUndefined()
    await click(button('Masuk untuk memakai'))
    expect(text()).toContain('Masuk ke job-kit')
  })

  it('a signed-in person gets the panel as before, even with no credits (only AI stops)', async () => {
    vi.mocked(currentSession).mockResolvedValue(session)
    vi.mocked(storedUserId).mockResolvedValue('u1')
    vi.mocked(loadAccountStatus).mockResolvedValue(status)
    vi.mocked(refreshAccountStatus).mockResolvedValue(status)
    await render()
    expect(text()).not.toContain('Ini preview dengan data contoh')
    expect(button('Autofill')).toBeTruthy()
    expect(button('Profile')).toBeTruthy()
  })

  it('works offline with the stored session and the cached status', async () => {
    vi.mocked(storedUserId).mockResolvedValue('u1')
    vi.mocked(loadAccountStatus).mockResolvedValue(status)
    await render()
    expect(text()).not.toContain('Masuk lagi ke job-kit')
    expect(button('Autofill')).toBeTruthy()
  })

  it('session expired: the gate with the expired message', async () => {
    vi.mocked(storedUserId).mockReset()
    vi.mocked(storedUserId).mockResolvedValueOnce('u1').mockResolvedValue(null)
    await render()
    expect(text()).toContain('Masuk lagi ke job-kit')
    expect(text()).toContain('Sesi masukmu sudah habis.')
  })
})
