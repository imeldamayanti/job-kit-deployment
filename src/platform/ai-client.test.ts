import { describe, expect, it } from 'vitest'
import { AiError } from '../core/ai/errors'
import { createAnthropicClient } from './ai-client'

const ok = (text: string) => new Response(JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 12, output_tokens: 3 } }), { status: 200 })

describe('createAnthropicClient', () => {
  it('sends the key and version headers and returns the text', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const client = createAnthropicClient(async (url, init) => ((seen = { url: String(url), init: init as RequestInit }), ok('ok')))
    const text = await client.complete({ key: 'sk-test', model: 'm', system: 's', user: 'u', maxTokens: 10 })
    expect(text).toEqual({ text: 'ok', usage: { inputTokens: 12, outputTokens: 3 } })
    expect(seen?.url).toBe('https://api.anthropic.com/v1/messages')
    const headers = seen?.init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-test')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(seen?.init.credentials).toBe('omit')
    expect(JSON.parse(String(seen?.init.body))).toMatchObject({ model: 'm', max_tokens: 10, system: 's', messages: [{ role: 'user', content: 'u' }] })
  })

  it('turns a refused key into an invalid-key error', async () => {
    const client = createAnthropicClient(async () => new Response('{}', { status: 401 }))
    await expect(client.complete({ key: 'x', model: 'm', system: '', user: 'u', maxTokens: 5 })).rejects.toMatchObject({ reason: 'invalid-key' })
  })

  it('turns a network failure into a network error', async () => {
    const client = createAnthropicClient(async () => { throw new TypeError('Failed to fetch') })
    await expect(client.complete({ key: 'x', model: 'm', system: '', user: 'u', maxTokens: 5 })).rejects.toBeInstanceOf(AiError)
    await expect(client.complete({ key: 'x', model: 'm', system: '', user: 'u', maxTokens: 5 })).rejects.toMatchObject({ reason: 'network' })
  })

  it('gives up after the timeout', async () => {
    const hang = (_u: unknown, init?: RequestInit) => new Promise<Response>((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))
    const client = createAnthropicClient(hang, 20)
    await expect(client.complete({ key: 'x', model: 'm', system: '', user: 'u', maxTokens: 5 })).rejects.toMatchObject({ reason: 'network' })
  })

  it('treats a reply without text as a server problem', async () => {
    const client = createAnthropicClient(async () => new Response(JSON.stringify({ content: [] }), { status: 200 }))
    await expect(client.complete({ key: 'x', model: 'm', system: '', user: 'u', maxTokens: 5 })).rejects.toMatchObject({ reason: 'server' })
  })
})
