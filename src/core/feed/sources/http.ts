import { SourceError, type FetchContext } from './types'

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type Attempt = { ok: true; body: unknown } | { ok: false; error: SourceError; retry: boolean }

type Reader = (response: Response) => Promise<unknown>

async function attempt(ctx: FetchContext, url: string, init: RequestInit, read: Reader): Promise<Attempt> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ctx.timeoutMs ?? 15000)
  try {
    // credentials 'omit': a source never sees the user's cookies (PRD §4.1).
    const response = await ctx.fetch(url, { ...init, credentials: 'omit', signal: controller.signal })
    if (response.status === 429 || response.status === 403 || response.status === 999) return { ok: false, error: new SourceError('blocked'), retry: false }
    if (!response.ok) return { ok: false, error: new SourceError(`http-${response.status}`), retry: response.status >= 500 }
    try {
      return { ok: true, body: await read(response) }
    } catch {
      return { ok: false, error: new SourceError('parse'), retry: false }
    }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return { ok: false, error: new SourceError(aborted ? 'timeout' : 'network'), retry: true }
  } finally {
    clearTimeout(timer)
  }
}

async function request(ctx: FetchContext, url: string, init: RequestInit, read: Reader): Promise<unknown> {
  let last = await attempt(ctx, url, init, read)
  if (!last.ok && last.retry) {
    await (ctx.sleep ?? defaultSleep)(1000)
    last = await attempt(ctx, url, init, read)
  }
  if (!last.ok) throw last.error
  return last.body
}

// One request, one retry. A failure becomes a SourceError carrying the reason (PRD §8).
export const fetchJson = (ctx: FetchContext, url: string, init: RequestInit = {}) =>
  request(ctx, url, init, (response) => response.json())

export const fetchText = (ctx: FetchContext, url: string, init: RequestInit = {}) =>
  request(ctx, url, init, (response) => response.text()) as Promise<string>
