import type { Workplace } from './types'

type Hints = { structured?: string | boolean; location: string; title: string }

function fromStructured(value: string | boolean | undefined): Workplace {
  if (value === true) return 'remote'
  if (typeof value !== 'string') return 'unknown'
  const word = value.toLowerCase().replace(/[^a-z]/g, '')
  if (word === 'remote') return 'remote'
  if (word === 'hybrid') return 'hybrid'
  if (['onsite', 'office', 'inoffice'].includes(word)) return 'onsite'
  return 'unknown'
}

const HYBRID = /(?<![\p{L}\p{N}])hybrid(?![\p{L}\p{N}])/iu
const REMOTE = /(?<![\p{L}\p{N}])(remote|wfh|work from home|anywhere|worldwide)(?![\p{L}\p{N}])/iu

// Remote, hybrid or on-site (FR-28): the source's own field first, then the words in the text.
export function classifyWorkplace({ structured, location, title }: Hints): Workplace {
  const known = fromStructured(structured)
  if (known !== 'unknown') return known
  const text = `${location} ${title}`
  if (HYBRID.test(text)) return 'hybrid'
  if (REMOTE.test(text)) return 'remote'
  return 'unknown'
}
