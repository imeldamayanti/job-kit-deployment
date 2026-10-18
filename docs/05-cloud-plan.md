# Rencana: deployment, penyimpanan data, metrik, dan API generate

Status: **Fase 1 dikerjakan (tersisa langkah di tangan PIC), Fase 2 disetujui PIC dan kodenya selesai tetapi belum diuji ke server sungguhan** (2026-10-18). Fase 3 disetujui PIC dan dikerjakan di kode dan dokumen, kecuali T35/T55; Fase 4 masih usulan dan butuh persetujuan PIC.

Kemajuan Fase 1:
- [x] Build dibagikan tanpa AI: `npm run build:share` (RFC D16). Belum dicek visual di Chrome sungguhan.
- [x] Website statis di `site/`: beranda, pasang, privasi (draf), masukan, `vercel.json` dengan CSP. Deploy oleh PIC.
- [ ] Formulir masukan aktif: butuh proyek Supabase dan `site/config.js` ([supabase/README.md](../site/supabase/README.md)). Menjalankan SQL-nya oleh PIC.
- [x] Panduan distribusi: [06-distribution.md](06-distribution.md). Butir **[verifikasi]** belum dicek.
- [ ] Zip dibagikan ke 3 teman dan angka pemasangan terlihat.
Kemajuan Fase 2 (disetujui PIC 2026-10-18, enkripsi di sisi klien diterima; PRD §4.3, RFC D17, README diperbarui):
- [x] Kode: `core/sync/` (crypto AES-GCM + PBKDF2, merge, engine, API Supabase, pesan), `platform/sync.ts`, halaman **Akun** di options. Semua bertes; tes dua perangkat memakai server palsu.
- [x] SQL: `supabase/sync.sql` (tabel `user_data`, RLS, `delete_account()`), diperiksa lewat tes teks, **belum dijalankan** di proyek sungguhan.
- [ ] PIC: buat proyek Supabase, nyalakan Email OTP dan ubah templat agar memuat kode, jalankan SQL, isi `src/core/sync/config.ts` ([supabase/README.md](../supabase/README.md)).
- [ ] Uji dua profil Chrome sungguhan, termasuk hapus akun (kriteria "selesai" Fase 2).
- [ ] Belum ada: login Google, sinkron otomatis berkala (sekarang tombol "Sinkronkan sekarang"), syarat layanan, tinjauan hukum kebijakan privasi, SMTP sendiri.
- Panggilan REST dan Auth ditulis dari dokumentasi publik dan belum dicoba ke server hidup.

Kemajuan Fase 3 (disetujui PIC 2026-10-18, telemetri opt-in anonim hanya hitungan kejadian; PRD §4.4, RFC D18 dan D19, README, privasi diperbarui):
- [x] Telemetri opt-in: `core/telemetry/`, `platform/telemetry.ts`, kartu "Bantu perbaiki job-kit" di Akun (menampilkan antrean persis), titik kejadian di Fill, lamaran, CV, surat, lowongan, sinkron, error. Bertes.
- [x] SQL: `supabase/telemetry.sql` (`event_counts`, `admin_users`, `admin_stats()`), diperiksa lewat tes teks, **belum dijalankan**.
- [x] Halaman admin pribadi `site/admin.html`, bertes untuk bagian murninya; **belum dicoba ke server hidup**.
- [x] Dokumen operasi: [07-operations.md](07-operations.md): cadangan, batas laju, pemantauan, alur hapus data, terbit publik, bahan portofolio.
- [ ] PIC: jalankan SQL, isi `admin_users`, atur SMTP dan batas laju, jadwalkan cadangan dan uji pemulihan, tinjau privasi, terbit publik.
- [ ] **Tidak dikerjakan:** T35 dan T55 (biaya AI nyata per generate). Fase 4 tidak bisa diberi harga tanpa angka ini.
- Catatan: "berapa pengguna aktif minggu ini dari satu halaman" tidak sepenuhnya mungkin tanpa pengenal; lihat 07-operations.md §1.

Keputusan PIC: AI mati total di build dibagikan, termasuk untuk pemilik kunci sendiri (pertanyaan 1 §8 terjawab).

Urutan keputusan PIC: **deployment dulu** (orang bisa akses dan menyimpan data, PIC bisa melihat pemakaiannya), **fitur generate (AI) paling akhir** sebagai API publik. Skema bayar dan untung belum diputuskan.

## 1. Kondisi sekarang

- **Tidak ada website.** job-kit hanya ekstensi Chrome. Halaman options ada di dalam ekstensi. Pengisian form otomatis harus tetap di ekstensi karena butuh content script di halaman lamaran.
- **Tidak ada server dan tidak ada akun.** Data tiap pengguna ada di `chrome.storage.local` browser mereka. README menulis "tanpa akun, tanpa telemetri".
- **Fitur generate** (skor lowongan, CV yang disesuaikan, surat) memakai **kunci API pengguna sendiri** ke penyedia AI (Anthropic, Gemini, OpenCode Zen). Penyedia "Claude Code" memakai `scripts/bridge.mjs` di mesin PIC dan **tidak boleh ikut ke pengguna lain**.

## 2. Gambaran fase

| Fase | Tujuan | Server | AI |
|---|---|---|---|
| **1** Bisa diakses | Orang memasang dan memakai; PIC melihat angka dasar | Website statis | Dimatikan di build yang dibagikan |
| **2** Akun dan simpan data | Data pengguna tersimpan online dan tersinkron | Supabase | Masih mati |
| **3** Lihat dan jaga | PIC melihat pemakaian; layanan aman dan stabil; terbit publik | Supabase + halaman admin | Masih mati, tapi biaya per generate diukur |
| **4** API generate publik | Pengguna memakai AI tanpa kunci sendiri; model bisnis | Backend proxy + penagihan | Hidup lewat API kita |

Tiap fase berdiri sendiri: boleh berhenti setelah fase mana pun.

## 3. Fase 1: bisa diakses

**Hasil:** teman memasang ekstensi lewat link; ada website; PIC melihat jumlah pemasangan dan kunjungan.

1. **Build untuk dibagikan.** Sembunyikan penyedia "Claude Code" dan jangan sertakan `bridge.mjs`. Fitur AI tampil sebagai "belum tersedia di versi ini" (skor kasar dan CV dari Profile apa adanya sudah ada sebagai cadangan; **perlu dicek ulang tiap layar**).
2. **Website statis di Vercel** (Vite atau Astro): beranda, cara pasang, **kebijakan privasi**, formulir masukan, analitik kunjungan.
3. **Distribusi:** Chrome Web Store **Private + trusted testers** atau **Unlisted** ($5 sekali bayar), atau zip + Load unpacked untuk 1 sampai 2 teman pertama.
4. **Metrik tanpa melacak orang:** dashboard Chrome Web Store (pemasangan, pencopotan, pengguna mingguan per negara, bahasa, OS, versi) dan analitik website.
5. **Data tetap lokal.** Pengguna diminta rutin Export dari halaman Data.

Catatan: Vercel Hobby **hanya untuk pemakaian non-komersial**. Cukup untuk Fase 1 sampai 3 selama gratis. [Fair use](https://vercel.com/docs/platform/fair-use-policy)

**Selesai bila:** 3 teman memasang tanpa bantuan, dan angka pemasangan terlihat di dashboard.

## 4. Fase 2: akun dan simpan data (Supabase)

**Hasil:** pengguna login dan datanya tersimpan serta tersinkron antar perangkat.

Rancangan yang menjaga janji privasi:
- **Enkripsi di sisi klien.** Ekstensi mengenkripsi profil dan lamaran dengan kata sandi pengguna sebelum dikirim. Supabase hanya menyimpan ciphertext dan **tidak bisa membaca CV**. Konsekuensi: lupa kata sandi berarti data online tidak bisa dipulihkan (data lokal tetap ada).
- **Login:** Supabase Auth, tautan ajaib lewat email atau Google.
- **Tabel:** `user_data(user_id, kind, ciphertext, version, updated_at)`, `kind` = `profile`, `applications`, `cvs`, `letters`. **Row Level Security**: baris hanya bisa dibaca dan ditulis pemiliknya.
- **Konflik:** `updated_at` terbaru menang, per `kind`.
- **Tidak disinkronkan:** kunci API, daftar lowongan hasil ambil, pemakaian AI harian.
- **Ekstensi langsung ke Supabase** dengan token pengguna, tanpa API sendiri.
- **Izin baru:** host Supabase, diminta saat pengguna menyalakan sinkron.
- **Hak pengguna:** Export, hapus akun beserta semua datanya, dari dalam aplikasi.
- **Dokumen:** PRD §4, README, RFC, dan kebijakan privasi ditulis ulang; syarat layanan ditambah.

**Yang PIC bisa tahu setelah Fase 2:** daftar akun terdaftar (email) dan jumlahnya. Itu sah karena pengguna mendaftar dan menyetujui kebijakan privasi. **Isi CV tidak terbaca** karena terenkripsi.

Batas Supabase gratis ([harga](https://supabase.com/pricing.md); angka pihak ketiga belum dicek ulang): 500 MB database per proyek, 2 proyek aktif, **proyek gratis dijeda setelah 1 minggu tanpa aktivitas** (sinkron gagal sampai dipulihkan manual). Pro $25/bulan tidak dijeda.

**Selesai bila:** dua perangkat melihat data yang sama, dan akun yang dihapus benar-benar hilang dari tabel.

## 5. Fase 3: lihat dan jaga

**Hasil:** PIC punya gambaran pemakaian; layanan aman; terbit publik; biaya AI diketahui.

1. **Halaman admin pribadi** (hanya PIC): jumlah akun, akun baru per hari, pengguna aktif, versi ekstensi. Dibaca lewat tampilan SQL di Supabase, **tanpa pernah menyentuh ciphertext**.
2. **Telemetri opt-in** (mati bawaan, anonim, hanya hitungan kejadian seperti "Fill dipakai", "CV dibuat"; tidak pernah isi profil, CV, lowongan, atau URL). Dicatat jujur di kebijakan privasi dan formulir pengungkapan Chrome Web Store.
3. **Pengerasan:** pencadangan Supabase, batas laju pada login, pemantauan error, alur permintaan hapus data.
4. **Terbit publik** di Chrome Web Store (review izin host luas bisa memakan 1 sampai 3 minggu menurut perkiraan komunitas, bukan janji resmi).
5. **Ukur biaya AI nyata.** Selesaikan T35 dan T55 di `docs/plan.md`: biaya per skor, per CV, per surat, dengan model yang akan dipakai. **Tanpa angka ini Fase 4 tidak bisa diberi harga.**
6. **Bahan portofolio:** pengguna mingguan, pemasangan, kunjungan website, kutipan teman, studi kasus, video demo.

**Selesai bila:** PIC bisa menjawab "berapa pengguna aktif minggu ini" dari satu halaman, dan biaya per generate tercatat.

## 6. Fase 4: API generate publik dan penagihan

**Hasil:** pengguna memakai fitur AI tanpa kunci sendiri, dan PIC menarik biaya.

### Arsitektur
- **Backend proxy** menyimpan kunci penyedia AI milik PIC. Ekstensi memanggil `POST /generate` dengan token login pengguna. Pilihan tempat: Vercel Functions atau Supabase Edge Functions.
  - Vercel Hobby melarang pemakaian komersial, jadi **layanan berbayar perlu Vercel Pro** atau pindah ke Edge Functions. Batas durasi fungsi di Hobby 300 detik menurut dokumen resmi ([batas](https://vercel.com/docs/functions/limitations)).
- **Kuota per akun** dicek sebelum memanggil model, dan dicatat setelahnya. Batas harian dan bulanan, batas laju, dan plafon pengeluaran total supaya tagihan tidak jebol.
- **Privasi tetap sama dengan sekarang:** payload tanpa nama, email, telepon, dan alamat; nama perusahaan dan kampus diganti kode. **Server tidak menyimpan isi permintaan atau hasil**, hanya hitungan penggunaan.
- **Jalur "bawa kunci sendiri"** tetap ada dan gratis untuk yang mau.
- **Cadangan model:** bila penyedia gagal, jatuh ke model lain atau ke CV dari Profile apa adanya.

### Pilihan skema bayar (belum diputuskan)
| Skema | Cocok bila | Risiko |
|---|---|---|
| **Kredit** (beli paket, habis pakai) | Pemakaian tidak rutin; paling sederhana; tidak ada langganan yang terlupa | Pengguna kecil membeli sedikit |
| **Langganan bulanan + kuota** | Pemakaian rutin; pendapatan stabil | Pengguna jarang membatalkan; perlu mengelola gagal bayar |
| **Gratis terbatas + berbayar** | Ingin pengguna mencoba dulu | Biaya AI dari pengguna gratis ditanggung PIC |

**Rumus untung per generate:** harga − (biaya model + biaya penagihan + bagian hosting). Biaya model **belum diketahui**; ukur di Fase 3 butir 5. Jangan menetapkan harga sebelum ada angkanya.

### Pembayaran dari Indonesia
- **Stripe untuk akun yang berbasis di Indonesia** hanya menerima dan membayar dalam IDR dan tidak mendukung transaksi lintas negara menurut halaman dukungan Stripe (tidak bertanggal; cek ulang). [Sumber](https://support.stripe.com/questions/supported-payment-methods-currencies-and-businesses-for-stripe-accounts-in-indonesia)
- **Gateway lokal:** Xendit dan Midtrans (QRIS, dompet digital, virtual account).
- **Merchant of record** (Paddle atau Lemon Squeezy) menangani pajak penjualan digital lintas negara. Sumber pihak ketiga menyebut Lemon Squeezy sedang bermigrasi ke Stripe Managed Payments sepanjang 2026, jadi **verifikasi sebelum memilih**. Biaya dan detail di bagian ini belum saya konfirmasi dari situs resmi masing-masing.
- Perlu dipastikan: kewajiban pajak dan badan usaha bila PIC menerima uang dari pengguna. **Saya belum memeriksa aturan Indonesia; tanyakan ke konsultan pajak.**

### Hal hukum dan kebijakan yang harus dicek sebelum menjual
- Syarat penyedia model soal menjual ulang akses lewat produk sendiri.
- Kebijakan privasi dan syarat layanan untuk layanan berbayar.
- Kewajiban sebagai pemroses data pribadi (UU PDP). Belum diperiksa.

**Selesai bila:** satu pengguna asli membayar, memakai generate, dan biaya model ditambah biaya penagihan lebih kecil dari yang dibayar.

## 7. Risiko lintas fase
- **Scraping lowongan:** ketentuan layanan LinkedIn dan sejenisnya melarang pengambilan otomatis. Risiko kecil untuk teman, jadi risiko nyata untuk rilis luas dan review Web Store.
- **Kunci API tersimpan tanpa enkripsi** di browser pengguna pada jalur "kunci sendiri". Pengguna perlu diberi tahu.
- **Tanggung jawab data** muncul di Fase 2. Jangan mulai Fase 2 sebelum kebijakan privasi dan alur hapus data siap.
- **Biaya tak terduga** muncul di Fase 4. Pasang plafon pengeluaran sebelum membuka API.

## 8. Pertanyaan terbuka untuk PIC
1. Apakah fitur AI di build Fase 1 boleh benar-benar mati, atau teman yang punya kunci sendiri boleh tetap memakainya?
2. Fase 2: apakah enkripsi di sisi klien (lupa sandi = data online hilang) dapat diterima?
3. Fase 4: pilih skema bayar mana untuk diuji, dan di nama siapa (pribadi atau badan usaha)?
4. Apakah job-kit akan tetap gratis sampai Fase 4? Itu menentukan Vercel Hobby vs Pro.
