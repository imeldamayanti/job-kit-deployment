import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PanelLoginGate } from '../sidepanel/PanelLoginGate'
import { LoginGate, type LoginApi } from './LoginGate'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null

const api = (change: Partial<LoginApi> = {}): LoginApi => ({
  startLogin: vi.fn().mockResolvedValue({ ok: true }),
  finishLogin: vi.fn().mockResolvedValue({ ok: true }),
  ...change,
})

async function render(node: React.ReactNode): Promise<string> {
  container?.remove()
  container = document.createElement('div')
  document.body.append(container)
  await act(async () => createRoot(container!).render(node))
  return container.textContent ?? ''
}

const field = (label: string) => [...document.querySelectorAll('label')].find((l) => l.textContent === label)?.control as HTMLInputElement
const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
const click = (el: Element | undefined) => act(async () => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const type = (el: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

afterEach(() => {
  container?.remove()
  container = null
  vi.useRealTimers()
})

describe('LoginGate', () => {
  it('asks for an email first and says a new account gets 3 free credits', async () => {
    const text = await render(<LoginGate variant="new" api={api()} onSignedIn={() => {}} />)
    expect(text).toContain('Masuk ke job-kit')
    expect(text).toContain('Masukkan emailmu. Kami kirim kode masuk, tanpa kata sandi.')
    expect(text).toContain('3 kredit gratis saat daftar')
    expect(button('Kirim kode')?.disabled).toBe(true)
    await type(field('Email'), 'nama@example.test')
    expect(button('Kirim kode')?.disabled).toBe(false)
  })

  it('sends the code, then asks for it with the email shown', async () => {
    const a = api()
    await render(<LoginGate variant="new" api={a} onSignedIn={() => {}} />)
    await type(field('Email'), 'nama@example.test')
    await click(button('Kirim kode'))
    expect(a.startLogin).toHaveBeenCalledWith('nama@example.test')
    expect(container?.textContent).toContain('Cek emailmu')
    expect(container?.textContent).toContain('Kode dikirim ke nama@example.test.')
    expect(field('Kode')).toBeTruthy()
  })

  it('signs in with the code and tells the page, without doing anything else itself', async () => {
    const a = api()
    const onSignedIn = vi.fn()
    await render(<LoginGate variant="new" api={a} onSignedIn={onSignedIn} />)
    await type(field('Email'), 'nama@example.test')
    await click(button('Kirim kode'))
    await type(field('Kode'), '482913')
    await click(button('Masuk'))
    expect(a.finishLogin).toHaveBeenCalledWith('nama@example.test', '482913')
    expect(onSignedIn).toHaveBeenCalledTimes(1)
  })

  it('says the code is wrong and does not sign in', async () => {
    const a = api({ finishLogin: vi.fn().mockResolvedValue({ ok: false, reason: 'rejected' }) })
    const onSignedIn = vi.fn()
    await render(<LoginGate variant="new" api={a} onSignedIn={onSignedIn} />)
    await type(field('Email'), 'nama@example.test')
    await click(button('Kirim kode'))
    await type(field('Kode'), '000000')
    await click(button('Masuk'))
    expect(container?.textContent).toContain('Kodenya salah. Periksa lagi, atau minta kode baru.')
    expect(field('Kode').getAttribute('aria-invalid')).toBe('true')
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('says so when the code could not be sent, and stays on the email step', async () => {
    const a = api({ startLogin: vi.fn().mockResolvedValue({ ok: false, reason: 'network' }) })
    await render(<LoginGate variant="new" api={a} onSignedIn={() => {}} />)
    await type(field('Email'), 'nama@example.test')
    await click(button('Kirim kode'))
    expect(container?.textContent).toContain('Tidak terhubung ke internet atau server. Coba lagi.')
    expect(container?.textContent).toContain('Masuk ke job-kit')
  })

  it('goes back to the email step with "Ganti email"', async () => {
    await render(<LoginGate variant="new" api={api()} onSignedIn={() => {}} />)
    await type(field('Email'), 'nama@example.test')
    await click(button('Kirim kode'))
    await click(button('Ganti email'))
    expect(container?.textContent).toContain('Masuk ke job-kit')
    expect(field('Email')).toBeTruthy()
  })

  it('lets the code be asked for again only after a wait', async () => {
    vi.useFakeTimers()
    const a = api()
    await render(<LoginGate variant="new" api={a} onSignedIn={() => {}} />)
    await type(field('Email'), 'nama@example.test')
    await click(button('Kirim kode'))
    expect(button('Kirim ulang kode')?.disabled).toBe(true)
    expect(button('Kirim ulang kode')?.textContent).toContain('1:00')
    await act(async () => void vi.advanceTimersByTime(61_000))
    expect(button('Kirim ulang kode')?.disabled).toBe(false)
    await click(button('Kirim ulang kode'))
    expect(a.startLogin).toHaveBeenCalledTimes(2)
  })

  it('the session-expired gate says the data stays and asks to sign in again', async () => {
    const text = await render(<LoginGate variant="expired" api={api()} onSignedIn={() => {}} />)
    expect(text).toContain('Masuk lagi ke job-kit')
    expect(text).toContain('Kami kirim kode masuk ke emailmu, tanpa kata sandi.')
    expect(text).toContain('Sesi masukmu sudah habis.')
    expect(text).toContain('Masuk lagi untuk memakai AI. Data dan profilmu tetap ada di browser ini.')
    expect(text).not.toContain('3 kredit gratis')
  })
})

describe('PanelLoginGate', () => {
  it('is the same sign-in, in the panel', async () => {
    const a = api()
    const text = await render(<PanelLoginGate variant="new" api={a} onSignedIn={() => {}} />)
    expect(text).toContain('Masuk ke job-kit')
    await type(field('Email'), 'nama@example.test')
    await click(button('Kirim kode'))
    expect(a.startLogin).toHaveBeenCalledWith('nama@example.test')
  })

  it('shows the session-expired message too', async () => {
    const text = await render(<PanelLoginGate variant="expired" api={api()} onSignedIn={() => {}} />)
    expect(text).toContain('Masuk lagi ke job-kit')
    expect(text).toContain('Sesi masukmu sudah habis.')
  })
})
