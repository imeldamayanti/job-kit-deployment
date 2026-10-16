# T45: ringkasan angka

Run: 2026-10-15T08:12:43.649Z

| Model | Mode | Hasil | Gagal panggil/parse | Hasil dengan ≥1 pelanggaran | Pelanggaran (skill/sumber/angka/istilah/cakupan) | Token masuk | Token keluar | Detik | Biaya berbayar/CV |
|---|---|---|---|---|---|---|---|---|---|
| gemini-3.5-flash-lite | 1 panggilan | 9 | 0 | 1/9 | 0/0/0/0/4 | 763 | 258 | 5.8 | $0.00087 |
| gemini-3.5-flash-lite | 2 panggilan | 9 | 0 | 0/9 | 0/0/0/0/0 | 821 | 198 | 9.5 | $0.00074 |
| gemini-3.6-flash | 1 panggilan | 9 | 0 | 0/9 | 0/0/0/0/0 | 763 | 360 | 16.4 | $0.00192 |
| gemini-3.6-flash | 2 panggilan | 9 | 5 | 0/4 | 0/0/0/0/0 | 922 | 441 | 19.7 | $0.00235 |

Lolos tanpa pemeriksa fakta = semua hasil yang berhasil di-parse (pengguna melihat semuanya). Lolos dengan pemeriksa = hasil dengan 0 pelanggaran mekanis; sisanya ditolak. Klaim semantik ("memimpin", "mengelola") tidak terlihat mesin dan dinilai PIC di ratings.md.

## Pelanggaran per hasil

- gemini-3.5-flash-lite / one / A×J2: coverage:javascript, coverage:python, coverage:php, coverage:ruby
- gemini-3.6-flash / two / B×J2: ERROR HTTP 429 rate limited after retries
- gemini-3.6-flash / two / B×J3: ERROR HTTP 429 rate limited after retries
- gemini-3.6-flash / two / C×J1: ERROR HTTP 429 rate limited after retries
- gemini-3.6-flash / two / C×J2: ERROR HTTP 429 rate limited after retries
- gemini-3.6-flash / two / C×J3: ERROR HTTP 429 rate limited after retries
