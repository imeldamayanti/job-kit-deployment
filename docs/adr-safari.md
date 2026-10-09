# ADR — Dukungan Safari

**Status:** Arah ditetapkan · satu putusan (S1) masih terbuka
**Turunan dari:** `docs/prd.md` §5 (AD-4), §4.2 (NG6)
**Berdampak ke:** `docs/screens.md` §2.2, `docs/design-system.md` D4
**Tanggal:** 2026-09-03
**Kondisi platform diperiksa:** Safari 26 / macOS 26, September 2026. Dukungan Safari bergerak cepat — §7 mencatat apa yang harus dicek ulang sebelum keputusan ini dianggap masih benar.

---

## 1. Konteks

`prd.md` NG6 menyatakan v1 hanya Chromium. Alasannya waktu itu masuk akal: seluruh permukaan utama produk ini adalah side panel, dan side panel adalah API Chrome.

Dua hal berubah sejak dokumen itu ditulis:

1. **Safari 26 punya loop pengembangan seperti Chrome.** Settings → Advanced → "Show features for web developers" → tab Developer → "Allow unsigned extensions" → "Add Temporary Extension…", tunjuk folder berisi `manifest.json`. Tidak butuh Xcode, tidak butuh akun Apple, tidak butuh Mac untuk distribusi (§5). Biaya masuk untuk *mencoba* Safari sekarang mendekati nol.
2. **Sisa arsitektur JobFill ternyata portabel.** Tidak ada backend (AD-1) dan tidak ada LLM call (AD-2) berarti tidak ada satu pun bagian produk yang bergantung pada infrastruktur yang harus diadaptasi. Klaim privasi §9 justru menjadi aset saat App Review, bukan beban.

Yang tidak berubah, dan ini intinya: **`chrome.sidePanel` tidak ada di Safari yang sudah rilis.** WebKit sedang mengimplementasikannya (`sidePanel` dan `sidebarAction`) sejak 2024, tapi masih di balik compile-time flag `ENABLE_WK_WEB_EXTENSIONS_SIDEBAR` dan tidak ikut rilis di Safari 26. Memanggilnya di Safari hari ini mengembalikan error "unimplemented".

Artinya permukaan yang menampung 8 dari 11 state panel (`screens.md` §2), sticky action footer, summary bar, dan **field preview row** — komponen yang `screens.md` §4.2 sendiri sebut paling sering muncul di produk ini — tidak punya tempat berdiri di Safari.

Semua putusan di bawah adalah turunan dari satu kalimat itu.

---

## 2. Yang jalan tanpa perubahan

Ditulis eksplisit supaya scope-nya tidak dibesar-besarkan:

| Bagian | Catatan |
|---|---|
| Seluruh `design-system.md` | Token, komponen, kontras, radius — semua CSS biasa |
| Font stack `-apple-system` (D5) | Justru paling tepat di sini; alasan "terasa bagian dari browser" berlaku lebih kuat di Safari |
| Options page | `options_ui` didukung Safari, dan Safari memberinya tombol **Settings** sendiri di Extensions settings. Dibuka juga lewat `tabs.create(runtime.getURL('options.html#profile'))` seperti sekarang |
| Deteksi & pemetaan field (AD-2) | Murni DOM. `autocomplete` → `name`/`id` → `label` → `aria-label` → `placeholder` tidak berubah |
| `storage.local` | Didukung. Kita tidak memakai `storage.sync`, jadi tidak ada masalah — Safari tidak punya sync yang setara |
| Content script + `scripting.executeScript` | Didukung |
| Export/import JSON (§7.5) | Tidak menyentuh API browser yang berbeda |

Perkiraan kasar: sekitar 80% permukaan kerja v1 pindah apa adanya.

---

## 3. Putusan

### S1 — Permukaan pengganti side panel — **masih terbuka**

Dua kandidat. Keduanya nyata, dan pilihannya menentukan berapa banyak `screens.md` §2 harus ditulis ulang.

**Kandidat A — action popup** (`action.default_popup`)

HTML yang sama, dipasang sebagai popover ikon toolbar.

*Alasan:* perubahan paling kecil. Layout 400px sudah cocok dengan lebar popover.

*Biaya:* popover bersifat sementara — tertutup begitu pengguna mengklik apa pun di halaman. Ini menabrak state **A5 `filled`** secara langsung: state itu mengandaikan panel tetap terbuka di sebelah form sementara pengguna memeriksa hasil, menekan Undo, dan mengoreksi kartu simpan lowongan. Di popup, panelnya sudah hilang saat pengguna melirik form. Undo sendiri masih bisa selamat (state-nya hidup di content script, bukan di panel), tapi jalurnya jadi: buka lagi panel → cari tombol Undo. Selain itu tinggi `<body>` harus di-set eksplisit; Safari menyesuaikan ukuran popover ke isi, dan layout yang dirancang untuk tinggi viewport akan menciut jadi kotak kecil.

**Kandidat B — drawer yang di-inject content script**

Panel 400px dirender ke dalam DOM halaman oleh content script, di dalam Shadow DOM.

*Alasan:* mempertahankan perilaku yang jadi alasan side panel dipilih sejak awal — panel tetap terbuka sementara pengguna berinteraksi dengan form. Dan karena ini bekerja identik di Chrome, jangka panjangnya **satu permukaan, bukan dua** yang harus dirawat berdampingan.

*Biaya:* tiga, dan tidak ada yang sepele. (a) Token `design-system.md` harus hidup di dalam shadow root supaya CSS situs tidak bocor masuk dan sebaliknya. (b) Sebagian situs punya CSP yang melawan. (c) Yang paling menentukan: **content script tidak bisa di-inject di halaman awal Safari dan PDF viewer** — persis kasus yang state **A7 `error`** ada untuk menjelaskannya. Jadi B tetap butuh popup kecil sebagai jalur cadangan, khusus untuk memberi tahu kenapa panel tidak muncul.

**Rekomendasi:** B, dengan popup minimal sebagai penampung A1/A7. Alasannya bukan Safari — alasannya konvergensi. A memberi dua permukaan berbeda untuk dirawat selamanya; B memberi satu, dan menutup masalah yang sama di kedua browser.

**Kenapa masih dibiarkan terbuka:** biaya (a) dan (b) hanya terukur setelah dicoba pada daftar situs uji `prd.md` §12. Diputuskan setelah A2/A3 dirender sungguhan di dalam Shadow DOM pada Greenhouse dan satu situs Indonesia, bukan sekarang di atas kertas.

### S2 — Model izin Safari melahirkan state panel baru

Safari meminta izin per-situs kepada pengguna, dengan pilihan "Allow for One Day" atau "Always Allow on This Website". Ini lebih ketat daripada Chrome.

Sikap `prd.md` §9.2 — `activeTab`, inject on-demand, **tanpa** `<all_urls>` — kebetulan justru sikap yang paling tepat untuk Safari dan akan memudahkan App Review. Tapi konsekuensi UX-nya nyata: pengguna harus memberi izin di setiap domain ATS baru, dan sebelum izin itu ada, panel tidak bisa membaca apa pun.

*Putusan:* tambahkan state **A8 `permission-required`** ke `screens.md` §2.2. Ini bukan varian A7. A7 adalah kegagalan teknis yang tidak bisa diapa-apakan pengguna selain pindah halaman; A8 punya satu tindakan jelas yang menyelesaikannya.

*Alasan:* §10 melarang kegagalan senyap. Tanpa A8, kasus paling umum yang akan ditemui pengguna Safari baru tampil sebagai `no-form` — panel bilang "tidak ada form di halaman ini" padahal formnya ada dan hanya izinnya belum diberikan. Itu persis definisi kegagalan senyap yang dilarang dokumen ini.

### S3 — Manifest, background, dan skema URL

| Hal | Yang berubah |
|---|---|
| Skema URL extension | `chrome-extension://<id>` → `safari-web-extension://<UUID>`, dan **UUID-nya diacak ulang per instalasi dan per perangkat**. Tidak boleh ada satu pun string skema yang di-hardcode; semua lewat `runtime.getURL()`. Deep link `options.html#profile` (`screens.md` §1) tetap aman lewat jalur itu |
| `browser_specific_settings.safari` | Set `strict_min_version`. **Jangan** pasang batas maksimum — cap seperti `18.*` menyembunyikan extension dari pengguna Safari 26 |
| `background.type: "module"` | Hindari. Penyebab kegagalan senyap yang sudah dikenal di Safari |
| Debug background MV3 | Service worker sering tidak muncul di Develop → Web Extension Background Content pada macOS 26; `background.scripts` non-persisten bisa di-debug normal |
| Bentuk manifest | Konsekuensi dari dua baris di atas: **siapkan build step manifest per-browser**, jangan satu `manifest.json` untuk keduanya |

### S4 — Dark mode naik dari "ditunda" jadi syarat rilis Safari

`design-system.md` D4 menunda nilai dark mode secara sadar, dan menerima konsekuensinya: "panel akan terasa terang menempel di Chrome yang gelap."

Di Safari 26 / macOS 26 konsekuensi itu lebih berat, bukan sama. Penundaan D4 tetap benar untuk v1 Chrome; ia tidak lagi benar untuk rilis Safari.

*Biaya:* rendah, dan itu memang hasil yang dirancang D4. Karena tidak ada komponen yang menyebut palet mentah (§5 aturan 1), menambahkannya adalah satu blok `@media (prefers-color-scheme: dark)`, bukan penulisan ulang.

### S5 — Distribusi: uang sedikit, kecepatan banyak

| | Chrome Web Store | Safari |
|---|---|---|
| Biaya | $5 sekali | **$99 per tahun** (Apple Developer Program) |
| Bentuk paket | ZIP | Extension dibungkus containing app |
| Butuh Mac / Xcode | — | **Tidak.** App Store Connect → buat app record → tab Xcode Cloud → **Safari Web Extension Packager** → unggah ZIP → keluar bundle app+extension tertanda, beberapa menit |
| Uji sebelum rilis | Unpacked | TestFlight |
| Tiap update | Terbit cepat | Lewat App Review |

`xcrun safari-web-extension-packager` di Mac hanya perlu kalau kita mau native messaging. JobFill tidak.

*Biaya sebenarnya bukan $99, tapi kadensi.* Setiap perbaikan aturan pemetaan — pekerjaan yang menurut §10 akan sering dilakukan sambil menguji 10 situs — antre di App Review. Ini alasan utama Safari sebaiknya bukan target rilis pertama.

### S6 — macOS saja untuk v1 Safari

App Store Connect menawarkan iOS bersamaan, yang berarti iPhone, iPad, dan visionOS sekaligus.

*Putusan:* ambil macOS saja.

*Alasan:* di iOS tidak ada popover toolbar dengan bentuk yang sama, sehingga options page menjadi permukaan utama dan seluruh `screens.md` §3 harus dirancang ulang untuk lebar telepon. Itu produk lain, bukan platform tambahan. Pilihan platform di App Store Connect membuatnya terlihat gratis; tidak.

---

## 4. Konsekuensi untuk NG6

NG6 dicabut sebagian, bukan dibatalkan: Safari masuk sebagai **target sesudah v1**, dengan syarat masuk yang sama tegasnya dengan fitur di `prd.md` §11.

**Syarat masuk Safari:** autofill stabil di ≥10 situs `prd.md` §12 di Chrome, dan S1 sudah diputuskan lewat prototipe.

*Alasan syarat itu:* selama aturan pemetaan masih sering berubah, setiap perubahan berarti satu siklus App Review. Memasuki Safari sebelum aturannya mengendap berarti membayar biaya kadensi §S5 pada fase yang paling butuh iterasi cepat.

Firefox tetap di luar scope. Catatan: Firefox punya `sidebarAction` — jalur ke sana justru lebih pendek daripada ke Safari kalau S1 memilih Kandidat A.

---

## 5. Ringkasan pekerjaan

| # | Pekerjaan | Prasyarat |
|---|---|---|
| 1 | Prototipe A2/A3 di dalam Shadow DOM pada 2 situs uji, untuk memutuskan S1 | — |
| 2 | Rancang & gambar state A8 `permission-required` | S2 |
| 3 | Tulis nilai dark mode di `design-system.md` §3.3 | S4 |
| 4 | Build step manifest per-browser + audit semua `chrome-extension://` | S3 |
| 5 | Uji ulang kuota `storage.local` Safari terhadap `prd.md` §13 pertanyaan 4 | — |
| 6 | Verifikasi badge ikon toolbar (FR-PANEL-05) di Safari | — |
| 7 | Daftar Apple Developer Program, packaging, TestFlight | §4 syarat masuk terpenuhi |

---

## 6. Yang masih terbuka

1. **S1** — popup atau injected drawer. Diputuskan setelah pekerjaan #1.
2. **Kuota `storage.local` Safari.** `prd.md` §13 pertanyaan 4 menanyakan batas captured jobs; jawabannya berbeda antar browser dan belum diukur di keduanya.
3. **Badge toolbar (FR-PANEL-05).** Perlu dicek langsung, bukan diasumsikan.
4. **Halaman yang tidak bisa di-inject di Safari** — daftar sebab A7 (`prd.md` §6.1 menyebut `chrome://`, PDF, iframe cross-origin) perlu padanan Safari-nya sebelum A7 digambar.

---

## 7. Kapan dokumen ini kedaluwarsa

Satu hal saja yang membalik seluruh isinya: **`sidePanel` rilis di Safari stabil.** Implementasinya sudah ada di WebKit dan tinggal menunggu flag dibuka. Kalau itu terjadi, S1 gugur, A8 tetap berlaku, dan porting Safari turun menjadi pekerjaan manifest (S3) plus dark mode (S4) saja.

Cek ulang sebelum memulai pekerjaan #1.
