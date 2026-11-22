import { useEffect, useState } from 'react'
import { aiErrorMessage } from '../../core/ai/errors'
import { AI_MODE, THREAD_ENABLED } from '../../core/build'
import {
  ATS_SOURCES,
  canEnableFeed,
  isValidTime,
  originsForSource,
  setCompanies,
  setSourceEnabled,
  type AtsSource,
  type FeedSettings,
} from '../../core/feed/settings'
import type { FeedState } from '../../core/feed/schedule'
import type { JobSourceId, SourceRun } from '../../core/feed/types'
import { clearRunsFor } from '../../core/feed/pipeline'
import { requestRefresh } from '../../platform/feed-control'
import { loadRuns, saveRuns } from '../../platform/feed-storage'
import type { Profile } from '../../core/profile/types'
import { hasOrigins, requestOrigins } from '../../platform/permissions'
import { Button } from '../../ui/primitives/Button'
import { TextField } from '../../ui/primitives/TextField'
import { ByokAiCard } from './ByokAiCard'
import { ChipListField } from './ChipListField'
import { SectionCard } from './SectionCard'
import { Alert, type Notice } from './SettingsNotice'

const SOURCES: { id: JobSourceId; name: string; about: string }[] = [
  { id: 'greenhouse', name: 'Greenhouse', about: 'Papan lowongan perusahaan pilihanmu' },
  { id: 'lever', name: 'Lever', about: 'Papan lowongan perusahaan pilihanmu' },
  { id: 'ashby', name: 'Ashby', about: 'Papan lowongan perusahaan pilihanmu' },
  { id: 'remotive', name: 'Remotive', about: 'Papan lowongan remote' },
  { id: 'linkedin', name: 'LinkedIn', about: 'Halaman pencarian publik, tanpa login' },
  { id: 'yc', name: 'Y Combinator', about: 'Lowongan remote startup YC, tanpa login. Yang wajib warga atau visa AS dibuang' },
  { id: 'wellfound', name: 'Wellfound', about: 'Eksperimen: situsnya bisa menolak kapan saja, lalu sumber ini berhenti sendiri setelah tiga kali gagal' },
  { id: 'jobstreet', name: 'JobStreet', about: 'Pencarian Indonesia, tanpa login. Singapura ikut dicari kalau Singapore ada di lokasi Preferensi kerja' },
  { id: 'mycareersfuture', name: 'MyCareersFuture', about: 'Papan lowongan pemerintah Singapura, tanpa login. Hampir semua kerja di kantor Singapura: tambahkan Singapore di lokasi Preferensi kerja' },
  ...(THREAD_ENABLED
    ? [{ id: 'thread' as const, name: 'Threads', about: 'Pencarian "loker", "lowongan kerja" dan "hiring" (Terbaru) dari akun cadangan yang sudah login di browser ini. Melanggar aturan Meta: jangan pakai akun utama' }]
    : []),
]

export function JobSettingsPage({
  profile,
  settings,
  aiKey,
  update,
  changeKey,
  goPreferences,
  runs,
  state,
}: {
  profile: Profile | null
  settings: FeedSettings
  aiKey: string
  update: (next: FeedSettings) => void
  changeKey: (key: string) => void
  goPreferences: () => void
  runs: SourceRun[]
  state: FeedState
}) {
  const [granted, setGranted] = useState<Partial<Record<JobSourceId, boolean>>>({})
  const [notice, setNotice] = useState<Notice | null>(null)
  const ready = profile ? canEnableFeed(profile.jobPrefs) : false

  useEffect(() => {
    void Promise.all(SOURCES.map(async ({ id }) => [id, await hasOrigins(originsForSource(id))] as const)).then((pairs) =>
      setGranted(Object.fromEntries(pairs)),
    )
  }, [])

  // The permission request has to start inside the click, so nothing is awaited before it.
  const toggle = (id: JobSourceId, name: string, on: boolean) => {
    if (!on) {
      update(setSourceEnabled(settings, id, false))
      setNotice(null)
      return
    }
    if (!ready) {
      setNotice({ kind: 'warn', text: 'Isi Preferensi kerja dulu (minimal satu role incaran), baru sumber bisa dinyalakan.' })
      return
    }
    void requestOrigins(originsForSource(id)).then((ok) => {
      setGranted((current) => ({ ...current, [id]: ok }))
      if (ok) {
        void loadRuns().then((all) => saveRuns(clearRunsFor(all, id)))
        update(setSourceEnabled(settings, id, true))
        setNotice(null)
      } else {
        setNotice({ kind: 'warn', text: `Izin untuk ${name} belum diberikan, jadi sumber ini tetap mati.` })
      }
    })
  }

  const regrant = (id: JobSourceId) => {
    void requestOrigins(originsForSource(id)).then((ok) => setGranted((current) => ({ ...current, [id]: ok })))
  }

  return (
    <div className="flex flex-col gap-4">
      {!ready && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
          <p className="font-semibold">Preferensi kerja masih kosong, jadi lowongan belum bisa dinyalakan.</p>
          <Button variant="secondary" onClick={goPreferences}>
            Isi Preferensi kerja
          </Button>
        </div>
      )}

      <RunStatus runs={runs} state={state} enabled={SOURCES.some(({ id }) => settings.sources[id])} />

      <SectionCard>
        <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">Sumber</h2>
        <ul className="divide-y divide-border">
          {SOURCES.map(({ id, name, about }) => {
            const on = settings.sources[id]
            const missing = on && granted[id] === false
            return (
              <li key={id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(event) => toggle(id, name, event.target.checked)}
                    className="h-[18px] w-[18px] shrink-0 accent-accent"
                  />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-text-primary">{name}</span>
                    <span className="block text-[13px] text-text-secondary">{about}</span>
                  </span>
                </label>
                <span
                  className={
                    'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ' +
                    (missing ? 'bg-amber-50 text-amber-700' : on ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-text-secondary')
                  }
                >
                  {missing ? 'Izin dibutuhkan' : on ? 'Aktif' : 'Mati'}
                </span>
                {missing && (
                  <Button variant="secondary" onClick={() => regrant(id)}>
                    Beri izin
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        {notice && (
          <div className="mt-4">
            <Alert notice={notice} />
          </div>
        )}
      </SectionCard>

      {ATS_SOURCES.filter((id) => settings.sources[id]).length > 0 && (
        <SectionCard>
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">Perusahaan untuk sumber ATS</h2>
          <div className="flex flex-col gap-4">
            {ATS_SOURCES.filter((id) => settings.sources[id]).map((id: AtsSource) => (
              <ChipListField
                key={id}
                label={SOURCES.find((s) => s.id === id)?.name ?? id}
                placeholder="contohkarya"
                hint="Nama papan di alamat lowongan perusahaan itu."
                items={settings.companies[id]}
                onChange={(names) => update(setCompanies(settings, id, names))}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">Jadwal</h2>
        <div className="max-w-[220px]">
          <TextField
            label="Jam ambil harian"
            type="time"
            value={settings.fetchTime}
            onChange={(event) => isValidTime(event.target.value) && update({ ...settings, fetchTime: event.target.value })}
          />
          <p className="mt-1.5 text-[12px] text-text-secondary">Bila Chrome tertutup, pengambilan jalan saat Chrome dibuka berikutnya.</p>
        </div>
      </SectionCard>

      {AI_MODE === 'byok' ? (
        <ByokAiCard settings={settings} aiKey={aiKey} update={update} changeKey={changeKey} />
      ) : AI_MODE === 'server' ? (
        // The server holds the provider, the model and the key: nothing here to set (spec §5.4).
        <SectionCard>
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">Penilaian AI</h2>
          <p className="text-[13px] text-text-secondary">
            Lowongan harian dinilai dengan aturan (skor kasar) dan tidak memakai kredit. Untuk nilai dari AI, tekan Nilai dengan AI di halaman Lowongan:
            1 kredit untuk 10 lowongan teratas yang belum dinilai AI.
          </p>
        </SectionCard>
      ) : (
        <SectionCard>
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">Penilaian AI</h2>
          <p className="text-[13px] text-text-secondary">Belum tersedia di versi ini. Lowongan dinilai dengan aturan (skor kasar), dan CV serta surat lamaran belum bisa dibuat.</p>
        </SectionCard>
      )}
    </div>
  )
}

const STAGE_TEXT = { idle: '', fetch: 'Mengambil lowongan…', merge: 'Menggabungkan dan menyaring…', score: 'Menilai lowongan…', save: 'Menyimpan…' } as const
const REASON_TEXT: Record<string, string> = { blocked: 'diblokir sementara', timeout: 'terlalu lama menjawab', parse: 'struktur halaman berubah', network: 'tidak terhubung' }

const reasonText = (reason?: string) => (reason?.startsWith('http-') ? `server membalas ${reason.slice(5)}` : (REASON_TEXT[reason ?? ''] ?? 'gagal'))

// The last run's result in detail; the Lowongan page header only shows the summary.
function RunStatus({ runs, state, enabled }: { runs: SourceRun[]; state: FeedState; enabled: boolean }) {
  const [answer, setAnswer] = useState('')
  const latest = SOURCES.map(({ id, name }) => ({ name, run: runs.filter((run) => run.source === id).sort((a, b) => b.at.localeCompare(a.at))[0] })).filter((row) => row.run)
  const refresh = () => {
    setAnswer('')
    void requestRefresh().then((status) => setAnswer(status === 'busy' ? 'Masih ada pengambilan yang berjalan.' : status === 'no-prefs' ? 'Isi role incaran di Preferensi kerja dulu.' : status === 'signed-out' ? 'Masuk dulu untuk mengambil lowongan.' : ''))
  }
  return (
    <SectionCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">Pengambilan terakhir</h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            {state.running ? STAGE_TEXT[state.stage] : state.lastRunAt ? `Selesai ${new Date(state.lastRunAt).toLocaleString('id-ID')} · ${state.newJobs} baru` : 'Belum pernah jalan.'}
          </p>
        </div>
        <Button variant="secondary" disabled={state.running || !enabled} onClick={refresh}>
          {state.running ? 'Sedang mengambil…' : 'Segarkan'}
        </Button>
      </div>
      {answer && <p className="mt-2 text-[13px] text-amber-700">{answer}</p>}
      {latest.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-[13px]">
          {latest.map(({ name, run }) => (
            <li key={name} className={run?.ok ? 'text-text-secondary' : 'text-rose-700'}>
              {name}: {run?.ok ? `${run.count} lowongan` : `${reasonText(run?.reason)}`}
            </li>
          ))}
        </ul>
      )}
      {state.paused.length > 0 && <p className="mt-2 text-[13px] text-amber-700">Dijeda setelah 3 kali gagal berturut-turut: {state.paused.join(', ')}. Matikan lalu nyalakan lagi untuk memulai ulang.</p>}
      {state.aiProblem && <p className="mt-2 text-[13px] text-amber-700">Skor kasar: {aiErrorMessage(state.aiProblem)}</p>}
      {state.usage.inputTokens > 0 && <p className="mt-2 text-[12px] text-text-secondary">Token run terakhir: {state.usage.inputTokens} masuk, {state.usage.outputTokens} keluar.</p>}
    </SectionCard>
  )
}
