import { readLabel } from '../matching/label'

export type ScannedField = {
  id: string
  label: string
  autocomplete: string
  hasText: boolean
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
}

const TEXT_LIKE_TYPES = new Set(['', 'text', 'email', 'tel', 'url', 'number', 'search'])

function isReadable(element: Element): element is ScannedField['element'] {
  if (element instanceof HTMLInputElement) return TEXT_LIKE_TYPES.has(element.type) && !element.disabled
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return !element.disabled
  return false
}

export function scanFields(root: ParentNode): ScannedField[] {
  return Array.from(root.querySelectorAll('input, textarea, select'))
    .filter(isReadable)
    .map((element, index) => ({
      id: `f${index}`,
      label: readLabel(element),
      autocomplete: element.getAttribute('autocomplete') ?? '',
      hasText: element.value.trim() !== '',
      element,
    }))
}
