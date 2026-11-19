# Supabase untuk sinkron (Fase 2)

Tidak ada kunci di repo ini. Proyek dibuat dan dikelola oleh pemilik.

1. supabase.com: buat proyek.
2. Authentication > Providers > Email: nyalakan **Email OTP** (kode sekali pakai). Ubah templat email supaya memuat `{{ .Token }}` (kode 6 digit), bukan hanya tautan. Login Google belum ada.
3. Authentication > Rate limits: periksa batas kirim email dan atur sesuai kebutuhan. Email bawaan Supabase sangat terbatas; untuk banyak pengguna pasang SMTP sendiri **[verifikasi batas terkini]**.
4. SQL editor: tempel isi `sync.sql`, jalankan.
   Untuk kredit AI dan pembayaran (setelah `sync.sql`, karena `delete_account()` ada di sana): tempel isi `billing.sql` dan jalankan. Lalu nyalakan ekstensi `pg_cron` (Database > Extensions), tempel `billing-cron.sql`, jalankan. Cek dengan `select * from public.packages;` (harus ada satu baris: `basic`, 10800, 50). `supabase/test/auth-stub.sql` hanya untuk tes, jangan dijalankan di proyek.
5. Project Settings > API: salin **Project URL** dan **publishable key** (bukan secret, bukan service_role) ke `src/core/sync/config.ts`.
6. Uji dengan dua profil Chrome: login, atur kata sandi sinkron, ubah profil di satu sisi, lihat muncul di sisi lain. Lalu hapus akun dan cek tabel `user_data` dan `auth.users` kosong untuk akun itu.
7. Proyek gratis dijeda setelah 1 minggu tanpa aktivitas; sinkron gagal sampai dipulihkan dari dashboard.

## Edge Functions: AI berkredit dan pembayaran QRIS

Tiga fungsi di `supabase/functions-src/` (`generate`, `create-payment`, `midtrans-callback`) dibundel dari `src/server` dan `src/core` ke `supabase/functions/` (hasil build, tidak masuk git). Urutan SQL: `sync.sql`, lalu `billing.sql`, lalu `billing-cron.sql`; fungsi tidak akan jalan sebelum `billing.sql` dipasang.

### Secrets

Diisi pemilik dengan Supabase CLI setelah `supabase login`. `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` disediakan Supabase sendiri di Edge Functions. Ganti semua `<...>` dengan nilai asli; nilai asli tidak pernah ditulis di repo.

```sh
supabase secrets set --project-ref ktgcjqxoohuvxwvsjhif \
  AI_BASE_URL=<url dasar API model, tanpa /chat/completions> \
  AI_API_KEY=<kunci penyedia model> \
  AI_MODEL=deepseek-v4.1-flash \
  AI_PRICE_IN=0.30 \
  AI_PRICE_OUT=1.20 \
  MONTHLY_AI_BUDGET_USD=5 \
  MIDTRANS_MODE=sandbox \
  MIDTRANS_SERVER_KEY=<server key Midtrans, sandbox atau production sesuai mode> \
  EXTENSION_ID=<id ekstensi Chrome>
```

- `AI_PRICE_IN` dan `AI_PRICE_OUT`: dolar per juta token, dipakai untuk menghitung biaya tiap panggilan.
- `RATE_LIMIT_PER_HOUR` (opsional, bawaan 30): panggilan `generate` per akun per jam.
- `MIDTRANS_MODE`: `sandbox` atau `production`. Pakai `production` hanya setelah verifikasi sandbox di bawah lolos dan server key production diisi. Server key sandbox dan production berbeda; jangan dicampur.
- `EXTENSION_ID`: hanya origin `chrome-extension://<id>` ini yang boleh memanggil `generate` dan `create-payment` dari browser.

### Notifikasi Midtrans

Di dashboard Midtrans (Settings > Configuration, kolom Payment Notification URL; sandbox dan production punya dashboard dan URL sendiri), isi URL notifikasi:

```
https://ktgcjqxoohuvxwvsjhif.supabase.co/functions/v1/midtrans-callback
```

`midtrans-callback` memakai `verify_jwt = false` (lihat `config.toml`) karena Midtrans tidak membawa token Supabase; `signature_key` di isi notifikasi (SHA-512 dari `order_id`, `status_code`, `gross_amount`, dan server key) yang memeriksanya sebelum database disentuh. `generate` dan `create-payment` tetap memakai `verify_jwt` bawaan (`true`).

### Deploy dan verifikasi (dijalankan pemilik, butuh login CLI)

1. `supabase login`, lalu `npm run deploy:functions` (membundel, lalu men-deploy ketiga fungsi).
2. Verifikasi `generate`: panggil dengan token pengguna uji (`Authorization: Bearer <access token>`, `apikey: <publishable key>`) dan isi `kind: "cv"` yang sah. Harapan: CV sungguhan kembali dan saldo berkurang 1. Catat token pemakaian dan biayanya di T58 `docs/plan.md`, yang juga menutup sisa T35.
3. Verifikasi sandbox Midtrans: buat pembayaran lewat curl ke `create-payment` dengan token uji (`{"packageId":"basic"}`), lalu bayar kodenya di simulator QRIS sandbox Midtrans. Harapan: `accounts.credits` bertambah 50 dan `unlocked_at` terisi. Panggil `create-payment` sekali lagi sebelum dibayar: harus mengembalikan QR yang sama.
4. Log fungsi (`supabase functions logs <nama>` atau dashboard) hanya memuat nama tahap dan pesan galat, tidak pernah isi permintaan.
