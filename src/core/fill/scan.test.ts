import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { scanFields } from './scan'

const basicForm = readFileSync('fixtures/basic-form.html', 'utf8')

describe('scanFields', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = basicForm
  })

  it('reads text-like fields, textarea and select with their labels', () => {
    const labels = scanFields(document).map((field) => field.label)

    expect(labels).toEqual(['Full Name', 'Email', 'Telepon', 'Cover note', 'Kota'])
  })

  it('reads the label from a wrapping label element too', () => {
    const email = scanFields(document).find((field) => field.element.getAttribute('name') === 'email')

    expect(email?.label).toBe('Email')
  })

  it('skips hidden, password, submit and disabled fields', () => {
    const names = scanFields(document).map((field) => field.element.getAttribute('name'))

    expect(names).not.toContain('csrf')
    expect(names).not.toContain('pw')
    expect(names).not.toContain('off')
    expect(names).not.toContain(null)
  })

  it('gives every field a unique id', () => {
    const ids = scanFields(document).map((field) => field.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('returns nothing for a page without fields', () => {
    document.documentElement.innerHTML = '<body><p>Halo</p></body>'

    expect(scanFields(document)).toEqual([])
  })

  it('reports whether a field already holds text', () => {
    document.documentElement.innerHTML =
      '<body><input name="a" value="sudah ada" /><input name="b" /><input name="c" value="   " /></body>'

    const byName = Object.fromEntries(scanFields(document).map((f) => [f.element.getAttribute('name'), f.hasText]))

    expect(byName).toEqual({ a: true, b: false, c: false })
  })
})
