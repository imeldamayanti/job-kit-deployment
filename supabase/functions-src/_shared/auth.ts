// Who is calling, read from the Supabase access token. The gateway already checked the signature (`verify_jwt` is on for `generate`
// and `create-payment`), so this only decodes the payload and does not verify it again. Never use it on a function with `verify_jwt` off.

export type CallerIdentity = { id: string; email: string | null }

function decodePayload(token: string): unknown {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  // base64url -> base64, then the bytes as UTF-8 (an email may hold non-ASCII).
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))))
}

export function userFromRequest(req: Request): CallerIdentity | null {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')
  if (!match?.[1]) return null
  try {
    const payload = decodePayload(match[1])
    if (typeof payload !== 'object' || payload === null) return null
    const { sub, email } = payload as { sub?: unknown; email?: unknown }
    // A key such as the anon key is a valid token with no `sub`: that is no user.
    if (typeof sub !== 'string' || !sub) return null
    return { id: sub, email: typeof email === 'string' && email ? email : null }
  } catch {
    return null
  }
}
