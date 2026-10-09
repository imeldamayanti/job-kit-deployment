import { addListItem, type JobPreferences } from '../profile/job-preferences'
import { JOB_SOURCE_IDS, type JobSourceId } from './types'

export const ATS_SOURCES = ['greenhouse', 'lever', 'ashby'] as const
export type AtsSource = (typeof ATS_SOURCES)[number]

export const DEFAULT_MODEL = 'claude-haiku-5-5'
export const DEFAULT_TIME = '08:00'

export type FeedSettings = {
  sources: Record<JobSourceId, boolean>
  companies: Record<AtsSource, string[]>
  // Local time of the daily run, HH:MM.
  fetchTime: string
  ai: { provider: 'anthropic'; model: string }
}

const ORIGINS: Record<JobSourceId, string[]> = {
  greenhouse: ['https://boards-api.greenhouse.io/*'],
  lever: ['https://api.lever.co/*'],
  ashby: ['https://api.ashbyhq.com/*'],
  remotive: ['https://remotive.com/*'],
  linkedin: ['https://www.linkedin.com/*'],
}

export const AI_ORIGINS = ['https://api.anthropic.com/*']

// Asked for when the user turns a source on, never at install (FR-32).
export const originsForSource = (source: JobSourceId): string[] => ORIGINS[source]

export function createDefaultSettings(): FeedSettings {
  return {
    sources: Object.fromEntries(JOB_SOURCE_IDS.map((id) => [id, false])) as FeedSettings['sources'],
    companies: { greenhouse: [], lever: [], ashby: [] },
    fetchTime: DEFAULT_TIME,
    ai: { provider: 'anthropic', model: DEFAULT_MODEL },
  }
}

export const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

export function setSourceEnabled(settings: FeedSettings, source: JobSourceId, on: boolean): FeedSettings {
  return { ...settings, sources: { ...settings.sources, [source]: on } }
}

export function setCompanies(settings: FeedSettings, source: AtsSource, names: string[]): FeedSettings {
  const clean = names.reduce(addListItem, [] as string[])
  return { ...settings, companies: { ...settings.companies, [source]: clean } }
}

// Reads what was stored, keeping only what this version knows.
export function normalizeSettings(raw: unknown): FeedSettings {
  const base = createDefaultSettings()
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return base
  const source = raw as Record<string, unknown>
  const sources = (typeof source.sources === 'object' && source.sources !== null ? source.sources : {}) as Record<string, unknown>
  const companies = (typeof source.companies === 'object' && source.companies !== null ? source.companies : {}) as Record<string, unknown>
  const ai = (typeof source.ai === 'object' && source.ai !== null ? source.ai : {}) as Record<string, unknown>
  return {
    sources: Object.fromEntries(JOB_SOURCE_IDS.map((id) => [id, sources[id] === true])) as FeedSettings['sources'],
    companies: Object.fromEntries(
      ATS_SOURCES.map((id) => [id, (Array.isArray(companies[id]) ? (companies[id] as unknown[]) : []).filter((n): n is string => typeof n === 'string').reduce(addListItem, [] as string[])]),
    ) as FeedSettings['companies'],
    fetchTime: typeof source.fetchTime === 'string' && isValidTime(source.fetchTime) ? source.fetchTime : DEFAULT_TIME,
    ai: { provider: 'anthropic', model: typeof ai.model === 'string' && ai.model.trim() !== '' ? ai.model.trim() : DEFAULT_MODEL },
  }
}

// The feed needs something to search for (PRD §8: it cannot be turned on with empty preferences).
export const canEnableFeed = (prefs: JobPreferences): boolean => prefs.roles.length > 0
