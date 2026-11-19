// Who is calling. The access token is checked by Supabase Auth itself (GET /auth/v1/user), and the user id comes from its answer,
// never from decoding the token here. `verify_jwt` stays on at the gateway as a second layer, but with asymmetric JWT keys it can
// be turned off, so this must not depend on it.

export type CallerIdentity = { id: string; email: string | null }
// Normally given by the Edge runtime as SUPABASE_URL and SUPABASE_ANON_KEY.
export type AuthEnv = { url: string; anonKey: string }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

// The caller, or null when there is no valid session (no header, or Auth refuses the token: expired, forged, the anon key itself).
// Throws when Auth cannot be asked or is itself failing: that is our outage, not a bad token, and the entrypoint answers its generic 500.
export async function authenticate(req: Request, env: AuthEnv, fetchImpl: typeof fetch = fetch): Promise<CallerIdentity | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')
  if (!match?.[1]) return null
  let response: Response
  let body: unknown
  try {
    response = await fetchImpl(`${env.url.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${match[1]}`, apikey: env.anonKey },
      signal: AbortSignal.timeout(5000),
    })
    body = response.status === 200 ? await response.json() : null
  } catch {
    throw new Error('auth service unreachable')
  }
  if (response.status >= 500) throw new Error(`auth service answered ${response.status}`)
  if (response.status !== 200 || !isRecord(body)) return null
  const { id, email } = body
  if (typeof id !== 'string' || !id) return null
  return { id, email: typeof email === 'string' && email ? email : null }
}
