import { useState } from 'react'
import { aiErrorMessage, AiError, type AiFailure } from '../../core/ai/errors'
import { aiOrigins } from '../../core/ai/origins'
import {
  AI_PROVIDERS,
  MAX_DOCUMENT_LIMIT,
  normalizeDocumentLimit,
  setAiProvider,
  zenMayTrainOn,
  type AiProvider,
  type FeedSettings,
} from '../../core/feed/settings'
import { createAiClient } from '../../platform/ai-client'
import { requestOrigins } from '../../platform/permissions'
import { Button } from '../../ui/primitives/Button'
import { Select } from '../../ui/primitives/Select'
import { TextField } from '../../ui/primitives/TextField'
import { SectionCard } from './SectionCard'
import { Alert, type Notice } from './SettingsNotice'

// The own-key build only (`npm run dev:byok`): the person picks a provider and pastes a key. In the server build this file is not
// part of the bundle at all, which is what keeps the provider addresses out of it (src/core/build.test.ts).

const PROVIDER_TEXT: Record<AiProvider, { name: string; keyHint: string }> = {
  anthropic: { name: 'Anthropic', keyHint: 'sk-ant-…' },
  gemini: { name: 'Google Gemini', keyHint: 'Kunci dari aistudio.google.com' },
  'opencode-zen': { name: 'OpenCode Zen', keyHint: 'Kunci dari opencode.ai/zen' },
  'claude-code': { name: 'Claude Code (lokal)', keyHint: 'Token yang dicetak node scripts/bridge.mjs' },
}

export function ByokAiCard({
  settings,
  aiKey,
  update,
  changeKey,
}: {
  settings: FeedSettings
  aiKey: string
  update: (next: FeedSettings) => void
  changeKey: (key: string) => void
}) {
  const [test, setTest] = useState<Notice | 'running' | null>(null)

  const runTest = () => {
    void requestOrigins(aiOrigins(settings.ai.provider)).then(async (ok) => {
      if (!ok) return setTest({ kind: 'bad', text: aiErrorMessage('no-permission') })
      setTest('running')
      try {
        await createAiClient(settings.ai.provider).complete({ key: aiKey, model: settings.ai.model, system: '', user: 'Balas satu kata: ok', maxTokens: 128 })
        setTest({ kind: 'ok', text: 'Tersambung. Model menjawab dengan benar.' })
      } catch (error) {
        const reason: AiFailure = error instanceof AiError ? error.reason : 'network'
        setTest({ kind: 'bad', text: aiErrorMessage(reason) })
      }
    })
  }

  return (
    <SectionCard>
      <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">Penilaian AI</h2>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Penyedia"
            value={settings.ai.provider}
            onChange={(event) => {
              // A key belongs to one provider; keeping it would send it to the other one.
              update(setAiProvider(settings, event.target.value as AiProvider))
              changeKey('')
              setTest(null)
            }}
          >
            {AI_PROVIDERS.map((id) => (
              <option key={id} value={id}>
                {PROVIDER_TEXT[id].name}
              </option>
            ))}
          </Select>
          <TextField label="Model penilaian lowongan" value={settings.ai.model} onChange={(event) => update({ ...settings, ai: { ...settings.ai, model: event.target.value } })} />
          <TextField
            label="Model CV dan surat"
            placeholder={settings.ai.model}
            value={settings.ai.documentModel ?? ''}
            onChange={(event) => update({ ...settings, ai: { ...settings.ai, documentModel: event.target.value } })}
          />
        </div>
        <div className="max-w-[260px]">
          <DocumentLimitField value={settings.documentLimit} onChange={(documentLimit) => update({ ...settings, documentLimit })} />
        </div>
        <div>
          <TextField
            label="Kunci API"
            type="password"
            autoComplete="off"
            placeholder={PROVIDER_TEXT[settings.ai.provider].keyHint}
            value={aiKey}
            onChange={(event) => {
              changeKey(event.target.value)
              setTest(null)
            }}
          />
          <p className="mt-1.5 text-[12px] text-text-secondary">Disimpan di perangkat ini. Tidak ikut Export; terhapus oleh Hapus semua.</p>
        </div>
        <div>
          <Button variant="secondary" disabled={aiKey.trim() === '' || test === 'running'} onClick={runTest}>
            {test === 'running' ? 'Menguji…' : 'Tes koneksi'}
          </Button>
        </div>
        {test && test !== 'running' && <Alert notice={test} />}
        {settings.ai.provider === 'gemini' && (
          <Alert notice={{ kind: 'warn', text: 'Di paket gratis, Google boleh memakai isi permintaan untuk memperbaiki produknya. Yang dikirim hanya data tanpa identitas, seperti dijelaskan di bawah.' }} />
        )}
        {settings.ai.provider === 'claude-code' && (
          <Alert
            notice={{
              kind: 'warn',
              text: 'Jalankan "node scripts/bridge.mjs" di terminal proyek ini dan biarkan terbuka, lalu tempel token yang tercetak ke Kunci API. Model: haiku, sonnet, atau opus. Hanya untuk dipakai sendiri di komputer ini.',
            }}
          />
        )}
        {settings.ai.provider === 'opencode-zen' && zenMayTrainOn(settings.ai.model) && (
          <Alert
            notice={{
              kind: 'warn',
              text: 'Model ini boleh dipakai OpenCode Zen untuk melatih model selama masa gratis. Untuk data pribadi, pilih space-bunny-free, longcat-2.5-preview-free, atau step-5-preview-free.',
            }}
          />
        )}
        <div role="note" className="rounded-lg bg-accent-wash px-3 py-2.5 text-[13px] text-text-primary">
          <p>
            <b>Yang dikirim ke penyedia AI:</b> role incaran, level, skill, judul dan lama pengalaman, jenjang pendidikan, preferensi lokasi dan tipe
            kerja. Nama, email, telepon, alamat, dan tanggal lahir tidak dikirim.
          </p>
          <p className="mt-1.5">
            <b>Untuk CV:</b> skill, butir deskripsi tiap pengalaman, judul jabatan, jenjang dan jurusan, serta teks lowongan. Nama perusahaan dan kampus
            diganti kode lalu dipulihkan di browser ini; nama, kontak, tautan, dan IPK tidak dikirim.
          </p>
        </div>
      </div>
    </SectionCard>
  )
}

// Typed freely, kept only when it is a whole number in range; the box shows the saved value again when it loses focus.
function DocumentLimitField({ value, onChange }: { value: number; onChange: (limit: number) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <div>
      <TextField
        label="Batas CV dan surat per hari"
        inputMode="numeric"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          const next = Number(event.target.value)
          if (event.target.value.trim() !== '' && normalizeDocumentLimit(next) === next) onChange(next)
        }}
        onBlur={() => setText(String(value))}
      />
      <p className="mt-1.5 text-[12px] text-text-secondary">1 sampai {MAX_DOCUMENT_LIMIT}. Tiap CV atau surat memakai 1 panggilan AI, terpisah dari penilaian lowongan. Kembali tengah malam.</p>
    </div>
  )
}
