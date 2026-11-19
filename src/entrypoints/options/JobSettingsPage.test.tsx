import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSettings } from '../../core/feed/settings'
import { initialFeedState } from '../../core/feed/schedule'
vi.mock('../../platform/permissions', () => ({ hasOrigins: vi.fn(async () => false), requestOrigins: vi.fn(async () => false) }))

import { JobSettingsPage } from './JobSettingsPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null

async function render(): Promise<string> {
  container = document.createElement('div')
  document.body.append(container)
  await act(async () =>
    createRoot(container!).render(
      <JobSettingsPage profile={null} settings={createDefaultSettings()} aiKey="" update={vi.fn()} changeKey={vi.fn()} goPreferences={() => {}} runs={[]} state={initialFeedState()} />,
    ),
  )
  return container.textContent ?? ''
}

afterEach(() => {
  container?.remove()
  container = null
})

// The tests run as the server build, the default: the server holds the provider, the model and the key.
describe('JobSettingsPage in the server build', () => {
  it('has no provider, model, key or test of the connection', async () => {
    const text = await render()
    expect(text).not.toContain('Penyedia')
    expect(text).not.toContain('Kunci API')
    expect(text).not.toContain('Model penilaian lowongan')
    expect(text).not.toContain('Model CV dan surat')
    expect(text).not.toContain('Tes koneksi')
    expect(text).not.toContain('Batas CV dan surat per hari')
    expect(document.querySelector('input[type="password"]')).toBeNull()
  })

  it('says the daily feed is scored by rules for free, and where the AI score is', async () => {
    const text = await render()
    expect(text).toContain('Penilaian AI')
    expect(text).toContain('tidak memakai kredit')
    expect(text).toContain('1 kredit untuk 10 lowongan teratas yang belum dinilai AI')
  })

  it('keeps the sources and the schedule', async () => {
    const text = await render()
    expect(text).toContain('Jam ambil harian')
    expect(text).toContain('Greenhouse')
  })
})
