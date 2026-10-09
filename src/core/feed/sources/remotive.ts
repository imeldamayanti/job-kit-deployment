import { asArray, dateOnly, describe, emptyJob, text } from './shared'
import { fetchJson } from './http'
import type { JobSource } from './types'

const JOB_TYPE: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', freelance: 'Freelance', internship: 'Internship',
}

export const remotiveSource: JobSource = {
  id: 'remotive',
  async fetch(prefs, ctx) {
    // The board is small and rate limited, so search per wanted role (at most three).
    const urls =
      prefs.roles.length > 0
        ? prefs.roles.slice(0, 3).map((role) => `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(role)}`)
        : ['https://remotive.com/api/remote-jobs?category=software-dev']
    const jobs = []
    for (const url of urls) {
      const body = await fetchJson(ctx, url)
      for (const job of asArray((body as { jobs?: unknown } | null)?.jobs)) {
        jobs.push({
          ...emptyJob('remotive'),
          title: text(job.title),
          company: text(job.company_name),
          location: text(job.candidate_required_location),
          workplace: 'remote' as const,
          contract: JOB_TYPE[text(job.job_type)] ?? '',
          salary: text(job.salary),
          postedAt: dateOnly(job.publication_date),
          url: text(job.url),
          description: describe(job.description),
          logoUrl: text(job.company_logo_url || job.company_logo),
        })
      }
    }
    return jobs
  },
}
