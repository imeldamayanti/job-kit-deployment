import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { letterViewFor, type LetterViewName } from '../../core/letters/view'
import { LetterTab, type LetterTabState } from './LetterTab'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null

const handlers = () => ({ onCreate: vi.fn(), onContinue: vi.fn(), onDismissNotice: vi.fn(), onLink: vi.fn(), onEdit: vi.fn(), onRestore: vi.fn(), onCopy: vi.fn(), onLang: vi.fn(), onTone: vi.fn() })
const state = (name: LetterViewName, change: Partial<LetterTabState> = {}): LetterTabState => ({ ...letterViewFor(name), ...handlers(), ...change })

async function render(tab: LetterTabState): Promise<string> {
  container?.remove()
  container = document.createElement('div')
  document.body.append(container)
  await act(async () => createRoot(container!).render(<LetterTab {...tab} />))
  return container.textContent ?? ''
}

const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
const click = (el: Element | undefined) => act(async () => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const editor = () => document.querySelector<HTMLTextAreaElement>('textarea')!
const typeInto = (el: HTMLTextAreaElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

afterEach(() => {
  container?.remove()
  container = null
})

describe('LetterTab: before there is a letter', () => {
  it('offers Buat surat, says what is sent, and that the name stays here', async () => {
    const tab = state('empty')
    const text = await render(tab)
    expect(text).toContain('Surat untuk lowongan ini belum dibuat')
    expect(text).toContain('Yang dikirim ke penyedia AI')
    expect(text).toMatch(/nama.*tidak dikirim/i)
    await click(button('Buat surat'))
    expect(tab.onCreate).toHaveBeenCalledTimes(1)
  })

  it('lets the person choose the language and the tone before writing', async () => {
    const tab = state('empty', { lang: 'id', tone: 'formal' })
    await render(tab)
    const pressed = (label: string) => button(label)?.getAttribute('aria-pressed')
    expect([pressed('Indonesia'), pressed('English'), pressed('Formal'), pressed('Santai')]).toEqual(['true', 'false', 'true', 'false'])
    await click(button('English'))
    expect(tab.onLang).toHaveBeenCalledWith('en')
    await click(button('Santai'))
    expect(tab.onTone).toHaveBeenCalledWith('casual')
  })

  it('says the language was read from the posting', async () => {
    expect(await render(state('empty'))).toContain('Bahasa dipilih dari teks lowongan.')
    expect(await render(state('english'))).not.toContain('Bahasa dipilih dari teks lowongan.')
  })

  it('shows the creating card while busy', async () => {
    const text = await render(state('busy'))
    expect(text).toContain('Sedang membuat')
    expect(button('Sedang membuat…')?.hasAttribute('disabled')).toBe(true)
  })

  it('says to fill Work Experience first', async () => {
    const tab = state('noexp')
    expect(await render(tab)).toContain('Isi Work Experience dulu')
    await click(button('Ke Profile'))
    expect(tab.onLink).toHaveBeenCalledWith('profile')
  })

  it('turns Buat surat off with the reason and a way to fix it, and says the tracker still works', async () => {
    const tab = state('off')
    const text = await render(tab)
    expect(text).toContain('Kunci API belum diisi')
    expect(text).toContain('Tracker tetap bisa dipakai penuh')
    expect(button('Buat surat')?.hasAttribute('disabled')).toBe(true)
    await click(button('Buka Atur Lowongan'))
    expect(tab.onLink).toHaveBeenCalledWith('settings')
  })

  it('names the daily limit', async () => {
    expect(await render(state('limit'))).toContain('Batas 20 panggilan AI hari ini tercapai')
  })

  it('asks before a model that may train on the data, and goes on only when told to', async () => {
    const tab = state('notice')
    expect(await render(tab)).toContain('bisa memakai data untuk melatih')
    await click(button('Lanjut'))
    expect(tab.onContinue).toHaveBeenCalledTimes(1)
    await click(button('Batal'))
    expect(tab.onDismissNotice).toHaveBeenCalledTimes(1)
    expect(tab.onCreate).not.toHaveBeenCalled()
  })

  it('shows a refusal with the reason and nothing else of a letter', async () => {
    const tab = state('rejected')
    const text = await render(tab)
    expect(text).toContain('Surat tidak ditampilkan')
    expect(text).toContain('"kubernetes"')
    expect(document.querySelector('textarea')).toBeNull()
    await click(button('Coba lagi'))
    expect(tab.onCreate).toHaveBeenCalledTimes(1)
  })
})

describe('LetterTab: with a letter', () => {
  it('shows the letter in an editor with its word count and the validated mark', async () => {
    const tab = state('result')
    const text = await render(tab)
    expect(editor().value).toBe(tab.letter!.body)
    expect(text).toMatch(/\d+ kata/)
    expect(text).toContain('Tervalidasi')
    expect(text).toMatch(/Nama di penutup diisi dari Profile.*tidak dikirim ke AI/)
    expect(button('Kembalikan ke versi AI')).toBeUndefined()
  })

  it('counts the words of what is in the editor as it changes', async () => {
    await render(state('result'))
    await typeInto(editor(), 'satu dua tiga empat lima')
    expect(container!.textContent).toContain('5 kata')
  })

  it('hands every edit to the page', async () => {
    const tab = state('result')
    await render(tab)
    await typeInto(editor(), 'Surat saya sendiri.')
    expect(tab.onEdit).toHaveBeenLastCalledWith('Surat saya sendiri.')
  })

  it('copies the letter and says whether it worked', async () => {
    const tab = state('result')
    await render(tab)
    await click(button('Salin'))
    expect(tab.onCopy).toHaveBeenCalledTimes(1)
    expect(await render(state('copied'))).toContain('Surat disalin.')
  })

  it('writes again at once when the letter was not edited', async () => {
    const tab = state('result')
    await render(tab)
    await click(button('Buat ulang'))
    expect(tab.onCreate).toHaveBeenCalledTimes(1)
  })

  it('marks an edited letter and offers to take the AI text back', async () => {
    const tab = state('edited')
    const text = await render(tab)
    expect(text).toContain('Diedit')
    expect(text).not.toContain('Tervalidasi')
    await click(button('Kembalikan ke versi AI'))
    expect(tab.onRestore).toHaveBeenCalledTimes(1)
    expect(editor().value).toBe(tab.letter!.aiBody)
  })

  it('asks before writing over an edited letter', async () => {
    const tab = state('edited')
    await render(tab)
    await click(button('Buat ulang'))
    expect(tab.onCreate).not.toHaveBeenCalled()
    expect(container!.textContent).toContain('Surat ini sudah kamu edit')
    await click(button('Batal'))
    expect(tab.onCreate).not.toHaveBeenCalled()
    await click(button('Buat ulang'))
    await click(button('Timpa'))
    expect(tab.onCreate).toHaveBeenCalledTimes(1)
  })

  it('says the Profile changed since the letter was made, and offers Buat ulang', async () => {
    const tab = state('stale')
    const text = await render(tab)
    expect(text).toContain('Profilmu berubah sejak surat ini dibuat')
    expect(text).toContain('Surat lama tetap bisa disalin')
    expect(button('Salin')).toBeDefined()
  })

  it('says the chosen language or tone is used at the next Buat ulang, not now', async () => {
    const tab = state('result', { lang: 'en' })
    const text = await render(tab)
    expect(text).toContain('Dipakai saat Buat ulang')
    expect(editor().value).toBe(tab.letter!.body)
    expect(await render(state('result'))).not.toContain('Dipakai saat Buat ulang')
  })

  it('explains how the letter fills the form and that files are not touched', async () => {
    const text = await render(state('result'))
    expect(text).toContain('Cover letter')
    expect(text).toContain('Surat lamaran')
    expect(text).toContain('Field unggah file tidak disentuh')
  })

  it('keeps Buat ulang off when the reason is a lasting one, but the letter stays readable', async () => {
    const tab = state('result', { availability: { ok: false, reason: 'quota', message: 'Kuota atau saldo di penyedia habis. Periksa di Atur Lowongan.', link: 'settings' } })
    const text = await render(tab)
    expect(text).toContain('Kuota atau saldo di penyedia habis')
    expect(button('Buat ulang')?.hasAttribute('disabled')).toBe(true)
    expect(editor().value).toBe(tab.letter!.body)
  })
})
