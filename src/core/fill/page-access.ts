export type UnreadableReason = 'no-permission' | 'unreachable-page'

export function classifyUnreadablePage(url: string | undefined): UnreadableReason {
  if (url && /^https?:\/\//.test(url)) return 'no-permission'
  return 'unreachable-page'
}

export function domainOf(url: string | undefined): string {
  if (!url || !/^https?:\/\//.test(url)) return ''
  return new URL(url).hostname
}

export function originPatternOf(url: string | undefined): string | null {
  if (!url || !/^https?:\/\//.test(url)) return null
  const { protocol, hostname } = new URL(url)
  return `${protocol}//${hostname}/*`
}
