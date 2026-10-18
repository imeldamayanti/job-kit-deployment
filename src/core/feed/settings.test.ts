import { describe, expect, it } from 'vitest'
import { createEmptyJobPreferences } from '../profile/job-preferences'
import {
  documentModel,
  canEnableFeed,
  createDefaultSettings,
  isValidTime,
  normalizeSettings,
  originsForSource,
  setCompanies,
  setSourceEnabled,
  aiOrigins,
  setAiProvider,
  zenMayTrainOn,
  DEFAULT_DOCUMENT_LIMIT,
  normalizeDocumentLimit,
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

describe('documentLimit (FR-46)', () => {
  it('defaults to 20 CVs and letters a day', () => {
    expect(createDefaultSettings().documentLimit).toBe(20)
    expect(DEFAULT_DOCUMENT_LIMIT).toBe(20)
  })

  it('keeps a whole number from 1 to 200 and repairs anything else to the default', () => {
    expect(normalizeDocumentLimit(5)).toBe(5)
    expect(normalizeDocumentLimit(200)).toBe(200)
    for (const bad of [0, -3, 201, 2.5, NaN, '10', null, undefined]) expect(normalizeDocumentLimit(bad)).toBe(20)
  })

  it('reads it from stored settings, and settings stored before it existed get the default', () => {
    expect(normalizeSettings({ documentLimit: 8 }).documentLimit).toBe(8)
    expect(normalizeSettings({ fetchTime: '09:00' }).documentLimit).toBe(20)
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
  })
})

describe('AI provider', () => {
  it('names the host each provider needs', () => {
    expect(aiOrigins('anthropic')).toEqual(['https://api.anthropic.com/*'])
    expect(aiOrigins('opencode-zen')).toEqual(['https://opencode.ai/*'])
    expect(aiOrigins('gemini')).toEqual(['https://generativelanguage.googleapis.com/*'])
  })

  it('defaults Gemini to a Flash-Lite model', () => {
    expect(setAiProvider(createDefaultSettings(), 'gemini').ai).toEqual({ provider: 'gemini', model: 'gemini-3.5-flash-lite' })
    expect(normalizeSettings({ ai: { provider: 'gemini', model: '' } }).ai).toEqual({ provider: 'gemini', model: 'gemini-3.5-flash-lite' })
  })

  it('goes back to the new provider’s default model when the provider changes', () => {
    const next = setAiProvider({ ...createDefaultSettings(), ai: { provider: 'anthropic', model: 'custom' } }, 'opencode-zen')
    expect(next.ai).toEqual({ provider: 'opencode-zen', model: 'space-bunny-free' })
  })

  it('leaves settings alone when the provider is the same', () => {
    const settings = { ...createDefaultSettings(), ai: { provider: 'anthropic' as const, model: 'custom' } }
    expect(setAiProvider(settings, 'anthropic')).toBe(settings)
  })

  it('keeps a stored Zen choice and defaults an empty Zen model', () => {
    expect(normalizeSettings({ ai: { provider: 'opencode-zen', model: 'exo-free' } }).ai).toEqual({ provider: 'opencode-zen', model: 'exo-free' })
    expect(normalizeSettings({ ai: { provider: 'opencode-zen', model: '' } }).ai).toEqual({ provider: 'opencode-zen', model: 'space-bunny-free' })
  })

  it('flags Zen models that may be trained on, and not the zero-retention ones', () => {
    expect(zenMayTrainOn('exo-free')).toBe(true)
    expect(zenMayTrainOn('muse-spark-1.3-contributor-free')).toBe(true)
    expect(zenMayTrainOn('space-bunny-free')).toBe(false)
    expect(zenMayTrainOn(' step-5-preview-free ')).toBe(false)
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

describe('documentModel', () => {
  it('follows the scoring model unless a document model is set', () => {
    const base = createDefaultSettings()
    expect(documentModel(base)).toBe(base.ai.model)
    expect(documentModel({ ...base, ai: { ...base.ai, documentModel: '  ' } })).toBe(base.ai.model)
    expect(documentModel({ ...base, ai: { ...base.ai, documentModel: 'x' } })).toBe('x')
  })

  it('makes Claude Code score with haiku and write documents with sonnet', () => {
    const next = setAiProvider(createDefaultSettings(), 'claude-code')
    expect(next.ai).toEqual({ provider: 'claude-code', model: 'haiku', documentModel: 'sonnet' })
    expect(normalizeSettings({ ai: { provider: 'claude-code', model: 'haiku' } }).ai.documentModel).toBe('sonnet')
    expect(normalizeSettings({ ai: { provider: 'claude-code', model: 'haiku', documentModel: '' } }).ai.documentModel).toBeUndefined()
    expect(setAiProvider(next, 'gemini').ai).toEqual({ provider: 'gemini', model: 'gemini-3.5-flash-lite' })
  })
})
