import type { CapturedJob, JobFilter } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function filterJobs(jobs: readonly CapturedJob[], { query, status }: { query: string; status: JobFilter }): CapturedJob[] {
  const needle = query.trim().toLowerCase()
  return jobs.filter((job) => {
    if (status !== 'Semua' && job.status !== status) return false
    if (needle === '') return true
    return [job.title, job.company, job.origin].some((text) => text.toLowerCase().includes(needle))
  })
}

export function formatJobDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
  return letters || '?'
}
