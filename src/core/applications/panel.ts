import type { OpenedJob } from '../feed/opened'
import { cvFileName } from '../tailor/pdf-layout'
import { findByJobId } from './applications'
import type { Application, ApplicationData } from './types'

// The application behind a tab opened by Buka & isi: the one it was opened from, else the one of its feed job.
export function resolveApplication(opened: Pick<OpenedJob, 'jobId' | 'applicationId'>, apps: readonly Application[]): Application | undefined {
  if (opened.applicationId) return apps.find((app) => app.id === opened.applicationId)
  return opened.jobId === '' ? undefined : findByJobId(apps, opened.jobId)
}

// What the side panel needs from an application (S1): the markers, the letter to fill, and the CV file to point at.
export type PanelContext = {
  applicationId: string
  company: string
  cvReady: boolean
  letterReady: boolean
  coverLetter: string
  cvFile: string
  cvDownloaded: boolean
}

export function panelContext(app: Application, data: ApplicationData): PanelContext {
  const letter = app.letterId === null ? undefined : data.letters.find((item) => item.id === app.letterId && item.applicationId === app.id)
  return {
    applicationId: app.id,
    company: app.job.company,
    cvReady: app.cvId !== null && data.cvs.some((cv) => cv.id === app.cvId && cv.applicationId === app.id),
    letterReady: letter !== undefined,
    coverLetter: letter?.body ?? '',
    cvFile: cvFileName(app.job.company),
    cvDownloaded: app.events.some((event) => event.type === 'download'),
  }
}

const CV_UPLOAD = /\b(cv|resume|curriculum)\b/i
const LETTER_UPLOAD = /\b(cover|surat|letter)\b/i
const OWN_FILE = 'Pilih berkasmu sendiri'

// Why a file input is left alone, and which file to pick (FR-44, RFC D14). Nothing is ever put into it.
export function uploadNote(label: string, context: Pick<PanelContext, 'cvFile' | 'cvReady' | 'cvDownloaded'> | undefined): string {
  if (!context) return OWN_FILE
  if (LETTER_UPLOAD.test(label)) return 'Salin surat dari Lamaran, lalu unggah sendiri'
  if (!CV_UPLOAD.test(label)) return OWN_FILE
  if (context.cvDownloaded) return `${context.cvFile} sudah diunduh — pilih sendiri`
  return context.cvReady ? `Unduh ${context.cvFile} dari Lamaran, lalu pilih sendiri` : OWN_FILE
}
