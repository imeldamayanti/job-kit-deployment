// One sync run (RFC D17): read the server rows, decide per kind (merge.ts), then push or pull. Ports keep it free of browser APIs.
import type { ApiFailure, Row } from './api'
import { decrypt, encrypt, SyncCryptoError } from './crypto'
import { KINDS, planKind, type Kind } from './merge'

export type KindState = { hash: string | null; remoteAt: string | null; changedAt: string | null }
export type SyncState = { kinds: Record<Kind, KindState> }
export const emptySyncState = (): SyncState => ({
  kinds: Object.fromEntries(KINDS.map((k) => [k, { hash: null, remoteAt: null, changedAt: null }])) as Record<Kind, KindState>,
})

export type SyncPorts = {
  listRows: () => Promise<{ ok: true; rows: Row[] } | { ok: false; reason: ApiFailure }>
  putRow: (kind: Kind, ciphertext: string, expectedAt: string | null) => Promise<{ ok: true; updatedAt: string } | { ok: false; reason: ApiFailure }>
  // The kind's data as one JSON string, and whether it holds anything worth sending.
  read: (kind: Kind) => Promise<{ payload: string; empty: boolean }>
  write: (kind: Kind, payload: string) => Promise<boolean>
  hash: (text: string) => Promise<string>
}

export type Outcome = 'pushed' | 'pulled' | 'same' | 'needs-confirm' | 'conflict' | 'wrong-key' | 'failed'
export type SyncResult = { outcomes: Partial<Record<Kind, Outcome>>; state: SyncState; error?: ApiFailure }

type Options = { ports: SyncPorts; key: CryptoKey; state: SyncState; now: string; confirmOverwrite: boolean }

export async function runSync({ ports, key, state, now, confirmOverwrite }: Options): Promise<SyncResult> {
  const listed = await ports.listRows()
  if (!listed.ok) return { outcomes: {}, state, error: listed.reason }
  const remote = new Map(listed.rows.map((row) => [row.kind, row]))
  const next: SyncState = { kinds: { ...state.kinds } }
  const outcomes: Partial<Record<Kind, Outcome>> = {}

  for (const kind of KINDS) {
    const before = state.kinds[kind]
    const local = await ports.read(kind)
    const localHash = await ports.hash(local.payload)
    const row = remote.get(kind) ?? null
    // First time this device sees the data differ from the last sync: remember when (a sync run is the clock we have).
    // A device that never synced has no "last sync", so it cannot claim its data is newer than the server's.
    const changedAt = localHash === before.hash ? null : before.hash === null ? null : (before.changedAt ?? now)
    const plan = planKind({ localHash, lastSyncedHash: before.hash, localEmpty: local.empty, remoteAt: row?.updatedAt ?? null, lastRemoteAt: before.remoteAt, localChangedAt: changedAt })

    if (plan.action === 'none') {
      outcomes[kind] = 'same'
      next.kinds[kind] = { hash: localHash, remoteAt: row?.updatedAt ?? null, changedAt: null }
      continue
    }

    if (plan.action === 'push') {
      const put = await ports.putRow(kind, await encrypt(key, local.payload), row?.updatedAt ?? null)
      if (!put.ok) {
        outcomes[kind] = put.reason === 'conflict' ? 'conflict' : 'failed'
        next.kinds[kind] = { ...before, changedAt }
        continue
      }
      outcomes[kind] = 'pushed'
      next.kinds[kind] = { hash: localHash, remoteAt: put.updatedAt, changedAt: null }
      continue
    }

    if (plan.overwritesLocal && !confirmOverwrite) {
      outcomes[kind] = 'needs-confirm'
      next.kinds[kind] = { ...before, changedAt }
      continue
    }
    let plain: string
    try {
      plain = await decrypt(key, row!.ciphertext)
    } catch (error) {
      outcomes[kind] = error instanceof SyncCryptoError && error.reason === 'wrong-key' ? 'wrong-key' : 'failed'
      next.kinds[kind] = { ...before, changedAt }
      continue
    }
    if (!(await ports.write(kind, plain))) {
      outcomes[kind] = 'failed'
      next.kinds[kind] = { ...before, changedAt }
      continue
    }
    outcomes[kind] = 'pulled'
    next.kinds[kind] = { hash: await ports.hash(plain), remoteAt: row!.updatedAt, changedAt: null }
  }
  return { outcomes, state: next }
}
