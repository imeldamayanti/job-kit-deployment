import { classifyWorkplace } from '../classify'
import { asArray, describe, emptyJob, fetchBoards, text, dateOnly } from './shared'
import type { JobSource } from './types'

function location(job: Record<string, unknown>): string {
  const place = job.location
  return typeof place === 'object' && place !== null ? text((place as Record<string, unknown>).name) : ''
}

export const greenhouseSource: JobSource = {
  id: 'greenhouse',
  fetch: (_prefs, ctx) =>
    fetchBoards(
      ctx,
      'greenhouse',
      (company) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs?content=true`,
      (body, company) =>
        asArray((body as { jobs?: unknown } | null)?.jobs).map((job) => {
          const title = text(job.title)
          const where = location(job)
          return {
            ...emptyJob('greenhouse'),
            title,
            company: text(job.company_name) || company,
            location: where,
            workplace: classifyWorkplace({ location: where, title }),
            postedAt: dateOnly(job.first_published ?? job.updated_at),
            deadline: dateOnly(job.application_deadline),
            url: text(job.absolute_url),
            description: describe(job.content),
          }
        }),
    ),
}
