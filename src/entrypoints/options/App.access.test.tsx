import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { AccountStatus } from '../../core/account/access'
import { createEmptyProfile, setPersonalField } from '../../core/profile/profile'
import type { Session } from '../../core/sync/api'

// The platform seams the access gate reads. Nothing here reaches a real server.
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
import { loadProfile, saveProfile } from '../../platform/storage'
import { currentSession, finishLogin, startLogin, storedUserId } from '../../platform/sync'
import { App } from './App'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session: Session = { accessToken: 'a', refreshToken: 'r', expiresAt: 9_999_999_999, userId: 'u1', email: 'nama@example.test' }
const status = (change: Partial<AccountStatus> = {}): AccountStatus => ({
  credits: 3, paid: false, trialGranted: true, expiresAt: null, checkedAt: '2026-11-19T00:00:00.000Z', ...change,
})
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

function signedOut() {
  vi.mocked(currentSession).mockResolvedValue(null)
  vi.mocked(storedUserId).mockResolvedValue(null)
  vi.mocked(loadAccountStatus).mockResolvedValue(null)
  vi.mocked(refreshAccountStatus).mockResolvedValue(null)
}
function signedIn(current: AccountStatus | null) {
  vi.mocked(currentSession).mockResolvedValue(session)
  vi.mocked(storedUserId).mockResolvedValue('u1')
  vi.mocked(loadAccountStatus).mockResolvedValue(current)
  vi.mocked(refreshAccountStatus).mockResolvedValue(current)
}

let container: HTMLElement | null = null
let root: Root | null = null
const settle = async () => {
  for (let i = 0; i < 4; i += 1) await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))))
}
async function render(hash: string): Promise<HTMLElement> {
  location.hash = hash
  await act(async () => root?.unmount())
  container?.remove()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root!.render(<App />))
  await settle()
  return container
}

const text = () => container?.textContent ?? ''
const buttons = (label: string) => [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label) as HTMLButtonElement[]
const button = (label: string) => buttons(label)[0]
const click = (el: Element | undefined) => act(async () => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const field = (label: string) => [...document.querySelectorAll('label')].find((l) => l.textContent === label)?.control as HTMLInputElement
const type = (el: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
const sidebar = () => document.querySelector('aside') as HTMLElement
const AI_GATE = 'Kredit tidak cukup. Butuh 1 kredit; saldomu 0.'

async function signInThroughTheCard() {
  await type(field('Email'), 'nama@example.test')
  await click(button('Kirim kode'))
  await type(field('Kode'), '482913')
  // The sidebar has a "Masuk" of its own; the card's is the one inside the sign-in section.
  await click([...document.querySelectorAll('section[aria-label] button')].find((b) => b.textContent?.trim() === 'Masuk'))
  await settle()
}

beforeEach(() => {
  fakeBrowser.reset()
  vi.mocked(startLogin).mockResolvedValue({ ok: true })
  vi.mocked(finishLogin).mockResolvedValue({ ok: true })
  signedOut()
})

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  container = null
  root = null
  location.hash = ''
  vi.clearAllMocks()
})

describe('no session: preview with sample data', () => {
  it('shows sample jobs, says why, and every action is off', async () => {
    await render('#jobs')
    expect(text()).toContain('Frontend Engineer (React)')
    expect(text()).toContain('Contoh')
    expect(text()).toContain('Ini preview dengan data contoh. Lowongan, Lamaran, CV, dan Surat baru bisa dipakai setelah kamu masuk.')
    expect(text()).toContain('Masuk untuk memakai')
    for (const label of ['Buka & isi', 'Siapkan lamaran', 'Simpan lowongan', 'Segarkan', 'Atur']) {
      const found = buttons(label)
      expect(found.length, label).toBeGreaterThan(0)
      expect(found.every((b) => b.disabled), label).toBe(true)
    }
  })

  it('has "Belum masuk" in the sidebar with a Masuk button, and no Akun place', async () => {
    await render('#jobs')
    expect(sidebar().textContent).toContain('Belum masuk')
    expect(sidebar().textContent).toContain('Kamu sedang melihat preview dengan data contoh.')
    expect(button('Masuk')).toBeTruthy()
    expect([...sidebar().querySelectorAll('nav button')].map((b) => b.textContent)).toEqual(['Profile', 'Lowongan', 'Lamaran', 'Data'])
  })

  it('shows sample applications, with Tambah lamaran off', async () => {
    await render('#applications')
    expect(text()).toContain('PT Contoh Karya')
    expect(button('Tambah lamaran')?.disabled).toBe(true)
  })

  it('does not show the person\'s own profile before sign-in: Profile asks to sign in', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    await render('#personal')
    expect(text()).toContain('Masuk ke job-kit')
    expect(field('Nama depan')).toBeUndefined()
  })

  it('opens the sign-in card from the sidebar and from the banner', async () => {
    await render('#jobs')
    await click([...sidebar().querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Masuk'))
    expect(text()).toContain('Masuk ke job-kit')
    expect(text()).not.toContain('Frontend Engineer (React)')

    await render('#jobs')
    await click(button('Masuk untuk memakai'))
    expect(text()).toContain('Masuk ke job-kit')
  })

  it('after the code is right: ensure_account runs once and the own profile shows', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    vi.mocked(finishLogin).mockImplementation(async () => {
      signedIn(status())
      return { ok: true }
    })
    await render('#personal')
    await signInThroughTheCard()

    expect(finishLogin).toHaveBeenCalledWith('nama@example.test', '482913')
    expect(refreshAccountStatus).toHaveBeenCalledTimes(1)
    expect(field('Nama depan').value).toBe('Siti')
    expect(text()).not.toContain('Masuk ke job-kit')
    expect(sidebar().textContent).toContain('3')
  })
})

describe('signed in, trial credits used up: only AI stops', () => {
  const trialOver = () => signedIn(status({ credits: 0, paid: false, trialGranted: true }))

  it('keeps Lowongan open and editable', async () => {
    trialOver()
    await render('#jobs?state=list')
    expect(button('Buka & isi')?.disabled).toBe(false)
    expect(button('Simpan lowongan')?.disabled).toBe(false)
    await click(button('Remote'))
    expect(button('Remote')?.getAttribute('aria-pressed')).toBe('true')
    expect(button('Segarkan')).toBeTruthy()
  })

  it('turns the AI buttons off with the one credit text, and offers Beli kredit; Siapkan lamaran calls no AI and stays on', async () => {
    trialOver()
    await render('#jobs?state=list')
    const prepare = buttons('Siapkan lamaran')
    expect(prepare.length).toBeGreaterThan(0)
    expect(prepare.every((b) => !b.disabled)).toBe(true)
    expect(text()).not.toContain('Siapkan lamaran · 1 kredit')
    expect(button('Nilai dengan AI · 1 kredit')?.disabled).toBe(true)
    expect(text()).toContain(AI_GATE)
    expect(text()).toContain('Percobaan gratismu sudah habis. Lowongan dan Lamaran tetap terbuka dan bisa kamu edit; hanya Buat CV, Buat surat, dan Nilai dengan AI yang berhenti sampai kamu membeli kredit.')
    expect(buttons('Beli kredit').length).toBeGreaterThanOrEqual(2)
    expect(text()).not.toContain('Masuk untuk memakai')
  })

  it('shows the sidebar as normal, without lock or badge, with the balance and the trial text', async () => {
    trialOver()
    await render('#jobs?state=list')
    expect([...sidebar().querySelectorAll('nav button')].map((b) => b.textContent)).toEqual(['Profile', 'Lowongan', 'Lamaran', 'Data', 'Akun'])
    expect(sidebar().querySelectorAll('nav svg')).toHaveLength(0)
    expect(sidebar().textContent).toContain('0 kredit')
    expect(sidebar().textContent).toContain('Percobaanmu habis. Hanya AI yang berhenti; halaman dan datamu tetap terbuka.')
  })

  it('keeps Lamaran open and editable', async () => {
    trialOver()
    await render('#applications?state=list')
    expect(button('Tambah lamaran')?.disabled).toBe(false)
    await click(button('Tambah lamaran'))
    expect(field('Judul lowongan')).toBeTruthy()
  })

  it('keeps Profile open and editable', async () => {
    trialOver()
    await render('#personal')
    expect(field('Nama depan')?.disabled).toBe(false)
  })
})

describe('signed in, the balance not known or not the trial', () => {
  it('status still unknown counts as checking: pages open, no Beli kredit, AI waits for the balance', async () => {
    signedIn(null)
    await render('#jobs?state=list')
    expect(button('Buka & isi')?.disabled).toBe(false)
    expect(button('Simpan lowongan')?.disabled).toBe(false)
    expect(buttons('Siapkan lamaran').every((b) => !b.disabled)).toBe(true)
    expect(button('Nilai dengan AI · 1 kredit')?.disabled).toBe(true)
    expect(text()).toContain('Memeriksa saldo kredit…')
    expect(text()).not.toContain('Beli kredit')
    expect(text()).not.toContain(AI_GATE)
    expect(text()).not.toContain('Masuk untuk memakai')
  })

  it('free without a trial and no credits: pages open, AI follows the balance', async () => {
    signedIn(status({ credits: 0, paid: false, trialGranted: false }))
    await render('#jobs?state=list')
    expect(button('Buka & isi')?.disabled).toBe(false)
    expect(buttons('Siapkan lamaran').every((b) => !b.disabled)).toBe(true)
    expect(button('Nilai dengan AI · 1 kredit')?.disabled).toBe(true)
    expect(text()).toContain(AI_GATE)
    expect(text()).not.toContain('Percobaan gratismu sudah habis')
    expect(buttons('Beli kredit').length).toBeGreaterThan(0)
  })

  it('paid with 0 credits: everything open, only AI off', async () => {
    signedIn(status({ credits: 0, paid: true }))
    await render('#jobs?state=list')
    expect(button('Buka & isi')?.disabled).toBe(false)
    expect(button('Simpan lowongan')?.disabled).toBe(false)
    expect(buttons('Siapkan lamaran').every((b) => !b.disabled)).toBe(true)
    expect(button('Nilai dengan AI · 1 kredit')?.disabled).toBe(true)
    expect(text()).toContain(AI_GATE)
    expect(buttons('Beli kredit').length).toBeGreaterThan(0)
    await render('#applications?state=list')
    expect(button('Tambah lamaran')?.disabled).toBe(false)
  })

  it('with credits left the AI buttons are on, and show their cost; Siapkan lamaran shows none', async () => {
    signedIn(status({ credits: 3 }))
    await render('#jobs?state=list')
    expect(buttons('Siapkan lamaran').every((b) => !b.disabled)).toBe(true)
    expect(button('Nilai dengan AI · 1 kredit')?.disabled).toBe(false)
    expect(text()).not.toContain('Siapkan lamaran · 1 kredit')
    expect(text()).not.toContain(AI_GATE)
    expect(sidebar().textContent).toContain('3 kredit')
    expect(sidebar().textContent).toContain('Percobaan gratis. Habis, hanya AI yang berhenti.')
    expect(buttons('Beli kredit').length).toBe(1)
  })

  it('a paid account with credits shows when they lapse', async () => {
    signedIn(status({ credits: 42, paid: true, expiresAt: '2027-03-18T10:00:00.000Z' }))
    await render('#jobs?state=list')
    expect(sidebar().textContent).toContain('42 kredit')
    expect(sidebar().textContent).toContain('Hangus 18 Mar 2027')
  })

  it('warns in the last 30 days', async () => {
    signedIn(status({ credits: 42, paid: true, expiresAt: daysFromNow(10) }))
    await render('#jobs?state=list')
    expect(sidebar().textContent).toContain('Kreditmu hangus pada')
    expect(sidebar().textContent).toContain('Beli paket memperpanjang 1 tahun.')
  })

  it('works offline from the cached balance when the token cannot be refreshed', async () => {
    vi.mocked(currentSession).mockResolvedValue(null)
    vi.mocked(storedUserId).mockResolvedValue('u1')
    vi.mocked(loadAccountStatus).mockResolvedValue(status({ credits: 42, paid: true }))
    vi.mocked(refreshAccountStatus).mockResolvedValue(status({ credits: 42, paid: true }))
    await render('#jobs?state=list')
    expect(text()).not.toContain('Masuk lagi ke job-kit')
    expect(text()).not.toContain('Masuk untuk memakai')
    expect(sidebar().textContent).toContain('42 kredit')
    expect(button('Buka & isi')?.disabled).toBe(false)
  })
})

describe('session expired', () => {
  it('goes back to the sign-in gate, says so, and leaves the stored data alone', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    vi.mocked(storedUserId).mockReset()
    vi.mocked(storedUserId).mockResolvedValueOnce('u1').mockResolvedValue(null)
    vi.mocked(currentSession).mockResolvedValue(null)
    vi.mocked(loadAccountStatus).mockResolvedValue(status({ credits: 0 }))
    await render('#jobs?state=list')

    expect(text()).toContain('Masuk lagi ke job-kit')
    expect(text()).toContain('Sesi masukmu sudah habis. Masuk lagi untuk memakai AI. Data dan profilmu tetap ada di browser ini.')
    expect(text()).not.toContain('Frontend Engineer (React)')
    expect((await loadProfile()).personal.firstName).toBe('Siti')
  })

  it('shows everything again after signing in', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    vi.mocked(storedUserId).mockReset()
    vi.mocked(storedUserId).mockResolvedValueOnce('u1').mockResolvedValue(null)
    vi.mocked(currentSession).mockResolvedValue(null)
    vi.mocked(finishLogin).mockImplementation(async () => {
      signedIn(status())
      return { ok: true }
    })
    await render('#personal')
    expect(text()).toContain('Masuk lagi ke job-kit')

    await signInThroughTheCard()
    expect(field('Nama depan').value).toBe('Siti')
    expect(text()).not.toContain('Masuk lagi ke job-kit')
  })
})
