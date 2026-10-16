import { addListItem, type JobPreferences } from '../profile/job-preferences'
import { JOB_SOURCE_IDS, type JobSourceId } from './types'

export const ATS_SOURCES = ['greenhouse', 'lever', 'ashby'] as const
export type AtsSource = (typeof ATS_SOURCES)[number]

export const AI_PROVIDERS = ['anthropic', 'gemini', 'opencode-zen'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-haiku-5-5',
  gemini: 'gemini-3.5-flash-lite',
  'opencode-zen': 'space-bunny-free',
}
export const DEFAULT_TIME = '08:00'
// Calls a day for CVs and letters (FR-46), apart from the 50 for scoring jobs.
export const DEFAULT_DOCUMENT_LIMIT = 20
export const MAX_DOCUMENT_LIMIT = 200

// Zen free models the docs promise are not kept or trained on; every other model there may be.
const ZEN_PRIVATE_MODELS = ['space-bunny-free', 'longcat-2.5-preview-free', 'step-5-preview-free']
export const zenMayTrainOn = (model: string): boolean => !ZEN_PRIVATE_MODELS.includes(model.trim())

export type FeedSettings = {
  sources: Record<JobSourceId, boolean>
  companies: Record<AtsSource, string[]>
  // Local time of the daily run, HH:MM.
  fetchTime: string
  ai: { provider: AiProvider; model: string }
  // Most CVs and letters the AI may write in one day.
  documentLimit: number
}

const ORIGINS: Record<JobSourceId, string[]> = {
  greenhouse: ['https://boards-api.greenhouse.io/*'],
  lever: ['https://api.lever.co/*'],
  ashby: ['https://api.ashbyhq.com/*'],
  remotive: ['https://remotive.com/*'],
  linkedin: ['https://www.linkedin.com/*'],
}

const AI_ORIGINS: Record<AiProvider, string[]> = {
  anthropic: ['https://api.anthropic.com/*'],
  gemini: ['https://generativelanguage.googleapis.com/*'],
  'opencode-zen': ['https://opencode.ai/*'],
}

export const aiOrigins = (provider: AiProvider): string[] => AI_ORIGINS[provider]

// Asked for when the user turns a source on, never at install (FR-32).
export const originsForSource = (source: JobSourceId): string[] => ORIGINS[source]

export function createDefaultSettings(): FeedSettings {
  return {
    sources: Object.fromEntries(JOB_SOURCE_IDS.map((id) => [id, false])) as FeedSettings['sources'],
    companies: { greenhouse: [], lever: [], ashby: [] },
    fetchTime: DEFAULT_TIME,
    ai: { provider: 'anthropic', model: DEFAULT_MODELS.anthropic },
    documentLimit: DEFAULT_DOCUMENT_LIMIT,
  }
}

// A different provider needs a different model name, so the model goes back to that provider's default.
export const setAiProvider = (settings: FeedSettings, provider: AiProvider): FeedSettings =>
  provider === settings.ai.provider ? settings : { ...settings, ai: { provider, model: DEFAULT_MODELS[provider] } }

export const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

export function setSourceEnabled(settings: FeedSettings, source: JobSourceId, on: boolean): FeedSettings {
  return { ...settings, sources: { ...settings.sources, [source]: on } }
}

export function setCompanies(settings: FeedSettings, source: AtsSource, names: string[]): FeedSettings {
  const clean = names.reduce(addListItem, [] as string[])
  return { ...settings, companies: { ...settings.companies, [source]: clean } }
}

// A whole number from 1 to 200; anything else is the default (a settings file from before T48 has none).
export function normalizeDocumentLimit(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_DOCUMENT_LIMIT ? value : DEFAULT_DOCUMENT_LIMIT
}

// Reads what was stored, keeping only what this version knows.
export function normalizeSettings(raw: unknown): FeedSettings {
  const base = createDefaultSettings()
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return base
  const source = raw as Record<string, unknown>
  const sources = (typeof source.sources === 'object' && source.sources !== null ? source.sources : {}) as Record<string, unknown>
  const companies = (typeof source.companies === 'object' && source.companies !== null ? source.companies : {}) as Record<string, unknown>
  const ai = (typeof source.ai === 'object' && source.ai !== null ? source.ai : {}) as Record<string, unknown>
  const provider = AI_PROVIDERS.find((id) => id === ai.provider) ?? 'anthropic'
  return {
    sources: Object.fromEntries(JOB_SOURCE_IDS.map((id) => [id, sources[id] === true])) as FeedSettings['sources'],
    companies: Object.fromEntries(
      ATS_SOURCES.map((id) => [id, (Array.isArray(companies[id]) ? (companies[id] as unknown[]) : []).filter((n): n is string => typeof n === 'string').reduce(addListItem, [] as string[])]),
    ) as FeedSettings['companies'],
    fetchTime: typeof source.fetchTime === 'string' && isValidTime(source.fetchTime) ? source.fetchTime : DEFAULT_TIME,
    ai: { provider, model: typeof ai.model === 'string' && ai.model.trim() !== '' ? ai.model.trim() : DEFAULT_MODELS[provider] },
    documentLimit: normalizeDocumentLimit(source.documentLimit),
  }
}

// The feed needs something to search for (PRD §8: it cannot be turned on with empty preferences).
export const canEnableFeed = (prefs: JobPreferences): boolean => prefs.roles.length > 0
