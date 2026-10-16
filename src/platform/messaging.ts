import { browser } from 'wxt/browser'
import type { FillOutcome } from '../core/fill/apply'
import type { ChoiceOption } from '../core/matching/choice'
import { classifyUnreadablePage, type UnreadableReason } from '../core/fill/page-access'
import { hasSiteAccess } from './permissions'
import type { ActiveTab } from './tabs'

export type FieldSummary = {
  id: string
  label: string
  autocomplete: string
  hasText: boolean
  // Marked required on the page. Only used to say "Wajib" next to the fields left over (T16).
  required: boolean
  multiline: boolean
  kind: 'text' | 'select' | 'radio'
  options: ChoiceOption[]
}
// A file input, by label. The panel only says why it is left alone (RFC D14).
export type UploadSummary = { label: string }
export type FillItem = { fieldId: string; value: string; choice?: number }

export type PageScan =
  | { ok: true; fields: FieldSummary[]; uploads: UploadSummary[]; canUndo: boolean; lockedFrame: boolean }
  | { ok: false; reason: 'no-form' | 'locked-frame' | UnreadableReason }

type Request =
  | { type: 'scan' }
  | { type: 'fill'; items: FillItem[] }
  | { type: 'undo' }

// `marked` is how many required, still empty fields were outlined on the page after the fill (FR-20).
export type FillResponse = FillOutcome & { marked: number }

export type ScanResponse = { fields: FieldSummary[]; uploads: UploadSummary[]; canUndo: boolean; lockedFrame: boolean }

export type Handlers = {
  scan: () => ScanResponse
  fill: (items: FillItem[]) => FillResponse
  undo: () => number
}

const CONTENT_SCRIPT = '/page-reader.js'

function isRequest(message: unknown): message is Request {
  return typeof message === 'object' && message !== null && typeof (message as Request).type === 'string'
}

export async function requestScan(tab: ActiveTab): Promise<PageScan> {
  try {
    await browser.scripting.executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT] })
    const { fields, uploads = [], canUndo, lockedFrame }: ScanResponse = await browser.tabs.sendMessage(tab.id, { type: 'scan' } satisfies Request)
    if (fields.length > 0) return { ok: true, fields, uploads, canUndo, lockedFrame }
    return { ok: false, reason: lockedFrame ? 'locked-frame' : 'no-form' }
  } catch {
    return { ok: false, reason: classifyUnreadablePage(tab.url, await hasSiteAccess(tab.url)) }
  }
}

export function requestFill(tab: ActiveTab, items: FillItem[]): Promise<FillResponse> {
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
