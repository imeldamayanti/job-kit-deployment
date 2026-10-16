import { RefreshCw, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { aiErrorMessage } from '../../core/ai/errors'
import { canEnableFeed, type FeedSettings } from '../../core/feed/settings'
import { countNew, type FeedState } from '../../core/feed/schedule'
import { previewFeedFromHash } from '../../core/feed/preview'
import type { Application } from '../../core/applications/types'
import type { Job, JobStatus, SourceRun } from '../../core/feed/types'
import {
  describeFeed,
  filterFeed,
  formatUpdated,
  initialsOf,
  sortFeed,
  sourceNotices,
  SOURCE_NAMES,
  type FeedFilter,
  type FeedOrder,
  type FeedTab,
  type SavedStatusFilter,
  type WorkplaceFilter,
} from '../../core/feed/view'
import type { Profile } from '../../core/profile/types'
import { prepareApplication } from '../../platform/applications'
import { requestRefresh } from '../../platform/feed-control'
import { openJob } from '../../platform/open-job'
import { Button } from '../../ui/primitives/Button'
import { FilterChip } from '../../ui/primitives/FilterChip'
import { Select } from '../../ui/primitives/Select'
import { TextField } from '../../ui/primitives/TextField'
import { Empty } from './EmptyState'
import { ActionMenu, JobCard } from './JobCard'
import { FolderTabs } from './FolderTabs'

type Live = { feed: Job[]; runs: SourceRun[]; state: FeedState; changeStatus: (id: string, status: JobStatus) => void }

const WORKPLACES: { id: WorkplaceFilter; title: string }[] = [
  { id: 'all', title: 'Semua' }, { id: 'remote', title: 'Remote' }, { id: 'hybrid', title: 'Hybrid' }, { id: 'onsite', title: 'On-site' },
]
const STATUSES: { id: SavedStatusFilter; title: string }[] = [
  { id: 'all', title: 'Semua' }, { id: 'saved', title: 'Disimpan' }, { id: 'applied', title: 'Dilamar' }, { id: 'hidden', title: 'Disembunyikan' },
]
const STATUS_BADGE: Record<JobStatus, { text: string; tone: string }> = {
  new: { text: 'Baru', tone: 'bg-amber-50 text-amber-700' },
  saved: { text: 'Disimpan', tone: 'bg-neutral-100 text-text-secondary' },
  applied: { text: 'Dilamar', tone: 'bg-green-50 text-green-700' },
  hidden: { text: 'Disembunyikan', tone: 'bg-neutral-100 text-text-secondary' },
}

function SavedRow({
  job,
  application,
  onStatus,
  onOpenJob,
  onOpenApplication,
}: {
  job: Job
  application: Application | undefined
  onStatus: (id: string, status: JobStatus) => void
  onOpenJob: (job: Job) => void
  onOpenApplication: (id: string) => void
}) {
  const badge = STATUS_BADGE[job.status]
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-[13px] font-bold text-text-secondary">
        {initialsOf(job.company)}
      </span>
      <button type="button" onClick={() => onOpenJob(job)} className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline-2 focus-visible:outline-focus-ring">
        <span className="line-clamp-2 text-[14px] font-semibold text-text-primary">{job.title}</span>
        <span className="truncate text-[13px] text-text-secondary">
          {job.company} · {SOURCE_NAMES[job.source]}
        </span>
      </button>
      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${badge.tone}`}>{badge.text}</span>
      {application && (
        <Button variant="secondary" onClick={() => onOpenApplication(application.id)}>
          Buka lamaran
        </Button>
      )}
      {!application && <ActionMenu job={job} onStatus={onStatus} />}
    </li>
  )
}

// Filter row stays visible while the list scrolls; the shadow shows only once it is actually stuck.
function StickyBar({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => setStuck((entries[0]?.intersectionRatio ?? 1) < 1), { threshold: [1] })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      style={{ top: -1 }}
      className={'sticky z-10 -mx-2 flex flex-wrap items-center gap-2 bg-surface-sunken px-2 py-2 transition-shadow duration-150 ' + (stuck ? 'shadow-md' : '')}
    >
      {children}
    </div>
  )
}

export function JobsPage({
  profile,
  settings,
  live,
  applications,
  onOpenApplication,
  onSettings,
  onPreferences,
}: {
  profile: Profile | null
  settings: FeedSettings | null
  live: Live
  applications: readonly Application[]
  onOpenApplication: (id: string) => void
  onSettings: () => void
  onPreferences: () => void
}) {
  const preview = import.meta.env.DEV ? previewFeedFromHash(location.hash) : undefined
  const data = preview ?? {
    feed: live.feed,
    runs: live.runs,
    state: live.state,
    hasRoles: profile ? canEnableFeed(profile.jobPrefs) : false,
    anySourceOn: settings ? Object.values(settings.sources).some(Boolean) : false,
  }
  const [filter, setFilter] = useState<FeedFilter>({ tab: 'recommended', workplace: 'all', query: '', status: 'all', ...preview?.filter })
  const [order, setOrder] = useState<FeedOrder>('score')
  const [answer, setAnswer] = useState('')
  const now = new Date()
  const set = (change: Partial<FeedFilter>) => setFilter({ ...filter, ...change })
  const applicationOf = (job: Job) => applications.find((app) => app.jobId === job.id)

  const recommended = data.feed.filter((job) => job.status === 'new')
  const saved = data.feed.filter((job) => job.status === 'saved' || job.status === 'applied')
  const shown = sortFeed(filterFeed(data.feed, filter), order)
  const onRecommended = filter.tab === 'recommended'
  const view = describeFeed({
    hasRoles: data.hasRoles, anySourceOn: data.anySourceOn, state: data.state, runs: data.runs,
    recommended: filterFeed(data.feed, { ...filter, workplace: 'all', query: '' }).length, shown: shown.length,
  })
  const notices = sourceNotices(data.runs, data.state.paused)

  const refresh = () => {
    setAnswer('')
    void requestRefresh().then((status) => setAnswer(status === 'busy' ? 'Masih ada pengambilan yang berjalan.' : status === 'no-prefs' ? 'Isi role incaran di Preferensi kerja dulu.' : ''))
  }
  const change = preview ? () => {} : live.changeStatus
  const open = (job: Job) => {
    if (preview) return
    void openJob(job).then((result) => setAnswer(result === 'tab-only' ? 'Tab terbuka. Klik ikon job-kit untuk mengisi.' : ''))
  }

  // "Siapkan lamaran" (FR-34): makes the application, saves the job, and opens the application.
  const prepare = (job: Job) => {
    if (preview) return
    void prepareApplication(job).then((result) =>
      result.ok ? onOpenApplication(result.app.id) : setAnswer('Penyimpanan penuh. Lamaran belum tersimpan, dan lowongan lain tidak berubah.'),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-1 text-[13px] text-text-secondary">{formatUpdated(data.state.lastRunAt, data.state.newJobs || countNew(data.feed, ''))}</span>
        <Button variant="secondary" disabled={data.state.running || !data.anySourceOn} onClick={refresh}>
          <RefreshCw size={16} strokeWidth={2} aria-hidden="true" className={data.state.running ? 'animate-spin' : ''} />
          {data.state.running ? 'Sedang mengambil…' : 'Segarkan'}
        </Button>
        <Button variant="secondary" onClick={onSettings}>
          <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
          Atur
        </Button>
      </div>
      {answer && <p role="status" className="text-right text-[13px] text-amber-700">{answer}</p>}

      <FolderTabs
        label="Lowongan"
        tabs={[{ id: 'recommended', title: 'Rekomendasi', count: recommended.length }, { id: 'saved', title: 'Disimpan', count: saved.length }] satisfies { id: FeedTab; title: string; count: number }[]}
        current={filter.tab}
        onSelect={(tab) => set({ tab })}
      />

      {notices.map((text) => (
        <div key={text} role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
          {text}
        </div>
      ))}
      {data.state.aiProblem && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent-wash px-4 py-3 text-[13px] text-text-primary">
          <p>
            <b>Skor kasar</b> — {aiErrorMessage(data.state.aiProblem)} Lowongan tetap tampil dengan skor dari aturan.
          </p>
          <Button variant="secondary" onClick={onSettings}>Buka Atur Lowongan</Button>
        </div>
      )}

      {view === 'no-prefs' && (
        <Empty mascot="neutral" title="Preferensi kerja masih kosong" body="Isi role incaran dulu supaya job-kit tahu lowongan apa yang dicari.">
          <Button onClick={onPreferences}>Isi Preferensi kerja</Button>
        </Empty>
      )}
      {view === 'not-enabled' && (
        <Empty mascot="neutral" title="Lowongan belum dinyalakan" body="Isi Preferensi kerja dan pilih sumber. Setelah itu job-kit mencarikan lowongan tiap hari.">
          <Button onClick={onSettings}>Atur Lowongan</Button>
        </Empty>
      )}
      {view === 'fetching' && (
        <Empty mascot="neutral" title="Sedang mengambil lowongan…" body="Pertama kali bisa beberapa menit. Halaman ini ikut diperbarui sendiri." />
      )}
      {view === 'all-failed' && (
        <Empty mascot="error" title="Semua sumber gagal hari ini" body="Lowongan lama tetap tersimpan. Coba Segarkan nanti, atau cek sumber di Atur Lowongan.">
          <Button variant="secondary" onClick={refresh}>Segarkan</Button>
          <Button variant="secondary" onClick={onSettings}>Atur Lowongan</Button>
        </Empty>
      )}
      {view === 'empty-today' && (
        <Empty
          mascot="neutral"
          title={onRecommended ? 'Belum ada lowongan baru hari ini' : filter.status === 'hidden' ? 'Tidak ada lowongan yang disembunyikan' : 'Belum ada lowongan tersimpan'}
          body={onRecommended ? 'Pengambilan berikutnya mengikuti jam di Atur Lowongan, atau tekan Segarkan.' : 'Tekan Simpan pada lowongan yang menarik, nanti muncul di sini.'}
        />
      )}

      {(view === 'list' || view === 'no-match') && (
        <>
          <StickyBar>
            {onRecommended && (
              <div role="group" aria-label="Tipe kerja" className="flex flex-wrap gap-1.5">
                {WORKPLACES.map(({ id, title }) => (
                  <FilterChip key={id} selected={filter.workplace === id} onClick={() => set({ workplace: id })}>{title}</FilterChip>
                ))}
              </div>
            )}
            {!onRecommended && (
              <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
                {STATUSES.map(({ id, title }) => (
                  <FilterChip key={id} selected={filter.status === id} onClick={() => set({ status: id })}>{title}</FilterChip>
                ))}
              </div>
            )}
            {onRecommended && (
              <Select
                label="Urutkan"
                hideLabel
                value={order}
                onChange={(event) => setOrder(event.target.value as FeedOrder)}
                className="h-10 rounded-lg bg-surface text-[13px] font-semibold"
              >
                <option value="score">Urut: Skor</option>
                <option value="newest">Urut: Terbaru</option>
              </Select>
            )}
            <div className="min-w-[200px] flex-1">
              <TextField label="Cari lowongan" hideLabel className="h-10" placeholder="Cari judul atau perusahaan" value={filter.query} onChange={(event) => set({ query: event.target.value })} />
            </div>
          </StickyBar>

          {view === 'no-match' ? (
            <Empty icon title="Tidak ada yang cocok" body="Tidak ada lowongan yang cocok dengan filter dan pencarian ini.">
              <Button variant="secondary" onClick={() => set({ workplace: 'all', query: '', status: 'all' })}>Reset filter</Button>
            </Empty>
          ) : onRecommended ? (
            <div className="flex flex-col gap-3">
              {shown.map((job, index) => (
                <JobCard
                  key={job.id}
                  job={job}
                  now={now}
                  application={applicationOf(job)}
                  startOpen={Boolean(preview) && index === 0}
                  onOpen={open}
                  onStatus={change}
                  onPrepare={prepare}
                  onOpenApplication={onOpenApplication}
                />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-md">
              {shown.map((job) => (
                <SavedRow key={job.id} job={job} application={applicationOf(job)} onStatus={change} onOpenJob={open} onOpenApplication={onOpenApplication} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
