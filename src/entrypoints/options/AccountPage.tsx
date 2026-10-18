import { useCallback, useEffect, useState } from 'react'
import { canConfirmDelete, DELETE_WORD } from '../../core/data/state'
import type { ApiFailure } from '../../core/sync/api'
import { failureText, summarizeSync, unlockText, type SyncSummary } from '../../core/sync/messages'
import type { Outcome } from '../../core/sync/engine'
import type { Kind } from '../../core/sync/merge'
import { Button } from '../../ui/primitives/Button'
import { TextField } from '../../ui/primitives/TextField'

export type AccountInfo = { configured: boolean; email: string | null; unlocked: boolean; lastSyncAt: string | null }
export type SyncReport = { outcomes: Partial<Record<Kind, Outcome>>; error?: ApiFailure | 'locked' | 'unavailable' | 'signed-out' }

// Everything the page does goes through this, so tests (and a preview) can stand in for the real thing.
export type AccountApi = {
  load: () => Promise<AccountInfo>
  allow: () => Promise<boolean>
  startLogin: (email: string) => Promise<{ ok: true } | { ok: false; reason: ApiFailure }>
  finishLogin: (email: string, code: string) => Promise<{ ok: true } | { ok: false; reason: ApiFailure }>
  unlock: (password: string) => Promise<{ ok: true; created: boolean } | { ok: false; reason: 'signed-out' | 'wrong-password' | 'failed' }>
  sync: (options?: { confirmOverwrite?: boolean }) => Promise<SyncReport>
  lock: () => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<{ ok: true } | { ok: false; reason: ApiFailure }>
  telemetry: TelemetryApi
}

export type TelemetryApi = {
  available: () => boolean
  isOn: () => Promise<boolean>
  enable: () => Promise<boolean>
  disable: () => Promise<void>
  pending: () => Promise<string[]>
}

const card = 'flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-md'
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('id-ID') : 'belum pernah')

const reportText = (report: SyncReport): { summary: SyncSummary | null; error: string | null } => {
  if (report.error === 'locked') return { summary: null, error: 'Sinkron terkunci. Masukkan kata sandi sinkron dulu.' }
  if (report.error === 'unavailable') return { summary: null, error: 'Sinkron belum tersedia di versi ini.' }
  if (report.error) return { summary: null, error: failureText(report.error === 'signed-out' ? 'signed-out' : report.error) }
  return { summary: summarizeSync(report.outcomes), error: null }
}

function TelemetryCard({ api }: { api: TelemetryApi }) {
  const [on, setOn] = useState<boolean | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    const enabled = await api.isOn()
    setOn(enabled)
    setLines(enabled ? await api.pending() : [])
  }, [api])
  useEffect(() => void load(), [load])
  if (!api.available() || on === null) return null
  return (
    <section className={card}>
      <h2 className="text-[15px] font-bold text-text-primary">Bantu perbaiki job-kit</h2>
      <p className="text-[13px] text-text-secondary">
        <b>Opsional, mati secara bawaan.</b> Bila kamu nyalakan, job-kit mengirim hitungan anonim: berapa kali Fill dipakai, lamaran ditambah, CV atau surat dibuat, lowongan diambil, sinkron jalan, atau ada error, per hari dan per versi. Tidak ada isi profil, CV, lowongan, URL, email, atau pesan error, dan tidak ada ID pengguna atau perangkat.
      </p>
      {on ? (
        <>
          <p className="text-[13px] text-text-primary"><b>Menyala.</b> Yang akan dikirim berikutnya (hari yang sudah selesai dikirim sehari sekali):</p>
          {lines.length === 0 ? <p className="text-[13px] text-text-secondary">Belum ada hitungan.</p> : <ul className="list-disc pl-5 text-[13px] text-text-secondary">{lines.map((line) => <li key={line}>{line}</li>)}</ul>}
          <div><Button variant="secondary" onClick={() => void api.disable().then(load)}>Matikan dan hapus hitungan</Button></div>
        </>
      ) : (
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setMessage(null)
              void api.enable().then(async (ok) => {
                if (!ok) setMessage('Izin ke server belum diberikan, jadi telemetri tetap mati.')
                await load()
              })
            }}
          >
            Nyalakan telemetri
          </Button>
        </div>
      )}
      {message && <p role="status" className="text-[13px] text-amber-700">{message}</p>}
    </section>
  )
}

export function AccountPage({ api, onExport }: { api: AccountApi; onExport: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <AccountMain api={api} onExport={onExport} />
      <TelemetryCard api={api.telemetry} />
    </div>
  )
}

function AccountMain({ api, onExport }: { api: AccountApi; onExport: () => void }) {
  const [info, setInfo] = useState<AccountInfo | null>(null)
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')

  const refresh = useCallback(async () => setInfo(await api.load()), [api])
  useEffect(() => void refresh(), [refresh])

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setMessage(null)
    try {
      await work()
    } finally {
      setBusy(false)
    }
  }

  const sendCode = () =>
    run(async () => {
      // The server host is asked for here, inside the click, before anything is sent.
      if (!(await api.allow())) return setMessage('Izin ke server sinkron belum diberikan, jadi tidak ada yang dikirim.')
      const result = await api.startLogin(email)
      if (!result.ok) return setMessage(failureText(result.reason))
      setStep('code')
      setMessage('Kode sudah dikirim ke emailmu. Cek juga folder spam.')
    })

  const login = () =>
    run(async () => {
      const result = await api.finishLogin(email, code)
      if (!result.ok) return setMessage(failureText(result.reason))
      setCode('')
      await refresh()
    })

  const doSync = (confirmOverwrite = false) =>
    run(async () => {
      const { summary: next, error } = reportText(await api.sync(confirmOverwrite ? { confirmOverwrite: true } : {}))
      setSummary(next)
      setMessage(error)
      await refresh()
    })

  const open = () =>
    run(async () => {
      const result = await api.unlock(password)
      if (!result.ok) return setMessage(unlockText(result.reason))
      setPassword('')
      setUnderstood(false)
      await refresh()
      await doSync()
    })

  const remove = () =>
    run(async () => {
      const result = await api.deleteAccount()
      if (!result.ok) return setMessage(failureText(result.reason))
      setDeleting(false)
      setTyped('')
      setSummary(null)
      setMessage('Akun dihapus. Semua data online ikut terhapus. Data di browser ini tetap ada.')
      await refresh()
    })

  if (info === null) return null

  const notice = message && <p role="status" className="text-[13px] text-amber-700">{message}</p>

  if (!info.configured) {
    return (
      <section className={card}>
        <h2 className="text-[15px] font-bold text-text-primary">Akun dan sinkron</h2>
        <p className="text-[13px] text-text-secondary">Sinkron belum tersedia di versi ini. Datamu tetap tersimpan di browser ini, dan kamu bisa mencadangkannya lewat halaman Data.</p>
      </section>
    )
  }

  if (info.email === null) {
    return (
      <section className={card}>
        <h2 className="text-[15px] font-bold text-text-primary">Akun dan sinkron</h2>
        <p className="text-[13px] text-text-secondary">
          <b>Opsional.</b> Tanpa akun, semuanya tetap bekerja dan tersimpan di browser ini. Dengan akun, profil, lamaran, CV, dan surat dienkripsi di browser ini dengan kata sandi sinkron milikmu, lalu disimpan online sebagai ciphertext. Server tidak bisa membacanya.
        </p>
        <p className="text-[13px] text-text-secondary">
          <b>Kata sandi sinkron tidak bisa dipulihkan.</b> Bila lupa, data online hilang (data di browser tetap ada). Kunci API dan daftar lowongan tidak ikut disinkronkan.
        </p>
        {step === 'email' ? (
          <div className="flex max-w-[360px] flex-col gap-3">
            <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button disabled={busy || !/^\S+@\S+\.\S+$/.test(email)} onClick={() => void sendCode()}>Kirim kode</Button>
          </div>
        ) : (
          <div className="flex max-w-[360px] flex-col gap-3">
            <TextField label="Kode dari email" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            <div className="flex gap-2">
              <Button disabled={busy || code.trim().length < 6} onClick={() => void login()}>Masuk</Button>
              <Button variant="secondary" onClick={() => { setStep('email'); setMessage(null) }}>Ganti email</Button>
            </div>
          </div>
        )}
        {notice}
      </section>
    )
  }

  if (!info.unlocked) {
    return (
      <section className={card}>
        <h2 className="text-[15px] font-bold text-text-primary">Akun dan sinkron</h2>
        <p className="text-[13px] text-text-secondary">Masuk sebagai <b>{info.email}</b>. Masukkan kata sandi sinkron untuk membuka dan mengenkripsi datamu. Pertama kali: pilih kata sandi baru. Di perangkat lain: pakai yang sama.</p>
        <div className="flex max-w-[360px] flex-col gap-3">
          <TextField label="Kata sandi sinkron" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="flex items-start gap-2 text-[13px] text-text-secondary">
            <input type="checkbox" className="mt-0.5 h-[16px] w-[16px] accent-accent" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
            Saya paham kata sandi ini tidak bisa dipulihkan. Bila lupa, data online hilang.
          </label>
          <div className="flex gap-2">
            <Button disabled={busy || password.length < 8 || !understood} onClick={() => void open()}>Buka sinkron</Button>
            <Button variant="secondary" onClick={() => void run(async () => { await api.signOut(); await refresh() })}>Keluar dari perangkat ini</Button>
          </div>
          {password.length > 0 && password.length < 8 && <p className="text-[12px] text-text-secondary">Minimal 8 karakter.</p>}
        </div>
        {notice}
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <h2 className="text-[15px] font-bold text-text-primary">Akun dan sinkron</h2>
        <p className="text-[13px] text-text-secondary">Masuk sebagai <b>{info.email}</b>. Sinkron terakhir: {when(info.lastSyncAt)}.</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void doSync()}>Sinkronkan sekarang</Button>
          <Button variant="secondary" onClick={() => void run(async () => { await api.lock(); setSummary(null); await refresh() })}>Kunci</Button>
          <Button variant="secondary" onClick={() => void run(async () => { await api.signOut(); setSummary(null); await refresh() })}>Keluar dari perangkat ini</Button>
        </div>
        {summary?.text && <p role="status" className="text-[13px] text-text-primary">{summary.text}</p>}
        {summary && summary.needsConfirm.length > 0 && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
            <p>Data online untuk {summary.needsConfirm.join(', ')} akan menimpa data di perangkat ini. Perubahan yang belum terkirim dari perangkat ini hilang.</p>
            <div className="flex gap-2">
              <Button variant="danger" disabled={busy} onClick={() => void doSync(true)}>Timpa</Button>
              <Button variant="secondary" onClick={() => setSummary(null)}>Batal</Button>
            </div>
          </div>
        )}
        {summary?.problems.map((problem) => <p key={problem} role="status" className="text-[13px] text-amber-700">{problem}</p>)}
        {notice}
        <p className="text-[12px] text-text-secondary">Kata sandi sinkron tidak disimpan. Menutup browser mengunci sinkron lagi.</p>
      </section>

      <section className={card}>
        <h2 className="text-[15px] font-bold text-text-primary">Datamu</h2>
        <p className="text-[13px] text-text-secondary">Export menyimpan semua data ke satu berkas di komputermu.</p>
        <div><Button variant="secondary" onClick={onExport}>Ke halaman Data</Button></div>
        {!deleting ? (
          <div><Button variant="danger" onClick={() => setDeleting(true)}>Hapus akun</Button></div>
        ) : (
          <div className="flex max-w-[420px] flex-col gap-3">
            <p className="text-[13px] text-text-secondary">Akun dan semua data online dihapus dari server dan tidak bisa dipulihkan. <b>Data di browser ini tidak ikut terhapus.</b></p>
            <TextField label={`Ketik ${DELETE_WORD} untuk melanjutkan`} value={typed} onChange={(e) => setTyped(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="danger" disabled={busy || !canConfirmDelete(typed)} onClick={() => void remove()}>Hapus akun dan data online</Button>
              <Button variant="secondary" onClick={() => { setDeleting(false); setTyped('') }}>Batal</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
