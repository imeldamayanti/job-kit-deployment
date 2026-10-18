// Which way each kind of data moves on a sync (PRD §4.3): newest `updated_at` wins, per kind.
// Pure: the platform gathers the hashes and times, this only decides.

export const KINDS = ['profile', 'applications', 'cvs', 'letters'] as const
export type Kind = (typeof KINDS)[number]

export type KindInput = {
  // Hash of what is stored here now, and what it was at the last successful sync of this kind.
  localHash: string
  lastSyncedHash: string | null
  // Nothing worth sending: an empty profile, no applications.
  localEmpty: boolean
  // `updated_at` of the server row now (null: no row), and as of the last sync.
  remoteAt: string | null
  lastRemoteAt: string | null
  // When this device last saw the data change; null if unknown.
  localChangedAt: string | null
}

export type Plan = { action: 'none' | 'push' | 'pull'; overwritesLocal: boolean }

const time = (iso: string | null): number => (iso === null ? Number.NaN : Date.parse(iso))

export function planKind(input: KindInput): Plan {
  const { localHash, lastSyncedHash, localEmpty, remoteAt, lastRemoteAt, localChangedAt } = input
  if (remoteAt === null) return { action: localEmpty ? 'none' : 'push', overwritesLocal: false }

  const localChanged = localHash !== lastSyncedHash
  const remoteChanged = remoteAt !== lastRemoteAt
  // An emptied device never wipes the server: deleting data online is "Hapus akun", not a side effect of syncing.
  if (!remoteChanged) return { action: localChanged && !localEmpty ? 'push' : 'none', overwritesLocal: false }
  if (!localChanged || localEmpty) return { action: 'pull', overwritesLocal: false }

  // Both moved. The later one wins; if this device cannot say when it changed, keep the server's but warn first.
  const local = time(localChangedAt)
  if (!Number.isNaN(local) && local > time(remoteAt)) return { action: 'push', overwritesLocal: false }
  return { action: 'pull', overwritesLocal: true }
}
