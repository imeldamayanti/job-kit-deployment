import { browser } from 'wxt/browser'
import type { SectionId } from '../core/profile/sections'

export async function openEditProfile(section?: SectionId): Promise<void> {
  const page = browser.runtime.getURL('/options.html')
  await browser.tabs.create({ url: section ? `${page}#${section}` : page })
}
