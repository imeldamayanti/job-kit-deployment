import type { ScannedField } from './scan'

type Writable = HTMLInputElement | HTMLTextAreaElement

export type FillTarget =
  | { kind?: 'text'; element: ScannedField['element']; value: string }
  | { kind: 'select'; element: HTMLSelectElement; value: string }
  | { kind: 'radio'; radios: HTMLInputElement[]; index: number }

export type FillOutcome = { filled: number; skipped: number }
export type Filler = {
  fill: (targets: FillTarget[]) => FillOutcome
  undo: () => number
  canUndo: () => boolean
}

function isWritable(element: ScannedField['element']): element is Writable {
  if (element instanceof HTMLInputElement) return element.type !== 'password' && !element.disabled && !element.readOnly
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly
  return false
}

function notify(element: Element): void {
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

// React and Vue track the value through the instance property, so assigning .value does not notify them.
// Calling the prototype setter and then dispatching the events they listen for does.
function writeValue(element: Writable | HTMLSelectElement, value: string): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
  notify(element)
}

// A real click is what makes a framework see a radio change; unchecking has no click, so it is set directly.
function chooseRadio(radios: HTMLInputElement[], index: number | undefined): void {
  const target = index === undefined ? undefined : radios[index]
  if (target) {
    target.click()
    return
  }
  for (const radio of radios) {
    if (radio.checked) {
      radio.checked = false
      notify(radio)
    }
  }
}

export function createFiller(): Filler {
  // One way back per thing we touched, recorded the first time only, so Undo reaches the state before any fill.
  const restorers = new Map<object, () => void>()

  return {
    fill(targets) {
      const outcome: FillOutcome = { filled: 0, skipped: 0 }
      for (const target of targets) {
        if (target.kind === 'radio') {
          const radio = target.radios[target.index]
          const group = target.radios[0]
          if (!radio || !group || radio.disabled) {
            outcome.skipped += 1
            continue
          }
          if (!restorers.has(group)) {
            const before = target.radios.findIndex((item) => item.checked)
            restorers.set(group, () => chooseRadio(target.radios, before >= 0 ? before : undefined))
          }
          chooseRadio(target.radios, target.index)
          outcome.filled += 1
        } else if (target.kind === 'select') {
          const { element, value } = target
          if (element.disabled) {
            outcome.skipped += 1
            continue
          }
          if (!restorers.has(element)) {
            const before = element.value
            restorers.set(element, () => writeValue(element, before))
          }
          writeValue(element, value)
          outcome.filled += 1
        } else {
          const { element, value } = target
          if (!isWritable(element)) {
            outcome.skipped += 1
            continue
          }
          if (!restorers.has(element)) {
            const before = element.value
            restorers.set(element, () => element.isConnected && writeValue(element, before))
          }
          writeValue(element, value)
          outcome.filled += 1
        }
      }
      return outcome
    },
    undo() {
      const restored = restorers.size
      for (const restore of restorers.values()) restore()
      restorers.clear()
      return restored
    },
    canUndo: () => restorers.size > 0,
  }
}
