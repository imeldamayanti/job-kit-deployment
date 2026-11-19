import { createDb } from '../../../src/server/db'
import { handleCreatePayment } from '../../../src/server/payments'
import type { MidtransEnv } from '../../../src/server/midtrans'
import { authenticate } from '../_shared/auth'
import { corsHeaders, logFailure, reply, requireEnv } from '../_shared/http'

function readMidtrans(): MidtransEnv {
  const mode = requireEnv('MIDTRANS_MODE')
  if (mode !== 'sandbox' && mode !== 'production') throw new Error('secret MIDTRANS_MODE must be sandbox or production')
  return { serverKey: requireEnv('MIDTRANS_SERVER_KEY'), mode }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req, Deno.env.get('EXTENSION_ID'))
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'invalid-request', message: 'Metode tidak didukung.' }, cors)

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const db = createDb(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
    const caller = await authenticate(req, { url: supabaseUrl, anonKey: requireEnv('SUPABASE_ANON_KEY') })
    const body: unknown = await req.json().catch(() => null)
    const result = await handleCreatePayment(
      { userId: caller?.id ?? null, email: caller?.email ?? null, body },
      { db, midtrans: readMidtrans(), report: logFailure },
    )
    return reply(result.status, result.body, cors)
  } catch (error) {
    // A database error from createPurchase or attachGateway lands here by design: say nothing about it.
    logFailure('create-payment', error)
    return reply(500, { ok: false, error: 'gateway', message: 'Terjadi gangguan. Coba lagi sebentar.' }, cors)
  }
})
