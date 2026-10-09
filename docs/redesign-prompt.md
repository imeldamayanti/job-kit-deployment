# Prompt: samakan UI job-kit dengan mockup referensi, dan tambah section Data (UI)

Salin semua di bawah garis ini ke chat baru.

---

Kamu mengerjakan tampilan proyek **job-kit**, ekstensi Chrome (Manifest V3) yang mengisi form lamaran kerja dari profil pengguna. Repo ada di `/Users/imelda/Documents/Portfolio/job-kit`. Fiturnya sudah jalan dan teruji. Tugasmu **hanya tampilan**: samakan UI dengan mockup referensi yang sudah saya buat, dan tambahkan section **Data** (UI saja). Jangan ubah perilaku fitur yang ada.

## 1. Baca dulu, sebelum menyentuh kode

1. `docs/plan.md`: kerjakan **T19** (samakan dengan mockup) dan **T17** (section Data, UI). **Jangan** kerjakan T16 (outline field wajib) dan T18 (Import dan Hapus semua berfungsi); keduanya sengaja ditunda.
2. `docs/03-rfc.md`: §3.1 (stack), **§9 (konvensi kode, wajib diikuti persis)**, §8 (keputusan; D2 adalah arah desain).
3. `docs/02-prd.md`: §6.2 (teks persis tiap layar), §6.5 (arah visual), §6.6 (catatan referensi), §7 dan §8.
4. `docs/design-system.md` dan `docs/screens.md` (peta layar; §3.3 menjelaskan Data, state D1 sampai D5).
5. `README.md`.

Status: tiket T01 sampai T15 selesai, 174 tes unit lulus, satu commit per tiket. Perintah: `npm test`, `npm run typecheck`, `npm run build`. Hasil build ada di `.output/chrome-mv3/` (muat lewat `chrome://extensions` → Load unpacked).

## 2. Referensi visual (sumber kebenaran tampilan)

- `docs/reference/JobFill UI.dc.html`: mockup panel 400px dan options page, semua state. Buka di browser dan lihat sendiri, jangan hanya membaca isinya.
- `docs/reference/JobFill Mascot.dc.html`: enam state maskot.
- `docs/screenshots/reference-ui.png`: tampilan awal mockup.
- `docs/design-system.md` dan `docs/design-system.html`: token dan komponen.

Nama di mockup masih **"JobFill"**. Di produk dipakai **"job-kit"**: ganti di mana pun nama itu tampil.

## 3. Cara kerja (wajib)

1. Karena ada referensi visual, muat skill **`image-to-code`**, sebutkan itu, dan baca isinya sebelum mengikutinya. Skill desain bisa salah nama atau salah lingkup; kalau ada bagian yang tidak cocok (asumsi stack atau gaya landing page), katakan bagian apa yang kamu buang dan ikuti PRD §6.5 serta RFC untuk sisanya.
2. **Bandingkan sebelum mengubah.** Ambil screenshot tiap layar build sekarang, bandingkan berdampingan dengan mockup, tulis **daftar selisih**, dan tunjukkan ke saya. Baru setelah itu ubah kodenya. Jangan menebak dari teks dokumen.
3. Patuhi RFC §9: struktur folder (`core/`, `platform/`, `ui/`, `entrypoints/`), warna dan spasi hanya dari token `@theme` di `src/assets/tailwind.css`, ikon hanya dari `lucide-react`, gerak hanya dari `motion/react`, komponen tidak memanggil `browser.*`, tidak ada logika bisnis di komponen.
4. **Tidak ada kontrol bawaan browser tanpa gaya.** Setiap `select`, `input`, `button`, `checkbox`, `radio` harus bergaya sesuai arah desain. Periksa di layar yang dirender, bukan di source (abu-abu di atas abu-abu terbaca sebagai nonaktif).
5. **Pakai string persis dari PRD §6.2** untuk empty state, error, dan label aksi. Jangan memparafrasekan. Teks baru yang tidak ada di PRD (misalnya subjudul halaman) tandai di laporan sebagai teks baru.
6. Setelah kode UI: jalankan `npx -y impeccable detect src/ui src/entrypoints` (harus tanpa temuan), lalu baca layar yang dirender: hitungan, pluralisasi, dan teks bersyarat hanya kelihatan di layar.
7. TDD untuk logika baru (misalnya format ukuran storage, state machine halaman Data). Perubahan murni tampilan cukup diverifikasi visual, `typecheck`, dan `build`.
8. Satu commit per langkah yang berarti, pesan commit menyebut tiket (T17 atau T19), **jangan push**. Akhiri pesan commit dengan baris `Co-Authored-By` yang diminta lingkunganmu.
9. Hook GateGuard di lingkungan ini meminta empat fakta (pemanggil, API terdampak, skema data, kutipan instruksi) sebelum `Write` atau `Edit` pertama; sebutkan lalu ulangi perintahnya.

## 4. Selisih yang sudah saya temukan (mulai dari sini, tapi periksa sendiri)

Build sekarang dibuat dari token dan teks tanpa pernah dibandingkan dengan mockup, jadi hampir pasti ada selisih lain. Yang sudah terlihat di options page:

1. Kepala sidebar: logo dan nama produk (**job-kit**). Sekarang tidak ada.
2. Seluruh options page berada dalam **satu kartu membulat** di atas latar abu, dengan sidebar putih di kiri. Sekarang berupa halaman datar.
3. Dasar sidebar: catatan kecil "Data disimpan tanpa enkripsi di storage browser ini. Tidak ada server, tidak ada akun."
4. Judul halaman punya **subjudul** satu baris.
5. Indikator "Tersimpan": **titik hijau + teks**, bukan ikon centang.
6. Item navigasi: urutan mengikuti PRD §6.2 (Personal Info, Contact & Address, Education, Work Experience, Custom Field), bukan urutan mockup.
7. Side panel: bandingkan juga tab berbentuk map, site header, summary bar, baris field, banner hasil, maskot, dan footer tetap.

**Titik status kelengkapan per item navigasi (FR-15) dan Skill (FR-16) sengaja dipotong dari v1.** Jangan membuatnya tanpa menanyakan saya.

## 5. Section Data (T17, UI saja)

Keputusan saya (PIC) 2026-10-09: halaman Data masuk v1 **sebagai UI dulu**. Rujukan: screenshot mockup halaman Data dan `docs/screens.md` §3.3.

- Navigasi kiri punya grup **DATA** dengan satu item, **Data**. Captured Jobs dan Additional **tetap di luar v1**.
- Halaman **D1 idle**: tiga kartu aksi (Export, Import, Hapus semua) dan kartu "Pemakaian storage" dengan bar dan angka **nyata** (`browser.storage.local.getBytesInUse` lewat `src/platform/`; contoh tampilan "1.8 MB dari 10 MB"), plus kalimat jujur soal enkripsi.
- Buang semua kata **"captured jobs"** dan **"pemetaan situs"** dari teks kartu; keduanya di luar v1. Contoh: Export = "Seluruh profil ke satu file JSON berversi."
- **Export JSON** boleh sungguhan karena hanya membaca (satu berkas berversi berisi profil).
- Buat state **D2** (pratinjau import dengan Ganti atau Gabung), **D3** (import tidak valid dengan sebab), **D4** (konfirmasi hapus dengan mengetik ulang kata), **D5** (selesai dengan angka) sebagai komponen, digerakkan oleh state machine bertipe di `core/` (`idle | import-preview | import-error | confirm-delete | done`) dengan tes.
- **Import dan Hapus semua belum disambungkan** (itu T18). Di build produksi tombolnya tampil **nonaktif dan menyebut alasan** ("Belum tersedia di versi ini"); tidak boleh ada kontrol yang tampak berfungsi tetapi tidak melakukan apa-apa. Supaya D2 sampai D5 tetap bisa dilihat dan diperiksa, tampilkan lewat parameter alamat yang hanya aktif saat `import.meta.env.DEV` (misalnya `options.html#data?state=import-preview`).
- Perubahan dokumen yang ikut (sudah tercatat di T17): PRD §4, §9, §6.6 #13, FR-21 dan FR-22 baru, dan tabel cakupan di `docs/plan.md`. Kerjakan perubahan dokumen itu **sebelum** kodenya, tulis sebagai keputusan PIC bertanggal 2026-10-09.

## 6. Batas (jangan dilakukan)

- Jangan menambah fitur di luar daftar ini dan jangan mengubah skema profil, logika pemetaan, atau logika Fill dan Undo.
- Captured Jobs, Additional, Skill, titik status, dan **mode gelap** tetap di luar v1 (mode gelap ditunda PIC).
- Jangan mengubah string PRD §6.2 yang sudah ada kecuali mockup berbeda; kalau berbeda, tanyakan dulu.
- Jangan menyalin bug mockup: kolom kanan form di mockup options page meluber dari kartu (PRD §6.6 #14); build sekarang sudah benar dan harus tetap benar.
- Jangan membuat fitur "Petakan", skor kecocokan, atau tombol pencarian dan setelan di header yang ada di mockup tetapi di luar v1 (PRD §6.6 #5 dan #6).

## 7. Sebelum mulai, tanyakan (maksimal tiga pertanyaan, dalam satu pesan)

Hanya hal yang benar-benar membuat jalanmu bercabang, dan beri rekomendasimu. Kalau tidak ada, langsung mulai dari daftar selisih.

## 8. Verifikasi dan laporan akhir

- `npm test`, `npm run typecheck`, `npm run build` harus bersih (174 tes unit sebelum kamu mulai, lebih setelah kamu menambah tes).
- Screenshot **sebelum dan sesudah** untuk tiap layar yang kamu ubah (options: tiap section termasuk Data; panel: tiap state), dan bandingkan dengan mockup.
- Ada Chrome for Testing 151 di `~/.cache/puppeteer/chrome/` yang bisa memuat ekstensi lewat `--load-extension=<folder build>` bila ditambah `--disable-features=DisableLoadExtensionCommandLineSwitch`. Side panel hanya hidup di Chrome; halaman options bisa dilihat dengan menyajikan `.output/chrome-mv3/` lewat server lokal.
- Laporan: selisih yang diperbaiki, selisih yang sengaja dibiarkan beserta alasannya, teks baru yang kamu tulis, dan hal yang belum bisa kamu verifikasi. Jangan menulis "selesai" untuk sesuatu yang belum kamu lihat di layar.
