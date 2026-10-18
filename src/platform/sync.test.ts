import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { createEmptyProfile, setPersonalField } from '../core/profile/profile'

vi.mock('../core/sync/config', () => ({ SUPABASE_CONFIG: { url: 'https://abc.supabase.co', key: 'sb_publishable_test' } }))
vi.mock('../core/sync/crypto', async (original) => {
  const real = await original<typeof import('../core/sync/crypto')>()
  // Fewer iterations: the test is about the flow, not the cost of PBKDF2.
  return { ...real, deriveKey: (password: string, salt: Uint8Array) => real.deriveKey(password, salt, 1000) }
})

import { deleteMyAccount, finishLogin, loadAccount, lock, signOutDevice, syncNow, unlock } from './sync'
import { loadProfile, saveProfile } from './storage'
import { loadApplicationData } from './application-storage'

type Row = { kind: string; ciphertext: string; updated_at: string }
let rows: Row[] = []
let clock = 0
let deleted = false

// A tiny Supabase: the auth verify call, user_data GET/POST/PATCH, and the delete_account function.
function fakeServer(): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input)
    const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body }) as Response
    if (url.endsWith('/auth/v1/verify')) return reply({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, user: { id: 'u1', email: 'a@b.co' } })
    if (url.endsWith('/rpc/delete_account')) { rows = []; deleted = true; return reply(null, 204) }
    const method = init.method ?? 'GET'
    if (method === 'GET') return reply(rows)
    const body = JSON.parse(String(init.body))
    if (method === 'POST') {
      if (rows.some((r) => r.kind === body.kind)) return reply({}, 409)
      const row = { ...body, updated_at: `2026-10-18T10:00:0${++clock}.000Z` }
      rows.push(row)
      return reply([row], 201)
    }
    const params = new URL(url).searchParams
    const row = rows.find((r) => r.kind === params.get('kind')?.replace('eq.', '') && r.updated_at === params.get('updated_at')?.replace('eq.', ''))
    if (!row) return reply([])
    row.ciphertext = body.ciphertext
    row.updated_at = `2026-10-18T10:00:0${++clock}.000Z`
    return reply([row])
  }) as typeof fetch
}

async function signIn(password = 'sandi-sinkron') {
  expect((await finishLogin('a@b.co', '123456')).ok).toBe(true)
  return unlock(password)
}

beforeEach(() => {
  fakeBrowser.reset()
  rows = []
  clock = 0
  deleted = false
  vi.stubGlobal('fetch', fakeServer())
})

describe('sync across two devices', () => {
  it('device A pushes, device B signs in with the same password and receives the profile', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    expect(await signIn()).toEqual({ ok: true, created: true })
    const first = await syncNow()
    expect(first.outcomes.profile).toBe('pushed')
    expect(JSON.stringify(rows)).not.toContain('Siti')

    fakeBrowser.reset() // a different browser: empty local data, nothing remembered
    expect(await signIn()).toEqual({ ok: true, created: false })
    const second = await syncNow()
    expect(second.outcomes.profile).toBe('pulled')
    expect((await loadProfile()).personal.firstName).toBe('Siti')
  })

  it('refuses a wrong sync password before any data moves', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    await signIn()
    await syncNow()
    fakeBrowser.reset()
    expect(await signIn('salah')).toEqual({ ok: false, reason: 'wrong-password' })
    expect((await syncNow()).error).toBe('locked')
    expect((await loadProfile()).personal.firstName).toBe('')
  })

  it('does not sync without a password: locked, and nothing is sent', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    await finishLogin('a@b.co', '123456')
    expect((await syncNow()).error).toBe('locked')
    expect(rows).toEqual([])
  })

  it('locking forgets the key, so the next sync asks for the password again', async () => {
    await signIn()
    expect((await loadAccount()).unlocked).toBe(true)
    await lock()
    expect((await loadAccount()).unlocked).toBe(false)
    expect((await syncNow()).error).toBe('locked')
  })

  it('a second sync with no change sends nothing', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    await signIn()
    await syncNow()
    const before = JSON.stringify(rows)
    const again = await syncNow()
    expect(again.outcomes.profile).toBe('same')
    expect(JSON.stringify(rows)).toBe(before)
  })

  it('never uploads the AI key, the feed, or the usage counter', async () => {
    await fakeBrowser.storage.local.set({ 'aiKey': 'sk-rahasia', feed: [{ id: 'j1' }], aiUsage: { date: 'x', documents: 3 } })
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    await signIn()
    await syncNow()
    const sent = JSON.stringify(rows)
    expect(sent).not.toContain('sk-rahasia')
    expect(rows.map((r) => r.kind).sort()).toEqual(['meta', 'profile'])
  })

  it('signing out of this device keeps the server copy and local data', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    await signIn()
    await syncNow()
    await signOutDevice()
    expect((await loadAccount()).email).toBeNull()
    expect(rows.length).toBe(2)
    expect((await loadProfile()).personal.firstName).toBe('Siti')
    expect((await loadApplicationData()).applications).toEqual([])
  })

  it('deleting the account empties the server, and keeps what is on this device', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Siti'))
    await signIn()
    await syncNow()
    expect(await deleteMyAccount()).toEqual({ ok: true })
    expect(deleted).toBe(true)
    expect(rows).toEqual([])
    expect((await loadAccount()).email).toBeNull()
    expect((await loadProfile()).personal.firstName).toBe('Siti')
  })

  it('does not claim the account is gone when the server refuses', async () => {
    await signIn()
    vi.stubGlobal('fetch', (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch)
    expect(await deleteMyAccount()).toEqual({ ok: false, reason: 'server' })
    expect((await loadAccount()).email).toBe('a@b.co')
  })
})
