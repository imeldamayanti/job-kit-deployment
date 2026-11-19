import { storage } from 'wxt/utils/storage'
import type { AccountStatus } from '../core/account/access'
import type { CreatePaymentResponse, GenerateRequest, GenerateResponse } from '../core/generate/protocol'
import type { Session } from '../core/sync/api'
import { SUPABASE_CONFIG } from '../core/sync/config'
import { currentSession } from './sync'

// The extension's side of the paid-AI account (spec §5): the credit status, the generate and payment calls, the purchase
// and ledger reads. Plain fetch like platform/sync.ts. Nothing here throws: a failure is a value the UI can show.
const cfg = SUPABASE_CONFIG
const base = cfg.url.replace(/\/$/, '')
const statusItem = storage.defineItem<AccountStatus | null>('local:accountStatus', { fallback: null })

const headers = (session: Session): Record<string, string> => ({
  'Content-Type': 'application/json', apikey: cfg.key, Authorization: `Bearer ${session.accessToken}`,
})

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

// The JSON body whatever the HTTP status (the Edge Functions put their refusals in the body), or null when the
// network fails or the body is not JSON.
async function send(url: string, init: RequestInit): Promise<{ ok: boolean; body: unknown } | null> {
  try {
    const response = await fetch(url, init)
    return { ok: response.ok, body: await response.json() }
  } catch {
    return null
  }
}

// Rows of a PostgREST select with the person's own token (row-level security keeps it to their rows), or null on any failure.
async function select(session: Session, path: string): Promise<unknown[] | null> {
  const result = await send(`${base}/rest/v1/${path}`, { method: 'GET', headers: headers(session) })
  return result?.ok && Array.isArray(result.body) ? result.body : null
}

export const loadAccountStatus = (): Promise<AccountStatus | null> => statusItem.getValue()

function toStatus(row: unknown, now: Date): AccountStatus | null {
  if (!isRecord(row) || typeof row.credits !== 'number') return null
  return {
    credits: row.credits,
    paid: typeof row.unlocked_at === 'string',
    trialGranted: typeof row.trial_granted_at === 'string',
    expiresAt: typeof row.credits_expire_at === 'string' ? row.credits_expire_at : null,
    checkedAt: now.toISOString(),
  }
}

// Makes sure the account exists (the first call gives the trial credits, once), then reads it. Offline or on any failure the
// cached status stays. Signed out, the cache is dropped so the next person on this browser does not see it.
export async function refreshAccountStatus(): Promise<AccountStatus | null> {
  const session = await currentSession()
  if (!session) {
    await statusItem.setValue(null)
    return null
  }
  const ensured = await send(`${base}/rest/v1/rpc/ensure_account`, { method: 'POST', headers: headers(session), body: '{}' })
  if (!ensured?.ok) return loadAccountStatus()
  const rows = await select(session, 'accounts?select=credits,unlocked_at,trial_granted_at,credits_expire_at')
  const status = rows ? toStatus(rows[0], new Date()) : null
  if (!status) return loadAccountStatus()
  await statusItem.setValue(status)
  return status
}

const refusal = (error: 'unauthenticated' | 'ai', message: string): GenerateResponse => ({ ok: false, error, message, credits: null })
const isGenerateResponse = (body: unknown): body is GenerateResponse => isRecord(body) && typeof body.ok === 'boolean'

export async function callGenerate(request: GenerateRequest): Promise<GenerateResponse> {
  const session = await currentSession()
  if (!session) return refusal('unauthenticated', 'Masuk dulu untuk memakai AI.')
  const result = await send(`${base}/functions/v1/generate`, { method: 'POST', headers: headers(session), body: JSON.stringify(request) })
  if (!result) return refusal('ai', 'Tidak bisa menghubungi server. Coba lagi.')
  return isGenerateResponse(result.body) ? result.body : refusal('ai', 'Jawaban server tidak terbaca. Coba lagi.')
}

export async function createPayment(): Promise<CreatePaymentResponse> {
  const session = await currentSession()
  if (!session) return { ok: false, error: 'unauthenticated', message: 'Masuk dulu untuk membeli kredit.' }
  const result = await send(`${base}/functions/v1/create-payment`, { method: 'POST', headers: headers(session), body: '{}' })
  if (!result) return { ok: false, error: 'gateway', message: 'Tidak bisa menghubungi server. Coba lagi.' }
  if (isRecord(result.body) && typeof result.body.ok === 'boolean') return result.body as CreatePaymentResponse
  return { ok: false, error: 'gateway', message: 'Jawaban server tidak terbaca. Coba lagi.' }
}

export type PurchaseStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'mismatch'
const PURCHASE_STATUSES: readonly string[] = ['pending', 'paid', 'expired', 'failed', 'mismatch']

// Where a payment stands. When it cannot be read (no session, offline, row not there yet) it counts as still pending,
// so the caller just asks again.
export async function purchaseStatus(id: string): Promise<PurchaseStatus> {
  const session = await currentSession()
  if (!session) return 'pending'
  const rows = await select(session, `purchases?select=status&id=eq.${encodeURIComponent(id)}`)
  const status = isRecord(rows?.[0]) ? rows[0].status : null
  return typeof status === 'string' && PURCHASE_STATUSES.includes(status) ? (status as PurchaseStatus) : 'pending'
}

export type LedgerEntry = { at: string; delta: number; reason: string }

export async function loadLedger(limit = 20): Promise<LedgerEntry[]> {
  const session = await currentSession()
  if (!session) return []
  const rows = await select(session, `credit_ledger?select=created_at,delta,reason&order=created_at.desc,id.desc&limit=${Math.floor(limit)}`)
  if (!rows) return []
  return rows.flatMap((row) =>
    isRecord(row) && typeof row.created_at === 'string' && typeof row.delta === 'number' && typeof row.reason === 'string'
      ? [{ at: row.created_at, delta: row.delta, reason: row.reason }]
      : [],
  )
}
