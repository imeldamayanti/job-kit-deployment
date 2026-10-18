import { addEntry, createProject, moveEntry, removeEntry, updateEntry } from '../../core/profile/entries'
import type { Profile, Project } from '../../core/profile/types'
import { Mascot } from '../../ui/mascot/Mascot'
import { Button } from '../../ui/primitives/Button'
import { TextArea } from '../../ui/primitives/TextArea'
import { TextField } from '../../ui/primitives/TextField'
import { EntryCard } from './EntryCard'
import { SectionCard } from './SectionCard'
import { useExpanded } from './useExpanded'

export function ProjectsSection({ profile, update }: { profile: Profile; update: (next: Profile) => void }) {
  const { isOpen, toggle, expand } = useExpanded()
  const list = profile.projects ?? []
  const set = (projects: Project[]) => update({ ...profile, projects })
  const change = (id: string, patch: Partial<Project>) => set(updateEntry(list, id, patch))
  const add = () => {
    const id = crypto.randomUUID()
    set(addEntry(list, createProject(id)))
    expand(id)
  }

  return list.length === 0 ? (
    <SectionCard>
      <div className="flex flex-col items-start gap-2">
        <Mascot state="neutral" />
        <h3 className="text-[14px] font-bold text-text-primary">Belum ada proyek</h3>
        <p className="max-w-[60ch] text-text-secondary">Proyek pribadi, kuliah, atau lomba yang ingin tampil di CV.</p>
        <Button className="mt-1" onClick={add}>
          Tambah proyek pertama
        </Button>
      </div>
    </SectionCard>
  ) : (
    <div className="flex flex-col gap-3">
      {list.map((entry, index) => (
        <EntryCard
          key={entry.id}
          title={entry.name.trim() || 'Belum diisi'}
          subtitle={entry.role}
          period={entry.date}
          expanded={isOpen(entry.id)}
          canMoveUp={index > 0}
          canMoveDown={index < list.length - 1}
          onToggle={() => toggle(entry.id)}
          onMoveUp={() => set(moveEntry(list, entry.id, 'up'))}
          onMoveDown={() => set(moveEntry(list, entry.id, 'down'))}
          onDelete={() => set(removeEntry(list, entry.id))}
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <TextField label="Nama proyek" placeholder="BookNest" value={entry.name} onChange={(e) => change(entry.id, { name: e.target.value })} />
            <TextField label="Peran" placeholder="Fullstack" value={entry.role} onChange={(e) => change(entry.id, { role: e.target.value })} />
            <TextField label="Tanggal" placeholder="Nov 2024" value={entry.date} onChange={(e) => change(entry.id, { date: e.target.value })} />
            <div className="sm:col-span-2">
              <TextArea label="Deskripsi (satu butir per baris)" placeholder="Platform web untuk menilai dan mengulas buku" value={entry.description} onChange={(e) => change(entry.id, { description: e.target.value })} />
            </div>
          </div>
        </EntryCard>
      ))}
      <div>
        <Button variant="secondary" onClick={add}>
          + Tambah proyek
        </Button>
      </div>
    </div>
  )
}
