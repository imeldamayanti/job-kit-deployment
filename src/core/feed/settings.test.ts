import { describe, expect, it } from 'vitest'
import { createEmptyJobPreferences } from '../profile/job-preferences'
import {
  canEnableFeed,
  createDefaultSettings,
  isValidTime,
  normalizeSettings,
  originsForSource,
  setCompanies,
  setSourceEnabled,
  AI_ORIGINS,
} from './settings'

describe('createDefaultSettings', () => {
  it('starts with every source off, at 08:00, with the default model', () => {
    const settings = createDefaultSettings()
    expect(Object.values(settings.sources).every((on) => on === false)).toBe(true)
    expect(settings.fetchTime).toBe('08:00')
    expect(settings.ai).toEqual({ provider: 'anthropic', model: 'claude-haiku-5-5' })
    expect(settings.companies).toEqual({ greenhouse: [], lever: [], ashby: [] })
  })
})

describe('setSourceEnabled and setCompanies', () => {
  it('turns one source on without touching the others', () => {
    const next = setSourceEnabled(createDefaultSettings(), 'linkedin', true)
    expect(next.sources.linkedin).toBe(true)
    expect(next.sources.lever).toBe(false)
  })

  it('keeps company names trimmed and without repeats', () => {
    const next = setCompanies(createDefaultSettings(), 'lever', ['spotify', ' Spotify ', ''])
    expect(next.companies.lever).toEqual(['spotify'])
  })
})

describe('isValidTime', () => {
  it('accepts HH:MM and rejects the rest', () => {
    expect(isValidTime('08:00')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('8:00')).toBe(false)
    expect(isValidTime('')).toBe(false)
  })
})

describe('normalizeSettings', () => {
  it('returns defaults for anything unusable', () => {
    expect(normalizeSettings(undefined)).toEqual(createDefaultSettings())
    expect(normalizeSettings('x')).toEqual(createDefaultSettings())
  })

  it('keeps valid values and repairs the rest', () => {
    const result = normalizeSettings({
      sources: { greenhouse: true, bogus: true, lever: 'yes' },
      companies: { greenhouse: ['stripe', 3], nope: ['x'] },
      fetchTime: '25:99',
      ai: { provider: 'other', model: '  ' },
    })
    expect(result.sources.greenhouse).toBe(true)
    expect(result.sources.lever).toBe(false)
    expect(result.companies.greenhouse).toEqual(['stripe'])
    expect(result.fetchTime).toBe('08:00')
    expect(result.ai).toEqual({ provider: 'anthropic', model: 'claude-haiku-5-5' })
  })
})

describe('originsForSource', () => {
  it('names the hosts each source needs, and nothing for a different source', () => {
    expect(originsForSource('greenhouse')).toEqual(['https://boards-api.greenhouse.io/*'])
    expect(originsForSource('linkedin')).toEqual(['https://www.linkedin.com/*'])
    expect(AI_ORIGINS).toEqual(['https://api.anthropic.com/*'])
  })
})

describe('canEnableFeed', () => {
  it('needs at least one wanted role', () => {
    expect(canEnableFeed(createEmptyJobPreferences())).toBe(false)
    expect(canEnableFeed({ ...createEmptyJobPreferences(), roles: ['Frontend Engineer'] })).toBe(true)
  })

  it('is not satisfied by other parts alone', () => {
    expect(canEnableFeed({ ...createEmptyJobPreferences(), level: 'Mid', locations: ['Jakarta'] })).toBe(false)
  })
})
