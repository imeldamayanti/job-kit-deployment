import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Application } from '../../core/applications/types'
import { initialFeedState } from '../../core/feed/schedule'
import { JobsPage } from './JobsPage'

// Looks at every state of the T28 mockup through the dev preview hash, the way a person would.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const live = { feed: [], runs: [], state: initialFeedState(), changeStatus: vi.fn() }
let container: HTMLElement | null = null

const at = '2026-10-15T08:00:00.000Z'
const applicationFor = (jobId: string): Application => ({
  id: `app-${jobId}`, jobId, status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', createdAt: at, updatedAt: at,
  job: { title: 'Frontend Engineer (React)', company: 'PT Contoh Karya', url: 'https://example.test/job', source: 'greenhouse', description: '', capturedAt: at },
  events: [{ at, type: 'created' }],
})

async function render(state: string, applications: Application[] = [], onOpenApplication: (id: string) => void = () => {}): Promise<string> {
  location.hash = `#jobs?state=${state}`
  container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<JobsPage profile={null} settings={null} live={live} applications={applications} onOpenApplication={onOpenApplication} onSettings={() => {}} onPreferences={() => {}} />))
  return container.textContent ?? ''
}

afterEach(() => {
  container?.remove()
  location.hash = ''
})

describe('JobsPage states', () => {
  it('list: cards with score, reasons for the first, hidden empty meta, rough badge', async () => {
    const text = await render('list')
    expect(text).toContain('Frontend Engineer (React)')
    expect(text).toContain('Yang cocok')
    expect(text).toContain('Skor kasar')
    expect(text).toContain('Diperbarui')
    expect(text).not.toContain('Negotiable')
    expect(text).toContain('AI')
  })

  it('off: asks to turn it on', async () => {
    expect(await render('off')).toContain('Lowongan belum dinyalakan')
  })

  it('noprefs: asks for Preferensi kerja', async () => {
    expect(await render('noprefs')).toContain('Preferensi kerja masih kosong')
  })

  it('fetching: says it is fetching and disables Segarkan', async () => {
    const text = await render('fetching')
    expect(text).toContain('Sedang mengambil')
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Sedang mengambil'))
    expect(button?.hasAttribute('disabled')).toBe(true)
  })

  it('empty: nothing new today', async () => {
    expect(await render('empty')).toContain('Belum ada lowongan baru hari ini')
  })

  it('nomatch: a filter that hides everything offers a reset', async () => {
    const text = await render('nomatch')
    expect(text).toContain('Tidak ada yang cocok')
    expect(text).toContain('Reset filter')
  })

  it('onefail: names the failed source and says the others carry on', async () => {
    expect(await render('onefail')).toContain('LinkedIn tidak bisa diambil hari ini (diblokir sementara). Sumber lain tetap jalan.')
  })

  it('paused: says the source was paused', async () => {
    expect(await render('paused')).toContain('LinkedIn dijeda setelah 3 kali gagal berturut-turut')
  })

  it('rough: says why the scores are rough, with a link to settings', async () => {
    const text = await render('rough')
    expect(text).toContain('Kunci ditolak penyedia.')
    expect(text).toContain('Buka Atur Lowongan')
  })

  it('allfail: says every source failed', async () => {
    expect(await render('allfail')).toContain('Semua sumber gagal hari ini')
  })

  it('saved: lists saved, applied rows with status and hides the hidden one', async () => {
    const text = await render('saved')
    expect(text).toContain('Dilamar')
    expect(text).toContain('UI Engineer')
    expect(text).not.toContain('Magang UI')
  })

  it('hides the status menu of a job that has an application: its status follows the application (D11)', async () => {
    const menus = () => document.querySelectorAll('button[aria-label="Menu lainnya"]').length
    await render('list')
    const before = menus()
    container?.remove()

    await render('list', [applicationFor('p1')])

    expect(before).toBe(3)
    expect(menus()).toBe(2)
  })

  it('card: offers Siapkan lamaran, and Simpan as an icon button', async () => {
    const text = await render('list')

    expect(text).toContain('Siapkan lamaran')
    expect(document.querySelector('button[aria-label="Simpan lowongan"]')).not.toBeNull()
    expect(document.querySelector('button[aria-label="Simpan lowongan"]')?.textContent).toBe('')
  })

  it('card: a job that has an application shows Buka lamaran instead, and it opens that application', async () => {
    const opened: string[] = []
    await render('list', [applicationFor('p1')], (id) => opened.push(id))

    const labels = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim())
    expect(labels.filter((label) => label === 'Buka lamaran')).toHaveLength(1)
    expect(labels.filter((label) => label === 'Siapkan lamaran')).toHaveLength(2)

    await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Buka lamaran')?.click())
    expect(opened).toEqual(['app-p1'])
  })

  it('saved: a saved job that has an application can open it from its row', async () => {
    const opened: string[] = []
    await render('saved', [applicationFor('s2')], (id) => opened.push(id))

    await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Buka lamaran')?.click())

    expect(opened).toEqual(['app-s2'])
  })
})
