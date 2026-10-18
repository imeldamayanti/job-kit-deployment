// Pure parts of the feedback form: building the row and posting it to Supabase. No DOM here, so tests can run it.
export const KINDS = ['Masalah', 'Saran', 'Lainnya']
export const MAX_MESSAGE = 2000

// Only a public key may ship in a web page. A secret or service_role key here would hand the database to every visitor.
export function isPublicKey(key) {
  if (typeof key !== 'string' || key === '') return false
  if (key.startsWith('sb_publishable_')) return true
  const part = key.split('.')[1]
  if (key.split('.').length !== 3 || !part) return false
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json).role === 'anon'
  } catch {
    return false
  }
}

// The row to store, or null when the form must not be sent (empty message, unknown kind, honeypot filled).
export function buildRow(data) {
  if (String(data.get('website') ?? '') !== '') return null
  const kind = String(data.get('kind') ?? '')
  const message = String(data.get('message') ?? '').trim().slice(0, MAX_MESSAGE)
  if (!KINDS.includes(kind) || message === '') return null
  const email = String(data.get('email') ?? '').trim()
  return { kind, message, email: email === '' ? null : email.slice(0, 254) }
}

// 'inactive' = not configured (nothing was sent), 'sent', or 'failed'.
export async function sendFeedback(row, config, fetchFn = fetch) {
  if (!config.url || !isPublicKey(config.key)) return 'inactive'
  try {
    const response = await fetchFn(`${config.url.replace(/\/$/, '')}/rest/v1/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.key, Authorization: `Bearer ${config.key}`, Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    })
    return response.ok ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}
