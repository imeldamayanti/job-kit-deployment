import { createEmptyProfile } from '../profile/profile'
import type { Profile } from '../profile/types'

// The three synthetic profiles of the T45 spike, in the shape of the real Profile. Every name is made up.
// Used by tests and by the dev preview states; never real data.
type Sample = {
  first: string
  last: string
  skills: string[]
  education: Profile['education']
  experience: Profile['experience']
}

function build({ first, last, skills, education, experience }: Sample): Profile {
  const profile = createEmptyProfile()
  profile.personal.firstName = first
  profile.personal.lastName = last
  profile.contact.email = `${first.toLowerCase()}@example.test`
  profile.contact.phone = '081200000000'
  profile.contact.city = 'Denpasar'
  profile.skills = skills.map((name) => ({ group: 'teknis', name }))
  profile.education = education
  profile.experience = experience
  return profile
}

export const SAMPLE_WEB_DEV: Profile = build({
  first: 'Sari',
  last: 'Contohwati',
  skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Git', 'REST API', 'Jest'],
  education: [{ id: 'edu-a1', institution: 'Universitas Contoh Nusantara', level: 'S1', major: 'Teknik Informatika', gpa: '3.5', year: '2022' }],
  experience: [
    {
      id: 'exp-a1', company: 'PT Contoh Teknologi', title: 'Software Engineer', start: '2023-08', end: '', current: true,
      description:
        'Membangun fitur dashboard pelanggan dengan React dan TypeScript. Menulis REST API dengan Node.js dan PostgreSQL. Menulis tes unit dengan Jest sehingga cakupan tes naik dari 40% ke 70%. Ikut code review dua kali seminggu.',
    },
    {
      id: 'exp-a2', company: 'CV Contoh Digital', title: 'Staf Magang Pengembangan Web', start: '2022-01', end: '2022-06', current: false,
      description: 'Memperbaiki bug tampilan di situs perusahaan. Membantu memindahkan halaman statis ke React.',
    },
  ],
})

export const SAMPLE_DATA_ANALYST: Profile = build({
  first: 'Dewi',
  last: 'Sampleton',
  skills: ['Python', 'SQL', 'Excel', 'Tableau', 'pandas', 'Statistics', 'English'],
  education: [{ id: 'edu-b1', institution: 'Sample State University', level: 'Bachelor', major: 'Statistics', gpa: '3.7', year: '2019' }],
  experience: [
    {
      id: 'exp-b1', company: 'Sample Analytics Ltd', title: 'Data Analyst', start: '2021-03', end: '', current: true,
      description:
        'Built weekly sales dashboards in Tableau for the regional team. Wrote SQL queries and pandas scripts to clean order data from three sources. Reduced the weekly reporting time from 6 hours to 2 hours by automating the Excel export.',
    },
    {
      id: 'exp-b2', company: 'Contoh Retail Group', title: 'Junior Analyst', start: '2019-07', end: '2021-02', current: false,
      description: 'Prepared monthly stock reports in Excel. Presented findings to the store managers of Contoh Retail Group.',
    },
  ],
})

export const SAMPLE_IT_SUPPORT: Profile = build({
  first: 'Made',
  last: 'Contohan',
  skills: ['Microsoft 365', 'Windows', 'Jaringan dasar', 'Ticketing', 'Komunikasi', 'Bahasa Inggris'],
  education: [{ id: 'edu-c1', institution: 'Politeknik Contoh Mandiri', level: 'D3', major: 'Teknik Komputer', gpa: '3.4', year: '2023' }],
  experience: [
    {
      id: 'exp-c1', company: 'PT Contoh Layanan Prima', title: 'IT Support', start: '2024-02', end: '', current: true,
      description:
        'Menangani tiket keluhan pengguna lewat sistem ticketing, rata-rata 15 tiket per hari. Memasang ulang Windows dan mengatur akun Microsoft 365 untuk karyawan baru. Memeriksa kabel dan switch saat jaringan kantor bermasalah.',
    },
  ],
})

export const SAMPLE_PROFILES = [SAMPLE_WEB_DEV, SAMPLE_DATA_ANALYST, SAMPLE_IT_SUPPORT]
