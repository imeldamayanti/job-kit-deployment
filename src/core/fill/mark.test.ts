import { beforeEach, describe, expect, it } from 'vitest'
import { createMarker, MARK_COLOR } from './mark'
import { emptyRequiredFields, scanFields } from './scan'

function setup(html: string) {
  document.body.innerHTML = html
  return emptyRequiredFields(scanFields(document))
}

function marked(element: Element): boolean {
  const style = (element as HTMLElement).style
  return style.getPropertyValue('outline-style') === 'solid' && style.getPropertyPriority('outline-style') === 'important'
}

describe('createMarker', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('outlines an empty required field in amber, 2px with a 2px gap', () => {
    const fields = setup('<input id="a" required />')

    expect(createMarker().mark(fields)).toBe(1)

    const style = document.getElementById('a')!.style
    expect(style.getPropertyValue('outline-width')).toBe('2px')
    expect(style.getPropertyValue('outline-offset')).toBe('2px')
    expect(style.getPropertyValue('outline-color')).not.toBe('')
    expect(MARK_COLOR).toBe('#DC6803')
    expect(marked(document.getElementById('a')!)).toBe(true)
  })

  it('adds no element to the page', () => {
    const fields = setup('<input id="a" required /><select id="s" required><option value="">-</option><option>x</option></select>')
    const before = document.querySelectorAll('*').length

    createMarker().mark(fields)

    expect(document.querySelectorAll('*').length).toBe(before)
  })

  it('marks the group of a radio question, not each button', () => {
    const fields = setup('<fieldset id="g"><legend>Gender *</legend><input id="r1" type="radio" name="g" /><input id="r2" type="radio" name="g" /></fieldset>')

    expect(createMarker().mark(fields)).toBe(1)

    expect(marked(document.getElementById('g')!)).toBe(true)
    expect(marked(document.getElementById('r1')!)).toBe(false)
    expect(marked(document.getElementById('r2')!)).toBe(false)
  })

  it('marks the radiogroup element when there is no fieldset', () => {
    const fields = setup('<div id="rg" role="radiogroup" aria-label="Gender *"><input id="r1" type="radio" name="g" /><input id="r2" type="radio" name="g" /></div>')

    createMarker().mark(fields)

    expect(marked(document.getElementById('rg')!)).toBe(true)
  })

  it('clear brings back the outline the site had set on the field itself', () => {
    const fields = setup('<input id="a" required style="outline: 1px dashed red; outline-offset: 5px" />')
    const marker = createMarker()
    const input = document.getElementById('a')!

    marker.mark(fields)
    expect(marker.clear()).toBe(1)

    expect(input.style.getPropertyValue('outline-style')).toBe('dashed')
    expect(input.style.getPropertyValue('outline-width')).toBe('1px')
    expect(input.style.getPropertyValue('outline-offset')).toBe('5px')
  })

  it('clear leaves a field with no inline outline of its own with none', () => {
    const fields = setup('<input id="a" required style="color: blue" />')
    const marker = createMarker()
    const input = document.getElementById('a')!

    marker.mark(fields)
    marker.clear()

    expect(input.getAttribute('style')).toBe('color: blue;')
  })

  it('removes the outline of a field as soon as the user fills it', () => {
    const fields = setup('<input id="a" required /><input id="b" required />')
    const marker = createMarker()
    marker.mark(fields)
    const a = document.getElementById('a') as HTMLInputElement

    a.value = 'Imelda'
    a.dispatchEvent(new Event('input', { bubbles: true }))

    expect(marked(a)).toBe(false)
    expect(marked(document.getElementById('b')!)).toBe(true)
    expect(marker.active()).toBe(true)
  })

  it('keeps the outline while the user only clears or leaves the field empty', () => {
    const fields = setup('<input id="a" required />')
    createMarker().mark(fields)
    const a = document.getElementById('a') as HTMLInputElement

    a.dispatchEvent(new Event('input', { bubbles: true }))

    expect(marked(a)).toBe(true)
  })

  it('removes a radio group outline once a button is chosen', () => {
    const fields = setup('<fieldset id="g"><legend>Gender *</legend><input id="r1" type="radio" name="g" /><input id="r2" type="radio" name="g" /></fieldset>')
    createMarker().mark(fields)

    const radio = document.getElementById('r2') as HTMLInputElement
    radio.checked = true
    radio.dispatchEvent(new Event('change', { bubbles: true }))

    expect(marked(document.getElementById('g')!)).toBe(false)
  })

  it('marking again starts from the page as it was, so Undo still restores the original', () => {
    const fields = setup('<input id="a" required style="outline: 1px dashed red" />')
    const marker = createMarker()

    marker.mark(fields)
    marker.mark(fields)
    marker.clear()

    expect(document.getElementById('a')!.style.getPropertyValue('outline-style')).toBe('dashed')
  })

  it('drops an outline for a field that has been answered in between', () => {
    const fields = setup('<input id="a" required /><input id="b" required />')
    const marker = createMarker()
    marker.mark(fields)
    ;(document.getElementById('a') as HTMLInputElement).value = 'x'

    expect(marker.mark(fields)).toBe(1)
    expect(marked(document.getElementById('a')!)).toBe(false)
  })

  it('reports whether anything is marked', () => {
    const marker = createMarker()
    expect(marker.active()).toBe(false)

    marker.mark(setup('<input id="a" required />'))
    expect(marker.active()).toBe(true)

    marker.clear()
    expect(marker.active()).toBe(false)
  })

  it('marks nothing for no fields', () => {
    const marker = createMarker()

    expect(marker.mark([])).toBe(0)
    expect(marker.active()).toBe(false)
  })
})
