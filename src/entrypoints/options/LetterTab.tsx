import { Copy, FileText, RefreshCw, ShieldCheck, Sparkles, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { wordCount } from '../../core/letters/edit'
import { LANG_LABEL, TONE_LABEL, TONES, type Lang, type Tone } from '../../core/letters/language'
import type { LetterView } from '../../core/letters/view'
import { overwritesEdits } from '../../core/tailor/edit'
import { Button } from '../../ui/primitives/Button'
import { FilterChip } from '../../ui/primitives/FilterChip'
import { TextArea } from '../../ui/primitives/TextArea'
import type { CvLink } from './CvTab'
import { Alert, Card } from './DocParts'
import { Empty } from './EmptyState'

// What the tab needs from the page: what to show (LetterView) and what the buttons do.
export type LetterTabState = LetterView & {
  onCreate: () => void
  // "Lanjut" on the data notice: acknowledge it and write the letter.
  onContinue: () => void
  onDismissNotice: () => void
  onLink: (link: CvLink) => void
  // A hand edit. The page saves it after a short pause and marks the letter edited.
  onEdit: (body: string) => void
  onRestore: () => void
  onCopy: () => void
  onLang: (lang: Lang) => void
  onTone: (tone: Tone) => void
}

const LINK_LABEL: Record<CvLink, string> = { settings: 'Buka Atur Lowongan', profile: 'Ke Profile', description: 'Tempel teks lowongan' }
const LANGS: Lang[] = ['id', 'en']

function Choices({ state, hint }: { state: Pick<LetterTabState, 'lang' | 'tone' | 'langAuto' | 'onLang' | 'onTone'>; hint: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="Bahasa" className="flex gap-2">
        {LANGS.map((lang) => (
          <FilterChip key={lang} selected={state.lang === lang} onClick={() => state.onLang(lang)}>{LANG_LABEL[lang]}</FilterChip>
        ))}
      </div>
      <div role="group" aria-label="Nada" className="flex gap-2">
        {TONES.map((tone) => (
          <FilterChip key={tone} selected={state.tone === tone} onClick={() => state.onTone(tone)}>{TONE_LABEL[tone]}</FilterChip>
        ))}
      </div>
      {hint && <span className="text-[12px] text-text-secondary">{hint}</span>}
    </div>
  )
}

// The letter itself: an editor that keeps its own text so typing never waits for a save (FR-43).
function Editor({ body, aiBody, edited, onChange, onRestore }: { body: string; aiBody: string; edited: boolean; onChange: (body: string) => void; onRestore: () => void }) {
  const [text, setText] = useState(body)
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-text-secondary">Surat lamaran</span>
        {edited ? (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Diedit</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
            <ShieldCheck size={12} strokeWidth={2.25} aria-hidden="true" />
            Tervalidasi
          </span>
        )}
      </div>
      <TextArea
        label="Isi surat"
        rows={16}
        className="min-h-[300px] leading-[1.65]"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          onChange(event.target.value)
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-text-secondary">
        <span>{wordCount(text)} kata · Nama di penutup diisi dari Profile di komputer ini, tidak dikirim ke AI.</span>
        {edited && (
          <Button
            variant="secondary"
            onClick={() => {
              setText(aiBody)
              onRestore()
            }}
          >
            <Undo2 size={15} strokeWidth={2} aria-hidden="true" />
            Kembalikan ke versi AI
          </Button>
        )}
      </div>
    </>
  )
}

export function LetterTab(tab: LetterTabState) {
  const { letter, availability, busy, message, rejected, notice, stale, lang, tone, langAuto, copyNote, onCreate, onContinue, onDismissNotice, onLink, onEdit, onRestore, onCopy } = tab
  const [confirming, setConfirming] = useState(false)
  const blocked = availability !== null && !availability.ok ? availability : null
  const off = busy || availability === null || blocked !== null

  // Buat ulang on a letter the person edited would throw the edits away, so it asks first (FR-45).
  const regenerate = () => (overwritesEdits(letter) ? setConfirming(true) : onCreate())
  const create = (label: string, variant: 'primary' | 'secondary' = 'primary') => (
    <Button variant={variant} onClick={regenerate} disabled={off}>
      {variant === 'primary' ? <Sparkles size={15} strokeWidth={2} aria-hidden="true" /> : <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />}
      {busy ? (letter ? 'Membuat…' : 'Sedang membuat…') : label}
    </Button>
  )
  const linkButton = blocked && <Button variant="secondary" onClick={() => onLink(blocked.link)}>{LINK_LABEL[blocked.link]}</Button>
  const pending = letter !== null && (lang !== letter.lang || tone !== letter.tone)
  const hint = pending ? 'Dipakai saat Buat ulang.' : letter === null && langAuto ? 'Bahasa dipilih dari teks lowongan.' : null

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
            {rejected && <b>Surat tidak ditampilkan. </b>}
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

  if (letter === null) {
    // A refusal with no earlier letter: the alert and "Coba lagi" are the whole tab, as for the CV.
    if (rejected && message !== null && !busy) return <div className="flex flex-col gap-4">{notices}</div>
    if (blocked?.reason === 'no-experience') {
      return (
        <div className="flex flex-col gap-4">
          {notices}
          <Empty icon={<FileText size={18} strokeWidth={2} />} title="Isi Work Experience dulu" body="Surat disusun dari pengalaman di Profile. Belum ada yang bisa dipakai.">
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
              {create('Buat surat')}
            </div>
            <p className="text-[12px] text-text-secondary">Membaca lowongan → menulis surat → memeriksa semua fakta terhadap Profile.</p>
          </Card>
        </div>
      )
    }
    const sent = (
      <Alert tone="info" role="note">
        <p>
          <b>Yang dikirim ke penyedia AI:</b> skill, butir pengalaman, jenjang dan jurusan, serta teks lowongan. Nama, email, telepon, alamat, tanggal lahir
          tidak dikirim; nama perusahaan dan kampusmu diganti kode lalu dikembalikan di komputer ini. Nama di penutup surat diisi di komputer ini.
        </p>
      </Alert>
    )
    if (blocked) {
      return (
        <div className="flex flex-col gap-4">
          {notices}
          <Card title="Surat untuk lowongan ini belum dibuat">
            <Alert tone={blocked.reason === 'daily-limit' ? 'warn' : 'info'} role="status">
              <p>
                <b>{blocked.message}</b> Tracker tetap bisa dipakai penuh.
              </p>
            </Alert>
            <Choices state={tab} hint={hint} />
            <div className="flex flex-wrap gap-2">
              {create('Buat surat')}
              {linkButton}
            </div>
          </Card>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-4">
        {notices}
        <Empty mascot="neutral" title="Surat untuk lowongan ini belum dibuat" body="job-kit menulis surat dari Profile dan teks lowongan, dalam bahasa lowongan. Tidak ada yang dikarang.">
          <Choices state={tab} hint={hint} />
          {create('Buat surat')}
        </Empty>
        {sent}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {notices}

      {stale && (
        <Alert tone="warn" role="status">
          <p>
            <b>Profilmu berubah sejak surat ini dibuat.</b> Surat lama tetap bisa disalin.
          </p>
          <div className="mt-2.5">{create('Buat ulang', 'secondary')}</div>
        </Alert>
      )}

      <Card>
        <Choices state={tab} hint={hint} />
        {/* Keyed by the letter, so a new letter replaces the text and an edit never fights the box. */}
        <Editor key={letter.id} body={letter.body} aiBody={letter.aiBody} edited={letter.edited} onChange={onEdit} onRestore={onRestore} />
      </Card>

      {confirming && (
        <Alert tone="warn" role="alert">
          <p>
            <b>Surat ini sudah kamu edit.</b> Suntinganmu akan ditimpa oleh surat baru.
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
          <Button variant="secondary" onClick={onCopy}>
            <Copy size={15} strokeWidth={2} aria-hidden="true" />
            Salin
          </Button>
          {create('Buat ulang', 'secondary')}
          {linkButton}
        </div>
        {copyNote !== null && <p role="status" className="text-[12px] text-text-secondary">{copyNote}</p>}
      </div>

      <Alert tone="info" role="note">
        <p>
          Saat Buka &amp; isi, surat ini mengisi field <b>Cover letter</b> / <b>Surat lamaran</b> di form bila ada, dan muncul sebagai satu baris di panel yang bisa
          dimatikan. Field unggah file tidak disentuh.
        </p>
      </Alert>
    </div>
  )
}
