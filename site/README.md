# Website job-kit (statis)

Folder ini adalah seluruh website: HTML, CSS, dan sedikit JS. Tanpa build, tanpa dependensi.

## Deploy ke Vercel (dikerjakan pemilik akun)

1. Push repo ini ke GitHub milikmu (remote `origin` belum ada di salinan ini; tambahkan sendiri).
2. vercel.com > Add New > Project > pilih repo.
3. **Root Directory: `site`**. Framework Preset: **Other**. Build Command dan Output Directory dikosongkan. Deploy.
4. Dashboard proyek > **Analytics** > Enable (Web Analytics). Skrip `/_vercel/insights/script.js` sudah ada di tiap halaman; angka mulai muncul setelah ada kunjungan.
5. Buka alamat `*.vercel.app` dan cek: `/`, `/pasang`, `/privasi`, `/masukan`.
6. Domain sendiri (opsional): Settings > Domains.

Catatan:
- Paket Vercel Hobby hanya untuk pemakaian non-komersial. Cukup selama job-kit gratis; layanan berbayar (Fase 4) perlu Pro. Periksa syarat terbaru di vercel.com sebelum dipakai.
- `.vercelignore` menjaga tes, SQL, dan README ini tidak ikut terpublikasi.
- `vercel.json` memasang CSP: hanya sumber sendiri, ditambah `https://*.supabase.co` untuk formulir. Jangan menambah skrip atau gaya inline; CSP akan memblokirnya.

## Halaman admin

`/admin` adalah halaman pribadi (tidak ada di navigasi, `noindex`). Ia memanggil fungsi `admin_stats()` di Supabase yang hanya menjawab email di tabel `admin_users` (`supabase/telemetry.sql`). Tanpa login tidak ada angka yang tampil.

## Sebelum diumumkan

- [ ] Tautan unduhan di `pasang.html` (zip dari `npm run zip:share`, atau Chrome Web Store).
- [ ] Formulir masukan: lihat `supabase/README.md`, lalu isi `config.js`.
- [ ] Kebijakan privasi: tinjau, isi kontak dan masa simpan, hapus label "Draf" setelah ditinjau.
- [ ] Verifikasi klaim analitik tanpa cookie di dokumentasi Vercel.

## Uji lokal

Tidak ada server bawaan. Server statis apa pun yang mendukung URL bersih cocok, misalnya `npx serve site`.
