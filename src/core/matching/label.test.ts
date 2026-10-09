import { beforeEach, describe, expect, it } from 'vitest'
import { readLabel } from './label'

function field(html: string): HTMLInputElement {
  document.body.innerHTML = html
  return document.querySelector('input')!
}

describe('readLabel', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('reads a label linked with for', () => {
    expect(readLabel(field('<label for="a">Nama Lengkap</label><input id="a" />'))).toBe('Nama Lengkap')
  })

  it('reads a wrapping label', () => {
    expect(readLabel(field('<label>Full Name <input /></label>'))).toBe('Full Name')
  })

  it('reads aria-label when there is no label element', () => {
    expect(readLabel(field('<input aria-label="Email address" />'))).toBe('Email address')
  })

  it('reads aria-labelledby', () => {
    expect(readLabel(field('<span id="t">Kota</span><input aria-labelledby="t" />'))).toBe('Kota')
  })

  it('falls back to the placeholder', () => {
    expect(readLabel(field('<input placeholder="Nomor HP" />'))).toBe('Nomor HP')
  })

  it('falls back to the name attribute last', () => {
    expect(readLabel(field('<input name="phone_number" />'))).toBe('phone_number')
  })

  it('prefers the label element over the placeholder', () => {
    expect(readLabel(field('<label for="a">Email</label><input id="a" placeholder="nama@contoh.com" />'))).toBe('Email')
  })
})
