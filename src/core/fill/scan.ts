import type { ChoiceOption } from '../matching/choice'
import { readGroupLabel, readLabel } from '../matching/label'
import { isRequiredLabel } from './required'

export type ScannedField = {
  id: string
  label: string
  autocomplete: string
  hasText: boolean
  // Marked required by attribute, aria-required or its label (T16, FR-20).
  required: boolean
  kind: 'text' | 'select' | 'radio'
  // A textarea (a cover letter fits only there, FR-44).
  multiline: boolean
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

function isMarkedRequired(elements: Element[], label: string): boolean {
  return elements.some((element) => (element as HTMLInputElement).required || element.getAttribute('aria-required') === 'true') || isRequiredLabel(label)
}

// Display none on the field or any ancestor, or visibility hidden on the field. Layout is not measured, so an element pushed off screen counts as visible.
function isHidden(element: Element): boolean {
  const view = element.ownerDocument.defaultView
  if (!view) return false
  if (view.getComputedStyle(element).visibility === 'hidden') return true
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.hasAttribute('hidden') || view.getComputedStyle(node).display === 'none') return true
  }
  return false
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
      const label = readGroupLabel(radios)
      const group = radios[0]?.closest('[role="radiogroup"]')
      fields.push({
        label,
        autocomplete: '',
        hasText: radios.some((radio) => radio.checked),
        required: isMarkedRequired(group ? [...radios, group] : radios, label),
        kind: 'radio',
        multiline: false,
        element: radios[0] as HTMLInputElement,
        options: radios.map((radio) => ({ label: readLabel(radio), value: radio.value })),
        radios,
      })
    } else if (element instanceof HTMLSelectElement) {
      if (element.disabled) continue
      const label = readLabel(element)
      fields.push({
        label,
        autocomplete: element.getAttribute('autocomplete') ?? '',
        hasText: selectHasChoice(element),
        required: isMarkedRequired([element], label),
        kind: 'select',
        multiline: false,
        element,
        options: choiceOptions(element),
        radios: [],
      })
    } else if (isTextLike(element)) {
      const label = readLabel(element)
      fields.push({
        label,
        autocomplete: element.getAttribute('autocomplete') ?? '',
        hasText: element.value.trim() !== '',
        required: isMarkedRequired([element], label),
        kind: 'text',
        multiline: element instanceof HTMLTextAreaElement,
        element,
        options: [],
        radios: [],
      })
    }
  }

  return fields.map((field, index) => ({ id: `f${index}`, ...field }))
}

// Whether the field holds an answer right now, read from the page and not from the scan.
export function isFieldEmpty(field: ScannedField): boolean {
  if (field.kind === 'radio') return !field.radios.some((radio) => radio.checked)
  if (field.element instanceof HTMLSelectElement) return !selectHasChoice(field.element)
  return field.element.value.trim() === ''
}

// Required, visible and still empty: what the user must fill in by hand after Fill (T16, FR-20).
export function emptyRequiredFields(fields: ScannedField[]): ScannedField[] {
  return fields.filter((field) => field.required && isFieldEmpty(field) && !isHidden(field.element))
}

// File inputs, by label, so the panel can say "Unggah manual". Read only: nothing is clicked, set or listened to (RFC D14).
export function scanUploads(root: ParentNode): { label: string }[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('input[type="file"]'))
    .filter((input) => !input.disabled)
    .map((input) => ({ label: readLabel(input) }))
}
