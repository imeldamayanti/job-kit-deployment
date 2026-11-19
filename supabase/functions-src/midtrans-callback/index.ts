import { createDb } from '../../../src/server/db'
import { handleCallback } from '../../../src/server/payments'
import { logFailure, reply, requireEnv } from '../_shared/http'

// Called by Midtrans's servers, not by the extension: no CORS, and `verify_jwt = false` in supabase/config.toml. The signature_key in the body is the only credential.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { success: false, message: 'Method not allowed' })

  try {
    const db = createDb(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
    // The raw text goes to the handler, which parses it and checks the signature_key before touching the database.
    const rawBody = await req.text()
    const result = await handleCallback({ rawBody }, { db, serverKey: requireEnv('MIDTRANS_SERVER_KEY'), report: logFailure })
    return reply(result.status, result.body)
  } catch (error) {
    // A 5xx makes Midtrans deliver again.
    logFailure('midtrans-callback', error)
    return reply(500, { success: false, message: 'Try again' })
  }
})
