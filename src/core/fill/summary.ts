export function formatFillSummary(filled: number, skipped: number): string {
  return `${filled} field terisi · ${skipped} dilewati`
}

export function matchPercent(matched: number, total: number): number {
  return total > 0 ? Math.round((matched / total) * 100) : 0
}

// FR-20: the fields the user still has to fill in are outlined on the page, and the panel says so.
export function formatMarkedNotice(marked: number): string | undefined {
  return marked > 0 ? `${marked} field wajib belum terisi, sudah ditandai kuning di halaman.` : undefined
}
