# Desain: akun wajib, kredit AI, dan pembayaran QRIS

**Tanggal:** 2026-11-19 · **PIC:** imelda · **Status:** DRAFT, menunggu persetujuan PIC
**Menggantikan:** jalur "bawa kunci sendiri" (PRD §4.1) dan pilihan skema bayar di `docs/05-cloud-plan.md` §6
**Terkait:** PRD §4.5 dan FR-49 sampai FR-56, RFC §3.3d dan D20 sampai D24, `docs/plan.md` T56 sampai T63, rencana implementasi `docs/superpowers/plans/2026-11-19-monetisasi.md`

---

## 1. Kenapa

Banyak teman PIC minta dibantu membuat CV dan surat. PIC tidak bisa melayani satu per satu: tiap CV memakai kredit AI milik PIC dan waktu PIC. Tujuannya **swalayan dan tidak merugi**: pengguna mendaftar, membayar sendiri, dan langsung memakai fitur, tanpa PIC memeriksa apa pun. PIC mengambil untung dari kredit AI.

Pengguna sekarang lingkaran teman. Ke depan mungkin publik, jadi semua keputusan dibuat supaya tidak perlu dibongkar saat dibuka untuk publik.

## 2. Tujuan, bukan tujuan, dan kegagalan

**Tujuan**
- Pengguna bisa mendaftar, membeli paket lewat QRIS, dan memakai fitur AI dalam satu sesi tanpa campur tangan PIC.
- Kredit tidak pernah bertambah tanpa pembayaran yang sah, dan tidak pernah terpotong untuk hasil yang tidak diterima pengguna.
- Biaya AI dan biaya transaksi selalu lebih kecil dari harga paket.

**Bukan tujuan (sekarang)**
- Langganan bulanan, kupon, referral, paket bertingkat.
- Pembayaran selain QRIS (kartu, VA, transfer manual).
- Pengembalian uang otomatis. Kredit tidak bisa diuangkan; kasus khusus ditangani PIC manual (`admin_grant`).
- Login Google. Hanya email + kode OTP.
- Halaman beli di website. Pembelian terjadi di dalam extension.

**Gagal walaupun "jalan"**
- Pengguna membayar tetapi kredit tidak masuk dan tidak ada jalan untuk tahu kenapa.
- Satu callback dihitung dua kali sehingga kredit dobel.
- Kunci AI atau server key Midtrans ikut ter-bundle di extension.
- Tagihan AI jebol karena satu akun disalahgunakan.
- Ada baris "biaya admin" terpisah untuk QRIS (melanggar PBI 23/2021 Pasal 52 ayat 1).

## 3. Keputusan PIC (2026-11-19)

| # | Keputusan |
|---|---|
| 1 | **Login wajib** untuk memakai apa pun. Tanpa login hanya preview. |
| 2 | **Tanpa "bawa kunci sendiri".** Semua AI lewat server PIC dengan kredit. |
| 3 | **Satu saldo kredit**, beli minimal satu paket. Di halaman beli ditampilkan perkiraan "1 paket ≈ sekian CV + surat". |
| 4 | **Harga paket Rp10.800, sudah termasuk semua biaya** (diubah dari Rp11.000, PIC 2026-11-19). Harga yang tampil di mana pun = jumlah yang dibayar; tidak ada "Rp10.000 + biaya admin". |
| 5 | **Bayar QRIS, dicek otomatis**, uang masuk ke rekening PIC lewat gateway termurah. |
| 6 | **Margin PIC minimal 25–40%** atas biaya AI (lihat §7: kenyataannya jauh lebih tinggi). |
| 7 | **Kredit dikembalikan** bila AI gagal atau hasilnya ditolak pemeriksa fakta (kasus di §6). |
| 8 | **Kredit habis tidak mengunci fitur atau data**; hanya AI yang berhenti sampai beli lagi. |
| 9 | **Plafon pengeluaran AI bulanan** di server. |
| 10 | **Model `deepseek-v4.1-flash`** lewat proxy `bandelbanget.xyz` sementara ("cek ombak"); bukan varian `-mod`. Pindah ke `api.deepseek.com` cukup dengan mengganti secrets `AI_BASE_URL`, `AI_API_KEY`, dan `AI_MODEL` (`deepseek-flash`) di Supabase; tanpa rilis ulang extension. |
| 11 | **Tarik dana bulanan** (biaya penarikan Midtrans ke rekening belum diverifikasi; cek di dashboard sebelum produksi). |
| 12 | **Kebijakan privasi:** pakai `site/privasi.html` yang ada untuk sementara (PIC 2026-11-19). Hanya kalimat yang jadi salah yang diganti di T63: "tidak memakai akun", "AI belum tersedia, tidak mengirim data ke penyedia AI", dan belum adanya pembelian. Tinjauan penuh sebelum dibuka publik. |
| 13 | **Arsitektur: Supabase penuh** (Pendekatan A di §4). |

## 4. Pendekatan

| | A. Supabase penuh (**dipilih**) | B. Cloudflare Workers + D1 |
|---|---|---|
| Login | Supabase Auth email OTP, kodenya sudah ada (`core/sync/api.ts`) | Ditulis sendiri |
| Data | Postgres + RLS; proyek dan tabel sinkron/telemetri sudah ada | D1, skema baru |
| Server | Edge Functions (Deno) | Workers |
| Biaya awal | Rp0 (tier gratis); Pro $25/bulan saat pemasukan menutupi | Rp0, lebih murah di skala ribuan |
| Risiko | Proyek gratis dijeda setelah 1 minggu tanpa aktivitas | Waktu bangun beberapa minggu lebih lama |

Dibuang: QR statis dengan cek manual (PIC mau otomatis); website sebagai tempat bayar (menambah login kedua tanpa manfaat).

Alasan memilih A: login, sinkron, dan tabel sudah berjalan di proyek Supabase yang sama (`user_data`, `event_counts`, `feedback` sudah ada, dicek 2026-11-19); yang baru hanya tabel kredit dan tiga fungsi.

## 5. Bentuknya

### 5.1 Tingkatan akses

```
Belum login       → Preview: UI dengan data contoh, semua aksi nonaktif, ajakan "Masuk"
Login (gratis)    → Semua halaman terbuka dan bisa diedit: Lowongan, Lamaran, Profile, Data
                    (Export/Import), panel Autofill (Fill/Undo). Yang membedakan hanya saldo AI.
Percobaan         → 3 kredit gratis sekali per akun saat daftar; semua halaman terbuka.
                    Kredit habis → hanya AI yang berhenti; tombol AI nonaktif + "Beli kredit"
                    (PIC 2026-11-19, final). Halaman tidak pernah dikunci setelah login.
Terbuka           → pernah membeli ≥1 paket; tidak ada beda akses halaman, hanya saldo AI
                    (tidak pernah terkunci lagi)
AI                → butuh saldo kredit; saldo 0 = tombol Buat nonaktif + "Beli kredit"
```

Tabel kebenaran `featureMode` (`src/core/account/access.ts`): `preview` (belum masuk) → `locked`; semua level masuk → `open`: `paid`, `trial`, `free` dengan maupun tanpa `trialGranted`, dan `free` dengan status belum diketahui. `open` berarti halaman terbuka dan bisa diedit; aktif tidaknya tombol AI ditentukan terpisah oleh saldo kredit (`credits > 0`), bukan oleh `featureMode`.

Ambil lowongan (termasuk LinkedIn, mati bawaan) tidak memakai kredit karena tidak memanggil AI. Feed harian selalu memakai "Skor kasar"; skor AI hanya berjalan saat pengguna menekan "Nilai dengan AI" (1 kredit per 10 lowongan, yang teratas lebih dulu). Kredit tidak pernah berkurang tanpa tindakan pengguna.

Sinkron terenkripsi (PRD §4.3) **tetap opsional** dengan kata sandi sinkron sendiri. Login wajib hanya untuk identitas dan kredit; isi profil tidak dikirim ke server kecuali sinkron dinyalakan.

### 5.2 Arus

```
Extension ──(token login)──► Edge Function create-payment ──► Midtrans: buat transaksi QRIS
    ▲   menampilkan QR, cek status tiap 3 dtk                          │
    │                                                                  ▼ pembeli scan & bayar
    └── baca purchases/accounts (RLS) ◄── apply_payment() ◄── midtrans-callback (signature_key dicek)

Extension ──(token login, payload tersamar)──► Edge Function generate
    reserve_credits() → DeepSeek → validasi skema + pemeriksa fakta → settle_generation()
    sukses: kredit tetap terpotong · gagal/ditolak: kredit kembali
```

Website dan extension **tidak perlu saling terhubung**. Keduanya hanya bicara ke Supabase. Website tetap statis: beranda, pasang, privasi, masukan, dan halaman harga (informasi saja). Akun Chrome Web Store milik teman PIC hanya memegang listing; login, saldo, dan pembayaran ada di Supabase dan Midtrans milik PIC.

### 5.3 Struktur data (Postgres, skema `public`)

Semua tabel memakai RLS. Pengguna hanya bisa **membaca** barisnya sendiri. Tidak ada `insert`/`update`/`delete` dari klien; semua penulisan lewat fungsi `security definer` yang hanya bisa dipanggil `service_role` (Edge Functions).

```sql
packages (
  id           text primary key,            -- 'basic'
  price_idr    integer not null,            -- 10800
  credits      integer not null,            -- 50 (keputusan PIC 2026-11-19)
  active       boolean not null default true
)                                            -- dibaca semua orang (anon + authenticated)

accounts (
  user_id      uuid primary key references auth.users on delete cascade,
  credits      integer not null default 0 check (credits >= 0),
  unlocked_at  timestamptz,                  -- null = belum pernah beli
  trial_granted_at timestamptz,              -- 3 kredit percobaan, sekali per akun
  credits_expire_at timestamptz,             -- saldo hangus di sini; tiap pembelian memperpanjang ke now()+1 tahun
  created_at   timestamptz not null default now()
)

purchases (
  id                uuid primary key default gen_random_uuid(),   -- bagian pertama order_id ke Midtrans
  user_id           uuid references auth.users on delete set null, -- null setelah hapus akun
  package_id        text not null references packages,
  amount_idr        integer not null,
  credits           integer not null,
  status            text not null check (status in ('pending','paid','expired','failed','mismatch')),
  gateway_reference text unique,
  qr_url            text,
  expires_at        timestamptz not null,
  paid_at           timestamptz,
  created_at        timestamptz not null default now()
)

generations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete set null,
  kind          text not null check (kind in ('cv','letter','score')),
  credits       integer not null,
  status        text not null check (status in ('reserved','done','refunded')),
  refund_reason text,                             -- kode dari §6, tanpa isi
  model         text,
  in_tokens     integer,
  out_tokens    integer,
  cost_usd      numeric(10,6),                    -- perkiraan dari tarif di konfigurasi
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
)                                                  -- tidak pernah menyimpan prompt atau hasil

credit_ledger (
  id             bigint generated always as identity primary key,
  user_id        uuid references auth.users on delete set null,
  delta          integer not null,                 -- +50 beli, -1 pakai, +1 kembali
  reason         text not null check (reason in ('purchase','trial','generate','refund','admin_grant','expire')),
  purchase_id    uuid references purchases,
  generation_id  uuid references generations,
  created_at     timestamptz not null default now()
)
```

Fungsi (semua `security definer`, `search_path = ''`, hanya `service_role` kecuali disebut lain):
- `reserve_credits(user_id, kind, cost) → generation_id`: kunci baris `accounts` (`for update`), tolak bila saldo kurang, kurangi saldo, catat `ledger(-cost, 'generate')` dan `generations(status='reserved')` dalam satu transaksi.
- `settle_generation(id, ok, refund_reason, model, in_tokens, out_tokens, cost_usd)`: `ok` → `done`; tidak `ok` → kembalikan kredit, `ledger(+cost, 'refund')`, `refunded`. Memanggil dua kali tidak berefek kedua.
- `attach_gateway(purchase_id, reference, qr_url) → qr_url`: penulis pertama menang; hanya menulis bila `gateway_reference` masih kosong dan mengembalikan QR yang tercatat, sehingga satu pembelian hanya punya satu QR (panggilan `create-payment` yang kalah balapan menampilkan QR yang tercatat, bukan miliknya).
- `apply_payment(purchase_id, gateway_reference, status, amount_idr)`: hanya mengubah `pending`. `PAID` dengan jumlah sama → `paid`, saldo `+credits`, `unlocked_at = coalesce(unlocked_at, now())`, `ledger(+credits, 'purchase')`. Jumlah beda → `mismatch`, tanpa kredit. `PAID` dengan `reference` lain pada pembelian yang sudah `paid` → hasil `duplicate` (tanpa kredit; pemanggil melapor `duplicate-payment`), sedangkan callback identik (`reference` sama) → `paid` tanpa efek. `EXPIRED`/`FAILED` → status itu. Idempoten.
- `ensure_account()` (dipanggil pengguna sendiri, `authenticated`): membuat baris `accounts` bila belum ada dan memberi 3 kredit percobaan (`ledger(+3, 'trial')`, `trial_granted_at`) sekali per akun. Bila kuota percobaan harian global habis (usulan 30 akun per hari), akun tetap dibuat tanpa kredit percobaan.
- `reap_reserved()`: generasi `reserved` lebih dari 10 menit dikembalikan (fungsi mati di tengah jalan). Dijalankan `pg_cron` tiap 5 menit.
- `expire_credits()`: akun dengan `credits_expire_at < now()` dan saldo > 0 → `ledger(-saldo, 'expire')`, saldo 0. Dijalankan `pg_cron` tiap hari. `apply_payment` dan pemberian percobaan mengatur `credits_expire_at = now() + interval '1 year'`, sehingga **seluruh saldo** berlaku 1 tahun sejak pembelian terakhir. `reserve_credits` menolak saldo yang sudah lewat tanggal walau `expire_credits` belum jalan.

Hapus akun (sudah ada, `delete_account()`): `accounts` ikut terhapus; `purchases`, `credit_ledger`, `generations` tetap tetapi `user_id` jadi null, supaya catatan pemasukan untuk pembukuan tidak hilang dan tidak bisa dikaitkan ke orang.

### 5.4 Edge Functions

**`create-payment`** (butuh login)
- Masukan `{ packageId }`. Paket harus `active`.
- Bila akun punya `pending` yang belum kedaluwarsa, kembalikan yang itu (tidak membuat QR kedua).
- Buat `purchases(pending, expires_at = now()+30 menit)`, panggil Midtrans Core API `POST /v2/charge` dengan `payment_type = qris` (`qris.acquirer = gopay`), `order_id = <purchases.id>_<timestamp base36>` (unik per percobaan; Midtrans menolak order_id kembar dengan 406), `gross_amount` bilangan bulat rupiah, `custom_expiry` dalam menit, autentikasi Basic (server key + `:`). `reference` = `transaction_id`, `qrUrl` = URL gambar QR di `actions`. URL notifikasi diisi di dashboard Midtrans: `midtrans-callback`.
- Kembalikan `{ purchaseId, qrUrl, amountIdr, credits, expiresAt }`.

**`midtrans-callback`** (publik, tanpa JWT)
- Parse isi JSON, lalu cek `signature_key = SHA512(order_id + status_code + gross_amount + server key)` (`gross_amount` apa adanya, mis. `"10800.00"`; perbandingan waktu-konstan) sebelum menyentuh database. Salah atau kosong → 401, tanpa efek. `purchase_id` diambil dari bagian `order_id` sebelum `_` pertama dan harus UUID sah. Status: `settlement` (atau `capture` dengan `fraud_status = accept`) → `PAID`, `pending` → `UNPAID`, `expire` → `EXPIRED`, `cancel`/`deny`/`failure` → `FAILED`, `refund`/`partial_refund`/`chargeback` → `REFUND`.
- Panggil `apply_payment`. Balas `{ success: true }` juga untuk kejadian yang sudah pernah diproses, supaya Midtrans tidak mengulang tanpa henti.

**`generate`** (butuh login)
- Masukan: `{ kind, payload }`. `payload` adalah data tersamar yang sekarang sudah dibuat extension (PRD §4.2, RFC D13); **bukan** prompt bebas. Akun yang belum `unlocked` dan tidak punya saldo ditolak.
- Server menyusun prompt dan menjalankan validasi skema serta pemeriksa fakta (`validateGrounded`, FR-40) dengan kode yang sama dengan extension (satu sumber di `src/core/`).
- Urutan: cek plafon bulanan dan batas laju → `reserve_credits` → panggil model → validasi → `settle_generation` → kembalikan hasil + saldo baru.
- Batas: payload ≤ 60.000 karakter, `max_tokens` ditentukan server per `kind`, timeout model 60 detik.
- Rahasia hanya di secrets Supabase: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_PRICE_IN`, `AI_PRICE_OUT`, `MONTHLY_AI_BUDGET_USD`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_MODE` (`sandbox`/`production`).

### 5.5 Extension

- **Build pengguna tanpa jalur kunci sendiri.** Pilihan penyedia, model, kunci API, dan bridge Claude Code tidak ada di build pengguna; tetap ada di build pengembang PIC.
- **Gerbang login** di options dan panel. Tanpa sesi: preview dengan data contoh (`?state=list` yang sudah ada di build dev), semua tombol aksi nonaktif dengan "Masuk untuk memakai". Sudah login: semua halaman terbuka dan bisa diedit; hanya tombol AI yang mengikuti saldo (nonaktif + "Beli kredit" bila saldo 0). Sesi habis (token tidak bisa disegarkan) kembali ke gerbang login dengan pesan sesi habis; data di `storage.local` tidak dihapus.
- **Status akun** (`credits`, `unlocked_at`) disimpan di `storage.local` sebagai cache, disegarkan saat options dibuka, setelah membeli, dan setelah tiap generate. Offline: cache dipakai.
- **Beli kredit:** modal dengan QR (gambar dari `qrUrl`), harga "Rp10.800, sudah termasuk semua biaya", hitung mundur 30 menit, cek status tiap 3 detik, lalu layar berhasil dengan saldo baru. Modal ditutup sebelum bayar tidak membatalkan pembelian; saldo masuk saat callback datang.
- **Tombol Buat** menampilkan biaya ("Buat CV · 1 kredit") dan nonaktif dengan sebab bila saldo kurang, plafon tercapai, atau offline.
- **Riwayat kredit** di halaman Akun: pembelian dan pemakaian (tanggal, jenis, ±kredit).
- **Izin:** host Supabase jadi izin wajib (login wajib); origin penyedia AI dihapus dari build pengguna. Lewat server, extension tidak pernah tahu alamat atau kunci model.

### 5.6 Website

- Pindah dari Vercel Hobby (tidak boleh komersial) ke Cloudflare Pages; `vercel.json` (CSP) menjadi `_headers`.
- Halaman harga: isi paket, perkiraan pemakaian, "sudah termasuk semua biaya", kredit tidak bisa diuangkan.
- Kebijakan privasi diperbarui oleh PIC (email, riwayat pembelian, data tersamar ke penyedia AI, server di luar negeri).

### 5.7 Chrome Web Store (akun teman PIC)

- Listing mencentang "berisi pembelian dalam aplikasi".
- Formulir pengungkapan data: email (akun), riwayat pembelian, isi CV tersamar yang dikirim ke penyedia AI.
- ID extension tetap lewat `key` di manifest, supaya pindah akun penerbit tidak memutus login pengguna.

## 6. Kasus kredit

| Kasus | Kredit | Pesan ke pengguna |
|---|---|---|
| Model membalas dan lolos semua pemeriksaan | Terpotong | Hasil tampil |
| Model error, timeout, atau 5xx dari proxy | **Kembali** | "AI sedang gangguan. Kreditmu tidak terpakai." |
| Balasan bukan JSON atau tidak sesuai skema | **Kembali** | sama |
| Ditolak pemeriksa fakta (FR-40) | **Kembali** | Sebab penolakan, seperti sekarang |
| AI mengembalikan pengalaman kosong (CV jatuh ke isi Profile) | **Kembali** | "CV disusun dari profilmu apa adanya; kredit tidak terpakai." |
| Fungsi mati di tengah (tidak ada `settle`) | **Kembali** otomatis ≤15 menit (`reap_reserved`) | Saldo kembali setelah disegarkan |
| Pengguna menekan Buat ulang | Terpotong lagi | Biaya tampil di tombol |
| Pengguna mengedit hasil | Tidak berubah | — |
| Plafon bulanan atau batas laju tercapai | Tidak dipotong | "Layanan AI penuh bulan ini" / "Terlalu cepat, coba lagi sebentar" |
| Saldo kurang | Tidak dipotong | "Kredit tidak cukup" + Beli kredit |
| Saldo lewat 1 tahun sejak pembelian terakhir | Hangus (`expire`), tercatat di riwayat | "Kreditmu hangus pada <tanggal>"; 30 hari sebelumnya ada penanda di sidebar |

**Pembayaran**

| Kasus | Hasil |
|---|---|
| Bayar, callback sah | Kredit masuk sekali, fitur terbuka |
| Callback datang dua kali atau lebih | Hanya yang pertama berefek |
| Tanda tangan callback salah | Ditolak, tanpa efek |
| Jumlah dibayar ≠ harga | `mismatch`, tanpa kredit; PIC melihatnya di halaman admin |
| QR kedaluwarsa (30 menit) | `expired`; pengguna membuat QR baru |
| Modal ditutup sebelum bayar lalu bayar | Kredit tetap masuk lewat callback |
| Callback tidak pernah datang | Tetap `pending`; PIC cek di dashboard Midtrans dan memberi `admin_grant` |
| Minta uang kembali | Tidak otomatis; PIC menangani manual |

## 7. Angka

Kurs Rp16.500/USD. Harga DeepSeek resmi jam sibuk ($0,30 / $1,20 per 1 juta token; di luar jam sibuk separuhnya); harga proxy belum diketahui. Diukur 2026-11-19 dengan `tailorCv`, `writeLetter`, dan `scoreJobs` asli, 3 profil contoh × 3 lowongan GitLab panjang (6–9 ribu karakter; prompt memotong teks lowongan sehingga token masuk tetap ±1.900): `spikes/cost/results/`.

| | Nilai |
|---|---|
| Biaya QRIS Midtrans (docs.midtrans.com: MDR QRIS 0,7% untuk merchant reguler; PPN dan biaya lain tidak disebut di halaman itu, cek di dashboard) | 0,7% = **Rp76** per paket |
| Bersih per paket | Rp10.724 |
| Biaya AI per CV (diukur, kode produksi: ±1.870 token masuk / ±350 keluar) | **±Rp16** |
| Biaya AI per surat (±1.610 / ±280) | **±Rp14** |
| Biaya AI per skor 10 lowongan (2 request, ±3.840 / ±1.030) | **±Rp39** |
| Paket 50 kredit, terburuk (semua dipakai untuk skor) | biaya AI ±Rp1.970 → untung ±Rp8.000 per paket |
| Biaya tetap | Rp0 di tier gratis; Supabase Pro ±Rp410rb/bulan ≈ 47 paket |

Margin 25–40% berarti ratusan kredit per paket; PIC memilih **50 kredit per paket** (2026-11-19). Tarif: 1 CV = 1 kredit, 1 surat = 1 kredit, skor 10 lowongan = 1 kredit (diputuskan PIC 2026-11-19). Ambil lowongan tanpa skor AI tidak memakai kredit.

**Temuan:** surat ditolak pemeriksa fakta pada 4 dari 9 percobaan (CV 0 dari 9). Kredit dikembalikan, tetapi biaya AI-nya (±Rp14) tetap ditanggung PIC dan pengguna harus mencoba lagi. Perlu diperiksa sebelum T61 apakah pemeriksa terlalu ketat atau prompt surat perlu disetel untuk DeepSeek.

## 8. Yang diserahkan ke pembangun

- Cara berbagi kode `src/core/` ke Edge Functions (Deno), asal satu sumber dan ada tes yang gagal bila keduanya berbeda.
- Rincian UI modal beli, halaman Akun, dan preview, mengikuti `docs/design-system.md` (mockup dulu, seperti T28/T40).
- Nama bendera build untuk membedakan build pengguna dan build pengembang.
- Batas laju persis (usulan: 30 generate per jam per akun).
- Skor: `score.ts` sekarang menilai 5 lowongan per request, jadi 1 kredit (10 lowongan) = 2 request di server. Pengembalian kredit berlaku per kredit, bukan per request (keputusan pembangun).
- Penyegaran token login di service worker memakai `refreshSession` yang sudah ada di `core/sync/api.ts`.

## 9. Pertanyaan terbuka untuk PIC

1. ~~Isi paket~~ **50 kredit per Rp10.800** (PIC 2026-11-19). Tarif: CV 1, surat 1, skor 10 lowongan 1 kredit (PIC 2026-11-19).
2. ~~Skor AI harian~~ **Hanya saat pengguna menekan "Nilai dengan AI"**; feed harian memakai skor kasar gratis (PIC 2026-11-19).
3. ~~Kredit percobaan~~ **3 kredit gratis sekali per akun** (PIC 2026-11-19); habis, hanya AI yang berhenti (PIC 2026-11-19, final).
4. ~~Kedaluwarsa kredit~~ **1 tahun sejak pembelian terakhir**; tiap pembelian memperpanjang seluruh saldo (PIC 2026-11-19). Tanggal hangus tampil di halaman Akun; 30 hari sebelumnya muncul penanda di sidebar (tanpa email).

## 10. Selesai bila

Satu pengguna asli (bukan PIC) mendaftar, membayar Rp10.800 lewat QRIS di Midtrans produksi, kredit masuk tanpa PIC menyentuh apa pun, membuat satu CV, dan biaya AI + biaya QRIS tercatat lebih kecil dari Rp10.800.
