import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { previewApplicationsFromHash } from '../../core/applications/preview'
import type { ManualInput } from '../../core/applications/applications'
import type { AppStatus } from '../../core/applications/types'
import { ApplicationsPage } from './ApplicationsPage'

// Looks at every state of the T40 mockup through the dev preview hash, the way a person would.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null

async function render(state: string, view: 'board' | 'viz' = 'board', handlers: { onOpen?: (id: string) => void; onJobs?: () => void; onMove?: (id: string, status: AppStatus) => void; onAdd?: (input: ManualInput) => Promise<{ ok: true; id: string } | { ok: false; reason: 'storage-full' }> } = {}): Promise<string> {
  location.hash = `#applications?state=${state}`
  container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const applications = previewApplicationsFromHash(location.hash)?.applications ?? []
  await act(async () =>
    root.render(<ApplicationsPage applications={applications} view={view} onOpen={handlers.onOpen ?? (() => {})} onJobs={handlers.onJobs ?? (() => {})} onMove={handlers.onMove ?? (() => {})} onAdd={handlers.onAdd ?? (async () => ({ ok: true, id: 'new' }))} />),
  )
  return container.textContent ?? ''
}

const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(label))

afterEach(() => {
  container?.remove()
  location.hash = ''
})

describe('ApplicationsPage board', () => {
  it('shows the five columns with their counts, and the cards in them', async () => {
    const text = await render('list')

    for (const heading of ['Draft', 'Dilamar', 'Direview', 'Interview', 'Offer']) expect(text).toContain(heading)
    const columns = [...document.querySelectorAll('section[aria-label]')].map((el) => [el.getAttribute('aria-label'), el.querySelectorAll('h4 span')[0]?.textContent])
    expect(columns).toEqual([['Draft', '2'], ['Dilamar', '3'], ['Direview', '1'], ['Interview', '1'], ['Offer', '0']])
    expect(text).toContain('Frontend Engineer (React)')
    expect(text).toContain('PT Contoh Karya')
  })

  it('marks the cards that already have a CV or a letter', async () => {
    await render('list')

    expect(document.querySelector('[data-doc="cv"][data-ok="true"]')).not.toBeNull()
    expect(document.querySelector('[data-doc="letter"][data-ok="false"]')).not.toBeNull()
  })

  it('folds Ditolak and Dibatalkan under the board until asked', async () => {
    const text = await render('list')

    expect(text).toContain('Ditutup: Ditolak 3 · Dibatalkan 1')
    expect(text).not.toContain('Nusa Teknologi')

    await act(async () => button('Tampilkan')?.click())

    expect(document.body.textContent).toContain('Nusa Teknologi')
    expect(document.body.textContent).toContain('Lintas Kode')
  })

  it('opens the closed list at once in the closed preview', async () => {
    expect(await render('closed')).toContain('Nusa Teknologi')
  })

  it('opens an application when its card is pressed', async () => {
    const onOpen = vi.fn()
    await render('list', 'board', { onOpen })

    await act(async () => button('UI Engineer')?.click())

    expect(onOpen).toHaveBeenCalledWith('a2')
  })

  it('narrows the board with the search box, and offers a reset when nothing matches', async () => {
    await render('list')
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Cari lamaran"]')!

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'nusa')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(document.body.textContent).not.toContain('Frontend Engineer (React)')

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'android')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(document.body.textContent).toContain('Tidak ada yang cocok')

    await act(async () => button('Reset filter')?.click())
    expect(document.body.textContent).toContain('Frontend Engineer (React)')
  })
})

describe('ApplicationsPage states', () => {
  it('empty: says there are no applications and links to Lowongan', async () => {
    const onJobs = vi.fn()
    const text = await render('empty', 'board', { onJobs })

    expect(text).toContain('Belum ada lamaran')
    expect(text).toContain('Pilih lowongan di Lowongan, lalu tekan Siapkan lamaran.')
    await act(async () => button('Ke Lowongan')?.click())
    expect(onJobs).toHaveBeenCalled()
  })

  it('nomatch: says nothing matches', async () => {
    const text = await render('nomatch')

    expect(text).toContain('Tidak ada yang cocok')
    expect(text).toContain('Reset filter')
  })

  it('viz: draws the diagram of the 12 sample applications instead of the board', async () => {
    const text = await render('viz', 'viz')

    expect(text).toContain('Pencarian kerjamu')
    expect(text).toContain('12 lamaran dikirim')
    expect(document.querySelector('svg[role="img"]')).not.toBeNull()
    expect(document.querySelector('section[aria-label="Draft"]')).toBeNull()
  })

  it('viz-empty: says nothing was sent when every application is still a draft', async () => {
    const text = await render('viz-empty', 'viz')

    expect(text).toContain('Belum ada lamaran yang dikirim')
    expect(document.querySelector('svg[role="img"]')).toBeNull()
  })

  it('due: warns above the board and marks the cards whose follow-up is due', async () => {
    const text = await render('due')

    expect(text).toContain('2 lamaran perlu tindak lanjut hari ini.')
    expect(text).toContain('Aksara Pagi dan Studio Contoh.')
    expect(document.querySelectorAll('[data-due="true"]')).toHaveLength(2)
    expect(document.querySelector('[role="alert"], [data-alert="due"]')).not.toBeNull()
  })

  it('due: the warning is above the diagram too', async () => {
    const text = await render('due', 'viz')

    expect(text).toContain('2 lamaran perlu tindak lanjut hari ini.')
  })

  it('says nothing about follow-ups when none is due', async () => {
    const text = await render('list')

    expect(text).not.toContain('perlu tindak lanjut')
    expect(document.querySelector('[data-due="true"]')).toBeNull()
  })

  it('does not show the search box when there are no applications', async () => {
    await render('empty')

    expect(document.querySelector('input[aria-label="Cari lamaran"]')).toBeNull()
  })
})

// Dragging a card to another column changes its status (PIC 2026-10-15; before that the board had no drag and drop).
function dragEvent(type: string, data: Map<string, string>) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    value: { setData: (key: string, value: string) => data.set(key, value), getData: (key: string) => data.get(key) ?? '', effectAllowed: '', dropEffect: '' },
  })
  return event
}
const fire = (el: Element | null | undefined, type: string, data = new Map<string, string>()) =>
  act(async () => void el?.dispatchEvent(dragEvent(type, data)))
const card = (title: string) => [...document.querySelectorAll('button[draggable="true"]')].find((b) => b.textContent?.includes(title))
const column = (status: string) => document.querySelector(`[data-drop="${status}"]`)

describe('ApplicationsPage drag and drop', () => {
  it('lets every card be dragged', async () => {
    await render('list')

    expect(document.querySelectorAll('button[draggable="true"]').length).toBe(7)
  })

  it('moves a card to the column it is dropped on', async () => {
    const onMove = vi.fn()
    await render('list', 'board', { onMove })
    const data = new Map<string, string>()

    await fire(card('UI Engineer'), 'dragstart', data)
    await fire(column('applied'), 'dragover', data)
    await fire(column('applied'), 'drop', data)

    expect(onMove).toHaveBeenCalledWith('a2', 'applied')
  })

  it('accepts a drop only while a card is being dragged', async () => {
    await render('list')
    const idle = dragEvent('dragover', new Map())
    await act(async () => void column('applied')?.dispatchEvent(idle))
    expect(idle.defaultPrevented).toBe(false)

    await fire(card('UI Engineer'), 'dragstart')
    const active = dragEvent('dragover', new Map())
    await act(async () => void column('applied')?.dispatchEvent(active))
    expect(active.defaultPrevented).toBe(true)
  })

  it('does nothing when a card is dropped back on its own column', async () => {
    const onMove = vi.fn()
    await render('list', 'board', { onMove })

    await fire(card('UI Engineer'), 'dragstart')
    await fire(column('draft'), 'drop')

    expect(onMove).not.toHaveBeenCalled()
  })

  it('shows Ditolak and Dibatalkan as drop targets only while dragging, and drops there', async () => {
    const onMove = vi.fn()
    await render('list', 'board', { onMove })
    expect(column('rejected')).toBeNull()

    await fire(card('UI Engineer'), 'dragstart')
    expect(column('rejected')).not.toBeNull()
    expect(column('withdrawn')).not.toBeNull()
    await fire(column('rejected'), 'drop')

    expect(onMove).toHaveBeenCalledWith('a2', 'rejected')
    expect(column('rejected')).toBeNull()
  })

  it('shows an empty column while dragging, so a narrow layout can still drop into it', async () => {
    await render('list')
    expect(column('offer')?.className).toContain('hidden')

    await fire(card('UI Engineer'), 'dragstart')

    expect(column('offer')?.className).not.toContain('hidden')
  })

  it('stops dragging when the drag ends without a drop', async () => {
    await render('list')

    await fire(card('UI Engineer'), 'dragstart')
    await fire(card('UI Engineer'), 'dragend')

    expect(column('rejected')).toBeNull()
    expect(column('offer')?.className).toContain('hidden')
  })

  it('lets a card in the folded Ditutup list be dragged back onto the board', async () => {
    const onMove = vi.fn()
    await render('closed', 'board', { onMove })

    await fire(card('Nusa Teknologi'), 'dragstart')
    await fire(column('interview'), 'drop')

    expect(onMove).toHaveBeenCalledWith('r1', 'interview')
  })

  it('says what was moved, for a screen reader', async () => {
    await render('list')

    await fire(card('UI Engineer'), 'dragstart')
    await fire(column('interview'), 'drop')

    expect(document.querySelector('[role="status"]')?.textContent).toBe('UI Engineer dipindah ke Interview')
  })
})

// Adding an application by hand: for a job the feed did not recommend (PIC 2026-10-15).
const setValue = (el: Element, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
const field = (label: string) => {
  const labelEl = [...document.querySelectorAll('label')].find((l) => l.textContent?.trim() === label)
  return document.getElementById(labelEl?.getAttribute('for') ?? '') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
}
const submit = () => act(async () => void document.querySelector('form')?.requestSubmit())

describe('ApplicationsPage tambah lamaran', () => {
  it('has a Tambah lamaran button on the board, and in the empty state too', async () => {
    await render('list')
    expect(button('Tambah lamaran')).toBeDefined()
    container?.remove()

    await render('empty')
    expect(button('Tambah lamaran')).toBeDefined()
  })

  it('opens a form that asks for the job and the company, with the rest optional', async () => {
    await render('list')
    expect(document.querySelector('form')).toBeNull()

    await act(async () => button('Tambah lamaran')?.click())

    for (const label of ['Judul lowongan', 'Perusahaan', 'Link lowongan (opsional)', 'Status', 'Teks lowongan (opsional)']) expect(field(label)).toBeTruthy()
    expect([...(field('Status') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Draft', 'Sudah dilamar'])
  })

  it('opens the form at once in the add preview', async () => {
    await render('add')

    expect(document.querySelector('form')).not.toBeNull()
  })

  it('will not save without a job and a company, and says what is missing', async () => {
    const onAdd = vi.fn(async () => ({ ok: true as const, id: 'x' }))
    await render('list', 'board', { onAdd })
    await act(async () => button('Tambah lamaran')?.click())

    await submit()

    expect(document.body.textContent).toContain('Isi judul lowongan.')
    expect(document.body.textContent).toContain('Isi nama perusahaan.')
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('refuses a link that is not a web address', async () => {
    const onAdd = vi.fn(async () => ({ ok: true as const, id: 'x' }))
    await render('list', 'board', { onAdd })
    await act(async () => button('Tambah lamaran')?.click())
    await setValue(field('Judul lowongan'), 'Engineer')
    await setValue(field('Perusahaan'), 'PT A')
    await setValue(field('Link lowongan (opsional)'), 'bukan link')

    await submit()

    expect(document.body.textContent).toContain('Link harus diawali http:// atau https://.')
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('saves what was typed, then opens the new application', async () => {
    const onAdd = vi.fn(async () => ({ ok: true as const, id: 'baru' }))
    const onOpen = vi.fn()
    await render('list', 'board', { onAdd, onOpen })
    await act(async () => button('Tambah lamaran')?.click())
    await setValue(field('Judul lowongan'), ' Backend Developer ')
    await setValue(field('Perusahaan'), 'PT Luar Feed')
    await setValue(field('Status'), 'applied')

    await submit()

    expect(onAdd).toHaveBeenCalledWith({ title: ' Backend Developer ', company: 'PT Luar Feed', url: '', description: '', status: 'applied' })
    expect(onOpen).toHaveBeenCalledWith('baru')
  })

  it('stays open and says so when storage is full', async () => {
    const onAdd = vi.fn(async () => ({ ok: false as const, reason: 'storage-full' as const }))
    const onOpen = vi.fn()
    await render('list', 'board', { onAdd, onOpen })
    await act(async () => button('Tambah lamaran')?.click())
    await setValue(field('Judul lowongan'), 'Engineer')
    await setValue(field('Perusahaan'), 'PT A')

    await submit()

    expect(document.body.textContent).toContain('Penyimpanan penuh')
    expect(document.querySelector('form')).not.toBeNull()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('closes on Batal without saving', async () => {
    const onAdd = vi.fn(async () => ({ ok: true as const, id: 'x' }))
    await render('list', 'board', { onAdd })
    await act(async () => button('Tambah lamaran')?.click())

    await act(async () => button('Batal')?.click())

    expect(document.querySelector('form')).toBeNull()
    expect(onAdd).not.toHaveBeenCalled()
  })
})
