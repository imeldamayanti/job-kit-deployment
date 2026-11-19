import { describe, expect, it } from 'vitest'
import { createEmptyProfile } from '../profile/profile'
import { cvAvailability, countDocument, DEFAULT_DOCUMENT_LIMIT, documentsToday, localDay, type CvAvailabilityInput } from './limits'
import { SAMPLE_WEB_DEV } from './sample-profiles'

const NOW = new Date(2026, 9, 15, 14, 30) // 15 Oct 2026, local time

const base = (): CvAvailabilityInput => ({
  key: 'k-test', aiProblem: null, usage: { date: '2026-10-15', documents: 0 }, now: NOW, limit: 20, jobText: 'Kami mencari engineer React.', profile: SAMPLE_WEB_DEV,
})

describe('daily usage (FR-46)', () => {
  it('defaults to 20 documents a day', () => {
    expect(DEFAULT_DOCUMENT_LIMIT).toBe(20)
  })

  it('names the local calendar day, not the UTC one', () => {
    expect(localDay(new Date(2026, 9, 15, 0, 5))).toBe('2026-10-15')
    expect(localDay(new Date(2026, 9, 15, 23, 55))).toBe('2026-10-15')
  })

  it('counts documents made today', () => {
    expect(documentsToday({ date: '2026-10-15', documents: 3 }, NOW)).toBe(3)
  })

  it('starts again at midnight: yesterday does not count', () => {
    expect(documentsToday({ date: '2026-10-14', documents: 20 }, NOW)).toBe(0)
  })

  it('adds one for today, and starts a new day at one', () => {
    expect(countDocument({ date: '2026-10-15', documents: 3 }, NOW)).toEqual({ date: '2026-10-15', documents: 4 })
    expect(countDocument({ date: '2026-10-14', documents: 20 }, NOW)).toEqual({ date: '2026-10-15', documents: 1 })
  })
})

describe('cvAvailability (FR-46, PRD §8)', () => {
  it('is off with its own reason when the build has no AI (shared build)', () => {
    expect(cvAvailability({ ...base(), aiEnabled: false })).toEqual({ ok: false, reason: 'ai-unavailable', message: 'Fitur AI belum tersedia di versi ini.', link: 'none' })
  })

  it('stays off in a build without AI even with a key and nothing else wrong', () => {
    expect(cvAvailability({ ...base(), key: 'k-ok', aiEnabled: false }).ok).toBe(false)
  })

  it('is on by default when aiEnabled is not given', () => {
    expect(cvAvailability(base())).toEqual({ ok: true })
  })

  it('is available with a key, text, experience and room left', () => {
    expect(cvAvailability(base())).toEqual({ ok: true })
  })

  it('is off without experience, pointing to the Profile', () => {
    expect(cvAvailability({ ...base(), profile: createEmptyProfile() })).toEqual({ ok: false, reason: 'no-experience', message: 'Isi Work Experience dulu.', link: 'profile' })
  })

  it('is off without the posting text', () => {
    expect(cvAvailability({ ...base(), jobText: '   ' })).toMatchObject({ ok: false, reason: 'no-text', link: 'description' })
  })

  it('is off without a key, pointing to the job settings', () => {
    expect(cvAvailability({ ...base(), key: '  ' })).toEqual({ ok: false, reason: 'no-key', message: 'Kunci API belum diisi. Isi di Atur Lowongan.', link: 'settings' })
  })

  it('is off when the provider rejected the key or the quota is gone', () => {
    expect(cvAvailability({ ...base(), aiProblem: 'invalid-key' })).toMatchObject({ ok: false, reason: 'invalid-key', link: 'settings' })
    expect(cvAvailability({ ...base(), aiProblem: 'quota' })).toMatchObject({ ok: false, reason: 'quota', link: 'settings' })
    expect(cvAvailability({ ...base(), aiProblem: 'no-permission' })).toMatchObject({ ok: false, reason: 'no-permission', link: 'settings' })
  })

  it('stays on after a problem that may pass: network, server, bad output', () => {
    for (const problem of ['network', 'server', 'invalid-output', 'bad-request'] as const) {
      expect(cvAvailability({ ...base(), aiProblem: problem })).toEqual({ ok: true })
    }
  })

  it('is off at the daily limit and says the limit and the reset', () => {
    const result = cvAvailability({ ...base(), usage: { date: '2026-10-15', documents: 20 } })
    expect(result).toEqual({ ok: false, reason: 'daily-limit', message: 'Batas 20 panggilan AI hari ini tercapai. Batas kembali tengah malam.', link: 'settings' })
  })

  it('follows the limit the person set, and is on again the next day', () => {
    expect(cvAvailability({ ...base(), limit: 5, usage: { date: '2026-10-15', documents: 5 } })).toMatchObject({ ok: false, reason: 'daily-limit' })
    expect(cvAvailability({ ...base(), limit: 5, usage: { date: '2026-10-14', documents: 5 } })).toEqual({ ok: true })
  })

  it('reports the first thing the person can fix, in a fixed order', () => {
    expect(cvAvailability({ ...base(), profile: createEmptyProfile(), jobText: '', key: '' })).toMatchObject({ reason: 'no-experience' })
    expect(cvAvailability({ ...base(), jobText: '', key: '' })).toMatchObject({ reason: 'no-text' })
    expect(cvAvailability({ ...base(), key: '', usage: { date: '2026-10-15', documents: 99 } })).toMatchObject({ reason: 'no-key' })
  })
})

describe('cvAvailability in the server build', () => {
  const server = (change: Partial<NonNullable<CvAvailabilityInput['server']>> = {}) => ({ signedIn: true, credits: 42, online: true, ...change })

  it('needs no key, and ignores the provider problems and the daily count', () => {
    const input = { ...base(), key: '', aiProblem: 'invalid-key' as const, usage: { date: '2026-10-15', documents: 99 }, server: server() }
    expect(cvAvailability(input)).toEqual({ ok: true })
  })

  it('is off with no credits, with the one text for it and no place to fix it', () => {
    expect(cvAvailability({ ...base(), server: server({ credits: 0 }) })).toEqual({ ok: false, reason: 'no-credits', message: 'Kredit tidak cukup.', link: 'none' })
  })

  it('leaves the decision to the server while the balance is not known', () => {
    expect(cvAvailability({ ...base(), server: server({ credits: null }) })).toEqual({ ok: true })
  })

  it('asks to sign in when signed out', () => {
    expect(cvAvailability({ ...base(), server: server({ signedIn: false, credits: null }) })).toEqual({ ok: false, reason: 'signed-out', message: 'Masuk untuk memakai', link: 'none' })
  })

  it('is off while offline, even with credits', () => {
    expect(cvAvailability({ ...base(), server: server({ online: false }) })).toEqual({
      ok: false, reason: 'offline', message: 'Tidak ada koneksi internet. Sambungkan dulu untuk memakai AI.', link: 'none',
    })
  })

  it('still asks for the Work Experience and the posting text first', () => {
    expect(cvAvailability({ ...base(), profile: createEmptyProfile(), server: server({ signedIn: false }) })).toMatchObject({ reason: 'no-experience' })
    expect(cvAvailability({ ...base(), jobText: '', server: server({ credits: 0 }) })).toMatchObject({ reason: 'no-text' })
  })

  it('is still off when the build has no AI at all', () => {
    expect(cvAvailability({ ...base(), aiEnabled: false, server: server() })).toMatchObject({ reason: 'ai-unavailable' })
  })

  it('checks signed-out before offline before credits', () => {
    expect(cvAvailability({ ...base(), server: server({ signedIn: false, online: false, credits: 0 }) })).toMatchObject({ reason: 'signed-out' })
    expect(cvAvailability({ ...base(), server: server({ online: false, credits: 0 }) })).toMatchObject({ reason: 'offline' })
  })
})
