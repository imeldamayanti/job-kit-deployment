import { isConfigured, type SupabaseConfig } from '../sync/api'
import type { EventRow } from './events'

// The batch goes with the publishable key only: no user token, no cookies, so a count cannot be tied to an account.
export async function sendCounts(config: SupabaseConfig, rows: EventRow[], fetchFn: typeof fetch = fetch): Promise<'sent' | 'nothing' | 'unavailable' | 'failed'> {
  if (!isConfigured(config)) return 'unavailable'
  if (rows.length === 0) return 'nothing'
  try {
    const response = await fetchFn(`${config.url.replace(/\/$/, '')}/rest/v1/event_counts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.key },
      body: JSON.stringify(rows),
      credentials: 'omit',
    })
    return response.ok ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}
