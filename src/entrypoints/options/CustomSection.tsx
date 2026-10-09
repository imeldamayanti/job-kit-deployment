import { Trash2 } from 'lucide-react'
import { addCustomField, removeCustomField, updateCustomField } from '../../core/profile/profile'
import type { Profile } from '../../core/profile/types'
import { Button } from '../../ui/primitives/Button'
import { IconButton } from '../../ui/primitives/IconButton'
import { TextField } from '../../ui/primitives/TextField'
import { SectionCard } from './SectionCard'

export function CustomSection({ profile, update }: { profile: Profile; update: (next: Profile) => void }) {
  return (
    <SectionCard title="Custom Field">
      <div className="flex flex-col gap-3">
        {profile.custom.map((pair) => (
          <div key={pair.id} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <TextField
              label="Nama field"
              placeholder="Ekspektasi gaji"
              value={pair.key}
              onChange={(event) => update(updateCustomField(profile, pair.id, { key: event.target.value }))}
            />
            <TextField
              label="Isi"
              placeholder="10 juta"
              value={pair.value}
              onChange={(event) => update(updateCustomField(profile, pair.id, { value: event.target.value }))}
            />
            <IconButton label="Hapus field" onClick={() => update(removeCustomField(profile, pair.id))}>
              <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
            </IconButton>
          </div>
        ))}
        <div>
          <Button variant="secondary" onClick={() => update(addCustomField(profile, crypto.randomUUID()))}>
            + Tambah field
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}
