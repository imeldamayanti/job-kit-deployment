# Distribusi build yang dibagikan (Fase 1)

Status: **panduan, belum dijalankan.** Hal yang bergantung pada pihak ketiga ditandai **[verifikasi]**: periksa di sumber resminya sebelum dipakai.

## 1. Build

```bash
npm run build:share   # folder .output-share/chrome-mv3/
npm run zip:share     # .output-share/job-kit-0.1.0-chrome.zip
```

Build ini: tanpa fitur AI (tanpa penyedia, kunci, atau panggilan AI), tanpa klien jembatan lokal (`scripts/bridge.mjs` tidak ada di zip). Build lokal (`npm run build`) tidak berubah dan tetap memakai AI.

Sebelum membagikan zip, cek isinya: `unzip -l .output-share/job-kit-0.1.0-chrome.zip`. Hanya berkas ekstensi; tidak ada `scripts/`, `spikes/`, `docs/`, atau `.env*`.

## 2. Jalur A: zip dan Load unpacked (1 sampai 2 teman pertama)

Kirim zip dan arahkan teman ke [halaman Cara pasang](../site/pasang.html). Kekurangan: Chrome menampilkan peringatan mode pengembang, tidak ada pembaruan otomatis, dan teman harus memasang ulang untuk tiap versi.

## 3. Jalur B: Chrome Web Store, Unlisted atau Private

- Pendaftaran akun developer: biaya sekali bayar **US$5** **[verifikasi]**.
- **Unlisted:** tidak muncul di pencarian; siapa pun yang punya tautan bisa memasang. **Private / trusted testers:** hanya akun Google yang kamu daftarkan **[verifikasi]**.
- Pembaruan otomatis ke teman setelah tiap versi lolos review.
- Waktu review: perkiraan komunitas 1 sampai 3 minggu untuk izin host luas; bukan janji resmi **[verifikasi]**.

### Bahan isian (draf, cocokkan dengan formulir dashboard saat ini)

**Tujuan tunggal:** mengisi form lamaran kerja dari profil yang disimpan pengguna di browsernya, dan melacak lamaran.

**Alasan izin:**
| Izin | Alasan |
|---|---|
| `storage` | Menyimpan profil, lamaran, dan pengaturan di browser pengguna. |
| `sidePanel` | Panel Autofill di samping halaman lamaran. |
| `scripting` | Membaca dan mengisi field form di halaman yang pengguna izinkan. |
| `tabs` | Menampilkan nama domain halaman aktif. |
| `offscreen` | Membaca teks PDF CV dan HTML halaman lowongan di dokumen tersembunyi. |
| `alarms` | Jadwal pengambilan lowongan harian (fitur opsional). |
| host `*://*/*` (opsional) | Diminta per situs, saat pengguna mengizinkan job-kit membaca form di situs itu atau menyalakan sumber lowongan. Tidak diminta saat instal. |

**Kode jarak jauh:** tidak ada. **Penjualan atau transfer data pengguna:** tidak ada.

**Pengungkapan data:** profil dan konten halaman diproses di perangkat dan tidak dikirim ke pembuat. Fitur Lowongan (opsional) mengirim role dan lokasi incaran ke sumber lowongan yang dipilih pengguna. Cocokkan dengan kategori pada formulir "Privacy practices" **[verifikasi]**, dan tautkan [kebijakan privasi](../site/privasi.html) setelah ditinjau.

**Aset yang dibutuhkan** **[verifikasi ukuran terkini]:** ikon 128px (ada di `public/icon/`), tangkapan layar, deskripsi singkat dan panjang.

## 4. Metrik tanpa melacak orang

- Dashboard Chrome Web Store: pemasangan, pencopotan, pengguna mingguan per negara, bahasa, OS, versi.
- Website: Vercel Web Analytics (kunjungan halaman).
- Tidak ada telemetri di ekstensi.

## 5. Daftar sebelum dibagikan

- [ ] `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run build:share` hijau.
- [ ] Isi zip dicek (butir 1).
- [ ] Coba pasang zip di profil Chrome bersih; semua layar AI menampilkan "belum tersedia di versi ini".
- [ ] Tautan unduhan di `site/pasang.html` terisi.
- [ ] Kebijakan privasi ditinjau; formulir masukan aktif.
- [ ] Pengguna diingatkan rutin **Export** dari halaman Data (data hanya ada di browser).

**Selesai Fase 1 bila:** 3 teman memasang tanpa bantuan dan angka pemasangan terlihat.
