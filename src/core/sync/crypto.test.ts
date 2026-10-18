import { describe, expect, it } from 'vitest'
import { decrypt, deriveKey, encrypt, exportKey, importKey, makeCheck, newSalt, verifyCheck } from './crypto'

const salt = new Uint8Array(16).fill(7)

describe('sync crypto', () => {
  it('round-trips text, including non-latin letters', async () => {
    const key = await deriveKey('kata sandi benar', salt, 1000)
    const text = JSON.stringify({ nama: 'Siti 李', cv: ['a', 'b'] })
    expect(await decrypt(key, await encrypt(key, text))).toBe(text)
  })

  it('never produces the same ciphertext twice for the same text', async () => {
    const key = await deriveKey('pw', salt, 1000)
    expect(await encrypt(key, 'sama')).not.toBe(await encrypt(key, 'sama'))
  })

  it('does not contain the plaintext', async () => {
    const key = await deriveKey('pw', salt, 1000)
    expect(await encrypt(key, 'rahasia-sekali')).not.toContain('rahasia')
  })

  it('refuses a wrong password with a clear reason, not garbage', async () => {
    const good = await deriveKey('benar', salt, 1000)
    const bad = await deriveKey('salah', salt, 1000)
    await expect(decrypt(bad, await encrypt(good, 'isi'))).rejects.toMatchObject({ reason: 'wrong-key' })
  })

  it('refuses a damaged or unknown envelope', async () => {
    const key = await deriveKey('pw', salt, 1000)
    await expect(decrypt(key, 'bukan-envelope')).rejects.toMatchObject({ reason: 'bad-data' })
    const sealed = await encrypt(key, 'isi')
    await expect(decrypt(key, sealed.slice(0, -4))).rejects.toMatchObject({ reason: expect.stringMatching(/bad-data|wrong-key/) })
  })

  it('a different salt gives a different key', async () => {
    const a = await deriveKey('pw', salt, 1000)
    const b = await deriveKey('pw', new Uint8Array(16).fill(9), 1000)
    await expect(decrypt(b, await encrypt(a, 'isi'))).rejects.toMatchObject({ reason: 'wrong-key' })
  })

  it('makes 16 random salt bytes', () => {
    const a = newSalt()
    expect(a).toHaveLength(16)
    expect(newSalt()).not.toEqual(a)
  })

  it('checks a password against a stored check value', async () => {
    const key = await deriveKey('benar', salt, 1000)
    const check = await makeCheck(key)
    expect(await verifyCheck(key, check)).toBe(true)
    expect(await verifyCheck(await deriveKey('salah', salt, 1000), check)).toBe(false)
  })

  it('keeps a key across a browser session by exporting and importing it', async () => {
    const key = await deriveKey('pw', salt, 1000)
    const again = await importKey(await exportKey(key))
    expect(await decrypt(again, await encrypt(key, 'isi'))).toBe('isi')
  })

  it('defaults to 600000 PBKDF2 iterations', async () => {
    const { PBKDF2_ITERATIONS } = await import('./crypto')
    expect(PBKDF2_ITERATIONS).toBe(600_000)
  })
})
