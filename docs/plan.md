# Plan — job-kit

Pengganti P5: backlog lokal, tanpa Jira dan tanpa CSV. Sumber: `docs/02-prd.md` (APPROVED) dan `docs/03-rfc.md` (APPROVED).
Aturan tetap berlaku: maksimal 18 tiket, total ≤20 jam, tiap tiket ≤2 jam, walking skeleton selesai dalam 8 jam pertama.

**Total estimasi: 58.5 jam · 38 tiket** (video demo dibuang atas keputusan PIC; T16, T17, T19, dan T20 ditambah 2026-10-09 atas permintaan PIC; T18 dijadwalkan dan T22 sampai T26 ditambah 2026-10-10 atas permintaan PIC, total 11.5 jam lagi; T27 sampai T39 (lowongan harian, 21.5 jam) ditambah 2026-10-09 atas permintaan PIC. Semuanya melewati 20 jam; PRD §11 menyebut 20 jam sebagai panduan, bukan batas keras. T21 dan FR-33 masih ditunda dan tidak dihitung.)
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

### T16 · Tandai field wajib yang belum terisi dengan outline kuning · 1.5h · feature · Medium
- [ ] **T16 selesai**

**Context:** JobFill lama menandai field yang tidak terisi dengan outline kuning di halaman, supaya pengguna langsung tahu mana yang harus diisi sendiri. job-kit baru menampilkan daftar di panel, tetapi tidak menandai halamannya. Dokumen JobFill lama tidak mendefinisikan perilaku ini, jadi rinciannya di bawah adalah asumsi yang perlu dikonfirmasi PIC.

**Asumsi (konfirmasi PIC sebelum dikerjakan)**
1. **Kapan:** outline muncul setelah Fill ditekan, bukan saat panel baru membaca halaman. Ini menjaga prinsip FR-09 bahwa halaman tidak berubah sebelum Fill.
2. **Field mana (diputuskan PIC 2026-10-09):** hanya field **wajib** yang masih kosong setelah Fill, yaitu yang tak terpetakan, yang datanya tidak ada di profil, dan yang dimatikan pengguna. Field opsional yang kosong tidak diberi outline. Field yang berisi (oleh job-kit atau oleh pengguna) tidak ditandai.
   **Daftar "Dilewati" di panel tetap memuat semua field yang tidak terisi**, wajib maupun opsional (tafsiran saya atas "tetap tulis di field yang dilewati"; kalau yang dimaksud tulisan di halaman, kabari). Field wajib di daftar itu diberi penanda "Wajib" supaya cocok dengan outline di halaman.
   **Cara mengenali wajib:** atribut `required`, atau `aria-required="true"`, atau teks labelnya memuat tanda `*` atau `✱`, atau kata "Required" atau "Wajib". Tiga situs yang sudah diukur (Greenhouse, Lever, Intikom) memakai tanda atau kata di label, jadi atribut saja tidak cukup.
3. **Warna:** amber dari token desain (`amber-600`, #DC6803), outline 2px dengan jarak 2px. Kalau PIC ingin kuning yang lebih terang, ganti warnanya; tidak ada konsekuensi lain.
4. **Hilang kapan:** dari satu field begitu pengguna mengisinya; semuanya saat Undo; dan saat halaman dimuat ulang.

**Perubahan dokumen yang ikut (butuh persetujuan PIC karena PRD dan RFC sudah APPROVED)**
- [ ] PRD: tambah **FR-20** (Should) di §7, satu baris di §8 ("Field yang tidak terisi setelah Fill ditandai di halaman"), satu catatan di §6.2 layar S1, dan tandai sebagai penambahan 2026-10-09.
- [ ] RFC §2: baris **Complexity ban** menyebut "tanpa UI yang disuntik ke halaman lamaran". Ubah menjadi "tanpa elemen baru di halaman lamaran; satu-satunya perubahan visual adalah outline pada field yang sudah ada".
- [ ] RFC §8: tambah keputusan **D9** dengan baris Cost (mengubah tampilan halaman milik situs lain; bisa bentrok dengan gaya situs; outline situs sendiri harus dipulihkan).
- [ ] Tabel cakupan di bawah: tambah baris FR-20 → T16.

**Acceptance criteria**
- [ ] Setelah Fill, setiap field **wajib** yang masih kosong dan terlihat di halaman memiliki outline amber yang jelas (FR-20)
- [ ] Field opsional yang kosong tidak diberi outline, tetapi tetap muncul di daftar "Dilewati" (FR-20)
- [ ] Di daftar "Dilewati", field wajib diberi penanda "Wajib" (FR-20)
- [ ] Sebelum Fill ditekan, tidak ada field yang diberi outline (FR-09)
- [ ] Field yang terisi oleh job-kit, dan field yang sudah berisi teks pengguna, tidak diberi outline (FR-20)
- [ ] Outline sebuah field hilang begitu pengguna mengisinya (FR-20)
- [ ] Undo menghapus semua outline, dan outline milik situs sendiri pada field itu kembali seperti sebelumnya (FR-11, FR-20)
- [ ] Field tersembunyi tidak ditandai, dan jumlah elemen di halaman tidak bertambah (RFC §2)
- [ ] Panel memberi tahu bahwa field yang belum terisi ditandai di halaman, dengan kalimat yang ditulis ramah dan singkat (FR-20)
- [ ] Dropdown dan grup radio wajib yang tidak terisi juga ditandai; untuk grup radio, yang ditandai adalah grupnya, bukan tiap tombol (FR-20)

**Done when:** setelah Fill di form uji dan di satu form sungguhan, field wajib yang harus diisi sendiri langsung terlihat di halaman, dan Undo mengembalikan halaman seperti semula.

### T17 · Section Data di options (UI saja) · 1.5h · feature · Medium
- [ ] **T17 selesai**

**Context:** mockup menampilkan halaman Data (Export, Import, Hapus semua, pemakaian storage). PRD v1 sebelumnya mengeluarkannya (§4, §9, §6.6 #13). PIC memasukkannya ke v1 pada 2026-10-09, **secara UI dulu**; perilaku Import dan Hapus semua ditunda ke T18. Layar dan state dirujuk dari `docs/screens.md` §3.3 (D1 sampai D5) dan mockup `docs/reference/JobFill UI.dc.html`.

**Perubahan dokumen yang ikut (PRD dan RFC sudah APPROVED, jadi ini keputusan PIC yang dicatat)**
- [x] PRD §4: hapus "Tidak ada export atau import data di v1" dari non-goals dan ganti dengan "Import dan Hapus semua belum berfungsi di v1; UI-nya ada".
- [x] PRD §9: pindahkan halaman Data (UI) dari OUT ke IN; "export/import, hapus semua data" tetap OUT sebagai perilaku sampai T18.
- [x] PRD §6.6 #13: perbarui; grup DATA kini berisi satu item, Data. Captured Jobs dan Additional tetap di luar.
- [x] PRD §7: tambah **FR-21** (Should): halaman Data menampilkan kartu Export, Import, Hapus semua, pemakaian storage nyata, dan kalimat jujur soal enkripsi. **FR-22** (Could, T18 ditunda): ketiga aksi berfungsi.
- [x] Tabel cakupan: FR-21 → T17, FR-22 → T18 (ditunda).

**Acceptance criteria**
- [x] Navigasi kiri punya grup DATA dengan satu item "Data"; grup PROFILE tetap seperti sekarang (FR-21)
- [x] Halaman Data menampilkan tiga kartu aksi (Export, Import, Hapus semua) dan kartu "Pemakaian storage" dengan bar dan angka nyata, misalnya "1.8 MB dari 10 MB" (FR-21)
- [x] Kalimat jujur soal enkripsi tampil: data disimpan tanpa enkripsi di `chrome.storage.local`, tanpa server dan tanpa akun (FR-21)
- [x] Export JSON menghasilkan satu berkas berversi berisi profil dan bisa diunduh; ini hanya membaca data (FR-21). Terbukti di Chrome sungguhan saat uji T18.
- [x] State D2 (pratinjau import dengan Ganti atau Gabung), D3 (import tidak valid dengan sebab), D4 (konfirmasi hapus dengan mengetik ulang kata), dan D5 (selesai dengan angka) ada sebagai komponen yang bisa dilihat, tanpa memakai kata "Captured Jobs" atau "pemetaan situs" karena di luar v1
- [x] Di build produksi, tombol Import dan Hapus semua tampil nonaktif dan menyebut alasannya ("Belum tersedia di versi ini"); tidak ada kontrol yang tampak berfungsi tetapi tidak melakukan apa-apa
- [x] Semua kontrol bergaya sesuai token, tanpa kontrol bawaan browser

**Done when:** halaman Data terlihat sesuai mockup, pemakaian storage menunjukkan angka nyata, Export mengunduh berkas profil, dan keempat state lain bisa dilihat di build dev.

### T18 · Import JSON dan Hapus semua berfungsi · 2h · feature · Medium
- [x] **T18 selesai** (dijadwalkan PIC 2026-10-10; diverifikasi di Chrome for Testing 151, muat unpacked dari `.output/chrome-mv3`)

**Context:** menyambungkan state D2 sampai D5 ke perilaku sungguhan (FR-22). Dikerjakan sebelum T22 karena pratinjau, aksi gabung/ganti, dan state hasilnya dipakai ulang oleh Import CV. State machine ada di `src/core/data/state.ts`; envelope export di `src/core/data/export.ts`.
**Dokumen yang diubah tiket ini**
- [x] PRD sudah diubah 2026-10-10 (FR-22 Should, FR-25, §4, §8, §9). README diperbarui; `docs/screens.md` §3.3 (D2 sampai D5) sudah sesuai perilaku sekarang.

**Acceptance criteria**
- [x] Import membaca berkas export, menolak berkas rusak atau versi tak dikenal dengan sebab yang spesifik, dan menampilkan pratinjau apa yang berubah (FR-22). Di Chrome sungguhan: berkas bukan JSON dan versi 3 ditolak, profil tidak berubah.
- [x] Logika validasi dan diff ada di `core/data/import.ts` dengan tes lebih dulu (TDD); komponen tidak berisi logika bisnis
- [x] Tombol Import dan Hapus semua tidak lagi nonaktif; tidak ada kontrol palsu yang tersisa
- [x] Gabung menambah tanpa menimpa data yang ada; Ganti menggantikan seluruh profil (FR-22). Terbukti di Chrome sungguhan.
- [x] Hapus semua baru berjalan setelah pengguna mengetik ulang kata konfirmasi, dan setelahnya profil kosong (FR-22). Terbukti di Chrome sungguhan.
- [x] Setelah impor atau hapus, panel menampilkan angka hasil ("112 entri diimpor") (FR-22)

### T19 · Samakan tampilan dengan mockup referensi · 1.5h · polish · Medium
- [ ] **T19 selesai**

**Context:** P6 mensyaratkan membangun agar cocok dengan referensi visual bila PRD §6.3 memilikinya, tetapi build sekarang dibuat dari token dan teks tanpa pernah dibandingkan berdampingan dengan mockup. Dikerjakan di chat terpisah memakai `docs/redesign-prompt.md`.

**Acceptance criteria**
- [ ] Ada daftar selisih antara tiap layar (panel dan options) dan mockup, dengan yang diperbaiki dan yang sengaja dibiarkan beserta alasannya
- [x] Kepala sidebar options memuat logo dan nama "job-kit"; seluruh options dalam satu kartu membulat; dasar sidebar memuat catatan privasi tentang tanpa enkripsi, server, dan akun
- [x] Indikator "Tersimpan" memakai titik hijau seperti mockup; judul halaman memiliki subjudul satu baris
- [x] Layar panel sesuai mockup untuk tab, site header, summary bar, baris field, dan banner
- [x] Tidak ada perubahan perilaku: 174 tes tetap lulus, `typecheck` dan `build` bersih

**Done when:** layar sebelum dan sesudah, dibandingkan dengan mockup, hanya berbeda pada hal yang sengaja diputuskan.

### T20 · Halaman Captured Jobs di options (UI saja) · 1.5h · feature · Medium
- [ ] **T20 selesai**

**Context:** mockup menampilkan halaman Captured Jobs (daftar, pencarian, filter status, slide-over detail). PRD v1 sebelumnya mengeluarkannya (§4, §9, §6.6 #13). PIC memasukkannya ke v1 pada 2026-10-09, **secara UI dulu**; belum ada yang mencatat lowongan setelah Fill (itu T21). Layar dan state dirujuk dari `docs/screens.md` §3.2 (J1 sampai J4) dan mockup `docs/reference/JobFill UI.dc.html`.

**Perubahan dokumen yang ikut (dicatat sebagai keputusan PIC 2026-10-09)**
- [x] PRD §4, §6.6 #13, §9 (IN dan OUT), §8 (batas jumlah), §7: **FR-23** (Could) dan **FR-24** (Could, ditunda).
- [x] Tabel cakupan: FR-23 → T20, FR-24 → T21 (ditunda).

**Acceptance criteria**
- [x] Grup DATA di navigasi berisi dua item: Captured Jobs lalu Data (FR-23)
- [x] Di build produksi halaman menampilkan state kosong yang jujur: belum ada lowongan, dan pencatatan otomatis belum tersedia di versi ini. Tidak ada tombol yang tampak berfungsi tetapi tidak melakukan apa-apa (FR-23)
- [x] Daftar (pencarian dan filter Semua, Applied, In Review, Rejected, Offer berfungsi pada data contoh), state filter tanpa hasil dengan "Reset filter", dan slide-over detail (status, snapshot field, catatan) ada sebagai komponen yang bisa dilihat lewat `#jobs?state=list|empty|filtered-empty|detail` hanya di build dev (FR-23)
- [x] Filter dan format tanggal ("2 Sep 2026") adalah fungsi murni di `core/` dengan tes
- [x] Tombol "Simpan perubahan" dan "Hapus entri" di slide-over nonaktif dengan alasan "Belum tersedia di versi ini"
- [x] Semua kontrol, termasuk pilihan status, bergaya sesuai token tanpa kontrol bawaan browser

**Done when:** Export, ubah profil, Import (Ganti) mengembalikan profil; Hapus semua berjalan setelah mengetik `HAPUS`; semua terlihat di Chrome sungguhan, bukan hanya harness.

### T22 · Baca teks dari PDF di options · 2h · spike · Medium
- [x] **T22 selesai**

**Context:** dasar Import CV (FR-25). Teks diekstrak lokal di halaman options; tidak ada server, OCR, atau layanan luar. Risiko utama: bundling worker `pdfjs-dist` di WXT dan CSP MV3 yang melarang skrip jarak jauh. Kerjakan spike ini lebih dulu untuk memastikan jalan sebelum parser ditulis.

**Hasil spike (2026-10-10, `pdfjs-dist@6.4.299`, Chrome for Testing 151, muat unpacked dari `.output/chrome-mv3`)**
- Worker dibundel lewat `import ... '?url'`: WXT mengeluarkannya sebagai `assets/pdf.worker.min-*.mjs` (1,26 MB) dan dimuat dari origin ekstensi. Manifest tidak punya CSP khusus; CSP bawaan MV3 (`script-src 'self'`) cukup.
- Tambahan bundle: chunk lazy `pdf-*.js` 430 kB, pembungkus 1,5 kB, worker 1,26 MB; total sekitar 1,7 MB, dimuat hanya saat PDF dipilih. Hanya `options-*.js` yang merujuk chunk itu; side panel, background, dan `page-reader.js` tidak.
- Selama pembacaan tiga PDF, tidak ada request keluar dari origin ekstensi dan tidak ada error konsol.
- Hasil di Chrome: PDF bersih dan PDF dua kolom menghasilkan teks terbaca; PDF scan (hanya gambar) → `no-text-layer`; berkas bukan PDF → `not-pdf`; PDF terpotong → `unreadable`. `encrypted` baru dibuktikan lewat tes unit (bentuk `PasswordException`), belum dengan PDF terenkripsi sungguhan di Chrome.
- Temuan untuk T23: pada PDF dua kolom, teks terbaca kolom demi kolom (kolom kiri dulu), dan baris panjang bisa terpotong jadi dua baris (mis. URL LinkedIn).
- Pdfjs 6 tidak punya opsi `isEvalSupported`; `destroy` ada di loading task. Ukuran akhir diukur ulang saat pdf dikabelkan di T25 (tanpa pemanggil, pdfjs tidak ikut build).

**Acceptance criteria**
- [x] `platform/pdf.ts` membungkus `pdfjs-dist` dan memuatnya lazy, hanya saat Import PDF dipakai; build produksi tidak memuat skrip dari luar (FR-25)
- [x] Fungsi menerima `File` dan mengembalikan teks per halaman dalam urutan baca, atau kesalahan bertipe: `not-pdf`, `encrypted`, `no-text-layer`, `unreadable` (FR-25)
- [x] Terbukti jalan di build ekstensi di Chrome sungguhan dengan satu PDF CV uji (bukan hanya di happy-dom); hasil dicatat di tiket ini
- [x] Ukuran tambahan bundle dicatat; pdfjs tidak masuk side panel atau content script

**Done when:** PDF CV uji menghasilkan teks yang bisa dibaca di konsol halaman options, dan empat jenis kesalahan punya tes.

### T23 · Parser CV: identitas dan kontak · 2h · feature · Medium
- [x] **T23 selesai**

**Context:** `core/cv/parse.ts`, fungsi murni dari teks ke `Partial<Profile>` dengan `confidence` per field. Tanpa AI; aturan dan regex. Fixture berupa teks CV sintetis berbahasa Indonesia dan Inggris, tidak ada data orang sungguhan di repo.
**Acceptance criteria**
- [x] Mengenali nama lengkap, email, telepon (format +62, 08xx, spasi atau strip), LinkedIn, dan kota dari blok kepala CV (FR-25)
- [x] Setiap field punya `confidence` (`high` atau `low`); penanda "Periksa lagi" di pratinjau menyusul di T25 (FR-25)
- [x] Teks kosong atau tanpa satu pun field yang dikenali mengembalikan hasil kosong, bukan kesalahan (FR-25)
- [x] Tes ditulis lebih dulu; 8 fixture sintetis di `fixtures/cv/text-fixtures.ts` (ID dan EN, satu kolom dan dua kolom, tiga kasus ambigu)

**Done when:** semua fixture lulus dan tidak ada tebakan nilai tanpa tanda `low`.

**Catatan:** akurasi baru diuji pada fixture sintetis dan dua PDF hasil Chrome; PDF CV asli diuji di T26.

### T24 · Parser CV: pendidikan dan pengalaman · 2h · feature · Medium
- [x] **T24 selesai**

**Context:** lanjutan T23, bagian yang paling beragam. Heading dikenali dalam dua bahasa ("Pendidikan", "Education", "Pengalaman Kerja", "Work Experience", dan variannya).
**Acceptance criteria**
- [x] Memisahkan blok per heading, lalu per entri; setiap entri pendidikan mendapat institusi, jenjang, jurusan, IPK jika ada, dan tahun selesai (FR-25). Periode disimpan apa adanya; profil memakai satu field `year`, jadi yang diambil tahun akhir.
- [x] Setiap entri pengalaman mendapat posisi, perusahaan, periode, dan deskripsi jika ada (FR-25)
- [x] Periode dengan "Sekarang", "Saat ini" atau "Present" dikenali sebagai masih berjalan (FR-25)
- [x] Entri yang strukturnya tidak jelas tidak ditebak; teks mentahnya dikembalikan sebagai `unparsed` agar bisa ditampilkan di pratinjau (FR-25)
- [x] Tes ditulis lebih dulu memakai fixture yang sama dengan T23 ditambah variasi heading

**Done when:** fixture lulus, dan entri yang tidak bisa dibaca muncul sebagai `unparsed`, bukan hilang.

**Batas yang diketahui:** institusi tanpa kata kunci (mis. singkatan "ITB") jatuh ke `unparsed`; judul dan perusahaan yang dipisah dua baris tanpa penanda perusahaan (PT, CV, Ltd, ...) diberi `low`; baris deskripsi tanpa titik yang tepat di atas periode entri berikutnya bisa terbaca sebagai judul. Akurasi pada CV asli diuji di T26.

### T25 · Pratinjau Import CV per field · 2h · feature · Medium
- [x] **T25 selesai** (tombol "Isi profil" sengaja nonaktif dengan "Belum tersedia di versi ini" sampai T26)

**Context:** memperluas `ImportPreview` dari T18. Tidak ada yang tersimpan sebelum pengguna mengonfirmasi (FR-25). Teks UI baru ditandai di laporan.
**Acceptance criteria**
- [x] Tombol Import menerima `.pdf` dan `.json`; jenisnya dikenali dari isi (tanda `%PDF-`), bukan hanya ekstensi (FR-25). Di Chrome sungguhan baru diuji dengan berkas ber-ekstensi benar; berkas yang diganti namanya baru dicakup tes unit `looksLikePdf`.
- [x] Pratinjau menampilkan tiap field terdeteksi dengan kotak centang, nilai lama di samping nilai baru, dan penanda "Periksa lagi" untuk `low` (FR-25). Pendidikan dan pengalaman tampil sebagai satu baris per entri, bukan per field (keputusan implementasi; PRD tidak mengatur).
- [x] Bawaan: field yang sudah berisi dilewati; pengguna bisa memilih menimpa per field (FR-25). Untuk entri: bawaan tercentang hanya bila bagian itu masih kosong di profil.
- [x] State `parsing` (sedang membaca), `import-error` (sebab dari T22: terenkripsi, tanpa lapisan teks, tak terbaca; berkas yang bukan PDF dan bukan JSON memakai pesan "bukan JSON"), dan "tidak ada yang terdeteksi" dengan tombol konfirmasi nonaktif (FR-25, PRD §8)
- [x] Reducer dan seleksi field ada di `core/` dengan tes; komponen hanya menampilkan
- [x] Semua warna dari token, ikon lucide-react, tanpa kontrol bawaan peramban; `npx -y impeccable detect src/ui src/entrypoints` bersih

**Done when:** semua state terlihat lewat `#data?state=...` di build dev, dan layout tetap rapi di lebar sempit.

**Hasil (2026-10-10, Chrome for Testing 151):** `#data?state=parsing|cv-preview|cv-empty|cv-error-scan|cv-error-locked|cv-error-broken` terlihat di build dev; tanpa overflow horizontal di 420 px. Alur nyata di build produksi dengan `clean-id.pdf`, `two-column-en.pdf`, dan `scan-id.pdf`: profil tidak berubah sebelum konfirmasi, tanpa request keluar dari origin ekstensi, tanpa error konsol. Ukuran akhir: `options` 60,17 kB (naik 20,7 kB), chunk pdf lazy 430 kB, worker 1,26 MB; side panel tetap 20,09 kB.

### T26 · Sambungkan Import CV ke profil dan uji di Chrome · 1.5h · feature · Medium
- [x] **T26 selesai** (diuji dengan PDF sintetis buatan sendiri; uji dengan PDF CV asli dari PIC masih menunggu, lihat catatan di bawah)

**Context:** menyatukan T22 sampai T25 dan memverifikasi di ekstensi sungguhan.
**Acceptance criteria**
- [x] Konfirmasi menulis field terpilih lewat jalur tulis yang sama dengan form manual (`saveProfile` di `platform/storage`); hasil tampil sebagai angka ("9 field diisi, 1 dilewati") (FR-25). Catatan: lewat `useProfile.commit` yang baru, bukan `update`, karena `update` tidak melaporkan hasil simpan; Import JSON dan Hapus semua (T18) ikut dipindah ke `commit` agar layar "selesai" tidak muncul saat simpan gagal.
- [x] Field yang sudah berisi tidak tertimpa kecuali dipilih eksplisit (FR-25). Terbukti di Chrome sungguhan: nama belakang yang sudah berisi tetap, lalu tertimpa setelah dicentang.
- [x] Diuji di Chrome sungguhan dengan minimal tiga PDF CV: satu bersih (`clean-id.pdf`), satu dua kolom (`two-column-en.pdf`), satu hasil scan (`scan-id.pdf`, ditolak) (FR-25). Ketiganya sintetis, dibuat dari HTML lewat Chrome print-to-PDF.
- [x] Penyimpanan penuh saat konfirmasi memakai notice yang sudah ada dan tidak menghilangkan data lama (PRD §8). Terbukti di Chrome sungguhan dengan menyisakan 150 byte kuota: notice tampil, layar tetap di pratinjau, profil tersimpan tidak berubah.
- [x] README diperbarui: fitur Import CV, batasannya (tanpa OCR, akurasi tergantung layout), dan bahwa PDF tidak meninggalkan peramban
- [ ] Uji dengan 2–3 PDF CV asli dari PIC dan catat akurasinya per field (menunggu berkas; PDF asli tidak boleh masuk repo)

**Done when:** PDF CV uji mengisi profil di Chrome sungguhan, field yang berisi tidak tertimpa, dan PDF scan ditolak dengan pesan jelas.

### T21 · Lowongan tercatat otomatis setelah Fill · 2h · feature · Medium · **ditunda**
- [ ] **T21 selesai** (belum dijadwalkan; menunggu keputusan PIC setelah T20)

**Context:** menyambungkan Captured Jobs ke data nyata (FR-24).
**Acceptance criteria (rancangan)**
- [ ] Setelah Fill, lowongan tersimpan dengan judul halaman, domain, tanggal, dan snapshot field yang dikirim (FR-24)
- [ ] Status bisa diubah dan catatan bisa disimpan; hapus entri meminta konfirmasi (FR-24)
- [ ] Export dan Hapus semua ikut mencakup lowongan tercatat (FR-24)

---

## Lowongan harian (revisi PRD 2026-10-09)

Sumber: PRD §4.1, §6.7, FR-26 sampai FR-33. Urutan (keputusan PIC 2026-10-09): mockup T28 dulu, lalu spike T27 dan RFC, lalu data, sumber, AI, jadwal, layar. Kirim ke CV Maker (FR-33) ditunda dan tidak punya tiket.

**Done when:** selama 5 hari, feed harian jalan tanpa halaman options terbuka, lowongan tampil dengan skor dan alasan, dan Buka & isi mengantar ke panel Autofill (PRD §10).

### T27 · Spike: ambil lowongan dari tiap jenis sumber · 2h · spike · Highest
- [ ] **T27 selesai**

**Context:** risiko terbesar fitur ini. Buktikan dari build ekstensi di Chrome sungguhan bahwa tiap jenis sumber bisa diambil dari service worker MV3. Parsing HTML dilakukan di offscreen document karena service worker tidak punya `DOMParser`. Kandidat: Greenhouse (`boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`), Lever (`api.lever.co/v0/postings/{company}?mode=json`), Ashby (`api.ashbyhq.com/posting-api/job-board/{name}`), Remotive (`remotive.com/api/remote-jobs`), dan halaman pencarian publik LinkedIn tanpa login. Endpoint dicek ulang saat spike; tidak ada yang dianggap stabil.

**Acceptance criteria**
- [ ] Per sumber dicatat di tiket ini: berhasil atau tidak, jumlah lowongan, waktu, ukuran respons, field yang tersedia (terutama tipe kerja, gaji, deadline, teks deskripsi) (FR-27, FR-28)
- [ ] LinkedIn: request memakai `credentials: 'omit'`; dicatat berapa halaman berturut-turut sebelum kena 429 atau halaman blokir, dan selector yang dipakai (FR-27)
- [ ] `optional_host_permissions` dan `chrome.permissions.request` terbukti jalan dari halaman options; izin wajib di manifest tidak bertambah (FR-32)
- [ ] Satu request ke penyedia AI dari service worker berhasil, termasuk header yang dibutuhkan penyedia untuk request dari browser (FR-29)
- [ ] `chrome.sidePanel.open` dari klik di halaman options terbukti membuka panel di tab lain, atau dicatat bahwa tidak bisa (FR-31)
- [ ] Ringkasan arsitektur pipeline ditambahkan ke `docs/03-rfc.md`

**Done when:** tabel hasil per sumber ada di tiket ini dan PIC memutuskan daftar sumber v1 (PRD §11).

### T28 · Mockup Lowongan di design system · 1.5h · design · Highest
- [ ] **T28 selesai**

**Context:** sama seperti §7 "Options page navigation", mockup dibuat dulu di `docs/design-system.html` tanpa menyentuh produk. Referensi kartu: gambar kartu lowongan dari PIC (logo, judul, perusahaan, chip, baris meta). Sidebar mengikuti usulan tiga tujuan, dengan Captured Jobs diganti Lowongan.

**Acceptance criteria**
- [x] Sidebar Profile, Lowongan (badge jumlah baru), Data; tab Rekomendasi dan Disimpan (FR-30)
- [x] Kartu: logo atau inisial, judul, perusahaan, sumber, chip lokasi, tipe kerja, kontrak, level; baris meta yang menyembunyikan item kosong; badge skor tiga tingkat; panel alasan; aksi Buka & isi, Simpan, menu lainnya (FR-28 sampai FR-31)
- [x] Header (waktu update, jumlah baru, Segarkan, Atur), filter tipe kerja, urutan, pencarian (FR-30)
- [x] State: belum dinyalakan, sedang mengambil, kosong hari ini, filter tanpa hasil, satu sumber gagal, "Skor kasar" (PRD §8)
- [x] S5 Preferensi kerja dan S6 Atur Lowongan (FR-26, FR-32)
- [x] Hanya token dan komponen yang sudah ada; rapi di desktop dan ≤420 px tanpa overflow horizontal

**Hasil:** mockup di `docs/design-system.html` §8 (S4 Rekomendasi, S4 Disimpan, 8 kartu state, S5, S6, lebar ≤420 px). Overflow horizontal dicek lewat skrip di viewport 420 px: tidak ada selain rak tab yang memang bisa digeser. Menunggu persetujuan PIC.

**Done when:** PIC menyetujui mockup.

### T29 · Preferensi kerja di profil · 1.5h · feature · High
- [ ] **T29 selesai**

**Acceptance criteria**
- [x] Tipe `JobPreferences` masuk model profil dengan migrasi skema; profil dan berkas Export lama tetap terbaca (FR-26)
- [ ] Tab Preferensi kerja di Profile sesuai T28: role incaran (chip), level, lokasi, tipe kerja (multi), kata kunci wajib dan dihindari, gaji minimum opsional; tersimpan otomatis (FR-26)
- [x] Export dan Import JSON memuat preferensi; Import CV tidak menyentuhnya
- [x] Migrasi dan validasi di `core/` dengan tes ditulis lebih dulu

**Done when:** preferensi bertahan setelah muat ulang dan ikut Export.

**Hasil:** profil naik ke versi 2 (`jobPrefs`), `migrateProfile` dipakai saat membaca storage, berkas Export versi 1 dan 2 terbaca, Import CV tidak menyentuh preferensi (tes), `isProfileEmpty` dan ringkasan panel mengabaikannya supaya Fill tidak aktif hanya karena preferensi. 347 tes hijau, typecheck dan build lolos. Belum diverifikasi: tampilan tab di browser dan "bertahan setelah muat ulang" di Chrome sungguhan. Untuk saat ini Preferensi kerja berupa item sidebar di bawah Custom Field; bentuk tab menunggu T37.

### T30 · Model data lowongan dan penyimpanan feed · 1.5h · feature · High
- [ ] **T30 selesai**

**Acceptance criteria**
- [x] Tipe `Job` (bentuk FR-28), `JobStatus` (`new`, `saved`, `applied`, `hidden`), dan `SourceRun` (sumber, waktu, jumlah, sebab gagal) di `core/` (FR-27, FR-28, FR-30)
- [x] Kunci dedupe: URL kanonik (tanpa parameter pelacak), cadangan judul + perusahaan yang dinormalkan. Lowongan yang sudah ada diperbarui datanya tanpa mereset status dan skor (FR-28)
- [x] Pemangkasan: lowongan `new` dan `hidden` yang lebih dari 30 hari atau di atas 500 entri dibuang dari yang tertua; `saved` dan `applied` tidak pernah dibuang otomatis (PRD §8)
- [x] Kunci storage terpisah dari profil; Hapus semua ikut menghapusnya; Export memuat lowongan `saved` dan `applied`
- [x] Tes ditulis lebih dulu

**Done when:** tes merge, dedupe, dan pemangkasan lulus.

**Hasil:** tipe `Job`, `JobStatus`, `SourceRun` di `src/core/feed/` (nama folder baru supaya tidak bentrok dengan `CapturedJob` lama); dedupe lewat URL kanonik dengan cadangan judul+perusahaan, merge tidak mereset status, skor, dan tanda AI; pemangkasan 30 hari / 500 entri hanya untuk new dan hidden; storage terpisah (`local:feed`, `local:feedRuns`); Hapus semua ikut menghapusnya; Export memuat lowongan saved dan applied (Import belum membaca `jobs`). 368 tes hijau, typecheck lolos.

### T31 · Normalisasi, kategori tipe kerja, saringan, dan skor kasar · 1.5h · feature · High
- [ ] **T31 selesai**

**Acceptance criteria**
- [x] `classifyWorkplace(job)` → `remote | hybrid | onsite | unknown`: field terstruktur sumber dulu (`workplaceType`, `isRemote`), lalu kata kunci di lokasi dan judul ("Remote", "WFH", "Hybrid", "Anywhere") (FR-28)
- [x] Saringan aturan membuang lowongan dengan kata kunci dihindari, atau tipe kerja dan lokasi di luar preferensi, sebelum AI dipanggil (FR-29)
- [x] Skor kasar: kecocokan role dan skill, level dibanding lama pengalaman, kebaruan (FR-29)
- [x] Deskripsi HTML dibersihkan jadi teks polos dan dipotong untuk prompt
- [x] Fungsi murni di `core/` dengan fixture dari T27

**Done when:** fixture tiap sumber tergolong benar dan saringan terbukti di tes.

**Hasil:** fungsi murni di `src/core/feed/`: `classifyWorkplace`, `passesRules` (kata dihindari, tipe kerja, lokasi), `roughScore`, `htmlToText`/`truncateText`. Fixture respons asli dari spike T27 di `fixtures/jobs/` dan diuji (Ashby, Lever, Greenhouse, Remotive). Keputusan: kata kunci wajib tidak menyaring (sesuai FR-29), hanya menambah skor; teks bantuan di Preferensi kerja diubah. Greenhouse tidak punya field tipe kerja, jadi hanya teks lokasi yang menentukan (sisanya unknown, bisa diisi AI di T35).

### T32 · Adapter sumber API: ATS dan Remotive · 2h · feature · High
- [ ] **T32 selesai**

**Acceptance criteria**
- [ ] Antarmuka `JobSource { id, fetch(prefs, ctx) }`; satu adapter per sumber yang lolos T27: Greenhouse, Lever, Ashby (per perusahaan pilihan), Remotive (FR-27)
- [ ] Tiap adapter memetakan ke `Job` (FR-28); fixture respons asli disimpan di `fixtures/jobs/`
- [ ] Timeout per request dan satu kali retry. Kegagalan jadi `SourceRun` dengan sebab (`blocked`, `timeout`, `parse`, `http-xxx`), bukan exception yang menghentikan run (FR-27)
- [ ] Tes memakai fixture, tanpa jaringan

**Done when:** semua adapter lulus tes fixture dan satu run nyata di Chrome mengisi storage.

### T33 · Adapter scraping LinkedIn (halaman publik) · 2h · feature · High
- [ ] **T33 selesai**

**Context:** PIC butuh scraping (keputusan 2026-10-09). Hanya halaman publik tanpa login. Risiko ToS dan blokir diterima PIC dan dibatasi lewat AC di bawah (PRD §4.1). HTML diparse di offscreen document.

**Acceptance criteria**
- [ ] Query dibangun dari preferensi: role, lokasi, filter remote (FR-27)
- [ ] Request tanpa cookie, paling banyak N halaman per run (angka dari T27), jeda acak antar request, satu run otomatis per hari (FR-27)
- [ ] Semua selector di satu berkas. Struktur berubah → `SourceRun` `parse` dengan jumlah 0, bukan crash (PRD §8)
- [ ] Halaman detail (untuk teks deskripsi) hanya diambil untuk lowongan yang lolos saringan T31
- [ ] Gagal 3 run berturut-turut → sumber dijeda dan header S4 memberi tahu (PRD §8)
- [ ] Tes parser memakai HTML fixture tersimpan, termasuk satu fixture rusak

**Done when:** run nyata di Chrome menghasilkan lowongan LinkedIn ternormalisasi, dan fixture rusak menghasilkan `parse`, bukan error.

### T34 · Atur Lowongan: sumber, izin, dan klien AI · 1.5h · feature · High
- [ ] **T34 selesai**

**Acceptance criteria**
- [ ] S6 sesuai T28: nyala/mati per sumber, daftar perusahaan ATS, jam ambil, penyedia, model, kunci API (input tersembunyi), Tes koneksi dengan hasil jelas (FR-32)
- [ ] Izin host diminta saat sumber atau AI dinyalakan; menolak izin membuat sumber itu tetap mati (FR-32)
- [ ] Kunci di `storage.local` terpisah dari profil, tidak ikut Export, ikut Hapus semua (FR-32)
- [ ] Klien AI di `platform/` dengan timeout dan pemetaan error (`invalid-key`, `quota`, `network`)
- [ ] Lowongan tidak bisa dinyalakan selama Preferensi kerja kosong (PRD §8)

**Done when:** Tes koneksi berhasil dengan kunci sah dan gagal dengan pesan spesifik untuk kunci salah.

### T35 · Skor AI dan alasan · 2h · feature · High
- [ ] **T35 selesai**

**Acceptance criteria**
- [ ] Ringkasan profil yang dikirim hanya berisi field di PRD §4.1. Tes memastikan nama, email, telepon, alamat, dan tanggal lahir tidak ada di payload (FR-29)
- [ ] Lowongan dinilai per batch; output terstruktur (skor 0–100, `matches[]`, `gaps[]`, ringkasan) divalidasi; output tidak valid → skor kasar (FR-29, PRD §8)
- [ ] AI juga mengisi field yang masih kosong setelah normalisasi bila jelas dari teks (tipe kerja, level, pengalaman, gaji), ditandai berasal dari AI (FR-28)
- [ ] Skor di-cache per lowongan dengan hash profil + preferensi; tidak dihitung ulang tanpa perubahan (FR-29)
- [ ] Batas per run: paling banyak 50 lowongan dinilai AI (bisa diubah), sisanya skor kasar
- [ ] Tes memakai klien palsu; satu run nyata dicatat dengan jumlah token dan perkiraan biaya

**Done when:** run nyata menghasilkan skor dan alasan, dan mencabut kunci menghasilkan "Skor kasar".

### T36 · Jadwal harian dan Segarkan · 1.5h · feature · High
- [ ] **T36 selesai**

**Acceptance criteria**
- [ ] `chrome.alarms` sekali sehari pada jam dari S6; run yang terlewat berjalan saat Chrome dibuka; paling banyak satu run otomatis per hari (FR-27, PRD §8)
- [ ] Pipeline: sumber paralel → normalisasi → dedupe/merge → saringan → skor → simpan. Progres per tahap dikirim ke halaman yang terbuka
- [ ] Segarkan menjalankan run sekarang; selama berjalan tombol nonaktif "Sedang mengambil…" dan run kedua ditolak (PRD §8)
- [ ] Badge jumlah lowongan baru di item Lowongan di sidebar; hilang setelah halaman dibuka

**Done when:** alarm uji (interval dipendekkan di build dev) menjalankan run penuh tanpa halaman options terbuka.

### T37 · Halaman Lowongan · 2h · feature · High
- [ ] **T37 selesai**

**Acceptance criteria**
- [ ] Sidebar dan tab sesuai T28; tab Disimpan memakai ulang komponen Captured Jobs dari T20 (FR-30)
- [ ] Kartu, filter tipe kerja, urutan, pencarian, dan ubah status. Filter, urut, dan cari adalah fungsi murni di `core/` dengan tes (FR-30)
- [ ] Panel alasan skor per kartu; "Skor kasar" ditandai (FR-29)
- [ ] Semua state dari T28 terlihat lewat `#jobs?state=...` di build dev
- [ ] Token, ikon lucide-react, tanpa kontrol bawaan peramban; rapi di ≤420 px

**Done when:** feed nyata dari T36 tampil dan semua state terlihat di Chrome sungguhan.

### T38 · Buka & isi · 1.5h · feature · Medium
- [ ] **T38 selesai**

**Acceptance criteria**
- [ ] Buka & isi membuka URL di tab baru dan side panel di tab itu (sesuai hasil T27) (FR-31)
- [ ] Panel menampilkan konteks kecil "Dari Lowongan · skor 86" bila tab berasal dari feed
- [ ] Fill berhasil di tab itu → status lowongan jadi Dilamar (FR-31). Untuk lowongan dari feed, ini menggantikan T21 (FR-24)
- [ ] Bila panel tidak bisa dibuka otomatis, tab tetap terbuka dengan petunjuk "Klik ikon job-kit untuk mengisi"

**Done when:** alur dari kartu sampai status Dilamar jalan di Chrome pada satu form Greenhouse.

### T39 · Uji 5 hari dan README · 1h · launch · Medium
- [ ] **T39 selesai**

**Acceptance criteria**
- [ ] 5 hari run harian; per hari dicatat jumlah lowongan, sumber gagal, biaya AI, dan berapa dari 10 teratas yang layak menurut PIC (PRD §10)
- [ ] README: fitur Lowongan, daftar sumber, data apa yang dikirim ke penyedia AI, risiko scraping, izin yang diminta; bagian Privasi dan "Yang tidak dilakukan" ditulis ulang
- [ ] `docs/03-rfc.md` sesuai implementasi akhir

**Done when:** metrik lowongan harian di PRD §10 tercatat di tiket ini.

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
| | | FR-21 | T17 |
| | | FR-22 | T18 |
| | | FR-23 | T20 |
| | | FR-24 (ditunda) | T21 |
| | | FR-25 | T22, T23, T24, T25, T26 |
| | | FR-26 | T28, T29 |
| | | FR-27 | T27, T32, T33, T36 |
| | | FR-28 | T30, T31, T35 |
| | | FR-29 | T31, T35, T37 |
| | | FR-30 | T28, T30, T37 |
| | | FR-31 | T27, T38 |
| | | FR-32 | T27, T34 |
| | | FR-33 (ditunda) | — |

**Layar → tiket:** S1 Panel · Autofill → T03, T04, T05, T06, T10, T38 · S2 Panel · Profile → T09 · S3 Options · Profile → T02, T07, T08, T11 · S4 Options · Lowongan → T28, T37 · S5 Options · Preferensi kerja → T28, T29 · S6 Options · Atur Lowongan → T28, T34.

**Dipotong agar muat 20 jam (urutan PRD §9):**
1. **FR-16 Skill** (chip grup teknis / bahasa / lainnya). Tidak ada tiketnya; item Skill tidak ada di navigasi options.
2. **FR-15** (penanda bagian belum lengkap). Tidak ada tiketnya.

FR-14 (cut-list nomor 3) masih masuk sebagai T13. Kalau waktu habis di Day 8, T13 yang pertama dibuang, lalu T11 (bagian maskot).

**FR yang tidak tercakup tiket:** FR-15 dan FR-16, keduanya karena dipotong di atas.

**Bukan tiket:** studi kasus (checklist terpisah, bukan bagian backlog ini).
