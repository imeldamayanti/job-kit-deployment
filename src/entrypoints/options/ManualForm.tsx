import { useState, type FormEvent } from 'react'
import { validateManual, type ManualErrors, type ManualInput } from '../../core/applications/applications'
import { Button } from '../../ui/primitives/Button'
import { Select } from '../../ui/primitives/Select'
import { TextArea } from '../../ui/primitives/TextArea'
import { TextField } from '../../ui/primitives/TextField'

export type AddResult = { ok: true; id: string } | { ok: false; reason: 'storage-full' }

const EMPTY: ManualInput = { title: '', company: '', url: '', description: '', status: 'draft' }

function FieldError({ text }: { text?: string }) {
  return text ? (
    <p role="alert" className="-mt-1 text-[12px] font-semibold text-rose-700">
      {text}
    </p>
  ) : null
}

// Add an application for a job the feed did not recommend. A title and a company are enough;
// the link can be filled in later from Detail Lamaran.
export function ManualForm({ onSubmit, onCancel }: { onSubmit: (input: ManualInput) => Promise<AddResult>; onCancel: () => void }) {
  const [value, setValue] = useState<ManualInput>(EMPTY)
  const [errors, setErrors] = useState<ManualErrors>({})
  const [saving, setSaving] = useState(false)
  const [full, setFull] = useState(false)
  const set = (change: Partial<ManualInput>) => setValue({ ...value, ...change })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateManual(value)
    setErrors(found)
    setFull(false)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    const result = await onSubmit(value)
    setSaving(false)
    if (!result.ok) setFull(true)
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-md">
      <div>
        <h2 className="text-[14px] font-bold text-text-primary">Tambah lamaran manual</h2>
        <p className="mt-1 text-[13px] text-text-secondary">
          Untuk lowongan yang tidak ada di Rekomendasi. Judul dan perusahaan sudah cukup; link dan teks lowongan bisa diisi sekarang atau nanti.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <TextField label="Judul lowongan" value={value.title} aria-invalid={Boolean(errors.title)} autoFocus onChange={(event) => set({ title: event.target.value })} />
          <FieldError text={errors.title} />
        </div>
        <div className="flex flex-col gap-1.5">
          <TextField label="Perusahaan" value={value.company} aria-invalid={Boolean(errors.company)} onChange={(event) => set({ company: event.target.value })} />
          <FieldError text={errors.company} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex flex-col gap-1.5">
          <TextField
            label="Link lowongan (opsional)"
            type="url"
            placeholder="https://…"
            value={value.url}
            aria-invalid={Boolean(errors.url)}
            onChange={(event) => set({ url: event.target.value })}
          />
          <FieldError text={errors.url} />
        </div>
        <Select label="Status" value={value.status} onChange={(event) => set({ status: event.target.value as ManualInput['status'] })}>
          <option value="draft">Draft</option>
          <option value="applied">Sudah dilamar</option>
        </Select>
      </div>

      <TextArea label="Teks lowongan (opsional)" rows={5} value={value.description} onChange={(event) => set({ description: event.target.value })} />

      {full && (
        <p role="alert" className="text-[13px] font-semibold text-rose-700">
          Penyimpanan penuh. Lamaran belum tersimpan, dan data lama aman.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Batal</Button>
        <Button type="submit" disabled={saving}>Simpan lamaran</Button>
      </div>
    </form>
  )
}
