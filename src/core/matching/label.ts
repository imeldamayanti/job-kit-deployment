type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

function textWithoutControls(label: HTMLLabelElement): string {
  const copy = label.cloneNode(true) as HTMLLabelElement
  copy.querySelectorAll('input, select, textarea').forEach((control) => control.remove())
  return copy.textContent?.trim() ?? ''
}

function labelledByText(element: Control): string {
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
