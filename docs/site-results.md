# Hasil uji situs lamaran (PRD §10)

Target PRD §10: **≥70% field terpetakan dengan benar pada 10 situs lamaran uji.**

**Status: sebagian.** 6 dari 10 situs yang diminta tidak bisa saya uji (lihat "Belum diuji"). Angka di bawah berasal dari 6 form publik yang terbaca, ditambah satu form yang tidak terbaca. Jangan baca ini sebagai metrik 10 situs yang sudah lulus.

## Cara mengukur

- **Tanggal:** 2026-10-09. Chrome for Testing 151, headless, ekstensi dari `.output/chrome-mv3/`, izin situs diberikan lewat salinan manifest uji.
- **Profil uji:** nama Imelda Wijaya, lahir 17 Agustus 1998, perempuan, Indonesia, email, telepon, LinkedIn, website, alamat lengkap (Bandung, Jawa Barat, 40115), pendidikan S1.
- **Dihitung:** semua field text, textarea, dropdown, dan radio yang dibaca panel dari halaman.
- **"Bisa dijawab profil"** (penyebut): field yang jawabannya memang ada di profil: nama, email, telepon, LinkedIn, website, lokasi, gender, negara, dan sejenisnya. Resume, cover letter, esai, pertanyaan visa, dan survei EEO lain tidak dihitung, karena job-kit memang tidak mengisinya.
- **"Terpetakan benar"** (pembilang): field yang bisa dijawab profil dan diisi dengan nilai yang tepat. Field yang diisi nilai keliru dihitung sebagai salah.
- PRD tidak mendefinisikan penyebut. Definisi di atas adalah pilihan saya; kalau penyebutnya semua field di form, angkanya jauh lebih rendah (7 dari 32 di Greenhouse), karena kebanyakan field adalah pertanyaan bebas.

## Hasil per situs

| Situs | Field terbaca | Bisa dijawab profil | Terpetakan benar | Catatan |
|---|---|---|---|---|
| Greenhouse, job-boards (Anthropic) | 32 | 7 | 7 | Country dan Gender terisi. Pertanyaan visa awalnya salah terisi, sudah diperbaiki. |
| Greenhouse, tertanam di situs Airbnb | tidak terbaca | n/a | n/a | Form ada di iframe `greenhouse.io`. Panel menyatakan "frame yang terkunci" dan tidak mengisi (sesuai PRD §8). |
| Lever (Palantir) | 20 | 6 | 6 | |
| Lever (Spotify) | 21 | 8 | 8 | |
| Ashby (Ramp) | 11 | 4 | 4 | "Legal Name" awalnya terlewat. |
| Ashby (Notion) | 10 | 5 | 5 | Termasuk dropdown gender EEO. |
| Workable | 9 | 4 | 4 | |
| **Total (6 situs terbaca)** | | **34** | **34 (100%)** | |

**Sebelum penyetelan:** 30 dari 34 (88%), dan 1 pengisian salah (pertanyaan visa "...in the country in which the job..." terisi "Indonesia"). Penyetelan menambah frasa `legal name`, `current location`, `lokasi`, `domisili`, menolak label berupa pertanyaan atau label panjang yang hanya menyebut kata kunci di tengah, membuang id mesin dari label, dan mengenali iframe platform lamaran. Semuanya punya tes di `src/core/matching` dan `src/core/fill`.

**Peringatan:** penyetelan dilakukan pada situs yang sama dengan pengukurannya, jadi 100% itu optimistis. Sampelnya juga kecil dan semuanya platform berbahasa Inggris untuk perusahaan teknologi, tidak ada form Indonesia. Anggap 88% (sebelum penyetelan) sebagai perkiraan yang lebih jujur untuk situs baru.

## Apakah Fill bertahan di form asli (FR-10)

Diuji dengan menekan Fill, memindahkan fokus, menunggu 1,5 detik, lalu membaca ulang nilai di halaman.

| Situs | Terisi | Bertahan setelah fokus pindah | Undo mengembalikan |
|---|---|---|---|
| Greenhouse (Anthropic) | 7 | ya | ya |
| Lever (Palantir) | 6 | ya | ya |
| Lever (Spotify) | 7 | ya | ya |
| Ashby (Ramp) | 4 | ya | ya |
| Ashby (Notion) | 5 | ya | ya |
| Workable | 4 | ya | ya |

Keenam form memakai React atau sejenisnya, jadi ini bukti bahwa cara tulis nilai (setter prototipe lalu event `input` dan `change`) bekerja di produksi.

## Batas yang ditemukan

- **Form tertanam di iframe lintas-situs tidak bisa diisi.** Banyak halaman karier perusahaan menanam Greenhouse atau Lever seperti ini (contoh: Airbnb). Panel menjelaskannya, tetapi pengguna harus membuka form langsung di tab baru. Ini sesuai PRD §8, tetapi akan sering terjadi.
- **Widget autocomplete** (misalnya "Current location" di Lever, "Country" di Greenhouse) menerima teks yang kita tulis, tetapi belum terbukti situs menganggapnya sebagai pilihan yang sah dari daftar. Isi akhirnya perlu dicek pengguna ("Cek sekali lagi sebelum submit, ya.").
- **Pertanyaan bebas dan survei EEO** sengaja dilewati.
- Workable mengubah format nomor telepon sendiri (`812-3456-7890`).

## Belum diuji

| Situs | Alasan |
|---|---|
| Workday | Form lamaran ada setelah membuat akun atau masuk. Saya tidak membuat akun atau memasukkan kata sandi. |
| Jobstreet | Sama: lamar butuh login. |
| Glints | Sama. |
| Kalibrr | Sama. |
| LinkedIn Easy Apply | Sama. |
| Google Forms | Tidak ada URL form publik. Kirim satu URL form lamaran dan saya ukur. |
| Satu form kustom perusahaan | PRD masih menandainya TBD. |

Cara menguji sisanya sendiri: buka form lamaran sambil masuk ke akun, buka panel job-kit, catat "N dari M field cocok", tekan Fill, dan catat field mana yang salah atau terlewat padahal ada di profil. Kirim catatannya dan saya masukkan ke tabel ini.
