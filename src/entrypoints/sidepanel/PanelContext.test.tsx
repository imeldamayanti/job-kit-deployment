import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PanelContext } from '../../core/applications/panel'
import type { PlanItem } from '../../core/matching/plan'
import type { PanelTab } from '../../platform/panel-context'
import { FillNotice, FromFeed, UploadRows } from './PanelContext'
import { PlanRow, RequiredBadge } from './PlanRow'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null
async function render(node: React.ReactNode): Promise<HTMLElement> {
  container?.remove()
  container = document.createElement('div')
  document.body.append(container)
  await act(async () => createRoot(container!).render(node))
  return container
}
afterEach(() => {
  container?.remove()
  container = null
})

const context = (change: Partial<PanelContext> = {}): PanelContext => ({
  applicationId: 'a1', company: 'PT Contoh Karya', cvReady: true, letterReady: true, coverLetter: 'Dear team', cvFile: 'CV-PT-Contoh-Karya.pdf', cvDownloaded: true, ...change,
})
const tab = (change: Partial<PanelContext> | null = {}): PanelTab => ({
  opened: { jobId: 'j1', title: 'Frontend Engineer', score: 86, rough: false },
  ...(change === null ? {} : { context: context(change) }),
})

describe('FromFeed', () => {
  it('shows the banner and which documents are ready', async () => {
    const el = await render(<FromFeed tab={tab()} />)
    expect(el.textContent).toContain('Dari Lowongan · skor 86')
    expect(el.textContent).toContain('CV siap')
    expect(el.textContent).toContain('Surat siap')
  })

  it('says a document is not made yet', async () => {
    const el = await render(<FromFeed tab={tab({ cvReady: false, letterReady: false })} />)
    expect(el.textContent).toContain('CV belum')
    expect(el.textContent).toContain('Surat belum')
  })

  it('shows only the banner when the tab has no application', async () => {
    const el = await render(<FromFeed tab={tab(null)} />)
    expect(el.textContent).toContain('Dari Lowongan')
    expect(el.textContent).not.toContain('CV')
  })

  it('shows nothing for a tab job-kit did not open', async () => {
    const el = await render(<FromFeed tab={undefined} />)
    expect(el.textContent).toBe('')
  })
})

describe('UploadRows', () => {
  it('lists each file input as Unggah manual, with the file to pick for a CV', async () => {
    const el = await render(<UploadRows uploads={[{ label: 'Resume/CV' }, { label: 'Portfolio' }]} context={context()} />)
    expect(el.textContent).toContain('Resume/CV')
    expect(el.textContent).toContain('CV-PT-Contoh-Karya.pdf sudah diunduh — pilih sendiri')
    expect(el.textContent).toContain('Pilih berkasmu sendiri')
    expect(el.textContent?.match(/Unggah manual/g)).toHaveLength(2)
  })

  it('has no file input of its own and nothing to click that could attach a file', async () => {
    const el = await render(<UploadRows uploads={[{ label: 'Resume/CV' }]} context={context()} />)
    expect(el.querySelector('input')).toBeNull()
    expect(el.querySelector('button')).toBeNull()
  })

  it('shows nothing when the page has no file input', async () => {
    const el = await render(<UploadRows uploads={[]} context={context()} />)
    expect(el.textContent).toBe('')
  })

  it('still explains the upload when the tab has no application', async () => {
    const el = await render(<UploadRows uploads={[{ label: 'Resume' }]} context={undefined} />)
    expect(el.textContent).toContain('Pilih berkasmu sendiri')
  })
})

describe('FillNotice', () => {
  it('tells which application was marked Dilamar and offers Lihat lamaran', async () => {
    const open = vi.fn()
    const el = await render(<FillNotice record={{ applicationId: 'a1', company: 'PT Contoh Karya', status: 'applied', advanced: true }} onOpen={open} />)
    expect(el.textContent).toContain('Lamaran ke PT Contoh Karya ditandai Dilamar.')
    const button = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Lihat lamaran')
    await act(async () => void button?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(open).toHaveBeenCalledWith('a1')
  })

  it('says the status stayed when the application was already further on', async () => {
    const el = await render(<FillNotice record={{ applicationId: 'a1', company: 'PT Contoh Karya', status: 'interview', advanced: false }} onOpen={() => {}} />)
    expect(el.textContent).toContain('Lamaran ke PT Contoh Karya tetap berstatus Interview.')
    expect(el.textContent).not.toContain('ditandai Dilamar')
  })

  it('shows nothing without a record', async () => {
    const el = await render(<FillNotice record={undefined} onOpen={() => {}} />)
    expect(el.textContent).toBe('')
  })
})

describe('PlanRow for the cover letter', () => {
  const item: PlanItem = { fieldId: 'f0', label: 'Cover Letter', key: 'coverLetter', value: 'Dear team,\n\nI apply.', hasExistingText: false }
  it('marks the row as from the application, and can be switched off like any field', async () => {
    const toggle = vi.fn()
    const el = await render(<PlanRow item={item} enabled overwrite={false} onToggle={toggle} onOverwrite={() => {}} />)
    expect(el.textContent).toContain('Cover Letter')
    expect(el.textContent).toContain('Dari Lamaran')
    await act(async () => void el.querySelector('input[type="checkbox"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(toggle).toHaveBeenCalled()
  })

  it('does not mark an ordinary field', async () => {
    const el = await render(<PlanRow item={{ ...item, key: 'email', label: 'Email', value: 'a@b.test' }} enabled overwrite={false} onToggle={() => {}} onOverwrite={() => {}} />)
    expect(el.textContent).not.toContain('Dari Lamaran')
  })
})

describe('RequiredBadge', () => {
  it('says Wajib next to a field left for the user', async () => {
    const el = await render(<RequiredBadge />)
    expect(el.textContent).toBe('Wajib')
  })
})
