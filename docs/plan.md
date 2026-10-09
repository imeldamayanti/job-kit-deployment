# Plan — job-kit

Pengganti P5: backlog lokal, tanpa Jira dan tanpa CSV. Sumber: `docs/02-prd.md` (APPROVED) dan `docs/03-rfc.md` (APPROVED).
Aturan tetap berlaku: maksimal 18 tiket, total ≤20 jam, tiap tiket ≤2 jam, walking skeleton selesai dalam 8 jam pertama.

**Total estimasi: 21.0 jam · 16 tiket** (video demo dibuang atas keputusan PIC; T16 ditambah 2026-10-09 atas permintaan PIC dan melewati 20 jam sebesar 1 jam. PRD §11 menyebut 20 jam sebagai panduan, bukan batas keras.)
**Walking skeleton: T01–T05 = 7.0 jam**

Status: `[ ]` belum · `[~]` jalan · `[x]` selesai (centang AC satu per satu).

---

## Phase 1 — Foundation

### T01 · Scaffold dan build terpasang · 1h · setup · Highest
- [x] **T01 selesai**

**Context:** RFC §6 Phase 1; retire risiko build sebelum fitur.
**Acceptance criteria**
- [x] `npm run build` selesai tanpa error dan menghasilkan `.output/chrome-mv3/` (RFC §5 risiko ke-4 terjawab)
- [x] Ekstensi bisa dimuat sebagai unpacked di Chrome (diuji di Chrome for Testing)
- [ ] Klik ikon toolbar membuka side panel (belum terverifikasi: klik ikon tidak bisa disimulasikan headless; cek manual)
- [x] Halaman options terbuka di tab baru dari panel (FR-17, sebagian)
- [x] `npm test` berjalan (satu tes contoh lulus)
- [x] Token `design-system.md` ada sebagai `@theme` di `src/assets/tailwind.css`; folder `core/jobs` dan `core/portability` yang kosong sudah dihapus

**Done when:** build dimuat di Chrome dan kedua halaman kosong terbuka.

---

## Phase 2 — Walking skeleton (Day 5)

### T02 · Profil Personal Info dengan simpan otomatis · 1.5h · feature · Highest
- [x] **T02 selesai**

**Context:** S3 minimum; `core/profile` + `platform/storage` + `useProfile`.
**Acceptance criteria**
- [x] Pengguna dapat mengisi, mengubah, dan menghapus data Personal Info (FR-01)
- [x] Setelah satu field diubah, indikator "Tersimpan" terlihat dalam 2 detik (FR-03)
- [x] Setelah halaman dimuat ulang, nilai tetap ada (FR-01)

**Done when:** profil Personal Info bertahan setelah reload.

### T03 · Scan form dan daftar field di panel · 1.5h · feature · Highest
- [x] **T03 selesai**

**Context:** S1 minimum; content script + `platform/messaging` + scan field.
**Acceptance criteria**
- [x] Panel menampilkan nama domain halaman aktif (FR-05)
- [x] Pada satu fixture HTML, panel menampilkan semua field form yang terbaca
- [x] Panel menampilkan "Tidak ada form di halaman ini" bila halaman tanpa form

**Done when:** membuka fixture menampilkan domain dan daftar field-nya di panel.

### T04 · Pemetaan label Indonesia dan Inggris · 1.5h · feature · Highest
- [x] **T04 selesai**

**Context:** `core/matching`; inti produk dan penentu metrik §10.
**Acceptance criteria**
- [x] Form berlabel "Nama Lengkap" dan "Full Name" sama-sama terpetakan ke nilai profil (FR-13)
- [x] Panel menampilkan pasangan field → nilai sebelum pengisian (FR-08, sebagian)
- [x] Form uji dengan 10 field dan 7 cocok menampilkan "7 dari 10 field cocok" (FR-07)
- [x] Field tak terpetakan muncul di daftar "Dilewati"
- [x] Heuristik membaca `label[for]`, label pembungkus, `aria-label`, `placeholder`, dan `autocomplete`

**Done when:** pratinjau fixture menampilkan pasangan field dan nilai serta ringkasan "N dari M".

### T05 · Fill, Undo, dan ringkasan hasil · 1.5h · feature · Highest
- [x] **T05 selesai**

**Context:** `core/fill` + penulisan nilai di content script.
**Acceptance criteria**
- [x] Tidak ada field yang berubah sebelum tombol Fill ditekan (FR-09)
- [x] Setelah Fill, form berbasis React menerima nilai dan nilai tidak hilang saat fokus pindah (FR-10)
- [x] Undo mengembalikan semua field yang diisi ke nilai sebelumnya (FR-11)
- [x] Pada form login uji, field password tetap kosong dan tidak ada submit (FR-12)
- [x] Panel menampilkan "9 field terisi · 1 dilewati" untuk fixture 9 cocok dan 1 dilewati (FR-19)
- [x] Tombol footer berganti dari "Fill" ke "Undo" setelah pengisian

**Done when:** satu klik mengisi fixture, Undo mengembalikannya, ringkasan tampil.

---

## Phase 3 — Fitur penuh

### T06 · Toggle per field dan field sudah berisi · 1h · feature · Medium
- [x] **T06 selesai**

**Context:** S1 penuh bagian "Akan diisi"; PRD §8.
**Acceptance criteria**
- [x] Mematikan satu field membuat field itu tidak berubah setelah Fill (FR-08)
- [x] Field yang sudah berisi tulisan pengguna ditandai "Sudah berisi" dengan pilihan timpa atau lewati; bawaannya lewati (PRD §8)
- [x] Fill kedua mengganti nilai yang sama, dan Undo tetap mengembalikan ke nilai sebelum Fill pertama (PRD §8)
- [x] Setelah halaman dimuat ulang, Undo tidak tersedia dan panel menyatakan nilai awal sudah tidak tersimpan (PRD §8)

**Done when:** keempat perilaku di atas terlihat di fixture.

### T07 · Contact & Address, Custom Field, navigasi options · 1.5h · feature · Medium
- [x] **T07 selesai**

**Context:** S3; navigasi kiri satu grup Profile.
**Acceptance criteria**
- [x] Contact & Address dapat dibuat, diubah, dan dihapus, dan bertahan setelah reload (FR-01)
- [x] Pengguna dapat menambah pasangan key–value kustom, dan form yang menanyakannya terisi (FR-04)
- [x] Navigasi kiri hanya memuat bagian yang ada di v1; tidak ada Additional, Captured Jobs, atau Data (PRD §6.6 butir 13)
- [x] Form dua kolom tidak meluber keluar kartu (PRD §6.6 butir 14)

**Done when:** tiga bagian profil terisi dan Custom Field memengaruhi hasil Fill.

### T08 · Education dan Work Experience · 2h · feature · Medium
- [x] **T08 selesai**

**Context:** S3; kartu entri bisa tambah, hapus, ubah urutan.
**Acceptance criteria**
- [x] Pengguna dapat menambah 3 entri, mengubah urutan, memuat ulang, dan urutannya sama (FR-02)
- [x] Work Experience punya pilihan "Masih bekerja di sini"
- [x] Kartu terlipat menampilkan ringkasan satu baris
- [x] Education kosong menampilkan "Belum ada riwayat pendidikan" dan tombol "Tambah pendidikan pertama"

**Done when:** entri tersimpan, terurut, dan terlipat dengan benar setelah reload.

### T09 · Tab Profile di panel dan profil kosong · 1h · feature · Medium
- [x] **T09 selesai**

**Context:** S2; satu-satunya jalan ke halaman edit.
**Acceptance criteria**
- [x] Panel punya dua tab, Autofill dan Profile; tab Profile menampilkan nama, email, dan jumlah entri per bagian (FR-17)
- [x] Klik "Edit Profile" membuka halaman edit di tab baru tanpa memuat situs eksternal (FR-17)
- [x] Profil kosong total menampilkan "Profil masih kosong" dan tombol "Isi profil sekarang"; Fill tidak aktif dan menyebut sebabnya (PRD §8)
- [x] Field yang datanya kosong di profil ditandai dan ditaut "Isi →" ke bagian profil terkait (PRD §8)

**Done when:** panel berpindah antar tab dan profil kosong menampilkan ajakan.

### T10 · Izin situs, ikut tab aktif, dan state gagal · 2h · feature · Medium
- [x] **T10 selesai**

**Context:** RFC D5; PRD §8; risiko RFC §5 ke-3.
**Acceptance criteria**
- [x] Pada situs yang belum diizinkan, panel menyebut nama domain dan menampilkan "Beri izin untuk situs ini", dan tidak menampilkan "Tidak ada form" (FR-18, PRD §8)
- [x] Setelah izin diberikan, field langsung terdeteksi tanpa muat ulang manual
- [x] Pindah tab atau halaman membuat daftar field milik halaman baru, bukan yang lama (FR-06)
- [x] Halaman browser internal dan PDF: panel menyebut sebabnya dan tanpa tombol Fill (PRD §8). Halaman browser internal terbukti E2E; cabang PDF hanya lewat tes unit (Chrome headless tidak punya penampil PDF), cek manual disarankan.
- [x] Form di frame terkunci: panel menyebut form tidak bisa diisi dan tidak mencoba mengisinya (PRD §8)

**Done when:** semua lima state tampil benar di situs uji.

### T11 · Penyimpanan penuh dan maskot · 1.5h · polish · Medium
- [x] **T11 selesai**

**Context:** S1 dan S3 decorative; RFC D2.
**Acceptance criteria**
- [x] Saat penyimpanan penuh, pengguna melihat "Tidak tersimpan — penyimpanan penuh. Data lama aman." dan data lama tetap ada (PRD §8)
- [x] Maskot tampil hanya di empty state, error, dan ringkasan hasil (PRD §6.6 butir 9)
- [x] Ada tiga state maskot yang dipakai: netral, error, berhasil
- [x] Judul ukuran 17px (panel) dan 28px (options)

**Done when:** state penyimpanan penuh dan ketiga maskot terlihat di layar yang tepat.

### T12 · Uji 10 situs dan setel pemetaan · 1.5h · feature · Medium
- [~] **T12 sebagian** (6 dari 10 situs terukur; lihat `docs/site-results.md`)

**Context:** PRD §10; risiko RFC §5 ke-1.
**Acceptance criteria**
- [~] Hasil uji tiap situs dicatat di `docs/site-results.md`. Tercatat: Greenhouse (2), Lever (2), Ashby (2), Workable, dan satu form kustom (Intikom). Belum: Workday, Jobstreet, Glints, Kalibrr, LinkedIn Easy Apply (butuh login), Google Forms (butuh URL)
- [x] Angka akhir "N dari M field terpetakan benar" tercatat dan dibandingkan dengan target ≥70%
- [x] Sinonim label yang ditambah dari hasil uji punya tes di `core/matching`

**Done when:** `docs/site-results.md` berisi angka metrik §10.

### T13 · Pencocokan longgar dropdown dan radio · 1h · feature · Medium · `cut-list`
- [x] **T13 selesai**

**Context:** FR-14; urutan potong nomor 3.
**Acceptance criteria**
- [x] Form uji dengan opsi "Male" memilih opsi itu untuk profil "Laki-laki" (FR-14)
- [x] Radio dan dropdown dengan teks opsi berbeda bahasa tetap cocok

**Done when:** gender dan jenjang pendidikan terpilih di fixture dropdown dan radio.

---

## Launch

### T14 · Paket build bersih · 0.5h · launch · Medium
- [x] **T14 selesai**

**Context:** pengganti "deploy ke produksi"; tidak ada hosting.
**Acceptance criteria**
- [x] `npm run zip` menghasilkan satu berkas zip
- [x] Zip dimuat di profil Chrome bersih dan alur utama (isi profil → Fill → Undo) berjalan (diuji dari isi zip yang diekstrak, di profil Chrome for Testing baru; instal manual lewat Load unpacked tetap perlu dicoba sekali oleh pengguna)

**Done when:** zip terpasang di profil bersih dan alur utama lulus.

### T15 · README · 0.5h · launch · Medium
- [x] **T15 selesai**

**Acceptance criteria**
- [x] README menjelaskan apa itu job-kit, cara pasang unpacked, dan cara pakai dalam tiga langkah
- [x] README menyatakan dengan jelas apa yang tidak dilakukan (tanpa akun, tanpa AI, tanpa telemetri)

**Done when:** orang lain bisa memasang dan memakai dari README saja.

---

## Tambahan atas permintaan PIC (2026-10-09)

### T16 · Tandai field yang belum terisi dengan outline kuning · 1.5h · feature · Medium
- [ ] **T16 selesai**

**Context:** JobFill lama menandai field yang tidak terisi dengan outline kuning di halaman, supaya pengguna langsung tahu mana yang harus diisi sendiri. job-kit baru menampilkan daftar di panel, tetapi tidak menandai halamannya. Dokumen JobFill lama tidak mendefinisikan perilaku ini, jadi rinciannya di bawah adalah asumsi yang perlu dikonfirmasi PIC.

**Asumsi (konfirmasi PIC sebelum dikerjakan)**
1. **Kapan:** outline muncul setelah Fill ditekan, bukan saat panel baru membaca halaman. Ini menjaga prinsip FR-09 bahwa halaman tidak berubah sebelum Fill.
2. **Field mana:** semua field yang masih kosong setelah Fill, yaitu yang tak terpetakan, yang datanya tidak ada di profil, dan yang dimatikan pengguna. Field yang berisi (oleh job-kit atau oleh pengguna) tidak ditandai. Pertanyaan esai yang tak terpetakan ikut ditandai; kalau terlalu ramai, bisa dibatasi ke field wajib.
3. **Warna:** amber dari token desain (`amber-600`, #DC6803), outline 2px dengan jarak 2px. Kalau PIC ingin kuning yang lebih terang, ganti warnanya; tidak ada konsekuensi lain.
4. **Hilang kapan:** dari satu field begitu pengguna mengisinya; semuanya saat Undo; dan saat halaman dimuat ulang.

**Perubahan dokumen yang ikut (butuh persetujuan PIC karena PRD dan RFC sudah APPROVED)**
- [ ] PRD: tambah **FR-20** (Should) di §7, satu baris di §8 ("Field yang tidak terisi setelah Fill ditandai di halaman"), satu catatan di §6.2 layar S1, dan tandai sebagai penambahan 2026-10-09.
- [ ] RFC §2: baris **Complexity ban** menyebut "tanpa UI yang disuntik ke halaman lamaran". Ubah menjadi "tanpa elemen baru di halaman lamaran; satu-satunya perubahan visual adalah outline pada field yang sudah ada".
- [ ] RFC §8: tambah keputusan **D9** dengan baris Cost (mengubah tampilan halaman milik situs lain; bisa bentrok dengan gaya situs; outline situs sendiri harus dipulihkan).
- [ ] Tabel cakupan di bawah: tambah baris FR-20 → T16.

**Acceptance criteria**
- [ ] Setelah Fill, setiap field yang masih kosong dan terlihat di halaman memiliki outline amber yang jelas (FR-20)
- [ ] Sebelum Fill ditekan, tidak ada field yang diberi outline (FR-09)
- [ ] Field yang terisi oleh job-kit, dan field yang sudah berisi teks pengguna, tidak diberi outline (FR-20)
- [ ] Outline sebuah field hilang begitu pengguna mengisinya (FR-20)
- [ ] Undo menghapus semua outline, dan outline milik situs sendiri pada field itu kembali seperti sebelumnya (FR-11, FR-20)
- [ ] Field tersembunyi tidak ditandai, dan jumlah elemen di halaman tidak bertambah (RFC §2)
- [ ] Panel memberi tahu bahwa field yang belum terisi ditandai di halaman, dengan kalimat yang ditulis ramah dan singkat (FR-20)
- [ ] Dropdown dan grup radio yang tidak terisi juga ditandai; untuk grup radio, yang ditandai adalah grupnya, bukan tiap tombol (FR-20)

**Done when:** setelah Fill di form uji dan di satu form sungguhan, field yang harus diisi sendiri langsung terlihat di halaman, dan Undo mengembalikan halaman seperti semula.

---

## Cakupan

**FR → tiket**

| FR | Tiket | FR | Tiket |
|---|---|---|---|
| FR-01 | T02, T07 | FR-11 | T05 |
| FR-02 | T08 | FR-12 | T05 |
| FR-03 | T02 | FR-13 | T04 |
| FR-04 | T07 | FR-14 | T13 |
| FR-05 | T03 | FR-15 | **dipotong** |
| FR-06 | T10 | FR-16 | **dipotong** |
| FR-07 | T04 | FR-17 | T01, T09 |
| FR-08 | T04, T06 | FR-18 | T10 |
| FR-09 | T05 | FR-19 | T05 |
| FR-10 | T05 | FR-20 (usulan) | T16 |

**Layar → tiket:** S1 Panel · Autofill → T03, T04, T05, T06, T10 · S2 Panel · Profile → T09 · S3 Options · Profile → T02, T07, T08, T11.

**Dipotong agar muat 20 jam (urutan PRD §9):**
1. **FR-16 Skill** (chip grup teknis / bahasa / lainnya). Tidak ada tiketnya; item Skill tidak ada di navigasi options.
2. **FR-15** (penanda bagian belum lengkap). Tidak ada tiketnya.

FR-14 (cut-list nomor 3) masih masuk sebagai T13. Kalau waktu habis di Day 8, T13 yang pertama dibuang, lalu T11 (bagian maskot).

**FR yang tidak tercakup tiket:** FR-15 dan FR-16, keduanya karena dipotong di atas.

**Bukan tiket:** studi kasus (checklist terpisah, bukan bagian backlog ini).
