import { AiError, mapAiFailure } from '../core/ai/errors'
import { aiOrigins, type AiProvider } from '../core/feed/settings'
import { hasOrigins } from './permissions'

export type AiRequest = { key: string; model: string; system: string; user: string; maxTokens: number }
export type AiUsage = { inputTokens: number; outputTokens: number }
export type AiReply = { text: string; usage: AiUsage }
export type AiClient = { complete: (request: AiRequest) => Promise<AiReply> }

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
export const ZEN_CHAT_URL = 'https://opencode.ai/zen/v1/chat/completions'
export const ZEN_RESPONSES_URL = 'https://opencode.ai/zen/v1/responses'
export const GEMINI_CHAT_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

// Zen serves the Muse models on the OpenAI Responses API; every other free model uses chat completions.
export const zenUsesResponses = (model: string): boolean => model.trim().startsWith('muse-')

// The user's own key goes straight to the provider; job-kit has no server in between (PRD §4.1).
async function post(fetchImpl: FetchLike, timeoutMs: number, url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      credentials: 'omit',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AiError('network')
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) throw new AiError(mapAiFailure(response.status, await response.text().catch(() => '')))
  return response.json().catch(() => null)
}

const count = (value: unknown): number => (typeof value === 'number' ? value : 0)

export function createAnthropicClient(fetchImpl: FetchLike = (url, init) => fetch(url, init), timeoutMs = 30000): AiClient {
  return {
    async complete({ key, model, system, user, maxTokens }) {
      const body = (await post(
        fetchImpl,
        timeoutMs,
        ANTHROPIC_URL,
        { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] },
      )) as {
        content?: { type?: string; text?: string }[]
        usage?: { input_tokens?: number; output_tokens?: number }
      } | null
      const text = body?.content?.find((part) => part.type === 'text' || typeof part.text === 'string')?.text
      if (typeof text !== 'string') throw new AiError('server')
      return { text, usage: { inputTokens: count(body?.usage?.input_tokens), outputTokens: count(body?.usage?.output_tokens) } }
    },
  }
}

export function createZenClient(fetchImpl: FetchLike = (url, init) => fetch(url, init), timeoutMs = 30000): AiClient {
  return {
    async complete({ key, model, system, user, maxTokens }) {
      const headers = { authorization: `Bearer ${key}` }
      if (zenUsesResponses(model)) {
        const body = (await post(fetchImpl, timeoutMs, ZEN_RESPONSES_URL, headers, {
          model,
          ...(system !== '' && { instructions: system }),
          input: user,
          max_output_tokens: maxTokens,
        })) as {
          output?: { type?: string; content?: { type?: string; text?: string }[] }[]
          usage?: { input_tokens?: number; output_tokens?: number }
        } | null
        const text = body?.output?.flatMap((item) => (item.type === 'message' ? (item.content ?? []) : [])).find((part) => typeof part.text === 'string')?.text
        if (typeof text !== 'string') throw new AiError('server')
        return { text, usage: { inputTokens: count(body?.usage?.input_tokens), outputTokens: count(body?.usage?.output_tokens) } }
      }
      return chatCompletion(fetchImpl, timeoutMs, ZEN_CHAT_URL, headers, { model, system, user, maxTokens })
    },
  }
}

// The OpenAI-style chat completions shape, shared by Zen and Gemini.
async function chatCompletion(
  fetchImpl: FetchLike,
  timeoutMs: number,
  url: string,
  headers: Record<string, string>,
  { model, system, user, maxTokens }: Pick<AiRequest, 'model' | 'system' | 'user' | 'maxTokens'>,
): Promise<AiReply> {
  const body = (await post(fetchImpl, timeoutMs, url, headers, {
    model,
    max_tokens: maxTokens,
    messages: [...(system !== '' ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }],
  })) as {
    choices?: { message?: { content?: unknown } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  } | null
  const text = body?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new AiError('server')
  return { text, usage: { inputTokens: count(body?.usage?.prompt_tokens), outputTokens: count(body?.usage?.completion_tokens) } }
}

export function createGeminiClient(fetchImpl: FetchLike = (url, init) => fetch(url, init), timeoutMs = 30000): AiClient {
  return {
    complete: ({ key, ...request }) => chatCompletion(fetchImpl, timeoutMs, GEMINI_CHAT_URL, { authorization: `Bearer ${key}` }, request),
  }
}

export const createAiClient = (provider: AiProvider): AiClient =>
  provider === 'opencode-zen' ? createZenClient() : provider === 'gemini' ? createGeminiClient() : createAnthropicClient()

// The client for a run, or one that fails with 'no-permission' when the person has not yet allowed the provider.
export async function clientWithPermission(key: string, provider: AiProvider): Promise<AiClient> {
  if (key.trim() !== '' && !(await hasOrigins(aiOrigins(provider)))) {
    return { complete: async () => { throw new AiError('no-permission') } }
  }
  return createAiClient(provider)
}
