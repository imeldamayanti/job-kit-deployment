import { beforeEach, describe, expect, it } from 'vitest'
import { createPageHandlers } from './handlers'

const FORM =
  '<form>' +
  '<label for="n">Full Name *</label><input id="n" name="n" />' +
  '<label for="e">Email</label><input id="e" name="e" required />' +
  '<label for="r">Referral *</label><input id="r" name="r" />' +
  '<label for="c">Cover note</label><textarea id="c"></textarea>' +
  '<label for="k">Kota *</label><select id="k"><option value="">Pilih</option><option value="jkt">Jakarta</option></select>' +
  '<fieldset id="g"><legend>Gender *</legend><input id="g1" type="radio" name="g" value="f" /><input id="g2" type="radio" name="g" value="m" /></fieldset>' +
  '</form>'

const outlined = (id: string) => document.getElementById(id)!.style.getPropertyValue('outline-style') === 'solid'

describe('page handlers', () => {
  beforeEach(() => {
    document.body.innerHTML = FORM
  })

  it('outlines nothing before Fill is pressed', () => {
    const handlers = createPageHandlers(document)

    const scan = handlers.scan()

    expect(scan.fields.map((field) => field.required)).toEqual([true, true, true, false, true, true])
    expect(document.querySelectorAll('[style]').length).toBe(0)
  })

  it('after Fill outlines required fields that are still empty and nothing else', () => {
    const handlers = createPageHandlers(document)
    const fields = handlers.scan().fields
    const id = (label: string) => fields.find((field) => field.label === label)!.id

    const outcome = handlers.fill([{ fieldId: id('Full Name *'), value: 'Imelda' }])

    expect(outcome).toEqual({ filled: 1, skipped: 0, marked: 4 })
    expect(outlined('n')).toBe(false)
    expect(outlined('e')).toBe(true)
    expect(outlined('r')).toBe(true)
    expect(outlined('c')).toBe(false)
    expect(outlined('k')).toBe(true)
    expect(outlined('g')).toBe(true)
    expect(outlined('g1')).toBe(false)
  })

  it('outlines a required field the user switched off even though a value was ready for it', () => {
    const handlers = createPageHandlers(document)
    handlers.scan()

    expect(handlers.fill([]).marked).toBe(5)
    expect(outlined('n')).toBe(true)
  })

  it('does not outline a required field that already held the user\'s own text', () => {
    ;(document.getElementById('r') as HTMLInputElement).value = 'Teman'
    const handlers = createPageHandlers(document)
    handlers.scan()

    handlers.fill([])

    expect(outlined('r')).toBe(false)
  })

  it('does not outline a hidden required field and adds no element', () => {
    document.getElementById('r')!.style.display = 'none'
    const count = document.querySelectorAll('*').length
    const handlers = createPageHandlers(document)
    handlers.scan()

    handlers.fill([])

    expect(outlined('r')).toBe(false)
    expect(document.querySelectorAll('*').length).toBe(count)
  })

  it('removes an outline when the user answers the field', () => {
    const handlers = createPageHandlers(document)
    handlers.scan()
    handlers.fill([])
    const input = document.getElementById('e') as HTMLInputElement

    input.value = 'nama@example.test'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(outlined('e')).toBe(false)
    expect(outlined('r')).toBe(true)
  })

  it('keeps the outlines across a rescan and offers Undo while they are there', () => {
    const handlers = createPageHandlers(document)
    handlers.scan()
    handlers.fill([])

    const rescan = handlers.scan()

    expect(rescan.canUndo).toBe(true)
    expect(outlined('e')).toBe(true)
  })

  it('Undo removes every outline and restores the site\'s own outline', () => {
    document.getElementById('e')!.style.outline = '1px dashed red'
    const handlers = createPageHandlers(document)
    const fields = handlers.scan().fields
    handlers.fill([{ fieldId: fields[0]!.id, value: 'Imelda' }])

    handlers.undo()

    expect((document.getElementById('n') as HTMLInputElement).value).toBe('')
    expect(outlined('r')).toBe(false)
    expect(outlined('g')).toBe(false)
    expect(document.getElementById('e')!.style.getPropertyValue('outline-style')).toBe('dashed')
    expect(handlers.scan().canUndo).toBe(false)
  })

  it('a second Fill outlines from a clean slate, so Undo still returns the original page', () => {
    document.getElementById('e')!.style.outline = '1px dashed red'
    const handlers = createPageHandlers(document)
    handlers.scan()

    handlers.fill([])
    handlers.fill([])
    handlers.undo()

    expect(document.getElementById('e')!.style.getPropertyValue('outline-style')).toBe('dashed')
    expect(outlined('n')).toBe(false)
  })
})
