# RFC — job-kit

**Sprint / Project:** Sprint ??? — job-kit
**Author (Builder):** imelda
**Approver (PIC):** imelda
**PRD:** `docs/02-prd.md` (APPROVED)
**State:** APPROVED

---

## 1. Summary

job-kit adalah ekstensi Chrome (Manifest V3) tanpa backend. Profil pelamar disimpan di `storage.local` lewat halaman Options. Saat pengguna membuka side panel di halaman lamaran, content script membaca field form, `core/matching` memetakan label (Indonesia dan Inggris) ke data profil, dan panel menampilkan pratinjau. Fill menulis nilai ke halaman sambil menyimpan nilai awal di memori untuk Undo. Tidak ada jaringan, akun, atau telemetri.

**Data flow:** Options → `storage.local` (profil) → panel minta scan → content script baca field → `core/matching` → rencana isi (pratinjau, toggle) → Fill → content script tulis nilai + simpan nilai awal → Undo

## 2. Context & constraints

| | |
|---|---|
| **Time** | 20 jam build, Day 10 tetap, walking skeleton Day 5. Portfolio solo: panduan, bukan batas keras (PRD §11). |
| **Cost** | Rp0. Tanpa server, tanpa hosting, tanpa API berbayar. |
| **People** | 1 orang (imelda: PIC dan Builder). |
| **Privacy** | Data profil hanya di `storage.local`. Nol request jaringan, nol telemetri (PRD §4). |
| **Device** | Chromium desktop, MV3. Tanpa Safari dan Firefox (PRD §4). |
| **Complexity ban** | Tanpa library state global; tanpa router; tanpa backend; tanpa panggilan LLM; tanpa pemetaan manual per situs; tanpa elemen baru di halaman lamaran; satu-satunya perubahan visual adalah outline pada field yang sudah ada (D15). Semua UI di side panel dan options. |

## 3. Proposed design

### 3.1 Stack

| Lapisan | Pilihan | Versi (diverifikasi 2026-10-09) |
|---|---|---|
| Framework ekstensi | WXT | `wxt` 0.21.4 |
| Modul React | `@wxt-dev/module-react` | 1.2.2 |
| Build | Vite | `vite` 8.3.4 |
| UI | React | `react` 19.3.0, `react-dom` 19.3.0 |
| Bahasa | TypeScript | `typescript` 7.0.2, `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@types/node` 26.6.4 |
| **Styling** | Tailwind CSS, token desain sebagai variabel `@theme` | `tailwindcss` 4.3.3, `@tailwindcss/vite` 4.3.3 |
| **Ikon** | Lucide | `lucide-react` 1.53.0 |
| **Motion** | Motion (impor dari `motion/react`) | `motion` 14.0.0 |
| Storage dan API browser | Dibawa WXT: `wxt/utils/storage`, `wxt/browser` | tanpa pin terpisah; ikut `wxt` 0.21.4 |
| Test | Vitest + happy-dom, plugin `wxt/testing/vitest-plugin`, `wxt/testing/fake-browser` | `vitest` 5.0.3, `happy-dom` 20.14.6 |
| Runtime dan paket | Node ≥22 (mesin ini v26.8.1), npm | — |

Peer range sudah dicocokkan: semua plugin menerima `vite` 8.x (`wxt` `^8.0.0-0`, `@wxt-dev/module-react` `^8.0.0-0`, `@tailwindcss/vite` `^8`, `vitest` `^8.0.0`). React 19.3.0 memenuhi peer `lucide-react` dan `motion`. `typescript` 7.0.2 memenuhi peer `wxt` (`>=5.4`). `npm install --dry-run` untuk seluruh daftar di atas (2026-10-09) selesai tanpa konflik peer (181 paket). Yang belum dijalankan hanya build nyata; itu risiko ke-4 di §5.

Tidak ada yang dipilih "tanpa versi". Gaya visual lihat §8 (D2).

### 3.2 Data model

Satu profil, satu key: `local:profile`.

```ts
type Profile = {
  version: 2                                    // 1 sebelum Preferensi kerja; lihat §3.3b
  personal: Record<PersonalKey, string>        // nama depan/tengah/belakang, tanggal lahir, jenis kelamin, kewarganegaraan
  contact: Record<ContactKey, string>          // email, telepon, linkedin, website, jalan, kota, provinsi, kode pos, negara
  education: Education[]                        // urutan array = urutan tampil
  experience: Experience[]
  skills: { group: 'teknis' | 'bahasa' | 'lainnya'; name: string }[]
  custom: { id: string; key: string; value: string }[]
  jobPrefs: JobPreferences                      // dipakai feed lowongan, tidak pernah oleh Fill
}
type Education  = { id: string; institution: string; level: string; major: string; gpa: string; year: string }
type Experience = { id: string; company: string; title: string; start: string; end: string; current: boolean; description: string }
```

Tidak disimpan ke storage: hasil scan, rencana isi, dan nilai awal untuk Undo. Semuanya hidup di memori content script per tab dan hilang saat halaman dimuat ulang (sesuai PRD §8).

Tipe rencana isi (di `core/fill`):

```ts
type FillItem = { fieldId: string; label: string; value: string; enabled: boolean; hasExistingText: boolean; overwrite: boolean }  // overwrite default false
type FillResult = { filled: number; skipped: number }
```

### 3.3 Arsitektur dalam 5 baris

1. **Options page** (React) menulis `Profile` ke `storage.local` lewat `platform/storage`; simpan otomatis dengan debounce dan indikator "Tersimpan".
2. **Content script** disuntik sesuai kebutuhan lewat `scripting.executeScript` setelah izin situs ada (tanpa `matches` statis); ia membaca field form dan memegang scan serta nilai awal.
3. **Side panel** (React) bertanya ke content script lewat pesan bertipe di `platform/messaging`, menampilkan pratinjau, dan mengirim item yang aktif saat Fill.
4. **Fill** menulis nilai lewat native value setter lalu men-dispatch `input` dan `change`; Undo menulis balik nilai awal dari memori. Setelah Fill, field wajib yang masih kosong diberi outline (D15); Undo melepasnya.
5. **Background** hanya tiga hal: membuka halaman options di tab baru, meneruskan `tabs.onActivated`/`onUpdated` ke panel (FR-06), dan membuka panel dari ikon.

### 3.3b Lowongan harian (revisi PRD 2026-10-09)

**Model.** `Profile.version` naik ke 2 dan memuat `jobPrefs` (role, level, lokasi, tipe kerja, kata kunci wajib dan dihindari, gaji minimum). `migrateProfile` dipakai tiap membaca storage; berkas Export versi 1 tetap terbaca. Data feed memakai key terpisah dari profil: `local:feed` (`Job[]`), `local:feedRuns` (`SourceRun[]`, 20 terakhir per sumber), `local:feedState` (status run), `local:feedSettings`, `local:aiKey` (tidak ikut Export, terhapus oleh Hapus semua), dan `session:openedJobs` (tab yang dibuka dari feed).

**Pipeline** (`core/feed/pipeline.ts`, murni; semua I/O disuntikkan):

```
alarm 15 menit → isRunDue (maks 1 run otomatis/hari; mengejar hari yang terlewat)
  → sumber paralel (runSource tidak pernah melempar; gagal → SourceRun {reason})
  → passesRules (kata dihindari, tipe kerja, lokasi) sebelum apa pun disimpan
  → mergeFeed (dedupe URL kanonik, cadangan judul+perusahaan; status dan skor tidak direset) → pruneFeed
  → scoreJobs (AI per batch 5, maks 50/run; gagal atau tanpa kunci → roughScore) → simpan
```

**Sumber** (`core/feed/sources/`): Greenhouse, Lever (`limit=100`), Ashby, Remotive lewat `fetchJson` (timeout, satu retry, 429/403/999 → `blocked`, `credentials: 'omit'`). LinkedIn halaman publik lewat `fetchText`, diparse di offscreen document (service worker tidak punya `DOMParser`); semua selector di `linkedin-selectors.ts`. Halaman detail hanya untuk lowongan yang lolos saringan. Sumber yang gagal tiga run berturut-turut dijeda sampai dinyalakan ulang.

**Izin.** `optional_host_permissions` diminta per sumber dari klik di halaman options (`platform/permissions.ts`). Izin wajib bertambah dua tanpa peringatan instal: `offscreen` dan `alarms`.

**AI.** Klien Anthropic di `platform/ai-client.ts` dengan kunci milik pengguna (BYOK), header `anthropic-dangerous-direct-browser-access`, timeout, dan pemetaan `invalid-key | quota | network | server | bad-request`. Yang dikirim hanya `ProfileSummary` (`core/ai/score.ts`): role, level, skill, judul dan lama pengalaman, jenjang pendidikan, lokasi, tipe kerja; tes memastikan nama, email, telepon, alamat, tanggal lahir, sekolah, perusahaan, dan custom field tidak ada di payload. Skor di-cache dengan hash ringkasan itu.

**Hasil spike T27 (2026-10-09; terminal dan Chrome sungguhan lewat `spikes/t27/`):**

| Sumber | Hasil | Dari service worker, tanpa izin host |
|---|---|---|
| Greenhouse | 729–732 lowongan, 5,7 MB, 0,3–0,8 dtk | berhasil (CORS terbuka) |
| Lever | papan penuh >1 MB dan lambat (>25 dtk di terminal); `limit=30` 276 KB, 0,7–0,8 dtk (satu kali 10 dtk) | berhasil |
| Ashby | 68 lowongan, 2,2 MB, 0,01–1,4 dtk | berhasil |
| Remotive | 17 lowongan, 0,1–1,3 dtk | berhasil |
| LinkedIn guest | tanpa izin: `Failed to fetch`. Dengan izin: 8 halaman × 10 kartu berturut-turut, semua 200, ~0,5 dtk/halaman, tanpa 429 | butuh izin host |

Terbukti di Chrome: fetch dari service worker; `chrome.permissions.request` dari halaman options (izin wajib tidak bertambah selain `offscreen`); parser DOM di offscreen document (8 halaman LinkedIn terbaca); `chrome.sidePanel.open` dari klik di options membuka panel di tab lain (`sp2`) dan di tab yang baru dibuat (`sp1`, tiga kali berhasil). Akibatnya Greenhouse, Lever, Ashby, dan Remotive tidak butuh izin host; hanya LinkedIn yang butuh.

Belum terbukti: request AI dengan kunci sah (uji tanpa kunci mencapai server dan dibalas `401 x-api-key header is required`, jadi tidak ada penghalang CORS, tetapi belum diuji dengan kunci); LinkedIn lewat sekitar 8 halaman belum pernah kena 429 sehingga batas sebenarnya belum diketahui.

**Risiko yang diketahui.** Service worker MV3 bisa dimatikan Chrome di tengah run panjang (state `running` dianggap macet setelah 10 menit); scraping LinkedIn bisa berhenti kapan saja; Lever penuh terlalu besar tanpa `limit`.

### 3.3c Application Kit (revisi PRD 2026-10-15)

**Status: usulan, menunggu persetujuan PIC. Disamakan dengan kode sampai T54 (2026-10-15); bagian surat dan PDF (T50 sampai T52) belum dibangun, jadi tetap rancangan.** Memperluas §3.3b: lowongan yang dipilih pengguna menjadi `Application` yang membawa CV, surat, dan status.

**Model.** Tiga key `storage.local` terpisah supaya daftar Lamaran tidak memuat badan dokumen:

```ts
// local:applications
type AppStatus = 'draft' | 'applied' | 'in-review' | 'interview' | 'offer' | 'rejected' | 'withdrawn'
type Application = {
  id: string                       // crypto.randomUUID()
  jobId: string | null             // Job.id di feed; null untuk lamaran yang ditambah tangan ("Tambah lamaran")
  job: { title: string; company: string; url: string; source: JobSourceId | 'manual'; description: string; capturedAt: string }  // salinan; feed di-prune
  status: AppStatus
  cvId: string | null
  letterId: string | null
  followUpAt: string | null        // hari kalender YYYY-MM-DD (nilai input date), bukan ISO penuh
  notes: string
  aiNoticeAck?: string             // "penyedia:model" yang sudah diperingatkan (FR-46: sekali per lamaran)
  events: AppEvent[]               // append-only
  createdAt: string
  updatedAt: string
}
type AppEvent = { at: string; type: 'created' | 'status' | 'cv' | 'letter' | 'download' | 'fill'; from?: AppStatus; to?: AppStatus; text?: string }

// local:tailoredCvs
type TailoredCv = {
  id: string; applicationId: string; createdAt: string
  profileHash: string                                  // beda dengan hash sekarang = basi (FR-45)
  skills: string[]                                     // urutan prioritas; semuanya ada di Profile.skills
  experience: { sourceId: string; bullets: string[] }[]  // sourceId = Experience.id; jabatan, perusahaan, tanggal diambil dari Profile
  education: string[]                                  // Education.id
  coverage: { required: string[]; covered: string[]; missing: string[] }
  edited: boolean
  aiVersion: { skills: string[]; experience: { sourceId: string; bullets: string[] }[]; education: string[] }  // untuk Kembalikan ke versi AI
}

// local:coverLetters
type CoverLetter = { id: string; applicationId: string; createdAt: string; profileHash: string
  lang: 'id' | 'en'; tone: 'formal' | 'casual'; body: string; aiBody: string; edited: boolean }

// local:aiUsage  — batas harian CV dan surat (FR-46); penghitung, jadi tidak ikut Export
type AiUsage = { date: string; documents: number }
// FeedSettings.documentLimit — batas itu sendiri (bawaan 20), diubah di Atur Lowongan
```

Export naik ke versi 3 dan memuat `jobs`, `applications`, `cvs`, `letters`; berkas versi 1 dan 2 tetap terbaca. `local:aiKey` dan `local:aiUsage` tidak ikut Export.

**Status.** `Application` adalah sumber kebenaran (D11). `deriveJobStatus` murni: `draft` dan `withdrawn` menghasilkan `Job.status = 'saved'`; `applied`, `in-review`, `interview`, `offer`, `rejected` menghasilkan `'applied'`. `shouldMarkApplied` (T38) memanggil `advanceOnFill`: membuat lamaran bila belum ada dan memajukan hanya dari `draft`; status lain tidak berubah.

**Visualisasi alur (FR-48, T54).** Halaman Lamaran punya satu penukar tampilan, Papan / Visualisasi (diagram Sankey); tanpa tampilan Daftar (keputusan PIC 2026-10-15). Dua fungsi murni di `core/applications/`: `funnelStats(apps, now)` dan `layoutSankey(funnel, size)`.

- **Sumber hitungan** adalah `events[]`, bukan hanya `status`, supaya lamaran yang pernah Direview lalu Ditolak tetap tampil di jalur Direview. Tahap terjauh yang pernah dicapai: `applied` → `in-review` → `interview` (Offer adalah simpul akhir, bukan tahap); lamaran yang melompat (Dilamar langsung Interview) dihitung melewati Direview. `rejected` dihitung dari tahap terakhir sebelum penolakan; lamaran yang pernah Offer lalu Ditolak dihitung lewat Interview, karena Offer tidak punya aliran keluar. Lamaran yang dibuat langsung berstatus Dilamar (tanpa event status) dianggap Dilamar sejak `createdAt`.
- **Simpul akhir:** `Tanpa kabar` (status `applied` dan status terakhir berubah ≥14 hari lalu, `STALE_DAYS`; catatan atau dokumen tidak mengulang hitungan), `Masih berjalan` (status aktif lain, atau `applied` <14 hari), `Ditolak`, `Offer`. `draft` dan `withdrawn` dikeluarkan, juga bila `withdrawn` pernah Dilamar. Invarian yang diuji: jumlah simpul akhir sama dengan jumlah lamaran terkirim.
- **Tata letak** (`sankey.ts`, fungsi murni): kanvas 860 × 300, batang 12 px lebar, kolom x 150/360/540/690 (Dilamar, Direview, Interview, simpul akhir), 15 px per lamaran (mengecil bila lamaran terlalu banyak untuk kanvas). Simpul akhir ditumpuk tetap: Tanpa kabar, Ditolak, Masih berjalan, Offer, berjarak 16 px mulai y=28; simpul tanpa lamaran tidak digambar. Tiap batang tahap (dari kanan) ditaruh di y tempat aliran keluarnya paling lurus ke tujuan (rata-rata berbobot jumlah). Pita masuk ke satu batang disusun menurut kolom asalnya, pita keluar menurut posisi vertikal tujuannya. Pita berupa kubik Bézier dengan titik kontrol di tengah antar kolom. Hasilnya data (`{nodes, ribbons}`) yang digambar komponen SVG kecil; tanpa pustaka bagan, supaya warna dan kontras tetap token. **Mockup di `design-system.html` §9 menaruh tiga batang tahap secara manual (y=34/120/150) dan tidak dibangkitkan dari aturan ini; fungsinya menghasilkan y=45/147/185 untuk 12 lamaran contoh yang sama.** Angka, kolom, tinggi batang, tumpukan simpul akhir, label, dan bentuk pita sama.
- **Lebar sempit dan aksesibilitas:** di bawah 600 px (container query pada kartu) diganti daftar batang dengan angka yang sama; tiap pita punya `<title>`, diagram `role="img"` dengan ringkasan (`describeFunnel`).

**Tindak lanjut (FR-47, T53).** `followUpAt` adalah hari kalender. `isDue(app, today)` benar bila tanggalnya hari ini atau sebelumnya dan status bukan Ditolak atau Dibatalkan; `dueCount`, `dueApplications`, dan `dueSummary` murni (`core/applications/followup.ts`). Badge sidebar dan peringatan dihitung di halaman options dari lamaran tersimpan dan tanggal hari ini, jadi tidak ada penyimpanan atau alarm tambahan; `useToday` menggeser tanggal pada tengah malam dan saat tab dibangunkan. Tidak ada notifikasi sistem dan tidak ada badge di ikon ekstensi.

**Pipeline CV** (`core/tailor/`, murni; I/O disuntikkan seperti `core/feed/pipeline.ts`):

```
Buat CV → cap harian (aiUsage) → pseudonymize(Profile)            [core, T47]
  → AI: requirements[] + covered[] + draf { skills[], experience[{sourceId, bullets[]}], education[] }   [satu panggilan, keputusan spike T45]
  → parseOutput (bentuk) → restore(kode → nama asli)
  → validateGrounded(output, Profile)                              [core, T46]
       ditolak → tidak ada CV, pesan sebab, CV lama tetap (panggilan tetap dihitung ke batas harian: biayanya sudah terjadi)
  → coverage(requirements, hasil, covered) → assemble(Profile, hasil)   [jabatan, perusahaan, tanggal dari Profile; pengalaman kosong dari AI jatuh ke isi Profile]
  → simpan TailoredCv + event 'cv'
```

`covered` adalah klaim model tentang requirement yang tertutup; `coverage` tidak memercayainya begitu saja: requirement yang berisi istilah teknis hanya tertutup bila CV memuat semua istilahnya (klaim tidak bisa menutupnya), dan hanya requirement tanpa istilah teknis (bahasa Inggris vs Indonesia tidak berbagi kata) yang bisa ditutup oleh klaim.

**Pemeriksa fakta (D12).** Bentuk keluaran AI sengaja sempit: tidak ada tempat untuk jabatan, perusahaan, institusi, atau tanggal, sehingga fakta terstruktur tidak bisa dikarang menurut struktur datanya. Yang tersisa adalah teks butir. `validateGrounded` memeriksa: (1) tiap `skills[]` ada di `Profile.skills` (huruf besar-kecil tak dipedulikan); (2) tiap `sourceId` ada di Profile dan tidak ganda; (3) tiap angka, persen, dan bilangan berformat Indonesia di butir ada di deskripsi pengalaman asalnya; (4) tiap istilah teknis di butir (dibandingkan dengan daftar skill Profile dan token berhuruf kapital atau berbentuk `nama.js`) ada di deskripsi asal atau daftar skill. Batasnya jujur: klaim semantik ("memimpin tim") tidak bisa dideteksi mesin; itu ditangani diff berdampingan (FR-41) dan penanda `edited`. Pelanggaran menolak seluruh hasil, bukan memperbaikinya diam-diam.

**Payload privasi (D13).** `pseudonymize` mengganti nama perusahaan dan kampus (dan variannya di dalam butir pengalaman) dengan `{C1}`, `{S1}` dan menyimpan peta di memori; `restore` mengembalikannya sebelum validasi. Tes memastikan nilai identitas tidak ada di payload (pola `score.test.ts`). Yang dikirim: PRD §4.2.

**Surat** (`core/letters/`): deteksi bahasa dari teks lowongan dengan rasio kata fungsi Indonesia dan Inggris (fungsi murni, tes dua bahasa); satu panggilan AI; `validateGrounded` dan payload yang sama; nama di penutup disisipkan lokal dari `Profile.personal`. Pengisian ke form: `core/matching` mendapat satu kunci virtual `coverLetter` yang dijawab dari surat lamaran yang tertaut dengan tab lewat `session:openedJobs` (T38); label yang dikenali: "Cover letter", "Surat lamaran", "Letter of motivation". Essay dan pertanyaan bebas tetap dilewati (README "Batas yang sudah diketahui"). Input `type=file` tidak disentuh.

**PDF (T50).** Dua kandidat, dipilih setelah uji kecil: (a) cetak lewat CSS dari halaman options (nol dependensi, teks asli bisa dipilih, tetapi lewat dialog cetak); (b) `pdf-lib` dengan satu templat font standar (satu klik, ±300 KB). Kriteria: teks bisa dipilih dan dicari (ATS), satu klik, rapi untuk Indonesia dan Inggris di A4, ukuran bundle. Tidak ada request jaringan pada keduanya.

**Keputusan PDF (2026-10-16, dipilih PIC setelah uji kecil `spikes/t50/run.mjs`): `pdf-lib` 1.17.1.** Dua CV yang sama (Indonesia dan Inggris, A4) dibuat dengan keduanya dan dibaca ulang dengan pdf.js:

| | Cetak lewat CSS (Chrome) | `pdf-lib` |
|---|---|---|
| Teks bisa dipilih dan dicari | ya (semua frasa uji ditemukan) | ya (semua frasa uji ditemukan) |
| Ukuran berkas | ±102 KB (font di-embed) | ±2 KB (font standar) |
| Bundle ekstensi | +0 | +505 KB minify (185 KB gzip) untuk pemakaian terkecil; di build akhir 430 KB, satu chunk yang dimuat malas saat Unduh |
| Klik | dialog cetak, lalu pilih "Simpan sebagai PDF", lalu dialog simpan | satu klik |
| Nama berkas | usulan dari judul halaman | `CV-{perusahaan}.pdf` persis |
| Aksara | semua | hanya WinAnsi (Latin-1 dan tanda baca Windows-1252) |
| Uji otomatis | tidak (hanya dilihat) | ya (tata letak murni) |

Alasan: kriteria tiket (satu klik, nama berkas, FR-42) dan tata letak yang bisa diuji unit. Harga: satu dependensi runtime baru yang terakhir dirilis 2021, dan huruf di luar WinAnsi ("李", "Иван", bahkan "Nguyễn") tidak bisa ditulis font standar. Mitigasi: `toWinAnsi` mengganti huruf beraksen dengan huruf polosnya dan huruf aksara lain dengan "?", dan setelah unduh pengguna diberi tahu huruf mana yang diganti; PDF dengan font tersemat (butuh berkas font dan `fontkit`) ditunda sampai ada kebutuhan nyata. Tata letak ada di `core/tailor/pdf-layout.ts` (murni: `layoutCv` menghasilkan operasi gambar per halaman A4), penggambarnya di `platform/cv-pdf.ts`. Satu templat. Tidak ada request jaringan: font standar tidak diunduh, `pdf-lib` dimuat dari paket ekstensi.

**Hasil spike T45 (2026-10-15; dinilai dan diputuskan PIC 2026-10-16: lanjut T46, satu panggilan, model setara `3.6-flash`; nilai PIC satu panggilan jujur 5,0 dan selaras 4,8).** Detail dan angka di `docs/plan.md` T45. Diukur di Gemini (Zen tidak bisa dipanggil dari terminal: model gratis 403, berbayar 402). Dari 31 hasil, pemeriksa mekanis tidak menemukan skill, angka, atau istilah karangan; peregangan semantik ("clean code" dianggap tertutup oleh code review) hanya terlihat manusia, sesuai batas D12. Model kecil (`3.5-flash-lite`) sering mengembalikan CV tanpa butir (4 sampai 5 dari 9), jadi `assemble()` perlu jatuh ke isi Profile bila AI mengembalikan pengalaman kosong. Usulan: **satu panggilan** (mutu tidak lebih baik dengan dua, separuh request), model bawaan setara `3.6-flash` (± $0,002 per CV), pemeriksa mekanis cukup sehingga T46 sampai T52 tidak didesain ulang. Tier gratis Gemini dibatasi 20 request per hari per model dan kontennya dipakai Google untuk memperbaiki produk; batas harian FR-46 dan peringatan data perlu mengenal itu. Diputuskan PIC.

**Risiko yang diketahui.** Halusinasi semantik yang lolos pemeriksa mekanis (mitigasi: diff dan edit manual, metrik PRD §10 menghitung klaim palsu); model gratis yang memakai data untuk melatih (mitigasi: peringatan dan batas payload §4.2); biaya per lamaran belum diukur (spike T45 dan T48); `storage.local` penuh oleh dokumen (CV dan surat berukuran KB, kecil dibanding feed; pemangkasan feed tidak menyentuh lamaran); Fill di halaman di luar feed tidak membuat lamaran (T21 tetap ditunda).

### 3.4 Yang biasanya makan lebih dari 2 jam di stack ini

1. **Mengisi form React/Vue (FR-10).** Menyetel `.value` saja tidak cukup; state framework tidak berubah. Perlu native setter dan event.
2. **Izin situs + injeksi + frame (FR-18, §8).** Izin harus diminta dari gestur pengguna di halaman ekstensi; `executeScript` gagal pada halaman internal dan frame lintas-origin. Itu harus berujung ke state yang benar di PRD §8.
3. **Heuristik label (FR-13, metrik §10).** `label[for]`, pembungkus `label`, `aria-label`, `placeholder`, teks di dekat input, `autocomplete`; dua bahasa. Ini penentu ≥70%.
4. **Panel mengikuti tab aktif (FR-06).** Pesan background → panel dan pembatalan hasil scan yang basi.
5. **Token desain ke Tailwind 4.** `design-system.md` ditulis sebagai CSS variables; harus dipindah ke `@theme` sekali, lalu semua komponen memakai itu.

## 4. Alternatives considered

| Alternatif | Ditolak karena |
|---|---|
| **Plasmo** (`plasmo` 0.90.5) | Build berbasis Parcel; dokumentasi Tailwind-nya masih v3, tidak cocok dengan Tailwind 4 yang dipilih. Pesan content-script dan test tetap perlu dirangkai sendiri. |
| **Vite + `@crxjs/vite-plugin` 3.0.0** | Murah di build, tapi storage, test browser palsu, dan penulisan manifest semua dirangkai sendiri; menghabiskan jam dari 20 jam yang justru dihemat WXT. |
| **TypeScript murni tanpa React** | Options page punya daftar entri yang bisa ditambah, dihapus, diurut, dan panel punya daftar toggle. Tanpa React, state dan render itu ditulis manual, lebih panjang dari memasang React. |

## 5. Risks

| Risk | Early warning sign | Fallback |
|---|---|---|
| Pemetaan di bawah 70% pada 10 situs | Akhir Phase 2, di bawah 50% pada 3 fixture | Tambah sinonim label dan prioritas atribut `autocomplete`; potong FR-14 lalu FR-15 lalu FR-16 sesuai cut list PRD §9. |
| Form React/Vue menolak nilai (FR-10) | Nilai hilang saat fokus pindah di fixture React | Native setter + `InputEvent`; kalau masih gagal, `document.execCommand('insertText')` untuk field itu. |
| Injeksi gagal di situs target (FR-18, §8) | `Cannot access contents of url` di salah satu situs uji | Injeksi per frame; frame yang tidak bisa dibaca menjadi state "terkunci" PRD §8. |
| Kombinasi TypeScript 7.0.2, Vite 8.3.4, dan WXT 0.21.4 belum pernah dijalankan bersama | `wxt prepare` atau `tsc --noEmit` gagal di tiket scaffold | Turunkan ke `typescript` seri 5.x terbaru dan `vite` 7.x; peer WXT dan semua plugin mengizinkan keduanya. |

## 6. Rollout & revert

Tidak ada hosting; "URL publik" untuk ekstensi adalah build yang terpasang di Chrome.

- **Phase 1 — Foundation (~3 jam).** Scaffold WXT, token `@theme`, side panel dan options kosong, `npm run build`, muat sebagai unpacked extension. **Milestone:** ekstensi terpasang di Chrome, ikon membuka panel, tombol Edit Profile (FR-17) membuka options di tab baru.
- **Phase 2 — Walking skeleton (~7 jam, Day 5).** Simpan Personal Info → scan satu fixture → pratinjau → Fill → Undo. **Milestone:** satu klik mengisi fixture HTML biasa dan Undo mengembalikannya.
- **Phase 3 — Fitur penuh (~10 jam).** Sisa bagian profil, alur izin, semua state PRD §8, fixture React, label dua bahasa, ukur 10 situs. **Milestone:** metrik §10 punya angka.

Revert per phase: tag git di akhir tiap phase; kembali ke tag, `npm run build`, muat ulang ekstensi.

## 7. Open technical questions

Tidak ada yang memblokir approval.

1. Daftar pasti field Personal Info dan Contact diambil dari mockup `docs/reference/` dan `docs/prd.md` lama. PRD baru tidak menyebut tiap field; PIC boleh memangkas.
2. Saluran rilis (Chrome Web Store atau unpacked untuk portfolio) tidak ada di PRD. Tidak mengubah desain.
3. Tampilan untuk kegagalan di luar enam alasan PRD §8 (error tak terduga) belum ada di PRD. Sampai ditentukan, error tak terduga tidak ditangkap.

## 8. Decisions log

**D1 — WXT 0.21.4 + React.**
*Why:* layout `entrypoints/` file-based, plugin test dan storage bawaan, peer range cocok.
*Cost:* framework masih 0.x; konvensi WXT harus dipelajari; pindah build tool mahal.
*Verdict:* ya.

**D2 — Arah desain: "Soft-UI card" + "Bright-blue friendly" (PRD §0).**
*Why:* kartu putih radius 14px dengan border tipis, latar abu terang, biru eksklusif untuk yang bisa diklik, hijau terisi, amber perlu perhatian; nada ramah dengan maskot flat. Aturan dan token ada di `docs/design-system.md`.
*Cost:* kartu dan border menambah markup dan CSS di setiap layar; aturan "biru hanya untuk yang bisa diklik" membatasi pemakaian warna; enam state maskot harus dibuat sebagai aset SVG; mode gelap tidak ada di v1.
*Verdict:* ya, jadi acuan P6 dan P7.

**D3 — Tailwind 4.3.3 + lucide-react 1.53.0 + motion 14.0.0.**
*Why:* tanpa ini, ikon, press state Fill/Undo, dan kontrol native (select) harus dibuat tangan di setiap komponen.
*Cost:* tiga dependensi; ukuran bundle panel bertambah; token desain harus dipindah ke `@theme` sekali di awal.
*Verdict:* ya.

**D4 — Pisah `core/` (TS murni) dan `platform/` (satu-satunya pemanggil `browser.*`).**
*Why:* pemetaan dan fill adalah inti produk dan metrik; keduanya harus bisa diuji tanpa browser.
*Cost:* lebih banyak berkas; satu lapisan perlu dijaga saat review.
*Verdict:* ya.

**D5 — Izin situs opsional, injeksi sesuai kebutuhan, izin `tabs`.**
*Why:* FR-18 menuntut tombol izin per situs; PRD §8 menuntut panel menyebut domain bahkan sebelum diizinkan, yang butuh `tabs` untuk membaca URL.
*Cost:* instalasi menampilkan peringatan "membaca riwayat penjelajahan" karena `tabs`; pengguna harus mengizinkan tiap situs sekali.
*Verdict:* ya.

**D6 — Tanpa library state global; satu hook `useProfile` di atas storage.**
*Why:* satu profil, dua halaman, tidak ada state yang dibagi di luar storage.
*Cost:* tiap layar membaca profil sendiri; tidak ada cache bersama.
*Verdict:* ya.

**D7 — Nilai awal untuk Undo hanya di memori.**
*Why:* PRD §8: Undo tidak tersedia setelah halaman dimuat ulang.
*Cost:* pengguna kehilangan Undo saat reload; tidak ada cara memulihkan.
*Verdict:* ya.

**D8 — Auto-import WXT dimatikan; semua impor eksplisit.**
*Why:* asal setiap fungsi terlihat saat review.
*Cost:* lebih banyak baris impor.
*Verdict:* ya.

**D9 — Lowongan harian memakai jaringan dan AI (keputusan PIC 2026-10-09, PRD §4.1).**
*Why:* mencarikan lowongan butuh request keluar; menilai kecocokan dan mengisi field yang kosong butuh model.
*Cost:* prinsip "tanpa jaringan, tanpa AI" hanya berlaku untuk autofill, profil, dan Import CV; izin host dan kunci API milik pengguna; risiko ToS dan blokir pada scraping.
*Verdict:* ya, mati secara bawaan, izin diminta per sumber, data yang dikirim dibatasi ke ringkasan tanpa identitas.

**D10 — Folder `core/feed/` baru, bukan memperluas `core/jobs/`.**
*Why:* `CapturedJob` (T20) dan `Job` (feed) punya bentuk dan status berbeda; menggabungkannya memaksa satu tipe melayani dua arti.
*Cost:* kode Captured Jobs lama menunggu dihapus (belum dihapus: hook menolak `git rm`).
*Verdict:* ya.

**D11 — `Application` adalah sumber kebenaran status; `Job.status` diturunkan (usulan 2026-10-15).**
*Why:* dua status yang bisa diubah dari dua tempat (kartu feed dan tracker) akan berselisih. Satu arah penurunan menghilangkan kelas bug itu.
*Cost:* mengubah status dari menu kartu ("Tandai dilamar") harus lewat lamaran; migrasi kecil pada `shouldMarkApplied` (T38).
*Verdict:* ya.

**D12 — AI tidak pernah menulis fakta terstruktur; pemeriksa fakta menolak, tidak memperbaiki (usulan 2026-10-15).**
*Why:* keluaran AI hanya `{ sourceId, bullets[] }`; jabatan, perusahaan, institusi, dan tanggal diambil dari Profile. Hasil yang memuat skill, angka, atau istilah di luar Profile ditolak seluruhnya, sehingga tidak ada CV yang tampak benar tetapi mengandung klaim palsu tanpa tanda.
*Cost:* klaim semantik yang halus lolos mesin; keluaran yang kadang ditolak membuat pengguna menekan Buat ulang; butir hasil tidak bisa menambahkan konteks yang tidak ada di deskripsi.
*Verdict:* ya. Mutunya diukur di spike T45.

**D13 — Nama perusahaan dan kampus dipseudonimkan di payload CV dan surat, dipulihkan lokal (usulan 2026-10-15).**
*Why:* butir pengalaman perlu dikirim agar bisa disesuaikan, tetapi sering memuat nama klien atau perusahaan; kode `{C1}` tidak mengurangi mutu dan menjaga data tidak keluar.
*Cost:* pencocokan varian nama di dalam teks bebas tidak sempurna; satu langkah proses tambahan di kedua arah.
*Verdict:* ya, menunggu keputusan PIC di PRD §11.

**D14 — CV hanya diunduh; tidak ada unggah otomatis ke form (usulan 2026-10-15).**
*Why:* mengisi `input type=file` dari ekstensi memerlukan perilaku yang rapuh dan melanggar janji README "tidak mengunggah CV ke form lamaran"; pengguna tetap memilih berkas yang jelas ia periksa.
*Cost:* satu langkah manual per lamaran; panel harus menjelaskan sebabnya.
*Verdict:* ya.

**D15 — Field wajib yang belum terisi diberi outline di halaman (keputusan PIC 2026-10-09, PRD FR-20).**
*Why:* JobFill lama menandai field yang harus diisi sendiri; daftar di panel saja memaksa pengguna mencocokkan nama field dengan form. Outline dipasang hanya setelah Fill (FR-09), pada field wajib yang kosong dan terlihat; wajib dikenali dari atribut `required`, `aria-required`, atau tanda di label karena Greenhouse, Lever, dan Intikom hanya menandainya di label. `core/fill/mark.ts` memasang empat properti `outline-*` inline dengan `!important` (amber-600 `#DC6803`, 2px, jarak 2px), mencatat nilai inline milik situs, dan mengembalikannya saat satu field dijawab pengguna (listener `input` dan `change`), saat Undo, dan saat Fill diulang. Grup radio diberi outline pada fieldset atau radiogroup-nya, bukan tiap tombol. Tidak ada elemen yang ditambahkan.
*Cost:* mengubah tampilan halaman milik situs lain; `!important` inline mengalahkan outline dari stylesheet situs, dan outline inline milik situs pada field itu ditimpa lalu dikembalikan saat tanda dilepas (outline dari stylesheet kembali sendiri begitu properti inline dihapus); field yang disembunyikan lewat posisi di luar layar dianggap terlihat karena tata letak tidak diukur; selama tanda ada, listener `input` dan `change` terpasang pada field situs itu.
*Verdict:* ya.

## 9. Stack conventions

### Folder structure

```
wxt.config.ts            # srcDir: 'src', imports: false, manifest, module react
vitest.config.ts
fixtures/                # HTML form uji untuk test fill dan matching
src/
  core/                  # TS murni. Tanpa import react, wxt, atau browser.*
    profile/             # types.ts, skema, normalisasi
    matching/            # label → kunci profil (ID+EN), dropdown/radio
    fill/                # rencana isi, nilai awal, hitung hasil
  platform/              # satu-satunya tempat browser.*: storage, messaging, permissions, tabs
  ui/
    primitives/          # Button, Chip, Switch, Card (dipakai >1 layar)
    mascot/
  entrypoints/
    background/  page-reader/  sidepanel/  options/   # tipis: mount dan wiring; page-reader = unlisted script yang disuntik lewat scripting.executeScript
  assets/                # tailwind.css (@theme), SVG
```

Tes ditaruh di samping berkas (`label.ts` dan `label.test.ts`). Tipe ada di `types.ts` tiap modul `core/*`; tidak ada folder `types/` global. Komponen layar (S1, S2, S3) ada di folder entrypoint masing-masing.

### UI layer

Tailwind 4 saja; token dari `docs/design-system.md` hidup sebagai `@theme` di `src/assets/tailwind.css`. Dilarang nilai warna, radius, atau spasi mentah di komponen. Ikon hanya dari `lucide-react`. Gerak hanya lewat `motion/react`, memakai durasi dan easing dari design-system §3.5. Biru hanya untuk elemen yang bisa diklik. Select dan kontrol native harus distyle.

### Naming

- Berkas: `kebab-case.ts`; berkas komponen `PascalCase.tsx` sama dengan nama komponennya.
- Fungsi dan variabel: `camelCase`, fungsi diawali kata kerja.
- Tipe: `PascalCase`, tanpa awalan `I`.
- Hook: `useX`.
- Key storage: `local:profile`.

### State & data access

State lokal React plus hook `useProfile` yang membaca dan menulis lewat `platform/storage`. Komponen tidak memanggil `browser.*`. Hook tidak berisi aturan pemetaan atau pengisian; itu hanya di `core/`. Dilarang: Redux, Zustand, Context untuk data profil, dan membaca storage langsung dari komponen.

### Error handling

Kegagalan yang diharapkan dikembalikan sebagai `{ ok: false, reason }`, tidak dilempar. `reason` hanya salah satu dari baris PRD §8: `no-form`, `unreachable-page`, `locked-frame`, `no-permission`, `storage-full`, `empty-profile`. Panel menampilkan satu state per `reason`. Tidak ada `try/catch` di luar alasan itu; error lain dibiarkan ke console (lihat §7 butir 3).

### Testing

Ditest: semua di `core/` (matching, rencana isi, normalisasi profil), `platform/` yang punya logika (dengan `fake-browser`), dan perilaku fill/undo terhadap `fixtures/*.html` di happy-dom, termasuk satu fixture React. Tidak ditest: gaya visual, snapshot, dan komponen presentasi murni. Perintah: `npm test`.

### Env vars

Tidak ada rahasia. Satu bendera build, `WXT_SHARE_BUILD=true`, dipakai oleh `npm run build:share` dan `npm run zip:share` (D16).

### Deploy

Tidak ada hosting. Build: `npm run build` menghasilkan `.output/chrome-mv3/`. Paket: `npm run zip`. Pasang: Chrome → `chrome://extensions` → Developer mode → Load unpacked → pilih `.output/chrome-mv3/`.

### Stack gotchas

- Entrypoint bernama `content` (atau `*.content`) dianggap content script ber-manifest dan wajib punya `matches`. Script yang disuntik manual dinamai lain (`page-reader`) dan ditulis dengan `defineUnlistedScript`; hasil build di `/page-reader.js`.
- Chrome 137 ke atas mengabaikan `--load-extension` kecuali dijalankan dengan `--disable-features=DisableLoadExtensionCommandLineSwitch`; build hasil `wxt build` tidak ikut termuat tanpa flag itu saat diuji otomatis.
