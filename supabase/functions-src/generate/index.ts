import { createDb } from '../../../src/server/db'
import { handleGenerate } from '../../../src/server/generate'
import { createModel } from '../../../src/server/model'
import type { ServerEnv } from '../../../src/server/ports'
import { authenticate } from '../_shared/auth'
import { corsHeaders, logFailure, reply, requireEnv, requireNumber } from '../_shared/http'

// Default calls one account may make per hour (spec §5.4 proposes 30); RATE_LIMIT_PER_HOUR overrides it.
const DEFAULT_RATE_LIMIT = 30

function readEnv(): ServerEnv {
  return {
    aiBaseUrl: requireEnv('AI_BASE_URL'),
    aiKey: requireEnv('AI_API_KEY'),
    aiModel: requireEnv('AI_MODEL'),
    priceIn: requireNumber('AI_PRICE_IN'),
    priceOut: requireNumber('AI_PRICE_OUT'),
    budgetUsd: requireNumber('MONTHLY_AI_BUDGET_USD'),
    rateLimit: Deno.env.get('RATE_LIMIT_PER_HOUR') ? requireNumber('RATE_LIMIT_PER_HOUR', { integer: true }) : DEFAULT_RATE_LIMIT,
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req, Deno.env.get('EXTENSION_ID'))
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'invalid-request', message: 'Metode tidak didukung.', credits: null }, cors)

  try {
    const env = readEnv()
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const db = createDb(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
    const caller = await authenticate(req, { url: supabaseUrl, anonKey: requireEnv('SUPABASE_ANON_KEY') })
    const body: unknown = await req.json().catch(() => null)
    const result = await handleGenerate(
      { userId: caller?.id ?? null, body },
      { db, env, complete: createModel(env), report: logFailure },
    )
    return reply(result.status, result.body, cors)
  } catch (error) {
    // Nothing about what broke goes back to the caller.
    logFailure('generate', error)
    return reply(500, { ok: false, error: 'ai', message: 'Terjadi gangguan. Coba lagi sebentar.', credits: null }, cors)
  }
})
