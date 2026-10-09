const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) return String.fromCodePoint(parseInt(body.slice(2), 16))
    if (body.startsWith('#')) return String.fromCodePoint(Number(body.slice(1)))
    return NAMED[body.toLowerCase()] ?? whole
  })
}

const BLOCK = /<\/?(p|div|br|li|ul|ol|h[1-6]|tr|section|article)\b[^>]*>/gi

// Job descriptions come as HTML, sometimes escaped (Greenhouse). Prompts and search want plain lines.
export function htmlToText(html: string): string {
  const markup = html.includes('<') ? html : decodeEntities(html)
  const text = decodeEntities(
    markup
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
      .replace(BLOCK, '\n')
      .replace(/<[^>]*>/g, ''),
  )
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n')
}

export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`
}
