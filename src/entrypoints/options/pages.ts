import { PROFILE_SECTIONS, sectionFromHash, type SectionId } from '../../core/profile/sections'

export type PageId = SectionId | 'jobs' | 'jobsettings' | 'data'

export const NAV_GROUPS: readonly { label: string; items: readonly { id: PageId; title: string }[] }[] = [
  { label: 'Profile', items: PROFILE_SECTIONS },
  {
    label: 'Data',
    items: [
      { id: 'jobs', title: 'Captured Jobs' },
      // Temporary item: it moves behind the Atur button of the Lowongan page in T37.
      { id: 'jobsettings', title: 'Atur Lowongan' },
      { id: 'data', title: 'Data' },
    ],
  },
]

export const PAGE_SUBTITLES: Record<PageId, string> = {
  personal: 'Nama dan identitas dasar yang paling sering ditanya form lamaran.',
  contact: 'Email, telepon, dan alamat untuk bagian kontak di form.',
  education: 'Riwayat pendidikan, satu kartu per institusi.',
  experience: 'Pengalaman kerja, satu kartu per posisi.',
  custom: 'Pertanyaan yang tidak ada di bagian lain, misalnya ekspektasi gaji.',
  preferences: 'Dipakai untuk mencarikan dan menilai lowongan harian. Tidak dipakai saat mengisi form.',
  jobs: 'Riwayat lowongan yang sudah kamu lamar.',
  jobsettings: 'Sumber, jadwal, dan penilaian AI untuk lowongan harian.',
  data: 'Cadangkan profilmu, atau mulai dari awal.',
}

export function pageFromHash(hash: string): PageId {
  const base = hash.replace(/^#/, '').split('?')[0]
  return base === 'data' || base === 'jobs' || base === 'jobsettings' ? base : sectionFromHash(hash)
}

export function pageTitle(id: PageId): string {
  return NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === id)?.title ?? ''
}
