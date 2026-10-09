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
})
