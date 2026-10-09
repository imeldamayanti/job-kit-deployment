import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFiller } from './apply'

function dom(html: string) {
  document.body.innerHTML = html
  return {
    text: document.querySelector<HTMLInputElement>('input[type=text]')!,
    area: document.querySelector<HTMLTextAreaElement>('textarea'),
    password: document.querySelector<HTMLInputElement>('input[type=password]'),
    select: document.querySelector<HTMLSelectElement>('select'),
  }
}

describe('createFiller', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('fills text inputs and textareas and reports the count', () => {
    const { text, area } = dom('<input type="text" /><textarea></textarea>')

    const outcome = createFiller().fill([
      { element: text, value: 'Imelda' },
      { element: area!, value: 'Halo' },
    ])

    expect(text.value).toBe('Imelda')
    expect(area!.value).toBe('Halo')
    expect(outcome).toEqual({ filled: 2, skipped: 0 })
  })

  it('dispatches input and change so frameworks notice', () => {
    const { text } = dom('<input type="text" />')
    const events: string[] = []
    text.addEventListener('input', () => events.push('input'))
    text.addEventListener('change', () => events.push('change'))

    createFiller().fill([{ element: text, value: 'x' }])

    expect(events).toEqual(['input', 'change'])
  })

  it('never fills a password field and never submits the form', () => {
    const { password } = dom('<form><input type="text" /><input type="password" /></form>')
    const onSubmit = vi.fn((event: Event) => event.preventDefault())
    document.querySelector('form')!.addEventListener('submit', onSubmit)

    const outcome = createFiller().fill([{ element: password!, value: 'secret' }])

    expect(password!.value).toBe('')
    expect(outcome).toEqual({ filled: 0, skipped: 1 })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('skips targets it cannot write: select, disabled, read-only', () => {
    document.body.innerHTML =
      '<select><option>a</option></select><input type="text" disabled /><input type="text" readonly />'
    const [select, disabled, readonly] = Array.from(
      document.querySelectorAll<HTMLInputElement>('select, input'),
    ) as [HTMLInputElement, HTMLInputElement, HTMLInputElement]

    const outcome = createFiller().fill([
      { element: select, value: 'a' },
      { element: disabled, value: 'x' },
      { element: readonly, value: 'x' },
    ])

    expect(outcome).toEqual({ filled: 0, skipped: 3 })
    expect(disabled.value).toBe('')
  })

  it('undo restores every filled field to its earlier value', () => {
    document.body.innerHTML = '<input type="text" value="lama" /><input type="text" />'
    const [a, b] = Array.from(document.querySelectorAll<HTMLInputElement>('input')) as [
      HTMLInputElement,
      HTMLInputElement,
    ]
    const filler = createFiller()

    filler.fill([
      { element: a, value: 'baru' },
      { element: b, value: 'isi' },
    ])
    const restored = filler.undo()

    expect(a.value).toBe('lama')
    expect(b.value).toBe('')
    expect(restored).toBe(2)
  })

  it('filling twice keeps the value from before the first fill for undo', () => {
    const { text } = dom('<input type="text" value="awal" />')
    const filler = createFiller()

    filler.fill([{ element: text, value: 'satu' }])
    filler.fill([{ element: text, value: 'satu' }])
    filler.undo()

    expect(text.value).toBe('awal')
  })

  it('undo with nothing filled does nothing', () => {
    expect(createFiller().undo()).toBe(0)
  })

  it('knows whether there is anything to undo', () => {
    const { text } = dom('<input type="text" />')
    const filler = createFiller()
    expect(filler.canUndo()).toBe(false)

    filler.fill([{ element: text, value: 'x' }])
    expect(filler.canUndo()).toBe(true)

    filler.undo()
    expect(filler.canUndo()).toBe(false)
  })

  it('chooses a dropdown option and undo returns to the earlier choice', () => {
    document.body.innerHTML = '<select><option value="">Pilih</option><option value="m">Male</option><option value="f">Female</option></select>'
    const select = document.querySelector('select')!
    const changes: string[] = []
    select.addEventListener('change', () => changes.push(select.value))
    const filler = createFiller()

    const outcome = filler.fill([{ kind: 'select', element: select, value: 'm' }])

    expect(select.value).toBe('m')
    expect(outcome).toEqual({ filled: 1, skipped: 0 })
    filler.undo()
    expect(select.value).toBe('')
    expect(changes).toEqual(['m', ''])
  })

  it('checks a radio and undo puts back the one that was checked before', () => {
    document.body.innerHTML = '<input type="radio" name="g" value="m" /><input type="radio" name="g" value="f" checked />'
    const radios = Array.from(document.querySelectorAll('input'))
    const filler = createFiller()

    filler.fill([{ kind: 'radio', radios, index: 0 }])
    expect(radios.map((r) => r.checked)).toEqual([true, false])

    filler.undo()
    expect(radios.map((r) => r.checked)).toEqual([false, true])
  })

  it('undo unchecks a radio group that had nothing checked', () => {
    document.body.innerHTML = '<input type="radio" name="g" value="m" /><input type="radio" name="g" value="f" />'
    const radios = Array.from(document.querySelectorAll('input'))
    const filler = createFiller()

    filler.fill([{ kind: 'radio', radios, index: 1 }])
    filler.undo()

    expect(radios.map((r) => r.checked)).toEqual([false, false])
  })

  it('skips a disabled dropdown and disabled radios', () => {
    document.body.innerHTML = '<select disabled><option value="m">Male</option></select><input type="radio" name="g" disabled />'
    const select = document.querySelector('select')!
    const radios = Array.from(document.querySelectorAll('input'))

    const outcome = createFiller().fill([
      { kind: 'select', element: select, value: 'm' },
      { kind: 'radio', radios, index: 0 },
    ])

    expect(outcome).toEqual({ filled: 0, skipped: 2 })
  })
})
