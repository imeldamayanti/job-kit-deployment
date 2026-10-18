import { describe, expect, it, vi } from 'vitest'
import type { Row } from './api'
import { decrypt, deriveKey, encrypt } from './crypto'
import { emptySyncState, runSync, type SyncPorts, type SyncState } from './engine'
import { KINDS, type Kind } from './merge'

const T1 = '2026-10-18T10:00:00.000Z'
const T2 = '2026-10-18T11:00:00.000Z'
const salt = new Uint8Array(16).fill(1)

type Fake = { local: Record<Kind, string>; rows: Map<string, Row>; written: Partial<Record<Kind, string>>; ports: SyncPorts; puts: string[] }

async function setup(init: { local?: Partial<Record<Kind, string>>; remote?: Partial<Record<Kind, { plain: string; at: string }>>; password?: string } = {}): Promise<Fake & { key: CryptoKey }> {
  const key = await deriveKey('pw', salt, 1000)
  const local = { profile: '', applications: '', cvs: '', letters: '', ...init.local } as Record<Kind, string>
  const rows = new Map<string, Row>()
  for (const [kind, r] of Object.entries(init.remote ?? {})) rows.set(kind, { kind, ciphertext: await encrypt(await deriveKey(init.password ?? 'pw', salt, 1000), r!.plain), updatedAt: r!.at })
  const written: Partial<Record<Kind, string>> = {}
  const puts: string[] = []
  const ports: SyncPorts = {
    listRows: async () => ({ ok: true, rows: [...rows.values()] }),
    putRow: async (kind, ciphertext, expectedAt) => {
      puts.push(kind)
      const current = rows.get(kind)
      if ((current?.updatedAt ?? null) !== expectedAt) return { ok: false, reason: 'conflict' }
      const updatedAt = T2
      rows.set(kind, { kind, ciphertext, updatedAt })
      return { ok: true, updatedAt }
    },
    read: async (kind) => ({ payload: local[kind], empty: local[kind] === '' }),
    write: async (kind, payload) => { written[kind] = payload; local[kind] = payload; return true },
    hash: async (text) => `h:${text}`,
  }
  return { local, rows, written, ports, puts, key }
}

describe('runSync', () => {
  it('pushes local data the server does not have, encrypted', async () => {
    const f = await setup({ local: { profile: '{"nama":"Siti"}' } })
    const result = await runSync({ ports: f.ports, key: f.key, state: emptySyncState(), now: T1, confirmOverwrite: false })
    expect(result.outcomes.profile).toBe('pushed')
    expect(f.puts).toEqual(['profile'])
    const row = f.rows.get('profile')!
    expect(row.ciphertext).not.toContain('Siti')
    expect(await decrypt(f.key, row.ciphertext)).toBe('{"nama":"Siti"}')
    expect(result.state.kinds.profile).toEqual({ hash: 'h:{"nama":"Siti"}', remoteAt: T2, changedAt: null })
  })

  it('pulls server data into an empty device without asking', async () => {
    const f = await setup({ remote: { profile: { plain: '{"nama":"Dewi"}', at: T1 } } })
    const result = await runSync({ ports: f.ports, key: f.key, state: emptySyncState(), now: T2, confirmOverwrite: false })
    expect(result.outcomes.profile).toBe('pulled')
    expect(f.written.profile).toBe('{"nama":"Dewi"}')
  })

  it('does nothing when nothing changed', async () => {
    const f = await setup({ local: { profile: 'a' }, remote: { profile: { plain: 'a', at: T1 } } })
    const state: SyncState = { kinds: { ...emptySyncState().kinds, profile: { hash: 'h:a', remoteAt: T1, changedAt: null } } }
    const result = await runSync({ ports: f.ports, key: f.key, state, now: T2, confirmOverwrite: false })
    expect(result.outcomes.profile).toBe('same')
    expect(f.puts).toEqual([])
  })

  it('does not overwrite local work without a yes: reports it needs confirmation and writes nothing', async () => {
    const f = await setup({ local: { profile: 'lokal' }, remote: { profile: { plain: 'jauh', at: T1 } } })
    const result = await runSync({ ports: f.ports, key: f.key, state: emptySyncState(), now: T2, confirmOverwrite: false })
    expect(result.outcomes.profile).toBe('needs-confirm')
    expect(f.written.profile).toBeUndefined()
    expect(f.local.profile).toBe('lokal')
    expect(result.state.kinds.profile.hash).toBeNull()
  })

  it('overwrites after the yes', async () => {
    const f = await setup({ local: { profile: 'lokal' }, remote: { profile: { plain: 'jauh', at: T1 } } })
    const result = await runSync({ ports: f.ports, key: f.key, state: emptySyncState(), now: T2, confirmOverwrite: true })
    expect(result.outcomes.profile).toBe('pulled')
    expect(f.local.profile).toBe('jauh')
  })

  it('stops with wrong-key and changes nothing when the server data does not open', async () => {
    const f = await setup({ remote: { profile: { plain: 'x', at: T1 } }, password: 'lain' })
    const result = await runSync({ ports: f.ports, key: f.key, state: emptySyncState(), now: T2, confirmOverwrite: false })
    expect(result.outcomes.profile).toBe('wrong-key')
    expect(f.written.profile).toBeUndefined()
  })

  it('reports a conflict when another device wrote first, and keeps the old state for the next try', async () => {
    const f = await setup({ local: { profile: 'baru' }, remote: { profile: { plain: 'lama', at: T1 } } })
    const state: SyncState = { kinds: { ...emptySyncState().kinds, profile: { hash: 'h:lama', remoteAt: T1, changedAt: null } } }
    f.ports.putRow = vi.fn().mockResolvedValue({ ok: false, reason: 'conflict' })
    const result = await runSync({ ports: f.ports, key: f.key, state, now: T2, confirmOverwrite: false })
    expect(result.outcomes.profile).toBe('conflict')
    expect(result.state.kinds.profile).toEqual({ ...state.kinds.profile, changedAt: T2 })
  })

  it('syncs kinds independently: one failing does not block the others', async () => {
    const f = await setup({ local: { profile: 'p', applications: 'a' } })
    const real = f.ports.putRow
    f.ports.putRow = async (kind, c, e) => (kind === 'profile' ? { ok: false, reason: 'server' } : real(kind, c, e))
    const result = await runSync({ ports: f.ports, key: f.key, state: emptySyncState(), now: T1, confirmOverwrite: false })
    expect(result.outcomes.profile).toBe('failed')
    expect(result.outcomes.applications).toBe('pushed')
  })

  it('stops everything when the session is gone', async () => {
    const f = await setup({ local: { profile: 'p' } })
    f.ports.listRows = async () => ({ ok: false, reason: 'signed-out' })
    const result = await runSync({ ports: f.ports, key: f.key, state: emptySyncState(), now: T1, confirmOverwrite: false })
    expect(result.error).toBe('signed-out')
    expect(Object.keys(result.outcomes)).toEqual([])
  })

  it('walks all four kinds and no other', async () => {
    const f = await setup()
    const result = await runSync({ ports: f.ports, key: f.key, state: emptySyncState(), now: T1, confirmOverwrite: false })
    expect(Object.keys(result.outcomes)).toEqual([...KINDS])
  })
})
