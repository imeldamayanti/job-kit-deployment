# Operasi dan terbit publik (Fase 3)

Status: **panduan, belum dijalankan.** Butir **[verifikasi]** bergantung pada dokumen atau paket pihak ketiga yang berubah; cek di sumber resminya. Tidak ada kunci, token, atau alamat basis data di repo ini; semua diberikan lewat variabel lingkungan di komputer pemilik.

## 1. Yang bisa dilihat pemilik, dan dari mana

| Pertanyaan | Sumber | Catatan |
|---|---|---|
| Berapa akun terdaftar, akun baru per hari | `/admin` (fungsi `admin_stats()`) | Dari tabel login; tanpa isi data. |
| Berapa akun menulis dalam 7 hari | `/admin` | Waktu tulis terakhir `user_data`, bukan isi. |
| Fitur mana dipakai, per versi | `/admin` | Hanya dari pengguna yang menyalakan telemetri; **bukan jumlah pengguna**. |
| Pemasangan, pencopotan, pengguna mingguan per negara, bahasa, OS | Dashboard Chrome Web Store | Agregat dari Google. |
| Kunjungan website | Vercel Web Analytics | Tanpa cookie menurut dokumen Vercel **[verifikasi]**. |

`/admin` menjawab "berapa akun dan fitur apa yang dipakai". **"Berapa pengguna aktif minggu ini" tidak bisa dijawab dari satu halaman**: ekstensi tanpa akun tidak punya pengenal (disengaja, PRD §4.4). Pendekatan terbaik: pengguna mingguan dari dashboard Chrome Web Store ditambah akun yang menulis dalam 7 hari dari `/admin`.

Siapkan admin sekali (SQL editor, email diisi sendiri, tidak disimpan di repo):

```sql
insert into public.admin_users (email) values ('<email-admin-kamu>');
```

## 2. Pencadangan

- Data pengguna di server sudah berupa ciphertext, jadi cadangan juga ciphertext; tanpa kata sandi sinkron pengguna ia tidak bisa dibaca.
- Cadangan otomatis Supabase tergantung paket (proyek gratis mungkin tidak punya cadangan yang bisa dipulihkan sendiri) **[verifikasi paket terkini]**.
- Cadangan sendiri, dijalankan pemilik dari komputernya, dengan alamat basis data dari dashboard Supabase diberikan lewat variabel lingkungan, jangan ditulis di berkas:

```bash
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner -Fc -f "job-kit-$(date +%F).dump"
```

- Simpan hasilnya di tempat terenkripsi, jangan di repo. **Uji pemulihan** ke proyek Supabase kosong sebelum mengandalkannya.
- Daftar sebelum rilis publik: jadwal cadangan mingguan, satu uji pemulihan tercatat.

## 3. Batas laju login dan penyalahgunaan

- Authentication > Rate limits: periksa batas kirim email OTP dan verifikasi, turunkan sesuai kebutuhan **[verifikasi angka bawaan]**.
- Email bawaan Supabase sangat terbatas; pasang SMTP sendiri sebelum banyak pengguna **[verifikasi]**.
- Pertimbangkan CAPTCHA di Auth bila ada penyalahgunaan **[verifikasi dukungannya untuk alur OTP ekstensi]**.
- Tabel `event_counts` dan `feedback` terbuka untuk insert oleh siapa pun yang punya kunci publik: dibatasi panjang, daftar nama, dan RLS, tetapi bisa dibanjiri. Pantau ukuran tabel; bila membengkak, tambahkan batas laju di sisi Supabase atau pindah ke fungsi tepi.

## 4. Pemantauan error

- Ekstensi: kejadian `error` (hitungan saja, tanpa pesan) di `/admin`, bila pengguna menyalakan telemetri. Lonjakan setelah satu versi berarti ada regresi.
- Supabase: tab Logs dan Advisors (keamanan dan performa) di dashboard; periksa tiap rilis.
- Website: Vercel > Logs.
- Belum ada pelacak error terperinci (Sentry dan sejenisnya) dengan sengaja: mengirim jejak error berisiko memuat data pribadi, dan itu bertentangan dengan PRD §4.4.

## 5. Permintaan hapus data

- Dari dalam aplikasi: Akun > Hapus akun (menghapus akun dan semua baris online).
- Dari luar aplikasi (pengguna kehilangan akses, minta lewat formulir masukan): pemilik memverifikasi bahwa permintaan datang dari emailnya, lalu di SQL editor menghapus baris di `auth.users` untuk email itu; baris `user_data` ikut terhapus lewat `on delete cascade`:

```sql
delete from auth.users where email = '<email-pengguna>';
```

- Catat tanggal dan balas pengguna. Cadangan lama tetap memuat ciphertext-nya sampai dirotasi; sebutkan masa rotasi di kebijakan privasi. **Kewajiban hukum penghapusan (UU PDP) belum diperiksa.**
- Pesan di tabel `feedback` dihapus per baris lewat SQL editor atau Table editor.

## 6. Terbit publik di Chrome Web Store

Lanjutan dari [06-distribution.md](06-distribution.md) bagian 3, dengan penambahan:

- Ubah dari Unlisted/Private ke Public setelah kebijakan privasi ditinjau dan kontak ditulis.
- Izin host `*://*/*` (opsional) menarik tinjauan lebih lama; perkiraan komunitas 1 sampai 3 minggu, bukan janji resmi **[verifikasi]**. Siapkan penjelasan per izin (sudah ada di 06-distribution.md).
- Formulir pengungkapan data harus mencerminkan: profil diproses di perangkat; sinkron opsional terenkripsi; telemetri opt-in berupa hitungan anonim; Lowongan mengirim role dan lokasi ke sumber lowongan. Cocokkan dengan kategori terkini di dashboard **[verifikasi]**.
- Risiko scraping lowongan (ketentuan layanan LinkedIn dan sejenisnya) lebih besar untuk rilis luas; pertimbangkan mematikan sumber LinkedIn di build publik. **Keputusan pemilik.**
- Syarat layanan belum ada; tulis dan tinjau sebelum rilis publik.

## 7. Yang sengaja tidak dikerjakan

- **Biaya AI nyata per generate (T35 dan T55)**: tetap milik proyek lokal; Fase 4 tidak bisa diberi harga tanpa angka ini.
- **Fase 4** (API generate publik, penagihan): menunggu persetujuan terpisah dan keputusan skema bayar, badan usaha, dan pajak.

## 8. Bahan portofolio (isi dari data nyata, jangan dikarang)

Sumber angka: dashboard Chrome Web Store (pemasangan, pengguna mingguan), `/admin` (akun, fitur dipakai), Vercel Analytics (kunjungan). Catat tanggal pengambilan tiap angka.

Kerangka studi kasus:
1. Masalah: mengetik ulang data di tiap form lamaran; satu profil, banyak form.
2. Keputusan produk: lokal dulu, akun opsional, enkripsi di sisi klien (RFC D17), telemetri opt-in tanpa pengenal (D18), build tanpa AI untuk dibagikan (D16).
3. Hal teknis yang bisa dijelaskan: WebCrypto AES-GCM dan PBKDF2, RLS di Supabase, aturan "server tidak bisa membaca CV", pemeriksa fakta untuk CV AI, pengujian tanpa server asli dengan server palsu.
4. Hasil: angka nyata di atas, kutipan teman (dengan izin tertulis mereka), tangkapan layar.
5. Yang belum dan alasannya: bagian 7.

Video demo: rekam alur pasang, isi profil dari CV PDF, Fill dengan Undo, dan sinkron antar dua profil Chrome.
