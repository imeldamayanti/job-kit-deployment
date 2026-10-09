import { Download, Trash2, Upload } from 'lucide-react'
import { useReducer, type ReactNode } from 'react'
import { buildExport, exportFileName } from '../../core/data/export'
import { previewStateFromHash } from '../../core/data/preview-states'
import { describeUsage } from '../../core/data/storage-usage'
import { initialDataState, reduceData } from '../../core/data/state'
import type { Profile } from '../../core/profile/types'
import { downloadText } from '../../platform/download'
import { useStorageUsage } from '../../ui/hooks/useStorageUsage'
import { Button } from '../../ui/primitives/Button'
import { ConfirmDelete, Done, ImportError, ImportPreview } from './DataStates'

const UNAVAILABLE = 'Belum tersedia di versi ini'

function startState() {
  // The D2-D5 samples exist only to be looked at in a dev build.
  return (import.meta.env.DEV ? previewStateFromHash(location.hash) : undefined) ?? initialDataState
}

function ActionCard({
  icon,
  tone = 'accent',
  title,
  body,
  note,
  children,
}: {
  icon: ReactNode
  tone?: 'accent' | 'danger'
  title: string
  body: string
  note?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-md">
      <span
        aria-hidden="true"
        className={
          'flex h-9 w-9 items-center justify-center rounded-lg ' +
          (tone === 'danger' ? 'bg-rose-50 text-rose-700' : 'bg-accent-wash text-accent')
        }
      >
        {icon}
      </span>
      <div>
        <h2 className="text-[14px] font-bold text-text-primary">{title}</h2>
        <p className="mt-1 text-[13px] text-text-secondary">{body}</p>
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-1">
        {children}
        {note && <p className="text-[12px] text-text-secondary">{note}</p>}
      </div>
    </section>
  )
}

function StorageCard() {
  const usage = useStorageUsage()
  const { text, ratio } = usage ? describeUsage(usage.used, usage.quota) : { text: '', ratio: 0 }
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-md">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[14px] font-bold text-text-primary">Pemakaian storage</h2>
        <p className="text-[13px] text-text-secondary">{text}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(ratio * 100, usage ? 2 : 0)}%` }} />
      </div>
      <p className="mt-3 text-[13px] text-text-secondary">
        Data disimpan tanpa enkripsi di chrome.storage.local. Siapa pun dengan akses ke profil Chrome ini bisa membacanya.
      </p>
    </section>
  )
}

export function DataPage({ profile }: { profile: Profile | null }) {
  const [state, dispatch] = useReducer(reduceData, undefined, startState)

  if (state.kind === 'import-preview') return <ImportPreview state={state} dispatch={dispatch} />
  if (state.kind === 'import-error') return <ImportError state={state} dispatch={dispatch} />
  if (state.kind === 'confirm-delete') return <ConfirmDelete state={state} dispatch={dispatch} />
  if (state.kind === 'done') return <Done state={state} dispatch={dispatch} />

  const exportProfile = () => {
    if (!profile) return
    const now = new Date()
    downloadText(exportFileName(now), buildExport(profile, now))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ActionCard
          icon={<Download size={18} strokeWidth={2} />}
          title="Export"
          body="Seluruh profil ke satu file JSON berversi."
        >
          <Button disabled={!profile} onClick={exportProfile}>
            Export JSON
          </Button>
        </ActionCard>
        <ActionCard
          icon={<Upload size={18} strokeWidth={2} />}
          title="Import"
          body="Baca file export. Kamu memilih gabung atau ganti setelah melihat pratinjau."
          note={UNAVAILABLE}
        >
          <Button variant="secondary" disabled title={UNAVAILABLE}>
            Pilih file
          </Button>
        </ActionCard>
        <ActionCard
          icon={<Trash2 size={18} strokeWidth={2} />}
          tone="danger"
          title="Hapus semua"
          body="Menghapus profil dari storage browser ini. Tidak ada backup di server."
          note={UNAVAILABLE}
        >
          <Button variant="danger" disabled title={UNAVAILABLE}>
            Hapus semua
          </Button>
        </ActionCard>
      </div>
      <StorageCard />
    </div>
  )
}
