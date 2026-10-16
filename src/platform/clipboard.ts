// Copies text for "Salin teks CV". The clipboard API needs a secure page and a click; when it is refused, a selected box
// and the old copy command still work. True when the text was copied.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the old way.
  }
  const box = document.createElement('textarea')
  box.value = text
  box.setAttribute('readonly', '')
  box.style.position = 'fixed'
  box.style.opacity = '0'
  document.body.append(box)
  box.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    box.remove()
  }
}
