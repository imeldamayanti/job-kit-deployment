import type { Db, PaymentDb, Purchase } from './ports'

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

// A PostgREST error. The message is what `raise exception` said (e.g. 'insufficient'), never the request or the key.
class DbError extends Error {
  constructor(public status: number, public detail: string, what: string) {
    super(`${what} failed (${status}): ${detail}`)
  }
}

const GUARDS = ['ok', 'budget', 'rate-limit'] as const

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function readPurchase(row: unknown): Purchase {
  if (!isRecord(row)) throw new Error('create_purchase returned no row')
  const { id, status, amount_idr: amountIdr, credits, qr_url: qrUrl, expires_at: expiresAt } = row
  if (typeof id !== 'string' || typeof status !== 'string' || typeof amountIdr !== 'number' || typeof credits !== 'number' || typeof expiresAt !== 'string') {
    throw new Error('create_purchase returned a row it cannot read')
  }
  return { id, status, amountIdr, credits, qrUrl: typeof qrUrl === 'string' ? qrUrl : null, expiresAt }
}

// The billing functions of supabase/billing.sql over PostgREST, with the service key (the functions are granted to service_role only).
export function createDb(url: string, serviceKey: string, fetchImpl: FetchLike = (u, init) => fetch(u, init)): Db & PaymentDb {
  const base = url.replace(/\/+$/, '')
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' }

  async function send(what: string, endpoint: string, init: RequestInit): Promise<unknown> {
    const response = await fetchImpl(`${base}${endpoint}`, { ...init, headers })
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: unknown } | null
      throw new DbError(response.status, typeof error?.message === 'string' ? error.message : 'no detail', what)
    }
    // A `void` function answers with an empty body or `null`.
    const text = await response.text()
    return text === '' ? null : JSON.parse(text)
  }
  const rpc = (fn: string, args: Record<string, unknown>) => send(fn, `/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) })

  return {
    async reserve(user, kind, cost) {
      try {
        const id = await rpc('reserve_credits', { p_user: user, p_kind: kind, p_cost: cost })
        if (typeof id !== 'string') throw new Error('reserve_credits returned no id')
        return { ok: true, id }
      } catch (error) {
        // Only these two are a normal refusal; anything else (invalid_cost, unauthenticated, an outage) is thrown.
        if (error instanceof DbError && (error.detail === 'insufficient' || error.detail === 'expired')) return { ok: false, error: error.detail }
        throw error
      }
    },

    async settle(id, ok, refundReason, model, inTok, outTok, costUsd) {
      const balance = await rpc('settle_generation', { p_id: id, p_ok: ok, p_refund_reason: refundReason, p_model: model, p_in: inTok, p_out: outTok, p_cost: costUsd })
      if (typeof balance !== 'number') throw new Error('settle_generation returned no balance')
      return balance
    },

    async guard(user, budgetUsd, rate) {
      const answer = await rpc('ai_guard', { p_user: user, p_budget_usd: budgetUsd, p_rate: rate })
      if (!GUARDS.includes(answer as (typeof GUARDS)[number])) throw new Error('ai_guard returned an unknown answer')
      return answer as (typeof GUARDS)[number]
    },

    async balance(user) {
      const rows = await send('balance', `/rest/v1/accounts?user_id=eq.${encodeURIComponent(user)}&select=credits`, { method: 'GET' })
      const credits = Array.isArray(rows) ? (rows[0] as { credits?: unknown } | undefined)?.credits : undefined
      return typeof credits === 'number' ? credits : 0
    },

    async createPurchase(user, packageId) {
      return readPurchase(await rpc('create_purchase', { p_user: user, p_package: packageId }))
    },

    async attachGateway(purchaseId, reference, qrUrl) {
      await rpc('attach_gateway', { p_purchase: purchaseId, p_reference: reference, p_qr_url: qrUrl })
    },

    async applyPayment(purchaseId, reference, status, amount) {
      try {
        const final = await rpc('apply_payment', { p_purchase: purchaseId, p_reference: reference, p_status: status, p_amount: amount })
        if (typeof final !== 'string') throw new Error('apply_payment returned no status')
        return final
      } catch (error) {
        // An unknown purchase is a normal answer; anything else (a duplicate reference, an outage) is thrown so the gateway retries.
        if (error instanceof DbError && error.detail === 'not_found') return 'not_found'
        throw error
      }
    },
  }
}
