# Supabase untuk sinkron (Fase 2)

Tidak ada kunci di repo ini. Proyek dibuat dan dikelola oleh pemilik.

1. supabase.com: buat proyek.
2. Authentication > Providers > Email: nyalakan **Email OTP** (kode sekali pakai). Ubah templat email supaya memuat `{{ .Token }}` (kode 6 digit), bukan hanya tautan. Login Google belum ada.
3. Authentication > Rate limits: periksa batas kirim email dan atur sesuai kebutuhan. Email bawaan Supabase sangat terbatas; untuk banyak pengguna pasang SMTP sendiri **[verifikasi batas terkini]**.
4. SQL editor: tempel isi `sync.sql`, jalankan.
5. Project Settings > API: salin **Project URL** dan **publishable key** (bukan secret, bukan service_role) ke `src/core/sync/config.ts`.
6. Uji dengan dua profil Chrome: login, atur kata sandi sinkron, ubah profil di satu sisi, lihat muncul di sisi lain. Lalu hapus akun dan cek tabel `user_data` dan `auth.users` kosong untuk akun itu.
7. Proyek gratis dijeda setelah 1 minggu tanpa aktivitas; sinkron gagal sampai dipulihkan dari dashboard.
