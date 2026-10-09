import { PROFILE_SECTIONS, type SectionId } from '../../core/profile/sections'
import { FolderTabs } from './FolderTabs'

export function ProfileTabs({ current, onSelect }: { current: SectionId; onSelect: (id: SectionId) => void }) {
  return <FolderTabs label="Bagian profil" tabs={PROFILE_SECTIONS} current={current} onSelect={onSelect} />
}
