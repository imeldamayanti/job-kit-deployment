import { describe, expect, it } from 'vitest'
import { AiError } from '../core/ai/errors'
import { createAnthropicClient, createBridgeClient, createGeminiClient, createZenClient, zenUsesResponses } from './ai-client'

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

describe('createGeminiClient', () => {
  it('sends a bearer key to the Gemini chat completions endpoint and reads the reply', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const client = createGeminiClient(
      async (url, init) => (
        (seen = { url: String(url), init: init as RequestInit }),
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 5, completion_tokens: 1 } }), { status: 200 })
      ),
    )
    const reply = await client.complete({ key: 'g-key', model: 'gemini-3.5-flash-lite', system: 's', user: 'u', maxTokens: 10 })
    expect(reply).toEqual({ text: 'ok', usage: { inputTokens: 5, outputTokens: 1 } })
    expect(seen?.url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
    expect((seen?.init.headers as Record<string, string>).authorization).toBe('Bearer g-key')
    expect(seen?.init.credentials).toBe('omit')
    expect(JSON.parse(String(seen?.init.body))).toEqual({
      model: 'gemini-3.5-flash-lite',
      max_tokens: 10,
      messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }],
    })
  })

  it('maps a refused key and a rate limit', async () => {
    const ask = (status: number) => createGeminiClient(async () => new Response('{}', { status })).complete({ key: 'x', model: 'm', system: '', user: 'u', maxTokens: 5 })
    await expect(ask(401)).rejects.toMatchObject({ reason: 'invalid-key' })
    await expect(ask(429)).rejects.toMatchObject({ reason: 'quota' })
  })
})

describe('createZenClient', () => {
  const chatReply = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 9, completion_tokens: 2 } }), { status: 200 })
  const responsesReply = (text: string) =>
    new Response(JSON.stringify({ output: [{ type: 'reasoning', content: [] }, { type: 'message', content: [{ type: 'output_text', text }] }], usage: { input_tokens: 7, output_tokens: 4 } }), { status: 200 })

  it('sends a bearer key to chat completions for ordinary models', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const client = createZenClient(async (url, init) => ((seen = { url: String(url), init: init as RequestInit }), chatReply('ok')))
    const reply = await client.complete({ key: 'zen-key', model: 'space-bunny-free', system: 's', user: 'u', maxTokens: 10 })
    expect(reply).toEqual({ text: 'ok', usage: { inputTokens: 9, outputTokens: 2 } })
    expect(seen?.url).toBe('https://opencode.ai/zen/v1/chat/completions')
    const headers = seen?.init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer zen-key')
    expect(headers['x-api-key']).toBeUndefined()
    expect(seen?.init.credentials).toBe('omit')
    expect(JSON.parse(String(seen?.init.body))).toEqual({
      model: 'space-bunny-free',
      max_tokens: 10,
      messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }],
    })
  })

  it('leaves out the system message when there is none', async () => {
    let body: { messages: unknown[] } | undefined
    const client = createZenClient(async (_url, init) => ((body = JSON.parse(String(init?.body))), chatReply('ok')))
    await client.complete({ key: 'k', model: 'exo-free', system: '', user: 'u', maxTokens: 5 })
    expect(body?.messages).toEqual([{ role: 'user', content: 'u' }])
  })

  it('uses the Responses API for Muse models and reads the message text', async () => {
    let seen: { url: string; body: unknown } | undefined
    const client = createZenClient(async (url, init) => ((seen = { url: String(url), body: JSON.parse(String(init?.body)) }), responsesReply('hai')))
    const reply = await client.complete({ key: 'k', model: 'muse-spark-1.3-contributor-free', system: 's', user: 'u', maxTokens: 20 })
    expect(reply).toEqual({ text: 'hai', usage: { inputTokens: 7, outputTokens: 4 } })
    expect(seen?.url).toBe('https://opencode.ai/zen/v1/responses')
    expect(seen?.body).toEqual({ model: 'muse-spark-1.3-contributor-free', instructions: 's', input: 'u', max_output_tokens: 20 })
  })

  it('picks the endpoint from the model name', () => {
    expect(zenUsesResponses('muse-spark-1.3-contributor-free')).toBe(true)
    expect(zenUsesResponses('space-bunny-free')).toBe(false)
  })

  it('maps a refused key, a limit and a network failure like the other provider', async () => {
    const ask = (client: ReturnType<typeof createZenClient>) => client.complete({ key: 'x', model: 'exo-free', system: '', user: 'u', maxTokens: 5 })
    await expect(ask(createZenClient(async () => new Response('{}', { status: 401 })))).rejects.toMatchObject({ reason: 'invalid-key' })
    await expect(ask(createZenClient(async () => new Response('{}', { status: 429 })))).rejects.toMatchObject({ reason: 'quota' })
    await expect(ask(createZenClient(async () => { throw new TypeError('Failed to fetch') }))).rejects.toMatchObject({ reason: 'network' })
  })

  it('treats a reply without text as a server problem', async () => {
    const client = createZenClient(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }))
    await expect(client.complete({ key: 'x', model: 'exo-free', system: '', user: 'u', maxTokens: 5 })).rejects.toMatchObject({ reason: 'server' })
  })
})

describe('createBridgeClient', () => {
  it('sends the bridge token and the prompt, and returns the text with no token counts', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const client = createBridgeClient(async (url, init) => ((seen = { url: String(url), init: init as RequestInit }), new Response(JSON.stringify({ text: 'ok' }), { status: 200 })))
    const reply = await client.complete({ key: 'tok', model: 'haiku', system: 's', user: 'u', maxTokens: 10 })
    expect(reply).toEqual({ text: 'ok', usage: { inputTokens: 0, outputTokens: 0 } })
    expect(seen?.url).toBe('http://127.0.0.1:8787/complete')
    expect((seen?.init.headers as Record<string, string>).authorization).toBe('Bearer tok')
    expect(JSON.parse(String(seen?.init.body))).toEqual({ model: 'haiku', system: 's', user: 'u' })
  })

  it('treats a wrong token as an invalid key and a missing bridge as a network error', async () => {
    const refused = createBridgeClient(async () => new Response('{}', { status: 401 }))
    await expect(refused.complete({ key: 'x', model: 'haiku', system: '', user: 'u', maxTokens: 5 })).rejects.toMatchObject({ reason: 'invalid-key' })
    const down = createBridgeClient(async () => { throw new TypeError('Failed to fetch') })
    await expect(down.complete({ key: 'x', model: 'haiku', system: '', user: 'u', maxTokens: 5 })).rejects.toMatchObject({ reason: 'network' })
  })
})
