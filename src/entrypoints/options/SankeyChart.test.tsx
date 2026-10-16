import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { funnelStats } from '../../core/applications/funnel'
import { VIZ_NOW, VIZ_SAMPLE } from '../../core/applications/preview'
import { SankeyChart } from './SankeyChart'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null

async function render(apps = VIZ_SAMPLE) {
  container = document.createElement('div')
  document.body.append(container)
  await act(async () => createRoot(container!).render(<SankeyChart funnel={funnelStats(apps, VIZ_NOW)} />))
  return container
}

afterEach(() => container?.remove())

describe('SankeyChart', () => {
  it('has the title and the number of sent applications', async () => {
    const root = await render()

    expect(root.querySelector('h3')?.textContent).toBe('Pencarian kerjamu')
    expect(root.textContent).toContain('12 lamaran dikirim')
  })

  it('is one image for a screen reader, with a short text of the flow', async () => {
    const svg = (await render()).querySelector('svg[role="img"]')

    expect(svg?.getAttribute('aria-label')).toBe(
      'Alur 12 lamaran: 6 sampai Direview, 3 sampai Interview, 1 Offer; 4 tanpa kabar, 4 ditolak, 3 masih berjalan',
    )
  })

  it('draws a ribbon per flow with a title, and a bar per stage', async () => {
    const root = await render()

    const titles = [...root.querySelectorAll('svg path > title')].map((el) => el.textContent)
    expect(titles).toHaveLength(9)
    expect(titles).toContain('Dilamar → Tanpa kabar: 4')
    expect(titles).toContain('Direview → Interview: 3')
    expect(root.querySelectorAll('svg rect')).toHaveLength(7)
  })

  it('writes the names and the counts on the bars', async () => {
    const text = [...(await render()).querySelectorAll('svg text')].map((el) => el.textContent)

    expect(text).toEqual(expect.arrayContaining(['Dilamar', '12', 'Direview 6', 'Interview 3', 'Tanpa kabar 4', 'Ditolak 4', 'Masih berjalan 3', 'Offer 1']))
  })

  it('has the list of bars for a narrow width, with the same numbers', async () => {
    const rows = [...(await render()).querySelectorAll('ul[aria-label="Alur lamaran"] li')].map((li) => li.textContent)

    expect(rows).toEqual(['Dilamar12', 'Direview6', 'Interview3', 'Offer1', 'Tanpa kabar4', 'Masih berjalan3', 'Ditolak4'])
  })

  it('sizes the bars of the list against the sent applications', async () => {
    const fill = (await render()).querySelectorAll<HTMLElement>('ul[aria-label="Alur lamaran"] li i')

    expect(fill[0]?.style.width).toBe('100%')
    expect(fill[1]?.style.width).toBe('50%')
  })

  it('says how Tanpa kabar is counted', async () => {
    expect((await render()).textContent).toContain('14 hari')
  })

  it('shows "Belum ada lamaran yang dikirim" when nothing was sent', async () => {
    const root = await render([])

    expect(root.textContent).toContain('Belum ada lamaran yang dikirim')
    expect(root.querySelector('svg[role="img"]')).toBeNull()
  })
})
