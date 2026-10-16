import {
  advanceApplication,
  advanceOnFill,
  createApplication,
  createManualApplication,
  type ManualInput,
  deleteApplication,
  findByJobId,
  setStatus,
  updateApplication,
  type ApplicationPatch,
} from '../core/applications/applications'
import { releaseJob, syncFeed, syncJobStatus } from '../core/applications/sync'
import type { AppStatus, Application } from '../core/applications/types'
import type { OpenedJob } from '../core/feed/opened'
import type { Job } from '../core/feed/types'
import type { SaveOutcome } from '../core/profile/autosave'
import { loadApplicationData, loadApplications, saveApplicationData, saveApplications } from './application-storage'
import { loadFeed, saveFeed } from './feed-storage'

// The application is the source of truth (D11). Every change here saves the application first and then
// brings the job in the feed in line with it, so the two cannot end up disagreeing.

const newId = () => crypto.randomUUID()
const replaceApp = (apps: Application[], next: Application) => apps.map((app) => (app.id === next.id ? next : app))

async function followWithFeed(app: Application): Promise<void> {
  const feed = await loadFeed()
  const next = syncJobStatus(feed, app)
  if (next !== feed) await saveFeed(next)
}

// After a change that did not go through the functions below (an Import), line the whole feed up.
export async function syncFeedWithApplications(): Promise<void> {
  const feed = await loadFeed()
  const next = syncFeed(feed, await loadApplications())
  if (next !== feed) await saveFeed(next)
}

export type PrepareResult = { ok: true; app: Application; created: boolean } | { ok: false; reason: 'storage-full' }

// "Siapkan lamaran" (FR-34): one application per job. The job becomes saved along with it.
export async function prepareApplication(job: Job, now = new Date()): Promise<PrepareResult> {
  const made = createApplication(await loadApplications(), job, now, newId)
  if (made.created) {
    const saved = await saveApplications(made.apps)
    if (!saved.ok) return saved
  }
  await followWithFeed(made.app)
  return { ok: true, app: made.app, created: made.created }
}

// "Tambah lamaran": a job the feed did not recommend. It has no feed job, so there is nothing to sync.
export async function addManualApplication(input: ManualInput, now = new Date()): Promise<PrepareResult> {
  const made = createManualApplication(await loadApplications(), input, now, newId)
  if (made.created) {
    const saved = await saveApplications(made.apps)
    if (!saved.ok) return saved
  }
  return { ok: true, app: made.app, created: made.created }
}

// A job without an application gets one; one that has an application only moves if it is still a draft.
// A job the feed pruned is still moved when its application exists, and ignored when neither does.
async function advanceJob(jobId: string, text: string, now: Date): Promise<Application | undefined> {
  return (await advanceJobWithStatus(jobId, text, now))?.app
}

type Advanced = { app: Application; advanced: boolean }

async function advanceJobWithStatus(jobId: string, text: string, now: Date): Promise<Advanced | undefined> {
  const apps = await loadApplications()
  const existing = findByJobId(apps, jobId)
  let app: Application
  if (existing) {
    app = advanceApplication(existing, now, text)
    if (app !== existing) await saveApplications(replaceApp(apps, app))
    await followWithFeed(app)
    return { app, advanced: app !== existing }
  }
  const job = (await loadFeed()).find((item) => item.id === jobId)
  if (!job) return undefined
  const made = advanceOnFill(apps, job, now, newId, text)
  await saveApplications(made.apps)
  await followWithFeed(made.app)
  return { app: made.app, advanced: made.app.status === 'applied' }
}

// Fill worked in a tab opened from Lowongan (FR-36).
export const recordFill = (jobId: string, filled: number, now = new Date()) =>
  advanceJob(jobId, `Fill berhasil, ${filled} field`, now)

// What the panel tells the person after Fill (S1): which application, where it stands, and whether this Fill moved it.
export type FillRecord = { applicationId: string; company: string; status: AppStatus; advanced: boolean }

// Fill worked in a tab from Buka & isi. A tab opened from an application is that application, even one with no feed job;
// a tab that names only a feed job goes by the job, as before.
export async function recordOpenedFill(opened: Pick<OpenedJob, 'jobId' | 'applicationId'>, filled: number, now = new Date()): Promise<FillRecord | undefined> {
  const text = `Fill berhasil, ${filled} field`
  let result: Advanced | undefined
  if (opened.applicationId) {
    const apps = await loadApplications()
    const existing = apps.find((app) => app.id === opened.applicationId)
    if (existing) {
      const app = advanceApplication(existing, now, text)
      if (app !== existing) await saveApplications(replaceApp(apps, app))
      await followWithFeed(app)
      result = { app, advanced: app !== existing }
    }
  } else if (opened.jobId !== '') {
    result = await advanceJobWithStatus(opened.jobId, text, now)
  }
  return result && { applicationId: result.app.id, company: result.app.job.company, status: result.app.status, advanced: result.advanced }
}

// "Tandai dilamar" on a card goes through an application too.
export const markJobApplied = (jobId: string, now = new Date()) => advanceJob(jobId, 'Ditandai dilamar', now)

export async function changeApplicationStatus(id: string, status: AppStatus, now = new Date()): Promise<SaveOutcome> {
  const apps = await loadApplications()
  const app = apps.find((item) => item.id === id)
  if (!app) return { ok: true }
  const next = setStatus(app, status, now)
  const saved = await saveApplications(replaceApp(apps, next))
  if (saved.ok) await followWithFeed(next)
  return saved
}

export async function patchApplication(id: string, patch: ApplicationPatch, now = new Date()): Promise<SaveOutcome> {
  const apps = await loadApplications()
  const app = apps.find((item) => item.id === id)
  if (!app) return { ok: true }
  return saveApplications(replaceApp(apps, updateApplication(app, patch, now)))
}

// Deleting takes the CV and the letter along (FR-38). The job stays in the feed as saved.
export async function removeApplication(id: string): Promise<SaveOutcome> {
  const data = await loadApplicationData()
  const app = data.applications.find((item) => item.id === id)
  if (!app) return { ok: true }
  const saved = await saveApplicationData(deleteApplication(data, id))
  if (!saved.ok) return saved
  const feed = await loadFeed()
  const next = releaseJob(feed, app)
  if (next !== feed) await saveFeed(next)
  return saved
}
