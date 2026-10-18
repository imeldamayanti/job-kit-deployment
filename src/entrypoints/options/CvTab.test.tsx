import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cvViewFor, type CvViewName } from '../../core/tailor/view'
import { CvTab, type CvTabState } from './CvTab'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null

const handlers = () => ({ onCreate: vi.fn(), onContinue: vi.fn(), onDismissNotice: vi.fn(), onLink: vi.fn(), onEdit: vi.fn(), onRestore: vi.fn(), onDownload: vi.fn(), onDownloadWord: vi.fn(), onCopyText: vi.fn() })
const state = (name: CvViewName, change: Partial<CvTabState> = {}): CvTabState => ({ ...cvViewFor(name), ...handlers(), ...change })

async function render(tab: CvTabState): Promise<string> {
  container?.remove()
  container = document.createElement('div')
  document.body.append(container)
  await act(async () => createRoot(container!).render(<CvTab {...tab} />))
  return container.textContent ?? ''
}

const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
const click = (el: Element | undefined) => act(async () => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const typeInto = (el: HTMLTextAreaElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

afterEach(() => {
  container?.remove()
  container = null
})

describe('CvTab: before there is a CV', () => {
  it('offers Buat CV, says what is sent to the provider, and asks to make one when clicked', async () => {
    const tab = state('empty')
    const text = await render(tab)
    expect(text).toContain('CV untuk lowongan ini belum dibuat')
    expect(text).toContain('Yang dikirim ke penyedia AI')
    expect(button('Buat CV')?.hasAttribute('disabled')).toBe(false)
    await click(button('Buat CV'))
    expect(tab.onCreate).toHaveBeenCalledTimes(1)
  })

  it('turns the button off while the reason is still unknown', async () => {
    await render(state('empty', { availability: null }))
    expect(button('Buat CV')?.hasAttribute('disabled')).toBe(true)
  })

  it('shows that it is working, once', async () => {
    const text = await render(state('busy'))
    expect(button('Sedang membuat…')?.hasAttribute('disabled')).toBe(true)
    expect(text).toContain('Biasanya 10–20 detik')
  })

  it('turns the button off and says why, with a way to fix it (AI tidak tersedia)', async () => {
    const tab = state('off')
    const text = await render(tab)
    expect(text).toContain('Kunci API belum diisi. Isi di Atur Lowongan.')
    expect(text).toContain('Tracker tetap bisa dipakai penuh')
    expect(button('Buat CV')?.hasAttribute('disabled')).toBe(true)
    await click(button('Buka Atur Lowongan'))
    expect(tab.onLink).toHaveBeenCalledWith('settings')
  })

  it('says AI is not in this version and offers no settings button (shared build)', async () => {
    const tab = state('off', { availability: { ok: false, reason: 'ai-unavailable', message: 'Fitur AI belum tersedia di versi ini.', link: 'none' } })
    const text = await render(tab)
    expect(text).toContain('Fitur AI belum tersedia di versi ini.')
    expect(text).toContain('Tracker tetap bisa dipakai penuh')
    expect(button('Buat CV')?.hasAttribute('disabled')).toBe(true)
    expect(button('Buka Atur Lowongan')).toBeUndefined()
  })

  it('says the daily limit is reached', async () => {
    const text = await render(state('limit'))
    expect(text).toContain('Batas 20 panggilan AI hari ini tercapai.')
    expect(button('Buat CV')?.hasAttribute('disabled')).toBe(true)
  })

  it('asks for Work Experience when the Profile has none, and points to the Profile', async () => {
    const tab = state('noexp')
    const text = await render(tab)
    expect(text).toContain('Isi Work Experience dulu')
    expect(button('Buat CV')).toBeUndefined()
    await click(button('Ke Profile'))
    expect(tab.onLink).toHaveBeenCalledWith('profile')
  })

  it('points to the posting text when it is missing', async () => {
    const tab = state('empty', { availability: { ok: false, reason: 'no-text', message: 'Tempel teks lowongan dulu.', link: 'description' } })
    await render(tab)
    await click(button('Tempel teks lowongan'))
    expect(tab.onLink).toHaveBeenCalledWith('description')
  })

  it('asks before a model that may train on the data, and goes on or stops', async () => {
    const tab = state('notice')
    const text = await render(tab)
    expect(text).toContain('bisa memakai data untuk melatih')
    await click(button('Lanjut'))
    expect(tab.onContinue).toHaveBeenCalledTimes(1)
    await click(button('Batal'))
    expect(tab.onDismissNotice).toHaveBeenCalledTimes(1)
  })

  it('shows no CV when the fact checker refused it, and says what the Profile lacks (ditolak)', async () => {
    const tab = state('rejected')
    const text = await render(tab)
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('CV tidak ditampilkan')
    expect(text).toContain('"Kubernetes"')
    expect(text).toContain('"50%"')
    expect(document.querySelector('ins, del')).toBeNull()
    await click(button('Coba lagi'))
    expect(tab.onCreate).toHaveBeenCalledTimes(1)
  })

  it('keeps an earlier CV on screen when a new one is refused', async () => {
    const text = await render(state('rejected', { cv: cvViewFor('result').cv }))
    expect(text).toContain('CV tidak ditampilkan')
    expect(text).toContain('Cakupan requirement: 4 dari 6')
  })
})

describe('CvTab: a CV (hasil)', () => {
  it('shows how many requirements are covered, and which are not, without filling the gaps', async () => {
    const text = await render(state('result'))
    expect(text).toContain('Cakupan requirement: 4 dari 6')
    expect(text).toContain('Tertutup')
    expect(text).toContain('React dan TypeScript')
    expect(text).toContain('Belum tertutup')
    expect(text).toContain('GraphQL')
    expect(text).toContain('Yang belum tertutup tidak pernah ditambal')
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('4')
  })

  it('shows the Profile and the CV side by side, with the facts from the Profile', async () => {
    const text = await render(state('result'))
    expect(text).toContain('Asli (Profile)')
    expect(text).toContain('Disesuaikan untuk lowongan ini')
    expect(text).toContain('Software Engineer')
    expect(text).toContain('PT Contoh Teknologi')
    expect(text).toContain('Agu 2023 – sekarang')
    expect(text).toContain('Universitas Contoh Nusantara')
  })

  it('marks what changed: added words as ins and cut words as del, never red', async () => {
    await render(state('result'))
    expect(document.querySelectorAll('ins').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('del').length).toBeGreaterThan(0)
    for (const el of document.querySelectorAll('ins, del')) expect(el.className).not.toMatch(/rose|red/)
  })

  it('says how the skills changed and that originals left out stay in the Profile', async () => {
    const text = await render(state('result'))
    expect(text).toMatch(/Urutan diubah/)
    expect(text).toMatch(/tidak ada skill ditambah/i)
    expect(text).toMatch(/masih ada di Profile/)
  })

  it('carries the Tervalidasi mark for an AI result, and Diedit for one the person changed', async () => {
    expect(await render(state('result'))).toContain('Tervalidasi')
    const edited = await render(state('edited'))
    expect(edited).toContain('Diedit')
    expect(edited).not.toContain('Tervalidasi')
  })

  it('offers Kembalikan ke versi AI only for an edited CV', async () => {
    await render(state('result'))
    expect(button('Kembalikan ke versi AI')).toBeUndefined()
    const tab = state('edited')
    await render(tab)
    await click(button('Kembalikan ke versi AI'))
    expect(tab.onRestore).toHaveBeenCalledTimes(1)
  })

  it('has no button that uploads the CV to a form: it is only downloaded (PRD §4)', async () => {
    await render(state('result'))
    expect([...document.querySelectorAll('button')].some((b) => /unggah|upload|kirim/i.test(b.textContent ?? ''))).toBe(false)
  })
})

describe('CvTab: editing by hand (FR-41)', () => {
  it('opens each experience as text with one bullet per line, and saves what is typed', async () => {
    const tab = state('result')
    await render(tab)
    await click(button('Edit'))
    const boxes = [...document.querySelectorAll('textarea')]
    expect(boxes).toHaveLength(2)
    expect(boxes[0]?.value).toBe(
      'Membangun dashboard pelanggan dengan React dan TypeScript.\nMenaikkan cakupan tes dari 40% ke 70% dengan Jest.\nMenulis REST API memakai Node.js dan PostgreSQL.',
    )
    await typeInto(boxes[0]!, 'Membangun dashboard internal.\nMenulis tes dengan Jest.')
    expect(tab.onEdit).toHaveBeenLastCalledWith({
      skills: ['React', 'TypeScript', 'Node.js', 'Jest', 'PostgreSQL'],
      experience: [
        { sourceId: 'exp-a1', bullets: ['Membangun dashboard internal.', 'Menulis tes dengan Jest.'] },
        { sourceId: 'exp-a2', bullets: ['Membantu memindahkan halaman statis ke React.'] },
      ],
      education: ['edu-a1'],
    })
  })

  it('lets a skill be removed, and nothing else added', async () => {
    const tab = state('result')
    await render(tab)
    await click(button('Edit'))
    await click(document.querySelector('[aria-label="Hapus skill Jest"]') ?? undefined)
    expect(tab.onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'] }))
    expect(document.querySelector('input')).toBeNull()
  })

  it('goes back to the preview with Selesai', async () => {
    await render(state('result'))
    await click(button('Edit'))
    await click(button('Selesai'))
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
    expect(button('Edit')).toBeDefined()
  })
})

describe('CvTab: Buat ulang (FR-45)', () => {
  it('makes a new CV at once when the old one was not edited', async () => {
    const tab = state('result')
    await render(tab)
    await click(button('Buat ulang'))
    expect(tab.onCreate).toHaveBeenCalledTimes(1)
  })

  it('asks first when the CV was edited, and only then replaces it', async () => {
    const tab = state('edited')
    const text = await render(tab)
    expect(text).not.toContain('Suntinganmu akan ditimpa')
    await click(button('Buat ulang'))
    expect(tab.onCreate).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Suntinganmu akan ditimpa')
    await click(button('Timpa'))
    expect(tab.onCreate).toHaveBeenCalledTimes(1)
  })

  it('keeps the edits when the person says no', async () => {
    const tab = state('edited')
    await render(tab)
    await click(button('Buat ulang'))
    await click(button('Batal'))
    expect(tab.onCreate).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('Suntinganmu akan ditimpa')
  })

  it('is off for the same reasons as Buat CV, and says why', async () => {
    const text = await render(state('result', { availability: cvViewFor('limit').availability }))
    expect(button('Buat ulang')?.hasAttribute('disabled')).toBe(true)
    expect(text).toContain('Batas 20 panggilan AI hari ini tercapai.')
  })

  it('tells the person the Profile changed, keeps the old CV, and offers Buat ulang (basi)', async () => {
    const tab = state('stale')
    const text = await render(tab)
    expect(text).toContain('Profilmu berubah sejak CV ini dibuat')
    expect(text).toContain('CV lama tetap bisa diunduh')
    expect(text).toContain('Cakupan requirement: 4 dari 6')
    const again = [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Buat ulang')
    expect(again.length).toBeGreaterThan(0)
    await click(again[0])
    expect(tab.onCreate).toHaveBeenCalledTimes(1)
  })
})

describe('CvTab: Unduh PDF (FR-42)', () => {
  it('offers Unduh PDF for a CV, and asks for the download when clicked', async () => {
    const tab = state('result')
    await render(tab)
    expect(button('Unduh PDF')?.hasAttribute('disabled')).toBe(false)
    await click(button('Unduh PDF'))
    expect(tab.onDownload).toHaveBeenCalledTimes(1)
  })

  it('says the PDF is made in this browser and goes nowhere', async () => {
    expect(await render(state('result'))).toContain('PDF dibuat di browser ini dan tidak diunggah ke mana pun')
  })

  it('shows that the PDF is being made, and cannot be pressed twice', async () => {
    await render(state('result', { downloading: true }))
    expect(button('Membuat file…')?.hasAttribute('disabled')).toBe(true)
  })

  it('stays available when the Profile changed, an edited CV, or when Buat CV is off: the CV is already there', async () => {
    for (const name of ['stale', 'edited'] as const) {
      await render(state(name))
      expect(button('Unduh PDF')?.hasAttribute('disabled'), name).toBe(false)
    }
    await render(state('result', { availability: cvViewFor('limit').availability }))
    expect(button('Unduh PDF')?.hasAttribute('disabled')).toBe(false)
  })

  it('is the only solid blue button next to the CV: Edit, Buat ulang and Kembalikan are quiet', async () => {
    await render(state('edited'))
    const solid = [...document.querySelectorAll('button')].filter((b) => b.className.includes('bg-accent ')).map((b) => b.textContent?.trim())
    expect(solid).toEqual(['Unduh PDF'])
  })

  it('has no Unduh PDF before there is a CV, or when a CV was refused', async () => {
    await render(state('empty'))
    expect(button('Unduh PDF')).toBeUndefined()
    await render(state('rejected'))
    expect(button('Unduh PDF')).toBeUndefined()
  })

  it('says why the PDF failed, keeps the CV on screen, and offers to copy its text', async () => {
    const tab = state('pdffailed')
    const text = await render(tab)
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('PDF gagal dibuat')
    expect(text).toContain('Cakupan requirement: 4 dari 6')
    expect(text).toContain('Software Engineer')
    await click(button('Salin teks CV'))
    expect(tab.onCopyText).toHaveBeenCalledTimes(1)
  })

  it('tells the person which letters the PDF fonts replaced', async () => {
    const text = await render(state('pdfnote'))
    expect(text).toContain('Huruf yang tidak ada di font PDF standar diganti: ễ.')
    expect(document.querySelector('[role="status"]')?.textContent).toContain('diganti')
  })
})
