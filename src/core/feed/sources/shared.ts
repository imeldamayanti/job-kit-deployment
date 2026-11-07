import { htmlToText, truncateText } from '../text'
import type { JobSourceId, RawJob } from '../types'
import { fetchJson } from './http'
import { SourceError, type FetchContext } from './types'

export const DESCRIPTION_LIMIT = 4000

export const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export function dateOnly(value: unknown): string {
  const time = typeof value === 'number' ? value : Date.parse(text(value))
  return Number.isNaN(time) ? '' : new Date(time).toISOString().slice(0, 10)
}

export const describe = (html: unknown): string => truncateText(htmlToText(text(html)), DESCRIPTION_LIMIT)

export function emptyJob(source: JobSourceId): RawJob {
  return {
    source, title: '', company: '', location: '', workplace: 'unknown', contract: '', level: '', salary: '',
    experience: '', postedAt: '', deadline: '', url: '', description: '', logoUrl: '',
  }
}

export function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new SourceError('parse')
  return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Pages of one site, read one after another with a short random pause so they do not come in a burst. A page that fails
// is skipped; the source fails only when every one does. A refusal stops the rest: asking again is what gets a client banned.
export async function collectPages(ctx: FetchContext, urls: string[], load: (url: string) => Promise<RawJob[]>): Promise<RawJob[]> {
  const jobs: RawJob[] = []
  let firstError: SourceError | null = null
  let worked = 0
  for (const [index, url] of urls.entries()) {
    if (index > 0) await (ctx.sleep ?? defaultSleep)(1000 + Math.random() * 1500)
    try {
      jobs.push(...(await load(url)))
      worked += 1
    } catch (error) {
      if (!(error instanceof SourceError)) throw error
      firstError ??= error
      if (error.reason === 'blocked') break
    }
  }
  if (urls.length > 0 && worked === 0 && firstError) throw firstError
  return jobs
}

// Company boards: each company is its own request; the source only fails when every one does.
export async function fetchBoards(
  ctx: FetchContext,
  id: JobSourceId,
  urlFor: (company: string) => string,
  parse: (body: unknown, company: string) => RawJob[],
): Promise<RawJob[]> {
  const companies = ctx.companies[id] ?? []
  const jobs: RawJob[] = []
  let firstError: SourceError | null = null
  let worked = 0
  for (const company of companies) {
    try {
      jobs.push(...parse(await fetchJson(ctx, urlFor(company)), company))
      worked += 1
    } catch (error) {
      if (!(error instanceof SourceError)) throw error
      firstError ??= error
    }
  }
  if (companies.length > 0 && worked === 0 && firstError) throw firstError
  return jobs
}
