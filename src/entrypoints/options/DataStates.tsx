import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { canConfirmDelete, DELETE_WORD, type DataEvent, type DataState } from '../../core/data/state'
import { formatBytes } from '../../core/data/storage-usage'
import { Mascot } from '../../ui/mascot/Mascot'
import { Button } from '../../ui/primitives/Button'
import { TextField } from '../../ui/primitives/TextField'

type Dispatch = (event: DataEvent) => void
type Of<K extends DataState['kind']> = Extract<DataState, { kind: K }>

const ERROR_TEXT = {
  'not-json': {
    title: 'Berkas bukan JSON yang valid',
    body: 'Berkas ini tidak bisa dibaca sebagai JSON. Pilih berkas hasil Export dari job-kit.',
  },
  'unknown-version': {
    title: 'Versi berkas tidak dikenal',
    body: 'Berkas ini dibuat oleh job-kit versi yang berbeda dari yang terpasang. Membacanya paksa berisiko membuang field yang belum dikenal.',
  },
  'wrong-shape': {
    title: 'Berkas tidak berisi profil job-kit',
    body: 'JSON-nya terbaca, tetapi bentuknya bukan hasil Export job-kit.',
  },
  encrypted: {
    title: 'PDF dikunci dengan kata sandi',
    body: 'job-kit tidak membuka PDF yang terenkripsi. Buka kuncinya dulu, atau isi profil secara manual.',
  },
  'no-text-layer': {
    title: 'PDF tidak punya lapisan teks',
    body: 'Kemungkinan ini hasil scan atau foto. job-kit tidak memakai OCR. Isi profil secara manual, atau pakai PDF yang diekspor dari Word atau Google Docs.',
  },
  unreadable: {
    title: 'PDF tidak bisa dibaca',
    body: 'Berkasnya rusak atau formatnya tidak didukung. Isi profil secara manual.',
  },
} as const

function Panel({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-md">{children}</section>
}

function ModeChoice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        'h-9 flex-1 px-4 text-[13px] font-semibold transition-colors duration-150 ' +
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
        (selected ? 'bg-accent text-text-on-accent' : 'bg-neutral-100 text-text-secondary hover:bg-neutral-200')
      }
    >
      {children}
    </button>
  )
}

export function ImportPreview({
  state,
  dispatch,
  onApply,
}: {
  state: Of<'import-preview'>
  dispatch: Dispatch
  onApply: () => void
}) {
  const changes = state.changes[state.mode]
  return (
    <Panel>
      <div>
        <p className="text-[14px] font-bold text-text-primary">{state.fileName}</p>
        <p className="text-[12px] text-text-secondary">{formatBytes(state.fileSize)}</p>
      </div>
      <div>
        <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-neutral-400">Yang akan berubah</h2>
        {changes.length === 0 ? (
          <p className="mt-2 text-[13px] text-text-secondary">Tidak ada yang berubah dari profil sekarang.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {changes.map((change) => (
              <li key={change.label} className="flex items-center justify-between gap-4 py-2 text-[13px]">
                <span className="font-semibold text-text-primary">{change.label}</span>
                <span className="text-text-secondary">
                  {change.before} → <span className="font-semibold text-text-primary">{change.after}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div role="group" aria-label="Cara import" className="flex overflow-hidden rounded-md">
        <ModeChoice selected={state.mode === 'merge'} onClick={() => dispatch({ type: 'set-mode', mode: 'merge' })}>
          Gabung
        </ModeChoice>
        <ModeChoice selected={state.mode === 'replace'} onClick={() => dispatch({ type: 'set-mode', mode: 'replace' })}>
          Ganti seluruhnya
        </ModeChoice>
      </div>
      <p className="text-[12px] text-text-secondary">
        {state.mode === 'merge'
          ? 'Gabung menambah data dari berkas tanpa menimpa yang sudah ada.'
          : 'Ganti menimpa seluruh profil dengan isi berkas.'}
      </p>
      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={() => dispatch({ type: 'cancel' })}>
          Batal
        </Button>
        <Button disabled={changes.length === 0} onClick={onApply}>
          Terapkan import
        </Button>
      </div>
    </Panel>
  )
}

export function ImportError({ state, dispatch }: { state: Of<'import-error'>; dispatch: Dispatch }) {
  const text = ERROR_TEXT[state.reason]
  return (
    <Panel>
      <div className="flex items-start gap-4">
        <Mascot state="error" size={56} />
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-rose-700">
            <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
            Import dibatalkan
          </h2>
          <p className="text-[13px] font-semibold text-text-primary">
            {text.title}
            {state.detail && ` (${state.detail})`}
          </p>
          <p className="text-[13px] text-text-secondary">{text.body}</p>
          <p className="text-[13px] text-text-secondary">Tidak ada data yang berubah. Berkas: {state.fileName}</p>
        </div>
      </div>
      <div>
        <Button variant="secondary" onClick={() => dispatch({ type: 'cancel' })}>
          Kembali
        </Button>
      </div>
    </Panel>
  )
}

export function ConfirmDelete({
  state,
  dispatch,
  onConfirm,
}: {
  state: Of<'confirm-delete'>
  dispatch: Dispatch
  onConfirm: () => void
}) {
  return (
    <Panel>
      <div>
        <h2 className="text-[14px] font-bold text-text-primary">Hapus semua data job-kit?</h2>
        <p className="mt-1 text-[13px] text-text-secondary">
          Profil kamu akan hilang dari storage browser ini. Tidak ada backup di server, hanya berkas Export kalau kamu punya.
        </p>
      </div>
      <TextField
        label={`Ketik ${DELETE_WORD} untuk melanjutkan`}
        value={state.typed}
        onChange={(event) => dispatch({ type: 'type-confirm', value: event.target.value })}
        autoComplete="off"
      />
      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={() => dispatch({ type: 'cancel' })}>
          Batal
        </Button>
        <Button variant="danger" disabled={!canConfirmDelete(state.typed)} onClick={onConfirm}>
          Hapus semua
        </Button>
      </div>
    </Panel>
  )
}

export function Done({ state, dispatch }: { state: Of<'done'>; dispatch: Dispatch }) {
  return (
    <Panel>
      <div className="flex items-start gap-4">
        <Mascot state="success" size={56} />
        <div>
          <h2 className="text-[14px] font-bold text-green-700">{state.title}</h2>
          <p className="mt-1 text-[13px] text-text-secondary">{state.detail}</p>
        </div>
      </div>
      <div>
        <Button variant="secondary" onClick={() => dispatch({ type: 'cancel' })}>
          Selesai
        </Button>
      </div>
    </Panel>
  )
}
