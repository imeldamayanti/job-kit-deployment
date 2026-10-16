// Three synthetic profiles, shaped like src/core/profile/types.ts (only the parts CV tailoring sends).
// Every name is made up. Descriptions are deliberately plain: the checker compares bullets against them.
export const PROFILES = [
  {
    id: 'A',
    label: 'Web developer (ID), 2 tahun',
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Git', 'REST API', 'Jest'],
    education: [{ id: 'edu-a1', institution: 'Universitas Contoh Nusantara', level: 'S1', major: 'Teknik Informatika' }],
    experience: [
      {
        id: 'exp-a1',
        company: 'PT Contoh Teknologi',
        title: 'Software Engineer',
        start: '2023-08',
        end: '',
        description:
          'Membangun fitur dashboard pelanggan dengan React dan TypeScript. Menulis REST API dengan Node.js dan PostgreSQL. Menulis tes unit dengan Jest sehingga cakupan tes naik dari 40% ke 70%. Ikut code review dua kali seminggu.',
      },
      {
        id: 'exp-a2',
        company: 'CV Contoh Digital',
        title: 'Staf Magang Pengembangan Web',
        start: '2022-01',
        end: '2022-06',
        description: 'Memperbaiki bug tampilan di situs perusahaan. Membantu memindahkan halaman statis ke React.',
      },
    ],
  },
  {
    id: 'B',
    label: 'Data analyst (EN), 3 years',
    skills: ['Python', 'SQL', 'Excel', 'Tableau', 'pandas', 'Statistics', 'English'],
    education: [{ id: 'edu-b1', institution: 'Sample State University', level: 'Bachelor', major: 'Statistics' }],
    experience: [
      {
        id: 'exp-b1',
        company: 'Sample Analytics Ltd',
        title: 'Data Analyst',
        start: '2021-03',
        end: '',
        description:
          'Built weekly sales dashboards in Tableau for the regional team. Wrote SQL queries and pandas scripts to clean order data from three sources. Reduced the weekly reporting time from 6 hours to 2 hours by automating the Excel export.',
      },
      {
        id: 'exp-b2',
        company: 'Contoh Retail Group',
        title: 'Junior Analyst',
        start: '2019-07',
        end: '2021-02',
        description: 'Prepared monthly stock reports in Excel. Presented findings to the store managers of Contoh Retail Group.',
      },
    ],
  },
  {
    id: 'C',
    label: 'IT support / helpdesk (ID), 1 tahun',
    skills: ['Microsoft 365', 'Windows', 'Jaringan dasar', 'Ticketing', 'Komunikasi', 'Bahasa Inggris'],
    education: [{ id: 'edu-c1', institution: 'Politeknik Contoh Mandiri', level: 'D3', major: 'Teknik Komputer' }],
    experience: [
      {
        id: 'exp-c1',
        company: 'PT Contoh Layanan Prima',
        title: 'IT Support',
        start: '2024-02',
        end: '',
        description:
          'Menangani tiket keluhan pengguna lewat sistem ticketing, rata-rata 15 tiket per hari. Memasang ulang Windows dan mengatur akun Microsoft 365 untuk karyawan baru. Memeriksa kabel dan switch saat jaringan kantor bermasalah.',
      },
    ],
  },
]
