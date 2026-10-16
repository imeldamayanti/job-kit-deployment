import { LETTER_VIEW_NAMES, type LetterViewName } from '../letters/view'
import { CV_VIEW_NAMES, type CvViewName } from '../tailor/view'
import type { Application, AppEvent, AppStatus } from './types'
import type { DetailTab } from './view'

// Sample applications to look at every state of the Lamaran pages in a dev build (T40 mockup).
// Never reachable from a production build.
export type ApplicationsPreview = {
  applications: Application[]
  view: 'board' | 'viz'
  query: string
  closedOpen: boolean
  // The form for adding an application by hand is open.
  adding?: boolean
  detail?: { id: string; tab: DetailTab }
  // Which state of the CV tab to show (T49); only with the CV tab open.
  cv?: CvViewName
  // Which state of the letter tab to show (T52); only with the Surat tab open.
  letter?: LetterViewName
  // The day the sample is looked at, so "Tanpa kabar" (14 days) does not drift as real time passes. Absent: now.
  now?: string
}

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 3)).toISOString()

function sample(
  id: string,
  title: string,
  company: string,
  status: AppStatus,
  created: number,
  moves: [AppStatus, number][] = [],
  extra: Partial<Application> = {},
): Application {
  const events: AppEvent[] = [{ at: day(created), type: 'created' }]
  let from: AppStatus = 'draft'
  for (const [to, on] of moves) {
    events.push({ at: day(on), type: 'status', from, to })
    from = to
  }
  const last = moves.at(-1)?.[1] ?? created
  return {
    id, jobId: `job-${id}`, status, cvId: null, letterId: null, followUpAt: null, notes: '', events, createdAt: day(created), updatedAt: day(last),
    job: { title, company, url: `https://example.test/${id}`, source: 'greenhouse', description: `${title} di ${company}. Membangun antarmuka web dengan React dan TypeScript.`, capturedAt: day(created) },
    ...extra,
  }
}

const SAMPLE: Application[] = [
  sample('a1', 'Frontend Engineer (React)', 'PT Contoh Karya', 'draft', 14, [], { cvId: 'cv-a1' }),
  sample('a2', 'UI Engineer', 'Contoh Digital Nusantara', 'draft', 13),
  sample('b1', 'Web Developer — Platform Pembayaran dan Integrasi Mitra Bisnis', 'Studio Contoh', 'applied', 9, [['applied', 12]], { cvId: 'cv-b1', letterId: 'l-b1', notes: 'HR: Rina. Katanya kabar paling lambat 21 Okt.' }),
  sample('b2', 'Senior Frontend Developer', 'Contoh Remote Co', 'applied', 8, [['applied', 9]], { cvId: 'cv-b2' }),
  sample('b3', 'React Developer', 'Bumi Mandiri', 'applied', 6, [['applied', 7]]),
  sample('c1', 'Fullstack Engineer', 'Sinar Data', 'in-review', 1, [['applied', 2], ['in-review', 6]], { cvId: 'cv-c1' }),
  sample('d1', 'Frontend Developer', 'Aksara Pagi', 'interview', 1, [['applied', 3], ['in-review', 7], ['interview', 11]]),
  sample('r1', 'Frontend Engineer (Intern)', 'Nusa Teknologi', 'rejected', 1, [['applied', 2], ['rejected', 8]]),
  sample('r2', 'Software Engineer, Web Platform', 'Bumi Teknologi', 'rejected', 1, [['applied', 3], ['in-review', 5], ['rejected', 9]]),
  sample('r3', 'Product Engineer', 'Kita Studio', 'rejected', 1, [['applied', 2], ['rejected', 4]]),
  sample('w1', 'Mobile Developer', 'Lintas Kode', 'withdrawn', 3, [['withdrawn', 5]]),
]

// The 12 sent applications behind the diagram of the T40 mockup (design-system §9.2), seen on 20 Oct 2026:
// 12 sent, 6 reviewed, 3 interviewed, 1 offer; 4 without news, 4 rejected, 3 still going.
export const VIZ_NOW = new Date(Date.UTC(2026, 9, 20, 8))
const co = (n: number) => `PT Contoh ${n}`
export const VIZ_SAMPLE: Application[] = [
  ...[1, 2, 3, 4].map((n) => sample(`v-stalled-${n}`, 'Frontend Developer', co(n), 'applied', n, [['applied', n]])),
  ...[5, 6].map((n) => sample(`v-reject-applied-${n}`, 'Web Developer', co(n), 'rejected', 5, [['applied', 6], ['rejected', n + 3]])),
  sample('v-reject-review', 'UI Engineer', co(7), 'rejected', 5, [['applied', 6], ['in-review', 8], ['rejected', 12]]),
  sample('v-reject-interview', 'React Developer', co(8), 'rejected', 5, [['applied', 6], ['in-review', 8], ['interview', 11], ['rejected', 15]]),
  sample('v-offer', 'Senior Frontend Developer', co(9), 'offer', 5, [['applied', 6], ['in-review', 8], ['interview', 11], ['offer', 16]]),
  sample('v-interview', 'Fullstack Engineer', co(10), 'interview', 5, [['applied', 6], ['in-review', 8], ['interview', 17]]),
  ...[11, 12].map((n) => sample(`v-review-${n}`, 'Software Engineer', co(n), 'in-review', 5, [['applied', 7], ['in-review', n]])),
]

const state = (change: Partial<ApplicationsPreview> = {}): ApplicationsPreview => ({
  applications: SAMPLE, view: 'board', query: '', closedOpen: false, ...change,
})

// Two follow-ups due on the day of the sample (15 Oct 2026), one still ahead: the amber alert, badge, and card borders of the mockup.
export const DUE_NOW = new Date(Date.UTC(2026, 9, 15, 8))
const DUE_DATES: Record<string, string> = { b1: '2026-10-15', d1: '2026-10-15', b2: '2026-10-22' }
const DUE_SAMPLE = SAMPLE.map((app) => (DUE_DATES[app.id] ? { ...app, followUpAt: DUE_DATES[app.id]! } : app))

const WITHOUT_TEXT = sample('n1', 'Backend Developer', 'PT Tanpa Teks', 'draft', 14, [], { job: { ...SAMPLE[0]!.job, title: 'Backend Developer', company: 'PT Tanpa Teks', description: '' } })

const MANUAL = sample('m1', 'Backend Developer', 'Perusahaan Luar Feed', 'draft', 14, [], {
  job: { title: 'Backend Developer', company: 'Perusahaan Luar Feed', url: '', source: 'manual', description: '', capturedAt: day(14) },
  jobId: null,
})

const SCENARIOS: Record<string, ApplicationsPreview> = {
  list: state(),
  empty: state({ applications: [] }),
  nomatch: state({ query: 'android' }),
  closed: state({ closedOpen: true }),
  viz: state({ view: 'viz', applications: VIZ_SAMPLE, now: VIZ_NOW.toISOString() }),
  // Only drafts: nothing has been sent yet.
  due: state({ applications: DUE_SAMPLE, now: DUE_NOW.toISOString() }),
  'viz-empty': state({ view: 'viz', applications: SAMPLE.filter((app) => app.status === 'draft') }),
  detail: state({ detail: { id: 'a1', tab: 'summary' } }),
  'detail-cv': state({ detail: { id: 'a1', tab: 'cv' }, cv: 'result' }),
  ...Object.fromEntries(
    CV_VIEW_NAMES.filter((name) => name !== 'result').map((name) => [`detail-cv-${name}`, state({ detail: { id: 'a1', tab: 'cv' }, cv: name })]),
  ),
  'detail-letter': state({ detail: { id: 'a1', tab: 'letter' }, letter: 'result' }),
  ...Object.fromEntries(
    LETTER_VIEW_NAMES.filter((name) => name !== 'result').map((name) => [`detail-letter-${name}`, state({ detail: { id: 'a1', tab: 'letter' }, letter: name })]),
  ),
  'detail-notes': state({ detail: { id: 'b1', tab: 'notes' } }),
  add: state({ adding: true }),
  'detail-manual': state({ applications: [MANUAL, ...SAMPLE], detail: { id: 'm1', tab: 'summary' } }),
  'detail-nodesc': state({ applications: [WITHOUT_TEXT, ...SAMPLE], detail: { id: 'n1', tab: 'summary' } }),
}

// "#applications?state=closed" -> the sample state of that name, or undefined.
export function previewApplicationsFromHash(hash: string): ApplicationsPreview | undefined {
  const name = new URLSearchParams(hash.split('?')[1] ?? '').get('state')
  return name ? SCENARIOS[name] : undefined
}
