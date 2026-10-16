import { ChevronDown, Plus, TriangleAlert } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { dueSummary, isDue, todayKey } from '../../core/applications/followup'
import { funnelStats } from '../../core/applications/funnel'
import { previewApplicationsFromHash } from '../../core/applications/preview'
import type { ManualInput } from '../../core/applications/applications'
import type { AppStatus, Application } from '../../core/applications/types'
import {
  appliedLabel,
  closedSummary,
  describeApplications,
  documentMarks,
  formatShortDate,
  groupBoard,
  searchApplications,
  STATUS_LABEL,
} from '../../core/applications/view'
import { Button } from '../../ui/primitives/Button'
import { TextField } from '../../ui/primitives/TextField'
import { AppStatusBadge } from './AppStatusBadge'
import { DocChip } from '../../ui/primitives/DocChip'
import { Empty } from './EmptyState'
import { ManualForm, type AddResult } from './ManualForm'
import { SankeyChart } from './SankeyChart'
import type { ApplicationsViewId } from './ViewToggle'

// Props that make a card draggable. `dragging` is the card being dragged right now.
type DragProps = { draggable: true; onDragStart: (event: DragEvent) => void; onDragEnd: () => void }

// FR-47: "Tindak lanjut hari ini" on the day, "terlewat" after it. The card gets an amber border either way (T40 `.kcard.due`).
const dueLabel = (app: Application, today: string) => (app.followUpAt === today ? 'Tindak lanjut hari ini' : 'Tindak lanjut terlewat')

function BoardCard({ app, onOpen, drag, dragging, today }: { app: Application; onOpen: (id: string) => void; drag: DragProps; dragging: boolean; today: string }) {
  const due = isDue(app, today)
  const marks = documentMarks(app)
  const when = appliedLabel(app)
  return (
    <button
      type="button"
      onClick={() => onOpen(app.id)}
      {...drag}
      data-due={due ? 'true' : undefined}
      className={
        'flex cursor-grab flex-col gap-1.5 rounded-[10px] border bg-surface p-3 text-left transition-colors duration-150 active:cursor-grabbing ' +
        (due ? 'border-amber-700 ' : 'border-border hover:border-border-strong ') +
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
        (dragging ? 'opacity-50' : '')
      }
    >
      <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary">{app.job.title}</span>
      <span className="truncate text-[12px] text-text-secondary">{app.job.company}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <DocChip kind="cv" ok={marks.cv} />
        <DocChip kind="letter" ok={marks.letter} />
        {when && <span className="text-[12px] text-text-secondary">{when}</span>}
      </span>
      {due && (
        <span className="flex">
          <span className="inline-flex min-h-6 items-center rounded-md bg-amber-50 px-2 py-0.5 text-[12px] font-semibold leading-tight text-amber-700">{dueLabel(app, today)}</span>
        </span>
      )}
    </button>
  )
}

function ClosedRow({ app, onOpen, drag, dragging }: { app: Application; onOpen: (id: string) => void; drag: DragProps; dragging: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(app.id)}
        {...drag}
        className={
          'flex w-full cursor-grab items-center gap-3 px-4 py-3 text-left hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring ' +
          (dragging ? 'opacity-50' : '')
        }
      >
        <AppStatusBadge status={app.status} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 text-[13px] font-semibold text-text-primary">{app.job.title}</span>
          <span className="truncate text-[12px] text-text-secondary">{app.job.company}</span>
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-text-secondary">{formatShortDate(app.updatedAt)}</span>
      </button>
    </li>
  )
}

// S7 · Lamaran (T43). The view toggle lives in the page header (App); the page draws what it picks.
export function ApplicationsPage({
  applications,
  view,
  onOpen,
  onJobs,
  onMove,
  onAdd,
  today: todayProp,
}: {
  applications: readonly Application[]
  view: ApplicationsViewId
  onOpen: (id: string) => void
  onJobs: () => void
  // A card was dropped on another status. Dragging is the quick way; Detail Lamaran has the same choice as a list.
  onMove: (id: string, status: AppStatus) => void
  // "Tambah lamaran": a job the feed did not recommend, typed in by hand.
  onAdd: (input: ManualInput) => Promise<AddResult>
  // Today's date for follow-ups (FR-47). The page works it out itself when not given; App passes a live one.
  today?: string
}) {
  const preview = import.meta.env.DEV ? previewApplicationsFromHash(location.hash) : undefined
  const all = preview?.applications ?? applications
  const today = preview?.now ? todayKey(new Date(preview.now)) : (todayProp ?? todayKey(new Date()))
  const due = dueSummary(all, today)
  const dueAlert = due && (
    <div data-alert="due" className="flex items-start gap-2.5 rounded-lg bg-amber-50 px-3.5 py-3 text-[13px] text-amber-700">
      <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="mt-px shrink-0" />
      <span>
        <b className="font-bold">{due.headline}</b> {due.names}
      </span>
    </div>
  )
  const [query, setQuery] = useState(preview?.query ?? '')
  const [closedOpen, setClosedOpen] = useState(preview?.closedOpen ?? false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<AppStatus | null>(null)
  const [moved, setMoved] = useState('')
  const [adding, setAdding] = useState(preview?.adding ?? false)

  // The diagram counts every application, whatever the search box says (FR-48).
  if (view === 'viz') {
    return (
      <div className="flex flex-col gap-4">
        {dueAlert}
        <SankeyChart funnel={funnelStats(all, preview?.now ? new Date(preview.now) : new Date())} />
      </div>
    )
  }

  const shown = searchApplications(all, query)
  const state = describeApplications(all.length, shown.length)
  const board = groupBoard(shown)
  const summary = closedSummary(board)

  const dragProps = (app: Application): DragProps => ({
    draggable: true,
    onDragStart: (event) => {
      event.dataTransfer?.setData('text/plain', app.id)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
      setDragId(app.id)
      setMoved('')
    },
    onDragEnd: () => {
      setDragId(null)
      setOver(null)
    },
  })

  // A status is a drop target only while a card is being dragged. Dropping on its own status changes nothing.
  const dropProps = (target: AppStatus) => ({
    'data-drop': target,
    onDragOver: (event: DragEvent) => {
      if (dragId === null) return
      event.preventDefault()
      if (over !== target) setOver(target)
    },
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null)
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      const app = all.find((item) => item.id === (dragId ?? event.dataTransfer?.getData('text/plain')))
      setDragId(null)
      setOver(null)
      if (!app || app.status === target) return
      onMove(app.id, target)
      setMoved(`${app.job.title} dipindah ke ${STATUS_LABEL[target]}`)
    },
  })
  const dragging = dragId !== null
  const overRing = (target: AppStatus) => (over === target ? 'outline-2 outline-dashed outline-accent bg-accent-wash' : '')

  const addButton = (
    <Button variant="secondary" aria-expanded={adding} onClick={() => setAdding(!adding)}>
      <Plus size={16} strokeWidth={2} aria-hidden="true" />
      Tambah lamaran
    </Button>
  )
  const form = adding && (
    <ManualForm
      onCancel={() => setAdding(false)}
      onSubmit={async (input) => {
        const result = await onAdd(input)
        if (result.ok) {
          setAdding(false)
          onOpen(result.id)
        }
        return result
      }}
    />
  )

  if (state === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {form}
        {!adding && (
          <Empty
            mascot="neutral"
            title="Belum ada lamaran"
            body="Pilih lowongan di Lowongan, lalu tekan Siapkan lamaran. Lamaran yang kamu isi lewat Buka & isi juga muncul di sini."
          >
            <Button onClick={onJobs}>Ke Lowongan</Button>
            {addButton}
          </Empty>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[200px] max-w-sm flex-1">
          <TextField
            label="Cari lamaran"
            aria-label="Cari lamaran"
            hideLabel
            className="h-10"
            placeholder="Cari judul atau perusahaan"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {addButton}
      </div>
      {dueAlert}
      {form}

      {state === 'no-match' ? (
        <Empty icon title="Tidak ada yang cocok" body={`Tidak ada lamaran yang cocok dengan “${query.trim()}”.`}>
          <Button variant="secondary" onClick={() => setQuery('')}>Reset filter</Button>
        </Empty>
      ) : (
        <>
          <div className="@container">
            <div className="grid grid-cols-1 gap-3 @min-[480px]:grid-cols-2 @min-[760px]:grid-cols-5">
              {board.columns.map((column) => (
                <section
                  key={column.status}
                  aria-label={column.label}
                  {...dropProps(column.status)}
                  className={
                    'flex-col gap-2 rounded-xl bg-neutral-100 p-2.5 transition-colors duration-150 ' +
                    // An empty column is hidden on a narrow board, but shown while dragging so it can still be dropped on.
                    (column.apps.length === 0 && !dragging ? 'hidden @min-[760px]:flex ' : 'flex ') +
                    overRing(column.status)
                  }
                >
                  <h4 className="flex items-center justify-between px-1 text-[12px] font-bold uppercase tracking-[0.03em] text-text-secondary">
                    {column.label}
                    <span className="tabular-nums">{column.apps.length}</span>
                  </h4>
                  {column.apps.length === 0 ? (
                    <p className="px-1 py-1 text-[12px] text-text-secondary">Belum ada.</p>
                  ) : (
                    column.apps.map((app) => <BoardCard key={app.id} app={app} onOpen={onOpen} drag={dragProps(app)} dragging={dragId === app.id} today={today} />)
                  )}
                </section>
              ))}
            </div>
          </div>

          {dragging && (
            <div className="grid grid-cols-2 gap-3">
              {(['rejected', 'withdrawn'] as const).map((status) => (
                <div
                  key={status}
                  {...dropProps(status)}
                  className={
                    'flex h-14 items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface text-[13px] font-semibold text-text-secondary transition-colors duration-150 ' +
                    overRing(status)
                  }
                >
                  Lepas di sini: {STATUS_LABEL[status]}
                </div>
              ))}
            </div>
          )}

          {summary && (
            <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-[13px] text-text-secondary">{summary}</span>
                <Button variant="secondary" aria-expanded={closedOpen} onClick={() => setClosedOpen(!closedOpen)}>
                  {closedOpen ? 'Sembunyikan' : 'Tampilkan'}
                  <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className={'transition-transform duration-200 ' + (closedOpen ? 'rotate-180' : '')} />
                </Button>
              </div>
              {closedOpen && (
                <ul className="divide-y divide-border border-t border-border">
                  {[...board.rejected, ...board.withdrawn].map((app) => (
                    <ClosedRow key={app.id} app={app} onOpen={onOpen} drag={dragProps(app)} dragging={dragId === app.id} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
      <p role="status" className="sr-only">{moved}</p>
    </div>
  )
}
