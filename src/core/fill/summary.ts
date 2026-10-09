export function formatFillSummary(filled: number, skipped: number): string {
  return `${filled} field terisi · ${skipped} dilewati`
}

export function matchPercent(matched: number, total: number): number {
  return total > 0 ? Math.round((matched / total) * 100) : 0
}
