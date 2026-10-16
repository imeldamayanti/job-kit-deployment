import { emptyRequiredFields, isFieldEmpty, type ScannedField } from './scan'

// amber-600 from the design tokens. The page is someone else's, so the CSS variable is not there; the value is repeated.
export const MARK_COLOR = '#DC6803'

const PROPERTIES = ['outline-style', 'outline-width', 'outline-color', 'outline-offset'] as const
const MARK: Record<(typeof PROPERTIES)[number], string> = {
  'outline-style': 'solid',
  'outline-width': '2px',
  'outline-color': MARK_COLOR,
  'outline-offset': '2px',
}

export type Marker = {
  // Outlines the required fields that are still empty and visible, dropping earlier outlines first. Returns how many.
  mark: (fields: ScannedField[]) => number
  clear: () => number
  active: () => boolean
}

// One outline per question: the field itself, or for radio buttons their fieldset or radiogroup, so the group is outlined and not each button.
function outlineTarget(field: ScannedField): HTMLElement {
  if (field.kind !== 'radio') return field.element
  const first = field.radios[0] as HTMLInputElement
  const container = first.closest<HTMLElement>('fieldset, [role="radiogroup"]')
  if (container && field.radios.every((radio) => container.contains(radio))) return container
  return first.parentElement ?? first
}

export function createMarker(): Marker {
  // Per outlined element: how to put back what the site had set inline, and how to stop listening.
  const marks = new Map<HTMLElement, () => void>()

  function unmark(target: HTMLElement): void {
    marks.get(target)?.()
    marks.delete(target)
  }

  function clear(): number {
    const count = marks.size
    for (const target of Array.from(marks.keys())) unmark(target)
    return count
  }

  return {
    mark(fields) {
      clear()
      for (const field of emptyRequiredFields(fields)) {
        const target = outlineTarget(field)
        const before = PROPERTIES.map((name) => [name, target.style.getPropertyValue(name), target.style.getPropertyPriority(name)] as const)
        for (const name of PROPERTIES) target.style.setProperty(name, MARK[name], 'important')

        // The mark goes the moment the user answers the question (FR-20).
        const watched = field.kind === 'radio' ? field.radios : [field.element]
        const onAnswer = () => {
          if (!isFieldEmpty(field)) unmark(target)
        }
        for (const element of watched) {
          element.addEventListener('input', onAnswer)
          element.addEventListener('change', onAnswer)
        }
        marks.set(target, () => {
          for (const element of watched) {
            element.removeEventListener('input', onAnswer)
            element.removeEventListener('change', onAnswer)
          }
          for (const [name, value, priority] of before) {
            if (value === '') target.style.removeProperty(name)
            else target.style.setProperty(name, value, priority)
          }
        })
      }
      return marks.size
    },
    clear,
    active: () => marks.size > 0,
  }
}
