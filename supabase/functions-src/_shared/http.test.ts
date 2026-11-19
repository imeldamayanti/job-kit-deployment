// @vitest-environment node
// (happy-dom drops forbidden request headers such as Origin; the Edge runtime does not.)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { corsHeaders, logFailure, reply, requireNumber } from './http'

const request = (origin: string | null) => new Request('https://f.test/generate', { method: 'OPTIONS', headers: origin === null ? {} : { origin } })

afterEach(() => vi.restoreAllMocks())

describe('corsHeaders', () => {
  it('reflects only the extension origin built from EXTENSION_ID', () => {
    const headers = corsHeaders(request('chrome-extension://abc'), 'abc')
    expect(headers['Access-Control-Allow-Origin']).toBe('chrome-extension://abc')
    expect(headers['Access-Control-Allow-Headers']).toBe('authorization, apikey, content-type, x-client-info')
    expect(headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS')
  })

  it('omits Allow-Origin for any other origin, a missing origin or an unset id', () => {
    expect(corsHeaders(request('chrome-extension://other'), 'abc')['Access-Control-Allow-Origin']).toBeUndefined()
    expect(corsHeaders(request('https://evil.test'), 'abc')['Access-Control-Allow-Origin']).toBeUndefined()
    expect(corsHeaders(request(null), 'abc')['Access-Control-Allow-Origin']).toBeUndefined()
    expect(corsHeaders(request('chrome-extension://undefined'), undefined)['Access-Control-Allow-Origin']).toBeUndefined()
  })
})

describe('reply', () => {
  it('answers JSON with the given status and headers', async () => {
    const response = reply(402, { ok: false }, { 'Access-Control-Allow-Origin': 'chrome-extension://abc' })
    expect(response.status).toBe(402)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('chrome-extension://abc')
    expect(await response.json()).toEqual({ ok: false })
  })
})

describe('logFailure', () => {
  it('logs the stage and the error message or code, and nothing else', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logFailure('settle', new Error('settle_generation failed (500): boom'))
    logFailure('model', Object.assign(new Error('server'), { reason: 'server' }))
    logFailure('apply', 'a string that could be a body')
    expect(spy.mock.calls).toEqual([
      ['[settle] settle_generation failed (500): boom'],
      ['[model] server: server'],
      ['[apply] unknown error'],
    ])
  })
})

describe('requireNumber', () => {
  it('names the secret, never its value, when it is not a number', () => {
    vi.stubGlobal('Deno', { env: { get: (name: string) => ({ A: '1.5', B: 'x' })[name] } })
    expect(requireNumber('A')).toBe(1.5)
    expect(() => requireNumber('B')).toThrow('secret B is not a number')
    expect(() => requireNumber('C')).toThrow('missing secret C')
    vi.unstubAllGlobals()
  })
})
