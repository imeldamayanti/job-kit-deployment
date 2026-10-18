import { addEntry, createEducation, moveEntry, removeEntry, updateEntry } from '../../core/profile/entries'
import type { Education, Profile } from '../../core/profile/types'
import { Mascot } from '../../ui/mascot/Mascot'
import { Button } from '../../ui/primitives/Button'
import { TextArea } from '../../ui/primitives/TextArea'
import { TextField } from '../../ui/primitives/TextField'
import { EntryCard } from './EntryCard'
import { SectionCard } from './SectionCard'
import { useExpanded } from './useExpanded'

const FIELDS: { key: keyof Omit<Education, 'id' | 'publication' | 'achievements'>; label: string; placeholder: string }[] = [
  { key: 'institution', label: 'Institusi', placeholder: 'Universitas Padjadjaran' },
  { key: 'level', label: 'Jenjang', placeholder: 'S1' },
  { key: 'major', label: 'Jurusan', placeholder: 'Sastra Inggris' },
  { key: 'gpa', label: 'IPK', placeholder: '3,65' },
  { key: 'year', label: 'Tahun atau periode', placeholder: 'Sep 2022 – Mar 2026' },
  { key: 'location', label: 'Lokasi', placeholder: 'Bandung' },
]

export function EducationSection({ profile, update }: { profile: Profile; update: (next: Profile) => void }) {
  const { isOpen, toggle, expand } = useExpanded()
  const list = profile.education
  const set = (education: Education[]) => update({ ...profile, education })
  const add = () => {
    const id = crypto.randomUUID()
    set(addEntry(list, createEducation(id)))
    expand(id)
  }

  return (
    <>
      {list.length === 0 ? (
        <SectionCard>
        <div className="flex flex-col items-start gap-2">
          <Mascot state="neutral" />
          <h3 className="text-[14px] font-bold text-text-primary">Belum ada riwayat pendidikan</h3>
          <p className="max-w-[60ch] text-text-secondary">
            Institusi, jenjang, jurusan, IPK, dan tahun — empat di antaranya sering ditanya form lamaran.
          </p>
          <Button className="mt-1" onClick={add}>
            Tambah pendidikan pertama
          </Button>
        </div>
        </SectionCard>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((entry, index) => (
            <EntryCard
              key={entry.id}
              title={entry.institution.trim() || 'Belum diisi'}
              subtitle={`${entry.level} ${entry.major}`.trim()}
              period={entry.year}
              expanded={isOpen(entry.id)}
              canMoveUp={index > 0}
              canMoveDown={index < list.length - 1}
              onToggle={() => toggle(entry.id)}
              onMoveUp={() => set(moveEntry(list, entry.id, 'up'))}
              onMoveDown={() => set(moveEntry(list, entry.id, 'down'))}
              onDelete={() => set(removeEntry(list, entry.id))}
            >
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                {FIELDS.map(({ key, label, placeholder }) => (
                  <TextField
                    key={key}
                    label={label}
                    placeholder={placeholder}
                    value={entry[key] ?? ''}
                    onChange={(event) => set(updateEntry(list, entry.id, { [key]: event.target.value }))}
                  />
                ))}
                <div className="sm:col-span-2">
                  <TextField label="Publikasi" placeholder="Judul makalah, IEEE (2025)" value={entry.publication ?? ''} onChange={(event) => set(updateEntry(list, entry.id, { publication: event.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <TextArea label="Prestasi (satu per baris)" placeholder="Juara 1 Lomba Festival Informatika (2024)" value={entry.achievements ?? ''} onChange={(event) => set(updateEntry(list, entry.id, { achievements: event.target.value }))} />
                </div>
              </div>
            </EntryCard>
          ))}
          <div>
            <Button variant="secondary" onClick={add}>
              + Tambah pendidikan
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
