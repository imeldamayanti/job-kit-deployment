import { describe, expect, it } from 'vitest'
import { KINDS, planKind, type KindInput } from './merge'

const T1 = '2026-10-18T10:00:00.000Z'
const T2 = '2026-10-18T11:00:00.000Z'
const T3 = '2026-10-18T12:00:00.000Z'

const base = (change: Partial<KindInput> = {}): KindInput => ({
  localHash: 'h1', localEmpty: false, lastSyncedHash: 'h1', lastRemoteAt: T1, remoteAt: T1, localChangedAt: null, ...change,
})

describe('sync kinds', () => {
  it('syncs exactly profile, applications, cvs and letters, never keys or the feed', () => {
    expect(KINDS).toEqual(['profile', 'applications', 'cvs', 'letters'])
  })
})

describe('planKind', () => {
  it('does nothing when neither side changed', () => {
    expect(planKind(base())).toEqual({ action: 'none', overwritesLocal: false })
  })

  it('pushes a local change when the server has not moved', () => {
    expect(planKind(base({ localHash: 'h2' }))).toEqual({ action: 'push', overwritesLocal: false })
  })

  it('pulls a remote change when local has not moved, without asking', () => {
    expect(planKind(base({ remoteAt: T2 }))).toEqual({ action: 'pull', overwritesLocal: false })
  })

  it('pushes first-ever data when the server has nothing', () => {
    expect(planKind(base({ remoteAt: null, lastRemoteAt: null, lastSyncedHash: null }))).toEqual({ action: 'push', overwritesLocal: false })
  })

  it('does not push empty local data to an empty server', () => {
    expect(planKind(base({ remoteAt: null, lastRemoteAt: null, lastSyncedHash: null, localEmpty: true }))).toEqual({ action: 'none', overwritesLocal: false })
  })

  it('never pushes an emptied device over data the server has (Hapus semua must not wipe the cloud)', () => {
    expect(planKind(base({ localHash: 'kosong', localEmpty: true }))).toEqual({ action: 'none', overwritesLocal: false })
  })

  it('both changed: the later change wins, local later pushes', () => {
    expect(planKind(base({ localHash: 'h2', remoteAt: T2, localChangedAt: T3 }))).toEqual({ action: 'push', overwritesLocal: false })
  })

  it('both changed: remote later pulls and warns it overwrites local work', () => {
    expect(planKind(base({ localHash: 'h2', remoteAt: T3, localChangedAt: T2 }))).toEqual({ action: 'pull', overwritesLocal: true })
  })

  it('both changed with no known local time: pulls but warns, so nothing is lost silently', () => {
    expect(planKind(base({ localHash: 'h2', remoteAt: T2, localChangedAt: null }))).toEqual({ action: 'pull', overwritesLocal: true })
  })

  it('a new device with data on both sides asks before overwriting', () => {
    expect(planKind(base({ lastSyncedHash: null, lastRemoteAt: null, remoteAt: T2 }))).toEqual({ action: 'pull', overwritesLocal: true })
  })

  it('a new device with nothing local pulls without asking', () => {
    expect(planKind(base({ lastSyncedHash: null, lastRemoteAt: null, remoteAt: T2, localEmpty: true }))).toEqual({ action: 'pull', overwritesLocal: false })
  })
})
