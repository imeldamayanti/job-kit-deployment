import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyRequiredFields, scanFields, scanUploads } from './scan'

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

  it('reads a dropdown with its options, without the empty placeholder', () => {
    document.documentElement.innerHTML =
      '<body><label for="c">Kota</label><select id="c" name="c"><option value="">Pilih</option><option value="jkt">Jakarta</option><option value="bdg">Bandung</option></select></body>'

    const [field] = scanFields(document)

    expect(field?.kind).toBe('select')
    expect(field?.options).toEqual([
      { label: 'Jakarta', value: 'jkt' },
      { label: 'Bandung', value: 'bdg' },
    ])
    expect(field?.hasText).toBe(false)
  })

  it('treats a dropdown with a chosen option as already filled', () => {
    document.documentElement.innerHTML =
      '<body><select name="c"><option value="">Pilih</option><option value="jkt" selected>Jakarta</option></select></body>'

    expect(scanFields(document)[0]?.hasText).toBe(true)
  })

  it('reads a radio group as one field with its options', () => {
    document.documentElement.innerHTML =
      '<body><fieldset><legend>Jenis kelamin</legend><label><input type="radio" name="g" value="m" /> Laki-laki</label><label><input type="radio" name="g" value="f" /> Perempuan</label></fieldset></body>'

    const fields = scanFields(document)

    expect(fields).toHaveLength(1)
    expect(fields[0]?.kind).toBe('radio')
    expect(fields[0]?.label).toBe('Jenis kelamin')
    expect(fields[0]?.options).toEqual([
      { label: 'Laki-laki', value: 'm' },
      { label: 'Perempuan', value: 'f' },
    ])
    expect(fields[0]?.radios).toHaveLength(2)
  })
})

describe('scanFields: multiline (T52)', () => {
  it('says which fields are a textarea', () => {
    document.documentElement.innerHTML = readFileSync('fixtures/greenhouse-cover-letter.html', 'utf8')
    const rows = Object.fromEntries(scanFields(document).map((field) => [field.label, field.multiline]))
    expect(rows).toMatchObject({ 'First Name': false, Email: false, 'Cover Letter': true, 'Why do you want to work here?': true })
  })
})

describe('scanUploads (T52)', () => {
  it('lists file inputs by label, and the fields scan leaves them out', () => {
    document.documentElement.innerHTML = readFileSync('fixtures/greenhouse-cover-letter.html', 'utf8')
    expect(scanUploads(document)).toEqual([{ label: 'Resume/CV' }, { label: 'Cover Letter (attach a file)' }])
    expect(scanFields(document).map((field) => field.label)).not.toContain('Resume/CV')
  })

  it('does not list a disabled file input, and finds none on a form without one', () => {
    document.documentElement.innerHTML = '<form><label for="f">CV</label><input id="f" type="file" disabled /></form>'
    expect(scanUploads(document)).toEqual([])
    document.documentElement.innerHTML = basicForm
    expect(scanUploads(document)).toEqual([])
  })

  it('only reads the files\' labels: it never sets or clicks anything', () => {
    document.documentElement.innerHTML = readFileSync('fixtures/greenhouse-cover-letter.html', 'utf8')
    const input = document.querySelector<HTMLInputElement>('#resume')!
    let touched = 0
    input.addEventListener('click', () => (touched += 1))
    input.addEventListener('change', () => (touched += 1))
    scanUploads(document)
    expect(touched).toBe(0)
    expect(input.files?.length ?? 0).toBe(0)
  })
})

describe('scanFields required', () => {
  function required(html: string): boolean[] {
    document.body.innerHTML = html
    return scanFields(document).map((field) => field.required)
  }

  it('reads the required attribute, aria-required and a marked label', () => {
    expect(
      required(
        '<input id="a" required /><input id="b" aria-required="true" />' +
          '<label for="c">Nama *</label><input id="c" /><label for="d">Kota (Wajib)</label><input id="d" /><input id="e" />',
      ),
    ).toEqual([true, true, true, true, false])
  })

  it('does not count aria-required="false"', () => {
    expect(required('<input id="a" aria-required="false" />')).toEqual([false])
  })

  it('treats a select and a radio group as required by the same signs', () => {
    expect(
      required(
        '<select id="s" required><option value="">-</option><option>A</option></select>' +
          '<fieldset><legend>Gender *</legend><input type="radio" name="g" value="a" /><input type="radio" name="g" value="b" /></fieldset>' +
          '<fieldset><legend>Kontak</legend><input type="radio" name="k" value="a" /><input type="radio" name="k" value="b" required /></fieldset>' +
          '<fieldset><legend>Lain</legend><input type="radio" name="l" value="a" /></fieldset>',
      ),
    ).toEqual([true, true, true, false])
  })
})

describe('emptyRequiredFields', () => {
  function emptyIds(html: string): string[] {
    document.body.innerHTML = html
    return emptyRequiredFields(scanFields(document)).map((field) => field.element.id || field.element.getAttribute('name') || '')
  }

  it('returns required fields that are empty and ignores optional ones', () => {
    expect(emptyIds('<input id="a" required /><input id="b" /><input id="c" required value="isi" />')).toEqual(['a'])
  })

  it('reads the value now, so a field filled after the scan is no longer empty', () => {
    document.body.innerHTML = '<input id="a" required /><input id="b" required />'
    const fields = scanFields(document)
    ;(document.getElementById('a') as HTMLInputElement).value = 'Imelda'

    expect(emptyRequiredFields(fields).map((field) => field.element.id)).toEqual(['b'])
  })

  it('treats a blank-only text value as empty', () => {
    expect(emptyIds('<input id="a" required value="   " />')).toEqual(['a'])
  })

  it('treats a select still on its placeholder as empty and one with a choice as answered', () => {
    expect(
      emptyIds(
        '<select id="a" required><option value="">Pilih</option><option value="x">X</option></select>' +
          '<select id="b" required><option value="">Pilih</option><option value="x" selected>X</option></select>',
      ),
    ).toEqual(['a'])
  })

  it('treats a radio group with no checked button as empty', () => {
    expect(
      emptyIds(
        '<input type="radio" name="g" value="a" required /><input type="radio" name="g" value="b" />' +
          '<input type="radio" name="h" value="a" required checked /><input type="radio" name="h" value="b" />',
      ),
    ).toEqual(['g'])
  })

  it('skips hidden fields', () => {
    expect(
      emptyIds(
        '<input id="a" required style="display:none" /><div hidden><input id="b" required /></div>' +
          '<div style="visibility:hidden"><input id="c" required /></div><input id="d" required />',
      ),
    ).toEqual(['d'])
  })
})
