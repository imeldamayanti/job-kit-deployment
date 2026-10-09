import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialFeedState } from '../../core/feed/schedule'
import { JobsPage } from './JobsPage'

// Looks at every state of the T28 mockup through the dev preview hash, the way a person would.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const live = { feed: [], runs: [], state: initialFeedState(), changeStatus: vi.fn() }
let container: HTMLElement | null = null

async function render(state: string): Promise<string> {
  location.hash = `#jobs?state=${state}`
  container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<JobsPage profile={null} settings={null} live={live} onSettings={() => {}} onPreferences={() => {}} />))
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
})
