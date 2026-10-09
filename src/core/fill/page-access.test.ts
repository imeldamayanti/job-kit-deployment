import { describe, expect, it } from 'vitest'
import { classifyUnreadablePage, domainOf } from './page-access'

describe('classifyUnreadablePage', () => {
  it('treats ordinary web pages as missing permission', () => {
    expect(classifyUnreadablePage('https://boards.greenhouse.io/acme/jobs/1')).toBe('no-permission')
  })

  it('treats browser-internal pages as unreachable', () => {
    expect(classifyUnreadablePage('chrome://extensions')).toBe('unreachable-page')
    expect(classifyUnreadablePage('chrome-extension://abc/options.html')).toBe('unreachable-page')
  })

  it('treats an unknown url as unreachable', () => {
    expect(classifyUnreadablePage(undefined)).toBe('unreachable-page')
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
