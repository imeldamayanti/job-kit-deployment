import type { AiUsage } from '../core/ai/score'
import type { GenerateRequest } from '../core/generate/protocol'

// What the `generate` handler needs from the outside. The handler is pure TypeScript: the Edge Function builds these
// from its secrets and hands them in, and the tests hand in fakes.

// Read from Supabase secrets (spec §5.4). Prices are US dollars per million tokens.
export type ServerEnv = {
  aiBaseUrl: string
  aiKey: string
  aiModel: string
  priceIn: number
  priceOut: number
  budgetUsd: number
  // Calls one user may make per hour.
  rateLimit: number
}

// The billing functions of supabase/billing.sql, called with the service key. An unexpected SQL error is thrown, never
// returned as a normal answer.
export type Db = {
  reserve(user: string, kind: GenerateRequest['kind'], cost: number): Promise<{ ok: true; id: string } | { ok: false; error: 'insufficient' | 'expired' }>
  // Returns the balance after the settlement.
  settle(id: string, ok: boolean, refundReason: string | null, model: string, inTok: number, outTok: number, costUsd: number): Promise<number>
  guard(user: string, budgetUsd: number, rate: number): Promise<'ok' | 'budget' | 'rate-limit'>
  balance(user: string): Promise<number>
}

// One model call. Throws AiError.
export type Complete = (system: string, user: string, maxTokens: number) => Promise<{ text: string; usage: AiUsage }>
