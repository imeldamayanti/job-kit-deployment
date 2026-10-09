# Screens & States — JobFill

**Turunan dari:** `docs/prd.md` §6, §7
**Dibaca oleh:** `docs/design-system.md` (§4 daftar komponen adalah batas atasnya)
**Tanggal:** 2026-09-02

Dokumen ini memecah dua permukaan di PRD §6 menjadi layar konkret, state per layar, dan komponen yang benar-benar muncul. **§4 adalah kontraknya**: komponen yang tidak ada di daftar itu tidak dibuat di design system.

---

## 1. Peta permukaan

```
Side panel (400px)                    Options page (lebar penuh)
├─ Tab Autofill  ─── 8 state          ├─ Profile ─── 7 sub-bagian
└─ Tab Profile   ─── 3 state          ├─ Captured Jobs ─── 4 state
                                      └─ Data ─── 5 state
        │                                      ▲
        └── tombol Edit Profile ───────────────┘
            (chrome.tabs.create → options.html#profile)
```

Dua permukaan ini **tidak** berbagi layout, tapi **harus** berbagi token. Yang berbeda hanya skala spacing dan kepadatan; warna, type scale, radius, dan bahasa status wajib sama — kalau tidak, tombol "Fill" di panel dan tombol "Import" di options page akan terlihat seperti dua produk.

---

## 2. Side panel

Lebar tetap ±400px. Tinggi = tinggi viewport browser. Tidak ada horizontal scroll, pernah.

### 2.1 Kerangka tetap (ada di semua state)

| Bagian | Isi | Catatan |
|---|---|---|
| Header | Logo/nama + tab switcher (Autofill · Profile) | Tinggi tetap, tidak ikut scroll |
| Body | Isi per state | Satu-satunya area yang scroll |
| Footer aksi | Tombol primer, hanya pada state yang punya aksi | Sticky di bawah, bukan ikut scroll — tombol Fill tidak boleh hilang di bawah lipatan |

### 2.2 Tab Autofill — 8 state

Semua state di bawah ini nyata dan harus digambar. Ini bagian tersulit dari produk: kegagalan senyap dilarang (PRD §10).

| # | State | Pemicu | Isi | Aksi |
|---|---|---|---|---|
| A1 | `no-form` | Halaman aktif tidak punya form dikenali | Empty state: ikon kecil, satu kalimat, saran buka halaman lamaran | — |
| A2 | `detected` | Form terdeteksi, semua field terpetakan | Site header (favicon + domain + judul halaman), summary bar "12 dari 12 field cocok", field preview list | **Fill** |
| A3 | `partial` | Sebagian field tak terpetakan | Sama seperti A2 + section "Tidak dikenali (3)" berisi baris field dengan tombol "Petakan" | **Fill** + petakan manual |
| A4 | `filling` | Setelah klik Fill | Field preview list dengan indikator progres per baris | — (disabled) |
| A5 | `filled` | Pengisian selesai | Banner sukses "9 field terisi", field preview list dalam mode hasil, kartu simpan lowongan | **Undo** (sekunder) + **Simpan lowongan** (primer) |
| A6 | `incomplete-profile` | Field terdeteksi tapi profil kosong untuk key itu | Daftar field yang datanya belum ada, tiap baris punya deep-link ke sub-bagian profil | **Lengkapi profil** |
| A7 | `error` | Content script gagal inject | Pesan sebab spesifik + apa yang bisa dilakukan | **Coba lagi** |
| A8 | `permission-required` | Halaman belum diberi izin akses oleh pengguna | Nama domain + satu kalimat kenapa izin dibutuhkan + apa yang tidak dilakukan extension | **Beri izin untuk situs ini** |

Catatan yang menentukan desain:

- **A2 dan A3 satu layout, bukan dua.** A3 = A2 + satu section tambahan. Kalau digambar sebagai dua layar terpisah, transisi antara keduanya jadi cut, padahal cuma section muncul.
- **A4 hampir tidak terlihat** (pengisian <2 detik untuk form biasa). Tapi harus ada, karena form 40 field di halaman berat bikin panel terlihat hang tanpa ini.
- **A6 bukan varian error.** Ini state paling sering ditemui pengguna baru, dan satu-satunya state yang tugasnya membawa orang ke options page. Perlakukan sebagai jalur onboarding, bukan sebagai kegagalan.
- **A7 punya minimal 4 sebab berbeda** (halaman `chrome://`, PDF viewer, iframe cross-origin, script diblokir CSP situs). Satu template pesan dengan slot sebab + slot saran, bukan empat layar.
- **A8 bukan varian A7, dan bukan A1.** Bedanya bukan kosmetik: A7 adalah kegagalan teknis yang tidak bisa diselesaikan pengguna selain pindah halaman, sedangkan A8 punya tepat satu tindakan yang menyelesaikannya. Kalau A8 tidak digambar, kasus ini akan jatuh ke A1 `no-form` — panel bilang "tidak ada form di halaman ini" padahal formnya ada dan hanya izinnya belum diberikan. Itu persis kegagalan senyap yang dilarang PRD §10.
- **A8 dipicu oleh Chrome juga**, bukan cuma Safari. Model izin Safari yang per-situs ("Allow for One Day" / "Always Allow on This Website") membuatnya sering, tapi PRD §9.2 memang memilih `activeTab` tanpa `<all_urls>` di kedua browser. Rinciannya di `docs/adr-safari.md` §S2.
- **A8 adalah tempat klaim privasi dibayar, bukan cuma diucapkan.** Ini satu-satunya layar yang muncul tepat saat pengguna diminta memberi akses ke sebuah situs; menyebut apa yang **tidak** dilakukan extension (tidak membaca `password`, tidak submit, tidak mengirim ke server) di sini lebih berguna daripada di halaman Data.

### 2.3 Tab Profile — 3 state

| # | State | Isi | Aksi |
|---|---|---|---|
| P1 | `empty` | Profil belum diisi sama sekali. Satu kalimat + alasan kenapa perlu | **Isi profil sekarang** |
| P2 | `partial` | Ada data tapi ada bagian kosong. Identity header + section count list, bagian kosong ditandai | **Edit Profile** |
| P3 | `complete` | Semua bagian terisi. Identity header + section count list | **Edit Profile** |

Isi P2/P3: nama + email di atas, lalu daftar 7 bagian dengan jumlah entri ("Work Experience · 3", "Skill · 12", "Contact & Address · belum diisi").

Read-only, sesuai PRD §6.1. Satu-satunya interaksi adalah tombol yang membuka options page.

---

## 3. Options page

Lebar penuh. Nav kiri tetap, konten kanan scroll. Max-width konten ±880px — form entry tidak boleh selebar monitor 27 inci.

### 3.1 Profile — 7 sub-bagian

Dua bentuk saja, dan ini penyederhanaan penting:

**Bentuk A — form tunggal** (Personal Info, Contact & Address)
Field statis, satu kali isi. Layout dua kolom di lebar penuh, satu kolom di bawah 720px.

**Bentuk B — daftar entri** (Custom Field, Education, Work Experience, Skill, Additional)
Kumpulan kartu entri yang bisa ditambah, diubah urutan, dan dihapus.

| State bentuk B | Isi |
|---|---|
| `empty` | Kartu putus-putus + "Tambah pengalaman pertama" |
| `list` | Daftar kartu entri (collapsed: ringkasan satu baris) |
| `editing` | Satu kartu expanded jadi form, kartu lain tetap collapsed |
| `saving` | Indikator "menyimpan…" → "tersimpan" (FR-PROF-03) |

Skill adalah pengecualian bentuk B: entrinya terlalu kecil untuk kartu. Bentuknya tag/chip input dengan grup (teknis / bahasa / lainnya).

**Sidebar Profile menampilkan kelengkapan per bagian** (FR-PROF-05) — bukan hiasan, ini yang bikin orang mengisi Contact & Address sebelum mengeluh autofill-nya meleset.

### 3.2 Captured Jobs — 4 state

| # | State | Isi |
|---|---|---|
| J1 | `empty` | Belum ada lamaran tersimpan. Jelaskan bahwa entri muncul otomatis setelah autofill |
| J2 | `list` | Toolbar (search + filter status) + daftar baris lamaran |
| J3 | `filtered-empty` | Filter tidak menghasilkan apa-apa. **Bukan J1** — di sini aksinya "reset filter", bukan penjelasan |
| J4 | `detail` | Satu lamaran dibuka: metadata + snapshot field yang diisi saat itu (FR-JOB-03) + editor status & notes |

J4 bisa berupa panel samping (slide-over) atau halaman terpisah. Slide-over lebih pas: pengguna biasanya membandingkan beberapa lamaran berturut-turut.

### 3.3 Data — 5 state

| # | State | Isi |
|---|---|---|
| D1 | `idle` | Tiga kartu aksi: Export, Import, Hapus semua. Plus ringkasan storage |
| D2 | `import-preview` | Setelah file dipilih: pratinjau apa yang berubah + pilihan **Ganti** / **Gabung** (FR-DATA-02) |
| D3 | `import-error` | File tidak valid atau versi tidak dikenali, dengan sebab spesifik (FR-DATA-04) |
| D4 | `confirm-destructive` | Konfirmasi hapus semua — mengetik ulang kata konfirmasi, bukan cuma tombol OK |
| D5 | `done` | Konfirmasi berhasil, dengan angka ("112 entri diimpor") |

Halaman ini juga tempat kalimat jujur soal enkripsi (PRD §9.3): data tersimpan tanpa enkripsi di storage browser.

---

## 4. Daftar komponen — kontrak untuk design system

Diturunkan dari §2 dan §3. **Ini batas atasnya.** Komponen di luar daftar ini tidak dibuat.

### 4.1 Primitif (dipakai di dua permukaan)

| Komponen | Varian | Muncul di |
|---|---|---|
| Button | primary, secondary, ghost, destructive · sm/md · disabled, loading | semua |
| Text input | default, error, disabled · dengan/tanpa label & helper | Profile, Data |
| Textarea | auto-grow | Work Exp, Education, notes |
| Select | native-styled | Personal, Work Exp |
| Date input | bulan-tahun & tanggal penuh | Education, Work Exp |
| Checkbox | default, indeterminate | field toggle, "masih bekerja di sini" |
| Chip / Tag | statis, removable, input | Skill, filter |
| Status badge | applied, in-review, rejected, offer, unmapped | Captured Jobs, field list |
| Icon button | sm | hapus entri, expand, undo |
| Toast / inline alert | success, warning, error, info | seluruh aksi |
| Empty state | ikon + judul + body + aksi opsional | A1, A7, A8, P1, J1, J3, bentuk B |
| Section header | judul + count + aksi kanan | Profile, panel |
| Divider | — | semua |

### 4.2 Khusus side panel

| Komponen | Kenapa khusus |
|---|---|
| Tab switcher | Segmented 2-item, full-width 400px |
| Site header | Favicon + domain + judul terpotong. Pola truncation-nya sendiri |
| Summary bar | "9 dari 12 field cocok" + progress. Padat, satu baris |
| **Field preview row** | Baris `label → value` dengan checkbox toggle + badge status. **Komponen paling sering muncul di produk ini** (A2–A6), dan yang paling gampang kelewat kalau design system dibikin dari referensi dashboard |
| Field mapping picker | Dropdown pilih key profil untuk field tak dikenal (FR-FILL-06) |
| Save-job card | Kartu inline di A5, field bisa dikoreksi |
| Sticky action footer | Menahan tombol Fill/Undo di bawah |

### 4.3 Khusus options page

| Komponen | Catatan |
|---|---|
| Sidebar nav | Grup + item + indikator kelengkapan |
| Entry card | collapsed (ringkasan 1 baris) / expanded (form) + handle urutan |
| Data table row | Captured Jobs list |
| Slide-over panel | J4 detail |
| Toolbar | search + filter chips |
| Confirm dialog | destructive, dengan input konfirmasi |
| File drop zone | Import |

### 4.4 Yang **tidak** dibuat

Ditulis eksplisit supaya tidak menyelinap masuk dari referensi:

Kanban board · avatar group · chart/grafik · notifikasi bell · command palette · modal bertumpuk · carousel · rich text editor · date range picker · pagination (daftar cukup pakai scroll sampai volumenya terbukti besar).

---

## 5. Yang harus dijawab design system

Bukan daftar token generik — ini pertanyaan yang lahir dari layar di atas:

1. **Density dua permukaan.** Satu spacing scale, dua density mode? Atau dua scale? Panel 400px dengan 12 baris field tidak muat pakai spacing dashboard.
2. **Bahasa status.** Ada dua sumbu status yang berbeda dan gampang tertukar: status field (mapped / unmapped / filled / skipped) dan status lamaran (applied / in-review / rejected / offer). Warnanya tidak boleh saling meminjam.
3. **Truncation.** Judul lowongan, nama perusahaan, dan value field semua bisa panjang di 400px. Perlu aturan tetap: berapa baris, di mana ellipsis, kapan pakai tooltip.
4. **Dark mode.** Side panel menempel di jendela browser; kalau Chrome-nya dark dan panelnya putih terang, terasa asing. Rekomendasi: dark mode wajib untuk panel sejak awal, bukan ditambal nanti.
5. **Kepadatan type di 400px.** Ukuran terkecil yang masih terbaca dan tetap lolos aksesibilitas.

---

## 6. Berikutnya

`docs/design-system.md` + `docs/design-system.html`, dibatasi ke §4, dan menjawab lima pertanyaan §5. Preview HTML harus menampilkan komponen di lebar 400px **dan** lebar penuh berdampingan — token yang bagus di dokumen bisa hancur di panel.
