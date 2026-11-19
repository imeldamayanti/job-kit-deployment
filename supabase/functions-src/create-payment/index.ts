import { createDb } from '../../../src/server/db'
import { handleCreatePayment } from '../../../src/server/payments'
import type { TripayEnv } from '../../../src/server/tripay'
import { userFromRequest } from '../_shared/auth'
import { corsHeaders, logFailure, reply, requireEnv } from '../_shared/http'

function readTripay(supabaseUrl: string): TripayEnv {
  const mode = requireEnv('TRIPAY_MODE')
  if (mode !== 'sandbox' && mode !== 'production') throw new Error('secret TRIPAY_MODE must be sandbox or production')
  return {
    apiKey: requireEnv('TRIPAY_API_KEY'),
    privateKey: requireEnv('TRIPAY_PRIVATE_KEY'),
    merchantCode: requireEnv('TRIPAY_MERCHANT_CODE'),
    mode,
    callbackUrl: `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/tripay-callback`,
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req, Deno.env.get('EXTENSION_ID'))
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'invalid-request', message: 'Metode tidak didukung.' }, cors)

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const db = createDb(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
    const caller = userFromRequest(req)
    const body: unknown = await req.json().catch(() => null)
    const result = await handleCreatePayment(
      { userId: caller?.id ?? null, email: caller?.email ?? null, body },
      { db, tripay: readTripay(supabaseUrl), report: logFailure },
    )
    return reply(result.status, result.body, cors)
  } catch (error) {
    // A database error from createPurchase or attachTripay lands here by design: say nothing about it.
    logFailure('create-payment', error)
    return reply(500, { ok: false, error: 'gateway', message: 'Terjadi gangguan. Coba lagi sebentar.' }, cors)
  }
})
