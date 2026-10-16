# Design System — JobFill

**Turunan dari:** `docs/screens.md` §4 (daftar komponen) dan §5 (lima pertanyaan)
**Preview:** `docs/design-system.html` — buka di browser, menampilkan panel 400px dan lebar penuh berdampingan
**Tanggal:** 2026-09-02

Dokumen ini adalah sumber kebenaran token. Angka di sini langsung jadi `tokens.css` di extension — bukan dokumen desain yang nanti diterjemahkan, tapi file yang sama dipakai dua kali.

---

## 1. Referensi dan apa yang diambil dari masing-masing

| Ref | Diambil | **Tidak** diambil |
|---|---|---|
| **img20** — segmented tab (All/Mentions/System) | Bentuk track pill dengan chip aktif; kandidat indikator underline | Warna gelapnya; chevron overflow (kita cuma 2 tab) |
| **img21** — panel extension (Simplify Copilot) | Struktur 400px: kartu per bagian, ikon lingkaran, tombol primer sticky penuh-lebar di bawah, gradasi halus pada tombol | Identitas visualnya, ikonografi, dan copy. Ini kompetitor langsung |
| **img22** — dashboard | Ground abu terang, kartu putih radius besar, bayangan sangat halus, nav pill horizontal, rasa lapang | Kontras teksnya (banyak di bawah 4.5:1); layout Kanban (`screens.md` §4.4) |
| **img23** — mobile job app | Karakter biru cerah sebagai warna aksi | Gradient besar, ilustrasi, bottom nav |

Warna di §3 **dipilih agar sekarakter** dengan img23, bukan disampel piksel per piksel dari gambar. Kalau kamu punya hex aslinya, tukar nilainya dan sisanya tetap jalan — itu gunanya token semantik di §3.3.

### 1.1 Catatan tentang img21

img21 adalah Simplify Copilot, produk yang bersaing langsung dengan JobFill. Memakainya sebagai referensi **struktur** wajar dan berguna — dia sudah memecahkan masalah kepadatan 400px yang sama. Yang tidak boleh: menyalin identitas visual, ikonografi, dan copy-nya.

Satu hal yang berguna dari sana: tab ketiganya "Resume Score" adalah persis compatibility check yang PRD §11 tunda ke v2. Ini menguatkan keputusan PRD — **tab switcher harus menerima item ketiga tanpa mengubah layout.**

---

## 2. Lima putusan (menjawab `screens.md` §5)

### D1 — Satu skala spacing, dua density mode

Bukan dua skala. Satu skala 4px, tapi komponen membaca token density yang nilainya berbeda di dua permukaan:

```css
/* side panel */   --pad-card: 12px;  --gap-row: 8px;   --pad-section: 16px;
/* options page */ --pad-card: 20px;  --gap-row: 12px;  --pad-section: 32px;
```

*Alasan:* dua skala terpisah bikin dua produk. Satu skala dengan dua density menjaga ritme yang sama, cuma lebih rapat. Komponen ditulis sekali.

### D2 — Biru eksklusif untuk hal yang bisa diklik

Ini putusan yang paling menentukan, dan lahir dari konflik nyata: img22 memakai dot biru untuk status "Applied", tapi primary-nya violet sehingga tidak bentrok. Primary kita biru (img23). Kalau status lamaran juga biru, badge dan tombol saling meminjam arti.

Maka:

| Peran | Warna | Dipakai untuk |
|---|---|---|
| Interaktif | **biru** | tombol primer, link, checkbox aktif, tab aktif, fokus ring |
| Berhasil / terisi | **hijau** | field terisi, status Offer, toast sukses |
| Perlu perhatian | **amber** | field tidak dikenali, peringatan |
| Merusak / ditolak | **rose** | hapus, status Rejected |
| Sedang berjalan | **violet** | status Interviewing |
| Netral | **slate** | status Applied, field dilewati |

**Status Applied sengaja netral**, bukan biru. Applied adalah keadaan default sebuah lamaran — mayoritas baris akan berstatus ini, dan mewarnainya biru membuat daftar penuh warna aksi yang tidak bisa diklik.

### D3 — Truncation punya aturan tetap

| Konteks | Aturan |
|---|---|
| Judul halaman di site header (panel) | 1 baris, ellipsis, `title` attribute penuh |
| Label field | 1 baris, ellipsis |
| Value field | 1 baris, ellipsis, klik untuk lihat penuh |
| Judul lowongan (list) | 2 baris, lalu ellipsis |
| Nama perusahaan | 1 baris |
| Deskripsi pengalaman (kartu collapsed) | 2 baris |

Tooltip hanya untuk teks yang benar-benar terpotong, tidak selalu. Di panel, tooltip yang lebih lebar dari 400px keluar layar — pakai expand inline, bukan tooltip.

### D4 — Dark mode: siap secara struktur, nilainya belum ditulis

Semua komponen membaca token semantik (`--surface`, `--text-primary`), tidak pernah hex langsung. Menambah dark mode nanti = menambah satu blok `@media (prefers-color-scheme: dark)` yang mengganti nilai, tanpa menyentuh satu pun komponen.

Tapi **nilai dark-nya belum ditulis di v1**, dan itu disengaja: keempat referensi terang semua, jadi mengarang palet gelap sekarang berarti menebak. Yang mahal bukan menulis nilainya nanti — yang mahal adalah kalau komponen sudah terlanjur hardcode warna. Itu yang dicegah sekarang.

*Konsekuensi jujur:* panel akan terasa terang menempel di Chrome yang gelap. Ini diterima untuk v1 dan masuk daftar yang harus diselesaikan sebelum publish ke Web Store.

**Amandemen 2026-09-03 — penundaan ini tidak berlaku untuk rilis Safari.** Di Safari 26 / macOS 26 konsekuensi di atas lebih berat, bukan sama beratnya, karena permukaan extension menempel lebih rapat ke material jendela. Jadi: penundaan tetap benar untuk v1 Chrome, dan **gugur sebagai syarat rilis Safari** (`docs/adr-safari.md` §S4).

Yang perlu ditekankan: amandemen ini tidak membatalkan D4, justru menagih hasilnya. Karena aturan §5 poin 1 ditegakkan sejak awal — tidak ada komponen yang menyebut palet mentah — menulis nilai dark sekarang tetap satu blok `@media`, bukan penulisan ulang. Itulah yang dibeli oleh penundaan yang disengaja.

### D5 — Type di 400px: floor 12px

| Ukuran | Boleh untuk |
|---|---|
| 12px | meta, caption, count — **tidak pernah** untuk isi yang harus dibaca |
| 13px | body panel, label field, value field |
| 15px | judul kartu / section di panel |
| 17px | judul utama panel |

Options page naik satu tingkat: body 14px, judul 16/20/28.

**Font: system stack, tanpa webfont.** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif`. Alasannya bukan performa — panel menempel di chrome browser, dan font sistem membuatnya terasa bagian dari browser, bukan halaman web yang ditempelkan. Ini juga menghapus flash font dan satu request dari extension.

---

## 3. Token

### 3.1 Palet mentah

```css
/* Biru — aksi (karakter img23) */
--blue-50:  #EFF4FF;
--blue-100: #DBE6FE;
--blue-200: #BFD3FE;
--blue-400: #5B8DEF;
--blue-500: #3B76F0;
--blue-600: #2563EB;   /* primary */
--blue-700: #1D4FD7;   /* hover */
--blue-800: #1A41B0;   /* pressed */

/* Netral — ground & teks (karakter img22) */
--neutral-0:   #FFFFFF;
--neutral-25:  #FBFCFD;
--neutral-50:  #F6F8FA;   /* ground options page */
--neutral-100: #F0F2F6;   /* track segmented, hover */
--neutral-200: #E4E7EC;   /* border */
--neutral-300: #D0D5DD;   /* border kuat, input */
--neutral-400: #98A2B3;   /* teks tersier — meta saja */
--neutral-500: #667085;
--neutral-600: #475467;   /* teks sekunder */
--neutral-900: #101828;   /* teks utama */

/* Status */
--green-50:  #ECFDF3;  --green-600: #039855;  --green-700: #027A48;
--amber-50:  #FFFAEB;  --amber-600: #DC6803;  --amber-700: #B54708;
--rose-50:   #FEF3F2;  --rose-600:  #D92D20;  --rose-700:  #B42318;
--violet-50: #F4F3FF;  --violet-600:#6938EF;  --violet-700:#5925DC;
--slate-50:  #F2F4F7;  --slate-600: #475467;
```

### 3.2 Kontras yang sudah dicek

Semua pasangan yang membawa arti, terhadap ground-nya masing-masing:

| Pasangan | Rasio | Lolos |
|---|---|---|
| `neutral-900` di `neutral-0` | 17.75:1 | AAA |
| `neutral-900` di `neutral-50` | 16.67:1 | AAA |
| `neutral-600` di `neutral-0` | 7.69:1 | AAA |
| `neutral-600` di `neutral-50` | 7.22:1 | AAA |
| `neutral-400` di `neutral-0` | 2.58:1 | **gagal** — hanya untuk meta non-esensial, tidak pernah untuk isi |
| `neutral-0` di `blue-600` | 5.17:1 | AA |
| `blue-600` di `neutral-0` | 5.17:1 | AA |
| `blue-700` di `blue-50` | 6.05:1 | AA |
| `green-700` di `green-50` | 5.13:1 | AA |
| `amber-700` di `amber-50` | 5.20:1 | AA |
| `rose-700` di `rose-50` | 6.05:1 | AA |
| `violet-700` di `violet-50` | 7.02:1 | AAA |
| `slate-600` di `slate-50` | 6.98:1 | AAA |
| `blue-500` (fokus ring) di `neutral-0` | 4.17:1 | AA non-teks (butuh 3:1) |
| `neutral-300` (border input) di `neutral-0` | 1.47:1 | batas kontrol — lihat catatan |

Dua catatan yang penting dan sering dilanggar diam-diam:

- **`neutral-400` gagal 4.5:1 dan itu disengaja.** Boleh untuk timestamp, count, placeholder dekoratif. Dilarang untuk label field, value, dan pesan error. Ini yang bikin img22 cantik tapi susah dibaca — kita ambil kesannya, bukan bugnya.
- **Border input `neutral-300` hanya 1.47:1**, jauh di bawah 3:1 yang diminta WCAG 1.4.11 untuk batas kontrol. Diselesaikan bukan dengan menggelapkan garis (merusak kesan lapang img22), tapi dengan **ground input `neutral-25` yang berbeda dari kartu putih** — jadi batas field ditandai oleh perbedaan bidang, bukan cuma oleh garis. Fokus ring `blue-500` memberi batas 4.17:1 saat aktif, di atas ambang 3:1.
  **Ini tetap deviasi terbuka**: perbedaan bidang `neutral-25` vs `neutral-0` sendiri sangat tipis, jadi field yang tidak sedang fokus dibatasi oleh sesuatu yang di bawah ambang. Alternatifnya menggelapkan border ke `neutral-400` (2.58:1, masih gagal) atau `neutral-500` (5.2:1, lolos tapi berat). Diputuskan saat mockup, di layar sungguhan.

Rasio di atas dihitung dari nilai hex di §3.1 dengan rumus WCAG 2.x relative luminance, bukan diperkirakan. Kalau ada nilai yang diganti (mis. hex biru asli img23), rasio pasangannya harus dihitung ulang.

### 3.3 Token semantik

Ini yang dipakai komponen. Tidak ada komponen yang boleh menyebut `--blue-600` langsung.

```css
--surface:            var(--neutral-0);
--surface-sunken:     var(--neutral-50);   /* ground options page */
--surface-subtle:     var(--neutral-100);  /* track, hover */
--surface-input:      var(--neutral-25);
--border:             var(--neutral-200);
--border-strong:      var(--neutral-300);

--text-primary:       var(--neutral-900);
--text-secondary:     var(--neutral-600);
--text-tertiary:      var(--neutral-400);  /* meta saja — lihat §3.2 */
--text-on-accent:     var(--neutral-0);

--accent:             var(--blue-600);
--accent-hover:       var(--blue-700);
--accent-pressed:     var(--blue-800);
--accent-wash:        var(--blue-50);
--focus-ring:         var(--blue-500);

--status-success-fg:  var(--green-700);   --status-success-bg:  var(--green-50);
--status-warning-fg:  var(--amber-700);   --status-warning-bg:  var(--amber-50);
--status-danger-fg:   var(--rose-700);    --status-danger-bg:   var(--rose-50);
--status-progress-fg: var(--violet-700);  --status-progress-bg: var(--violet-50);
--status-neutral-fg:  var(--slate-600);   --status-neutral-bg:  var(--slate-50);
```

### 3.4 Spacing, radius, bayangan

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 20px;  --space-6: 24px;  --space-8: 32px;  --space-10: 40px;

--radius-sm:   6px;    /* chip, badge */
--radius-md:   8px;    /* input, select */
--radius-lg:   10px;   /* button */
--radius-xl:   14px;   /* card */
--radius-full: 999px;  /* segmented track, dot */

--shadow-sm: 0 1px 2px rgba(16,24,40,.05);
--shadow-md: 0 2px 8px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04);
--shadow-lg: 0 12px 32px rgba(16,24,40,.10);   /* slide-over, dialog */
```

Radius kartu 14px sengaja besar — itu yang bikin img22 terasa lapang. Tapi di panel 400px kartu bertumpuk rapat, jadi radius besar + border tipis, **tanpa** bayangan; bayangan berlapis di ruang sempit bikin kotor.

### 3.5 Gerak

```css
--ease:        cubic-bezier(.2,.8,.2,1);
--dur-fast:    120ms;   /* hover, fokus */
--dur-base:    200ms;   /* section muncul, chip aktif */
--dur-slow:    280ms;   /* slide-over */
```

Semua transisi dimatikan di bawah `prefers-reduced-motion: reduce`.

---

## 4. Komponen

Hanya yang ada di `screens.md` §4. Detail visual tiap varian ada di `design-system.html`.

### 4.1 Tab switcher — tab folder (diputuskan 2026-09-02)

Dipilih dari referensi img20 versi penuh, dan bentuknya **bukan segmented control**:

- Rak `--surface-subtle`, radius atas `--radius-lg`, sudut bawah siku.
- Tab aktif berbidang `--surface` — **warna yang sama dengan badan panel di bawahnya**, tanpa garis pemisah di antaranya, sehingga tab dan isinya terbaca sebagai satu lembar.
- Tab non-aktif transparan, jadi rak abu terlihat di belakangnya.
- Penanda aktif: garis 3px `--accent` di bawah label, **selebar teks**, bukan selebar tab.
- Label aktif `--text-primary` bobot 700; non-aktif `--text-secondary` bobot 550.

**Kenapa putih dan underline boleh bersamaan di sini.** Versi awal dokumen ini menulis aturan "jangan gabungkan chip putih dan underline — itu menandai satu hal dua kali", dan aturan itu benar untuk segmented control. Di pola ini keduanya menandai hal berbeda: **bidang putih menyatakan kelanjutan permukaan** (tab ini adalah lembar yang sedang dibaca), **underline menyatakan pilihan aktif**. Hilangkan salah satunya dan yang hilang bukan pengulangan, tapi separuh informasinya.

Konsekuensi struktural: `.panel-head` **tidak boleh punya `border-bottom`**. Satu garis di situ memutus sambungan bidang, dan polanya langsung jatuh jadi segmented control biasa.

Pola ini menampung tab ketiga (`Match`, PRD §11) tanpa berubah bentuk — tiap tab tetap punya bidang sendiri, dan underline menyempit mengikuti labelnya.

Garis aktif memakai `--accent`, bukan tinta hitam seperti di referensi, mengikuti D2: penanda state pada sebuah kontrol adalah hal interaktif.

### 4.2 Field preview row — komponen terpenting

Muncul di 5 dari 8 state panel (`screens.md` §2.2). Anatominya:

```
[x]  Email                          badge
     nama@example.test
```

- checkbox `--accent` saat tercentang
- label `13px` `--text-secondary`, 1 baris ellipsis
- value `13px` `--text-primary`, 1 baris ellipsis, klik untuk expand
- badge di kanan hanya muncul jika bukan keadaan normal

Empat status baris, memakai bahasa D2:

| Status | Tampilan |
|---|---|
| siap diisi | tanpa badge, checkbox tercentang |
| terisi | badge hijau "Terisi", checkbox jadi ikon centang |
| tidak dikenali | badge amber "Tidak dikenali" + tombol "Petakan" |
| dilewati | teks meredup, checkbox kosong |

Tinggi baris 44px dengan value, 36px tanpa. Ini yang menentukan berapa field muat sebelum scroll.

### 4.3 Sisanya

| Komponen | Catatan penting |
|---|---|
| Button primary | `--accent`, teks putih, radius 10px. Gradasi sangat halus (`--accent` → `--accent-hover`) mengikuti img21, hanya untuk tombol primer penuh-lebar di footer panel |
| Button secondary | Ground putih, border `--border-strong`, teks `--text-primary` |
| Button ghost | Transparan, hover `--surface-subtle` |
| Button destructive | Teks `--status-danger-fg`, ground `--status-danger-bg` |
| Text input | Ground `--surface-input`, border `--border`, fokus ring 2px `--focus-ring` + border `--accent` |
| Status badge | Pasangan fg/bg dari §3.3, radius 6px, 12px semibold, padding 2/8 |
| Empty state | Ikon 40px dalam lingkaran `--surface-subtle`, judul 15px, body 13px `--text-secondary`, aksi opsional |
| Card | Ground putih, border `--border`, radius 14px. Bayangan **hanya** di options page |
| Entry card | Collapsed: ikon lingkaran + 3 baris (judul / sub / tanggal), mengikuti img21. Expanded jadi form |
| Sticky action footer | Ground putih, border-top `--border`, padding 12px, tombol penuh-lebar. **Wajib di panel** — tombol Fill tidak boleh perlu di-scroll |
| Site header | Favicon 16px + domain `--text-secondary` + judul halaman `--text-primary` 1 baris |
| Summary bar | Satu baris: "9 dari 12 field cocok" + bar progres 4px, ground `--accent-wash` |
| Slide-over | Lebar 480px, `--shadow-lg`, hanya options page |
| Confirm dialog | Destructive butuh input konfirmasi, bukan cuma OK (`screens.md` D4) |

### 4.4 Komponen Lamaran (revisi 2026-10-15, T40)

Preview: `design-system.html` §9. Delapan komponen baru di atas komponen §4.3 (tidak ada tampilan Daftar: keputusan PIC 2026-10-15; halaman Lamaran punya satu penukar tampilan, Papan / Visualisasi); sisanya (kartu, badge, chip, tombol, alert, tab folder, empty state, `.why`, `.summary`, `.jobrow`, `.fchip`, `.inp`) dipakai ulang tanpa perubahan.

**Pengecualian terhadap `screens.md` §4.4:** daftar "yang tidak dibuat" menyebut **Kanban board**. Untuk Lamaran, papan dibuat (PRD §6.8), dibatasi lima kolom, dengan seret-lepas bawaan browser (diputuskan PIC 2026-10-15): kolom yang disorot memakai garis putus `--accent` dan `--accent-wash` (boleh biru karena bisa dilepasi), kartu yang diseret `opacity-50`, kolom kosong tetap tampil selagi menyeret, dan Ditolak serta Dibatalkan muncul sebagai dua target selagi menyeret. Yang tetap tidak dibuat: avatar group, grafik, bell notifikasi, command palette, modal bertumpuk, carousel, editor teks kaya, date range picker, pagination.

| Komponen | Catatan penting |
|---|---|
| Kolom dan kartu papan (`.board`, `.kcol`, `.kcard`) | Lima kolom sama lebar; kolom berlatar `--surface-subtle`, kartu putih berborder, radius 10px, tanpa bayangan. Judul maks 2 baris (D3), perusahaan 1 baris ellipsis. Kartu yang butuh perhatian: border `--status-warning-fg` dan badge amber, bukan biru. Ditolak dan Dibatalkan dilipat di bawah papan. ≤420 px: satu kolom per status, kolom kosong disembunyikan |
| Visualisasi alur (`.sankey-svg`, `.flist`) | Diagram Sankey SVG di dalam kartu "Pencarian kerjamu": simpul batang 12px, pita kurva Bézier berlebar sebanding jumlah, `fill-opacity` .22. Warna pita mengikuti simpul tujuannya lewat token status: Direview/Masih berjalan `--status-progress-fg`, Interview `--status-warning-fg`, Offer `--status-success-fg`, Ditolak `--status-danger-fg`, Tanpa kabar `--text-secondary`. Label 12px tebal; angka `--text-secondary`. Di ≤600 px (atau `.opt.narrow`) diganti `.flist`: satu baris per simpul (label, batang 8px, angka), karena teks Sankey tidak terbaca di bawah ±600 px. Setiap pita punya `<title>`; diagram punya `role="img"` dengan `aria-label` ringkas |
| Penukar tampilan (`.vtoggle`) | Dua tombol segmented di kanan atas header Lamaran (Papan, Visualisasi), ikon + teks; yang aktif `--accent-wash` dengan teks `--accent` (bisa diklik, jadi biru sah, D2). Hanya untuk berganti cara melihat data yang sama; bukan navigasi antar halaman (itu tab folder §4.1). ≤420 px pindah ke bawah judul |
| Penanda dokumen (`.dchip`) | Ikon berkas 12px + "CV" atau "Surat". `ok` hijau bila dokumen ada, netral bila belum. Bukan tombol |
| Baris langkah (`.tick` di `.srow`) | Lingkaran 24px: hijau dengan centang = selesai, garis `--accent` = langkah berikutnya, kosong = belum. Dipakai di Ringkasan "Siap melamar" |
| Panel diff (`.diff`, `.dpane`, `.dsec`) | Dua panel sejajar (Asli, Disesuaikan), satu kolom di ≤900 px. Tambahan `ins.add` hijau (`--status-success-*`); bagian yang diganti `del.rm` dicoret `--text-secondary`. **Merah tidak dipakai**: rose berarti gagal atau ditolak. Penanda Tervalidasi (`.badge.ok` + ikon perisai) di judul panel Disesuaikan |
| Editor surat (`.inp.area`) | `.inp` biasa dengan `min-height` 300px, `line-height` 1.65. Tanpa toolbar format. Di bawahnya baris meta (jumlah kata, Salin, Buat ulang, Kembalikan) |
| Riwayat (`.tl`) | Daftar vertikal titik 20px dengan garis penghubung 2px. Titik hijau untuk hasil berhasil, violet untuk Direview, abu untuk lainnya. Tanggal rata kanan, `font-variant-numeric: tabular-nums` |

Peta badge status lamaran (tetap): Draft `dim` · Dilamar `ok` · Direview `prog` · Interview `warn` · Offer `ok` · Ditolak `bad` · Dibatalkan `dim`. Dilamar dan Offer sama-sama hijau; teks badge dan kolomnya yang membedakan, bukan warna (D2: warna tidak membawa arti sendirian).

---

## 5. Aturan yang tidak boleh dilanggar

1. **Komponen tidak menyebut palet mentah.** Hanya token semantik §3.3. Ini yang bikin dark mode nanti jadi satu blok, bukan penulisan ulang.
2. **Biru bukan warna status.** Kalau sesuatu biru, itu bisa diklik (D2).
3. **`--text-tertiary` tidak pernah membawa arti.** Gagal 4.5:1 (§3.2).
4. **Panel tidak pernah scroll horizontal.** Semua teks panjang tunduk ke aturan D3.
5. **Bayangan tidak dipakai di panel.** Kartu dibedakan oleh border.
6. **Komponen di luar `screens.md` §4 tidak dibuat**, walau ada di referensi. Pengecualian terdaftar: delapan komponen Lamaran di §4.4 (T40).
7. **Diff tidak pernah merah.** Tambahan hijau, bagian yang diganti dicoret abu. Merah hanya untuk gagal atau ditolak.
8. **Hasil AI selalu bertanda.** CV dan surat tampil dengan penanda Tervalidasi, atau tidak tampil dan menyebut sebabnya.
9. **Tombol nonaktif menyebut alasannya** di atas tombol itu (kunci kosong, batas harian, profil kosong).

---

## 6. Yang masih terbuka

1. ~~Varian tab~~ — **selesai 2026-09-02**, tab folder (§4.1).
2. **Hex biru asli img23.** Kalau kamu punya, tukar `--blue-600` dan turunannya; sisanya ikut, tapi §3.2 harus dihitung ulang.
3. **Nilai dark mode** (D4) — ditunda sadar, bukan lupa. **Sudah punya tenggat sekarang:** wajib selesai sebelum rilis Safari (`adr-safari.md` §S4), tidak wajib untuk v1 Chrome.
4. **Ikonografi.** Belum diputuskan set-nya (Lucide / Phosphor / lainnya). Menentukan rasa, dan img21 memakai ikon garis 1.5px yang cocok dengan arah ini.

---

## 7. Berikutnya

Mockup per permukaan (`prd.md` §14 langkah 4), dibaca dari file ini + `screens.md`:

1. Side panel 400px — A2/A3 dulu karena paling padat, lalu A5, A6, A7
2. Options page — Profile → Work Experience (bentuk B paling rumit), lalu Captured Jobs J2/J4, lalu Data D2

Mulai dari layar terpadat, bukan dari layar termudah. Kalau A3 muat dan terbaca di 400px, sisanya pasti muat.
