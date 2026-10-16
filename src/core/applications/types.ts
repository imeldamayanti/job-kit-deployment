import { JOB_SOURCE_IDS, type JobSourceId } from '../feed/types'

// RFC §3.3c. The application is the source of truth for status (D11); Job.status in the feed follows it.
export const APP_STATUSES = ['draft', 'applied', 'in-review', 'interview', 'offer', 'rejected', 'withdrawn'] as const
export type AppStatus = (typeof APP_STATUSES)[number]

export const APP_EVENT_TYPES = ['created', 'status', 'cv', 'letter', 'download', 'fill'] as const
export type AppEventType = (typeof APP_EVENT_TYPES)[number]

// History is append-only; the person cannot edit it.
export type AppEvent = { at: string; type: AppEventType; from?: AppStatus; to?: AppStatus; text?: string }

// Where a posting came from: a feed source, or 'manual' for one the person added by hand.
export type PostingSource = JobSourceId | 'manual'
export const POSTING_SOURCES: readonly PostingSource[] = [...JOB_SOURCE_IDS, 'manual']

// A copy of the posting, so the application stays whole after the feed prunes the job.
export type JobCopy = { title: string; company: string; url: string; source: PostingSource; description: string; capturedAt: string }

export type Application = {
  id: string
  // Job.id in the feed. null for an application added by hand.
  jobId: string | null
  job: JobCopy
  status: AppStatus
  cvId: string | null
  letterId: string | null
  // Calendar day, YYYY-MM-DD.
  followUpAt: string | null
  notes: string
  // "provider:model" the person has already been warned about (FR-46: once per application). Absent until then.
  aiNoticeAck?: string
  events: AppEvent[]
  createdAt: string
  updatedAt: string
}

type CvParts = { skills: string[]; experience: { sourceId: string; bullets: string[] }[]; education: string[] }

// Filled by T48. Stored apart from the application so the list does not load whole documents.
export type TailoredCv = {
  id: string
  applicationId: string
  createdAt: string
  // A hash other than the current profile's means the CV is stale (FR-45).
  profileHash: string
  coverage: { required: string[]; covered: string[]; missing: string[] }
  edited: boolean
  // What the AI returned, for "Kembalikan ke versi AI".
  aiVersion: CvParts
} & CvParts

// Filled by T51.
export type CoverLetter = {
  id: string
  applicationId: string
  createdAt: string
  profileHash: string
  lang: 'id' | 'en'
  tone: 'formal' | 'casual'
  body: string
  aiBody: string
  edited: boolean
}

// What is stored under local:applications, local:tailoredCvs and local:coverLetters.
export type ApplicationData = { applications: Application[]; cvs: TailoredCv[]; letters: CoverLetter[] }

export const EMPTY_APPLICATION_DATA: ApplicationData = { applications: [], cvs: [], letters: [] }
