import { beforeEach, describe, expect, it } from 'vitest'
import { readGroupLabel, readLabel } from './label'

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

describe('readGroupLabel', () => {
  function radios(html: string): HTMLInputElement[] {
    document.body.innerHTML = html
    return Array.from(document.querySelectorAll('input'))
  }

  it('reads the legend of the fieldset around the radios', () => {
    const group = radios('<fieldset><legend>Jenis kelamin</legend><label><input type="radio" name="g" /> Laki-laki</label></fieldset>')

    expect(readGroupLabel(group)).toBe('Jenis kelamin')
  })

  it('reads aria-labelledby on a radiogroup', () => {
    const group = radios('<span id="t">Gender</span><div role="radiogroup" aria-labelledby="t"><input type="radio" name="g" /></div>')

    expect(readGroupLabel(group)).toBe('Gender')
  })

  it('reads aria-label on a radiogroup', () => {
    const group = radios('<div role="radiogroup" aria-label="Education level"><input type="radio" name="g" /></div>')

    expect(readGroupLabel(group)).toBe('Education level')
  })

  it('falls back to the name attribute', () => {
    expect(readGroupLabel(radios('<input type="radio" name="gender" />'))).toBe('gender')
  })
})
