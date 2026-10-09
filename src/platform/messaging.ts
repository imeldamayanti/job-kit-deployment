import { browser } from 'wxt/browser'
import { classifyUnreadablePage, type UnreadableReason } from '../core/fill/page-access'
import type { ActiveTab } from './tabs'

export type FieldSummary = { id: string; label: string }

export type PageScan =
  | { ok: true; fields: FieldSummary[] }
  | { ok: false; reason: 'no-form' | UnreadableReason }

type ScanRequest = { type: 'scan' }
type ScanResponse = { fields: FieldSummary[] }

const CONTENT_SCRIPT = '/page-reader.js'

function isScanRequest(message: unknown): message is ScanRequest {
  return typeof message === 'object' && message !== null && (message as ScanRequest).type === 'scan'
}

export async function requestScan(tab: ActiveTab): Promise<PageScan> {
  try {
    await browser.scripting.executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT] })
    const response: ScanResponse = await browser.tabs.sendMessage(tab.id, { type: 'scan' } satisfies ScanRequest)
    return response.fields.length === 0 ? { ok: false, reason: 'no-form' } : { ok: true, fields: response.fields }
  } catch {
    return { ok: false, reason: classifyUnreadablePage(tab.url) }
  }
}

export function onScanRequest(handler: () => FieldSummary[]): void {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isScanRequest(message)) return undefined
    return Promise.resolve({ fields: handler() } satisfies ScanResponse)
  })
}
