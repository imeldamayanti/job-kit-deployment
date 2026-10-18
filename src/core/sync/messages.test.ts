import { describe, expect, it } from 'vitest'
import { failureText, summarizeSync, unlockText } from './messages'

describe('failureText', () => {
  it('says something a person can act on for each failure', () => {
    expect(failureText('network')).toContain('internet')
    expect(failureText('rate-limit')).toContain('Terlalu banyak')
    expect(failureText('rejected')).toContain('kode')
    expect(failureText('signed-out')).toContain('masuk lagi')
    expect(failureText('server')).toContain('server')
  })
})

describe('unlockText', () => {
  it('names a wrong password and warns it cannot be reset', () => {
    expect(unlockText('wrong-password')).toContain('Kata sandi sinkron salah')
    expect(unlockText('wrong-password')).toContain('tidak bisa dipulihkan')
  })
})

describe('summarizeSync', () => {
  it('says all is up to date when nothing moved', () => {
    expect(summarizeSync({ profile: 'same', applications: 'same', cvs: 'same', letters: 'same' })).toEqual({ text: 'Sudah sama di semua perangkat.', needsConfirm: [], problems: [] })
  })

  it('names what went up and what came down, in Indonesian', () => {
    const summary = summarizeSync({ profile: 'pushed', applications: 'pulled', cvs: 'same', letters: 'same' })
    expect(summary.text).toBe('Terkirim: Profile. Diterima: Lamaran.')
  })

  it('lists what needs a yes before it overwrites this device', () => {
    const summary = summarizeSync({ profile: 'needs-confirm', applications: 'same' })
    expect(summary.needsConfirm).toEqual(['Profile'])
  })

  it('reports conflicts, failures and a wrong key as problems, never as success', () => {
    const summary = summarizeSync({ profile: 'conflict', applications: 'failed', cvs: 'wrong-key', letters: 'pushed' })
    expect(summary.problems).toEqual([
      'Profile: perangkat lain menulis lebih dulu. Sinkronkan lagi.',
      'Lamaran: gagal. Coba lagi nanti.',
      'CV: data online tidak bisa dibuka dengan kata sandi ini.',
    ])
    expect(summary.text).toBe('Terkirim: Surat.')
  })
})
