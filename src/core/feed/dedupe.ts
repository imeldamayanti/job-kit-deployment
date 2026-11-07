const TRACKING = new Set([
  'ref', 'refid', 'trackingid', 'position', 'pagenum', 'src', 'source', 'gh_src', 'lever-source', 'lever-origin',
  'fbclid', 'gclid', 'trk', 'origin', 'referrer',
])

const isTracking = (name: string) => name.toLowerCase().startsWith('utm_') || TRACKING.has(name.toLowerCase())

// The same posting reached from different places gets the same URL.
export function canonicalUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return ''
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
  const kept = [...url.searchParams.entries()].filter(([name]) => !isTracking(name)).sort(([a], [b]) => a.localeCompare(b))
  const query = new URLSearchParams(kept).toString()
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const path = url.pathname.replace(/\/+$/, '')
  return `${url.protocol}//${host}${path}${query ? `?${query}` : ''}`
}

const squash = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const LEGAL_FORMS = new Set(['pt', 'tbk', 'cv', 'persero', 'ltd', 'pte', 'inc', 'llc', 'co', 'corp', 'limited'])

// "PT Maju Tbk" and "Maju" are one company. A name that is nothing but a legal form keeps it, so it still has a key.
function companyWords(value: string): string {
  const words = squash(value).split(' ').filter(Boolean)
  const rest = words.filter((word) => !LEGAL_FORMS.has(word))
  return (rest.length > 0 ? rest : words).join(' ')
}

// Fallback identity when two sources give different URLs for the same job.
export function nameKey(title: string, company: string): string {
  const t = squash(title)
  const c = companyWords(company)
  return t === '' || c === '' ? '' : `${t}|${c}`
}
