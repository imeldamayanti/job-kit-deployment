import { browser } from 'wxt/browser'
import { storage } from 'wxt/utils/storage'
import { afterSend, buildBatch, describePending, initialTelemetry, recordEvent, setTelemetry, shouldSend, type EventName, type TelemetryState } from '../core/telemetry/events'
import { sendCounts } from '../core/telemetry/send'
import { SUPABASE_CONFIG } from '../core/sync/config'
import { localDay } from '../core/tailor/limits'
import { requestOrigins } from './permissions'
import { supabaseOrigin, syncConfigured } from './sync'

// Opt-in, anonymous counts (PRD §4.4). Off until the person turns it on in Akun.
const item = storage.defineItem<TelemetryState>('local:telemetry', { fallback: initialTelemetry() })

export const loadTelemetry = (): Promise<TelemetryState> => item.getValue()
export const telemetryAvailable = (): boolean => syncConfigured()
const version = (): string => browser.runtime.getManifest().version

// Must start inside a click. `ask` is replaceable so a test need not open a real permission prompt.
export async function enableTelemetry(ask: () => Promise<boolean> = () => requestOrigins(supabaseOrigin())): Promise<boolean> {
  if (!telemetryAvailable() || !(await ask())) return false
  await item.setValue(setTelemetry(await item.getValue(), true))
  return true
}

export async function disableTelemetry(): Promise<void> {
  await item.setValue(setTelemetry(await item.getValue(), false))
}

export async function pendingLines(): Promise<string[]> {
  return describePending(await item.getValue(), version())
}

// Called from the features. It must never break them: any failure here is swallowed.
export async function noteEvent(name: EventName, now = new Date()): Promise<void> {
  try {
    const state = await item.getValue()
    if (!state.enabled) return
    let next = recordEvent(state, name, localDay(now))
    await item.setValue(next)
    const today = localDay(now)
    if (shouldSend(next, today, version()) && (await sendCounts(SUPABASE_CONFIG, buildBatch(next, version(), today))) === 'sent') {
      next = afterSend(next, today)
      await item.setValue(next)
    }
  } catch {
    // Telemetry is never worth a broken Fill.
  }
}
