// Supabase over plain fetch (RFC D17): Auth by one-time email code, and the `user_data` table. No SDK, no browser API:
// fetch and the clock are passed in so tests can run it. Written from the public REST docs; not yet run against a live project.

export type SupabaseConfig = { url: string; key: string }
export type Session = { accessToken: string; refreshToken: string; expiresAt: number; userId: string; email: string }
export type ApiFailure = 'network' | 'rate-limit' | 'rejected' | 'signed-out' | 'conflict' | 'server'
export type Row = { kind: string; ciphertext: string; updatedAt: string }

type FetchFn = typeof fetch
const nowSeconds = () => Math.floor(Date.now() / 1000)

// A secret or service_role key in a browser extension would give the database to every user.
export function isConfigured(config: SupabaseConfig): boolean {
  if (!config.url.startsWith('https://') || config.key === '') return false
  if (config.key.startsWith('sb_publishable_')) return true
  const part = config.key.split('.')[1]
  if (config.key.split('.').length !== 3 || !part) return false
  try {
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'
  } catch {
    return false
  }
}

const base = (config: SupabaseConfig) => config.url.replace(/\/$/, '')
const publicHeaders = (config: SupabaseConfig) => ({ 'Content-Type': 'application/json', apikey: config.key })
const userHeaders = (config: SupabaseConfig, session: Session) => ({ ...publicHeaders(config), Authorization: `Bearer ${session.accessToken}` })

function failure(status: number): ApiFailure {
  if (status === 429) return 'rate-limit'
  if (status === 401) return 'signed-out'
  if (status === 409) return 'conflict'
  return status >= 400 && status < 500 ? 'rejected' : 'server'
}

async function request(fetchFn: FetchFn, url: string, init: RequestInit): Promise<{ ok: true; status: number; body: unknown } | { ok: false; reason: ApiFailure }> {
  let response: Response
  try {
    response = await fetchFn(url, init)
  } catch {
    return { ok: false, reason: 'network' }
  }
  if (!response.ok) return { ok: false, reason: failure(response.status) }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Empty body (204): fine.
  }
  return { ok: true, status: response.status, body }
}

type Failed = { ok: false; reason: ApiFailure }

export async function sendOtp(config: SupabaseConfig, email: string, fetchFn: FetchFn = fetch): Promise<{ ok: true } | Failed> {
  const result = await request(fetchFn, `${base(config)}/auth/v1/otp`, { method: 'POST', headers: publicHeaders(config), body: JSON.stringify({ email, create_user: true }) })
  return result.ok ? { ok: true } : result
}

function toSession(body: unknown, now: () => number): Session | null {
  const data = body as { access_token?: string; refresh_token?: string; expires_in?: number; user?: { id?: string; email?: string } } | null
  if (!data?.access_token || !data.refresh_token || !data.user?.id) return null
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: now() + (data.expires_in ?? 3600), userId: data.user.id, email: data.user.email ?? '' }
}

export async function verifyOtp(config: SupabaseConfig, email: string, token: string, fetchFn: FetchFn = fetch, now = nowSeconds): Promise<{ ok: true; session: Session } | Failed> {
  const result = await request(fetchFn, `${base(config)}/auth/v1/verify`, { method: 'POST', headers: publicHeaders(config), body: JSON.stringify({ type: 'email', email, token }) })
  if (!result.ok) return result
  const session = toSession(result.body, now)
  return session ? { ok: true, session } : { ok: false, reason: 'server' }
}

export async function refreshSession(config: SupabaseConfig, refreshToken: string, fetchFn: FetchFn = fetch, now = nowSeconds): Promise<{ ok: true; session: Session } | Failed> {
  const result = await request(fetchFn, `${base(config)}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: publicHeaders(config), body: JSON.stringify({ refresh_token: refreshToken }) })
  if (!result.ok) return result
  const session = toSession(result.body, now)
  return session ? { ok: true, session } : { ok: false, reason: 'server' }
}

// Best effort: the local session is dropped either way.
export async function signOut(config: SupabaseConfig, session: Session, fetchFn: FetchFn = fetch): Promise<void> {
  await request(fetchFn, `${base(config)}/auth/v1/logout`, { method: 'POST', headers: userHeaders(config, session) })
}

export async function listRows(config: SupabaseConfig, session: Session, fetchFn: FetchFn = fetch): Promise<{ ok: true; rows: Row[] } | Failed> {
  const result = await request(fetchFn, `${base(config)}/rest/v1/user_data?select=kind,ciphertext,updated_at`, { method: 'GET', headers: userHeaders(config, session) })
  if (!result.ok) return result
  const rows = (Array.isArray(result.body) ? result.body : []) as { kind: string; ciphertext: string; updated_at: string }[]
  return { ok: true, rows: rows.map((r) => ({ kind: r.kind, ciphertext: r.ciphertext, updatedAt: r.updated_at })) }
}

// `expectedAt` is the row's `updated_at` as we last read it, or null when we believe no row exists. If someone wrote in between,
// nothing is overwritten and the answer is 'conflict' (the caller reads again and plans again).
export async function putRow(config: SupabaseConfig, session: Session, kind: string, ciphertext: string, expectedAt: string | null, fetchFn: FetchFn = fetch): Promise<{ ok: true; updatedAt: string } | Failed> {
  const headers = { ...userHeaders(config, session), Prefer: 'return=representation' }
  const result =
    expectedAt === null
      ? await request(fetchFn, `${base(config)}/rest/v1/user_data`, { method: 'POST', headers, body: JSON.stringify({ kind, ciphertext }) })
      : await request(fetchFn, `${base(config)}/rest/v1/user_data?kind=eq.${encodeURIComponent(kind)}&updated_at=eq.${encodeURIComponent(expectedAt)}`, {
          method: 'PATCH', headers, body: JSON.stringify({ ciphertext }),
        })
  if (!result.ok) return result
  const rows = Array.isArray(result.body) ? (result.body as { updated_at?: string }[]) : []
  const updatedAt = rows[0]?.updated_at
  return updatedAt ? { ok: true, updatedAt } : { ok: false, reason: 'conflict' }
}

export async function deleteAccount(config: SupabaseConfig, session: Session, fetchFn: FetchFn = fetch): Promise<{ ok: true } | Failed> {
  const result = await request(fetchFn, `${base(config)}/rest/v1/rpc/delete_account`, { method: 'POST', headers: userHeaders(config, session), body: '{}' })
  return result.ok ? { ok: true } : result
}
