import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { previewApplicationsFromHash } from '../../core/applications/preview'
import type { AppStatus } from '../../core/applications/types'
import { ApplicationDetailPage } from './ApplicationDetailPage'
import { cvViewFor } from '../../core/tailor/view'
import type { CvTabState } from './CvTab'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null

type Handlers = {
  onBack?: () => void
  onStatus?: (status: AppStatus) => void
  onSave?: (patch: { notes: string; followUpAt: string | null; description?: string; url?: string }) => Promise<{ ok: true } | { ok: false; reason: 'storage-full' }>
  onDelete?: () => Promise<void>
  onOpenForm?: () => void
  cvTab?: CvTabState
}

async function render(state: string, handlers: Handlers = {}): Promise<string> {
  location.hash = `#applications?state=${state}`
  const preview = previewApplicationsFromHash(location.hash)!
  const application = preview.applications.find((app) => app.id === preview.detail?.id)!
  container = document.createElement('div')
  document.body.append(container)
  await act(async () =>
    createRoot(container!).render(
      <ApplicationDetailPage
        application={application}
        initialTab={preview.detail!.tab}
        onBack={handlers.onBack ?? (() => {})}
        onStatus={handlers.onStatus ?? (() => {})}
        onSave={handlers.onSave ?? (async () => ({ ok: true }))}
        onDelete={handlers.onDelete ?? (async () => {})}
        onOpenForm={handlers.onOpenForm ?? (() => {})}
        cvTab={handlers.cvTab}
      />,
    ),
  )
  return container.textContent ?? ''
}

const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

afterEach(() => {
  vi.useRealTimers()
  container?.remove()
  location.hash = ''
})

describe('ApplicationDetailPage · Ringkasan', () => {
  it('shows the job, the company and where it came from, with the four tabs', async () => {
    const text = await render('detail')

    expect(document.querySelector('h1')?.textContent).toBe('Frontend Engineer (React)')
    expect(text).toContain('PT Contoh Karya')
    expect(text).toContain('Greenhouse')
    expect([...document.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual(['Ringkasan', 'CV', 'Surat', 'Catatan & riwayat'])
  })

  it('lists the steps of Siap melamar', async () => {
    const text = await render('detail')

    expect(text).toContain('Siap melamar')
    for (const step of ['CV disesuaikan', 'Surat lamaran', 'Buka & isi form']) expect(text).toContain(step)
  })

  it('has a status choice with all seven statuses, set to the current one', async () => {
    await render('detail')
    const select = document.querySelector<HTMLSelectElement>('select')!

    expect([...select.options].map((option) => option.textContent)).toEqual(['Draft', 'Dilamar', 'Direview', 'Interview', 'Offer', 'Ditolak', 'Dibatalkan'])
    expect(select.value).toBe('draft')
  })

  it('reports a status change', async () => {
    const onStatus = vi.fn()
    await render('detail', { onStatus })
    const select = document.querySelector<HTMLSelectElement>('select')!

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, 'interview')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(onStatus).toHaveBeenCalledWith('interview')
  })

  it('opens the posting from its own copy of the URL', async () => {
    await render('detail')
    const link = [...document.querySelectorAll('a')].find((a) => a.textContent?.includes('Buka lowongan'))

    expect(link?.getAttribute('href')).toBe('https://example.test/a1')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
  })

  it('opens the form from the Buka & isi step', async () => {
    const onOpenForm = vi.fn()
    await render('detail', { onOpenForm })

    await act(async () => button('Buka & isi')?.click())

    expect(onOpenForm).toHaveBeenCalled()
  })

  it('goes back to the board', async () => {
    const onBack = vi.fn()
    await render('detail', { onBack })

    await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Lamaran'))?.click())

    expect(onBack).toHaveBeenCalled()
  })

  it('shows the copy of the posting text', async () => {
    expect(await render('detail')).toContain('Membangun antarmuka web dengan React dan TypeScript.')
  })

  it('asks for the posting text when the source gave none, and saves what is pasted', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn(async () => ({ ok: true as const }))
    const text = await render('detail-nodesc', { onSave })

    expect(text).toContain('Tempel teks lowongan')
    expect(text).toContain('Buat CV dan Buat surat nonaktif')
    const area = document.querySelector<HTMLTextAreaElement>('textarea')!

    await type(area, 'Kami mencari engineer yang menguasai React.')
    await act(async () => void vi.advanceTimersByTime(600))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ description: 'Kami mencari engineer yang menguasai React.' }))
  })
})

describe('ApplicationDetailPage · CV dan Surat', () => {
  it('CV: not made yet, and the button says why it is off', async () => {
    const text = await render('detail-cv')

    expect(text).toContain('CV untuk lowongan ini belum dibuat')
    expect(text).toContain('belum tersedia di versi ini')
    expect(button('Buat CV')?.hasAttribute('disabled')).toBe(true)
  })

  it('Surat: not made yet, and the button says why it is off', async () => {
    const text = await render('detail-letter')

    expect(text).toContain('Surat untuk lowongan ini belum dibuat')
    expect(button('Buat surat')?.hasAttribute('disabled')).toBe(true)
  })
})

describe('ApplicationDetailPage · Catatan & riwayat', () => {
  it('shows the notes and the automatic history, newest first', async () => {
    const text = await render('detail-notes')
    const notes = document.querySelector<HTMLTextAreaElement>('textarea')!

    expect(notes.value).toContain('HR: Rina')
    expect(text).toContain('Status: Draft → Dilamar')
    expect(text).toContain('Lamaran disiapkan dari Lowongan')
    expect(text.indexOf('Status: Draft → Dilamar')).toBeLessThan(text.indexOf('Lamaran disiapkan dari Lowongan'))
  })

  it('saves a note after a pause and says Tersimpan', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn(async () => ({ ok: true as const }))
    await render('detail-notes', { onSave })
    const notes = document.querySelector<HTMLTextAreaElement>('textarea')!

    await type(notes, 'Tanya soal hybrid.')
    expect(onSave).not.toHaveBeenCalled()
    await act(async () => void vi.advanceTimersByTime(600))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Tanya soal hybrid.' }))
    expect(document.body.textContent).toContain('Tersimpan')
  })

  it('saves the follow-up date', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn(async () => ({ ok: true as const }))
    await render('detail-notes', { onSave })
    const date = document.querySelector<HTMLInputElement>('input[type="date"]')!

    await type(date, '2026-10-21')
    await act(async () => void vi.advanceTimersByTime(600))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ followUpAt: '2026-10-21' }))
  })

  it('tells the person when storage is full', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn(async () => ({ ok: false as const, reason: 'storage-full' as const }))
    await render('detail-notes', { onSave })

    await type(document.querySelector<HTMLTextAreaElement>('textarea')!, 'x')
    await act(async () => void vi.advanceTimersByTime(600))

    expect(document.body.textContent).toContain('Penyimpanan penuh')
  })
})

describe('ApplicationDetailPage · hapus lamaran', () => {
  it('asks first, and says the CV and the letter go too', async () => {
    const onDelete = vi.fn(async () => {})
    await render('detail', { onDelete })

    await act(async () => button('Hapus lamaran')?.click())
    expect(document.body.textContent).toContain('CV dan suratnya ikut terhapus')
    expect(onDelete).not.toHaveBeenCalled()

    await act(async () => button('Batal')?.click())
    expect(document.body.textContent).not.toContain('CV dan suratnya ikut terhapus')
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('deletes only after the second press', async () => {
    const onDelete = vi.fn(async () => {})
    await render('detail', { onDelete })

    await act(async () => button('Hapus lamaran')?.click())
    const confirm = [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Hapus lamaran').at(-1)
    await act(async () => confirm?.click())

    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})

describe('ApplicationDetailPage · lamaran manual', () => {
  it('says the posting was added by hand', async () => {
    expect(await render('detail-manual')).toContain('Manual')
  })

  it('has no Buka lowongan link while there is no link, and Buka & isi is off with the reason above it', async () => {
    const text = await render('detail-manual')

    expect([...document.querySelectorAll('a')].some((a) => a.textContent?.includes('Buka lowongan'))).toBe(false)
    expect(button('Buka & isi')?.hasAttribute('disabled')).toBe(true)
    expect(text).toContain('Isi link lowongan dulu')
  })

  it('saves a link typed in, and then Buka lowongan appears', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn(async () => ({ ok: true as const }))
    await render('detail-manual', { onSave })
    const field = document.querySelector<HTMLInputElement>('input[type="url"]')!

    await type(field, 'https://example.test/lowongan/9')
    await act(async () => void vi.advanceTimersByTime(600))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.test/lowongan/9' }))
    expect([...document.querySelectorAll('a')].find((a) => a.textContent?.includes('Buka lowongan'))?.getAttribute('href')).toBe('https://example.test/lowongan/9')
    expect(button('Buka & isi')?.hasAttribute('disabled')).toBe(false)
  })

  it('does not offer the link field for a posting that came from the feed', async () => {
    await render('detail')

    expect(document.querySelector('input[type="url"]')).toBeNull()
  })
})

describe('CV tab wiring (T48)', () => {
  const tab = (change: Partial<CvTabState> = {}): CvTabState => ({
    ...cvViewFor('empty'), onCreate: () => {}, onContinue: () => {}, onDismissNotice: () => {}, onLink: () => {}, onEdit: () => {}, onRestore: () => {}, onDownload: () => {}, onDownloadWord: () => {}, onCopyText: () => {}, ...change,
  })

  it('shows the working tab instead of the shell when the page gives it', async () => {
    const onCreate = vi.fn()
    const text = await render('detail-cv', { cvTab: tab({ onCreate }) })
    expect(text).not.toContain('belum tersedia di versi ini')
    expect(button('Buat CV')?.hasAttribute('disabled')).toBe(false)
    await act(async () => void button('Buat CV')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('takes the person to the Ringkasan tab to paste the posting text, and leaves the page for the other links', async () => {
    const onLink = vi.fn()
    await render('detail-cv', { cvTab: tab({ availability: { ok: false, reason: 'no-text', message: 'Tempel teks lowongan dulu.', link: 'description' }, onLink }) })
    await act(async () => void button('Tempel teks lowongan')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(document.body.textContent).toContain('Siap melamar')
    expect(document.body.textContent).not.toContain('CV untuk lowongan ini belum dibuat')
    expect(onLink).not.toHaveBeenCalled()
  })

  it('passes the other links up to the page', async () => {
    const onLink = vi.fn()
    await render('detail-cv', { cvTab: tab({ availability: { ok: false, reason: 'no-key', message: 'Kunci API belum diisi. Isi di Atur Lowongan.', link: 'settings' }, onLink }) })
    await act(async () => void button('Buka Atur Lowongan')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(onLink).toHaveBeenCalledWith('settings')
  })
})
