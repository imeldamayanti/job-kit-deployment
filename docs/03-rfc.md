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
| **Complexity ban** | Tanpa library state global; tanpa router; tanpa backend; tanpa panggilan LLM; tanpa pemetaan manual per situs; tanpa UI yang disuntik ke halaman lamaran (semua UI di side panel dan options). |

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
  version: 1
  personal: Record<PersonalKey, string>        // nama depan/tengah/belakang, tanggal lahir, jenis kelamin, kewarganegaraan
  contact: Record<ContactKey, string>          // email, telepon, linkedin, website, jalan, kota, provinsi, kode pos, negara
  education: Education[]                        // urutan array = urutan tampil
  experience: Experience[]
  skills: { group: 'teknis' | 'bahasa' | 'lainnya'; name: string }[]
  custom: { id: string; key: string; value: string }[]
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
4. **Fill** menulis nilai lewat native value setter lalu men-dispatch `input` dan `change`; Undo menulis balik nilai awal dari memori.
5. **Background** hanya tiga hal: membuka halaman options di tab baru, meneruskan `tabs.onActivated`/`onUpdated` ke panel (FR-06), dan membuka panel dari ikon.

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

Tidak ada. Tidak ada backend, kunci, atau rahasia.

### Deploy

Tidak ada hosting. Build: `npm run build` menghasilkan `.output/chrome-mv3/`. Paket: `npm run zip`. Pasang: Chrome → `chrome://extensions` → Developer mode → Load unpacked → pilih `.output/chrome-mv3/`.

### Stack gotchas

- Entrypoint bernama `content` (atau `*.content`) dianggap content script ber-manifest dan wajib punya `matches`. Script yang disuntik manual dinamai lain (`page-reader`) dan ditulis dengan `defineUnlistedScript`; hasil build di `/page-reader.js`.
