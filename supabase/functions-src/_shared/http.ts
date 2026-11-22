// What the three entrypoints share: CORS for the extension, JSON answers, and a logger that cannot leak a request.

const ALLOWED_HEADERS = 'authorization, apikey, content-type, x-client-info'

// Only the extension's own origin gets an Allow-Origin header; any other origin is simply not answered with one.
export function corsHeaders(req: Request, extensionId: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
  }
  const origin = req.headers.get('origin')
  if (extensionId && origin === `chrome-extension://${extensionId}`) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export function reply(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } })
}

// The stage and the error's message or code, nothing else: never a body, a payload, a token or a key.
export function logFailure(stage: string, error: unknown): void {
  let detail = 'unknown error'
  if (error instanceof Error) {
    const code = (error as { code?: unknown; reason?: unknown }).code ?? (error as { reason?: unknown }).reason
    detail = typeof code === 'string' || typeof code === 'number' ? `${code}: ${error.message}` : error.message
  }
  console.error(`[${stage}] ${detail.slice(0, 300)}`)
}

// Reads a secret, failing with its NAME only.
export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing secret ${name}`)
  return value
}

// A secret that must be a number above zero (a price, a budget, a limit): 0, blank or junk would switch the guard off, so it fails loudly.
export function requireNumber(name: string, options: { integer?: boolean } = {}): number {
  const text = requireEnv(name).trim()
  const value = text === '' ? Number.NaN : Number(text)
  if (!Number.isFinite(value) || value <= 0 || (options.integer && !Number.isInteger(value))) throw new Error(`secret ${name} is not a number`)
  return value
}
