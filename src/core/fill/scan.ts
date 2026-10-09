import type { ChoiceOption } from '../matching/choice'
import { readGroupLabel, readLabel } from '../matching/label'

export type ScannedField = {
  id: string
  label: string
  autocomplete: string
  hasText: boolean
  kind: 'text' | 'select' | 'radio'
  // The control to write to. For a radio group this is its first button; all of them are in `radios`.
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  options: ChoiceOption[]
  radios: HTMLInputElement[]
}

const TEXT_LIKE_TYPES = new Set(['', 'text', 'email', 'tel', 'url', 'number', 'search'])

function isTextLike(element: Element): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLInputElement) return TEXT_LIKE_TYPES.has(element.type) && !element.disabled
  return element instanceof HTMLTextAreaElement && !element.disabled
}

function isRadio(element: Element): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === 'radio'
}

function groupKey(radio: HTMLInputElement): string {
  return `${radio.form ? 'form' : 'page'}:${radio.name}`
}

function choiceOptions(select: HTMLSelectElement): ChoiceOption[] {
  return Array.from(select.options)
    .filter((option) => option.value !== '')
    .map((option) => ({ label: option.text.trim(), value: option.value }))
}

// A dropdown whose first option is simply the default does not count as already answered.
function selectHasChoice(select: HTMLSelectElement): boolean {
  if (select.value === '' || select.selectedIndex < 0) return false
  return select.selectedIndex > 0 || (select.options[0]?.hasAttribute('selected') ?? false)
}

export function scanFields(root: ParentNode): ScannedField[] {
  const fields: Omit<ScannedField, 'id'>[] = []
  const seenGroups = new Set<string>()

  for (const element of Array.from(root.querySelectorAll('input, textarea, select'))) {
    if (isRadio(element)) {
      const key = groupKey(element)
      if (!element.name || seenGroups.has(key)) continue
      seenGroups.add(key)
      const radios = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
        (radio) => groupKey(radio) === key && !radio.disabled,
      )
      if (radios.length === 0) continue
      fields.push({
        label: readGroupLabel(radios),
        autocomplete: '',
        hasText: radios.some((radio) => radio.checked),
        kind: 'radio',
        element: radios[0] as HTMLInputElement,
        options: radios.map((radio) => ({ label: readLabel(radio), value: radio.value })),
        radios,
      })
    } else if (element instanceof HTMLSelectElement) {
      if (element.disabled) continue
      fields.push({
        label: readLabel(element),
        autocomplete: element.getAttribute('autocomplete') ?? '',
        hasText: selectHasChoice(element),
        kind: 'select',
        element,
        options: choiceOptions(element),
        radios: [],
      })
    } else if (isTextLike(element)) {
      fields.push({
        label: readLabel(element),
        autocomplete: element.getAttribute('autocomplete') ?? '',
        hasText: element.value.trim() !== '',
        kind: 'text',
        element,
        options: [],
        radios: [],
      })
    }
  }

  return fields.map((field, index) => ({ id: `f${index}`, ...field }))
}
