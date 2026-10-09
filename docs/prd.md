# PRD — JobFill (Chrome Extension untuk Autofill Lamaran Kerja)

**Status:** Draft · Mode eksplorasi (bukan sprint harness)
**Tanggal:** 2026-09-02
**Penulis:** imelda
**Dokumen turunan:** `docs/design-system.md` (belum ada), mockup HTML per permukaan (belum ada)

---

## 1. Ringkasan

JobFill adalah Chrome extension yang mengisi form lamaran kerja secara otomatis dari satu profil terpusat yang dimiliki pengguna. Extension terdiri dari **side panel** (aksi cepat di halaman lowongan yang sedang dibuka) dan **halaman detail** di dalam extension itu sendiri (tempat mengelola profil, riwayat lamaran, dan data).

Prinsip utama: **data pengguna tidak pernah meninggalkan browser**. Tidak ada server, tidak ada akun, tidak ada login. Portabilitas dijamin lewat export/import file, bukan lewat sync.

---

## 2. Masalah

Melamar kerja berarti mengetik data yang sama berulang-ulang: nama, kontak, alamat, riwayat pendidikan, pengalaman kerja, skill. Satu pelamar aktif bisa mengisi 20–60 form dalam sebulan, di ATS yang berbeda-beda (Greenhouse, Lever, Workday, Jobstreet, Glints, form Google Form buatan HR).

Tiga hal yang bikin ini melelahkan:

1. **Pengulangan.** Data yang sama diketik ulang setiap kali, karena autofill bawaan browser hanya mengenal field standar (nama, email, alamat) dan tidak mengenal "tahun lulus", "IPK", "ekspektasi gaji", "notice period".
2. **Data tersebar.** Riwayat pengalaman kerja yang rapi ada di CV (PDF), tidak dalam bentuk yang bisa dicopy per field.
3. **Lupa sudah melamar ke mana.** Tidak ada catatan otomatis; pelamar mengandalkan email konfirmasi atau spreadsheet manual.

Autofill bawaan Chrome dan password manager menyelesaikan poin 1 hanya sebagian, dan tidak menyentuh poin 2 dan 3 sama sekali.

---

## 3. Pengguna sasaran

| Persona | Konteks | Kebutuhan utama |
|---|---|---|
| **Pelamar aktif** | Fresh graduate atau job-seeker yang melamar 5–20 posisi per minggu | Kecepatan isi form, catatan sudah melamar ke mana |
| **Pelamar pasif** | Sudah bekerja, melamar sesekali ketika ada lowongan menarik | Profil yang tetap akurat walau jarang dibuka, isi form sekali klik |

Bukan sasaran v1: recruiter, agency, pengguna yang butuh multi-profil untuk banyak orang.

---

## 4. Goals & Non-Goals

### 4.1 Goals

- **G1** — Mengisi form lamaran standar (nama, kontak, alamat, pendidikan, pengalaman, skill) dalam satu klik dari side panel.
- **G2** — Menyediakan satu tempat terpusat untuk menyimpan dan mengedit data lamaran, terstruktur per bagian.
- **G3** — Mencatat lowongan yang sudah di-autofill sebagai riwayat, tanpa pengguna harus mencatat manual.
- **G4** — Memberi jalan keluar data yang penuh: export dan import file, sehingga pengguna tidak terkunci.
- **G5** — Menjamin privasi secara arsitektural: tidak ada network call yang membawa data profil.

### 4.2 Non-Goals (v1)

- **NG1** — Tidak ada akun, login, atau sync antar device. Portabilitas lewat export/import.
- **NG2** — Tidak ada fitur AI: generate cover letter, compatibility check job-vs-profil, dan CV defense practice **tidak** dibuat di v1. Lihat §11 Roadmap.
- **NG3** — Tidak ada Kanban tracker dengan stage (applied → interview → offer). Captured jobs v1 adalah daftar riwayat, bukan pipeline board.
- **NG4** — Tidak ada parsing CV PDF menjadi profil otomatis.
- **NG5** — Tidak ada auto-submit. Extension mengisi, pengguna yang menekan tombol submit.
- **NG6** — v1 hanya Chromium (Chrome, Edge, Brave). **Safari bukan lagi "di luar scope", tapi target sesudah v1** dengan syarat masuk yang jelas — lihat AD-4 dan `docs/adr-safari.md`. Firefox tetap di luar scope.
- **NG7** — Tidak ada upload CV otomatis ke field `<input type="file">` (dibatasi kebijakan keamanan browser; lihat §9.3).

---

## 5. Keputusan arsitektural

Empat keputusan ini menentukan bentuk sisa dokumen. Masing-masing punya alasan dan biaya.

### AD-1 — Halaman detail adalah options page di dalam extension, bukan web app hosted

Halaman detail (`chrome-extension://<id>/options.html`) dibuka dari tombol **Edit Profile** di side panel. Tidak ada domain, tidak ada server, tidak ada deploy.

*Alasan:* menghapus seluruh kelas pekerjaan backend (auth, DB, hosting, kebijakan privasi server) dari v1, dan membuat klaim privasi di §9 benar secara struktural, bukan sekadar janji.

*Biaya:* tidak ada sync antar device, dan halaman tidak bisa dibagikan lewat URL. Diterima; migrasi ke web app hosted adalah pekerjaan v2 yang jelas batasnya (§11).

### AD-2 — Field matching bersifat rule-based, deterministik, tanpa LLM

Deteksi field memakai sinyal DOM: atribut `autocomplete`, `name`, `id`, `type`, `placeholder`, teks `<label>` yang terkait, dan `aria-label`. Hasilnya dipetakan ke key profil lewat tabel aturan.

*Alasan:* deterministik (hasil sama untuk form sama), berjalan offline, tidak butuh API key, tidak mengirim isi form ke pihak ketiga — yang mana adalah syarat G5.

*Biaya:* form yang memakai label non-standar atau widget kustom (Workday, beberapa ATS enterprise) akan meleset. Ini ditangani dengan mekanisme **field mapping override per-situs** (FR-FILL-06), bukan dengan AI.

### AD-3 — Semua penulisan data adalah user-initiated

Extension tidak pernah mengisi form tanpa pengguna menekan tombol, dan tidak pernah menekan submit. Deteksi form boleh berjalan otomatis (pasif, baca DOM); penulisan tidak.

*Alasan:* autofill diam-diam pada form lamaran berisiko mengirim data salah ke perusahaan sungguhan, dan tidak bisa di-undo setelah submit.

### AD-4 — Side panel adalah ketergantungan Chrome yang disadari, bukan asumsi lintas-browser

`chrome.sidePanel` tidak ada di Safari yang sudah rilis (per September 2026 masih di balik feature flag WebKit). Permukaan §6.1 karena itu **tidak** portabel, sementara sisa produk portabel hampir seluruhnya.

*Alasan menerimanya:* side panel yang tetap terbuka sambil pengguna berinteraksi dengan form adalah perilaku yang membuat state A5 `filled` (Undo + simpan lowongan) masuk akal. Menukarnya dengan popup demi portabilitas berarti membayar di permukaan yang paling sering dipakai, untuk browser yang belum jadi target.

*Biaya:* rilis Safari nanti butuh satu permukaan pengganti, dan pilihannya belum dibuat. Rinciannya di **`docs/adr-safari.md`** — termasuk kandidat pengganti, state izin baru (A8), dan syarat masuk NG6.

---

## 6. Permukaan & layar

Dua permukaan, karakternya berbeda jauh — dan pemisahan ini yang menentukan design system nanti.

### 6.1 Side panel (lebar ±400px, padat, banyak state)

Chrome Side Panel API. Dibuka lewat ikon toolbar. Dua tab.

**Tab A — Autofill**

| State | Kondisi | Isi layar |
|---|---|---|
| `no-form` | Halaman aktif tidak punya form yang dikenali | Pesan kosong + saran buka halaman lamaran |
| `detected` | Form terdeteksi, N field terpetakan dari M field | Nama situs, ringkasan "N dari M field cocok", daftar field yang akan diisi (bisa di-expand), tombol **Fill** |
| `partial` | Ada field yang tak terpetakan | Sama seperti `detected` + daftar field tak dikenal dengan opsi "petakan manual" |
| `filling` | Sedang menulis ke DOM | Progres per field |
| `filled` | Selesai | Ringkasan berapa yang terisi, tombol **Undo**, prompt simpan lowongan ke Captured Jobs |
| `incomplete-profile` | Profil belum punya data untuk field yang dibutuhkan | Daftar field kosong + link langsung ke bagian profil terkait |
| `error` | Content script gagal inject (halaman `chrome://`, PDF, iframe cross-origin terkunci) | Pesan sebab + tindakan yang bisa dilakukan |

**Tab B — Profile**

Preview read-only dari data profil: nama, headline, kontak ringkas, jumlah entri per bagian (mis. "3 pengalaman kerja", "12 skill"). Satu tombol utama: **Edit Profile** → membuka options page (§6.2) di tab baru.

*Alasan tab ini read-only:* panel 400px bukan tempat mengedit array pengalaman kerja. Preview di sini menjawab satu pertanyaan saja — "data saya masih benar tidak?" — sebelum menekan Fill.

### 6.2 Halaman detail / options page (lebar penuh)

Tiga bagian utama, navigasi kiri.

**1. Profile** — tujuh sub-bagian:

| Sub-bagian | Isi |
|---|---|
| Personal Info | Nama depan/tengah/belakang, tanggal lahir, jenis kelamin, kewarganegaraan, foto (opsional) |
| Custom Field | Pasangan key–value bebas buatan pengguna, untuk pertanyaan yang tidak masuk kategori mana pun (mis. "Ekspektasi gaji", "Notice period", "Nomor NPWP") |
| Contact & Address | Email, telepon, LinkedIn, portfolio/website, alamat lengkap (jalan, kota, provinsi, kode pos, negara) |
| Education | Daftar entri: institusi, jenjang, jurusan, IPK, tahun mulai–selesai, deskripsi |
| Work Experience | Daftar entri: perusahaan, posisi, tipe (full-time/intern/freelance), lokasi, tanggal mulai–selesai, "masih bekerja di sini", deskripsi |
| Skill | Daftar skill dengan level opsional; dikelompokkan (teknis / bahasa / lainnya) |
| Additional | Sertifikasi, penghargaan, organisasi, portfolio link tambahan, catatan bebas |

**2. Captured Jobs** — daftar lowongan yang pernah di-autofill: judul posisi, perusahaan, URL, tanggal, situs sumber, dan status yang bisa diubah manual (Applied / In Review / Rejected / Offer). Bisa difilter dan dicari. Baris bisa dibuka untuk melihat snapshot field apa saja yang diisi saat itu.

**3. Data** — export seluruh data ke satu file JSON, import dari file JSON, dan hapus semua data. Ditambah ringkasan pemakaian storage.

---

## 7. Functional requirements

Prioritas: **P0** wajib untuk rilis pertama, **P1** diharapkan, **P2** kalau sempat.

### 7.1 Side panel

| ID | P | Requirement |
|---|---|---|
| FR-PANEL-01 | P0 | Side panel terbuka lewat klik ikon extension, dan mempertahankan tab aktif terakhir (Autofill / Profile) antar sesi |
| FR-PANEL-02 | P0 | Tab Autofill menampilkan nama domain dan judul halaman yang sedang aktif |
| FR-PANEL-03 | P0 | Panel bereaksi terhadap perubahan tab aktif dan navigasi halaman — deteksi ulang, tidak menampilkan data halaman sebelumnya |
| FR-PANEL-04 | P0 | Tab Profile menampilkan preview read-only dan tombol Edit Profile yang membuka options page |
| FR-PANEL-05 | P1 | Panel menampilkan badge jumlah field terpetakan pada ikon toolbar ketika form terdeteksi |

### 7.2 Deteksi & pengisian

| ID | P | Requirement |
|---|---|---|
| FR-FILL-01 | P0 | Content script mendeteksi elemen form (`input`, `select`, `textarea`, `contenteditable`) pada halaman aktif, termasuk yang muncul setelah render (via `MutationObserver`) |
| FR-FILL-02 | P0 | Setiap field dipetakan ke key profil memakai sinyal: `autocomplete` → `name`/`id` → teks `<label>` → `aria-label` → `placeholder`, dengan urutan prioritas itu |
| FR-FILL-03 | P0 | Panel menampilkan pratinjau pasangan field → nilai **sebelum** pengisian; pengguna dapat mematikan field tertentu dari pengisian |
| FR-FILL-04 | P0 | Pengisian hanya berjalan setelah klik tombol Fill (AD-3), dan memicu event `input`/`change` agar framework (React, Vue) mendaftarkan nilainya |
| FR-FILL-05 | P0 | Undo mengembalikan seluruh field ke nilai sebelum pengisian, selama halaman belum di-reload |
| FR-FILL-06 | P1 | Field yang tidak terpetakan dapat dipetakan manual oleh pengguna, dan pemetaan itu disimpan per-origin sehingga berlaku pada kunjungan berikutnya |
| FR-FILL-07 | P1 | Field `select` dan `radio` dipetakan dengan pencocokan longgar terhadap teks opsi (mis. profil "Laki-laki" cocok dengan opsi "Male") |
| FR-FILL-08 | P2 | Field tanggal menyesuaikan format yang diminta form (`YYYY-MM-DD`, `MM/DD/YYYY`, tiga dropdown terpisah) |
| FR-FILL-09 | P0 | Extension tidak pernah menekan tombol submit, dan tidak mengisi field bertipe `password` |

### 7.3 Profil

| ID | P | Requirement |
|---|---|---|
| FR-PROF-01 | P0 | Tujuh sub-bagian §6.2 dapat dibuat, dibaca, diubah, dan dihapus |
| FR-PROF-02 | P0 | Education, Work Experience, Skill, dan Additional menerima banyak entri, dengan urutan yang bisa diatur pengguna |
| FR-PROF-03 | P0 | Perubahan tersimpan otomatis, dengan indikator "tersimpan" yang terlihat |
| FR-PROF-04 | P0 | Custom Field menerima pasangan key–value bebas dan ikut dipertimbangkan saat pemetaan field (FR-FILL-02) |
| FR-PROF-05 | P1 | Halaman menunjukkan kelengkapan profil (mis. "Contact & Address belum diisi") karena kelengkapan itu yang menentukan kualitas autofill |
| FR-PROF-06 | P1 | Validasi ringan pada field berformat (email, URL, telepon) — memperingatkan, tidak memblokir |

### 7.4 Captured jobs

| ID | P | Requirement |
|---|---|---|
| FR-JOB-01 | P0 | Setelah pengisian sukses, panel menawarkan menyimpan lowongan; judul, perusahaan, dan URL diisi otomatis dari halaman bila terbaca, dan dapat dikoreksi pengguna |
| FR-JOB-02 | P0 | Daftar captured jobs dapat dilihat, dicari, difilter berdasarkan status, dan dihapus |
| FR-JOB-03 | P1 | Setiap entri menyimpan snapshot field yang diisi saat itu, sehingga pengguna dapat melihat apa yang dikirimkan |
| FR-JOB-04 | P1 | Status entri dapat diubah manual (Applied / In Review / Rejected / Offer) |
| FR-JOB-05 | P1 | Panel memperingatkan bila URL halaman aktif sudah pernah tersimpan ("kamu sudah melamar ini 12 hari lalu") |

### 7.5 Data

| ID | P | Requirement |
|---|---|---|
| FR-DATA-01 | P0 | Export seluruh data (profil, captured jobs, mapping override, preferensi) ke satu file JSON berversi |
| FR-DATA-02 | P0 | Import file JSON, dengan pilihan **ganti** atau **gabung**, dan pratinjau apa yang akan berubah sebelum dijalankan |
| FR-DATA-03 | P0 | Hapus seluruh data, dengan konfirmasi eksplisit |
| FR-DATA-04 | P1 | Import menolak file yang versinya tidak dikenali dengan pesan yang jelas, bukan gagal diam-diam |
| FR-DATA-05 | P2 | Export terbatas: hanya profil, atau hanya captured jobs (CSV) |

---

## 8. Model data

Satu dokumen JSON di `chrome.storage.local`. Bentuk yang sama dipakai untuk export (FR-DATA-01).

```
JobFillData
├─ schemaVersion: number
├─ profile
│  ├─ personal        { firstName, middleName, lastName, dateOfBirth, gender, nationality, photo? }
│  ├─ customFields    [ { id, key, value } ]
│  ├─ contact         { email, phone, linkedin, website, portfolio }
│  ├─ address         { street, city, province, postalCode, country }
│  ├─ education       [ { id, institution, degree, field, gpa, startDate, endDate, description } ]
│  ├─ workExperience  [ { id, company, position, employmentType, location,
│  │                      startDate, endDate, isCurrent, description } ]
│  ├─ skills          [ { id, name, category, level? } ]
│  └─ additional      { certifications[], awards[], organizations[], links[], notes }
├─ capturedJobs       [ { id, title, company, url, origin, capturedAt,
│                         status, filledFields[], notes } ]
├─ siteOverrides      { [origin]: { [fieldSignature]: profileKey } }
└─ preferences        { activePanelTab, lastExportAt, locale }
```

Semua tanggal disimpan sebagai string ISO `YYYY-MM-DD`; `capturedAt` sebagai ISO 8601 lengkap. Contoh sintetis satu entri captured job:

```json
{ "id": "cj_01", "title": "Frontend Engineer", "company": "Contoh Karya",
  "url": "https://example.test/jobs/123", "origin": "https://example.test",
  "capturedAt": "2026-09-02T10:14:00+07:00", "status": "applied",
  "filledFields": [{ "label": "Email", "value": "nama@example.test" }], "notes": "" }
```

Catatan bentuk:

- **`schemaVersion` wajib ada sejak v1.** Tanpa itu, import file lama pada versi extension berikutnya tidak punya cara memutuskan apa yang harus dimigrasi (FR-DATA-04).
- **`filledFields` di captured job adalah snapshot, bukan referensi ke profil.** Profil berubah setelah lamaran dikirim adalah hal normal; riwayat harus tetap menunjukkan apa yang benar-benar dikirim saat itu.
- **`siteOverrides` dikunci per-origin, bukan per-URL.** Halaman lamaran punya URL berbeda tiap lowongan tapi struktur form yang sama.

---

## 9. Privasi & keamanan

### 9.1 Klaim
Data profil tidak pernah dikirim ke server mana pun. Extension tidak melakukan network request yang membawa data pengguna.

### 9.2 Bagaimana klaim itu ditegakkan
- Tidak ada backend (AD-1), sehingga tidak ada endpoint yang bisa dituju.
- Tidak ada LLM call (AD-2), sehingga isi form tidak dikirim ke pihak ketiga.
- Permission Chrome dibatasi seminimal mungkin: `storage`, `sidePanel`, `activeTab`, `scripting`. **Tidak** meminta `<all_urls>` host permission secara luas; content script di-inject on-demand pada tab aktif ketika pengguna membuka panel. (Sikap ini juga yang paling cocok dengan model izin per-situs Safari; konsekuensi UX-nya di `adr-safari.md` §S2.)
- Field `password` tidak pernah dibaca maupun ditulis (FR-FILL-09).

### 9.3 Batasan yang diketahui
- Upload file CV ke `<input type="file">` tidak bisa dilakukan tanpa interaksi pengguna langsung — ini batasan keamanan browser, bukan pilihan desain. Diakui sebagai NG7.
- Iframe cross-origin yang di-sandbox tidak bisa diisi. Beberapa ATS menaruh formnya di iframe; kasus ini masuk state `error` (§6.1) dengan pesan yang jujur, bukan gagal diam-diam.
- Data tersimpan tanpa enkripsi di `chrome.storage.local`. Siapa pun dengan akses ke profil Chrome pengguna bisa membacanya. Ini perlu dinyatakan di halaman Data, bukan disembunyikan.

---

## 10. Kriteria sukses

| Metrik | Target | Cara ukur |
|---|---|---|
| Cakupan pemetaan | ≥70% field terpetakan pada 10 situs lamaran uji | Uji manual terhadap daftar situs di §12 |
| Waktu isi form | <10 detik dari buka panel sampai form terisi | Stopwatch, form ukuran sedang (±15 field) |
| Pengulangan pakai | Pengguna menyimpan ≥3 captured jobs dalam minggu pertama | Data lokal (tidak dilaporkan; ditanyakan saat uji pengguna) |
| Kegagalan senyap | Nol. Setiap kegagalan punya state yang terlihat | Review state matrix §6.1 |

Extension ini tidak mengirim telemetri. Metrik di atas diukur lewat uji manual dan wawancara pengguna, bukan analytics.

---

## 11. Roadmap sesudah v1

Tiga fitur dari diskusi awal ditunda, bukan dibatalkan. Masing-masing punya syarat masuk yang jelas:

| Fitur | Syarat masuk | Dampak arsitektur |
|---|---|---|
| **Generate cover letter** | Autofill sudah stabil di ≥10 situs | Butuh LLM call → membatalkan klaim §9.1 apa adanya; perlu kebijakan privasi baru dan API key pengguna sendiri |
| **Compatibility check** (job requirement vs profil) | Captured jobs sudah menyimpan teks deskripsi lowongan | Perlu ekstraksi teks lowongan, yang saat ini tidak dilakukan |
| **CV defense practice** | Produk terpisah, bukan permukaan panel | Butuh dashboard lebar dan sesi percakapan — kandidat untuk web app hosted |
| **Kanban tracker** | Captured jobs sudah dipakai rutin dan statusnya terasa kurang | Naik dari daftar ke board; perubahan UI, bukan perubahan data |
| **Sync antar device** | Ada permintaan nyata dari pengguna | Membatalkan AD-1: butuh akun, backend, dan kebijakan privasi |

Hook arsitektur yang disiapkan sejak v1: navigasi side panel dibuat menerima tab ketiga tanpa mengubah layout, dan `capturedJobs[].notes` menampung teks bebas yang nanti bisa jadi tempat deskripsi lowongan.

---

## 12. Situs uji

Pemetaan diuji terhadap daftar tetap agar perubahan aturan bisa dibandingkan antar versi:

Greenhouse · Lever · Workday · Ashby · Jobstreet · Glints · Kalibrr · LinkedIn Easy Apply · Google Forms (form buatan HR) · satu form kustom perusahaan.

Workday sengaja dimasukkan meski diperkirakan paling sering gagal — supaya batas AD-2 terukur, bukan diasumsikan.

---

## 13. Pertanyaan terbuka

1. **Nama produk.** "JobFill" di dokumen ini adalah nama kerja, belum diputuskan.
2. **Bahasa antarmuka.** Situs lamaran Indonesia memakai label bahasa Indonesia dan Inggris bercampur. Apakah aturan pemetaan harus dwibahasa sejak v1? Kecenderungan: ya, karena inilah pembeda dari autofill Chrome bawaan.
3. **Multi-profil.** Satu pengguna kadang punya dua "versi diri" (mis. melamar sebagai designer vs sebagai developer) dengan ringkasan dan urutan skill berbeda. Model data §8 saat ini hanya menampung satu profil. Menambahkannya nanti berarti migrasi schema.
4. **Batas captured jobs.** `chrome.storage.local` punya kuota. Berapa entri sebelum perlu peringatan?

---

## 14. Berikutnya

Urutan yang disepakati di diskusi awal:

1. PRD (dokumen ini) ✅
2. **Flow & screens** — petakan setiap layar dan state dari §6 menjadi daftar konkret
3. **Design system** — dibuat dari referensi visual, dibatasi hanya ke komponen yang muncul di langkah 2
4. **Mockup** — satu artifact HTML per permukaan (side panel 400px, options page lebar penuh)

Design system dibuat *setelah* daftar layar ada, supaya token dan komponen yang lahir memang yang terpakai — dan supaya constraint side panel 400px ikut membentuknya, bukan ditambal belakangan.
