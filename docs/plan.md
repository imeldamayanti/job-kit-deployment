# Plan — job-kit

Pengganti P5: backlog lokal, tanpa Jira dan tanpa CSV. Sumber: `docs/02-prd.md` (APPROVED) dan `docs/03-rfc.md` (APPROVED).
Aturan tetap berlaku: maksimal 18 tiket, total ≤20 jam, tiap tiket ≤2 jam, walking skeleton selesai dalam 8 jam pertama.

**Total estimasi: 87.5 jam · 54 tiket** (T40 sampai T55, Application Kit, 29 jam, ditambah 2026-10-15 atas permintaan PIC dan menunggu persetujuannya; video demo dibuang atas keputusan PIC; T16, T17, T19, dan T20 ditambah 2026-10-09 atas permintaan PIC; T18 dijadwalkan dan T22 sampai T26 ditambah 2026-10-10 atas permintaan PIC, total 11.5 jam lagi; T27 sampai T39 (lowongan harian, 21.5 jam) ditambah 2026-10-09 atas permintaan PIC. Semuanya melewati 20 jam; PRD §11 menyebut 20 jam sebagai panduan, bukan batas keras. T21 dan FR-33 masih ditunda dan tidak dihitung.)
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
- [x] Klik ikon toolbar membuka side panel (dicek manual oleh PIC)
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
- [x] **T16 selesai**

**Context:** JobFill lama menandai field yang tidak terisi dengan outline kuning di halaman, supaya pengguna langsung tahu mana yang harus diisi sendiri. job-kit baru menampilkan daftar di panel, tetapi tidak menandai halamannya. Dokumen JobFill lama tidak mendefinisikan perilaku ini, jadi rinciannya di bawah adalah asumsi yang perlu dikonfirmasi PIC.

**Asumsi (konfirmasi PIC sebelum dikerjakan)**
1. **Kapan:** outline muncul setelah Fill ditekan, bukan saat panel baru membaca halaman. Ini menjaga prinsip FR-09 bahwa halaman tidak berubah sebelum Fill.
2. **Field mana (diputuskan PIC 2026-10-09):** hanya field **wajib** yang masih kosong setelah Fill, yaitu yang tak terpetakan, yang datanya tidak ada di profil, dan yang dimatikan pengguna. Field opsional yang kosong tidak diberi outline. Field yang berisi (oleh job-kit atau oleh pengguna) tidak ditandai.
   **Daftar "Dilewati" di panel tetap memuat semua field yang tidak terisi**, wajib maupun opsional (tafsiran saya atas "tetap tulis di field yang dilewati"; kalau yang dimaksud tulisan di halaman, kabari). Field wajib di daftar itu diberi penanda "Wajib" supaya cocok dengan outline di halaman.
   **Cara mengenali wajib:** atribut `required`, atau `aria-required="true"`, atau teks labelnya memuat tanda `*` atau `✱`, atau kata "Required" atau "Wajib". Tiga situs yang sudah diukur (Greenhouse, Lever, Intikom) memakai tanda atau kata di label, jadi atribut saja tidak cukup.
3. **Warna:** amber dari token desain (`amber-600`, #DC6803), outline 2px dengan jarak 2px. Kalau PIC ingin kuning yang lebih terang, ganti warnanya; tidak ada konsekuensi lain.
4. **Hilang kapan:** dari satu field begitu pengguna mengisinya; semuanya saat Undo; dan saat halaman dimuat ulang.

**Perubahan dokumen yang ikut (butuh persetujuan PIC karena PRD dan RFC sudah APPROVED)**
- [x] PRD: tambah **FR-20** (Should) di §7, satu baris di §8 ("Field yang tidak terisi setelah Fill ditandai di halaman"), satu catatan di §6.2 layar S1, dan tandai sebagai penambahan 2026-10-09.
- [x] RFC §2: baris **Complexity ban** menyebut "tanpa UI yang disuntik ke halaman lamaran". Ubah menjadi "tanpa elemen baru di halaman lamaran; satu-satunya perubahan visual adalah outline pada field yang sudah ada".
- [x] RFC §8: tambah keputusan **D15** (D9 sampai D14 sudah dipakai Lowongan dan Application Kit) dengan baris Cost (mengubah tampilan halaman milik situs lain; bisa bentrok dengan gaya situs; outline situs sendiri harus dipulihkan).
- [x] Tabel cakupan di bawah: tambah baris FR-20 → T16.

**Acceptance criteria**
- [x] Setelah Fill, setiap field **wajib** yang masih kosong dan terlihat di halaman memiliki outline amber yang jelas (FR-20)
- [x] Field opsional yang kosong tidak diberi outline, tetapi tetap muncul di daftar "Dilewati" (FR-20)
- [x] Di daftar "Dilewati", field wajib diberi penanda "Wajib" (FR-20)
- [x] Sebelum Fill ditekan, tidak ada field yang diberi outline (FR-09)
- [x] Field yang terisi oleh job-kit, dan field yang sudah berisi teks pengguna, tidak diberi outline (FR-20)
- [x] Outline sebuah field hilang begitu pengguna mengisinya (FR-20)
- [x] Undo menghapus semua outline, dan outline milik situs sendiri pada field itu kembali seperti sebelumnya (FR-11, FR-20)
- [x] Field tersembunyi tidak ditandai, dan jumlah elemen di halaman tidak bertambah (RFC §2)
- [x] Panel memberi tahu bahwa field yang belum terisi ditandai di halaman, dengan kalimat yang ditulis ramah dan singkat (FR-20)
- [x] Dropdown dan grup radio wajib yang tidak terisi juga ditandai; untuk grup radio, yang ditandai adalah grupnya, bukan tiap tombol (FR-20)

**Done when:** setelah Fill di form uji dan di satu form sungguhan, field wajib yang harus diisi sendiri langsung terlihat di halaman, dan Undo mengembalikan halaman seperti semula.

**Hasil (2026-10-16):** `core/fill/required.ts` (`isRequiredLabel`: tanda `*` atau `✱` menang; "Required" atau "Wajib" dihitung kecuali ada "optional", "opsional", "not required", "tidak wajib"), `scan.ts` (`required` dari atribut, `aria-required`, atau label, untuk grup radio dari tombol mana pun, radiogroup, atau legend; `emptyRequiredFields`: wajib, kosong menurut isi halaman saat ini, tidak tersembunyi lewat `display:none`, `hidden`, atau `visibility:hidden`), `mark.ts` (`createMarker`: empat properti `outline-*` inline `!important` amber `#DC6803`, 2px, jarak 2px; nilai inline milik situs dicatat dan dikembalikan; tanda dilepas per field saat `input` atau `change` membuat field terisi; grup radio diberi tanda pada fieldset atau radiogroup; Fill ulang mulai dari halaman asli). Logika pesan dipindah ke `entrypoints/page-reader/handlers.ts` supaya bisa diuji di DOM: `scan` tidak memasang apa pun, `fill` menulis nilai lebih dulu lalu memasang tanda dan mengembalikan `marked`, `undo` melepas tanda, dan Undo tersedia selama ada tanda. Panel: `formatMarkedNotice` ("2 field wajib belum terisi, sudah ditandai kuning di halaman."), lencana "Wajib" di daftar Dilewati dan Profil belum punya. PRD: FR-20, baris §8, catatan S1, cakupan; RFC §2 (Complexity ban) dan keputusan **D15**. 1315 tes lulus (1 dilewati), typecheck dan build lolos.
**Penyimpangan:** (1) tiket menyebut keputusan **D9** di RFC; D9 sampai D14 sudah terpakai, jadi nomornya D15. (2) Field wajib yang dimatikan pengguna tidak muncul di daftar Dilewati (daftar itu hanya berisi field tak terpetakan); ia tetap di "Akan diisi" dan di halaman diberi outline. Lencana "Wajib" hanya di Dilewati dan Profil belum punya. (3) Undo juga tersedia bila Fill hanya menghasilkan tanda tanpa mengisi apa pun, supaya tanda bisa dilepas. (4) Tata letak tidak diukur, jadi field yang digeser keluar layar dianggap terlihat.
**Belum diverifikasi:** Fill di form sungguhan di Chrome (Greenhouse, Lever, Intikom) dengan ekstensi terpasang: tampilan outline, bentrok dengan gaya situs, dan Undo pada halaman nyata. Uji memakai DOM happy-dom.

### T17 · Section Data di options (UI saja) · 1.5h · feature · Medium
- [x] **T17 selesai**

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
- [x] **T19 selesai**

**Context:** P6 mensyaratkan membangun agar cocok dengan referensi visual bila PRD §6.3 memilikinya, tetapi build sekarang dibuat dari token dan teks tanpa pernah dibandingkan berdampingan dengan mockup. Dikerjakan di chat terpisah memakai `docs/redesign-prompt.md`.

**Acceptance criteria**
- [x] Tampilan sudah dinilai PIC sesuai mockup (2026-10-16); daftar selisih tertulis tidak dibuat
- [x] Kepala sidebar options memuat logo dan nama "job-kit"; seluruh options dalam satu kartu membulat; dasar sidebar memuat catatan privasi tentang tanpa enkripsi, server, dan akun
- [x] Indikator "Tersimpan" memakai titik hijau seperti mockup; judul halaman memiliki subjudul satu baris
- [x] Layar panel sesuai mockup untuk tab, site header, summary bar, baris field, dan banner
- [x] Tidak ada perubahan perilaku: 174 tes tetap lulus, `typecheck` dan `build` bersih

**Done when:** layar sebelum dan sesudah, dibandingkan dengan mockup, hanya berbeda pada hal yang sengaja diputuskan.

### T20 · Halaman Captured Jobs di options (UI saja) · 1.5h · feature · Medium
- [x] **T20 selesai**

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

### T21 · Lowongan tercatat otomatis setelah Fill · 2h · feature · Medium · **dibatalkan**
- [ ] **T21 selesai** (dibatalkan 2026-10-16 atas keputusan PIC; digantikan T38 dan T41 sampai T44: Fill di tab dari feed membuat atau memajukan lamaran, halaman Lamaran memegang status, riwayat, dan catatan, dan Tambah lamaran menutup lamaran yang tidak berasal dari feed)

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
- [x] Per sumber dicatat di tiket ini: berhasil atau tidak, jumlah lowongan, waktu, ukuran respons, field yang tersedia (terutama tipe kerja, gaji, deadline, teks deskripsi) (FR-27, FR-28)
- [x] LinkedIn: request memakai `credentials: 'omit'`; dicatat berapa halaman berturut-turut sebelum kena 429 atau halaman blokir, dan selector yang dipakai (FR-27)
- [x] `optional_host_permissions` dan `chrome.permissions.request` terbukti jalan dari halaman options; izin wajib di manifest tidak bertambah (FR-32)
- [ ] Satu request ke penyedia AI dari service worker berhasil, termasuk header yang dibutuhkan penyedia untuk request dari browser (FR-29)
- [x] `chrome.sidePanel.open` dari klik di halaman options terbukti membuka panel di tab lain, atau dicatat bahwa tidak bisa (FR-31)
- [x] Ringkasan arsitektur pipeline ditambahkan ke `docs/03-rfc.md`

**Done when:** tabel hasil per sumber ada di tiket ini dan PIC memutuskan daftar sumber v1 (PRD §11).

**Hasil (2026-10-09):** tabel per sumber dan ringkasan pipeline ada di `docs/03-rfc.md` §3.3b. Greenhouse, Lever, Ashby, dan Remotive berhasil dari service worker tanpa izin host; LinkedIn butuh izin dan berhasil 8 halaman berturut-turut tanpa 429 dengan jeda acak. `permissions.request` dari options dan `sidePanel.open` (tab lain dan tab baru) berhasil. Belum: request AI dengan kunci sah. Keputusan PIC yang masih terbuka: daftar sumber v1 dan batas halaman LinkedIn per run (bawaan sekarang 5).

### T28 · Mockup Lowongan di design system · 1.5h · design · Highest
- [x] **T28 selesai**

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
- [x] **T29 selesai**

**Acceptance criteria**
- [x] Tipe `JobPreferences` masuk model profil dengan migrasi skema; profil dan berkas Export lama tetap terbaca (FR-26)
- [x] Tab Preferensi kerja di Profile sesuai T28: role incaran (chip), level, lokasi, tipe kerja (multi), kata kunci wajib dan dihindari, gaji minimum opsional; tersimpan otomatis (FR-26)
- [x] Export dan Import JSON memuat preferensi; Import CV tidak menyentuhnya
- [x] Migrasi dan validasi di `core/` dengan tes ditulis lebih dulu

**Done when:** preferensi bertahan setelah muat ulang dan ikut Export.

**Hasil:** profil naik ke versi 2 (`jobPrefs`), `migrateProfile` dipakai saat membaca storage, berkas Export versi 1 dan 2 terbaca, Import CV tidak menyentuh preferensi (tes), `isProfileEmpty` dan ringkasan panel mengabaikannya supaya Fill tidak aktif hanya karena preferensi. 347 tes hijau, typecheck dan build lolos. Belum diverifikasi: tampilan tab di browser dan "bertahan setelah muat ulang" di Chrome sungguhan. Untuk saat ini Preferensi kerja berupa item sidebar di bawah Custom Field; bentuk tab menunggu T37.

### T30 · Model data lowongan dan penyimpanan feed · 1.5h · feature · High
- [x] **T30 selesai**

**Acceptance criteria**
- [x] Tipe `Job` (bentuk FR-28), `JobStatus` (`new`, `saved`, `applied`, `hidden`), dan `SourceRun` (sumber, waktu, jumlah, sebab gagal) di `core/` (FR-27, FR-28, FR-30)
- [x] Kunci dedupe: URL kanonik (tanpa parameter pelacak), cadangan judul + perusahaan yang dinormalkan. Lowongan yang sudah ada diperbarui datanya tanpa mereset status dan skor (FR-28)
- [x] Pemangkasan: lowongan `new` dan `hidden` yang lebih dari 30 hari atau di atas 500 entri dibuang dari yang tertua; `saved` dan `applied` tidak pernah dibuang otomatis (PRD §8)
- [x] Kunci storage terpisah dari profil; Hapus semua ikut menghapusnya; Export memuat lowongan `saved` dan `applied`
- [x] Tes ditulis lebih dulu

**Done when:** tes merge, dedupe, dan pemangkasan lulus.

**Hasil:** tipe `Job`, `JobStatus`, `SourceRun` di `src/core/feed/` (nama folder baru supaya tidak bentrok dengan `CapturedJob` lama); dedupe lewat URL kanonik dengan cadangan judul+perusahaan, merge tidak mereset status, skor, dan tanda AI; pemangkasan 30 hari / 500 entri hanya untuk new dan hidden; storage terpisah (`local:feed`, `local:feedRuns`); Hapus semua ikut menghapusnya; Export memuat lowongan saved dan applied (Import belum membaca `jobs`). 368 tes hijau, typecheck lolos.

### T31 · Normalisasi, kategori tipe kerja, saringan, dan skor kasar · 1.5h · feature · High
- [x] **T31 selesai**

**Acceptance criteria**
- [x] `classifyWorkplace(job)` → `remote | hybrid | onsite | unknown`: field terstruktur sumber dulu (`workplaceType`, `isRemote`), lalu kata kunci di lokasi dan judul ("Remote", "WFH", "Hybrid", "Anywhere") (FR-28)
- [x] Saringan aturan membuang lowongan dengan kata kunci dihindari, atau tipe kerja dan lokasi di luar preferensi, sebelum AI dipanggil (FR-29)
- [x] Skor kasar: kecocokan role dan skill, level dibanding lama pengalaman, kebaruan (FR-29)
- [x] Deskripsi HTML dibersihkan jadi teks polos dan dipotong untuk prompt
- [x] Fungsi murni di `core/` dengan fixture dari T27

**Done when:** fixture tiap sumber tergolong benar dan saringan terbukti di tes.

**Hasil:** fungsi murni di `src/core/feed/`: `classifyWorkplace`, `passesRules` (kata dihindari, tipe kerja, lokasi), `roughScore`, `htmlToText`/`truncateText`. Fixture respons asli dari spike T27 di `fixtures/jobs/` dan diuji (Ashby, Lever, Greenhouse, Remotive). Keputusan: kata kunci wajib tidak menyaring (sesuai FR-29), hanya menambah skor; teks bantuan di Preferensi kerja diubah. Greenhouse tidak punya field tipe kerja, jadi hanya teks lokasi yang menentukan (sisanya unknown, bisa diisi AI di T35).

### T32 · Adapter sumber API: ATS dan Remotive · 2h · feature · High
- [x] **T32 selesai**

**Acceptance criteria**
- [x] Antarmuka `JobSource { id, fetch(prefs, ctx) }`; satu adapter per sumber yang lolos T27: Greenhouse, Lever, Ashby (per perusahaan pilihan), Remotive (FR-27)
- [x] Tiap adapter memetakan ke `Job` (FR-28); fixture respons asli disimpan di `fixtures/jobs/`
- [x] Timeout per request dan satu kali retry. Kegagalan jadi `SourceRun` dengan sebab (`blocked`, `timeout`, `parse`, `http-xxx`), bukan exception yang menghentikan run (FR-27)
- [x] Tes memakai fixture, tanpa jaringan

**Done when:** semua adapter lulus tes fixture dan satu run nyata di Chrome mengisi storage.

**Hasil:** antarmuka `JobSource` dan adapter Greenhouse, Lever (`limit=100`, karena papan penuh lambat), Ashby, Remotive (satu pencarian per role, maksimal tiga) di `src/core/feed/sources/`. `fetchJson`: timeout, satu retry (timeout, network, 5xx), 429/403 jadi `blocked`, `credentials: 'omit'`. `runSource` tidak pernah melempar; satu perusahaan gagal tidak menggagalkan sumber. 19 tes memakai fixture asli tanpa jaringan. Belum: run nyata di Chrome yang mengisi storage (menunggu T36 dan spike T27 dijalankan).

### T33 · Adapter scraping LinkedIn (halaman publik) · 2h · feature · High
- [x] **T33 selesai**

**Context:** PIC butuh scraping (keputusan 2026-10-09). Hanya halaman publik tanpa login. Risiko ToS dan blokir diterima PIC dan dibatasi lewat AC di bawah (PRD §4.1). HTML diparse di offscreen document.

**Acceptance criteria**
- [x] Query dibangun dari preferensi: role, lokasi, filter remote (FR-27)
- [x] Request tanpa cookie, paling banyak N halaman per run (angka dari T27), jeda acak antar request, satu run otomatis per hari (FR-27)
- [x] Semua selector di satu berkas. Struktur berubah → `SourceRun` `parse` dengan jumlah 0, bukan crash (PRD §8)
- [x] Halaman detail (untuk teks deskripsi) hanya diambil untuk lowongan yang lolos saringan T31
- [x] Gagal 3 run berturut-turut → sumber dijeda dan header S4 memberi tahu (PRD §8)
- [x] Tes parser memakai HTML fixture tersimpan, termasuk satu fixture rusak

**Done when:** run nyata di Chrome menghasilkan lowongan LinkedIn ternormalisasi, dan fixture rusak menghasilkan `parse`, bukan error.

**Hasil:** adapter LinkedIn halaman publik: selector di satu berkas (`linkedin-selectors.ts`), parser dijalankan di offscreen document (entrypoint `offscreen`, izin `offscreen` ditambah; `alarms` ikut ditambah untuk T36, keduanya tanpa peringatan instal), query dari role, lokasi pertama, dan filter tipe kerja, jeda acak antar request, tanpa cookie, batas halaman bawaan 5 per run (angka final menunggu keputusan PIC setelah spike T27), detail hanya untuk lowongan yang lolos `passesRules` (maks 30), blokir di tengah jalan mempertahankan hasil yang sudah ada, layout berubah menjadi `parse`. `shouldPause`: tiga run gagal berturut-turut. Fixture nyata dan fixture rusak diuji. Belum: run nyata di Chrome dan 'satu run otomatis per hari' (T36); header S4 yang memberi tahu sumber dijeda (T37).

### T34 · Atur Lowongan: sumber, izin, dan klien AI · 1.5h · feature · High
- [x] **T34 selesai**

**Acceptance criteria**
- [x] S6 sesuai T28: nyala/mati per sumber, daftar perusahaan ATS, jam ambil, penyedia, model, kunci API (input tersembunyi), Tes koneksi dengan hasil jelas (FR-32)
- [x] Izin host diminta saat sumber atau AI dinyalakan; menolak izin membuat sumber itu tetap mati (FR-32)
- [x] Kunci di `storage.local` terpisah dari profil, tidak ikut Export, ikut Hapus semua (FR-32)
- [x] Klien AI di `platform/` dengan timeout dan pemetaan error (`invalid-key`, `quota`, `network`)
- [x] Lowongan tidak bisa dinyalakan selama Preferensi kerja kosong (PRD §8)

**Done when:** Tes koneksi berhasil dengan kunci sah dan gagal dengan pesan spesifik untuk kunci salah.

**Hasil:** pengaturan (`FeedSettings`) dan kunci API di storage terpisah (`local:feedSettings`, `local:aiKey`; tidak masuk Export; Hapus semua ikut menghapus). Izin host diminta per sumber saat dinyalakan lewat `requestOrigins` dari klik, menolak membuat sumber tetap mati, izin yang dicabut menampilkan 'Izin dibutuhkan' + Beri izin. Klien Anthropic di `platform/ai-client.ts` (timeout, pemetaan error `invalid-key`, `quota`, `network`, `server`, `bad-request`). Sumber tidak bisa dinyalakan tanpa minimal satu role incaran. S6 jadi halaman 'Atur Lowongan' sementara di sidebar (pindah di balik tombol Atur pada T37); daftar perusahaan tampil per ATS yang dinyalakan, bukan satu daftar bersama. 457 tes hijau, typecheck dan build lolos. Belum diverifikasi: Tes koneksi dengan kunci sungguhan, dialog izin Chrome, dan tampilan halaman.

### T35 · Skor AI dan alasan · 2h · feature · High
- [ ] **T35 selesai**

**Acceptance criteria**
- [x] Ringkasan profil yang dikirim hanya berisi field di PRD §4.1. Tes memastikan nama, email, telepon, alamat, dan tanggal lahir tidak ada di payload (FR-29)
- [x] Lowongan dinilai per batch; output terstruktur (skor 0–100, `matches[]`, `gaps[]`, ringkasan) divalidasi; output tidak valid → skor kasar (FR-29, PRD §8)
- [x] AI juga mengisi field yang masih kosong setelah normalisasi bila jelas dari teks (tipe kerja, level, pengalaman, gaji), ditandai berasal dari AI (FR-28)
- [x] Skor di-cache per lowongan dengan hash profil + preferensi; tidak dihitung ulang tanpa perubahan (FR-29)
- [x] Batas per run: paling banyak 50 lowongan dinilai AI (bisa diubah), sisanya skor kasar
- [ ] Tes memakai klien palsu; satu run nyata dicatat dengan jumlah token dan perkiraan biaya

**Done when:** run nyata menghasilkan skor dan alasan, dan mencabut kunci menghasilkan "Skor kasar".

**Hasil:** `src/core/ai/score.ts`: ringkasan profil hanya berisi field PRD §4.1 (tes memastikan nama, email, telepon, alamat, tanggal lahir, sekolah, perusahaan, dan custom field tidak ada di payload), batch 5 lowongan per request, output divalidasi per item (item tidak valid dibuang, tidak diperbaiki), tidak valid → skor kasar, key ditolak atau quota habis → berhenti memanggil AI dan sisanya skor kasar dengan sebab dicatat (`aiProblem`), skor di-cache dengan hash ringkasan sehingga hanya dihitung ulang bila profil atau preferensi berubah, batas 50 lowongan per run, field kosong diisi AI dan ditandai (`aiFilled`). Klien AI sekarang mengembalikan pemakaian token. Belum: satu run nyata dengan jumlah token dan perkiraan biaya (butuh kunci API; tabel harga tidak saya tebak).

### T36 · Jadwal harian dan Segarkan · 1.5h · feature · High
- [x] **T36 selesai**

**Acceptance criteria**
- [x] `chrome.alarms` sekali sehari pada jam dari S6; run yang terlewat berjalan saat Chrome dibuka; paling banyak satu run otomatis per hari (FR-27, PRD §8)
- [x] Pipeline: sumber paralel → normalisasi → dedupe/merge → saringan → skor → simpan. Progres per tahap dikirim ke halaman yang terbuka
- [x] Segarkan menjalankan run sekarang; selama berjalan tombol nonaktif "Sedang mengambil…" dan run kedua ditolak (PRD §8)
- [x] Badge jumlah lowongan baru di item Lowongan di sidebar; hilang setelah halaman dibuka

**Done when:** alarm uji (interval dipendekkan di build dev) menjalankan run penuh tanpa halaman options terbuka.

**Hasil:** pipeline murni `runFeed` (sumber paralel → saringan aturan → merge/prune → skor; sumber yang gagal tiga kali dilewati) dan jadwal murni (`isRunDue`, `nextRunTime`, `canStartRun`, `countNew`) di `src/core/feed/`, 23 tes. Di platform: `executeRun` menjaga satu run sekaligus dan menulis `feedState` supaya halaman terbuka bisa mengikuti tahapnya; background memakai alarm `feed-tick` tiap 15 menit (1 menit di build dev) yang hanya membandingkan tanggal, dengan batas satu run otomatis per hari dari `isRunDue`, dan mengejar run yang terlewat saat Chrome dibuka; pesan `feed:refresh` untuk Segarkan. Badge jumlah baru di sidebar (sementara di item Captured Jobs), hilang saat halaman dibuka. Tombol Segarkan dan status run terakhir sementara ada di halaman Atur Lowongan (pindah ke header Lowongan di T37). Risiko: service worker MV3 bisa dimatikan Chrome di tengah run yang panjang. Belum diverifikasi di Chrome: alarm uji dan run penuh tanpa halaman options terbuka.

### T37 · Halaman Lowongan · 2h · feature · High
- [x] **T37 selesai**

**Acceptance criteria**
- [x] Sidebar dan tab sesuai T28; tab Disimpan memakai ulang komponen Captured Jobs dari T20 (FR-30)
- [x] Kartu, filter tipe kerja, urutan, pencarian, dan ubah status. Filter, urut, dan cari adalah fungsi murni di `core/` dengan tes (FR-30)
- [x] Panel alasan skor per kartu; "Skor kasar" ditandai (FR-29)
- [x] Semua state dari T28 terlihat lewat `#jobs?state=...` di build dev
- [x] Token, ikon lucide-react, tanpa kontrol bawaan peramban; rapi di ≤420 px (urutan memakai `Select` bertoken dengan `hideLabel`; dilihat di 375 px, tanpa overflow horizontal)

**Done when:** feed nyata dari T36 tampil dan semua state terlihat di Chrome sungguhan.

**Hasil:** sidebar tiga tujuan (Profile, Lowongan dengan badge, Data); bagian profil jadi tab (tautan lama seperti `#contact` tetap membuka tab itu); halaman Lowongan dengan tab Rekomendasi dan Disimpan, kartu (skor tiga tingkat, panel alasan, chip bertanda AI, meta yang menyembunyikan item kosong, menu Tandai dilamar dan Sembunyikan), filter tipe kerja, urutan, pencarian, header dengan Segarkan dan Atur, dan Atur Lowongan sebagai sub-halaman dengan tombol kembali. Filter, urut, cari, tingkat skor, meta, ringkasan header, dan penentu state adalah fungsi murni di `core/feed/view.ts` (24 tes). Semua state T28 terlihat lewat `#jobs?state=list|saved|off|noprefs|fetching|empty|nomatch|onefail|paused|rough|allfail` di build dev, dan 11 tes render memastikannya. Penyimpangan dari mockup: tab Profile berdiri di atas kartu bagian, belum menyatu dengan lembar; di Disimpan, klik baris membuka lowongan, belum ada slide-over detail. Kode Captured Jobs lama (`src/core/jobs/`, `JobDetail.tsx`, `StatusBadge.tsx`) sudah tidak dipakai tetapi belum dihapus karena hook menolak `git rm`; perlu dihapus manual (sudah dihapus di T41). Belum diverifikasi: tampilan di Chrome dan ≤420 px, feed nyata dari T36.

**Hasil lanjutan (2026-10-16):** dropdown urutan memakai primitif `Select` (prop baru `hideLabel`, label tetap ada untuk pembaca layar) menggantikan `<select>` bawaan. Diperiksa di build dev dengan data contoh pada 375 px: tidak ada overflow horizontal dan tidak ada `<select>` bawaan di halaman. Belum diverifikasi: feed nyata dari T36 di Chrome (menunggu kunci API dan run pertama).

### T38 · Buka & isi · 1.5h · feature · Medium
- [x] **T38 selesai**

**Acceptance criteria**
- [x] Buka & isi membuka URL di tab baru dan side panel di tab itu (sesuai hasil T27) (FR-31)
- [x] Panel menampilkan konteks kecil "Dari Lowongan · skor 86" bila tab berasal dari feed
- [x] Fill berhasil di tab itu → status lowongan jadi Dilamar (FR-31). Untuk lowongan dari feed, ini menggantikan T21 (FR-24)
- [x] Bila panel tidak bisa dibuka otomatis, tab tetap terbuka dengan petunjuk "Klik ikon job-kit untuk mengisi"

**Done when:** alur dari kartu sampai status Dilamar jalan di Chrome pada satu form Greenhouse.

**Hasil:** Buka & isi membuka URL di tab baru lalu `sidePanel.open` di tab itu; tab dicatat di `session:openedJobs` (`platform/opened-jobs.ts`, dibersihkan saat tab ditutup). Panel menampilkan 'Dari Lowongan · skor 86' (atau 'skor kasar 58') di tab Autofill. Fill yang mengisi minimal satu field di tab itu menandai lowongan Dilamar (`shouldMarkApplied`, 6 tes untuk fungsi murninya). Bila panel menolak dibuka, tab tetap terbuka dan halaman Lowongan menampilkan 'Tab terbuka. Klik ikon job-kit untuk mengisi.' Belum diverifikasi di Chrome: apakah `sidePanel.open` dari halaman options setelah `tabs.create` masih dianggap user gesture (itu yang diukur spike T27, langkah 5), dan alur penuh pada form Greenhouse.

### T39 · Uji 5 hari dan README · 1h · launch · Medium
- [ ] **T39 selesai**

**Acceptance criteria**
- [ ] 5 hari run harian; per hari dicatat jumlah lowongan, sumber gagal, biaya AI, dan berapa dari 10 teratas yang layak menurut PIC (PRD §10)
- [x] README: fitur Lowongan, daftar sumber, data apa yang dikirim ke penyedia AI, risiko scraping, izin yang diminta; bagian Privasi dan "Yang tidak dilakukan" ditulis ulang
- [x] `docs/03-rfc.md` sesuai implementasi akhir

**Done when:** metrik lowongan harian di PRD §10 tercatat di tiket ini.

**Hasil:** README ditulis ulang (fitur Lowongan, daftar sumber, data yang dikirim ke penyedia AI, risiko scraping, izin yang diminta, bagian Privasi dan 'Yang tidak dilakukan'), dan RFC §3.3b, D9, D10 mencatat pipeline, model data, hasil spike dari terminal, dan risiko. Belum: uji 5 hari dan metrik PRD §10, karena butuh fitur dijalankan di Chrome dengan kunci API dan penilaian PIC atas 10 teratas tiap hari. RFC masih menyebut spike Chrome (`spikes/t27/`) belum dijalankan.

---

## Application Kit (revisi PRD 2026-10-15)

Sumber: PRD §4.2, §6.8, FR-34 sampai FR-48; RFC §3.3c. **Status: usulan, menunggu persetujuan PIC.** Pola kerja sama dengan Lowongan harian: mockup dulu (T40), fondasi tanpa AI (T41 sampai T44), satu spike sebagai gerbang sebelum fitur AI (T45), lalu CV, surat, dan penutup. Tes ditulis lebih dulu; fungsi murni di `core/`, I/O di `platform/`.

```
T40 mockup ── PIC setuju
  │
  ├─ T41 model ─ T42 sinkron status ─ T43 halaman Lamaran ─ T44 Siapkan lamaran + Detail
  │                                                              │
  └─ T45 spike (gerbang) ─ T46 pemeriksa fakta ─ T47 payload privasi ─ T48 susun CV ─ T49 pratinjau ─ T50 PDF
                                 └──────────────────────────────────── T51 surat ─ T52 editor + isi form
                                                            T53 tindak lanjut ─ T54 visualisasi alur ─ T55 uji + dokumen
```

Gerbang: bila T45 menunjukkan model sering mengarang atau biayanya terlalu tinggi, T46 sampai T52 dirancang ulang sebelum ada kode AI yang terbuang. T41 sampai T44 tidak bergantung pada T45.

**Done when:** pada 5 lamaran nyata, CV dan surat siap diunduh dalam ≤3 menit, nol fakta karangan, dan status lamaran terlacak sampai hasil akhir (PRD §10).

### T40 · Mockup Application Kit di design system · 1.5h · design · Highest
- [ ] **T40 selesai**

**Context:** sama seperti T28: mockup dulu di `docs/design-system.html`, tanpa menyentuh produk. Referensi: diagram alur dari PIC (C. Automatic CV by Company Requirement, Cover Letter, Job Tracker).

**Acceptance criteria**
- [x] Sidebar bertambah Lamaran (badge tindak lanjut); kartu Lowongan dengan Siapkan lamaran dan Buka lamaran (FR-34)
- [x] S7 Lamaran: satu penukar tampilan (segmented, kanan atas) **Papan** (lima kolom + lipatan Ditutup) / **Visualisasi** (Sankey); tanpa tampilan Daftar (keputusan PIC 2026-10-15); daftar batang di lebar sempit; state kosong, tanpa hasil, tab Visualisasi kosong, tindak lanjut jatuh tempo; peta badge status (FR-35, FR-47, FR-48)
- [x] S8 Detail Lamaran: tab Ringkasan, CV (cakupan, diff, Tervalidasi, Unduh PDF), Surat, Catatan & riwayat (FR-37, FR-39 sampai FR-43)
- [x] State CV: belum dibuat, sedang membuat, ditolak pemeriksa fakta, profil berubah, AI tidak tersedia, batas harian, model gratis, tanpa pengalaman (PRD §8)
- [x] Tambahan S1 Panel: baris Cover letter, field unggah dilewati, lencana konteks, pesan setelah Fill (FR-44, FR-36)
- [x] Hanya token dan komponen yang ada ditambah delapan komponen baru yang didaftar di `design-system.md` §4.4; tanpa overflow horizontal di 420 px

**Hasil:** mockup di `docs/design-system.html` §9 (kartu Lowongan, S7 Papan, S7 Visualisasi, S7 empat state, S8 Ringkasan, S8 CV hasil + delapan state, S8 Surat, S8 Catatan & riwayat, dua frame panel, lebar ≤420 px). Dicek di browser: papan lima kolom (166 px per kolom) dan diff terbaca; tidak ada overflow horizontal di bagian ini pada viewport 424 px. Menunggu persetujuan PIC.

**Done when:** PIC menyetujui mockup.

### T41 · Model Lamaran dan penyimpanan · 2h · feature · Highest
- [x] **T41 selesai**

**Context:** fondasi. `Application` menjadi sumber kebenaran status (RFC D11).

**Acceptance criteria**
- [x] Tipe `Application`, `AppStatus` (`draft`, `applied`, `in-review`, `interview`, `offer`, `rejected`, `withdrawn`), `AppEvent` di `core/applications/` (FR-34, FR-37)
- [x] `local:applications` terpisah dari profil; badan CV dan surat di `local:tailoredCvs` dan `local:coverLetters` supaya daftar tidak memuat dokumen besar (RFC §3.3c)
- [x] `createApplication(job, now)`: satu lamaran per lowongan, dengan salinan lowongan; panggilan kedua mengembalikan yang ada (FR-34)
- [x] `setStatus` menambah event; `advanceOnFill` hanya memajukan Draft dan tidak pernah memundurkan (FR-36)
- [x] Hapus lamaran ikut menghapus CV dan suratnya; Export, Import (Gabung dan Ganti), dan Hapus semua mencakup ketiganya; versi berkas Export naik dan berkas lama tetap terbaca (FR-38)
- [x] Kode Captured Jobs lama yang belum terhapus (lihat catatan T37) dihapus karena Lamaran menggantikannya
- [x] Tes ditulis lebih dulu

**Done when:** tes pembuatan, status, event, ekspor-impor, dan hapus lulus.

**Hasil:** `core/applications/`: tipe (`types.ts`, persis RFC §3.3c), `createApplication`, `findByJobId`, `setStatus`, `advanceOnFill`, `updateApplication`, `deleteApplication` (`applications.ts`), dan baca/gabung data (`data.ts`: `normalizeApplicationData`, `applyApplicationData`, `countAddedApplications`). Tiga key terpisah di `platform/application-storage.ts` (`local:applications`, `local:tailoredCvs`, `local:coverLetters`); menyimpan daftar saja menulis satu key, dokumen tanpa lamaran dibuang saat dibaca, kuota penuh mengembalikan `storage-full`. Export naik ke versi 3 (`applications`, `cvs`, `letters`); versi 1 dan 2 tetap terbaca dan **tidak menyentuh lamaran yang ada** (Ganti dengan berkas lama tidak menghapus lamaran). Gabung hanya menambah lamaran yang belum ada (id sama, lowongan sama, atau URL sama bila keduanya tanpa lowongan feed); entri rusak dilewati tanpa menolak seluruh berkas. Pratinjau import punya baris "Lamaran", Hapus semua ikut menghapus ketiganya, dan teks kartu Data disesuaikan. Kode Captured Jobs lama (`src/core/jobs/`, `JobDetail.tsx`, `StatusBadge.tsx`) dihapus. 616 tes hijau (naik dari 563), typecheck dan build lolos. Tes alur penuh Export, Hapus semua, Import (Gabung dan Ganti) ada di `application-storage.test.ts`. Penyimpangan kecil: `createApplication(apps, job, now, newId)` menerima daftar lamaran supaya "satu lamaran per lowongan" bisa diuji sebagai fungsi murni; lowongan yang sudah ditandai Dilamar membuat lamaran berstatus Dilamar (bukan Draft) supaya keduanya tidak berselisih sejak awal. Belum diverifikasi: tampilan halaman Data di Chrome (ekspor/impor/hapus dengan data nyata).

### T42 · Sinkron status lamaran dan lowongan · 1.5h · feature · Highest
- [x] **T42 selesai**

**Acceptance criteria**
- [x] `deriveJobStatus(app)` murni: Draft dan Dibatalkan menghasilkan Disimpan, Dilamar atau lebih menghasilkan Dilamar (FR-36)
- [x] `shouldMarkApplied` (T38) membuat atau memajukan lamaran lewat `advanceOnFill`; Fill di lamaran Interview atau lebih tidak mengubah status (PRD §8)
- [x] Mengubah status lamaran memperbarui status lowongan di feed; lowongan yang sudah dipangkas dari feed tidak menyebabkan error (PRD §8)
- [x] Menghapus lamaran membuat lowongan berstatus Disimpan
- [x] Tab Disimpan tidak berubah perilakunya

**Done when:** tes sinkron dua arah lulus dan alur T38 (kartu sampai Dilamar) memunculkan lamaran.

**Hasil:** `core/applications/sync.ts` (murni, 17 tes): `deriveJobStatus` (Draft dan Dibatalkan menjadi Disimpan, Dilamar sampai Ditolak menjadi Dilamar), `syncJobStatus`, `syncFeed`, `releaseJob`; lowongan yang sudah dipangkas atau lamaran tanpa lowongan feed tidak menyebabkan error dan mengembalikan feed yang sama. `platform/applications.ts` (21 tes dengan `fakeBrowser`): `prepareApplication`, `recordFill`, `markJobApplied`, `changeApplicationStatus`, `patchApplication`, `removeApplication`, `syncFeedWithApplications`; tiap perubahan menyimpan lamaran lebih dulu lalu menyamakan feed, dan kuota penuh mengembalikan `storage-full` tanpa mengubah feed. `useFill` kini memanggil `recordFill` (menggantikan `markApplied` yang dihapus dari `opened-jobs.ts`): Fill membuat lamaran bila belum ada, memajukan hanya Draft, dan Fill di Interview atau lebih tidak mengubah apa pun (tes untuk keempat status). Menu "Tandai dilamar" di kartu juga lewat lamaran (`useFeed.changeStatus`), dan setelah Import feed disamakan dengan lamaran. Kartu dan baris Disimpan yang punya lamaran tidak punya menu status lagi (statusnya mengikuti lamaran, D11); ini penyimpangan kecil dari kartu lama, supaya status tidak bisa berselisih. Tab Disimpan tidak diubah. 662 tes hijau, typecheck dan build lolos. Belum diverifikasi: alur T38 di Chrome sungguhan (Buka & isi lalu Fill pada form Greenhouse sampai lamaran muncul); yang teruji adalah `recordFill` dan fungsi di sekitarnya terhadap `fakeBrowser`.

### T43 · Halaman Lamaran (S7) · 2h · feature · High
- [x] **T43 selesai**

**Acceptance criteria**
- [x] Sidebar empat tujuan (Profile, Lowongan, Lamaran, Data); badge amber menghitung tindak lanjut jatuh tempo (FR-47 bila sudah ada, kalau belum 0 disembunyikan)
- [x] Penukar tampilan segmented di kanan atas (Papan / Visualisasi; Visualisasi diisi T54). Papan: lima kolom + lipatan Ditutup dan kotak cari; tanpa tampilan Daftar (FR-35). Cari dan pengelompokan per kolom: fungsi murni di `core/applications/view.ts` dengan tes
- [x] Peta badge status sesuai T40
- [x] State kosong dan cari tanpa hasil; semua state lewat `#applications?state=...` di build dev
- [x] Token dan ikon lucide-react; rapi di ≤420 px (kolom kosong disembunyikan) (dilihat di browser pada 375 px, tanpa overflow horizontal; lihat catatan verifikasi di T44)

**Done when:** lamaran dari T42 tampil di papan, dan status yang diubah pindah kolom setelah muat ulang.

**Hasil:** `core/applications/view.ts` (23 tes): `STATUS_LABEL`, `STATUS_TONE` (peta badge T40), `searchApplications` (judul dan perusahaan), `groupBoard` (lima kolom, terbaru di atas; Ditolak dan Dibatalkan dipisah), `closedSummary` ("Ditutup: Ditolak 3 · Dibatalkan 1"), `describeApplications`, `documentMarks`, `appliedLabel`, `formatShortDate`, `DETAIL_TABS`. Sidebar empat tujuan dengan badge amber per halaman (`applications` dikirim 0 sampai T53, jadi tersembunyi); rute `#applications` dan `#applications/<id>`. `ApplicationsPage` memakai kartu papan, lipatan Ditutup (Tampilkan/Sembunyikan), kotak cari, penukar Papan/Visualisasi di header (`ViewToggle`), dan state kosong serta tanpa hasil lewat `EmptyState.tsx` (diekstrak dari JobsPage, perilaku sama). Semua state lewat `#applications?state=list|empty|nomatch|closed|viz` di build dev (data contoh di `core/applications/preview.ts`, tes render di `ApplicationsPage.test.tsx`). Visualisasi sengaja berisi kartu kosong "belum tersedia" sampai T54. 711 tes hijau, typecheck dan build lolos. Penyimpangan dari mockup: kolom papan memakai container query (5 kolom bila lebar isi ≥760 px, 2 kolom ≥480 px, satu kolom di bawahnya, kolom kosong disembunyikan di bawah 760 px) alih-alih satu breakpoint 420 px, karena lebar isi options sempit di jendela menengah; peringatan tindak lanjut jatuh tempo belum ada (FR-47, T53); kartu belum menampilkan badge Interview bertanggal (model belum menyimpan tanggal interview). Mengklik kartu belum membuka apa-apa sampai Detail Lamaran selesai di T44. Belum diverifikasi: tampilan di Chrome dan ≤420 px, "status yang diubah pindah kolom setelah muat ulang" (pengubah status ada di T44).

**Tambahan atas permintaan PIC 2026-10-15 (setelah tiket selesai): seret-lepas di papan.** Kartu papan dan baris di lipatan Ditutup bisa diseret ke kolom lain untuk mengubah status (`changeApplicationStatus`, jadi riwayat dan status lowongan ikut). Selagi menyeret, muncul target "Lepas di sini: Ditolak" dan "Dibatalkan" (keduanya dilipat), kolom kosong ikut tampil di lebar sempit, kolom yang disorot diberi garis putus aksen, dan pembaca layar mendapat pesan "… dipindah ke …". Menjatuhkan di kolom asal tidak mengubah apa pun. Memakai drag-and-drop bawaan browser tanpa pustaka; pilihan Status di Detail Lamaran tetap ada sebagai cara lewat papan keyboard. 9 tes baru; urutan event drag juga dicoba di halaman nyata (kartu pindah, riwayat tercatat, kolom terhitung ulang). Belum diverifikasi: gestur seret dengan mouse sungguhan (mouse sintetis di panel browser tidak memicu drag bawaan), dan layar sentuh (HTML5 drag tidak jalan di sentuh; Detail Lamaran tetap bisa dipakai). PRD §6.8, `design-system.md` §4.4, `screens.md` §4.4, dan catatan di `design-system.html` §9 masih menulis "tanpa seret-lepas"; belum diubah menunggu persetujuan PIC.

### T44 · Siapkan lamaran dan Detail Lamaran · 2h · feature · High
- [x] **T44 selesai**

**Acceptance criteria**
- [x] Kartu Lowongan: Siapkan lamaran (membuat lamaran dan menyimpan lowongan) atau Buka lamaran bila sudah ada; Simpan menjadi tombol ikon (FR-34)
- [x] Detail Lamaran (S8) sebagai sub-halaman dengan tombol kembali: header, pilihan status, Buka lowongan; tab Ringkasan, CV (kerangka, diisi T49), Surat (kerangka, diisi T52), Catatan & riwayat (FR-37)
- [x] Ringkasan: daftar langkah Siap melamar, ringkasan lowongan dari salinan, kotak tempel teks lowongan bila kosong (PRD §8)
- [x] Catatan, tanggal tindak lanjut, riwayat otomatis; simpan otomatis dengan indikator Tersimpan (FR-37)
- [x] Hapus lamaran dengan konfirmasi (FR-38)

**Done when:** dari kartu sampai Detail jalan, status dan catatan bertahan setelah muat ulang.

**Hasil:** Kartu Lowongan: **Siapkan lamaran** (membuat lamaran, menyimpan lowongan, lalu membuka Detail) atau **Buka lamaran** bila sudah ada, **Simpan** jadi tombol ikon, dan baris lamaran (status + penanda CV/Surat) di kartu; baris tab Disimpan yang punya lamaran mendapat tombol Buka lamaran. `ApplicationDetailPage` (sub-halaman dengan tombol kembali): header (judul, perusahaan, sumber, tanggal disiapkan), pilihan status (tujuh status), Buka lowongan (tautan dari salinan URL), empat tab. Ringkasan: daftar langkah Siap melamar, teks lowongan dari salinan, kotak **Tempel teks lowongan** bila kosong (tersimpan ke salinan), tanggal tindak lanjut, dan Buka & isi dari lamaran (`openApplication`, URL dari salinan sehingga jalan walau lowongan sudah dipangkas). Catatan & riwayat: catatan bebas, tanggal tindak lanjut, riwayat otomatis terbaru di atas (`core/applications/detail.ts`), simpan otomatis 500 ms dengan indikator Tersimpan dan pesan bila penyimpanan penuh. Hapus lamaran lewat konfirmasi yang menyebut CV dan surat ikut terhapus. Tab CV dan Surat berupa kerangka: tombol Buat CV/Buat surat nonaktif dengan sebabnya ("belum tersedia di versi ini"), diisi T49 dan T52. State lewat `#applications?state=detail|detail-cv|detail-letter|detail-notes|detail-nodesc` di build dev. 747 tes hijau, typecheck dan build lolos. Penyimpangan: (1) kartu yang disiapkan langsung pindah ke tab Disimpan (status lowongan menjadi Disimpan, FR-36), jadi "Buka lamaran" terlihat di baris Disimpan, bukan di tab Rekomendasi seperti pada gambar mockup; (2) ringkasan lowongan memakai isi salinan (judul, perusahaan, sumber, teks), tanpa chip lokasi/gaji karena salinan di RFC §3.3c tidak menyimpannya; (3) kartu dan baris dengan lamaran tidak punya menu status (D11); (4) ikon status pada riwayat berupa titik berwarna, bukan ikon per jenis; (5) `detail.test.ts` ditulis lebih dulu tetapi tidak sempat dijalankan merah sebelum implementasi. Diverifikasi di browser (halaman options sungguhan dengan storage palsu `fakeBrowser` yang disimpan ke `localStorage`, bukan Chrome dengan ekstensi terpasang): kartu → Siapkan lamaran → Detail, ubah status ke Interview (badge sidebar dan status feed ikut berubah), catatan tersimpan, muat ulang (kartu ada di kolom Interview, catatan ada), Tandai dilamar dari menu kartu, tab Disimpan dengan Buka lamaran, Hapus lamaran (lowongan kembali Disimpan), Export → Hapus semua → Import (lamaran, CV, surat, catatan kembali), dan tampilan 375 px (papan, Detail, kartu Lowongan; tanpa overflow horizontal). Dua cacat tampilan ditemukan dan diperbaiki: penukar Papan/Visualisasi terpotong di ≤420 px, dan indikator Tersimpan yang kosong menggeser kontrol header Detail. Belum diverifikasi di Chrome dengan ekstensi terpasang: Buka & isi (tab baru dan panel terbuka otomatis), Fill pada form Greenhouse yang memunculkan lamaran, dan unduhan berkas Export sungguhan.

**Tambahan atas permintaan PIC 2026-10-15 (setelah tiket selesai): tambah lamaran manual.** Tombol **Tambah lamaran** di halaman Lamaran (di samping kotak cari, dan di state kosong) membuka form: Judul lowongan dan Perusahaan wajib; Link (harus http atau https), Status (Draft atau Sudah dilamar), dan Teks lowongan opsional. Hasilnya lamaran tanpa lowongan feed (`jobId` null, sumber `manual`, label "Manual"), satu lamaran per link (link yang sama membuka yang ada), lalu Detail terbuka. Di Detail, lamaran manual punya kolom Link yang tersimpan otomatis; tanpa link, tautan Buka lowongan hilang dan Buka & isi nonaktif dengan alasannya. Fungsi murni `createManualApplication` dan `validateManual` di `core/applications/applications.ts`, `addManualApplication` di platform, form di `ManualForm.tsx`; 27 tes baru. Dicoba di halaman nyata (kosong → form → simpan → Detail). Belum ada: mengisi judul dan perusahaan otomatis dari link (butuh mengambil halaman luar), dan Fill pada tab yang bukan dari Buka & isi tetap tidak membuat lamaran (T21). PRD §11 baris "Pencatatan lamaran manual" dan FR-34 belum diperbarui menunggu PIC.

### T45 · Spike: kualitas penyesuaian CV · 2h · spike · Highest
- [x] **T45 selesai**

**Context:** gerbang fitur AI. Skrip di `spikes/t45/` (pola T27), dijalankan dari terminal dengan kunci Zen atau Anthropic. Bahan: 3 profil sintetis × 3 lowongan nyata dari `fixtures/jobs/`. Tidak menyentuh produk.

**Acceptance criteria**
- [x] Bandingkan satu panggilan (requirement dan draf sekaligus) dengan dua panggilan: mutu, token, biaya, waktu (FR-39) (lengkap di `3.5-flash-lite`; `3.6-flash` hanya 4 dari 9 pasangan dua-panggilan karena kuota harian)
- [x] Per hasil, hitung skill, angka, dan istilah di luar Profile dengan pemeriksa kasar; catat berapa yang lolos tanpa dan dengan pemeriksa fakta (FR-40)
- [x] PIC menilai 9 hasil: apakah butir yang diubah benar-benar lebih selaras dan tidak berlebihan (FR-39) (dinilai 2026-10-16 lewat `spikes/t45/results/rating.html`, `3.6-flash`: satu panggilan jujur 5,0 dan selaras 4,8 (9 nilai); dua panggilan jujur 4,75 dan selaras 4,75 (4 nilai); pada 4 pasangan imbang, dua panggilan tidak lebih baik; satu-satunya Jujur di bawah 5: kartu 4 dua panggilan = 4, tanpa catatan)
- [ ] Bandingkan model gratis Zen dengan model berbayar; catat peringatan data (PRD §4.2) (Zen tidak terukur dari terminal: 403 gratis, 402 berbayar; pembanding dipindah ke Gemini; peringatan data dicatat)
- [x] Hasil dicatat di tiket ini dan RFC §3.3c

**Done when:** PIC memutuskan lanjut ke T46 atau merancang ulang, dan satu atau dua panggilan dipilih.

**Hasil (2026-10-15, menunggu penilaian PIC):** skrip di `spikes/t45/` (`profiles.mjs`, `jobs.mjs`, `check.mjs` dengan 6 tes di `check.selftest.mjs`, `lib.mjs`, `run.mjs`, `report.mjs`); hasil mentah dan ringkasan di `spikes/t45/results/` (`combined.json`, `combined-summary.md`, `combined-ratings.md`). Tidak menyentuh `src/`. Kunci hanya dibaca dari `.env.local`. Bahan: 3 profil sintetis × 3 lowongan nyata dari `fixtures/` (teks fixtures terpotong 600 sampai 1.700 karakter, jadi token lowongan asli lebih besar). Payload dipseudonimkan (D13) dan runner berhenti bila nama asli bocor; tidak ada yang bocor.
- **Jalur AI:** Zen tidak bisa diukur dari terminal. Semua model gratis ditolak HTTP 403 `FreeTierError` ("hanya dari dalam OpenCode"); semua model berbayar ditolak HTTP 402 `Insufficient account funds`. Spike dipindah ke Gemini (pilihan PIC) lewat endpoint yang sama dengan ekstensi.
- **Angka** (biaya = token × tarif berbayar; tier gratis sebenarnya $0):

| Model | Mode | Hasil | Hasil kena pemeriksa | Rata-rata token masuk / keluar | Detik | Biaya per CV |
|---|---|---|---|---|---|---|
| 3.5-flash-lite | 1 panggilan | 9 | 1 (positif palsu) | 763 / 258 | 5,8 | $0,00087 |
| 3.5-flash-lite | 2 panggilan | 9 | 0 | 821 / 198 | 9,5 | $0,00074 |
| 3.6-flash | 1 panggilan | 9 | 0 | 763 / 360 | 16,4 | $0,00192 |
| 3.6-flash | 2 panggilan | 4 dari 9 | 0 | 922 / 441 | 19,7 | $0,00235 |

- **Karangan:** dari 31 hasil yang selesai, nol skill, `sourceId`, angka, atau istilah teknis karangan yang tertangkap pemeriksa kasar. Satu hasil kena pemeriksa cakupan karena "Python, PHP, Ruby" ada di teks requirement lowongan yang dikutip model, bukan klaim model: pemeriksa cakupan perlu dibatasi ke klaim, bukan kutipan. Yang **tidak** tertangkap mesin: pada hasil 2 versi X model menulis requirement "clean code" sebagai tertutup "melalui pengujian unit dan code review", dan menggabungkan "mengikuti code review" ke butir Jest. Itu peregangan semantik yang hanya bisa dinilai manusia (RFC D12 sudah mengakui batas ini).
- **Mutu:** `3.5-flash-lite` mengembalikan CV tanpa satu butir pun pada 4 dari 9 (1 panggilan) dan 5 dari 9 (2 panggilan) hasil; `3.6-flash` tidak pernah kosong (rata-rata 4,2 butir). Butir hasil hampir selalu salinan atau penggabungan kalimat asal, jarang ditulis ulang.
- **Batas tier gratis:** `3.8-flash` HTTP 503 (kelebihan beban), `3.1-pro-preview` HTTP 429 tanpa kuota (kunci gratis), `2.5-flash` HTTP 404 (tidak tersedia untuk pengguna baru). `3.6-flash` kehabisan kuota gratis **20 request per hari** (`generate_content_free_tier_requests, limit: 20`) di tengah spike; itu sebabnya hanya 4 dari 9 hasil dua-panggilan yang selesai. Satu CV = 1 sampai 2 request, jadi tier gratis ± 10 sampai 20 CV per hari per model.
- **Peringatan data:** konten tier gratis Gemini dipakai Google untuk memperbaiki produknya (halaman tarif, 2026-10-14); tier berbayar tidak. `zenMayTrainOn` di `settings.ts` baru mengenal Zen, jadi peringatan FR-46 untuk Gemini gratis perlu ditambah di T48.
- **Usulan (belum keputusan):** lanjut ke T46 tanpa desain ulang; pemeriksa mekanis cukup dan model hampir tidak mengarang. **Satu panggilan**: mutu tidak lebih baik dengan dua, token masuk sama, dan separuh request (penting di kuota 20 per hari). Model bawaan jangan `flash-lite` (sering kosong); `3.6-flash` atau setara, ± $0,002 per CV. Tambahan desain T46/T48: (1) `assemble()` memakai isi Profile apa adanya bila AI mengembalikan pengalaman kosong, jangan menghasilkan CV kosong; (2) cakupan "tertutup" ditandai sebagai klaim model yang ditinjau di diff; (3) pesan khusus saat penyedia mengembalikan 429 kuota harian.
- Perbandingan 1 vs 2 panggilan di `3.6-flash` hanya 4 dari 9 pasangan; keberpihakan pada satu panggilan terutama bersandar pada `3.5-flash-lite` (18 hasil) dan biaya.

Penilaian PIC (2026-10-16) mendukung satu panggilan; kartu 2 dua panggilan memuat peregangan "clean code tertutup lewat code review" yang saya tandai, dan PIC menilainya Jujur 5. **Keputusan PIC (2026-10-16, "lanjut" atas usulan di atas): lanjut ke T46 tanpa desain ulang, satu panggilan, model bawaan setara `3.6-flash`.** Penyimpangan dari kriteria: perbandingan Zen gratis vs berbayar tidak terukur (403 dan 402), dipindah ke Gemini atas pilihan PIC; dua panggilan `3.6-flash` hanya 4 dari 9 pasangan karena kuota harian.

Belum diverifikasi: alasan nilai Jujur 4 di kartu 4; perbandingan Zen gratis vs berbayar (tidak terukur: 403 dan 402); model berbayar sungguhan (kunci gratis); dua panggilan `3.6-flash` untuk 5 kombinasi (menunggu reset kuota harian); lowongan asli dengan teks penuh.

### T46 · Pemeriksa fakta (anti-karangan) · 1.5h · feature · Highest
- [x] **T46 selesai**

**Acceptance criteria**
- [x] `validateGrounded(output, profile)` murni: menolak skill di luar Profile, angka atau persen di butir yang tidak ada di deskripsi pengalaman asalnya, dan istilah teknis di luar deskripsi dan daftar skill (FR-40)
- [x] Keluaran AI hanya berbentuk `{ sourceId, bullets[] }` per pengalaman; `sourceId` yang tidak ada di Profile ditolak; `assemble()` mengambil jabatan, perusahaan, institusi, dan tanggal dari Profile (FR-40, RFC D12)
- [x] Tes: jawaban palsu dengan "Kubernetes" dan "50%" ditolak dengan dua pelanggaran; jawaban yang hanya menyusun ulang skill lolos; huruf besar-kecil, spasi, dan angka berformat Indonesia ("1,5 juta") ditangani
- [x] Dipakai ulang oleh surat (T51): `validateLetter` memanggil `checkText`; tesnya di `core/letters/grounded.test.ts`
- [x] Tes ditulis lebih dulu

**Done when:** tes pemeriksa fakta lulus, termasuk kasus palsu dari hasil spike T45.

**Hasil:** `core/tailor/`: `types.ts` (`TailorOutput` = `{skills, experience[{sourceId, bullets[]}], education[]}`, tanpa tempat untuk jabatan, perusahaan, institusi, atau tanggal), `grounded.ts` (`validateGrounded`, `checkText`, `violationMessage`, `assemble`, `bulletsFromDescription`), `sample-profiles.ts` (tiga profil sintetis spike dalam bentuk `Profile`). `validateGrounded` mengembalikan `{ok, violations[{type, value, where}]}`; menolak skill di luar Profile, `sourceId` yang tidak ada atau ganda (pengalaman dan pendidikan), angka di butir yang tidak ada di deskripsi pengalaman asalnya, dan istilah teknis di luar deskripsi asal dan daftar skill. Angka berformat Indonesia dinormalkan ("1,5" = "1.5", "1.500.000" = ribuan); istilah dibandingkan per kata tanpa peduli huruf besar-kecil, titik, dan strip (Node.js = nodejs). `assemble` mengambil jabatan, perusahaan, institusi, tanggal, dan header (nama, email, telepon, kota, tautan) dari Profile; keluaran AI yang kosong (skill, pengalaman, atau butir satu pengalaman) jatuh ke isi Profile apa adanya (usulan spike T45). 26 tes baru, termasuk kasus palsu "Kubernetes" + "50%" (tepat dua pelanggaran) dan 31 jawaban nyata dari spike T45 (`spikes/t45/results/combined.json`): semuanya lolos, dan semuanya ditolak bila dua karangan itu ditambahkan. Tes spike dilewati otomatis bila berkas hasil tidak ada. Tes ditulis lebih dulu dan dilihat gagal (modul belum ada) sebelum implementasi. Dua keputusan kecil yang perlu diketahui: (1) nama yang dimiliki Profile (skill, perusahaan, jabatan, institusi, jurusan, jenjang) dikeluarkan dari teks butir sebelum angka dan istilah diperiksa, karena setelah `restore()` nama itu muncul lagi di butir ("PT", "Microsoft 365", "S1") dan bukan klaim; (2) kata umum "IT", "ID", "CV", "UI", "UX" tidak dianggap istilah teknis. `npm test` 821 tes lulus; satu berkas gagal sudah ada sebelumnya dan bukan dari T46: `spikes/t45/check.test.mjs` memakai `node:test`, dijalankan vitest dan dilaporkan "No test suite found" (jalankan dengan `node --test spikes/t45/check.test.mjs`); typecheck dan build lolos. Pemeriksa cakupan "tertutup" (klaim model, bukan kutipan requirement; positif palsu spike) ditunda ke `coverage()` T48. Batas yang jujur: klaim semantik ("memimpin tim", "clean code" dianggap tertutup oleh code review) tidak tertangkap mesin.

### T47 · Payload privasi CV dan surat · 1h · feature · Highest
- [x] **T47 selesai**

**Acceptance criteria**
- [x] `pseudonymize(profile)` mengganti nama perusahaan dan kampus dengan kode dan `restore()` memulihkannya di komputer ini; nama, email, telepon, alamat, tanggal lahir, tautan, dan IPK tidak ada di payload (PRD §4.2, FR-46)
- [x] Tes seperti `score.test.ts`: payload tidak memuat nilai identitas; kode terpulihkan benar walau nama perusahaan muncul di dalam butir pengalaman
- [x] Penanda model yang diketahui memakai data untuk melatih; peringatan sekali per lamaran (FR-46)
- [x] Keputusan PIC di PRD §11 (batas payload, model gratis) dicatat di tiket ini

**Done when:** tes payload lulus dan keputusan PIC tercatat.

**Keputusan PIC (2026-10-15, dijawab sebelum T47):** (1) batas payload **disetujui seperti PRD §4.2**: dikirim skill, butir deskripsi pengalaman, judul jabatan, jenjang dan jurusan, serta teks dan judul lowongan; tidak dikirim nama, email, telepon, alamat, tanggal lahir, tautan, IPK; nama perusahaan dan kampus diganti kode lalu dipulihkan lokal. (2) Model gratis yang memakai data untuk melatih: **hanya diperingatkan, sekali per lamaran**, tidak diblokir. PRD §11 (dua baris "Genuinely open" dan §4.2 berstatus usulan) belum saya ubah; menunggu persetujuan Anda untuk memindahkannya ke "Resolved".

**Hasil:** `core/tailor/privacy.ts` (25 tes di `privacy.test.ts`). `pseudonymize(profile)` mengembalikan `{payload, restore, restoreOutput}`; `payload` hanya berisi `skills`, `experience[{id, title, company, description}]`, `education[{id, institution, level, major}]` (tidak ada tempat untuk nama, kontak, alamat, tanggal lahir, tautan, IPK, atau isian khusus). Nama perusahaan dan kampus menjadi `{C1}`, `{S1}`, kode yang sama untuk nama yang sama, juga di dalam butir (huruf besar-kecil apa pun, tanpa awalan "PT/CV/UD/PD" atau akhiran "Ltd/Inc/Tbk", nama terpanjang dulu, hanya kata utuh, karakter regex di nama aman). Nilai identitas yang terselip di butir (email, telepon, tautan, jalan, tanggal lahir, nama lengkap, bagian nama ≥5 huruf) diganti `[dihapus]`; nama depan pendek yang juga kata biasa ("Made") sengaja dibiarkan. `restore` membaca kode walau ditulis `{c1}` atau `{ C1 }`, dan membiarkan kode yang tidak pernah dikeluarkan (`{C9}`) sehingga pemeriksa fakta menolaknya. `trainingNotice({provider, model})`: Zen memakai `zenMayTrainOn` yang sudah ada; Gemini selalu diberi peringatan berbunyi "bila kunci tier gratis" karena job-kit tidak bisa tahu tier kunci (hasil spike T45); Anthropic tidak. `needsNotice`/`acknowledgeNotice` menyimpan `Application.aiNoticeAck` (`"provider:model"`, field opsional baru, ikut dibaca `normalizeApplicationData`) sehingga peringatan muncul sekali per lamaran dan muncul lagi bila model diganti ke yang lain. Uji mutasi: mematikan penghapusan identitas membuat dua tes gagal. Catatan jujur: tes ditulis lebih dulu tetapi tidak dijalankan merah sebelum implementasi (hanya uji mutasi sesudahnya). 847 tes lulus (satu berkas bawaan `spikes/t45/check.test.mjs` tetap gagal di vitest, bukan dari T47), typecheck dan build lolos. Penyimpangan kecil dari RFC D13: (a) `restore()` dijalankan atas jawaban lalu hasilnya divalidasi terhadap Profile asli (urutan RFC §3.3c), jadi tidak perlu `pseudoProfile` seperti di spike; (b) peringatan Zen memakai `zenMayTrainOn` apa adanya, yang menandai semua model Zen di luar tiga model yang dijanjikan privat, termasuk model berbayar. Belum diverifikasi: tampilan peringatan di layar (dibangun di T48/T49) dan payload nyata ke penyedia (T48).

### T48 · Ekstrak requirement dan susun CV · 2h · feature · High
- [x] **T48 selesai**

**Acceptance criteria**
- [x] `core/tailor/`: prompt, `parseOutput` (validasi bentuk), `coverage(requirements, cv)` yang menghasilkan tertutup dan belum tertutup (FR-39)
- [x] `profileHash` disimpan di CV; berbeda berarti basi (FR-45)
- [x] Keluaran tidak valid atau ditolak T46: tidak ada CV, ada pesan sebab, CV sebelumnya tetap (PRD §8)
- [x] Klien AI dari `platform/ai-client.ts`; batas harian di `local:aiUsage` (bawaan 20, bisa diubah di Atur Lowongan); kunci kosong, ditolak, atau kuota habis menonaktifkan tombol dengan sebab (FR-46)
- [x] Tes dengan klien palsu; satu run nyata dicatat dengan token dan perkiraan biaya (lihat Hasil: run nyata memakai profil sintetis dan lowongan nyata dari `fixtures/`, bukan lamaran nyata PIC)

**Done when:** satu lamaran nyata menghasilkan CV yang lolos pemeriksa fakta, dan mencabut kunci menghasilkan tombol nonaktif dengan alasan.

**Hasil:** keputusan spike T45 dipakai: **satu panggilan** (requirement dan draf sekaligus). `core/tailor/`: `prompt.ts` (`CV_SYSTEM`, `cvUserPrompt`; lowongan dipotong 4.000 karakter), `parse.ts` (`parseOutput`: bentuk saja, kunci tambahan seperti perusahaan atau tanggal diabaikan), `coverage.ts` (`coverage(requirements, cv, claimed)`), `hash.ts` (`profileHash`, `isStale`; nama, kontak, skill, pengalaman, pendidikan; preferensi, isian khusus, tanggal lahir tidak ikut), `limits.ts` (`DocumentUsage`, `countDocument`, `cvAvailability`), `pipeline.ts` (`tailorCv`: payload tanpa identitas, satu panggilan, baca bentuk, pulihkan kode, `validateGrounded`, cakupan, `assemble`). `platform/tailor.ts`: `buildCv(id)` dan `cvStatus(id)`; `local:aiUsage` di `application-storage.ts` (ikut terhapus oleh Hapus semua, tidak ikut Export); `clientWithPermission` dipindah dari `feed-runner.ts` ke `ai-client.ts`; menyimpan kunci baru membersihkan masalah AI yang tersimpan. `FeedSettings.documentLimit` (bawaan 20, 1 sampai 200, bisa diubah di Atur Lowongan); `Application.aiNoticeAck` opsional; `attachCv` (core). UI: `CvTab.tsx` + `useCv.ts` (tombol Buat CV/Buat ulang, alasan nonaktif dengan tautan, peringatan model, pesan penolakan, ringkasan cakupan); pratinjau, diff, dan unduhan tetap T49/T50. 933 tes lulus, typecheck dan build lolos; satu berkas gagal sudah ada sebelumnya (`spikes/t45/check.test.mjs`, node:test di vitest), dan satu tes dilewati (`spikes/t48/real-run.test.ts`, hanya jalan dengan `T48_REAL_RUN=1`).
- **Perilaku yang teruji (klien palsu, `fakeBrowser`):** CV tersimpan, lamaran menunjuk ke CV, event `cv` ("CV dibuat" / "CV dibuat ulang"), hitungan harian bertambah; jawaban yang ditolak (Kubernetes dan 50%) tidak mengubah apa pun dan CV sebelumnya tetap, tetapi tetap dihitung ke batas harian karena panggilannya terjadi; kunci kosong, ditolak, kuota habis, izin kurang, batas harian tercapai, lowongan tanpa teks, profil tanpa pengalaman: tombol nonaktif dengan sebab dan model tidak dipanggil; kunci baru menyalakan tombol lagi; peringatan model sekali per lamaran; batas harian kembali tengah malam waktu setempat; payload yang dikirim tidak memuat nama, email, telepon, nama perusahaan, dan nama kampus.
- **Run nyata (2026-10-15, Gemini via kunci di `.env.local`, tidak dicetak):** profil sintetis IT support + lowongan nyata "Tier III Service Desk Engineer" (Remotive, 607 karakter), satu panggilan. `gemini-3.5-flash-lite`: 2,3 dtk, 635 masuk / 242 keluar, ≈ $0,0008, lolos pemeriksa fakta, butir tidak kosong. `gemini-3.6-flash`: 13,1 dtk, 635 / 233, ≈ $0,00135, lolos; percobaan pertamanya HTTP 503 (jalur galat bekerja: "Penyedia sedang bermasalah"). Nol pelanggaran, payload tanpa identitas. Biaya dihitung dari tarif berbayar; tier gratis $0.
- **Temuan dari run nyata dan perubahan desain:** cakupan murni mekanis menghasilkan 0 dari 4 tertutup karena requirement berbahasa Inggris dan CV berbahasa Indonesia tidak berbagi kata. `coverage` sekarang menerima klaim model (`covered`): requirement **berisi istilah teknis** hanya tertutup bila CV memuat semua istilah itu (klaim tidak bisa menutupnya; "Kotlin" tidak pernah tertutup tanpa Kotlin di CV); requirement tanpa istilah teknis tertutup bila sebagian besar katanya ada di CV **atau** model mengklaimnya. Itu klaim makna yang tidak bisa diperiksa mesin (batas RFC D12), jadi dibaca pengguna di diff T49. Setelah perubahan: 1 dari 4 tertutup di kedua model, sisanya dilaporkan belum tertutup.
- **Penyimpangan dari RFC §3.3c (belum saya ubah di RFC):** (1) jawaban AI memuat `covered` selain `requirements`, `skills`, `experience`, `education`; (2) `FeedSettings.documentLimit` dan `Application.aiNoticeAck` ditambahkan; (3) `local:aiUsage` tidak ikut Export (penghitung, bukan data); (4) penolakan pemeriksa fakta tetap menambah hitungan harian.
- **Model bawaan:** `DEFAULT_MODELS.gemini` masih `gemini-3.5-flash-lite` (dipakai penilaian lowongan juga). Spike T45 menyarankan model setara `3.6-flash` untuk CV karena `flash-lite` sering mengembalikan CV tanpa butir (di run nyata ini tidak terjadi, tetapi `assemble` sudah jatuh ke isi Profile bila itu terjadi). Saya tidak mengubah bawaan karena memengaruhi penilaian lowongan dan kuota harian; itu keputusan Anda.
- **Belum diverifikasi:** (a) lamaran nyata PIC dengan Profile nyata (run nyata memakai profil sintetis); (b) Chrome sungguhan dengan ekstensi terpasang, termasuk izin host penyedia (`clientWithPermission` hanya teruji lewat klien palsu) dan panggilan jaringan dari ekstensi; (c) Anthropic dan Zen (hanya Gemini yang dipanggil); (d) pencabutan kunci di Chrome sungguhan: di harness dengan penyimpanan palsu, tombol menjadi nonaktif dengan "Kunci API belum diisi. Isi di Atur Lowongan." dan tautan ke Atur Lowongan; panggilan ke penyedia diganti jawaban palsu di halaman harness (tidak ada request nyata dari halaman); (e) tampilan ≤420 px untuk CvTab; (f) tes ditulis lebih dulu tetapi untuk modul baru saya tidak menjalankannya merah sebelum implementasi (modul belum ada); hanya perubahan `attachCv`, klaim `covered`, dan uji mutasi privasi yang dilihat merah dulu.

### T49 · Pratinjau, diff, dan edit CV · 2h · feature · High
- [x] **T49 selesai**

**Acceptance criteria**
- [x] Tab CV sesuai T40: ringkasan cakupan, dua panel Asli dan Disesuaikan, penanda Tervalidasi, diff per butir (fungsi murni dengan tes) (FR-41)
- [x] Edit tangan tersimpan dan CV bertanda diedit; Kembalikan ke versi AI; Buat ulang pada dokumen yang diedit meminta konfirmasi (FR-41, FR-45)
- [x] Semua state CV dari T40 terlihat lewat `#applications?state=...` di build dev: belum dibuat, sedang membuat, ditolak, basi, AI tidak tersedia, batas harian, model gratis, tanpa pengalaman
- [x] Event `cv` masuk riwayat; rapi di ≤420 px (dilihat di browser pada 375 px, tanpa overflow horizontal pada halaman)

**Done when:** CV dari T48 tampil berdampingan dengan versi asli dan semua state terlihat.

**Hasil:** `core/tailor/diff.ts` (18 tes): `diffWords` (diff kata dengan LCS; huruf besar-kecil dan tanda baca di ujung kata bukan perubahan), `matchBullets` (tiap butir baru dipasangkan dengan kalimat Profile yang paling mirip, tiap kalimat dipakai sekali, ambang kemiripan 0,25; yang tidak dipakai dilaporkan), `compareCv(profile, parts)` (baris diff per butir, jumlah butir yang tidak dipakai, perubahan skill, pengalaman yang tidak disertakan, pendidikan; jabatan, perusahaan, institusi, dan tanggal dari Profile). `edit.ts` (8 tes): `editCv` (disimpan apa adanya, `edited` hanya bila beda dari versi AI, jadi suntingan yang dibatalkan menghapus tandanya), `restoreAiVersion`, `overwritesEdits`. `format.ts`: `formatPeriod` ("Agu 2023 – sekarang"). `view.ts`: `CvView` dan sepuluh state pratinjau. Platform: `saveCvEdit` dan `restoreCv` (menulis hanya `local:tailoredCvs`). UI: `CvTab.tsx` (ditulis ulang), `CvDiff.tsx`, `useCv.ts` (simpan otomatis suntingan 500 ms, membaca ulang setelah tersimpan, `stale` dari `isStale`). Tab CV: ringkasan cakupan (bilah dan daftar Tertutup/Belum tertutup, catatan "tidak pernah ditambal"), dua panel Asli (Profile) dan Disesuaikan dengan `<ins>` hijau dan `<del>` dicoret abu (tanpa merah), penanda **Tervalidasi** (diganti **Diedit** bila disunting), catatan skill ("Urutan diubah; tidak ada skill ditambah; N skill tidak dipilih (masih ada di Profile)"), Edit (butir satu per baris, skill bisa dihapus, tidak bisa ditambah), **Kembalikan ke versi AI** (hanya muncul bila diedit), **Buat ulang** dengan konfirmasi inline "Timpa" atau "Batal" bila CV sudah diedit. Semua state lewat `#applications?state=detail-cv` (hasil) dan `detail-cv-<empty|busy|rejected|stale|off|limit|notice|noexp|edited>` di build dev. Riwayat: event `cv` mencatat "CV dibuat" atau "CV dibuat ulang" (teks riwayat "CV disesuaikan dibuat ulang"). 1064 tes lulus, typecheck dan build lolos.
- **Diverifikasi di browser** (harness dengan penyimpanan palsu, bukan Chrome dengan ekstensi): semua state di atas dilihat; hasil dan diff dilihat pada 800 px dan 375 px (tanpa overflow horizontal halaman; tab folder di 375 px sudah menggulir sendiri sejak T44); suntingan nyata (mengetik di textarea) tersimpan, CV bertanda diedit, versi AI utuh, dan Kembalikan ke versi AI mengembalikan dua butir asli dan penanda Tervalidasi.
- **Penyimpangan dari mockup §9.5/§9.6:** (1) tidak ada tombol **Unduh PDF** (T50); (2) state "Sedang membuat" tanpa bilah langkah "3 dari 3" karena satu panggilan tidak punya langkah yang bisa diikuti; hanya teks "Biasanya 10–20 detik" dan urutan langkahnya; (3) peringatan model: tombol "Lanjut", "Buka Atur Lowongan", "Batal" (mockup: "Atur Lowongan" dan "Lanjut buat CV"); (4) dua panel jadi satu kolom bila lebar isi di bawah 760 px (container query, bukan 900 px, karena sidebar ikut memakan lebar); (5) state ditolak hanya menampilkan peringatan dan "Coba lagi" (tanpa maskot), dan CV lama tetap tampil bila ada; (6) panel Asli hanya memuat pengalaman yang dipakai CV, dan butir Profile yang tidak dipakai tampil dicoret.
- **Belum diverifikasi:** tampilan di Chrome dengan ekstensi terpasang; layar dengan lebar antara 420 dan 760 px selain yang di atas; keterbacaan diff pada profil nyata dengan butir panjang; pembaca layar (tombol hapus skill punya `aria-label`, diff memakai `<ins>`/`<del>` bawaan, belum dicoba dengan VoiceOver). Pencocokan butir baru dengan kalimat Profile adalah heuristik kemiripan kata: butir yang digabung dari dua kalimat bisa tampil sebagai "baru seluruhnya" (hijau) dan kedua kalimat asalnya sebagian dicoret.

### T50 · Unduh PDF · 2h · feature · High
- [x] **T50 selesai**

**Acceptance criteria**
- [x] Uji kecil membandingkan cetak lewat CSS dengan `pdf-lib`: teks bisa dipilih, ukuran bundle, satu klik, rapi untuk Indonesia dan Inggris di A4. Satu dipilih dan dicatat di RFC (PRD §11)
- [x] Satu templat; nama berkas `CV-{perusahaan}.pdf` yang sudah disanitasi (FR-42)
- [x] Tidak ada request jaringan saat membuat PDF (FR-42) (tes: `fetch` dan `XMLHttpRequest.open` tidak dipanggil; di halaman harness tidak ada request selain `blob:`)
- [x] Gagal: pesan sebab, isi tetap bisa disalin (PRD §8); event `download` di riwayat

**Done when:** PDF dari satu lamaran nyata terunduh dan teksnya bisa disalin. (Terpenuhi pada lamaran contoh di harness; lamaran nyata PIC belum, lihat "Belum diverifikasi".)

**Hasil:** **Uji kecil dulu, lalu pilihan PIC.** `spikes/t50/run.mjs` membuat dua CV yang sama (Indonesia dan Inggris, A4) lewat cetak CSS (Chrome headless) dan `pdf-lib`, lalu membacanya dengan pdf.js. Teks bisa dicari pada keduanya (semua frasa uji ditemukan, termasuk "résumé"); CSS ±102 KB dengan font tersemat, `pdf-lib` ±2 KB; bundle `pdf-lib` +505 KB minify (185 KB gzip) pada pemakaian terkecil; cetak CSS lewat dialog cetak (bukan satu klik), nama berkas hanya usulan; `pdf-lib` hanya WinAnsi ("Иван", "李", dan "Nguyễn" melempar galat). Perbandingan ditunjukkan ke PIC, yang memilih **`pdf-lib`** (2026-10-16); dicatat di RFC §3.3c ("Keputusan PDF"). `pdf-lib` 1.17.1 dipasang dengan versi tetap (`package.json`, lockfile); PRD §11 baris "Pembuat PDF" belum saya ubah.
- **Kode:** `core/tailor/pdf-layout.ts` (26 tes): `layoutCv(doc, lang, measure)` murni (A4, margin 51 pt, satu templat: nama, kontak, Skill, Pengalaman, Pendidikan, titik butir, pembungkus baris termasuk kata yang lebih panjang dari baris, jeda halaman dengan judul bagian dan judul pekerjaan tidak ditinggal sendirian di dasar halaman), `toWinAnsi` dan `winAnsiDocument` (huruf beraksen yang tidak ada diganti huruf polos, aksara lain menjadi "?", dilaporkan), `cvFileName` (`CV-{perusahaan}.pdf`: huruf dan angka saja, aksara dilepas, dipotong 56 karakter, `CV.pdf` bila kosong), `describeReplaced`. `core/tailor/language.ts` (`detectLanguage` Indonesia atau Inggris dari kata fungsi, `CV_LABELS`; juga dipakai surat di T51), `format.ts` (`formatPeriod` berbahasa Inggris: "Mar 2021 – present"), `cv-text.ts` (`cvToText`, untuk Salin). `core/applications`: `noteDownload` (event `download`). Platform: `cv-pdf.ts` (`renderCvPdf` memuat `pdf-lib` malas dan memakai font standar; `downloadCv` menggambar CV yang tersimpan sehingga suntingan tangan ikut, menyerahkan berkas ke browser, lalu mencatat event; gagal membuat atau mengunduh: pesan sebab, tidak ada event), `clipboard.ts` (`copyText`), `download.ts` (`downloadBytes`). UI: tombol **Unduh PDF** (satu-satunya tombol biru solid di tab CV, tersedia juga untuk CV basi atau diedit), "PDF dibuat di browser ini dan tidak diunggah ke mana pun", peringatan merah bila gagal dengan **Salin teks CV**, catatan bila ada huruf yang diganti. Dua state pratinjau baru: `detail-cv-pdffailed` dan `detail-cv-pdfnote`.
- **Pengukuran:** 1130 tes lulus, typecheck lulus, build lulus; total ekstensi 2,80 MB (naik 0,43 MB dari 2,37 MB sebelum T50; `pdf-lib` satu chunk 430 KB yang hanya dimuat saat Unduh). Tes platform membuat PDF sungguhan dan membacanya lagi dengan pdf.js: satu halaman A4 (595,28 x 841,89 pt), judul berkas, teks Indonesia dan Inggris ditemukan, "Nguyễn Contoh 李" menjadi "Nguyen Contoh ?", CV panjang menjadi beberapa halaman A4.
- **Diverifikasi di browser** (harness dengan penyimpanan palsu): klik Unduh PDF menyerahkan `CV-PT-Contoh-Karya.pdf` (berkas PDF sah, 1,5 KB), event `download` tercatat di riwayat, dan tidak ada request jaringan selain `blob:`.
- **Belum diverifikasi:** unduhan di Chrome dengan ekstensi terpasang (dialog unduh, folder tujuan, kebijakan CSP ekstensi untuk chunk `pdf-lib`); PDF dari Profile dan lamaran nyata PIC dibuka di pembaca PDF dan dicoba pada ATS (hanya dibaca ulang dengan pdf.js); tampilan visual PDF hasil tata letak produk (yang dilihat adalah PDF dari skrip uji, tidak identik); PDF dengan lebih dari satu halaman pada profil nyata; Salin teks CV dengan clipboard sungguhan di halaman ekstensi.
- **Penyimpangan:** PRD §11 belum diperbarui; mockup S8 CV tidak memuat Salin teks CV (ditambahkan hanya saat PDF gagal, sesuai PRD §8).

### T51 · Buat surat lamaran · 2h · feature · High
- [x] **T51 selesai**

**Acceptance criteria**
- [x] `core/letters/`: deteksi bahasa lowongan (fungsi murni, tes dua bahasa), prompt, parse, nada formal atau santai (FR-43)
- [x] Nama di penutup diisi lokal dari Profile dan tidak dikirim (FR-43, FR-46)
- [x] Pemeriksa fakta T46 dan payload T47 dipakai; hasil ditolak menghasilkan pesan sebab (FR-40)
- [x] Batas harian dibagi dengan CV; `profileHash` untuk penanda basi (FR-45)
- [x] Tes dengan klien palsu

**Done when:** lowongan berbahasa Inggris menghasilkan surat berbahasa Inggris yang lolos pemeriksa fakta.

**Hasil:** `core/letters/` (44 tes, semuanya ditulis lebih dulu dan dilihat merah karena modul belum ada): `language.ts` (`postingLanguage` memakai `detectLanguage` T46 pada teks lowongan; judul hanya cadangan karena judul pekerjaan hampir selalu berbahasa Inggris), `prompt.ts` (`letterSystem(lang, tone)`, `letterUserPrompt` memakai `CvPayload` dari `pseudonymize` T47 persis, jadi tidak ada nama, kontak, perusahaan, atau kampus pengguna), `parse.ts` (`{ "letter": "..." }`; ditolak bila bukan JSON, tanpa `letter`, kosong, di bawah 30 atau di atas 450 kata), `grounded.ts` (`validateLetter` = `checkText` T46 dengan sumber: semua deskripsi pengalaman, tanggal dan tahun di Profile, jurusan dan jenjang, serta kata judul dan perusahaan lowongan; teks lowongan sendiri bukan sumber), `closing.ts` (`finishLetter`: penutup menurut bahasa dan nada, nama dari `Profile.personal` di komputer ini; penutup atau tanda tangan yang ditulis model dibuang), `edit.ts` (`wordCount`, `editLetter`, `restoreAiLetter`), `pipeline.ts` (`writeLetter`: satu panggilan, `restore` kode `{C1}`, `validateLetter`, lalu penutup; kegagalan memakai bentuk `TailorFailure` yang sama dengan CV). Disentuh: `tailor/pipeline.ts` (`ungroundedMessage` diekstrak supaya CV dan surat memberi pesan yang sama), `tailor/parse.ts` (`readJson` diekspor), `tailor/edit.ts` (`overwritesEdits` menerima CV atau surat), `applications.ts` (`attachLetter`: satu surat per lamaran, event `letter` "Surat dibuat" atau "dibuat ulang"), `detail.ts` (riwayat), `platform/application-storage.ts` (`saveLetters`), `platform/letter.ts` (`buildLetter`, `letterStatus`, `saveLetterEdit`, `restoreLetter`; kunci, izin, peringatan data sekali per lamaran, dan penghitung `local:aiUsage` dibagi dengan CV lewat `availabilityOf` yang sama). `profileHash` yang sama dengan CV dicatat di surat, untuk penanda basi (FR-45; tampilannya di T52). Tes platform: batas harian 2 dibagi satu CV + satu surat (surat ketiga ditolak tanpa panggilan), surat lama bertahan bila hasil baru ditolak (panggilan tetap dihitung), kunci kosong, kuota, peringatan data, bahasa dan nada pilihan. `npm test`: 1190 lulus, 1 dilewati (spike T45, sengaja); typecheck dan build lolos (total 2,80 MB, tidak berubah).
**Penyimpangan:** (1) `validateLetter` menolak seluruh surat bila menyebut alat dari lowongan yang tidak ada di Profile, termasuk kalimat jujur seperti "Saya belum memakai GraphQL di produksi" pada contoh mockup S8; pemeriksa mekanis tidak bisa membedakan pengakuan dari klaim, jadi prompt melarang model menyebutnya, dan contoh mockup itu sendiri tidak akan lolos. (2) Perusahaan lowongan ikut dikirim ke penyedia (nama perusahaan di lowongan, bukan milik pengguna) supaya surat bisa ditujukan ke tim yang benar. (3) Nama pengguna tidak punya tempat di keluaran AI sama sekali; penutup dipasang lokal, jadi tidak ada `{NAMA}` yang perlu diganti.
**Belum diverifikasi:** mutu tulisan surat pada model sungguhan (semua tes memakai klien palsu; belum ada spike mutu surat setara T45), terutama apakah model menaati larangan menyebut alat di luar Profile dan berapa sering suratnya ditolak; panjang 120 sampai 250 kata yang diminta prompt; Gemini atau Zen sungguhan. Perlu kunci API dan penilaian PIC.

### T52 · Editor surat dan isi ke form · 2h · feature · High
- [x] **T52 selesai**

**Acceptance criteria**
- [x] Tab Surat sesuai T40: bahasa, nada, editor, jumlah kata, Salin, Buat ulang, Kembalikan ke versi AI; simpan otomatis (FR-43, FR-45)
- [x] `core/matching`: label "Cover letter", "Surat lamaran", dan "Letter of motivation" terpetakan ke surat dari lamaran yang tertaut dengan tab (lewat `session:openedJobs`); essay lain tetap dilewati (FR-44)
- [x] Field unggah file tidak disentuh; panel menjelaskan "Unggah manual" dengan nama berkas yang diunduh (FR-44)
- [x] Panel: lencana konteks dengan penanda CV dan surat siap; setelah Fill, pesan lamaran ditandai Dilamar dengan tautan Lihat lamaran (FR-36)
- [x] Fixture form dengan textarea cover letter dan input file

**Done when:** Buka & isi pada satu form Greenhouse mengisi surat dan menandai lamaran Dilamar. (Terpenuhi pada fixture berbentuk Greenhouse di Chrome sungguhan dengan ekstensi terpasang; form Greenhouse sungguhan belum, lihat "Belum diverifikasi".)

**Hasil:** **Tab Surat** (`LetterTab`, `useLetter`, `core/letters/view.ts`): pilihan Bahasa dan Nada (`FilterChip`, bahasa terisi dari lowongan dengan keterangan "Bahasa dipilih dari teks lowongan."; pilihan baru dipakai saat Buat ulang dan tab bilang begitu), editor 16 baris (`min-h` 300 px, `leading` 1,65) dengan jumlah kata yang ikut berubah saat mengetik, penanda **Tervalidasi** atau **Diedit**, **Salin**, **Buat ulang** (meminta konfirmasi bila surat sudah diedit), **Kembalikan ke versi AI**, simpan otomatis 500 ms, penanda basi "Profilmu berubah sejak surat ini dibuat" (FR-45), peringatan data sekali per lamaran, hasil ditolak tanpa teks surat dan dengan sebabnya, nonaktif dengan sebab dan tautannya, nonaktif untuk Work Experience kosong; `Alert` dan `Card` dipindah dari `CvTab` ke `DocParts.tsx` dan dipakai dua tab. Sebelas state pratinjau: `#applications?state=detail-letter` dan `detail-letter-{empty,busy,rejected,stale,off,limit,notice,noexp,edited,english,copied}`. **Pengisian form:** `MatchKey` `coverLetter` (tiga label, dikenali sebelum aturan lain); `buildPlan(fields, profile, { coverLetter })` mengisinya hanya bila field adalah textarea (`ScannedField.multiline`) dan lamaran punya surat; tanpa surat atau pada input satu baris field dilewati dan tidak masuk "Profil belum punya"; essay lain ("Why do you want to work here?") tetap dilewati. Textarea yang sudah berisi memakai pilihan Timpa atau Lewati yang sudah ada. `scanUploads` membaca input `type=file` hanya untuk labelnya (tanpa klik, tanpa isi, tanpa pendengar). `OpenedJob.applicationId` (diisi `openedFromApplication`) menautkan tab dengan lamaran, termasuk lamaran tambah-tangan yang tidak punya lowongan di feed; tab dari kartu lowongan memakai `jobId` seperti sebelumnya. `core/applications/panel.ts`: `resolveApplication`, `panelContext` (penanda CV dan surat, teks surat yang tersimpan termasuk suntingan, nama berkas `CV-{perusahaan}.pdf`, apakah sudah diunduh), `uploadNote` ("CV-PT-Contoh-Karya.pdf sudah diunduh — pilih sendiri", "Unduh … dari Lamaran, lalu pilih sendiri", "Salin surat dari Lamaran, lalu unggah sendiri", "Pilih berkasmu sendiri"). Platform: `panel-context.ts` (baca saja), `recordOpenedFill` (menandai lamaran dari `applicationId` atau `jobId`; mengembalikan apakah Fill ini yang memajukan), `openApplicationPage` (Lihat lamaran), `usePanelTab` (menyegar saat lamaran berubah). Panel: lencana "Dari Lowongan · skor 86" dengan penanda **CV siap/belum** dan **Surat siap/belum** (`DocChip` pindah ke `ui/primitives` dan menerima `label`), baris Cover letter bertanda "Dari Lamaran" yang bisa dimatikan, bagian **Unggah file** dengan badge "Unggah manual" per input file, dan setelah Fill "Lamaran ke PT Contoh Karya ditandai Dilamar. Salah tandai? Ubah di Lamaran. [Lihat lamaran]" (atau "tetap berstatus Interview" bila lamaran sudah lebih jauh). **Temuan dari Chrome:** jawaban model yang menutup dengan `{NAMA}` ditolak pemeriksa karena "NAMA" dibaca istilah teknis (huruf kapital); tanda tangan buatan model kini dibuang sebelum validasi (`withoutSignOff`, dua tes baru di `pipeline.test.ts`, merah dulu).
- **Fixture:** `fixtures/greenhouse-cover-letter.html` (nama, email, Resume/CV `input file`, Cover Letter textarea, Cover Letter `input file`, essay textarea) dan `fixtures/surat-lamaran.html` (input satu baris berlabel "Surat lamaran" dan textarea "Letter of motivation" yang sudah berisi).
- **Pengukuran:** `npm test` 1265 lulus, 1 dilewati (spike T45, sengaja); typecheck dan build lolos; total ekstensi 2,82 MB (naik 0,02 MB).
- **Diverifikasi di Chrome sungguhan** (Chrome for Testing 151 dengan `.output/chrome-mv3` terpasang lewat `--load-extension`, dikendalikan lewat CDP; salinan manifest diberi `host_permissions` untuk `localhost` dan API Gemini supaya tidak ada dialog izin; panggilan ke penyedia AI dicegat dan dijawab palsu): **tab Surat, 20 pemeriksaan:** keadaan kosong, bahasa Inggris terpilih dari lowongan, peringatan data sebelum panggilan, satu request, payload tanpa nama, email, telepon, kota, perusahaan, dan kampus (dan memuat `{C1}`), surat tampil dengan perusahaan dipulihkan dan penutup serta nama dipasang lokal, tersimpan dengan event riwayat, `profileHash`, penghitung harian, kunci tidak ikut dokumen, suntingan tersimpan otomatis dan bertanda Diedit, Kembalikan ke versi AI, Buat ulang meminta konfirmasi, jawaban dengan "Kubernetes" dan "95%" ditolak dengan dua alasan (surat suntingan lama bertahan, panggilan dihitung), penanda basi setelah Profile berubah, 375 px tanpa overflow, riwayat. **Panel, 17 pemeriksaan:** lencana, CV siap dan Surat siap, baris Cover Letter "Dari Lamaran", dua input file "Unggah manual" dengan nama berkas CV, essay dilewati; **Fill menulis surat ke textarea, mengisi field biasa, essay tetap kosong, dan kedua input file tidak punya berkas dan tidak menerima klik, change, input, maupun focus**; pesan Dilamar dan status lamaran berubah dengan event; Lihat lamaran membuka `#applications/a1`; Undo mengosongkan textarea tetapi lamaran tetap Dilamar; form Indonesia: input "Surat lamaran" dilewati, textarea berisi menunggu keputusan Timpa dan tidak tertimpa; tab dengan lamaran yang tidak ada: hanya banner. Tampilan dilihat pada 1200 px (tab Surat) dan 400 px (panel).
- **Belum diverifikasi:** form lamaran Greenhouse atau situs lain yang sungguhan (hanya fixture; termasuk textarea yang dikendalikan React atau editor kaya, dan field "Cover Letter" yang berupa tombol "Enter manually"); jalur **Buka & isi dari Chrome sungguhan** (tab baru lalu panel terbuka otomatis oleh `sidePanel.open`; di harness panel dibuka sebagai tab biasa dan `tabs.query` diarahkan ke tab form); panel dengan dialog izin situs sungguhan (harness memberi izin lewat manifest); model AI sungguhan (jawaban palsu), jadi mutu surat dan seberapa sering ditolak pemeriksa belum diketahui; Salin dengan papan klip sungguhan (clipboard di headless tidak diperiksa); tampilan mockup S1 dan S8 dibandingkan dengan mata, bukan piksel.
**Penyimpangan:** (1) Bagian Unggah file tampil sebagai bagian sendiri di atas Dilewati, bukan baris di dalam daftar Dilewati seperti mockup, dan ringkasan "N dari M field cocok" tidak menambahkan "1 unggah file" di bawahnya. (2) Badge "Dari Lamaran" ditaruh di bawah nilai, bukan di ujung kanan baris, supaya muat di panel 400 px. (3) Surat contoh di mockup S8 ("Saya belum memakai GraphQL di produksi") tidak akan lolos pemeriksa, lihat T51; contoh pratinjau memakai surat yang lolos. (4) Label "Surat lamaran" (judul kecil di atas editor) dan label textarea "Isi surat" muncul bersamaan; mockup hanya punya `aria-label`. (5) Lamaran yang sudah Interview atau lebih dan di-Fill tidak diberi pesan "ditandai Dilamar" (tidak ada yang ditandai); panelnya berkata "tetap berstatus Interview". (6) `recordFill(jobId)` lama tetap ada dan teruji tetapi tidak lagi dipakai panel; panel memakai `recordOpenedFill`. (7) `panel-context.test.ts` ditulis bersamaan dengan `panel-context.ts` (tidak dilihat merah dulu); tes lain di tiket ini ditulis lebih dulu dan dilihat merah. `useLetter` dan `usePanelTab` (hook) tidak punya tes sendiri; keduanya hanya diperiksa lewat Chrome sungguhan.

### T53 · Tindak lanjut dan badge · 1.5h · feature · Could
- [x] **T53 selesai**

**Acceptance criteria**
- [x] Tanggal tindak lanjut per lamaran; `dueCount(apps, today)` murni dengan tes (FR-47)
- [x] Badge amber di sidebar; kartu jatuh tempo berborder amber; badge menyegar tiap hari (lihat penyimpangan: bukan lewat alarm); tanpa notifikasi sistem

**Done when:** mengatur tindak lanjut hari ini menyalakan badge 1.

**Hasil:** `core/applications/followup.ts` (14 tes): `todayKey(now)` (hari di jam lokal, `YYYY-MM-DD`), `isDue` (jatuh tempo pada hari itu dan sesudahnya sampai tanggal diubah; Ditolak dan Dibatalkan tidak), `dueCount(apps, today)`, `dueApplications` (yang terlewat dulu), `dueSummary` ("2 lamaran perlu tindak lanjut hari ini." + "Aksara Pagi dan Studio Contoh."). Tanggal tindak lanjut sudah ada di Detail Lamaran sejak T44. `App.tsx` mengirim `dueCount` ke badge amber item Lamaran di sidebar (sebelumnya 0 tetap). `ApplicationsPage`: peringatan amber di atas Papan dan Visualisasi, kartu jatuh tempo berborder amber dengan lencana "Tindak lanjut hari ini" atau "Tindak lanjut terlewat", sesuai `.kcard.due` di T40. `useToday` (3 tes, jam palsu): tanggal berganti saat tengah malam dan saat tab yang tertidur dibangunkan, sehingga badge ikut tanpa muat ulang. Tanpa notifikasi sistem. State `#applications?state=due` di build dev. `npm test`: 1063 lulus, 1 dilewati, 1 berkas gagal (`spikes/t45/check.test.mjs`, sama seperti di T54, bukan dari tiket ini); typecheck dan build lolos. Diperiksa di browser (markup halaman dengan CSS hasil build): peringatan, border, dan lencana pada papan.
**Penyimpangan:** (1) tiket menulis "alarm harian yang sudah ada menyegarkan badge". Badge dihitung di halaman options dari lamaran tersimpan dan tanggal hari ini, jadi yang perlu menyegar hanyalah tanggalnya; itu dikerjakan `useToday` (timer ke tengah malam + `visibilitychange`), bukan `feed-tick` di background. Konsekuensinya badge hanya hidup selama halaman options terbuka (tidak ada badge pada ikon ekstensi, sesuai "tanpa notifikasi sistem"). (2) Lencana kartu mockup hanya "Tindak lanjut hari ini"; "terlewat" ditambahkan untuk yang tanggalnya sudah lewat. (3) Lamaran Offer tetap dihitung jatuh tempo (masih ada yang perlu ditindaklanjuti); hanya Ditolak dan Dibatalkan yang dikeluarkan.
**Belum diverifikasi:** badge di sidebar pada halaman options sungguhan setelah tengah malam di Chrome; lencana di kartu ≤420 px.

### T54 · Visualisasi alur lamaran (Sankey) · 2h · feature · Medium
- [x] **T54 selesai**

**Acceptance criteria**
- [x] `funnelStats(apps, now)` murni dengan tes: dari riwayat status, hitung simpul (Dilamar, Direview, Interview, Offer, Tanpa kabar, Ditolak, Masih berjalan) dan aliran antar simpul; tahap terjauh yang pernah dicapai, Ditolak dihitung dari tahap terakhir sebelum ditolak, Tanpa kabar = Dilamar tanpa perubahan ≥14 hari; Draft dan Dibatalkan tidak dihitung; jumlah simpul sama dengan jumlah lamaran terkirim (FR-48)
- [x] `layoutSankey(funnel, size)` murni dengan tes: posisi simpul dan jalur pita (kubik Bézier) dari angka; tanpa pustaka bagan (bayangan dan kontras mengikuti token)
- [x] Komponen SVG di tampilan Visualisasi sesuai T40: pita sebanding jumlah, warna dari peta badge; judul `<title>` per pita; teks alternatif ringkas untuk pembaca layar; daftar batang `.flist` di ≤600 px
- [x] State: belum ada lamaran Dilamar menampilkan "Belum ada lamaran yang dikirim"

**Done when:** 12 lamaran contoh dengan riwayat mengisi diagram yang sama dengan mockup T40, dan lamaran Dilamar 20 hari tanpa perubahan masuk Tanpa kabar.

**Hasil:** `core/applications/funnel.ts` (18 tes): `funnelStats(apps, now)` menghitung tujuh simpul dan aliran dari riwayat status; tahap terjauh yang pernah dicapai (tahap yang dilompati ikut dilewati), `Ditolak` dari tahap terakhir sebelum ditolak, `Tanpa kabar` = berstatus Dilamar dan status terakhir berubah ≥14 hari lalu (`STALE_DAYS`; catatan dan dokumen tidak mengulang hitungan), Draft dan Dibatalkan tidak dihitung, jumlah simpul akhir (Offer, Tanpa kabar, Ditolak, Masih berjalan) sama dengan jumlah lamaran terkirim. `describeFunnel` menghasilkan teks pembaca layar persis seperti di mockup. `core/applications/sankey.ts` (18 tes): `layoutSankey(funnel, size)` murni, tanpa pustaka bagan; kanvas 860×300, batang 12 px, 15 px per lamaran (mengecil bila lamaran banyak), kolom x 150/360/540/690, ujung ditumpuk Tanpa kabar, Ditolak, Masih berjalan, Offer berjarak 16 px mulai y=28, pita kubik Bézier dengan titik kontrol di tengah, `<title>` per pita, warna dari peta badge, penempatan label sama dengan mockup. `SankeyChart.tsx` (8 tes) menggambar layout itu dan `.flist` di bawah 600 px (container query), kartu "Pencarian kerjamu", keadaan "Belum ada lamaran yang dikirim". Data contoh: `VIZ_SAMPLE` (12 lamaran, `VIZ_NOW` 20 Okt 2026) di `core/applications/preview.ts`, lewat `#applications?state=viz` dan `viz-empty` di build dev. `npm test`: 1024 lulus, 1 dilewati, 1 berkas gagal (`spikes/t45/check.test.mjs`, lihat di bawah); typecheck dan build lolos. Diperiksa di browser (markup komponen dengan CSS hasil build, bukan halaman options penuh): diagram pada lebar desktop dan daftar batang pada 375 px.
**Penyimpangan dari mockup:** angka, kolom, tinggi batang, tumpukan ujung, label, dan bentuk pita sama; **posisi vertikal batang tengah berbeda**. Mockup menaruh Dilamar/Direview/Interview di y=34/120/150 secara manual dan tidak ada aturan umum yang menghasilkan angka itu; `layoutSankey` memakai aturan umum (tiap batang tengah ditaruh di tempat aliran keluarnya paling lurus ke batang tujuan, dibobot jumlah) sehingga hasilnya y=45/147/185. Urutan pita dalam Direview ikut berubah (Masih berjalan di atas Interview). Mockup di `design-system.html` tidak diubah; bila ingin gambar yang persis sama, pilih: samakan mockup dengan hasil fungsi, atau beri fungsi posisi tetap. Offer-lalu-Ditolak dihitung lewat Interview karena Offer adalah ujung. Berkas `spikes/t45/check.test.mjs` (bukan dari tiket ini) memakai `node:test` sehingga `vitest` melaporkan "No test suite found"; tidak diubah.
**Belum diverifikasi:** tampilan di halaman options sungguhan dalam Chrome dengan ekstensi terpasang; mode `.opt.narrow` tidak ada, diganti container query pada kartu.

### T55 · Uji lima lamaran dan dokumen · 2h · launch · Medium
- [ ] **T55 selesai**

**Acceptance criteria**
- [ ] 5 lamaran nyata PIC: dicatat waktu per lamaran, biaya AI, jumlah suntingan, dan klaim yang bukan milik PIC (PRD §10)
- [x] README: fitur Lamaran, data yang dikirim untuk CV dan surat, privasi; baris "Tidak membuat cover letter" dan "AI hanya untuk menormalkan dan menilai" ditulis ulang (surat, unduh PDF, dan isi ke form sudah ditulis sejak T50 sampai T52; diperiksa 2026-10-16, tidak ada lagi baris "belum ada di versi ini")
- [ ] `docs/03-rfc.md` §3.3c sesuai hasil akhir; PRD berstatus APPROVED bila PIC setuju

**Done when:** metrik Application Kit di PRD §10 tercatat di tiket ini.

**Hasil (bagian dokumen, 2026-10-15; tiket belum selesai):**
- README: ditambah butir Lamaran (papan, Visualisasi, Tambah lamaran, tindak lanjut dan badge) dan CV yang disesuaikan (batas pemeriksa fakta dinyatakan terus terang), bagian Privasi memuat apa yang dikirim untuk CV (tanpa identitas, nama perusahaan dan kampus diganti kode, batas harian, peringatan model yang melatih), Export disebut memuat lowongan dan lamaran, dan daftar `core/`. Baris "Tidak membuat cover letter" dan "AI hanya untuk menormalkan dan menilai" ditulis ulang sesuai kode saat ini: AI juga menyusun ulang CV dari isi profil, dan **surat lamaran serta unduhan PDF tertulis "belum ada di versi ini"** karena T50 sampai T52 belum dibangun. Baris itu harus ditulis ulang lagi bila T51 dan T50 masuk.
- RFC §3.3c disamakan dengan kode sampai T54: model (`aiNoticeAck`, `source` bisa `manual`, `followUpAt` hari kalender, `documentLimit`, `aiUsage` tidak ikut Export, Export memuat `jobs`), alur CV (satu panggilan, `covered`, jatuh ke Profile, penolakan tetap dihitung), aturan Sankey dan tata letaknya sesuai kode, paragraf Tindak lanjut baru. **Satu klaim lama diluruskan:** RFC menulis mockup §9 dibuat dari tata letak yang sama; ternyata tiga batang tengahnya ditaruh manual dan berbeda dari hasil fungsi (lihat Penyimpangan T54). Bagian surat dan PDF tetap rancangan karena belum ada kodenya.
- PRD tidak diubah: statusnya tetap menunggu persetujuan PIC, dan PRD menjadi APPROVED hanya bila PIC setuju.

**Belum diverifikasi / belum dikerjakan:**
- Lima lamaran nyata PIC (waktu per lamaran, biaya AI, jumlah suntingan, klaim yang bukan milik PIC): **belum dijalankan; tidak ada angka yang dikarang.** Tabel untuk diisi PIC:

| # | Lowongan | Waktu Siapkan lamaran → siap diunduh | Biaya AI (CV + surat) | Suntingan | Klaim bukan milik PIC | CV layak dikirim (≤2 suntingan)? |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |

- Metrik PRD §10 (nol karangan, ≥4 dari 5 layak, ≤3 menit, biaya per lamaran) belum bisa dihitung: pengukuran penuh butuh surat (T51), PDF (T50), dan editor surat (T52), yang belum ada; T49 juga belum dicentang. **Catatan 2026-10-16:** T50 sampai T52 sudah ada sekarang; metrik tetap belum diukur karena belum ada lamaran nyata dan belum ada model sungguhan yang menulis surat.
- Centang README, RFC, dan "PRD APPROVED" di atas tetap kosong sampai bagian itu selesai dan PIC setuju.


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
| FR-10 | T05 | FR-20 | T16 |
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
| | | FR-34 | T41, T44 |
| | | FR-35 | T43 |
| | | FR-36 | T41, T42, T52 |
| | | FR-37 | T44 |
| | | FR-38 | T41 |
| | | FR-39 | T45, T48 |
| | | FR-40 | T46 |
| | | FR-41 | T49 |
| | | FR-42 | T50 |
| | | FR-43 | T51, T52 |
| | | FR-44 | T52 |
| | | FR-45 | T48, T49, T52 |
| | | FR-46 | T47, T48, T51 |
| | | FR-47 | T53 |
| | | FR-48 | T54 |

**Layar → tiket:** S1 Panel · Autofill → T03, T04, T05, T06, T10, T38 · S2 Panel · Profile → T09 · S3 Options · Profile → T02, T07, T08, T11 · S4 Options · Lowongan → T28, T37 · S5 Options · Preferensi kerja → T28, T29 · S6 Options · Atur Lowongan → T28, T34 · S7 Options · Lamaran → T40, T43, T54 · S8 Options · Detail Lamaran → T40, T44, T49, T52 · S1 Panel · Autofill (tambahan surat dan konteks lamaran) → T40, T52.

**Dipotong agar muat 20 jam (urutan PRD §9):**
1. **FR-16 Skill** (chip grup teknis / bahasa / lainnya). Tidak ada tiketnya; item Skill tidak ada di navigasi options.
2. **FR-15** (penanda bagian belum lengkap). Tidak ada tiketnya.

FR-14 (cut-list nomor 3) masih masuk sebagai T13. Kalau waktu habis di Day 8, T13 yang pertama dibuang, lalu T11 (bagian maskot).

**FR yang tidak tercakup tiket:** FR-15 dan FR-16, keduanya karena dipotong di atas.

**Bukan tiket:** studi kasus (checklist terpisah, bukan bagian backlog ini).
