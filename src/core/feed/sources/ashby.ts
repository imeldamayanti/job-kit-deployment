import { classifyWorkplace } from '../classify'
import { asArray, dateOnly, emptyJob, fetchBoards, text } from './shared'
import type { JobSource } from './types'

const EMPLOYMENT: Record<string, string> = {
  FullTime: 'Full-time', PartTime: 'Part-time', Contract: 'Contract', Intern: 'Internship', Temporary: 'Temporary',
}

export const ashbySource: JobSource = {
  id: 'ashby',
  fetch: (_prefs, ctx) =>
    fetchBoards(
      ctx,
      'ashby',
      (company) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company)}?includeCompensation=true`,
      (body, company) =>
        asArray((body as { jobs?: unknown } | null)?.jobs)
          .filter((job) => job.isListed !== false)
          .map((job) => {
            const title = text(job.title)
            const where = text(job.location)
            const pay = (typeof job.compensation === 'object' && job.compensation !== null ? job.compensation : {}) as Record<string, unknown>
            const kind = text(job.employmentType)
            return {
              ...emptyJob('ashby'),
              title,
              company,
              location: where,
              workplace: classifyWorkplace({ structured: text(job.workplaceType) || job.isRemote === true, location: where, title }),
              contract: EMPLOYMENT[kind] ?? kind,
              salary: text(pay.compensationTierSummary),
              postedAt: dateOnly(job.publishedAt),
              url: text(job.jobUrl),
              description: text(job.descriptionPlain),
            }
          }),
    ),
}
