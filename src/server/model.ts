import { AiError, mapAiFailure } from '../core/ai/errors'
import type { Complete, ServerEnv } from './ports'

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

// Spec §5.4: the model gets 60 seconds. The reaper refunds a reservation after 10 minutes, so this must stay well under that.
export const MODEL_TIMEOUT_MS = 60_000
const TEMPERATURE = 0.2

const count = (value: unknown): number => (typeof value === 'number' ? value : 0)

// One OpenAI-style chat completion against the server's own provider. The key is the server's; nothing here is logged.
export function createModel(env: ServerEnv, fetchImpl: FetchLike = (url, init) => fetch(url, init), timeoutMs = MODEL_TIMEOUT_MS): Complete {
  const url = `${env.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`
  return async (system, user, maxTokens) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.aiKey}` },
        body: JSON.stringify({
          model: env.aiModel,
          temperature: TEMPERATURE,
          max_tokens: maxTokens,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      })
      if (!response.ok) throw new AiError(mapAiFailure(response.status, await response.text().catch(() => '')))
      // The timer stays armed while the body is read: a provider that sends headers and then stalls must not hang the call.
      const body = (await response.json().catch(() => null)) as {
        choices?: { message?: { content?: unknown } }[]
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }
      } | null
      const text = body?.choices?.[0]?.message?.content
      if (typeof text !== 'string') throw new AiError('server')
      return { text, usage: { inputTokens: count(body?.usage?.prompt_tokens), outputTokens: count(body?.usage?.completion_tokens) } }
    } catch (error) {
      throw error instanceof AiError ? error : new AiError('network')
    } finally {
      clearTimeout(timer)
    }
  }
}
