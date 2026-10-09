import { JOB_LEVELS, WORK_MODES, toggleWorkMode, type JobPreferences } from '../../core/profile/job-preferences'
import type { Profile } from '../../core/profile/types'
import { FilterChip } from '../../ui/primitives/FilterChip'
import { TextField } from '../../ui/primitives/TextField'
import { ChipListField } from './ChipListField'
import { SectionCard } from './SectionCard'

export function PreferencesSection({ profile, update }: { profile: Profile; update: (next: Profile) => void }) {
  const prefs = profile.jobPrefs
  const set = (change: Partial<JobPreferences>) => update({ ...profile, jobPrefs: { ...prefs, ...change } })

  return (
    <SectionCard>
      <div className="flex flex-col gap-5">
        <ChipListField
          label="Role incaran"
          placeholder="Frontend Engineer"
          items={prefs.roles}
          onChange={(roles) => set({ roles })}
        />

        <div role="group" aria-label="Level" className="flex flex-col gap-1.5">
          <p className="text-[13px] font-semibold text-text-primary">Level</p>
          <div className="flex flex-wrap gap-1.5">
            {JOB_LEVELS.map((level) => (
              <FilterChip key={level} selected={prefs.level === level} onClick={() => set({ level: prefs.level === level ? '' : level })}>
                {level}
              </FilterChip>
            ))}
          </div>
        </div>

        <ChipListField
          label="Lokasi incaran"
          placeholder="Jakarta"
          items={prefs.locations}
          onChange={(locations) => set({ locations })}
        />

        <div role="group" aria-label="Tipe kerja" className="flex flex-col gap-1.5">
          <p className="text-[13px] font-semibold text-text-primary">
            Tipe kerja <span className="font-normal text-text-secondary">(boleh lebih dari satu)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {WORK_MODES.map((mode) => (
              <FilterChip
                key={mode}
                selected={prefs.workModes.includes(mode)}
                onClick={() => set({ workModes: toggleWorkMode(prefs.workModes, mode) })}
              >
                {mode}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <ChipListField
            label="Kata kunci wajib"
            placeholder="React"
            hint="Lowongan harus memuat kata ini."
            items={prefs.mustHave}
            onChange={(mustHave) => set({ mustHave })}
          />
          <ChipListField
            label="Kata kunci yang dihindari"
            placeholder="PHP"
            hint="Lowongan yang memuat kata ini tidak ditampilkan."
            items={prefs.avoid}
            onChange={(avoid) => set({ avoid })}
          />
        </div>

        <div className="max-w-[300px]">
          <TextField
            label="Gaji minimum (opsional)"
            placeholder="Kosongkan bila tidak ada batas"
            value={prefs.minSalary}
            onChange={(event) => set({ minSalary: event.target.value })}
          />
        </div>
      </div>
    </SectionCard>
  )
}
