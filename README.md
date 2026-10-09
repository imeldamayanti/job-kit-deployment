# job-kit

**Ketik sekali, lamar di mana saja.**

job-kit adalah ekstensi Chrome yang mengisi form lamaran kerja dari profil yang kamu ketik sekali. Kamu melihat apa yang akan diisi sebelum menekan Fill, dan bisa membatalkannya dengan Undo.

Tanpa akun, tanpa server, tanpa telemetri. Datamu ada di browser. Autofill, profil, dan Import CV tidak melakukan permintaan jaringan; fitur **Lowongan** (opsional, mati secara bawaan) memakai jaringan dan AI, lihat [Privasi](#privasi).

## Yang bisa dilakukan

- **Satu profil, satu tempat.** Personal Info, Contact & Address, Education, Work Experience, dan Custom Field (pasangan nama dan isi, misalnya "Ekspektasi gaji").
- **Pratinjau sebelum mengisi.** Side panel menampilkan field yang terdeteksi di halaman, nilainya, dan "N dari M field cocok". Setiap field bisa dimatikan.
- **Mengerti label Indonesia dan Inggris.** "Nama Lengkap" dan "Full Name" sama-sama dikenali. Dropdown dan radio dicocokkan longgar ("Laki-laki" memilih "Male", "S1" memilih "Bachelor's Degree").
- **Aman.** Field yang sudah kamu isi dilewati kecuali kamu pilih Timpa. Undo mengembalikan semua field ke nilai sebelum diisi, selama halaman belum dimuat ulang.
- **Bekerja di form modern.** Nilai yang diisi diterima form React dan sejenisnya, bukan hanya form HTML biasa.
- **Isi profil dari CV PDF.** Di halaman Data, pilih CV berformat PDF. job-kit membaca teksnya di browser ini, memetakan nama, kontak, pendidikan, dan pengalaman dengan aturan, lalu menampilkan pratinjau per field. Tidak ada yang tersimpan sebelum kamu menekan Isi profil, dan field yang sudah berisi dilewati kecuali kamu mencentangnya. Field yang meragukan ditandai "Periksa lagi"; teks yang tidak bisa dipetakan ditampilkan apa adanya.
- **Lowongan harian (opsional).** job-kit mengambil lowongan sekali sehari dari sumber yang kamu nyalakan, memberi tiap lowongan skor kecocokan beserta alasannya, memisahkan Remote, Hybrid, dan On-site, dan **Buka & isi** membuka lowongannya dengan panel Autofill siap. Isi dulu **Preferensi kerja** di Profile, lalu nyalakan sumber di **Atur Lowongan**. Status: fitur ini lolos tes otomatis tetapi belum dijalankan terhadap layanan sungguhan di Chrome, jadi anggap eksperimental.
- **Export, Import, dan Hapus semua.** Halaman Data menyimpan profil ke satu berkas JSON, memulihkannya (Gabung atau Ganti), dan menghapus semuanya setelah kamu mengetik `HAPUS`.

## Yang tidak dilakukan

- Tidak menekan tombol submit. Kamu yang mengirim form.
- Tidak mengisi field password.
- Tidak mengunggah CV ke form lamaran. CV PDF hanya dibaca untuk mengisi profil, dan PDF-nya tidak pernah meninggalkan browser.
- Tidak membaca CV hasil scan atau foto. Import CV hanya membaca PDF yang punya lapisan teks, tanpa OCR dan tanpa AI, sehingga akurasinya bergantung pada tata letak CV. PDF yang dikunci kata sandi juga ditolak. Selalu cek pratinjau sebelum mengisi.
- Tidak melamar otomatis, dan tidak membuat cover letter atau latihan interview. AI hanya dipakai untuk menormalkan dan menilai lowongan.
- Tidak membaca halaman yang butuh login. LinkedIn hanya halaman pencarian publik, tanpa cookie-mu.
- Tidak ada banyak profil atau sinkron antar perangkat.
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

## Cara pakai

1. **Isi profil.** Klik ikon job-kit untuk membuka side panel, buka tab **Profile**, lalu **Edit Profile**. Perubahan tersimpan otomatis.
2. **Buka halaman lamaran**, klik ikon job-kit, dan beri izin untuk situs itu bila diminta (**Beri izin untuk situs ini**). Panel menampilkan field yang cocok dan nilainya.
3. **Periksa, lalu Fill.** Matikan field yang tidak perlu, tekan **Fill**, periksa form, lalu kirim sendiri. Salah isi? Tekan **Undo**.

## Privasi

**Yang tetap lokal.** Profil, Autofill, dan Import CV bekerja di browser ini tanpa permintaan jaringan. Profil disimpan di `storage.local`. job-kit hanya membaca halaman yang kamu izinkan, dan hanya saat kamu membuka panelnya. Tidak ada analytics.

**Fitur Lowongan** mengubah itu, hanya bila kamu menyalakannya:

- **Mati secara bawaan, izin per sumber.** Izin host untuk Greenhouse, Lever, Ashby, Remotive, LinkedIn, dan penyedia AI diminta saat kamu menyalakannya, bukan saat instal.
- **Yang dikirim ke penyedia AI** hanya ringkasan untuk pencocokan: role incaran, level, skill, judul dan lama pengalaman, jenjang pendidikan, preferensi lokasi dan tipe kerja, ditambah teks lowongan. Nama, email, telepon, alamat, dan tanggal lahir tidak dikirim.
- **Kunci API milikmu.** Tidak ada server job-kit. Kunci disimpan di `storage.local` browser ini, tidak ikut Export, dan terhapus oleh Hapus semua. Request AI langsung dari browsermu ke penyedia.
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
  core/        logika murni (profil, pemetaan label, pengisian, feed lowongan, skor AI), tanpa API browser
  platform/    satu-satunya tempat memanggil API browser: storage, pesan, izin, tab, alarm, klien AI
  ui/          komponen dan hook yang dipakai lebih dari satu layar
  entrypoints/ background, page-reader, sidepanel, options, offscreen
fixtures/      halaman HTML untuk menguji pengisian
docs/          riset, PRD, RFC, rencana kerja, dan hasil uji situs
```

Dokumen kerja: [riset](docs/01-research.md), [PRD](docs/02-prd.md), [RFC](docs/03-rfc.md), [rencana](docs/plan.md).
