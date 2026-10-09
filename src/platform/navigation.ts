import { browser } from 'wxt/browser'

export async function openEditProfile(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('/options.html') })
}
