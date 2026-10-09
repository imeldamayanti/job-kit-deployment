import { addEntry, createExperience, moveEntry, removeEntry, updateEntry } from '../../core/profile/entries'
import type { Experience, Profile } from '../../core/profile/types'
import { Mascot } from '../../ui/mascot/Mascot'
import { Button } from '../../ui/primitives/Button'
import { Checkbox } from '../../ui/primitives/Checkbox'
import { TextArea } from '../../ui/primitives/TextArea'
import { TextField } from '../../ui/primitives/TextField'
import { EntryCard } from './EntryCard'
import { SectionCard } from './SectionCard'
import { useExpanded } from './useExpanded'

export function ExperienceSection({ profile, update }: { profile: Profile; update: (next: Profile) => void }) {
  const { isOpen, toggle, expand } = useExpanded()
  const list = profile.experience
  const set = (experience: Experience[]) => update({ ...profile, experience })
  const change = (id: string, patch: Partial<Experience>) => set(updateEntry(list, id, patch))
  const add = () => {
    const id = crypto.randomUUID()
    set(addEntry(list, createExperience(id)))
    expand(id)
  }

  return (
    <>
      {list.length === 0 ? (
        <SectionCard>
        <div className="flex flex-col items-start gap-2">
          <Mascot state="neutral" />
          <h3 className="text-[14px] font-bold text-text-primary">Belum ada pengalaman kerja</h3>
          <p className="max-w-[60ch] text-text-secondary">
            Perusahaan, jabatan, periode, dan deskripsi singkat. Form lamaran sering menanyakan pekerjaan terakhir.
          </p>
          <Button className="mt-1" onClick={add}>
            Tambah pengalaman pertama
          </Button>
        </div>
        </SectionCard>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((entry, index) => (
            <EntryCard
              key={entry.id}
              title={entry.title.trim() || 'Belum diisi'}
              subtitle={entry.company}
              period={[entry.start, entry.current ? 'sekarang' : entry.end].filter((part) => part.trim() !== '').join(' - ')}
              expanded={isOpen(entry.id)}
              canMoveUp={index > 0}
              canMoveDown={index < list.length - 1}
              onToggle={() => toggle(entry.id)}
              onMoveUp={() => set(moveEntry(list, entry.id, 'up'))}
              onMoveDown={() => set(moveEntry(list, entry.id, 'down'))}
              onDelete={() => set(removeEntry(list, entry.id))}
            >
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <TextField label="Perusahaan" placeholder="PT Maju Jaya" value={entry.company} onChange={(e) => change(entry.id, { company: e.target.value })} />
                <TextField label="Jabatan" placeholder="Staf Administrasi" value={entry.title} onChange={(e) => change(entry.id, { title: e.target.value })} />
                <TextField label="Mulai" placeholder="Januari 2022" value={entry.start} onChange={(e) => change(entry.id, { start: e.target.value })} />
                <TextField label="Selesai" placeholder="Desember 2024" disabled={entry.current} value={entry.end} onChange={(e) => change(entry.id, { end: e.target.value })} />
                <div className="sm:col-span-2">
                  <Checkbox checked={entry.current} onChange={(e) => change(entry.id, { current: e.target.checked })}>
                    <span className="text-[13px] text-text-primary">Masih bekerja di sini</span>
                  </Checkbox>
                </div>
                <div className="sm:col-span-2">
                  <TextArea label="Deskripsi" placeholder="Mengelola arsip dan jadwal tim" value={entry.description} onChange={(e) => change(entry.id, { description: e.target.value })} />
                </div>
              </div>
            </EntryCard>
          ))}
          <div>
            <Button variant="secondary" onClick={add}>
              + Tambah pengalaman
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
