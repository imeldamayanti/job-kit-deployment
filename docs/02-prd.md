# PRD — job-kit

**Product:** job-kit — "Ketik sekali, lamar di mana saja."
**Type:** Chrome extension, Soft-UI card / bright-blue friendly, autofill lamaran kerja

**Sprint / Project:** Sprint ??? — job-kit
**Author (PIC):** imelda
**Builder:** imelda
**Date:** 2026-10-09
**Status:** APPROVED
**Research input:** `docs/01-research.md` (verdict BUILD)
**Launch date:** Day 10 — fixed

---

## 1. One-sentence test

job-kit membuat pelamar kerja mengisi form lamaran dengan satu klik dari profil yang ia ketik sekali, dan bisa membatalkannya.

## 2. Problem & context

| | |
|---|---|
| **Persona** | Pelamar kerja yang lebih suka alat cepat dan jelas daripada alat yang bisa di-setting macam-macam. Melamar ke banyak tempat, tidak mau mengetik ulang. |
| **Not the target** | Recruiter, agency, orang yang mengelola profil banyak orang, power user yang ingin menulis aturan pemetaan sendiri. |
| **What goes wrong** | Data yang sama diketik ulang di tiap form. Autofill bawaan browser tidak mengenal field khas lamaran. |
| **What it costs** | Waktu mengetik ulang, dan salah ketik yang terkirim ke perusahaan. |
| **Workaround** | Copy-paste dari CV atau dari catatan sendiri. |
| **Measured against** | **Chrome autofill** — baseline yang harus dikalahkan: kita mengenal field lamaran, dia tidak. **Simplify Copilot** — kita ambil kepadatan panel sempit yang rapi; identitas visual dan copy-nya tidak. **Duolingo** — kita ambil nada ramah dan maskot yang membuat tugas membosankan terasa ringan. |

Persona adalah batasan desain, bukan hasil riset.

## 3. Evidence

UNKNOWN — no real research yet.

## 4. Goals & non-goals

| Goals | Non-goals |
|---|---|
| Satu klik mengisi form lamaran dari profil. | Tidak ada akun, login, atau sinkron antar perangkat. |
| Pengguna melihat apa yang akan diisi sebelum menekan Fill. | Tidak ada fitur AI: cover letter, cek kecocokan lowongan, latihan interview. |
| Pengguna bisa membatalkan pengisian. | Tidak ada pencatatan riwayat lowongan (Captured Jobs) di v1. |
| Profil diketik sekali di satu tempat. | Tidak ada export atau import data di v1. |
| | Tidak ada tombol submit otomatis; pengguna yang mengirim form. |
| | Tidak ada membaca CV PDF menjadi profil. |
| | Tidak ada upload file CV otomatis. |
| | Tidak ada banyak profil per pengguna. |
| | Tidak ada pemetaan manual per situs. |
| | Tidak ada Safari atau Firefox; hanya browser Chromium. |
| | Tidak ada telemetri atau analytics. |

## 5. User stories

- **A** — Sebagai pelamar, saya mengisi profil sekali (data diri, kontak & alamat, pendidikan, pengalaman kerja, skill, field kustom) supaya tidak mengetik ulang.
- **B** — Sebagai pelamar, saya melihat daftar field yang terdeteksi dan nilai yang akan diisi sebelum menekan Fill, supaya tidak ada kejutan.
- **C** — Sebagai pelamar, saya menekan satu tombol Fill dan form terisi, supaya cepat.
- **D** — Sebagai pelamar, saya menekan Undo dan form kembali seperti sebelum diisi, supaya aman dari salah isi.
- **E** — Sebagai pelamar, saya diberi tahu dengan jelas bila halaman tidak bisa diisi atau profil kurang data, supaya saya tahu langkah berikutnya.

**Core flow:**
1. Pengguna membuka halaman Edit Profile dan mengisi profil.
2. Pengguna membuka halaman lamaran di browser.
3. Pengguna membuka side panel job-kit.
4. Panel menampilkan field yang terdeteksi beserta nilainya.
5. Pengguna mematikan field yang tidak mau diisi (opsional).
6. Pengguna menekan Fill.
7. Pengguna memeriksa form, lalu menekan Undo bila perlu, atau mengirim form sendiri.

## 6. Flow & screens

### 6.1 User flow

```mermaid
flowchart LR
    start(["Buka side panel di halaman lamaran"]) --> form{"Form terbaca?"}
    form -->|"tidak ada / terkunci / tak bisa diakses"| err["Panel: pesan sebab + saran"]
    form -->|ya| prof{"Profil punya data?"}
    prof -->|"kosong total"| S2["Panel · Profile<br/>ajakan isi profil"]
    S2 -->|"Isi profil sekarang"| S3["Options · Profile<br/>isi dan simpan"]
    S3 -->|"tutup, kembali ke halaman lamaran"| start
    prof -->|ada| S1["Panel · Autofill<br/>field + nilai"]
    S1 -->|"field kosong: Isi →"| S3
    S1 -->|"Fill"| filled(["Form terisi · ringkasan"])
    filled --> undo{"Undo?"}
    undo -->|ya| reverted(["Form kembali seperti awal"])
    undo -->|tidak| submit(["Pengguna kirim form sendiri"])

    classDef screen fill:#E9F2FF,stroke:#0055CC,stroke-width:2px,color:#172B4D
    classDef gate   fill:#FFF0B3,stroke:#974F0C,stroke-width:2px,color:#172B4D
    classDef bad    fill:#FFECEB,stroke:#AE2E24,stroke-width:2px,color:#172B4D
    classDef done   fill:#E3FCEF,stroke:#216E4E,stroke-width:2px,color:#172B4D
    class start,filled,reverted,submit done
    class form,prof,undo gate
    class S1,S2,S3 screen
    class err bad
```

12 node, 3 layar. Jalur utama 7 langkah: start → form → prof → S1 → Fill → filled → submit.

**Coverage §8**

| Baris §8 | Ditangani di |
|---|---|
| Halaman aktif tidak punya form dikenali | cabang `form → err` |
| Sebagian field tidak terpetakan | label di Panel · Autofill (daftar "Dilewati") |
| Profil belum punya data untuk field yang diminta | cabang `S1 → S3` ("Isi →") |
| Halaman tidak bisa diakses (halaman browser internal, PDF) | cabang `form → err` |
| Form ada di dalam frame yang terkunci | cabang `form → err` |
| Undo setelah halaman dimuat ulang | label di Panel · Autofill (Undo tidak tersedia) |
| Fill dua kali | label di Panel · Autofill |
| Field sudah berisi teks pengguna | label di Panel · Autofill (timpa / lewati) |
| Profil kosong total | cabang `prof → S2` |
| Penyimpanan penuh | label di Options · Profile |
| Belum diberi izin membaca halaman | label di Panel · Autofill (state "Butuh izin") |

### 6.2 Screens

| Screen | Story | Purpose | Primary action | Empty state | Error state |
|---|---|---|---|---|---|
| **S1 Panel · Autofill** | B, C, D, E | Lihat field dan nilainya, isi, batalkan | **"Fill"** | `"Tidak ada form di halaman ini"` / `"Buka halaman lamaran kerja, lalu panel ini akan mendeteksi field-nya sendiri."` | `"Tidak bisa dibaca"` + sebab + saran; `"Butuh izin untuk situs ini"` + **"Beri izin untuk situs ini"** |
| **S2 Panel · Profile** | A, E | Pratinjau profil, jalan ke halaman edit | **"Edit Profile"** (kosong total: **"Isi profil sekarang"**) | `"Profil masih kosong"` / `"Autofill hanya seakurat data yang ada. Isi Personal Info dan Contact dulu — sisanya bisa menyusul."` | — |
| **S3 Options · Profile** | A | Isi dan ubah profil | Tidak ada tombol simpan; simpan otomatis, indikator `"Tersimpan"` | Education: `"Belum ada riwayat pendidikan"` / `"Institusi, jenjang, jurusan, IPK, dan tahun — empat di antaranya sering ditanya form lamaran."` + **"Tambah pendidikan pertama"** | `"Tidak tersimpan — penyimpanan penuh. Data lama aman."` |

**S1 Panel · Autofill**
- Header: nama produk + dua tab (Autofill, Profile).
- Site header: domain dan judul halaman (FR-05).
- Summary bar: `"9 dari 12 field cocok"` (FR-07).
- Daftar "Akan diisi": per baris checkbox, label field, nilai. Aksi `"Matikan yang tidak perlu"` (FR-08). Field yang sudah berisi ditandai `"Sudah berisi"` dengan pilihan timpa / lewati.
- Daftar "Dilewati": field tak terpetakan, tanpa tombol petakan.
- Daftar "Profil belum punya": baris `"Email"` + `"Isi →"` ke S3.
- State sedang mengisi: `"Mengisi field ke-6 dari 12…"`.
- Ringkasan hasil: `"9 field terisi · 1 dilewati"` + `"Cek sekali lagi sebelum submit, ya."` (FR-19).
- Footer tetap: **"Fill"**; setelah Fill ganti jadi **"Undo"**. Disabled `"Fill"` bilang sebabnya: `"Profil masih kosong — isi dulu"`.
- Decorative: maskot state netral di "Tidak ada form"; maskot error di "Tidak bisa dibaca"; maskot berhasil di ringkasan hasil.

**S2 Panel · Profile**
- Identitas: nama + email.
- Daftar bagian dengan jumlah: `"Work Experience · 3"`, `"Contact & Address · belum diisi"`.
- Tombol **"Edit Profile"** (FR-17).
- Decorative: maskot netral di state kosong.

**S3 Options · Profile**
- Navigasi kiri: Personal Info, Contact & Address, Education, Work Experience, Skill, Custom Field.
- Personal Info dan Contact & Address: form dua kolom. Placeholder contoh nyata: `"Imelda"`, `"nama@example.test"`, `"linkedin.com/in/imelda"`.
- Education, Work Experience: kartu entri bisa tambah, hapus, ubah urutan; kartu terlipat menampilkan ringkasan satu baris. Work Experience punya `"Masih bekerja di sini"`.
- Skill: chip dengan grup teknis / bahasa / lainnya (FR-16).
- Custom Field: baris key–value, kontrol `"+ Tambah field"` (FR-04).
- Penanda bagian belum lengkap di navigasi (FR-15).
- Indikator `"Tersimpan"` (FR-03).
- Decorative: maskot netral di empty state Education / Work Experience / Skill.

**Coverage FR:** FR-01..04 → S3 · FR-05..08, 09..14 → S1 · FR-15 → S3 · FR-16 → S3 · FR-17 → S2 · FR-18 → S1 · FR-19 → S1. Daftar FR yang tidak muncul di layar manapun: kosong.

### 6.3 Referensi

Mockup yang sudah ada, dibaca sebagai referensi, tidak digambar ulang:
- `docs/reference/JobFill UI.dc.html` — mockup panel 400px dan options page.
- `docs/reference/JobFill Mascot.dc.html` — enam state maskot.
- `docs/design-system.md` dan `docs/design-system.html` — token dan komponen.
- `docs/screens.md` — peta layar dan state versi lama.

Referensi ini dibuat untuk PRD lama (nama JobFill, lingkup lebih besar). Hanya bagian yang cocok dengan §7 yang dipakai.

### 6.4 Screenshot

`docs/screenshots/reference-ui.png` — halaman mockup referensi, tampilan awal.

### 6.5 Arah visual

**Soft-UI card:** latar abu terang, kartu putih berradius besar (14px) dengan border tipis, bayangan halus hanya di halaman options, tab berbentuk map di panel. **Bright-blue friendly:** biru cerah untuk semua yang bisa diklik, hijau untuk terisi, amber untuk perlu perhatian, nada copy ramah, maskot flat bergaris minimal di empty dan state hasil. Font sistem.

**Display type:** judul terbesar 17px di panel (±1,3× body 13px) dan 28px di options page (2× body 14px); satu bobot tebal solid, tanpa outline atau offset.

### 6.6 Yang harus ditebak

Hal yang ditunjukkan referensi tapi tidak disebut §6.2 awal, atau yang spesifikasinya tidak cukup. Yang bertanda **→PRD** sudah dibawa ke §7/§8.

1. **Tab Profile + tombol Edit Profile** tidak ada di PRD awal, padahal itu satu-satunya jalan ke halaman edit. **→PRD:** FR-17.
2. **State "Butuh izin"** ada di referensi lama tapi tidak di §8. Tanpa itu, halaman yang belum diizinkan jatuh ke "Tidak ada form". **→PRD:** FR-18 dan satu baris §8.
3. **Ringkasan hasil Fill** (`"9 field terisi · 1 dilewati"`) tidak ada di FR. **→PRD:** FR-19.
4. **State "sedang mengisi"** ada di referensi, bukan FR. Dibuat sebagai label di S1, tanpa FR; hilang dari cut list bila waktu habis.
5. **Dua tombol di header referensi** (cari, setelan) tidak punya fungsi di §7. Tidak dibuat.
6. **Referensi memuat layar di luar lingkup:** simpan lowongan, Captured Jobs, Data (export/import), skor kecocokan, CV defense, tombol "Petakan". Tidak dibuat.
7. **Validasi format** (`"Sepertinya belum lengkap — biasanya diawali https://"`) ada di referensi, di luar lingkup §9. Tidak dibuat.
8. **Mode gelap:** `design-system.md` menunda nilainya. Di luar v1; PIC menunda keputusan nilai gelap (lihat §11).
9. **Maskot:** posisinya hanya di empty state, error, dan hasil (lihat `Decorative:`). **Dikonfirmasi PIC 2026-10-09.**
10. **Nama produk di referensi masih "JobFill"**; layar baru memakai "job-kit".
11. **Display type hanya 1,3×–2× body.** Menurut aturan P3b, itu cenderung terlihat datar. **PIC putuskan 2026-10-09:** dibiarkan 17px / 28px.
12. **Tab Profile di mockup memuat bagian Additional · 5**, padahal Additional di luar lingkup v1 (§9). Tab Profile v1 hanya 6 bagian: Personal Info, Custom Field, Contact & Address, Education, Work Experience, Skill.
13. **Navigasi kiri di mockup options page memuat Additional, Captured Jobs, dan Data.** Ketiganya di luar lingkup v1 (§9). Navigasi v1 hanya satu grup Profile dengan 6 item; grup DATA tidak ada.
14. **Mockup options page punya bug layout:** kolom kanan (Nama tengah, Tanggal lahir, Kewarganegaraan) meluber melewati tepi kartu. Bentuk dua kolom dipakai, tata letak mockup tidak ditiru persis.
15. **Timpa atau lewati field yang sudah berisi** punya bawaan "lewati" (§8) tapi referensi tidak menggambarkannya. Tampilannya belum diputuskan.

## 7. Functional requirements

| ID | Requirement | How we verify | Priority |
|---|---|---|---|
| FR-01 | Pengguna dapat membuat, mengubah, dan menghapus data pada bagian Personal Info, Contact & Address. | Ubah tiap bagian, muat ulang halaman, nilai tetap ada. | Must |
| FR-02 | Pengguna dapat menambah, mengubah, menghapus, dan mengurutkan banyak entri Education dan Work Experience. | Tambah 3 entri, ubah urutan, muat ulang; urutan sama. | Must |
| FR-03 | Perubahan profil tersimpan otomatis dan indikator "tersimpan" terlihat setelah tiap perubahan. | Ketik satu field; indikator muncul dalam 2 detik. | Must |
| FR-04 | Pengguna dapat menambah pasangan key–value kustom, dan pasangan itu ikut dipakai saat pemetaan field. | Tambah "Ekspektasi gaji"; form yang menanyakannya terisi. | Must |
| FR-05 | Side panel menampilkan nama domain halaman aktif. | Buka dua situs berbeda; domain sesuai. | Must |
| FR-06 | Side panel mendeteksi ulang field saat tab aktif berganti atau halaman berpindah. | Pindah tab; daftar field milik halaman baru, bukan lama. | Must |
| FR-07 | Panel menampilkan "N dari M field cocok" untuk form terdeteksi. | Form uji dengan 10 field dan 7 cocok menampilkan "7 dari 10". | Must |
| FR-08 | Panel menampilkan pasangan field → nilai sebelum pengisian, dan pengguna dapat mematikan tiap field. | Matikan satu field; setelah Fill field itu tidak berubah. | Must |
| FR-09 | Fill hanya berjalan setelah pengguna menekan tombol Fill. | Buka halaman uji; tidak ada field berubah sebelum tombol ditekan. | Must |
| FR-10 | Setelah Fill, framework form modern (React, Vue) menerima nilai yang diisi. | Isi form berbasis React; nilai tidak hilang saat fokus berpindah. | Must |
| FR-11 | Undo mengembalikan semua field yang diisi ke nilai sebelumnya selama halaman belum dimuat ulang. | Isi, Undo; setiap field sama seperti awal. | Must |
| FR-12 | job-kit tidak menekan tombol submit dan tidak mengisi field bertipe password. | Form login uji; password kosong, tidak ada submit. | Must |
| FR-13 | Field dikenali dari label berbahasa Indonesia dan Inggris. | Form berlabel "Nama Lengkap" dan "Full Name" sama-sama terisi. | Must |
| FR-14 | Pilihan dropdown dan radio dicocokkan longgar dengan teks opsi (profil "Laki-laki" cocok "Male"). | Form uji dengan opsi "Male"; terpilih. | Should |
| FR-15 | Halaman profil menunjukkan bagian yang belum diisi. | Kosongkan Contact; bagian itu ditandai belum lengkap. | Should |
| FR-16 | Pengguna dapat mengelola daftar Skill. | Tambah dan hapus skill; muat ulang, daftar sesuai. | Should |
| FR-17 | Side panel punya dua tab, Autofill dan Profile; tab Profile menampilkan nama, email, jumlah entri per bagian, dan satu tombol Edit Profile yang membuka halaman edit profil lebar penuh, yang ada di dalam extension (bukan situs web), di tab baru. | Klik Edit Profile; halaman edit terbuka di tab baru tanpa memuat situs eksternal. | Must |
| FR-18 | Bila job-kit belum boleh membaca halaman aktif, panel menyatakan itu dan menawarkan satu tombol untuk memberi izin pada situs itu. | Buka situs baru tanpa izin; panel menampilkan tombol izin dan tidak menampilkan "Tidak ada form". | Must |
| FR-19 | Setelah Fill, panel menampilkan jumlah field terisi dan jumlah field dilewati. | Fill form dengan 9 cocok dan 1 dilewati; panel menampilkan "9 field terisi · 1 dilewati". | Must |

## 8. Edge cases & error states

| Situasi | Yang terjadi |
|---|---|
| Halaman aktif tidak punya form dikenali | Panel menampilkan pesan "Tidak ada form di halaman ini" dan saran membuka halaman lamaran. |
| Sebagian field tidak terpetakan | Panel mengisi yang cocok dan menampilkan daftar field yang dilewati. |
| Profil belum punya data untuk field yang diminta | Field itu ditandai kosong, dilewati, dan panel menautkan ke bagian profil terkait. |
| Halaman tidak bisa diakses (halaman browser internal, PDF) | Panel menyebut sebabnya dan tidak menampilkan tombol Fill. |
| Form ada di dalam frame yang terkunci | Panel menyebut bahwa form tidak bisa diisi dan tidak mencoba mengisinya. |
| Pengguna menekan Undo setelah halaman dimuat ulang | Tombol Undo tidak tersedia; panel menyatakan bahwa nilai awal sudah tidak tersimpan. |
| Pengguna menekan Fill dua kali | Pengisian kedua mengganti nilai yang sama; Undo tetap mengembalikan ke nilai sebelum pengisian pertama. |
| Field sudah berisi teks dari pengguna | Panel menandainya dan menanyakan timpa atau lewati sebelum Fill; bawaan: lewati. |
| Profil kosong total | Panel menampilkan ajakan mengisi profil, tombol Fill tidak aktif. |
| Penyimpanan penuh | Pengguna diberi tahu perubahan tidak tersimpan; data lama tidak hilang. |
| job-kit belum diberi izin membaca halaman ini | Panel menyebut nama domain, menjelaskan bahwa izin dibutuhkan untuk membaca field, dan menampilkan satu tombol "Beri izin untuk situs ini". Panel tidak menampilkan "Tidak ada form". |

## 9. Scope IN and OUT

**IN:** profil (Personal, Contact & Address, Education, Work Experience, Custom Field, Skill), deteksi field, pratinjau, Fill, Undo, state error dan state kosong, pencocokan label Indonesia dan Inggris.

**OUT:** Captured Jobs, export/import, hapus semua data, bagian Additional (sertifikasi, penghargaan), pemetaan manual per situs, badge pada ikon, field tanggal dengan format khusus, validasi format email/URL/telepon, semua fitur AI, Safari.

**Cut list (urutan potong, tanpa diskusi di Day 8):**
1. FR-16 — Skill.
2. FR-15 — petunjuk kelengkapan profil.
3. FR-14 — pencocokan longgar dropdown dan radio.

## 10. Success metric

**≥70% field terpetakan dengan benar pada 10 situs lamaran uji.**

Situs uji (diambil dari `docs/prd.md` §12, PRD JobFill lama): Greenhouse · Lever · Workday · Ashby · Jobstreet · Glints · Kalibrr · LinkedIn Easy Apply · Google Forms (form buatan HR) · satu form kustom perusahaan (TBD sebelum Day 8). Workday sengaja dimasukkan meski diperkirakan paling sering gagal, supaya batas kemampuan terukur, bukan diasumsikan.

## 11. Open questions

**Resolved for this sprint**

| Pertanyaan | Resolusi |
|---|---|
| Nama produk | job-kit (nama repo). "JobFill" tidak dipakai. |
| Label dwibahasa sejak awal? | Ya, Indonesia dan Inggris (FR-13). |
| Satu atau banyak profil? | Satu profil. Banyak profil di luar v1. |
| Batas jumlah Captured Jobs | Tidak relevan; Captured Jobs di luar v1. |
| Sprint ini nyata atau portfolio? | Portfolio solo; 20 jam dan Day 10 jadi panduan, bukan batas keras. |
| Tagline | "Ketik sekali, lamar di mana saja." Disetujui PIC 2026-10-09. |
| Acuan nada | Duolingo. Disetujui PIC 2026-10-09. |
| Posisi maskot | Hanya di empty state, error, dan hasil. Disetujui PIC 2026-10-09. |
| Display type | Tetap 17px panel / 28px options. Diputuskan PIC 2026-10-09. |
| Daftar situs uji §10 | Dipakai dari `docs/prd.md` §12; 9 situs pasti, 1 form kustom TBD. |

**Genuinely open** (tidak memblokir APPROVED)

| Pertanyaan | Owner | Tanggal |
|---|---|---|
| Nilai token mode gelap (di luar v1; ditunda) | imelda | setelah v1 |
| Form kustom perusahaan ke-10 untuk metrik §10 | imelda | sebelum Day 8 |
