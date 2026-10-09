// Synthetic CV text, as pdf.js would hand it over. Every name, email, and number here is made up
// (emails use the reserved example.test domain). Shared by the parser tests.

// Single column, Indonesian. Same text as clean-id.pdf.
export const CLEAN_ID = `Rani Wijaya Contoh
rani.contoh@example.test | +62 812-0000-0001 | Bandung, Jawa Barat
linkedin.com/in/rani-contoh-sintetis
Pendidikan
Universitas Contoh Nusantara
S1 Teknik Informatika, IPK 3,62
2018 - 2022
Pengalaman Kerja
Software Engineer, PT Contoh Teknologi
Agustus 2022 - Sekarang
Membangun fitur web dengan TypeScript dan React.
Staf Magang, CV Contoh Digital
Januari 2022 - Juni 2022
Membantu pengujian aplikasi internal.
Keahlian
TypeScript, React, SQL`

// Two columns, English: the sidebar comes first, the name sits in the main column.
// The LinkedIn address wraps onto a second line. Same text as two-column-en.pdf.
export const TWO_COLUMN_EN = `Contact
dewi.sample@example.test
+62 21 5555 0002
Jakarta, Indonesia
linkedin.com/in/dewi-sample-
synthetic
Skills
Python
Data Analysis
English
Dewi Anggraini Sample
Data Analyst
Work Experience
Data Analyst - Sample Analytics Ltd
Mar 2021 - Present
Built dashboards and reports for the sales team.
Education
Sample State University
Bachelor of Statistics, GPA 3.50
2016 - 2020`

// Single column, Indonesian: upper-case name with a degree, labelled contact lines.
export const LABELLED_ID = `BUDI SANTOSO CONTOH, S.Kom.
Telp: 0812-0000-0003
Email: budi.santoso@example.test
Kota: Surabaya
Riwayat Pendidikan
Institut Contoh Surabaya
S1 Sistem Informasi, IPK 3,40
2015 - 2019
Pengalaman Kerja
Analis Sistem, PT Contoh Mandiri
2019 - 2023`

// Single column, English: international phone format, full LinkedIn URL, city and country.
export const CLEAN_EN = `Alex Rivera Sample
Product Designer
alex.rivera@example.test
(+62) 811 0000 0004
Yogyakarta, Indonesia
https://www.linkedin.com/in/alex-rivera-sample/
Summary
Designer with a focus on research.
Education
Sample Institute of Design
Bachelor of Design
2014 - 2018`

// Two columns, Indonesian: the contact column comes first, no LinkedIn.
export const TWO_COLUMN_ID = `Kontak
Telepon
0857-0000-0005
Email
sinta.lestari@example.test
Domisili: Depok
Keahlian
Akuntansi, Excel
Sinta Lestari Contoh
Akuntan
Pengalaman Kerja
Akuntan Junior, PT Contoh Sejahtera
2020 - 2022
Pendidikan
Universitas Contoh Depok
S1 Akuntansi
2016 - 2020`

// The name is not on the first line and nothing else vouches for it.
export const UNVOUCHED_NAME = `Curriculum Vitae
Made Wirawan Sampel
021-5550-0006
Pendidikan
SMA Contoh 1`

// Two different emails: the parser must not pick one with full confidence.
export const TWO_EMAILS = `Tia Ramadhani Contoh
tia.contoh@example.test / tia.kerja@example.test
+62 813 0000 0007
Education
Universitas Contoh`

// Nothing recognisable.
export const NO_IDENTITY = `Lorem ipsum dolor sit amet
consectetur adipiscing elit
1234`
