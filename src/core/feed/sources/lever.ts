import { classifyWorkplace } from '../classify'
import { asArray, dateOnly, emptyJob, fetchBoards, text } from './shared'
import type { JobSource } from './types'

export const leverSource: JobSource = {
  id: 'lever',
  fetch: (_prefs, ctx) =>
    fetchBoards(
      ctx,
      'lever',
      // A full board can be over a megabyte and slow, so ask for a bounded page.
      (company) => `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json&limit=100`,
      (body, company) =>
        asArray(body).map((job) => {
          const categories = (typeof job.categories === 'object' && job.categories !== null ? job.categories : {}) as Record<string, unknown>
          const places = Array.isArray(categories.allLocations) ? categories.allLocations.map(text).filter(Boolean) : []
          const where = places.join(', ') || text(categories.location)
          const title = text(job.text)
          return {
            ...emptyJob('lever'),
            title,
            company,
            location: where,
            workplace: classifyWorkplace({ structured: text(job.workplaceType), location: where, title }),
            contract: text(categories.commitment),
            postedAt: dateOnly(Number(job.createdAt)),
            url: text(job.hostedUrl),
            description: text(job.descriptionPlain),
          }
        }),
    ),
}
