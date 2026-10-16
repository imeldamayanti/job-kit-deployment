import { Check, Download, FileText, Minus, Pencil, RefreshCw, Sparkles, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { formatShortDate } from '../../core/applications/view'
import type { Profile } from '../../core/profile/types'
import type { CvParts } from '../../core/tailor/diff'
import { cvParts, overwritesEdits } from '../../core/tailor/edit'
import type { CvView } from '../../core/tailor/view'
import { Button } from '../../ui/primitives/Button'
import { TextArea } from '../../ui/primitives/TextArea'
import { CvDiff } from './CvDiff'
import { Alert, Card } from './DocParts'
import { Empty } from './EmptyState'

export type CvLink = 'profile' | 'description' | 'settings'

// What the tab needs from the page: what to show (CvView) and what the buttons do.
export type CvTabState = CvView & {
  onCreate: () => void
  // "Lanjut" on the data notice: acknowledge it and make the CV.
  onContinue: () => void
  onDismissNotice: () => void
  onLink: (link: CvLink) => void
  // A hand edit. The page saves it (after a short pause) and marks the CV edited.
  onEdit: (parts: CvParts) => void
  onRestore: () => void
  // Unduh PDF (T50), and Salin teks CV for when the PDF could not be made.
  onDownload: () => void
  onCopyText: () => void
}

const LINK_LABEL: Record<CvLink, string> = { settings: 'Buka Atur Lowongan', profile: 'Ke Profile', description: 'Tempel teks lowongan' }

function Requirements({ title, items, tone }: { title: string; items: string[]; tone: 'ok' | 'gap' }) {
  if (items.length === 0) return null
  const Icon = tone === 'ok' ? Check : Minus
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">{title}</h3>
      <ul className="flex flex-col gap-1 text-[14px] text-text-primary">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Icon size={15} strokeWidth={2.5} aria-hidden="true" className={'mt-0.5 shrink-0 ' + (tone === 'ok' ? 'text-green-700' : 'text-amber-700')} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Hand editing (FR-41): bullets as text, one per line, and skills that can be taken out. Nothing can be added here that
// the Profile does not have, except the person's own words in a bullet; the CV is then marked as edited.
function Editor({ draft, profile, onChange }: { draft: CvParts; profile: Profile | null; onChange: (parts: CvParts) => void }) {
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(draft.experience.map((e) => [e.sourceId, e.bullets.join('\n')])))
  const [skills, setSkills] = useState(draft.skills)

  const emit = (nextTexts: Record<string, string>, nextSkills: string[]) =>
    onChange({
      skills: nextSkills,
      experience: draft.experience.map((e) => ({ sourceId: e.sourceId, bullets: (nextTexts[e.sourceId] ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '') })),
      education: draft.education,
    })
  const labelOf = (id: string) => {
    const source = profile?.experience.find((e) => e.id === id)
    return source ? `${source.title} · ${source.company}` : id
  }

  return (
    <Card title="Edit CV">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">Skill</h3>
        <ul className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <li key={skill} className="inline-flex items-center gap-1 rounded-md bg-neutral-100 py-0.5 pl-2 pr-1 text-[12px] font-medium text-text-primary">
              {skill}
              <button
                type="button"
                aria-label={`Hapus skill ${skill}`}
                className="flex h-5 w-5 items-center justify-center rounded text-text-secondary hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-focus-ring"
                onClick={() => {
                  const next = skills.filter((s) => s !== skill)
                  setSkills(next)
                  emit(texts, next)
                }}
              >
                <X size={12} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {draft.experience.map((e) => (
        <TextArea
          key={e.sourceId}
          label={`Butir pengalaman, satu per baris: ${labelOf(e.sourceId)}`}
          rows={6}
          value={texts[e.sourceId] ?? ''}
          onChange={(event) => {
            const next = { ...texts, [e.sourceId]: event.target.value }
            setTexts(next)
            emit(next, skills)
          }}
        />
      ))}
      <p className="text-[12px] text-text-secondary">Suntinganmu tersimpan otomatis dan CV ditandai Diedit. Jabatan, perusahaan, institusi, dan tanggal tetap dari Profile.</p>
    </Card>
  )
}

export function CvTab({
  cv, availability, busy, message, rejected, notice, stale, profile, downloading, downloadError, downloadNote,
  onCreate, onContinue, onDismissNotice, onLink, onEdit, onRestore, onDownload, onCopyText,
}: CvTabState) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const blocked = availability !== null && !availability.ok ? availability : null
  const off = busy || availability === null || blocked !== null

  // Buat ulang on a CV the person edited would throw the edits away, so it asks first (FR-45).
  const regenerate = () => (overwritesEdits(cv) ? setConfirming(true) : onCreate())
  const create = (label: string, variant: 'primary' | 'secondary' = 'primary') => (
    <Button variant={variant} onClick={regenerate} disabled={off}>
      {variant === 'primary' ? <Sparkles size={15} strokeWidth={2} aria-hidden="true" /> : <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />}
      {busy ? (cv ? 'Membuat…' : 'Sedang membuat…') : label}
    </Button>
  )
  const linkButton = blocked && <Button variant="secondary" onClick={() => onLink(blocked.link)}>{LINK_LABEL[blocked.link]}</Button>

  const notices = (
    <>
      {notice !== null && (
        <Alert tone="warn" role="note">
          <p>{notice}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button onClick={onContinue} disabled={busy}>Lanjut</Button>
            <Button variant="secondary" onClick={() => onLink('settings')}>Buka Atur Lowongan</Button>
            <Button variant="secondary" onClick={onDismissNotice}>Batal</Button>
          </div>
        </Alert>
      )}
      {message !== null && (
        <Alert tone={rejected ? 'bad' : 'warn'} role="alert">
          <p>
            {rejected && <b>CV tidak ditampilkan. </b>}
            {message}
          </p>
          {rejected && (
            <div className="mt-2.5">
              <Button variant="secondary" onClick={regenerate} disabled={off}>
                <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
                Coba lagi
              </Button>
            </div>
          )}
        </Alert>
      )}
    </>
  )

  if (cv === null) {
    // A refusal with no earlier CV: the alert and "Coba lagi" are the whole tab, as in the mockup.
    if (rejected && message !== null && !busy) return <div className="flex flex-col gap-4">{notices}</div>
    if (blocked?.reason === 'no-experience') {
      return (
        <div className="flex flex-col gap-4">
          {notices}
          <Empty icon={<FileText size={18} strokeWidth={2} />} title="Isi Work Experience dulu" body="CV disusun dari pengalaman di Profile. Belum ada yang bisa dipilih.">
            <Button variant="secondary" onClick={() => onLink('profile')}>{LINK_LABEL.profile}</Button>
          </Empty>
        </div>
      )
    }
    if (busy) {
      return (
        <div className="flex flex-col gap-4">
          {notices}
          <Card title="Sedang membuat">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] text-text-secondary">Biasanya 10–20 detik</span>
              {create('Buat CV')}
            </div>
            <p className="text-[12px] text-text-secondary">Membaca requirement lowongan → menyusun CV → memeriksa semua fakta terhadap Profile.</p>
          </Card>
        </div>
      )
    }
    if (blocked) {
      return (
        <div className="flex flex-col gap-4">
          {notices}
          <Card title="CV untuk lowongan ini belum dibuat">
            <Alert tone={blocked.reason === 'daily-limit' ? 'warn' : 'info'} role="status">
              <p>
                <b>{blocked.message}</b> Tracker tetap bisa dipakai penuh.
              </p>
            </Alert>
            <div className="flex flex-wrap gap-2">
              {create('Buat CV')}
              {linkButton}
            </div>
          </Card>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-4">
        {notices}
        <Empty mascot="neutral" title="CV untuk lowongan ini belum dibuat" body="job-kit menyusun CV dari Profile dan requirement lowongan. Tidak ada yang dikarang.">
          {create('Buat CV')}
        </Empty>
        <Alert tone="info" role="note">
          <p>
            <b>Yang dikirim ke penyedia AI:</b> skill, butir pengalaman, jenjang dan jurusan, serta teks lowongan. Nama, email, telepon, alamat, tanggal lahir
            tidak dikirim; nama perusahaan dan kampusmu diganti kode lalu dikembalikan di komputer ini.
          </p>
        </Alert>
      </div>
    )
  }

  const covered = cv.coverage.covered.length
  const required = cv.coverage.required.length
  const parts = cvParts(cv)

  return (
    <div className="flex flex-col gap-4">
      {notices}

      {stale && (
        <Alert tone="warn" role="status">
          <p>
            <b>Profilmu berubah sejak CV ini dibuat.</b> CV lama tetap bisa diunduh.
          </p>
          <div className="mt-2.5">{create('Buat ulang', 'secondary')}</div>
        </Alert>
      )}

      {downloadError !== null && (
        <Alert tone="bad" role="alert">
          <p>{downloadError}</p>
          <div className="mt-2.5">
            <Button variant="secondary" onClick={onCopyText}>Salin teks CV</Button>
          </div>
        </Alert>
      )}
      {downloadNote !== null && (
        <Alert tone="info" role="status">
          <p>{downloadNote}</p>
        </Alert>
      )}

      <Card>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[14px] font-bold text-text-primary">
              Cakupan requirement: {covered} dari {required}
            </span>
            <em className="text-[12px] not-italic text-text-secondary">CV disusun dari Profile, dibuat {formatShortDate(cv.createdAt)}</em>
          </div>
          <div
            role="progressbar"
            aria-label="Cakupan requirement"
            aria-valuemin={0}
            aria-valuemax={required}
            aria-valuenow={covered}
            className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"
          >
            <div className="h-full rounded-full bg-green-700" style={{ width: required === 0 ? '0%' : `${Math.round((covered / required) * 100)}%` }} />
          </div>
        </div>
        <Requirements title="Tertutup" items={cv.coverage.covered} tone="ok" />
        <Requirements title="Belum tertutup" items={cv.coverage.missing} tone="gap" />
        <p className="text-[12px] text-text-secondary">
          Yang belum tertutup tidak pernah ditambal. Kalau kamu memang punya pengalamannya, tambahkan ke Profile dulu, lalu Buat ulang.
        </p>
      </Card>

      {editing ? (
        <Editor draft={parts} profile={profile} onChange={onEdit} />
      ) : profile ? (
        <CvDiff profile={profile} parts={parts} validated={!cv.edited} />
      ) : (
        <Card>
          <p className="text-[13px] text-text-secondary">Profile belum terbaca, jadi perbandingan belum bisa ditampilkan.</p>
        </Card>
      )}

      <p className="text-[12px] text-text-secondary">
        Jabatan, perusahaan, institusi, dan tanggal selalu diambil dari Profile; AI hanya memilih, mengurutkan, dan merapikan kalimat butir pengalaman. Tambahan
        ditandai hijau, bagian yang diganti dicoret abu. Merah tidak dipakai di diff: merah berarti gagal.
      </p>

      {confirming && (
        <Alert tone="warn" role="alert">
          <p>
            <b>CV ini sudah kamu edit.</b> Suntinganmu akan ditimpa oleh CV baru.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setConfirming(false)
                onCreate()
              }}
            >
              Timpa
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Batal</Button>
          </div>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        {blocked && <p className="text-[13px] text-text-secondary">{blocked.message}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onDownload} disabled={downloading}>
            <Download size={15} strokeWidth={2} aria-hidden="true" />
            {downloading ? 'Membuat PDF…' : 'Unduh PDF'}
          </Button>
          <Button variant="secondary" onClick={() => setEditing((on) => !on)}>
            <Pencil size={15} strokeWidth={2} aria-hidden="true" />
            {editing ? 'Selesai' : 'Edit'}
          </Button>
          {create('Buat ulang', 'secondary')}
          {cv.edited && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(false)
                onRestore()
              }}
            >
              <Undo2 size={15} strokeWidth={2} aria-hidden="true" />
              Kembalikan ke versi AI
            </Button>
          )}
          {linkButton}
        </div>
        <p className="text-[12px] text-text-secondary">PDF dibuat di browser ini dan tidak diunggah ke mana pun.</p>
      </div>
    </div>
  )
}
