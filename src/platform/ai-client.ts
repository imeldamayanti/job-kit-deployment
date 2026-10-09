import { AiError, mapAiFailure } from '../core/ai/errors'

export type AiRequest = { key: string; model: string; system: string; user: string; maxTokens: number }
export type AiUsage = { inputTokens: number; outputTokens: number }
export type AiReply = { text: string; usage: AiUsage }
export type AiClient = { complete: (request: AiRequest) => Promise<AiReply> }

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

// The user's own key goes straight to the provider; job-kit has no server in between (PRD §4.1).
export function createAnthropicClient(fetchImpl: FetchLike = (url, init) => fetch(url, init), timeoutMs = 30000): AiClient {
  return {
    async complete({ key, model, system, user, maxTokens }) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response: Response
      try {
        response = await fetchImpl(ANTHROPIC_URL, {
          method: 'POST',
          credentials: 'omit',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
        })
      } catch {
        throw new AiError('network')
      } finally {
        clearTimeout(timer)
      }
      if (!response.ok) throw new AiError(mapAiFailure(response.status, await response.text().catch(() => '')))
      const body = (await response.json().catch(() => null)) as {
        content?: { type?: string; text?: string }[]
        usage?: { input_tokens?: number; output_tokens?: number }
      } | null
      const text = body?.content?.find((part) => part.type === 'text' || typeof part.text === 'string')?.text
      if (typeof text !== 'string') throw new AiError('server')
      return { text, usage: { inputTokens: body?.usage?.input_tokens ?? 0, outputTokens: body?.usage?.output_tokens ?? 0 } }
    },
  }
}
