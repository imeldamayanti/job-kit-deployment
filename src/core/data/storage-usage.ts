const KB = 1024
const MB = KB * 1024

function trimmed(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${trimmed(bytes / MB)} MB`
  if (bytes >= KB) return `${trimmed(bytes / KB)} KB`
  return `${bytes} B`
}

export function describeUsage(used: number, quota: number): { text: string; ratio: number } {
  const ratio = quota > 0 ? Math.min(1, Math.max(0, used / quota)) : 0
  return { text: `${formatBytes(used)} dari ${formatBytes(quota)}`, ratio: Math.round(ratio * 100) / 100 }
}
