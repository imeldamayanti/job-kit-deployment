import { Check, ExternalLink, FileText, Pencil, Send, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { historyOf, summarySteps, type SummaryStep } from '../../core/applications/detail'
import { APP_STATUSES, type AppStatus, type Application } from '../../core/applications/types'
import { DETAIL_TABS, formatShortDate, sourceLabel, STATUS_LABEL, type DetailTab } from '../../core/applications/view'
import { createAutosaver, type SaveOutcome, type SaveState } from '../../core/profile/autosave'
import { Button } from '../../ui/primitives/Button'
import { Select } from '../../ui/primitives/Select'
import { TextArea } from '../../ui/primitives/TextArea'
import { TextField } from '../../ui/primitives/TextField'
import { AppStatusBadge } from './AppStatusBadge'
import { CvTab, type CvTabState } from './CvTab'
import { LetterTab, type LetterTabState } from './LetterTab'
import { FolderTabs } from './FolderTabs'
import { SaveIndicator } from './SaveIndicator'

export type ApplicationDraft = { notes: string; followUpAt: string | null; description?: string; url?: string }

const AUTOSAVE_DELAY_MS = 500

const TONE_DOT = { ok: 'bg-green-50 text-green-700', prog: 'bg-violet-50 text-violet-700', dim: 'bg-neutral-100 text-text-secondary' } as const

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-md">
      {title && <h2 className="text-[14px] font-bold text-text-primary">{title}</h2>}
      {children}
    </section>
  )
}

function StepRow({ step, blocked, onOpenTab, onOpenForm }: { step: SummaryStep; blocked: boolean; onOpenTab: (tab: DetailTab) => void; onOpenForm: () => void }) {
  const tick = step.done
    ? 'bg-green-50 text-green-700'
    : step.current
      ? 'border-2 border-accent text-accent'
      : 'border-2 border-border-strong text-text-secondary'
  const Icon = step.done ? Check : step.id === 'fill' ? Send : Pencil
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span aria-hidden="true" className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ' + tick}>
        <Icon size={13} strokeWidth={2.5} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-[14px] font-semibold text-text-primary">{step.title}</b>
        <span className="text-[13px] text-text-secondary">{step.id === 'fill' && blocked ? 'Isi link lowongan dulu supaya bisa dibuka.' : step.note}</span>
      </span>
      {step.id === 'fill' ? (
        <Button onClick={onOpenForm} disabled={blocked}>Buka &amp; isi</Button>
      ) : (
        <Button variant="secondary" onClick={() => onOpenTab(step.id === 'cv' ? 'cv' : 'letter')}>{step.id === 'cv' ? 'Buka CV' : 'Buka surat'}</Button>
      )}
    </div>
  )
}

// A tab shown without its state, as in tests that do not need it. It says why its button is off, above the button.
function WaitingTab({ emptyTitle, reason, action }: { emptyTitle: string; reason: string; action: string }) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-text-secondary">
        <FileText size={18} strokeWidth={2} />
      </span>
      <h2 className="mt-1 text-[16px] font-bold text-text-primary">{emptyTitle}</h2>
      <p className="max-w-[46ch] text-[14px] text-text-secondary">{reason}</p>
      <Button disabled className="mt-2">{action}</Button>
    </section>
  )
}

// S8 · Detail Lamaran (T44): a sub-page of Lamaran, with a way back. CV and Surat are shells when the page is given no state for them.
export function ApplicationDetailPage({
  application,
  initialTab = 'summary',
  onBack,
  onStatus,
  onSave,
  onDelete,
  onOpenForm,
  cvTab,
  letterTab,
}: {
  application: Application
  initialTab?: DetailTab
  onBack: () => void
  onStatus: (status: AppStatus) => void
  onSave: (draft: ApplicationDraft) => Promise<SaveOutcome>
  onDelete: () => Promise<void>
  onOpenForm: () => void
  // Absent in previews and tests, where the tab stays the shell it was in T44.
  cvTab?: CvTabState
  letterTab?: LetterTabState
}) {
  const [tab, setTab] = useState<DetailTab>(initialTab)
  const [notes, setNotes] = useState(application.notes)
  const [followUp, setFollowUp] = useState(application.followUpAt ?? '')
  const [description, setDescription] = useState(application.job.description)
  const [url, setUrl] = useState(application.job.url)
  // A posting added by hand may have no link yet, so its link can be typed in here.
  const isManual = application.job.source === 'manual'
  // The paste box shows when the source gave no text, and stays while the person types into it.
  const [pasteMode] = useState(() => application.job.description.trim() === '')
  const [saveState, setSaveState] = useState<SaveState | 'idle'>('idle')
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const saveRef = useRef(onSave)
  saveRef.current = onSave
  const saver = useMemo(() => createAutosaver<ApplicationDraft>((draft) => saveRef.current(draft), AUTOSAVE_DELAY_MS, setSaveState), [])
  useEffect(() => () => void saver.flush(), [saver])

  const edit = (change: { notes?: string; followUp?: string; description?: string; url?: string }) => {
    const next = { notes, followUp, description, url, ...change }
    setNotes(next.notes)
    setFollowUp(next.followUp)
    setDescription(next.description)
    setUrl(next.url)
    saver.schedule({
      notes: next.notes,
      followUpAt: next.followUp || null,
      ...(pasteMode ? { description: next.description } : {}),
      ...(isManual ? { url: next.url } : {}),
    })
  }
  const hasLink = url.trim() !== ''

  const steps = summarySteps(application)
  const history = historyOf(application)
  const noText = description.trim() === ''

  const followUpField = (
    <TextField label="Tindak lanjut (opsional)" type="date" value={followUp} onChange={(event) => edit({ followUp: event.target.value })} />
  )

  const remove = async () => {
    setDeleting(true)
    await onDelete()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="-mb-3">
        <Button variant="secondary" onClick={onBack}>← Lamaran</Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight text-text-primary">{application.job.title}</h1>
          <p className="mt-1 text-[14px] text-text-secondary">
            {application.job.company} · {sourceLabel(application.job.source)} · Disiapkan {formatShortDate(application.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Status" value={application.status} onChange={(event) => onStatus(event.target.value as AppStatus)}>
            {APP_STATUSES.map((status) => (
              <option key={status} value={status}>{STATUS_LABEL[status]}</option>
            ))}
          </Select>
          {hasLink && (
          <a
            href={url.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-[13px] font-semibold text-accent transition-colors duration-150 hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
            Buka lowongan
          </a>
          )}
          {saveState !== 'idle' && <SaveIndicator state={saveState} />}
        </div>
      </header>

      {saveState === 'storage-full' && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-border bg-rose-50 px-4 py-3 text-rose-700">
          <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
          <p className="text-[13px] font-semibold">Penyimpanan penuh. Perubahan terakhir belum tersimpan; data lama aman.</p>
        </div>
      )}

      <FolderTabs label="Detail lamaran" tabs={DETAIL_TABS} current={tab} onSelect={setTab} />

      {tab === 'summary' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card title="Siap melamar">
              <div className="divide-y divide-border">
                {steps.map((step) => (
                  <StepRow key={step.id} step={step} blocked={!hasLink} onOpenTab={setTab} onOpenForm={onOpenForm} />
                ))}
              </div>
            </Card>
            <Card title="Lowongan">
              {isManual && (
                <TextField label="Link lowongan" type="url" placeholder="https://…" value={url} onChange={(event) => edit({ url: event.target.value })} />
              )}
              {pasteMode ? (
                <>
                  <TextArea label="Tempel teks lowongan" rows={8} value={description} onChange={(event) => edit({ description: event.target.value })} />
                  <p className="text-[12px] text-text-secondary">
                    Sumber lowongan ini tidak menyertakan teksnya. {noText ? 'Tanpa teks lowongan, Buat CV dan Buat surat nonaktif.' : 'Teks ini disimpan di lamaran ini.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-text-primary">{description}</div>
                  <p className="text-[12px] text-text-secondary">Salinan teks lowongan disimpan di lamaran ini, jadi tetap ada walau lowongan hilang dari feed.</p>
                </>
              )}
            </Card>
          </div>
          <Card title="Status">
            <div>
              <AppStatusBadge status={application.status} />
            </div>
            {followUpField}
          </Card>
        </div>
      )}

      {tab === 'cv' && cvTab && (
        // The posting text is pasted on the Ringkasan tab, so that link switches tabs here; the others leave the page.
        <CvTab {...cvTab} onLink={(link) => (link === 'description' ? setTab('summary') : cvTab.onLink(link))} />
      )}

      {tab === 'cv' && !cvTab && (
        <WaitingTab
          emptyTitle="CV untuk lowongan ini belum dibuat"
          reason="Pembuatan CV dengan AI belum tersedia di versi ini. Lamaran ini tetap bisa dilacak."
          action="Buat CV"
        />
      )}

      {tab === 'letter' && letterTab && (
        <LetterTab {...letterTab} onLink={(link) => (link === 'description' ? setTab('summary') : letterTab.onLink(link))} />
      )}

      {tab === 'letter' && !letterTab && (
        <WaitingTab
          emptyTitle="Surat untuk lowongan ini belum dibuat"
          reason="Pembuatan surat dengan AI belum tersedia di versi ini. Lamaran ini tetap bisa dilacak."
          action="Buat surat"
        />
      )}

      {tab === 'notes' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <TextArea label="Catatan" rows={8} value={notes} onChange={(event) => edit({ notes: event.target.value })} />
            <div className="max-w-[240px]">{followUpField}</div>
          </div>
          <Card title="Riwayat">
            {history.length === 0 ? (
              <p className="text-[13px] text-text-secondary">Belum ada riwayat.</p>
            ) : (
              <ol className="flex flex-col">
                {history.map((row, index) => (
                  <li key={index} className="relative flex items-start gap-3 pb-3 last:pb-0">
                    {index < history.length - 1 && <span aria-hidden="true" className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-border" />}
                    <span aria-hidden="true" className={'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full ' + TONE_DOT[row.tone]}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] text-text-primary">{row.text}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-text-secondary">{row.when}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}

      {confirming ? (
        <div role="alertdialog" aria-label="Hapus lamaran" className="flex flex-col gap-3 rounded-xl border border-border bg-rose-50 p-4">
          <p className="text-[13px] text-text-primary">
            Hapus lamaran ke <b>{application.job.company}</b>? CV dan suratnya ikut terhapus. Lowongannya tetap ada di tab Disimpan.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={deleting}>Batal</Button>
            <Button variant="danger" onClick={() => void remove()} disabled={deleting}>Hapus lamaran</Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="danger" onClick={() => setConfirming(true)}>Hapus lamaran</Button>
        </div>
      )}
    </div>
  )
}
