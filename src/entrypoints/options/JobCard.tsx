import { Bookmark, Check, ChevronDown, EyeOff, FileText, MapPin, Minus, MoreHorizontal, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { documentMarks } from '../../core/applications/view'
import type { Application } from '../../core/applications/types'
import type { Job, JobStatus } from '../../core/feed/types'
import { initialsOf, jobMeta, scoreTier, SOURCE_NAMES } from '../../core/feed/view'
import { Button } from '../../ui/primitives/Button'
import { AppStatusBadge } from './AppStatusBadge'
import { DocChip } from '../../ui/primitives/DocChip'

const WORKPLACE_TEXT = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', unknown: '' } as const
const TIER_STYLE = { hi: 'bg-green-50 text-green-700', mid: 'bg-amber-50 text-amber-700', lo: 'bg-neutral-100 text-text-secondary' } as const

function ScoreBadge({ job, open, onToggle }: { job: Job; open: boolean; onToggle: () => void }) {
  const score = job.score
  if (!score) return null
  const { tier, label } = scoreTier(score.value)
  const tone = score.rough ? 'border border-dashed border-border-strong bg-surface text-text-secondary' : TIER_STYLE[tier]
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={score.rough ? `Skor kasar ${score.value}. Tampilkan alasan` : `Skor ${score.value}, ${label}. Tampilkan alasan`}
      onClick={onToggle}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full py-1 pr-2.5 pl-3 text-[12px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${tone}`}
    >
      <span className="text-[15px] tabular-nums">{score.value}</span>
      <span className="hidden sm:inline">{score.rough ? 'Skor kasar' : label}</span>
      <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className={'transition-transform duration-200 ' + (open ? 'rotate-180' : '')} />
    </button>
  )
}

function Reasons({ job }: { job: Job }) {
  const score = job.score
  if (!score) return null
  return (
    <div role="region" aria-label="Alasan skor" className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 rounded-lg border border-border bg-surface-sunken p-3.5 text-[13px] sm:grid-cols-2">
      {[
        { title: 'Yang cocok', items: score.matches, icon: <Check size={14} strokeWidth={2} className="text-green-700" /> },
        { title: 'Yang kurang', items: score.gaps, icon: <Minus size={14} strokeWidth={2} className="text-amber-700" /> },
      ].map(({ title, items, icon }) => (
        <div key={title}>
          <h5 className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.03em] text-text-secondary">{title}</h5>
          {items.length === 0 ? (
            <p className="text-text-secondary">—</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {items.map((text) => (
                <li key={text} className="flex items-start gap-2 leading-snug">
                  <span aria-hidden="true" className="mt-0.5 shrink-0">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {score.summary && <p className="border-t border-border pt-2.5 sm:col-span-2">{score.summary}</p>}
    </div>
  )
}

type MenuItem = { label: string; icon: React.ReactNode; to: JobStatus }

export function menuFor(status: JobStatus): MenuItem[] {
  const applied = { label: 'Tandai dilamar', icon: <Check size={16} strokeWidth={2} aria-hidden="true" />, to: 'applied' as const }
  const hide = { label: 'Sembunyikan', icon: <EyeOff size={16} strokeWidth={2} aria-hidden="true" />, to: 'hidden' as const }
  const restore = { label: 'Kembalikan ke Rekomendasi', icon: <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />, to: 'new' as const }
  if (status === 'new') return [applied, hide]
  if (status === 'saved') return [applied, hide, restore]
  if (status === 'applied') return [{ label: 'Tandai belum dilamar', icon: <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />, to: 'saved' as const }, hide]
  return [restore]
}

export function ActionMenu({ job, onStatus }: { job: Job; onStatus: (id: string, status: JobStatus) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  return (
    <span ref={box} className="relative inline-block">
      <button
        type="button"
        aria-label="Menu lainnya"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
      >
        <MoreHorizontal size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <span role="menu" className="absolute left-0 top-full z-10 mt-1 flex min-w-[210px] flex-col rounded-lg border border-border bg-surface p-1 shadow-lg">
          {menuFor(job.status).map(({ label, icon, to }) => (
            <button
              key={to}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false)
                onStatus(job.id, to)
              }}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-text-primary hover:bg-neutral-100"
            >
              {icon}
              {label}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

export function JobCard({
  job,
  now,
  onOpen,
  onStatus,
  onPrepare,
  onOpenApplication,
  application,
  startOpen = false,
}: {
  job: Job
  now: Date
  onOpen: (job: Job) => void
  onStatus: (id: string, status: JobStatus) => void
  onPrepare: (job: Job) => void
  onOpenApplication: (id: string) => void
  // A job with an application takes its status from it (D11), so it has no status menu of its own.
  application?: Application
  startOpen?: boolean
}) {
  const [reasons, setReasons] = useState(startOpen)
  const chips: { text: string; ai?: boolean; pin?: boolean }[] = [
    { text: job.location, pin: true },
    { text: WORKPLACE_TEXT[job.workplace], ai: job.aiFilled.includes('workplace') },
    { text: job.contract, ai: job.aiFilled.includes('contract') },
    { text: job.level, ai: job.aiFilled.includes('level') },
  ].filter((chip) => chip.text !== '')
  const meta = jobMeta(job, now)
  const saved = job.status === 'saved'

  return (
    <article className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-x-2.5 rounded-xl border border-border bg-surface p-3.5 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:gap-x-3.5 sm:px-5 sm:py-4">
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-[14px] font-bold text-text-secondary sm:h-11 sm:w-11">
        {initialsOf(job.company)}
      </span>
      <div className="min-w-0">
        <h4 className="line-clamp-2 text-[15px] font-bold leading-snug tracking-[-0.01em] text-text-primary">{job.title}</h4>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
          <span className="min-w-0 truncate">
            {job.company} · {SOURCE_NAMES[job.source]}
          </span>
          {job.status === 'new' && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Baru</span>}
        </p>
        {chips.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <li key={chip.text} className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2.5 py-1 text-[12px] font-medium text-text-primary">
                {chip.pin && <MapPin size={13} strokeWidth={2} aria-hidden="true" className="text-text-secondary" />}
                {chip.text}
                {chip.ai && (
                  <span title="Diisi AI dari teks lowongan" className="rounded border border-border-strong px-1 text-[10px] font-bold text-text-secondary">
                    AI
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {meta.length > 0 && (
          <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-secondary">
            {meta.map((item) => (
              <span key={item.label + item.value}>
                {item.label && `${item.label}: `}
                <b className="font-semibold text-text-primary">{item.value}</b>
              </span>
            ))}
          </p>
        )}
        {reasons && <Reasons job={job} />}
        {application && (
          <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
            Lamaran <AppStatusBadge status={application.status} />
            <DocChip kind="cv" ok={documentMarks(application).cv} />
            <DocChip kind="letter" ok={documentMarks(application).letter} />
          </p>
        )}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <Button onClick={() => onOpen(job)}>Buka &amp; isi</Button>
          {application ? (
            <Button variant="secondary" onClick={() => onOpenApplication(application.id)}>
              <FileText size={16} strokeWidth={2} aria-hidden="true" />
              Buka lamaran
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => onPrepare(job)}>
              <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
              Siapkan lamaran
            </Button>
          )}
          {job.status === 'new' && !application && (
            <button
              type="button"
              aria-label="Simpan lowongan"
              title="Simpan lowongan"
              onClick={() => onStatus(job.id, 'saved')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-text-secondary hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
            >
              <Bookmark size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
          {saved && !application && <span className="text-[13px] font-semibold text-text-secondary">Disimpan</span>}
          {!application && <ActionMenu job={job} onStatus={onStatus} />}
        </div>
      </div>
      <ScoreBadge job={job} open={reasons} onToggle={() => setReasons(!reasons)} />
    </article>
  )
}
