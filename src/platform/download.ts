// Saves text as a file through the browser's normal download flow. Needs no extension permission.
export function downloadText(fileName: string, text: string, type = 'application/json'): void {
  saveBlob(fileName, new Blob([text], { type }))
}

// The same for bytes, such as the CV as a PDF.
export function downloadBytes(fileName: string, bytes: Uint8Array, type: string): void {
  saveBlob(fileName, new Blob([bytes as BlobPart], { type }))
}

function saveBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
