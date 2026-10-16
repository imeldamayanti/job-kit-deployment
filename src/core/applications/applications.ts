import type { Job } from '../feed/types'
import type { AppEvent, AppStatus, Application, ApplicationData, CoverLetter, TailoredCv } from './types'

export const findByJobId = (apps: readonly Application[], jobId: string): Application | undefined =>
  apps.find((app) => app.jobId === jobId)

export type CreateResult = { apps: Application[]; app: Application; created: boolean }

// One application per job: asking again for a job that has one returns it and changes nothing (FR-34).
export function createApplication(apps: Application[], job: Job, now: Date, newId: () => string): CreateResult {
  const existing = findByJobId(apps, job.id)
  if (existing) return { apps, app: existing, created: false }
  const at = now.toISOString()
  const app: Application = {
    id: newId(),
    jobId: job.id,
    job: { title: job.title, company: job.company, url: job.url, source: job.source, description: job.description, capturedAt: at },
    // A job already marked applied keeps that, so the application and the feed do not disagree from the start.
    status: job.status === 'applied' ? 'applied' : 'draft',
    cvId: null,
    letterId: null,
    followUpAt: null,
    notes: '',
    events: [{ at, type: 'created' }],
    createdAt: at,
    updatedAt: at,
  }
  return { apps: [...apps, app], app, created: true }
}

export type ManualInput = { title: string; company: string; url: string; description: string; status: 'draft' | 'applied' }

// "Lamaran manual": a job the feed did not recommend, typed in by hand. Only a title and a company are needed.
export type ManualErrors = { title?: string; company?: string; url?: string }

const isWebUrl = (text: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(text).protocol)
  } catch {
    return false
  }
}

export function validateManual(input: ManualInput): ManualErrors {
  const errors: ManualErrors = {}
  if (input.title.trim() === '') errors.title = 'Isi judul lowongan.'
  if (input.company.trim() === '') errors.company = 'Isi nama perusahaan.'
  if (input.url.trim() !== '' && !isWebUrl(input.url.trim())) errors.url = 'Link harus diawali http:// atau https://.'
  return errors
}

// The same posting by link, ignoring the case of the host and a trailing slash. No link never matches.
function linkKey(url: string): string {
  try {
    const parsed = new URL(url.trim())
    return `${parsed.host}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`
  } catch {
    return ''
  }
}

const withEvent = (app: Application, event: AppEvent, now: Date): Application => ({
  ...app,
  events: [...app.events, event],
  updatedAt: now.toISOString(),
})

export function setStatus(app: Application, status: AppStatus, now: Date, text?: string): Application {
  if (app.status === status) return app
  const event: AppEvent = { at: now.toISOString(), type: 'status', from: app.status, to: status, ...(text ? { text } : {}) }
  return withEvent({ ...app, status }, event, now)
}

const replaceApp = (apps: Application[], next: Application) => apps.map((app) => (app.id === next.id ? next : app))

// Only a draft moves forward, to applied. Anything further stays where it is (FR-36, PRD §8).
export const advanceApplication = (app: Application, now: Date, text: string): Application =>
  app.status === 'draft' ? setStatus(app, 'applied', now, text) : app

// Fill worked in a tab from the Lowongan page: the same, and a job without an application gets one first.
export function advanceOnFill(
  apps: Application[],
  job: Job,
  now: Date,
  newId: () => string,
  text: string,
): { apps: Application[]; app: Application } {
  const made = createApplication(apps, job, now, newId)
  const app = advanceApplication(made.app, now, text)
  return { apps: app === made.app ? made.apps : replaceApp(made.apps, app), app }
}

export type ApplicationPatch = { notes?: string; followUpAt?: string | null; description?: string; url?: string }

// Notes, follow-up date and pasted posting text. History and status are not touched.
export function updateApplication(app: Application, patch: ApplicationPatch, now: Date): Application {
  return {
    ...app,
    notes: patch.notes ?? app.notes,
    followUpAt: patch.followUpAt === undefined ? app.followUpAt : patch.followUpAt,
    job: {
      ...app.job,
      description: patch.description ?? app.job.description,
      url: patch.url === undefined ? app.job.url : patch.url.trim(),
    },
    updatedAt: now.toISOString(),
  }
}

// Deleting an application deletes its CV and letter too (FR-38).
export function deleteApplication(data: ApplicationData, id: string): ApplicationData {
  const app = data.applications.find((item) => item.id === id)
  if (!app) return data
  return {
    applications: data.applications.filter((item) => item.id !== id),
    cvs: data.cvs.filter((cv) => cv.applicationId !== id && cv.id !== app.cvId),
    letters: data.letters.filter((letter) => letter.applicationId !== id && letter.id !== app.letterId),
  }
}

// A new CV replaces the earlier one of the same application (the body lives in its own key, RFC §3.3c) and the
// history says which it was. The failure case never gets here: a rejected answer leaves the old CV as it was.
export function attachCv(data: ApplicationData, cv: TailoredCv, now: Date): ApplicationData {
  const app = data.applications.find((item) => item.id === cv.applicationId)
  if (!app) return data
  const event: AppEvent = { at: now.toISOString(), type: 'cv', text: app.cvId ? 'CV dibuat ulang' : 'CV dibuat' }
  return {
    ...data,
    applications: replaceApp(data.applications, withEvent({ ...app, cvId: cv.id }, event, now)),
    cvs: [...data.cvs.filter((item) => item.id !== app.cvId && item.applicationId !== app.id), cv],
  }
}

// The same for a letter (T51): one letter per application, and the history says whether it is the first.
export function attachLetter(data: ApplicationData, letter: CoverLetter, now: Date): ApplicationData {
  const app = data.applications.find((item) => item.id === letter.applicationId)
  if (!app) return data
  const event: AppEvent = { at: now.toISOString(), type: 'letter', text: app.letterId ? 'Surat dibuat ulang' : 'Surat dibuat' }
  return {
    ...data,
    applications: replaceApp(data.applications, withEvent({ ...app, letterId: letter.id }, event, now)),
    letters: [...data.letters.filter((item) => item.id !== app.letterId && item.applicationId !== app.id), letter],
  }
}

// The CV was downloaded (FR-37, FR-42): one line in the history.
export const noteDownload = (app: Application, now: Date): Application => withEvent(app, { at: now.toISOString(), type: 'download' }, now)

// One application per posting here too: a link that an application already has returns that one.
export function createManualApplication(apps: Application[], input: ManualInput, now: Date, newId: () => string): CreateResult {
  const url = input.url.trim()
  const key = linkKey(url)
  const existing = key === '' ? undefined : apps.find((app) => linkKey(app.job.url) === key)
  if (existing) return { apps, app: existing, created: false }
  const at = now.toISOString()
  const draft: Application = {
    id: newId(),
    jobId: null,
    job: { title: input.title.trim(), company: input.company.trim(), url, source: 'manual', description: input.description.trim(), capturedAt: at },
    status: 'draft',
    cvId: null,
    letterId: null,
    followUpAt: null,
    notes: '',
    events: [{ at, type: 'created' }],
    createdAt: at,
    updatedAt: at,
  }
  const app = input.status === 'applied' ? setStatus(draft, 'applied', now, 'Ditambahkan manual') : draft
  return { apps: [...apps, app], app, created: true }
}
