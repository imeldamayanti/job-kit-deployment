import { storage } from 'wxt/utils/storage'
import { createEmptyProfile } from '../core/profile/profile'
import { migrateProfile } from '../core/profile/migrate'
import { deleteAccount, isConfigured, listRows, putRow, refreshSession, sendOtp, signOut, verifyOtp, type ApiFailure, type Session } from '../core/sync/api'
import { SUPABASE_CONFIG } from '../core/sync/config'
import { deriveKey, exportKey, importKey, makeCheck, newSalt, saltFromText, saltToText, verifyCheck } from '../core/sync/crypto'
import { emptySyncState, runSync, type SyncPorts, type SyncResult, type SyncState } from '../core/sync/engine'
import type { Kind } from '../core/sync/merge'
import { loadApplicationData, saveApplications, saveCvs, saveLetters } from './application-storage'
import { requestOrigins } from './permissions'
import { loadProfile, saveProfile } from './storage'

// Sync is off until the person turns it on. The session lives in local storage; the derived key only in session storage
// (gone when the browser closes), so the sync password itself is never kept (PRD §4.3).
const sessionItem = storage.defineItem<Session | null>('local:syncSession', { fallback: null })
const stateItem = storage.defineItem<SyncState>('local:syncState', { fallback: emptySyncState() })
const lastItem = storage.defineItem<string | null>('local:syncLastAt', { fallback: null })
const keyItem = storage.defineItem<string | null>('session:syncKey', { fallback: null })

const cfg = SUPABASE_CONFIG
export const syncConfigured = (): boolean => isConfigured(cfg)
export const supabaseOrigin = (): string[] => (syncConfigured() ? [`${new URL(cfg.url).origin}/*`] : [])

export type Account = { configured: boolean; email: string | null; unlocked: boolean; lastSyncAt: string | null }

export async function loadAccount(): Promise<Account> {
  const [session, key, last] = await Promise.all([sessionItem.getValue(), keyItem.getValue(), lastItem.getValue()])
  return { configured: syncConfigured(), email: session?.email ?? null, unlocked: session !== null && key !== null, lastSyncAt: last }
}

// Must start inside a click, before any await (it asks Chrome for the Supabase host).
export const allowServer = (): Promise<boolean> => requestOrigins(supabaseOrigin())

export const startLogin = (email: string) => sendOtp(cfg, email.trim())

export async function finishLogin(email: string, code: string): Promise<{ ok: true } | { ok: false; reason: ApiFailure }> {
  const result = await verifyOtp(cfg, email.trim(), code.trim())
  if (!result.ok) return result
  await sessionItem.setValue(result.session)
  return { ok: true }
}

// A fresh access token, or null when the person has to sign in again.
async function liveSession(): Promise<Session | null> {
  const session = await sessionItem.getValue()
  if (!session) return null
  if (session.expiresAt - 60 > Math.floor(Date.now() / 1000)) return session
  const refreshed = await refreshSession(cfg, session.refreshToken)
  if (!refreshed.ok) {
    if (refreshed.reason === 'rejected' || refreshed.reason === 'signed-out') await sessionItem.setValue(null)
    return null
  }
  await sessionItem.setValue(refreshed.session)
  return refreshed.session
}

export type UnlockResult = { ok: true; created: boolean } | { ok: false; reason: 'signed-out' | 'wrong-password' | 'failed' }

// First time: the password makes a new salt and a check value, stored (public by design) in the 'meta' row.
// Later or on another device: the stored salt and check decide whether the password is right, before any data moves.
export async function unlock(password: string): Promise<UnlockResult> {
  const session = await liveSession()
  if (!session) return { ok: false, reason: 'signed-out' }
  const listed = await listRows(cfg, session)
  if (!listed.ok) return { ok: false, reason: listed.reason === 'signed-out' ? 'signed-out' : 'failed' }
  const meta = listed.rows.find((row) => row.kind === 'meta')
  if (meta) {
    let parsed: { salt: string; check: string }
    try {
      parsed = JSON.parse(meta.ciphertext)
    } catch {
      return { ok: false, reason: 'failed' }
    }
    const key = await deriveKey(password, saltFromText(parsed.salt))
    if (!(await verifyCheck(key, parsed.check))) return { ok: false, reason: 'wrong-password' }
    await keyItem.setValue(await exportKey(key))
    return { ok: true, created: false }
  }
  const salt = newSalt()
  const key = await deriveKey(password, salt)
  const put = await putRow(cfg, session, 'meta', JSON.stringify({ salt: saltToText(salt), check: await makeCheck(key) }), null)
  if (!put.ok) return { ok: false, reason: 'failed' }
  await keyItem.setValue(await exportKey(key))
  return { ok: true, created: true }
}

export const lock = (): Promise<void> => keyItem.setValue(null)

async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const emptyProfileJson = JSON.stringify(createEmptyProfile())

async function read(kind: Kind): Promise<{ payload: string; empty: boolean }> {
  if (kind === 'profile') {
    const payload = JSON.stringify(await loadProfile())
    return { payload, empty: payload === emptyProfileJson }
  }
  const data = await loadApplicationData()
  const list = kind === 'applications' ? data.applications : kind === 'cvs' ? data.cvs : data.letters
  return { payload: JSON.stringify(list), empty: list.length === 0 }
}

async function write(kind: Kind, payload: string): Promise<boolean> {
  let value: unknown
  try {
    value = JSON.parse(payload)
  } catch {
    return false
  }
  if (kind === 'profile') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    return (await saveProfile(migrateProfile(value as Parameters<typeof migrateProfile>[0]))).ok
  }
  if (!Array.isArray(value)) return false
  const saved = kind === 'applications' ? await saveApplications(value) : kind === 'cvs' ? await saveCvs(value) : await saveLetters(value)
  return saved.ok
}

export type SyncReport = SyncResult | { error: 'locked' | 'unavailable' | 'signed-out'; outcomes: Record<string, never> }

export async function syncNow({ confirmOverwrite = false }: { confirmOverwrite?: boolean } = {}): Promise<SyncReport> {
  if (!syncConfigured()) return { error: 'unavailable', outcomes: {} }
  const [session, keyText] = await Promise.all([liveSession(), keyItem.getValue()])
  if (!session) return { error: 'signed-out', outcomes: {} }
  if (!keyText) return { error: 'locked', outcomes: {} }
  const ports: SyncPorts = {
    listRows: () => listRows(cfg, session),
    putRow: (kind, ciphertext, expectedAt) => putRow(cfg, session, kind, ciphertext, expectedAt),
    read, write, hash: sha256,
  }
  const result = await runSync({ ports, key: await importKey(keyText), state: await stateItem.getValue(), now: new Date().toISOString(), confirmOverwrite })
  await stateItem.setValue(result.state)
  if (!result.error) await lastItem.setValue(new Date().toISOString())
  return result
}

// Turns sync off on this device only: the server copy stays. The person can sign back in later.
export async function signOutDevice(): Promise<void> {
  const session = await sessionItem.getValue()
  if (session) await signOut(cfg, session)
  await Promise.all([sessionItem.setValue(null), keyItem.setValue(null), stateItem.setValue(emptySyncState()), lastItem.setValue(null)])
}

// "Hapus akun": the account and every server row go; this device's own data stays. Only a confirmed server answer counts.
export async function deleteMyAccount(): Promise<{ ok: true } | { ok: false; reason: ApiFailure }> {
  const session = await liveSession()
  if (!session) return { ok: false, reason: 'signed-out' }
  const result = await deleteAccount(cfg, session)
  if (!result.ok) return result
  await Promise.all([sessionItem.setValue(null), keyItem.setValue(null), stateItem.setValue(emptySyncState()), lastItem.setValue(null)])
  return { ok: true }
}
