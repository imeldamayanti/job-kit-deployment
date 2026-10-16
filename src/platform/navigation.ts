import { browser } from 'wxt/browser'
import type { SectionId } from '../core/profile/sections'

export async function openEditProfile(section?: SectionId): Promise<void> {
  const page = browser.runtime.getURL('/options.html')
  await browser.tabs.create({ url: section ? `${page}#${section}` : page })
}

// "Lihat lamaran" in the panel: the detail of one application, in a new tab.
export async function openApplicationPage(applicationId: string): Promise<void> {
  await browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#applications/${encodeURIComponent(applicationId)}` })
}
