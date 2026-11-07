# Sumber lowongan (Lowongan)

Dokumen hidup. Update tabel status dan tanggal "dicek" setiap kali sumber diuji ulang atau situs berubah.
Terakhir diperbarui: 2026-11-04.

## Tujuan

Setiap hari pemilik cukup membuka feed Lowongan, lalu apply manual di platform asal. Sistem yang mencari dan mengurutkan. Tidak ada auto-apply.

Target: Jakarta, Bali, dan remote. Job remote harus yang bisa diambil kandidat yang tinggal di Indonesia. Job dengan skor 50 ke atas masuk Rekomendasi.

## Status sumber

| Sumber | Cara baca | Status | Dicek | Catatan |
|---|---|---|---|---|
| Greenhouse, Lever, Ashby | API publik per perusahaan | jalan | sebelum 2026-11 | daftar perusahaan diisi di pengaturan |
| Remotive | API publik | jalan | sebelum 2026-11 | remote saja |
| LinkedIn | endpoint tamu `jobs-guest/jobs/api/seeMoreJobPostings/search` | jalan | 2026-11-04 | lihat bagian LinkedIn |
| Threads | tab browser pemilik, sesi login, halaman search | jalan (19 post terbaca di beranda) | 2026-11-04 | lihat bagian Threads |
| Y Combinator | HTML halaman role, JSON di atribut `data-page` | jalan, diuji dengan fixture | 2026-11-04 | tanpa login |
| Wellfound | `__NEXT_DATA__` (Apollo cache) | eksperimen, rapuh | 2026-11-04 | DataDome bisa memblok kapan saja |
| JobStreet | API `/api/jobsearch/v5/search` (SEEK), situs ID dan SG | jalan, diuji langsung | 2026-11-05 | tanpa login; SG hanya kalau Singapore ada di lokasi |
| MyCareersFuture | API publik `api.mycareersfuture.gov.sg/v2/jobs` | jalan, diuji langsung | 2026-11-05 | tanpa login; hampir semua onsite Singapura |
| Glints | - | diblok untuk request langsung | 2026-11-05 | halaman "Glints - Firewall" + captcha; hanya mungkin lewat tab browser seperti Threads |
| Indeed | - | diblok | 2026-11-04 | Cloudflare challenge, 403 sebelum login |
| Upwork | - | diblok | 2026-11-04 | Cloudflare challenge; aturan satu akun per orang |
| Swooped | - | belum diperiksa | 2026-11-04 | butuh login, isi job board belum pernah dilihat |

Semua sumber mati secara default. Izin situs baru diminta saat sumber dinyalakan. Sumber yang gagal 3 kali berturut-turut dijeda otomatis (`shouldPause`).

## Alur penyaringan

`runFeed` ambil dari semua sumber, lalu `passesRules`, buang yang basi (21 hari), `mergeFeed` dan `pruneFeed` (500 job atau 30 hari), lalu `scoreJobs` (AI, 50 job per hari, batch 5; kalau AI tidak ada, skor kasar). Rekomendasi menampilkan job dengan skor 50 ke atas, atau yang judulnya memuat semua kata khas dari salah satu role incaran (`matchesRole` di `view.ts`; kata umum seperti engineer dan developer tidak dihitung, jadi "Civil Engineer" tidak cocok untuk "Frontend Engineer").

Aturan remote (`remoteOpenTo` di `rules.ts`): job remote lolos kalau lokasinya terbuka untuk Indonesia (worldwide, anywhere, global, international, apac, asia, asean, southeast asia, indonesia, atau lokasi yang diinginkan pemilik) atau tidak menyebut wilayah sama sekali. Aturan ini tidak aktif kalau daftar lokasi di preferensi kosong. Prompt skor AI juga menurunkan skor di bawah 30 untuk posting yang membatasi pelamar ke negara atau wilayah yang tidak mencakup kandidat.

## Catatan per sumber

### LinkedIn
- Pencarian: tiap lokasi di preferensi (Jakarta, Bali) plus tiga pencarian remote: Worldwide, Asia Pacific, EMEA (`REMOTE_REGIONS` di `linkedin.ts`, filter `f_WT=2`).
- Sekitar 10 request per run untuk 2 role. Halaman per query dihitung dari `maxPages` dibagi (role x tempat).
- Hasil pencarian "Asia Pacific" dan "EMEA" di endpoint tamu ternyata kota-kota di India dan Prancis, bukan remote se-wilayah. Kartu dari pencarian remote ditandai remote, jadi aturan wilayah Indonesia membuang yang tidak layak. Kalau beberapa hari terasa sia-sia, hapus keduanya dari `REMOTE_REGIONS`.
- Skor lama tidak dihitung ulang (hash skor hanya mencakup profil).

### Threads
- Membuka tab `threads.com`, scroll sedikit dengan jeda acak (maks 8 scroll, 2,5 sampai 6 detik), mengambil post yang berisi lowongan. Memakai sesi login pemilik.
- Hanya ada di build pribadi: dijaga flag `THREAD_ENABLED` di `core/build.ts`, tidak ikut build yang dibagikan.
- Tidak pernah mengulang saat kena tembok login (retry itulah yang bikin akun ditandai).
- Selector ada di satu file, `thread-selectors.ts`. Sudah dicek ke beranda yang sedang login (19 post terbaca, 4 Nov 2026). Sumber ini sekarang membaca halaman pencarian tab Terbaru untuk kata kunci `loker`, `lowongan kerja` dan `hiring` (`THREAD_KEYWORDS`), maksimal 4 scroll per kata kunci, dalam satu jendela.
- Yang sudah ada: pembaca DOM, parser post, dan tes dengan DOM tiruan. Yang belum: satu kali jalan nyata untuk membuktikan selector cocok.

### Y Combinator
- Halaman `https://www.ycombinator.com/jobs/role/<slug>/remote`, role dipetakan ke slug YC (maks 3).
- Job dengan visa "citizen/visa only" dibuang. Workplace selalu remote.
- Daftar tidak memuat deskripsi lengkap, jadi skor AI hanya berdasar judul, skill, dan satu kalimat tentang perusahaan.

### JobStreet
- Satu kode untuk dua negara: `id.jobstreet.com` (`ID-Main`, selalu) dan `sg.jobstreet.com` (`SG-Main`, hanya kalau lokasi preferensi memuat Singapore/Singapura).
- Pencarian per role (maks 3) dengan `sortmode=KeywordRelevance&daterange=14`. Urutan `ListedDate` dicoba dan ditolak: hasilnya penuh job yang cuma berbagi satu kata ("Civil Engineer" untuk "Frontend Engineer").
- Negara ditambahkan ke lokasi ("West Jakarta, Jakarta, Indonesia") supaya aturan remote Indonesia bekerja.

### MyCareersFuture
- Pencarian per role (maks 3), `sortBy=new_posting_date`, 30 job per role. Membawa gaji (S$), level, pengalaman minimal dan tanggal tutup.
- Tidak ada penanda remote. Job dianggap onsite di Singapura, jadi tersaring kalau Singapore tidak ada di lokasi preferensi.

### Wellfound
- Halaman `/role/r/<slug>` (remote) dan `/role/l/<slug>/indonesia` untuk 2 role pertama.
- Job remote membawa `acceptedRemoteLocationNames`, jadi yang hanya menerima "United States" dan sejenisnya tersaring otomatis.
- Rapuh: struktur Apollo cache dan DataDome bisa berubah atau memblok. Auto-jeda setelah 3 kali gagal.

## Situs yang diblok dan akun dummy

Akun dummy (Gmail baru) hanya menyelesaikan masalah login, bukan pemblokiran.
- Indeed dan Upwork: Cloudflare challenge terjadi sebelum login, jadi akun tidak mengubah apa pun. Membuat akun dan menembus bot-detection tidak dikerjakan. Upwork juga melarang akun ganda dan bisa menyeret akun asli kena ban, jadi dilewati.
- Swooped: satu-satunya yang masuk akal. Langkah: pemilik daftar dan login sendiri di Chrome, lalu isi job board dicek dulu. Kalau bisa dibaca, dibuat pembaca lewat tab browser seperti Threads, karena extension memakai `credentials: 'omit'` dan tidak membawa cookie. Profil dummy harus diisi mirip profil asli supaya hasil pencocokan relevan.

## Cara memperbarui dokumen ini

1. Uji sumber (jalankan feed, atau buka halamannya).
2. Ubah baris di tabel status dan tanggal "dicek".
3. Catat perubahan struktur situs atau pemblokiran di bagian sumber terkait.
4. Kalau keputusan berubah (sumber dihapus, sumber baru), tambahkan satu baris di riwayat.

## Riwayat

- 2026-11-05: sumber JobStreet (ID, SG) dan MyCareersFuture. Threads pindah dari beranda ke pencarian kata kunci. Rekomendasi ikut menampilkan job yang judulnya cocok dengan role meski skornya rendah. Glints dinyatakan diblok untuk request langsung.
- 2026-11-04: aturan remote Indonesia, pencarian LinkedIn per lokasi plus Worldwide/Asia Pacific/EMEA, sumber Y Combinator dan Wellfound. Indeed dan Upwork dinyatakan diblok, Swooped menunggu login.
- sebelum 2026-11: sumber Threads (`cc01cee`).
