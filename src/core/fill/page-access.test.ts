import { describe, expect, it } from 'vitest'
import { classifyUnreadablePage, domainOf, originPatternOf } from './page-access'

describe('classifyUnreadablePage', () => {
  it('treats ordinary web pages as missing permission', () => {
    expect(classifyUnreadablePage('https://boards.greenhouse.io/acme/jobs/1', false)).toBe('no-permission')
  })

  it('treats a web page we already have permission for as unreachable, e.g. a PDF', () => {
    expect(classifyUnreadablePage('https://example.test/lowongan.pdf', true)).toBe('unreachable-page')
  })

  it('treats browser-internal pages as unreachable', () => {
    expect(classifyUnreadablePage('chrome://extensions', false)).toBe('unreachable-page')
    expect(classifyUnreadablePage('chrome-extension://abc/options.html', false)).toBe('unreachable-page')
  })

  it('treats an unknown url as unreachable', () => {
    expect(classifyUnreadablePage(undefined, false)).toBe('unreachable-page')
  })
})

describe('domainOf', () => {
  it('returns the hostname of a web page', () => {
    expect(domainOf('https://boards.greenhouse.io/acme/jobs/1')).toBe('boards.greenhouse.io')
  })

  it('returns an empty string when there is no readable web address', () => {
    expect(domainOf(undefined)).toBe('')
    expect(domainOf('chrome://extensions')).toBe('')
  })
})

describe('originPatternOf', () => {
  it('builds a match pattern for the whole site', () => {
    expect(originPatternOf('https://boards.greenhouse.io/acme/jobs/1')).toBe('https://boards.greenhouse.io/*')
  })

  it('drops the port, which match patterns do not carry', () => {
    expect(originPatternOf('http://localhost:8000/ten-fields.html')).toBe('http://localhost/*')
  })

  it('returns null for pages that cannot be granted', () => {
    expect(originPatternOf('chrome://extensions')).toBeNull()
    expect(originPatternOf(undefined)).toBeNull()
  })
})
