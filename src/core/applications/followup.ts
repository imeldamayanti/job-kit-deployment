import type { Application } from './types'

// FR-47. A follow-up date is a calendar day (YYYY-MM-DD, as a date input gives it), compared as text with today's.

// Today as the person sees it on their own clock.
export function todayKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Due on the day itself and every day after, until the person changes the date. A closed application (Ditolak, Dibatalkan)
// has nothing left to follow up.
export function isDue(app: Application, today: string): boolean {
  if (app.followUpAt === null || app.status === 'rejected' || app.status === 'withdrawn') return false
  return app.followUpAt <= today
}

export const dueCount = (apps: readonly Application[], today: string): number => apps.filter((app) => isDue(app, today)).length

// The overdue first, then the ones due today; each group by company.
export function dueApplications(apps: readonly Application[], today: string): Application[] {
  return apps
    .filter((app) => isDue(app, today))
    .sort((a, b) => (a.followUpAt ?? '').localeCompare(b.followUpAt ?? '') || a.job.company.localeCompare(b.job.company))
}

// "2 lamaran perlu tindak lanjut hari ini." and "Aksara Pagi dan Studio Contoh.", for the alert above the page.
export function dueSummary(apps: readonly Application[], today: string): { headline: string; names: string } | null {
  const due = dueApplications(apps, today)
  if (due.length === 0) return null
  const companies = due.map((app) => app.job.company)
  const listed =
    companies.length === 1
      ? companies[0]!
      : companies.length === 2
        ? `${companies[0]} dan ${companies[1]}`
        : companies.length === 3
          ? `${companies[0]}, ${companies[1]}, dan ${companies[2]}`
          : `${companies[0]}, ${companies[1]}, dan ${companies.length - 2} lainnya`
  return { headline: `${due.length} lamaran perlu tindak lanjut hari ini.`, names: `${listed}.` }
}
