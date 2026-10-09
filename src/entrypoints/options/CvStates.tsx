import { LoaderCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import type { CvRow, CvRowGroup } from '../../core/cv/preview'
import type { DataEvent, DataState } from '../../core/data/state'
import { formatBytes } from '../../core/data/storage-usage'
import { Button } from '../../ui/primitives/Button'
import { Checkbox } from '../../ui/primitives/Checkbox'

const UNAVAILABLE = 'Belum tersedia di versi ini'

type Dispatch = (event: DataEvent) => void
type Of<K extends DataState['kind']> = Extract<DataState, { kind: K }>

const GROUP_TITLES: Record<CvRowGroup, string> = {
  personal: 'Personal Info',
  contact: 'Contact & Address',
  education: 'Education',
  experience: 'Work Experience',
}
const GROUP_ORDER: CvRowGroup[] = ['personal', 'contact', 'education', 'experience']

function Panel({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-md">{children}</section>
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-neutral-400">{children}</h3>
}

function Badge({ tone, children }: { tone: 'attention' | 'quiet'; children: string }) {
  return (
    <span
      className={
        'rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ' +
        (tone === 'attention' ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-text-secondary')
      }
    >
      {children}
    </span>
  )
}

export function ImportParsing({ state }: { state: Of<'parsing'> }) {
  const reduce = useReducedMotion()
  return (
    <Panel>
      <div className="flex items-start gap-4" role="status">
        <motion.span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-wash text-accent"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 1.1, ease: 'linear', repeat: Infinity }}
        >
          <LoaderCircle size={18} strokeWidth={2} />
        </motion.span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-text-primary">Membaca {state.fileName}…</h2>
          <p className="mt-1 text-[13px] text-text-secondary">Teks dibaca di browser ini. Berkas tidak dikirim ke mana pun.</p>
        </div>
      </div>
    </Panel>
  )
}

function RowLabel({ row }: { row: CvRow }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-[13px] font-semibold text-text-primary">{row.label}</span>
      {row.confidence === 'low' && <Badge tone="attention">Periksa lagi</Badge>}
      {row.duplicate ? (
        <Badge tone="quiet">Sudah ada</Badge>
      ) : (
        row.occupied && row.group !== 'education' && row.group !== 'experience' && <Badge tone="quiet">Sudah berisi</Badge>
      )}
    </div>
  )
}

function RowValue({ row }: { row: CvRow }) {
  return (
    <p className="mt-0.5 break-words whitespace-pre-line text-[13px] text-text-secondary">
      {row.oldValue && (
        <>
          <span className="line-through">{row.oldValue}</span> →{' '}
        </>
      )}
      <span className="font-semibold text-text-primary">{row.newValue}</span>
    </p>
  )
}

export function CvPreview({ state, dispatch }: { state: Of<'import-cv-preview'>; dispatch: Dispatch }) {
  const empty = state.rows.length === 0
  return (
    <Panel>
      <div>
        <p className="break-words text-[14px] font-bold text-text-primary">{state.fileName}</p>
        <p className="text-[12px] text-text-secondary">{formatBytes(state.fileSize)}</p>
      </div>

      {empty ? (
        <div>
          <h2 className="text-[14px] font-bold text-text-primary">Tidak ada yang terdeteksi</h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            CV ini terbaca, tetapi tidak ada field yang bisa dipetakan. Isi profil secara manual.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-[14px] font-bold text-text-primary">Hasil baca CV</h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            Centang yang mau diisi ke profil. Yang sudah berisi dilewati, kecuali kamu mencentangnya.
          </p>
        </div>
      )}

      {GROUP_ORDER.map((group) => {
        const rows = state.rows.filter((row) => row.group === group)
        if (rows.length === 0) return null
        return (
          <div key={group}>
            <SectionTitle>{GROUP_TITLES[group]}</SectionTitle>
            <ul className="mt-2 divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id} className="py-2.5">
                  <Checkbox
                    checked={state.selected.includes(row.id)}
                    onChange={() => dispatch({ type: 'toggle-field', id: row.id })}
                  >
                    <RowLabel row={row} />
                    <RowValue row={row} />
                  </Checkbox>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {state.unparsed.length > 0 && (
        <div>
          <SectionTitle>Tidak bisa dipetakan</SectionTitle>
          <p className="mt-2 text-[13px] text-text-secondary">Teks ini tidak ikut diisi. Salin manual kalau perlu.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {state.unparsed.map((block, index) => (
              <li
                key={index}
                className="break-words whitespace-pre-line rounded-md border border-border bg-surface-sunken px-3 py-2 text-[13px] text-text-secondary"
              >
                {block.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!empty && (
          <span className="mr-auto text-[12px] text-text-secondary">
            {state.selected.length} dari {state.rows.length} dipilih
          </span>
        )}
        <span className="text-[12px] text-text-secondary">{UNAVAILABLE}</span>
        <Button variant="secondary" onClick={() => dispatch({ type: 'cancel' })}>
          Batal
        </Button>
        <Button disabled title={UNAVAILABLE}>
          Isi profil
        </Button>
      </div>
    </Panel>
  )
}
