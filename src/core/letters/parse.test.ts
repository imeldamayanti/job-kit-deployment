import { describe, expect, it } from 'vitest'
import { parseLetter } from './parse'

const BODY = Array.from({ length: 40 }, (_, i) => `kata${i}`).join(' ')

describe('parseLetter', () => {
  it('reads the letter from the JSON answer', () => {
    expect(parseLetter(JSON.stringify({ letter: BODY }))).toEqual({ ok: true, body: BODY })
  })

  it('reads an answer wrapped in a code fence or in other text', () => {
    expect(parseLetter('```json\n' + JSON.stringify({ letter: BODY }) + '\n```')).toEqual({ ok: true, body: BODY })
    expect(parseLetter('Berikut suratnya: ' + JSON.stringify({ letter: BODY }) + ' semoga membantu')).toEqual({ ok: true, body: BODY })
  })

  it('refuses text that is not JSON', () => {
    expect(parseLetter('Yth. Tim Rekrutmen, saya melamar ...')).toEqual({ ok: false, reason: 'Jawaban penyedia bukan JSON.' })
  })

  it('refuses a JSON answer without a letter text', () => {
    expect(parseLetter('{"surat": "x"}')).toMatchObject({ ok: false })
    expect(parseLetter('{"letter": 5}')).toMatchObject({ ok: false })
    expect(parseLetter('[1]')).toMatchObject({ ok: false })
  })

  it('refuses a letter that is empty or far too short', () => {
    expect(parseLetter('{"letter": "   "}')).toMatchObject({ ok: false, reason: expect.stringContaining('kosong') })
    expect(parseLetter('{"letter": "Saya melamar."}')).toMatchObject({ ok: false, reason: expect.stringContaining('terlalu pendek') })
  })

  it('refuses a letter that is far too long', () => {
    const long = Array.from({ length: 800 }, (_, i) => `kata${i}`).join(' ')
    expect(parseLetter(JSON.stringify({ letter: long }))).toMatchObject({ ok: false, reason: expect.stringContaining('terlalu panjang') })
  })

  it('ignores keys the model adds', () => {
    expect(parseLetter(JSON.stringify({ letter: BODY, company: 'Fiktif', date: '1 Januari' }))).toEqual({ ok: true, body: BODY })
  })
})
