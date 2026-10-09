import type { ScannedField } from './scan'

export type FillTarget = { element: ScannedField['element']; value: string }
export type FillOutcome = { filled: number; skipped: number }
export type Filler = {
  fill: (targets: FillTarget[]) => FillOutcome
  undo: () => number
}

type Writable = HTMLInputElement | HTMLTextAreaElement

function isWritable(element: ScannedField['element']): element is Writable {
  if (element instanceof HTMLInputElement) return element.type !== 'password' && !element.disabled && !element.readOnly
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly
  return false
}

// React and Vue track the value through the instance property, so assigning .value does not notify them.
// Calling the prototype setter and then dispatching the events they listen for does.
function writeValue(element: Writable, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

export function createFiller(): Filler {
  const originals = new Map<Writable, string>()

  return {
    fill(targets) {
      const outcome: FillOutcome = { filled: 0, skipped: 0 }
      for (const { element, value } of targets) {
        if (!isWritable(element)) {
          outcome.skipped += 1
          continue
        }
        if (!originals.has(element)) originals.set(element, element.value)
        writeValue(element, value)
        outcome.filled += 1
      }
      return outcome
    },
    undo() {
      const restored = originals.size
      for (const [element, value] of originals) {
        if (element.isConnected) writeValue(element, value)
      }
      originals.clear()
      return restored
    },
  }
}
