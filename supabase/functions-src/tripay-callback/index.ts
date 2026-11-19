import { createDb } from '../../../src/server/db'
import { handleCallback } from '../../../src/server/payments'
import { logFailure, reply, requireEnv } from '../_shared/http'

// Called by Tripay's servers, not by the extension: no CORS, and `verify_jwt = false` in supabase/config.toml. The signature is the only credential.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { success: false, message: 'Method not allowed' })

  try {
    const db = createDb(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
    // The RAW text: the signature covers exactly these bytes, so it must reach the handler unparsed.
    const rawBody = await req.text()
    const result = await handleCallback(
      { rawBody, signature: req.headers.get('X-Callback-Signature'), event: req.headers.get('X-Callback-Event') },
      { db, privateKey: requireEnv('TRIPAY_PRIVATE_KEY'), report: logFailure },
    )
    return reply(result.status, result.body)
  } catch (error) {
    // A 5xx makes Tripay deliver again.
    logFailure('tripay-callback', error)
    return reply(500, { success: false, message: 'Try again' })
  }
})
