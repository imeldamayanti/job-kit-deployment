import { Info } from 'lucide-react'
import { uploadNote, type PanelContext } from '../../core/applications/panel'
import { STATUS_LABEL } from '../../core/applications/view'
import type { FillRecord } from '../../platform/applications'
import type { UploadSummary } from '../../platform/messaging'

export { FromFeed } from './FromFeed'

// File inputs are never touched (RFC D14): each is listed with why, and which file to pick. No control here can attach anything.
export function UploadRows({ uploads, context }: { uploads: UploadSummary[]; context: PanelContext | undefined }) {
  if (uploads.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">Unggah file</h2>
      <ul className="flex flex-col gap-3">
        {uploads.map((upload, index) => (
          <li key={index} className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] text-text-primary">{upload.label}</span>
              <span className="break-words text-[12px] text-text-secondary">{uploadNote(upload.label, context)}</span>
            </span>
            <span className="shrink-0 rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold text-text-secondary">Unggah manual</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// After Fill: which application was marked, with a way back to it (FR-36). Undo does not undo this, and the panel says nothing of it.
export function FillNotice({ record, onOpen }: { record: FillRecord | undefined; onOpen: (applicationId: string) => void }) {
  if (!record) return null
  return (
    <section role="status" className="flex items-start gap-2 rounded-xl border border-border bg-accent-wash p-3">
      <Info size={16} strokeWidth={2.25} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
      <p className="text-[13px] text-text-primary">
        <b>
          {record.advanced
            ? `Lamaran ke ${record.company} ditandai Dilamar.`
            : `Lamaran ke ${record.company} tetap berstatus ${STATUS_LABEL[record.status]}.`}
        </b>{' '}
        {record.advanced && 'Salah tandai? Ubah di Lamaran. '}
        <button
          type="button"
          onClick={() => onOpen(record.applicationId)}
          className="rounded-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
        >
          Lihat lamaran
        </button>
      </p>
    </section>
  )
}
