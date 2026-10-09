type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

function textWithoutControls(label: HTMLLabelElement): string {
  const copy = label.cloneNode(true) as HTMLLabelElement
  copy.querySelectorAll('input, select, textarea').forEach((control) => control.remove())
  return copy.textContent?.trim() ?? ''
}

function labelledByText(element: Element): string {
  const ids = element.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
}

export function readLabel(element: Control): string {
  const label = element.labels?.[0]
  return (
    (label && textWithoutControls(label)) ||
    labelledByText(element) ||
    element.getAttribute('aria-label')?.trim() ||
    element.getAttribute('placeholder')?.trim() ||
    element.name ||
    element.id
  )
}

// The question a group of radio buttons answers: the fieldset legend, or the radiogroup's own label.
export function readGroupLabel(radios: HTMLInputElement[]): string {
  const first = radios[0]
  if (!first) return ''
  const legend = first.closest('fieldset')?.querySelector('legend')?.textContent?.trim()
  if (legend) return legend
  const group = first.closest('[role="radiogroup"], [role="group"]')
  if (group) {
    const text = labelledByText(group) || group.getAttribute('aria-label')?.trim()
    if (text) return text
  }
  return first.name || first.id
}
