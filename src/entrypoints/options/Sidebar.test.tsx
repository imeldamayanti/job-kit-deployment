import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null

async function render(props: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  container = document.createElement('div')
  document.body.append(container)
  await act(async () => createRoot(container!).render(<Sidebar current="profile" onSelect={() => {}} {...props} />))
  return container
}

afterEach(() => container?.remove())

describe('Sidebar', () => {
  it('has five places: Lamaran between Lowongan and Data, Akun last', async () => {
    const nav = await render()

    expect([...nav.querySelectorAll('nav button')].map((b) => b.textContent)).toEqual(['Profile', 'Lowongan', 'Lamaran', 'Data', 'Akun'])
  })

  it('marks the current place and reports a press', async () => {
    const onSelect = vi.fn()
    const nav = await render({ current: 'applications', onSelect })

    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Lamaran')
    await act(async () => [...nav.querySelectorAll('button')].find((b) => b.textContent === 'Data')?.click())
    expect(onSelect).toHaveBeenCalledWith('data')
  })

  it('says what each badge counts', async () => {
    const nav = await render({ badges: { jobs: 24, applications: 2 } })

    expect(nav.querySelector('[aria-label="24 lowongan baru"]')?.textContent).toBe('24')
    expect(nav.querySelector('[aria-label="2 perlu tindak lanjut"]')?.textContent).toBe('2')
  })

  it('hides a badge that counts zero', async () => {
    const nav = await render({ badges: { jobs: 0, applications: 0 } })

    expect(nav.querySelectorAll('[aria-label$="baru"], [aria-label$="tindak lanjut"]')).toHaveLength(0)
  })
})
