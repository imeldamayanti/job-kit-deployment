# job-kit

**Ketik sekali, lamar di mana saja.**

job-kit adalah ekstensi Chrome yang mengisi form lamaran kerja dari profil yang kamu ketik sekali. Kamu melihat apa yang akan diisi sebelum menekan Fill, dan bisa membatalkannya dengan Undo.

Telemetri hanya bila kamu menyalakannya (opt-in, anonim, hanya hitungan kejadian). Datamu ada di browser. **Akun dan sinkron antar perangkat bersifat opsional dan mati secara bawaan**: tanpa akun, tidak ada server yang terlibat. Autofill, profil, dan Import CV tidak melakukan permintaan jaringan; fitur **Lowongan** dan **Lamaran** (opsional, mati secara bawaan) memakai jaringan dan AI, lihat [Privasi](#privasi).

## Yang bisa dilakukan

- **Satu profil, satu tempat.** Personal Info, Contact & Address, Education, Work Experience, dan Custom Field (pasangan nama dan isi, misalnya "Ekspektasi gaji").
- **Pratinjau sebelum mengisi.** Side panel menampilkan field yang terdeteksi di halaman, nilainya, dan "N dari M field cocok". Setiap field bisa dimatikan.
- **Mengerti label Indonesia dan Inggris.** "Nama Lengkap" dan "Full Name" sama-sama dikenali. Dropdown dan radio dicocokkan longgar ("Laki-laki" memilih "Male", "S1" memilih "Bachelor's Degree").
- **Aman.** Field yang sudah kamu isi dilewati kecuali kamu pilih Timpa. Undo mengembalikan semua field ke nilai sebelum diisi, selama halaman belum dimuat ulang.
- **Bekerja di form modern.** Nilai yang diisi diterima form React dan sejenisnya, bukan hanya form HTML biasa.
- **Isi profil dari CV PDF.** Di halaman Data, pilih CV berformat PDF. job-kit membaca teksnya di browser ini, memetakan nama, kontak, pendidikan, dan pengalaman dengan aturan, lalu menampilkan pratinjau per field. Tidak ada yang tersimpan sebelum kamu menekan Isi profil, dan field yang sudah berisi dilewati kecuali kamu mencentangnya. Field yang meragukan ditandai "Periksa lagi"; teks yang tidak bisa dipetakan ditampilkan apa adanya.
- **Lowongan harian (opsional).** job-kit mengambil lowongan sekali sehari dari sumber yang kamu nyalakan, memberi tiap lowongan skor kecocokan beserta alasannya, memisahkan Remote, Hybrid, dan On-site, dan **Buka & isi** membuka lowongannya dengan panel Autofill siap. Isi dulu **Preferensi kerja** di Profile, lalu nyalakan sumber di **Atur Lowongan**. Status: fitur ini lolos tes otomatis tetapi belum dijalankan terhadap layanan sungguhan di Chrome, jadi anggap eksperimental.
- **Lamaran: satu tempat untuk semua lamaranmu.** Dari kartu lowongan, **Siapkan lamaran** membuat lamaran berstatus Draft dengan salinan lowongannya (tetap utuh walau lowongan dihapus dari feed). Halaman **Lamaran** menampilkannya sebagai papan (Draft, Dilamar, Direview, Interview, Offer; Ditolak dan Dibatalkan dilipat) yang bisa dicari dan diubah dengan menyeret kartu, atau sebagai **Visualisasi**: diagram alur dari Dilamar sampai Offer, Ditolak, atau Tanpa kabar (Dilamar tanpa perubahan 14 hari), dihitung dari riwayat status. Lamaran yang kamu isi lewat Buka & isi masuk ke sini otomatis; yang tidak datang dari feed bisa ditambah dengan **Tambah lamaran**. Detail Lamaran menyimpan catatan, riwayat otomatis, dan **tanggal tindak lanjut**: saat jatuh tempo kartunya berborder amber dan item Lamaran di sidebar menampilkan badge jumlahnya, tanpa notifikasi sistem.
- **CV yang disesuaikan dengan lowongan (opsional, perlu kunci AI).** Di Detail Lamaran, **Buat CV** menyusun ulang urutan skill dan butir pengalamanmu agar sesuai requirement lowongan, lalu menunjukkan requirement mana yang tertutup dan mana yang belum. AI hanya boleh memilih dan menyusun ulang isi profilmu; jabatan, perusahaan, tanggal, dan skill diambil dari Profile. Pemeriksa fakta menolak seluruh hasil bila ada skill, angka, atau istilah teknis yang tidak ada di profilmu, dan CV sebelumnya tetap. Pemeriksa itu mesin: klaim yang bunyinya wajar tetapi tidak benar secara makna ("memimpin tim") tidak bisa dideteksi, jadi baca hasilnya sebelum dipakai. Status: lolos tes otomatis dan satu run nyata dengan profil contoh; belum dicoba pada lamaran nyata. **Unduh PDF** membuat PDF dengan satu templat di browser ini (tidak diunggah ke mana pun); huruf di luar WinAnsi (misalnya "李") diganti dan kamu diberi tahu.
- **Surat lamaran (opsional, perlu kunci AI).** Di Detail Lamaran, tab **Surat**, **Buat surat** menulis draf dalam bahasa lowongan (Indonesia atau Inggris, bisa diganti) dengan nada formal atau santai, dari Profile dan teks lowongan. Aturan tanpa karangan sama dengan CV: skill, angka, atau istilah teknis yang tidak ada di Profile membuat seluruh surat ditolak dan kamu melihat sebabnya; penyebutan alat dari lowongan yang tidak kamu punya pun ditolak. Nama di penutup diisi di komputer ini dan tidak dikirim ke AI. Surat bisa diedit (tersimpan otomatis, bertanda Diedit), disalin, dibuat ulang (dengan konfirmasi bila sudah kamu edit), dan dikembalikan ke versi AI. Lewat **Buka & isi**, panel mengisi field cover letter di form dari surat itu (bisa dimatikan seperti field lain) dan, setelah Fill, menandai lamaran Dilamar dengan tautan **Lihat lamaran**. Status: lolos tes otomatis dan dicoba di Chrome dengan penyedia AI palsu; belum dicoba dengan model sungguhan atau form lamaran sungguhan.
- **Export, Import, dan Hapus semua.** Halaman Data menyimpan profil, lowongan, dan lamaran (termasuk CV yang disesuaikan) ke satu berkas JSON, memulihkannya (Gabung atau Ganti), dan menghapus semuanya setelah kamu mengetik `HAPUS`.

## Yang tidak dilakukan

- Tidak menekan tombol submit. Kamu yang mengirim form.
- Tidak mengisi field password.
- Tidak mengunggah CV ke form lamaran. Field unggah file tidak pernah disentuh: panel hanya menyebut berkas CV yang sudah kamu unduh, dan kamu memilihnya sendiri. CV PDF yang kamu impor hanya dibaca untuk mengisi profil, dan PDF-nya tidak pernah meninggalkan browser.
- Tidak membaca CV hasil scan atau foto. Import CV hanya membaca PDF yang punya lapisan teks, tanpa OCR dan tanpa AI, sehingga akurasinya bergantung pada tata letak CV. PDF yang dikunci kata sandi juga ditolak. Selalu cek pratinjau sebelum mengisi.
- Tidak melamar otomatis, dan tidak membuat latihan interview. AI dipakai untuk menormalkan dan menilai lowongan, untuk menyusun ulang CV dari isi profilmu, dan untuk menulis draf surat lamaran; AI tidak menulis fakta baru tentang dirimu.
- Tidak mengisi essay atau pertanyaan bebas lain di form lamaran. Hanya textarea yang berlabel **Cover letter**, **Surat lamaran**, atau **Letter of motivation** yang diisi dari surat lamaranmu; yang lain dilewati.
- Tidak membaca halaman yang butuh login. LinkedIn hanya halaman pencarian publik, tanpa cookie-mu.
- Tidak ada banyak profil. Sinkron antar perangkat hanya lewat akun opsional (lihat [Privasi](#privasi)).
- Hanya browser Chromium, dan baru diuji di Chrome. Tidak ada Safari atau Firefox.

## Pasang

Butuh Node.js 22 atau lebih baru.

```bash
npm install
npm run build
```

Lalu di Chrome:

1. Buka `chrome://extensions` dan nyalakan **Developer mode**.
2. Klik **Load unpacked**, lalu pilih folder `.output/chrome-mv3/`. Folder itu tersembunyi (awalan titik); di dialog tekan `Cmd+Shift+G` dan tempel path-nya.

Untuk membuat berkas zip yang siap dibagikan:

```bash
npm run zip
```

Hasilnya `.output/job-kit-0.1.0-chrome.zip`.

### Build untuk dibagikan (tanpa AI)

```bash
npm run build:share   # .output-share/chrome-mv3/
npm run zip:share     # .output-share/job-kit-0.1.0-chrome.zip
```

Build ini tidak memuat fitur AI: skor lowongan memakai aturan (skor kasar), dan Buat CV serta Buat surat menampilkan "belum tersedia di versi ini". Penyedia Claude Code dan `scripts/bridge.mjs` tidak ikut. Website statis ada di [site/](site/README.md); panduan distribusi di [docs/06-distribution.md](docs/06-distribution.md).

## Cara pakai

1. **Isi profil.** Klik ikon job-kit untuk membuka side panel, buka tab **Profile**, lalu **Edit Profile**. Perubahan tersimpan otomatis.
2. **Buka halaman lamaran**, klik ikon job-kit, dan beri izin untuk situs itu bila diminta (**Beri izin untuk situs ini**). Panel menampilkan field yang cocok dan nilainya.
3. **Periksa, lalu Fill.** Matikan field yang tidak perlu, tekan **Fill**, periksa form, lalu kirim sendiri. Salah isi? Tekan **Undo**.

## Privasi

**Yang tetap lokal.** Profil, Autofill, dan Import CV bekerja di browser ini tanpa permintaan jaringan. Profil disimpan di `storage.local`. job-kit hanya membaca halaman yang kamu izinkan, dan hanya saat kamu membuka panelnya. Telemetri mati secara bawaan (lihat di bawah).

**Akun dan sinkron (opsional, mati secara bawaan).** Bila kamu menyalakannya, profil, lamaran, CV, dan surat dienkripsi di browser ini dengan **kata sandi sinkron** milikmu, lalu disimpan di Supabase sebagai ciphertext. Server tidak bisa membaca isinya; ia hanya tahu emailmu, kapan dan seberapa besar data ditulis. **Lupa kata sandi sinkron berarti data online tidak bisa dipulihkan**; data di browser tetap ada. Kunci API, daftar lowongan, dan pemakaian AI tidak disinkronkan. Dari halaman Akun kamu bisa Export, mematikan sinkron, dan menghapus akun beserta semua datanya di server. Izin host Supabase diminta saat kamu menyalakannya.

**Telemetri (opsional, mati secara bawaan).** Bila kamu menyalakannya di halaman Akun, job-kit mengirim hitungan kejadian anonim: nama kejadian dari daftar tetap (Fill dipakai, lamaran ditambah, CV dibuat, surat dibuat, lowongan diambil, sinkron jalan, ada error), tanggal, versi ekstensi, dan jumlahnya. Tidak ada isi profil, CV, lowongan, URL, email, atau pesan error, dan tidak ada ID pengguna atau perangkat. Halaman Akun menampilkan persis apa yang akan dikirim. Mematikannya menghapus hitungan yang belum terkirim.

**Fitur Lowongan** mengubah itu, hanya bila kamu menyalakannya:

- **Mati secara bawaan, izin per sumber.** Izin host untuk Greenhouse, Lever, Ashby, Remotive, LinkedIn, dan penyedia AI diminta saat kamu menyalakannya, bukan saat instal.
- **Yang dikirim ke penyedia AI** hanya ringkasan untuk pencocokan: role incaran, level, skill, judul dan lama pengalaman, jenjang pendidikan, preferensi lokasi dan tipe kerja, ditambah teks lowongan. Nama, email, telepon, alamat, dan tanggal lahir tidak dikirim.
- **Yang dikirim untuk CV dan surat yang disesuaikan** lebih sempit dari itu: skill, jabatan dan lamanya, butir deskripsi pengalaman, jenjang pendidikan, ditambah teks lowongan (untuk surat juga nama perusahaan di lowongan itu). Nama, email, telepon, alamat, dan tanggal lahir tidak dikirim, dan nama perusahaan serta kampusmu diganti kode (`{C1}`, `{S1}`) sebelum dikirim lalu dipulihkan di browser ini. Ada batas harian panggilan AI untuk dokumen (bawaan 20, bisa diubah di Atur Lowongan). Bila model yang kamu pilih diketahui memakai data untuk melatih (misalnya tier gratis), job-kit memberi peringatan sekali per lamaran sebelum mengirim. Tanpa kunci AI, Lamaran tetap berfungsi penuh kecuali tombol Buat CV dan Buat surat. CV dan surat berbagi batas harian yang sama.
- **Kunci API milikmu.** Tidak ada server job-kit. Kunci disimpan di `storage.local` browser ini, tidak ikut Export, dan terhapus oleh Hapus semua. Request AI langsung dari browsermu ke penyedia. (Build yang dibagikan tidak memuat fitur AI.)
- **Risiko scraping.** LinkedIn dibaca dari halaman pencarian publik tanpa login dan tanpa cookie-mu, dengan jumlah halaman dibatasi dan jeda acak. Tetap ada risiko: syarat layanan situs, blokir IP sementara, atau struktur halaman berubah. Sumber yang gagal tiga kali berturut-turut dijeda otomatis.
- **Sumber:** Greenhouse, Lever, dan Ashby (untuk perusahaan yang kamu pilih), Remotive, dan halaman pencarian publik LinkedIn.

Izin yang diminta saat instal: `storage`, `sidePanel`, `scripting`, `tabs`, `offscreen`, dan `alarms`. `tabs` dipakai untuk menampilkan nama domain halaman aktif, sehingga Chrome akan menyebutnya saat instal. `offscreen` dipakai untuk membaca HTML halaman lowongan, `alarms` untuk jadwal harian.

## Batas yang sudah diketahui

- **Form yang tertanam di iframe situs lain tidak bisa diisi.** Banyak halaman karier perusahaan menanam Greenhouse atau Lever seperti ini. Panel menjelaskannya; buka form langsung di tab baru.
- **Widget autocomplete** (misalnya kolom lokasi) menerima teks yang diisi, tetapi situs belum tentu menganggapnya pilihan yang sah. Periksa sebelum mengirim.
- Pertanyaan bebas, esai, dan survei EEO sengaja tidak diisi.

Hasil uji pemetaan pada form lamaran sungguhan ada di [docs/site-results.md](docs/site-results.md). Ringkasnya: 6 form publik (Greenhouse, Lever, Ashby, Workable) terbaca dan terisi, dan nilai bertahan di form React asli. Situs yang butuh login (Workday, Jobstreet, Glints, Kalibrr, LinkedIn) belum diuji.

## Pengembangan

```bash
npm run dev        # build dan muat ulang otomatis
npm test           # tes unit (Vitest)
npm run typecheck  # TypeScript
```

Stack: [WXT](https://wxt.dev) 0.21, React 19, TypeScript, Tailwind CSS 4, Lucide, Motion, Vitest.

```
src/
  core/        logika murni (profil, pemetaan label, pengisian, feed lowongan, skor AI, lamaran, penyesuaian CV, surat lamaran), tanpa API browser
  platform/    satu-satunya tempat memanggil API browser: storage, pesan, izin, tab, alarm, klien AI
  ui/          komponen dan hook yang dipakai lebih dari satu layar
  entrypoints/ background, page-reader, sidepanel, options, offscreen
fixtures/      halaman HTML untuk menguji pengisian
docs/          riset, PRD, RFC, rencana kerja, dan hasil uji situs
```

Dokumen kerja: [riset](docs/01-research.md), [PRD](docs/02-prd.md), [RFC](docs/03-rfc.md), [rencana](docs/plan.md).
