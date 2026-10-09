import { isDataHash } from '../../core/data/preview-states'
import { PROFILE_SECTIONS, sectionFromHash, type SectionId } from '../../core/profile/sections'

export type PageId = SectionId | 'data'

export const NAV_GROUPS: readonly { label: string; items: readonly { id: PageId; title: string }[] }[] = [
  { label: 'Profile', items: PROFILE_SECTIONS },
  { label: 'Data', items: [{ id: 'data', title: 'Data' }] },
]

export const PAGE_SUBTITLES: Record<PageId, string> = {
  personal: 'Nama dan identitas dasar yang paling sering ditanya form lamaran.',
  contact: 'Email, telepon, dan alamat untuk bagian kontak di form.',
  education: 'Riwayat pendidikan, satu kartu per institusi.',
  experience: 'Pengalaman kerja, satu kartu per posisi.',
  custom: 'Pertanyaan yang tidak ada di bagian lain, misalnya ekspektasi gaji.',
  data: 'Cadangkan profilmu, atau mulai dari awal.',
}

export function pageFromHash(hash: string): PageId {
  return isDataHash(hash) ? 'data' : sectionFromHash(hash)
}

export function pageTitle(id: PageId): string {
  return NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === id)?.title ?? ''
}
