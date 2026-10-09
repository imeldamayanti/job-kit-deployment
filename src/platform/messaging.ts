import { browser } from 'wxt/browser'
import type { FillOutcome } from '../core/fill/apply'
import { classifyUnreadablePage, type UnreadableReason } from '../core/fill/page-access'
import type { ActiveTab } from './tabs'

export type FieldSummary = { id: string; label: string; autocomplete: string; hasText: boolean }
export type FillItem = { fieldId: string; value: string }

export type PageScan =
  | { ok: true; fields: FieldSummary[]; canUndo: boolean }
  | { ok: false; reason: 'no-form' | UnreadableReason }

type Request =
  | { type: 'scan' }
  | { type: 'fill'; items: FillItem[] }
  | { type: 'undo' }

export type ScanResponse = { fields: FieldSummary[]; canUndo: boolean }

export type Handlers = {
  scan: () => ScanResponse
  fill: (items: FillItem[]) => FillOutcome
  undo: () => number
}

const CONTENT_SCRIPT = '/page-reader.js'

function isRequest(message: unknown): message is Request {
  return typeof message === 'object' && message !== null && typeof (message as Request).type === 'string'
}

export async function requestScan(tab: ActiveTab): Promise<PageScan> {
  try {
    await browser.scripting.executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT] })
    const { fields, canUndo }: ScanResponse = await browser.tabs.sendMessage(tab.id, { type: 'scan' } satisfies Request)
    return fields.length === 0 ? { ok: false, reason: 'no-form' } : { ok: true, fields, canUndo }
  } catch {
    return { ok: false, reason: classifyUnreadablePage(tab.url) }
  }
}

export function requestFill(tab: ActiveTab, items: FillItem[]): Promise<FillOutcome> {
  return browser.tabs.sendMessage(tab.id, { type: 'fill', items } satisfies Request)
}

export function requestUndo(tab: ActiveTab): Promise<number> {
  return browser.tabs.sendMessage(tab.id, { type: 'undo' } satisfies Request)
}

export function listen(handlers: Handlers): void {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isRequest(message)) return undefined
    switch (message.type) {
      case 'scan':
        return Promise.resolve(handlers.scan())
      case 'fill':
        return Promise.resolve(handlers.fill(message.items))
      case 'undo':
        return Promise.resolve(handlers.undo())
    }
  })
}
