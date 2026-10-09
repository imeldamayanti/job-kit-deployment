import { describe, expect, it } from 'vitest'
import { canonicalUrl, nameKey } from './dedupe'

describe('canonicalUrl', () => {
  it('drops tracking parameters, the fragment, www and a trailing slash', () => {
    expect(canonicalUrl('https://www.Example.com/jobs/1/?utm_source=x&ref=y#apply')).toBe('https://example.com/jobs/1')
  })

  it('keeps the parameter that identifies the job', () => {
    expect(canonicalUrl('https://stripe.com/jobs/search?gh_jid=8172510&gh_src=abc')).toBe('https://stripe.com/jobs/search?gh_jid=8172510')
  })

  it('drops LinkedIn result tracking', () => {
    expect(
      canonicalUrl('https://id.linkedin.com/jobs/view/senior-front-end-engineer-at-catalyst-4467855013?position=1&pageNum=0&refId=abc%3D%3D&trackingId=xyz'),
    ).toBe('https://id.linkedin.com/jobs/view/senior-front-end-engineer-at-catalyst-4467855013')
  })

  it('sorts the parameters it keeps so order does not matter', () => {
    expect(canonicalUrl('https://a.test/x?b=2&a=1')).toBe(canonicalUrl('https://a.test/x?a=1&b=2'))
  })

  it('returns an empty string for something that is not a URL', () => {
    expect(canonicalUrl('')).toBe('')
    expect(canonicalUrl('bukan url')).toBe('')
  })
})

describe('nameKey', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(nameKey('Frontend  Engineer (React)', 'PT Contoh, Karya')).toBe(nameKey('frontend engineer react', 'pt contoh karya'))
  })

  it('is empty when the title or the company is missing', () => {
    expect(nameKey('', 'PT Contoh')).toBe('')
    expect(nameKey('Engineer', '  ')).toBe('')
  })
})
