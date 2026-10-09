import { X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { formatJobDate } from '../../core/jobs/jobs'
import { JOB_STATUSES, type CapturedJob } from '../../core/jobs/types'
import { Button } from '../../ui/primitives/Button'
import { IconButton } from '../../ui/primitives/IconButton'
import { Select } from '../../ui/primitives/Select'
import { TextArea } from '../../ui/primitives/TextArea'

const UNAVAILABLE = 'Belum tersedia di versi ini'

export function JobDetail({ job, onClose }: { job: CapturedJob; onClose: () => void }) {
  const reduce = useReducedMotion()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-10 flex justify-end">
      <button type="button" aria-label="Tutup detail" onClick={onClose} className="absolute inset-0 cursor-default bg-neutral-900/25" />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={job.title}
        initial={reduce ? false : { x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative flex h-full w-full max-w-[480px] flex-col border-l border-border bg-surface shadow-lg"
      >
        <header className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-bold text-text-primary">{job.title}</h2>
            <p className="mt-1 truncate text-[13px] text-text-secondary">
              {job.company} · {job.origin}
            </p>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </IconButton>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-auto px-6 py-5">
          <dl className="grid grid-cols-[100px_1fr] items-center gap-x-4 gap-y-3 text-[14px]">
            <dt className="text-text-secondary">Dilamar</dt>
            <dd>{formatJobDate(job.appliedAt)}</dd>
            <dt className="text-text-secondary">Situs</dt>
            <dd>{job.origin}</dd>
          </dl>

          <Select label="Status" defaultValue={job.status} disabled title={UNAVAILABLE}>
            {JOB_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </Select>

          <section>
            <h3 className="text-[14px] font-bold text-text-primary">Snapshot field yang dikirim</h3>
            <p className="mt-1 text-[12px] text-text-secondary">Nilai saat lamaran dikirim, bukan nilai profil sekarang.</p>
            <dl className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {job.snapshot.map((row) => (
                <div key={row.label} className="flex gap-4 px-3 py-2 text-[13px]">
                  <dt className="w-[140px] shrink-0 truncate text-text-secondary">{row.label}</dt>
                  <dd className="min-w-0 flex-1 truncate text-text-primary">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <TextArea label="Catatan" placeholder="Recruiter bilang kabar dalam 2 minggu." disabled title={UNAVAILABLE} />
        </div>

        <footer className="flex items-center gap-3 border-t border-border px-6 py-4">
          <Button disabled title={UNAVAILABLE}>
            Simpan perubahan
          </Button>
          <Button variant="danger" disabled title={UNAVAILABLE}>
            Hapus entri
          </Button>
          <span className="text-[12px] text-text-secondary">{UNAVAILABLE}</span>
        </footer>
      </motion.aside>
    </div>
  )
}
