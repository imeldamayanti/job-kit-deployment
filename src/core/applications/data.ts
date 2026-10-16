import {
  APP_EVENT_TYPES,
  APP_STATUSES,
  POSTING_SOURCES,
  type AppEvent,
  type AppStatus,
  type Application,
  type ApplicationData,
  type CoverLetter,
  type TailoredCv,
} from './types'

type Loose = Record<string, unknown>

const isRecord = (value: unknown): value is Loose => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const records = (value: unknown): Loose[] => (Array.isArray(value) ? value.filter(isRecord) : [])
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
const oneOf = <T extends string>(options: readonly T[], value: unknown): T | undefined => options.find((option) => option === value)

function normalizeEvent(raw: Loose): AppEvent | null {
  const type = oneOf(APP_EVENT_TYPES, raw.type)
  const at = text(raw.at)
  if (!type || at === '') return null
  const from = oneOf(APP_STATUSES, raw.from)
  const to = oneOf(APP_STATUSES, raw.to)
  const note = text(raw.text)
  return { at, type, ...(from ? { from } : {}), ...(to ? { to } : {}), ...(note ? { text: note } : {}) }
}

function normalizeApplication(raw: Loose): Application | null {
  const status: AppStatus | undefined = oneOf(APP_STATUSES, raw.status)
  const job = isRecord(raw.job) ? raw.job : undefined
  const source = job ? oneOf(POSTING_SOURCES, job.source) : undefined
  if (text(raw.id) === '' || !status || !job || !source) return null
  return {
    id: text(raw.id),
    jobId: text(raw.jobId) || null,
    job: { title: text(job.title), company: text(job.company), url: text(job.url), source, description: text(job.description), capturedAt: text(job.capturedAt) },
    status,
    cvId: text(raw.cvId) || null,
    letterId: text(raw.letterId) || null,
    followUpAt: text(raw.followUpAt) || null,
    notes: text(raw.notes),
    ...(text(raw.aiNoticeAck) !== '' && { aiNoticeAck: text(raw.aiNoticeAck) }),
    events: records(raw.events).map(normalizeEvent).filter((event): event is AppEvent => event !== null),
    createdAt: text(raw.createdAt),
    updatedAt: text(raw.updatedAt),
  }
}

const experienceParts = (value: unknown) =>
  records(value).map((item) => ({ sourceId: text(item.sourceId), bullets: strings(item.bullets) }))

function cvParts(raw: unknown) {
  const source = isRecord(raw) ? raw : {}
  return { skills: strings(source.skills), experience: experienceParts(source.experience), education: strings(source.education) }
}

function normalizeCv(raw: Loose): TailoredCv | null {
  if (text(raw.id) === '' || text(raw.applicationId) === '') return null
  const coverage = isRecord(raw.coverage) ? raw.coverage : {}
  const parts = cvParts(raw)
  return {
    id: text(raw.id),
    applicationId: text(raw.applicationId),
    createdAt: text(raw.createdAt),
    profileHash: text(raw.profileHash),
    ...parts,
    coverage: { required: strings(coverage.required), covered: strings(coverage.covered), missing: strings(coverage.missing) },
    edited: raw.edited === true,
    aiVersion: isRecord(raw.aiVersion) ? cvParts(raw.aiVersion) : parts,
  }
}

function normalizeLetter(raw: Loose): CoverLetter | null {
  if (text(raw.id) === '' || text(raw.applicationId) === '') return null
  return {
    id: text(raw.id),
    applicationId: text(raw.applicationId),
    createdAt: text(raw.createdAt),
    profileHash: text(raw.profileHash),
    lang: raw.lang === 'en' ? 'en' : 'id',
    tone: raw.tone === 'casual' ? 'casual' : 'formal',
    body: text(raw.body),
    aiBody: text(raw.aiBody),
    edited: raw.edited === true,
  }
}

function firstById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id))
}

const present = <T>(item: T | null): item is T => item !== null

// Reads what Export wrote (or what storage holds). Anything it cannot read is left out rather than
// failing the whole file, and every link from an application to a document must point at a document that is there.
export function normalizeApplicationData(raw: unknown): ApplicationData {
  const source = isRecord(raw) ? raw : {}
  const applications = firstById(records(source.applications).map(normalizeApplication).filter(present))
  const owned = new Set(applications.map((app) => app.id))
  const cvs = firstById(records(source.cvs).map(normalizeCv).filter(present)).filter((cv) => owned.has(cv.applicationId))
  const letters = firstById(records(source.letters).map(normalizeLetter).filter(present)).filter((letter) => owned.has(letter.applicationId))
  return {
    applications: applications.map((app) => ({
      ...app,
      cvId: cvs.some((cv) => cv.id === app.cvId && cv.applicationId === app.id) ? app.cvId : null,
      letterId: letters.some((letter) => letter.id === app.letterId && letter.applicationId === app.id) ? app.letterId : null,
    })),
    cvs,
    letters,
  }
}

export const countApplications = (data: ApplicationData): number => data.applications.length

export function countAddedApplications(before: ApplicationData, after: ApplicationData): number {
  const known = new Set(before.applications.map((app) => app.id))
  return after.applications.filter((app) => !known.has(app.id)).length
}

// The same application: same id, same feed job, or (for applications not tied to a feed job) the same posting URL.
function isSameApplication(a: Application, b: Application): boolean {
  if (a.id === b.id) return true
  if (a.jobId !== null || b.jobId !== null) return a.jobId === b.jobId
  return a.job.url !== '' && a.job.url === b.job.url
}

// Gabung only adds applications that are not there yet, with their documents. Ganti swaps everything.
// A file from before applications existed (null) changes nothing in either mode: it must not wipe what is here.
export function applyApplicationData(current: ApplicationData, incoming: ApplicationData | null, mode: 'merge' | 'replace'): ApplicationData {
  if (incoming === null) return current
  if (mode === 'replace') return incoming
  const fresh = incoming.applications.filter((app) => !current.applications.some((existing) => isSameApplication(existing, app)))
  const freshIds = new Set(fresh.map((app) => app.id))
  // A document whose id another document here already uses is left out, and its application unlinked.
  const usedCv = new Set(current.cvs.map((cv) => cv.id))
  const usedLetter = new Set(current.letters.map((letter) => letter.id))
  const cvs = incoming.cvs.filter((cv) => freshIds.has(cv.applicationId) && !usedCv.has(cv.id))
  const letters = incoming.letters.filter((letter) => freshIds.has(letter.applicationId) && !usedLetter.has(letter.id))
  return {
    applications: [
      ...current.applications,
      ...fresh.map((app) => ({
        ...app,
        cvId: cvs.some((cv) => cv.id === app.cvId) ? app.cvId : null,
        letterId: letters.some((letter) => letter.id === app.letterId) ? app.letterId : null,
      })),
    ],
    cvs: [...current.cvs, ...cvs],
    letters: [...current.letters, ...letters],
  }
}
