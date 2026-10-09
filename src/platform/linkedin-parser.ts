import { browser } from 'wxt/browser'
import type { LinkedInDeps } from '../core/feed/sources/linkedin'
import type { LinkedInDetail } from '../core/feed/sources/linkedin-parse'
import type { RawJob } from '../core/feed/types'

const OFFSCREEN_URL = 'offscreen.html'

async function ensureOffscreen(): Promise<void> {
  if (await browser.offscreen.hasDocument()) return
  await browser.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [browser.offscreen.Reason.DOM_PARSER],
    justification: 'Read the HTML of public job pages; the service worker has no DOMParser.',
  })
}

async function ask<T>(type: 'parse-search' | 'parse-detail', html: string): Promise<T> {
  await ensureOffscreen()
  return browser.runtime.sendMessage({ target: 'offscreen', type, html }) as Promise<T>
}

export const offscreenParsers: Pick<LinkedInDeps, 'parseSearch' | 'parseDetail'> = {
  parseSearch: (html) => ask<RawJob[]>('parse-search', html),
  parseDetail: (html) => ask<LinkedInDetail>('parse-detail', html),
}
