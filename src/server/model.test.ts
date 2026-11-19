// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { AiError } from '../core/ai/errors'
import { createModel } from './model'
import type { ServerEnv } from './ports'

const env: ServerEnv = { aiBaseUrl: 'https://ai.example.test/v1', aiKey: 'sk-server', aiModel: 'deepseek-chat', priceIn: 0.28, priceOut: 0.42, budgetUsd: 50, rateLimit: 30 }
const reply = (content: unknown = 'halo') =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 45 } }), { status: 200 })

describe('createModel', () => {
  it('posts to {base}/chat/completions with the server key, temperature 0.2 and the token cap', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const complete = createModel(env, async (url, init) => ((seen = { url: String(url), init: init as RequestInit }), reply()))
    await complete('sistem', 'pengguna', 1500)
    expect(seen?.url).toBe('https://ai.example.test/v1/chat/completions')
    expect(seen?.init.method).toBe('POST')
    const headers = seen?.init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer sk-server')
    expect(JSON.parse(String(seen?.init.body))).toEqual({
      model: 'deepseek-chat',
      temperature: 0.2,
      max_tokens: 1500,
      messages: [{ role: 'system', content: 'sistem' }, { role: 'user', content: 'pengguna' }],
    })
  })

  it('tolerates a trailing slash in the base url', async () => {
    let url = ''
    const complete = createModel({ ...env, aiBaseUrl: 'https://ai.example.test/v1/' }, async (u) => ((url = String(u)), reply()))
    await complete('s', 'u', 10)
    expect(url).toBe('https://ai.example.test/v1/chat/completions')
  })

  it('returns the text and the usage from prompt_tokens and completion_tokens', async () => {
    const complete = createModel(env, async () => reply('jawaban'))
    expect(await complete('s', 'u', 10)).toEqual({ text: 'jawaban', usage: { inputTokens: 120, outputTokens: 45 } })
  })

  it.each([
    [401, 'invalid-key'],
    [429, 'quota'],
    [500, 'server'],
  ])('turns HTTP %i into AiError(%s)', async (status, reason) => {
    const complete = createModel(env, async () => new Response('{}', { status }))
    await expect(complete('s', 'u', 10)).rejects.toMatchObject({ reason })
    await expect(complete('s', 'u', 10)).rejects.toBeInstanceOf(AiError)
  })

  it('turns a network failure into AiError(network)', async () => {
    const complete = createModel(env, async () => { throw new TypeError('fetch failed') })
    await expect(complete('s', 'u', 10)).rejects.toMatchObject({ reason: 'network' })
  })

  it('gives up after the timeout as AiError(network)', async () => {
    const hang = (_u: unknown, init?: RequestInit) => new Promise<Response>((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))
    const complete = createModel(env, hang, 20)
    await expect(complete('s', 'u', 10)).rejects.toMatchObject({ reason: 'network' })
  })

  it('treats a reply without text as a server problem', async () => {
    await expect(createModel(env, async () => reply(null))('s', 'u', 10)).rejects.toMatchObject({ reason: 'server' })
    await expect(createModel(env, async () => new Response('not json', { status: 200 }))('s', 'u', 10)).rejects.toMatchObject({ reason: 'server' })
  })

  it('reports zero tokens when the provider sends no usage', async () => {
    const complete = createModel(env, async () => new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }] }), { status: 200 }))
    expect((await complete('s', 'u', 10)).usage).toEqual({ inputTokens: 0, outputTokens: 0 })
  })
})
