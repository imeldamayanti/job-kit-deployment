import { SearchX } from 'lucide-react'
import { useState } from 'react'
import { filterJobs, formatJobDate, initialsOf } from '../../core/jobs/jobs'
import { previewJobsStateFromHash, type JobsViewState } from '../../core/jobs/preview-jobs'
import { JOB_STATUSES, type JobFilter } from '../../core/jobs/types'
import { Mascot } from '../../ui/mascot/Mascot'
import { Button } from '../../ui/primitives/Button'
import { TextField } from '../../ui/primitives/TextField'
import { JobDetail } from './JobDetail'
import { StatusBadge } from './StatusBadge'

const FILTERS: JobFilter[] = ['Semua', ...JOB_STATUSES]

function startState(): JobsViewState {
  // The sample rows exist only to be looked at in a dev build; nothing records jobs yet (T21).
  return (
    (import.meta.env.DEV ? previewJobsStateFromHash(location.hash) : undefined) ?? {
      jobs: [],
      openId: null,
      status: 'Semua',
      query: '',
    }
  )
}

function FilterChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        'h-10 shrink-0 rounded-lg border px-3 text-[13px] font-semibold transition-colors duration-150 ' +
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
        (selected
          ? 'border-accent bg-accent-wash text-accent'
          : 'border-border-strong bg-surface text-text-primary hover:bg-neutral-100')
      }
    >
      {children}
    </button>
  )
}

export function JobsPage() {
  const [view, setView] = useState<JobsViewState>(startState)
  const results = filterJobs(view.jobs, view)
  const open = view.jobs.find((job) => job.id === view.openId)

  if (view.jobs.length === 0) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
        <Mascot state="neutral" size={96} />
        <h2 className="mt-2 text-[18px] font-bold text-text-primary">Belum ada lamaran tersimpan</h2>
        <p className="max-w-[44ch] text-[14px] text-text-secondary">
          Pencatatan lowongan otomatis belum tersedia di versi ini. Setelah tersedia, lowongan yang kamu isi akan muncul di sini.
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1">
          <TextField
            label="Cari lamaran"
            hideLabel
            className="h-10"
            placeholder="Cari posisi, perusahaan, atau situs"
            value={view.query}
            onChange={(event) => setView({ ...view, query: event.target.value })}
          />
        </div>
        <div role="group" aria-label="Filter status" className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <FilterChip key={filter} selected={view.status === filter} onClick={() => setView({ ...view, status: filter })}>
              {filter}
            </FilterChip>
          ))}
        </div>
      </div>

      {results.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-md">
          {results.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => setView({ ...view, openId: job.id })}
                className={
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-input ' +
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring'
                }
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-[13px] font-bold text-text-secondary"
                >
                  {initialsOf(job.company)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 text-[14px] font-semibold text-text-primary">{job.title}</span>
                  <span className="truncate text-[13px] text-text-secondary">
                    {job.company} · {job.origin}
                  </span>
                </span>
                <span className="hidden w-24 shrink-0 text-[13px] text-text-secondary sm:inline">{formatJobDate(job.appliedAt)}</span>
                <StatusBadge status={job.status} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-6 py-14 text-center shadow-md">
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-text-secondary">
            <SearchX size={18} strokeWidth={2} />
          </span>
          <h2 className="mt-1 text-[16px] font-bold text-text-primary">Tidak ada yang cocok dengan filter ini</h2>
          <p className="text-[14px] text-text-secondary">Belum ada lamaran yang cocok dengan pencarian dan status yang dipilih.</p>
          <Button variant="secondary" className="mt-2" onClick={() => setView({ ...view, query: '', status: 'Semua' })}>
            Reset filter
          </Button>
        </section>
      )}

      {open && <JobDetail job={open} onClose={() => setView({ ...view, openId: null })} />}
    </div>
  )
}
