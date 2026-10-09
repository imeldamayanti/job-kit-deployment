export type UnreadableReason = 'no-permission' | 'unreachable-page'

// A web page we could not read is either one we lack permission for, or one the browser keeps closed (PDF, error pages).
export function classifyUnreadablePage(url: string | undefined, hasAccess: boolean): UnreadableReason {
  if (url && /^https?:\/\//.test(url) && !hasAccess) return 'no-permission'
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
