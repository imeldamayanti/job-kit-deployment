# Akun Wajib, Kredit AI, dan Pembayaran QRIS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pengguna masuk dengan email, mendapat 3 kredit percobaan, membeli paket 50 kredit seharga Rp10.800 lewat QRIS yang dicek otomatis, dan memakai CV, surat, serta skor AI lewat server PIC.

**Architecture:** Supabase penuh. Saldo dan pembayaran di Postgres, diubah hanya oleh fungsi `security definer` yang dipanggil Edge Functions memakai `service_role`. Logika server ditulis sebagai TypeScript murni di `src/server/` (port disuntik, dites dengan vitest) dan dibundel esbuild ke Edge Functions Deno, jadi prompt dan pemeriksa fakta hanya punya satu sumber di `src/core/`. Extension memanggil `generate` dengan payload tersamar, bukan prompt.

**Tech Stack:** WXT 0.21.4 + React 19.3, TypeScript 7.0.2, vitest 5.0.3, Supabase (Postgres, Auth OTP, Edge Functions Deno, pg_cron), Midtrans QRIS, DeepSeek lewat endpoint OpenAI-compatible, esbuild (sudah terpasang lewat vite), `@electric-sql/pglite` (baru, devDependency) untuk menguji fungsi SQL.

**Spec:** `docs/superpowers/specs/2026-11-19-monetisasi-design.md` (disetujui PIC 2026-11-19). Tiket proyek: `docs/plan.md` T56–T63.

## Global Constraints

- Paket `basic`: `price_idr = 10800`, `credits = 50`. Harga yang tampil = jumlah yang dibayar. Tidak ada teks "biaya admin" di mana pun (PBI 23/2021 Pasal 52 ayat 1).
- Tarif: CV 1 kredit, surat 1 kredit, skor 10 lowongan 1 kredit. Ambil lowongan gratis. Feed harian tidak pernah memanggil AI; skor AI hanya dari tombol "Nilai dengan AI".
- Kredit percobaan: 3, sekali per akun, kuota global 30 akun per hari (zona `Asia/Jakarta`).
- Kedaluwarsa: `credits_expire_at = now() + interval '1 year'` saat pembelian dan saat percobaan diberikan; penanda 30 hari sebelum hangus.
- Kredit dikembalikan untuk: error model, balasan tidak terbaca, ditolak pemeriksa fakta, CV jatuh ke isi Profile (`fallback`), dan generasi `reserved` > 10 menit.
- QR berlaku 30 menit. Extension mengecek status tiap 3 detik.
- Batas server: payload ≤ 60.000 karakter; 30 generate per jam per akun; plafon bulanan dari secret `MONTHLY_AI_BUDGET_USD`.
- Server tidak pernah menyimpan atau me-log prompt, payload, atau hasil.
- Rahasia hanya di secrets Supabase: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_PRICE_IN`, `AI_PRICE_OUT`, `MONTHLY_AI_BUDGET_USD`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_MODE`. Model awal `deepseek-v4.1-flash` (bukan varian `-mod`).
- Build pengguna (`npm run build`) = AI lewat server. `WXT_AI_MODE=byok` = jalur kunci sendiri (build pengembang). `WXT_SHARE_BUILD=true` = AI mati.
- Konvensi repo: `core/` TS murni, `platform/` satu-satunya pemanggil `browser.*` (RFC D4); impor eksplisit; tanpa library state global; Tailwind token saja; ikon `lucide-react`; tes ditulis lebih dulu; komentar kode berbahasa Inggris, teks UI berbahasa Indonesia.
- Commit tanpa trailer Co-Authored-By dan tanpa footer Claude (memori PIC).

## Review Focus

1. **Dua generate bersamaan dengan saldo 1** (dua tab menekan Buat CV): tepat satu berjalan, yang lain mendapat `insufficient` tanpa saldo minus. Tes di Task 1.
2. **Notifikasi Midtrans datang berulang, terlambat, atau untuk pembelian yang sudah `expired`**: kredit masuk paling banyak sekali; `PAID` setelah `expired` tetap dikreditkan (uang sudah masuk). Tes di Task 1 dan Task 4.
3. **Sesi login habis di tengah generate** (token kedaluwarsa, refresh gagal): server menolak sebelum `reserve_credits`, saldo utuh, extension meminta masuk lagi tanpa menghapus data lokal. Tes di Task 3 dan Task 7.
4. **Pemeriksa fakta server (ruang tersamar) lolos, tetapi pemeriksa extension (setelah nama dipulihkan) menolak**: kredit sudah terpotong untuk hasil yang tidak diterima. Tes kesetaraan kedua pemeriksa pada `SAMPLE_PROFILES` di Task 2.
5. **Saldo lewat `credits_expire_at` sebelum `expire_credits` harian jalan**: `reserve_credits` tetap menolak dengan `expired`. Tes di Task 1.

---

## Task 0: Mockup akun, preview, dan beli kredit (T56)

**Files:**
- Modify: `docs/design-system.html` (bagian baru §10), `docs/design-system.md` (komponen baru di §4.4)

**Interfaces:**
- Produces: copy UI final yang dipakai Task 7–9, yaitu label tombol, pesan kasus kredit (desain §6), dan teks modal beli.

- [ ] **Step 1:** Tambah §10 di `design-system.html` dengan frame berikut, lebar ≤ 420 px untuk panel: preview options + panel (data contoh, aksi nonaktif, "Masuk untuk memakai"); masuk (email, kode, salah kode, kode kedaluwarsa); sidebar dengan saldo, item percobaan, item percobaan habis dengan ajakan "Beli kredit" (halaman tetap terbuka, tanpa gembok atau badge; hanya AI yang berhenti, keputusan PIC 2026-11-19), penanda hangus; sesi habis (gerbang masuk dengan pesan sesi habis, data tidak hilang); tombol AI "Buat CV · 1 kredit" dengan state saldo kurang, plafon, batas laju, offline; modal beli (QR, "Rp10.800", "50 kredit ≈ 25 CV + 25 surat", "Sudah termasuk semua biaya", hitung mundur, menunggu, berhasil, kedaluwarsa, gagal membuat QR); halaman Akun (saldo, tanggal hangus, riwayat kredit, hapus akun); tombol "Nilai dengan AI · 1 kredit" di halaman Lowongan.
- [ ] **Step 2:** Cek di browser pada viewport 424 px: tidak ada overflow horizontal, dan tidak ada kata "admin" di §10 (`grep -c "admin" docs/design-system.html` tidak bertambah).
- [ ] **Step 3:** Minta persetujuan PIC. Task 7–9 tidak dimulai sebelum disetujui.
- [ ] **Step 4: Commit** `docs(design): mockup akun, preview, dan beli kredit`

---

## Task 1: Skema kredit di Postgres (T57)

**Files:**
- Create: `supabase/billing.sql`, `supabase/billing-cron.sql`, `supabase/test/auth-stub.sql`
- Test: `src/core/billing/sql.test.ts` (teks, pola `src/core/sync/sql.test.ts`), `src/core/billing/billing-db.test.ts` (pglite)
- Modify: `package.json` (devDependency `@electric-sql/pglite`), `supabase/README.md` (urutan menjalankan SQL)

**Interfaces:**
- Produces (semua `security definer`, `set search_path = ''`; execute hanya untuk `service_role` kecuali disebut):
  - `public.ensure_account() returns public.accounts`: execute untuk `authenticated`, memakai `auth.uid()`
  - `public.reserve_credits(p_user uuid, p_kind text, p_cost int) returns uuid`: raise `'insufficient'` atau `'expired'` (SQLSTATE `P0001`, pesan persis kata itu)
  - `public.settle_generation(p_id uuid, p_ok boolean, p_refund_reason text, p_model text, p_in int, p_out int, p_cost numeric) returns int`: saldo baru
  - `public.ai_guard(p_user uuid, p_budget_usd numeric, p_rate int) returns text`: `'ok' | 'budget' | 'rate-limit'`
  - `public.create_purchase(p_user uuid, p_package text) returns public.purchases`: pending yang masih berlaku, atau yang baru
  - `public.attach_gateway(p_purchase uuid, p_reference text, p_qr_url text) returns void`
  - `public.apply_payment(p_purchase uuid, p_reference text, p_status text, p_amount int) returns text`: status akhir
  - `public.expire_credits() returns int`, `public.reap_reserved() returns int`: jumlah akun atau generasi yang tersentuh
- Tabel dan kolom persis seperti desain §5.3, plus `accounts.trial_granted_at`, `accounts.credits_expire_at`, dan `credit_ledger.reason` yang juga menerima `'trial'` dan `'expire'`. Seed `packages`: `('basic', 10800, 50, true)`.

- [ ] **Step 1: Pasang pglite**

Run: `npm i -D @electric-sql/pglite@0.2.17`
Expected: `package.json` memuat versi persis itu.

- [ ] **Step 2: Tulis `supabase/test/auth-stub.sql`** berisi schema `auth`, `auth.users(id uuid primary key)`, `auth.uid()` yang membaca `current_setting('request.jwt.claim.sub', true)::uuid`, dan role `anon`, `authenticated`, `service_role` (`create role ... nologin` bila belum ada). File ini hanya untuk tes.

- [ ] **Step 3: Tulis tes yang gagal di `billing-db.test.ts`** (`// @vitest-environment node`). Setiap tes membuat `PGlite` baru, menjalankan auth-stub lalu `billing.sql`, dan menyisipkan user uji.

```ts
it('gives 3 trial credits once, expiring in a year', async () => {
  // set request.jwt.claim.sub = user; select ensure_account() twice
  expect(acct.credits).toBe(3)
  expect(ledgerRows.filter(r => r.reason === 'trial')).toHaveLength(1)
  expect(daysBetween(acct.credits_expire_at, now)).toBeCloseTo(365, 0)
})
it('stops granting trials after 30 accounts in one Jakarta day', ...)      // akun ke-31: credits 0, trial_granted_at null
it('reserves under a row lock: balance 1, two reserves → one insufficient', ...) // Promise.allSettled dua koneksi; saldo akhir 0, tidak minus
it('rejects reserve when credits_expire_at has passed', ...)               // error message 'expired'
it('settle ok keeps the charge; settle fail refunds once even if called twice', ...)
it('apply_payment PAID credits 50, sets unlocked_at and expiry, and is idempotent', ...)
it('apply_payment with a different amount marks mismatch and adds nothing', ...)
it('apply_payment PAID after expired still credits (money already received)', ...)
it('create_purchase returns the same pending purchase while it is still valid', ...)
it('a purchase extends the expiry of the whole balance to now + 1 year', ...)
it('expire_credits zeroes overdue balances with an expire ledger row', ...)
it('reap_reserved refunds generations reserved more than 10 minutes ago', ...)
it('ledger sum always equals accounts.credits after every scenario', ...)  // dijalankan di afterEach
it('ai_guard returns budget when month cost_usd >= budget, rate-limit at 30 in the last hour', ...)
it('deleting the auth user removes accounts and nulls user_id elsewhere', ...)
```

Tulis juga `sql.test.ts`: RLS menyala di kelima tabel; hanya ada policy `for select` dengan `(select auth.uid()) = user_id` (`packages`: `using (true)` untuk `select` saja); tidak ada `grant insert|update|delete` untuk `anon` atau `authenticated`; setiap fungsi kecuali `ensure_account` di-`revoke ... from public, anon, authenticated` dan di-`grant execute ... to service_role`; tidak ada kata `admin` di harga; `10800` dan `50` ada di seed.

- [ ] **Step 4: Jalankan, pastikan gagal**

Run: `npx vitest run src/core/billing`
Expected: FAIL karena `supabase/billing.sql` belum ada.

- [ ] **Step 5: Tulis `supabase/billing.sql`** sampai semua tes lulus. Keputusan yang sudah diambil:
- `reserve_credits` memakai `select ... from public.accounts where user_id = p_user for update`.
- `apply_payment` hanya mengubah baris `pending` atau `expired`. Pembelian `paid` mengembalikan `'paid'` tanpa efek. Jumlah yang beda dari `purchases.amount_idr` menghasilkan `mismatch`.
- `settle_generation` hanya mengubah generasi `reserved`.
- Kuota percobaan menghitung `trial_granted_at` pada tanggal `now() at time zone 'Asia/Jakarta'` yang sama.
- Pola trigger dan `delete_account()` mengikuti `supabase/sync.sql`.

- [ ] **Step 6: Tulis `supabase/billing-cron.sql`**: `cron.schedule('reap-reserved', '*/5 * * * *', 'select public.reap_reserved()')` dan `cron.schedule('expire-credits', '15 17 * * *', 'select public.expire_credits()')` (00:15 WIB). File ini tidak dites di pglite.

- [ ] **Step 7: Jalankan tes**

Run: `npx vitest run src/core/billing`
Expected: PASS.

- [ ] **Step 8:** Tambah langkah di `supabase/README.md`: jalankan `billing.sql` lalu `billing-cron.sql` di SQL editor (nyalakan ekstensi `pg_cron` dulu), kemudian cek `select * from public.packages`.

- [ ] **Step 9: Commit** `feat(billing): tabel kredit, pembelian, dan fungsi saldo di Supabase`

---

## Task 2: Protokol generate dan pemeriksa di ruang tersamar (core)

**Files:**
- Create: `src/core/generate/protocol.ts`, `src/core/generate/pseudo-profile.ts`
- Modify: `src/core/ai/score.ts` (ekspor `SCORE_SYSTEM`, `scorePrompt`, tipe `ScoreJob`), `src/core/tailor/pipeline.ts`, `src/core/letters/pipeline.ts`
- Test: `src/core/generate/protocol.test.ts`, `src/core/generate/pseudo-profile.test.ts`, tambahan di `src/core/tailor/pipeline.test.ts`, `src/core/letters/pipeline.test.ts`, `src/core/ai/score.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // protocol.ts
  export const CREDIT_COST = { cv: 1, letter: 1, score: 1 } as const
  export const SCORE_BATCH = 10
  export const MAX_PAYLOAD_CHARS = 60_000
  export type ScoreJob = Pick<Job, 'id'|'title'|'company'|'location'|'workplace'|'level'|'contract'|'salary'|'experience'|'description'>
  export type CvRequest = { kind: 'cv'; job: { title: string; description: string }; payload: CvPayload }
  export type LetterRequest = { kind: 'letter'; job: { title: string; company: string; description: string }; payload: CvPayload; lang: Lang; tone: Tone }
  export type ScoreRequest = { kind: 'score'; summary: ProfileSummary; jobs: ScoreJob[] }
  export type GenerateRequest = CvRequest | LetterRequest | ScoreRequest
  export type GenerateError = 'unauthenticated'|'insufficient'|'expired'|'budget'|'rate-limit'|'invalid-request'|'ai'|'unreadable'|'ungrounded'
  export type GenerateResponse =
    | { ok: true; kind: 'cv'|'letter'; text: string; fallback: boolean; credits: number; usage: AiUsage }
    | { ok: true; kind: 'score'; results: ScoreResult[]; credits: number; usage: AiUsage }
    | { ok: false; error: GenerateError; message: string; credits: number | null; violations?: Violation[] }
  export function validateRequest(body: unknown): { ok: true; request: GenerateRequest } | { ok: false; message: string }
  export class RemoteRefusal extends Error { constructor(public code: GenerateError, message: string, public violations?: Violation[]) }
  export type RemoteDocument = (request: CvRequest | LetterRequest) => Promise<{ text: string; usage: AiUsage }>  // throws RemoteRefusal
  export type RemoteScore = (request: ScoreRequest) => Promise<{ results: ScoreResult[]; usage: AiUsage }>    // throws RemoteRefusal
  // pseudo-profile.ts
  export function profileFromPayload(payload: CvPayload): Profile
  ```
- `tailorCv` dan `writeLetter` mendapat opsi `remote?: RemoteDocument`. Bila ada, keduanya memanggil `remote(...)` dan tidak memanggil `client.complete`; sisa rantai (parse, restore, validasi dengan Profile asli, assemble) tetap sama. `TailorFailure.reason` bertambah `'refused'` dengan `refused?: GenerateError`.
- `scoreJobs` mendapat opsi `remote?: RemoteScore`. Bila ada, batch berisi `SCORE_BATCH` dan `remote` dipanggil per batch.

- [ ] **Step 1: Tulis tes yang gagal**
  - `validateRequest`: menolak `kind` tak dikenal, payload > `MAX_PAYLOAD_CHARS` (`JSON.stringify(body).length`), `score` dengan `jobs.length` 0 atau > 10, `lang` di luar `'id'|'en'`; menerima tiga contoh sah.
  - `profileFromPayload`: hasilnya lolos `validateGrounded` untuk output yang hanya memakai skill dan butir payload; menolak skill yang tidak ada di payload; kode `{C1}` di butir tidak dihitung sebagai istilah.
  - **Kesetaraan (Review Focus 4):** untuk tiap `SAMPLE_PROFILES` dan output uji (lolos dan gagal), `validateGrounded(output, profileFromPayload(hidden.payload)).ok === validateGrounded(hidden.restoreOutput(output), profile).ok`. Hal yang sama untuk `validateLetter` pada body sebelum dan sesudah `hidden.restore`.
  - `tailorCv({ remote })`: `client.complete` tidak dipanggil; `remote` menerima `{ kind: 'cv', job, payload }` tanpa nama, email, dan telepon; `RemoteRefusal('insufficient', 'Kredit tidak cukup')` → `{ ok: false, reason: 'refused', refused: 'insufficient' }`.
  - `scoreJobs({ remote, limit: 10 })`: satu panggilan `remote` dengan 10 `ScoreJob`; hasil ditandai bukan kasar.

- [ ] **Step 2: Run** `npx vitest run src/core/generate src/core/tailor src/core/letters src/core/ai`. Expected: FAIL.

- [ ] **Step 3: Implementasi.** `profileFromPayload` mulai dari `createEmptyProfile()`, lalu mengisi `skills` (`{ name }`), `experience` (`id`, `title`, `company`, `description`), dan `education` (`id`, `institution`, `level`, `major`). `batchPrompt` lama menjadi `scorePrompt(summary, jobs: ScoreJob[])` dan `SYSTEM` menjadi `SCORE_SYSTEM`; isinya tidak berubah.

- [ ] **Step 4: Run** perintah yang sama, lalu `npm test`. Expected: semua PASS, termasuk tes lama.

- [ ] **Step 5: Commit** `feat(core): protokol generate dan pemeriksa fakta di ruang tersamar`

---

## Task 3: Handler `generate` di server (T58)

**Files:**
- Create: `src/server/ports.ts`, `src/server/model.ts`, `src/server/db.ts`, `src/server/generate.ts`
- Test: `src/server/model.test.ts`, `src/server/db.test.ts`, `src/server/generate.test.ts`

**Interfaces:**
- Consumes: Task 1 (nama RPC), Task 2 (protokol, prompt, validator).
- Produces:
  ```ts
  // ports.ts
  export type ServerEnv = { aiBaseUrl: string; aiKey: string; aiModel: string; priceIn: number; priceOut: number; budgetUsd: number; rateLimit: number }
  export type Db = {
    reserve(user: string, kind: GenerateRequest['kind'], cost: number): Promise<{ ok: true; id: string } | { ok: false; error: 'insufficient'|'expired' }>
    settle(id: string, ok: boolean, refundReason: string | null, model: string, inTok: number, outTok: number, costUsd: number): Promise<number>
    guard(user: string, budgetUsd: number, rate: number): Promise<'ok'|'budget'|'rate-limit'>
    balance(user: string): Promise<number>
  }
  export type Complete = (system: string, user: string, maxTokens: number) => Promise<{ text: string; usage: AiUsage }>  // throws AiError
  // model.ts
  export function createModel(env: ServerEnv, fetchImpl?: typeof fetch): Complete       // POST {aiBaseUrl}/chat/completions, temperature 0.2, timeout 60 s
  // db.ts
  export function createDb(url: string, serviceKey: string, fetchImpl?: typeof fetch): Db  // POST {url}/rest/v1/rpc/<fn>
  // generate.ts
  export async function handleGenerate(input: { userId: string | null; body: unknown }, deps: { db: Db; complete: Complete; env: ServerEnv }): Promise<{ status: number; body: GenerateResponse }>
  ```
- `max_tokens` per jenis: cv 3000, letter 2000, score 1500 per sub-batch 5 (2 panggilan untuk 10 lowongan).
- Kode `refund_reason`: `'ai'`, `'unreadable'`, `'ungrounded'`, `'fallback'`.

- [ ] **Step 1: Tulis tes yang gagal** untuk `handleGenerate` dengan `Db` dan `Complete` palsu:
  - `userId: null` → 401 `unauthenticated`, `reserve` tidak dipanggil (Review Focus 3).
  - body tidak sah → 400 `invalid-request`, tanpa reserve.
  - `guard` `budget` atau `rate-limit` → 429, tanpa reserve.
  - `reserve` `insufficient` atau `expired` → 402 dengan kode itu.
  - CV sukses → 200 `{ ok: true, kind: 'cv', text, fallback: false, credits }`, `settle(ok=true)` dengan `costUsd = (in*priceIn + out*priceOut)/1e6`.
  - model melempar `AiError('server')` → `settle(ok=false,'ai')`, 502 `ai`, `credits` = saldo setelah refund.
  - teks tidak terbaca → refund `'unreadable'`; output menambah skill "Kubernetes" → refund `'ungrounded'` dan `violations` terisi; pengalaman kosong → refund `'fallback'` tetapi tetap 200 dengan `text` dan `fallback: true` (extension menyusun CV dari Profile).
  - letter: memakai `letterSystem(lang, tone)` dan `validateLetter` pada `profileFromPayload`.
  - score: 10 lowongan → 2 panggilan `complete`; satu sub-batch gagal → seluruh kredit dikembalikan dan `results` kosong.
  - tidak ada `console.log` berisi payload (spy `console` dan pastikan tidak dipanggil dengan teks lowongan).
- `model.test.ts`: 401 → `AiError('invalid-key')`, 429 → `'quota'`, timeout → `'network'` (pakai `mapAiFailure` dari `src/core/ai/errors.ts`); mengembalikan `usage` dari `prompt_tokens`/`completion_tokens`.
- `db.test.ts`: `reserve` memetakan respons PostgREST `{ message: 'insufficient' }` dengan status 400 ke `{ ok: false, error: 'insufficient' }`; header `apikey` dan `Authorization: Bearer <serviceKey>`.

- [ ] **Step 2: Run** `npx vitest run src/server`. Expected: FAIL.
- [ ] **Step 3: Implementasi** tiga file sampai lulus. `src/server/` tidak boleh mengimpor `wxt`, `browser`, atau `Deno` (tambah tes yang membaca isi folder dan memastikan itu).
- [ ] **Step 4: Run** `npx vitest run src/server` lalu `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): handler generate dengan kredit, plafon, dan pengembalian`

---

## Task 4: Midtrans, buat QRIS dan terima notifikasi (T59)

> Gateway semula Tripay; diganti Midtrans (Core API, QRIS) atas keputusan PIC 2026-11-19 (Task 4b). Blok di bawah sudah memakai Midtrans.

**Files:**
- Create: `src/server/midtrans.ts`, `src/server/payments.ts`
- Test: `src/server/midtrans.test.ts`, `src/server/payments.test.ts`
- Modify: `src/server/ports.ts` (port `PaymentDb`), `src/server/db.ts`

**Interfaces:**
- Produces:
  ```ts
  // ports.ts
  export type PaymentDb = {
    createPurchase(user: string, packageId: string): Promise<{ id: string; status: string; amountIdr: number; credits: number; qrUrl: string | null; expiresAt: string }>
    attachGateway(purchaseId: string, reference: string, qrUrl: string): Promise<string>   // penulis pertama menang; mengembalikan QR yang tercatat
    applyPayment(purchaseId: string, reference: string, status: string, amount: number): Promise<string>
  }
  // midtrans.ts
  export type MidtransEnv = { serverKey: string; mode: 'sandbox' | 'production' }
  export const midtransBase = (mode: MidtransEnv['mode']) => mode === 'production' ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
  export async function sha512Hex(message: string): Promise<string>                 // WebCrypto, jalan di Node dan Deno
  export async function verifyNotification(n: { order_id: string; status_code: string; gross_amount: string; signature_key: string }, serverKey: string): Promise<boolean>  // SHA512(order_id + status_code + gross_amount + serverKey), perbandingan waktu-konstan
  export function mapStatus(transactionStatus: string, fraudStatus?: string): 'PAID' | 'EXPIRED' | 'FAILED' | 'UNPAID' | 'REFUND'
  export async function createQris(env: MidtransEnv, input: { orderId: string; amount: number; email: string; expiresAt: Date }, fetchImpl?: typeof fetch): Promise<{ reference: string; qrUrl: string }>  // reference = transaction_id
  // payments.ts
  export type CreatePaymentResponse = { ok: true; purchaseId: string; qrUrl: string; amountIdr: number; credits: number; expiresAt: string } | { ok: false; error: 'unauthenticated'|'invalid-request'|'gateway'; message: string }
  export async function handleCreatePayment(input: { userId: string | null; email: string | null; body: unknown }, deps: { db: PaymentDb; midtrans: MidtransEnv; fetchImpl?: typeof fetch }): Promise<{ status: number; body: CreatePaymentResponse }>
  export async function handleCallback(input: { rawBody: string }, deps: { db: PaymentDb; serverKey: string; report?: ... }): Promise<{ status: number; body: { success: boolean; message?: string } }>
  ```
- Body Midtrans (`POST /v2/charge`, Basic auth = base64(serverKey + ':')): `payment_type: 'qris'`, `transaction_details: { order_id, gross_amount: 10800 }`, `customer_details: { first_name, email }`, `qris: { acquirer: 'gopay' }`, `custom_expiry: { expiry_duration, unit: 'minute' }`. `order_id = <purchaseUuid>_<timestamp base36>` (maks 50 karakter; hanya huruf, angka, `-_~.`; Midtrans menolak order_id kembar dengan 406). Tidak ada field biaya pembeli.

- [ ] **Step 1: Tulis tes yang gagal**
  - `sha512Hex` cocok dengan vektor `node:crypto`; `verifyNotification` menerima yang benar, menolak yang salah, kosong, terpotong, atau kunci lain; `mapStatus` untuk semua nilai.
  - `createQris` mengirim body di atas ke `midtransBase(mode) + '/v2/charge'` dengan header Basic, `Content-Type`, `Accept` dan timeout 15 detik; `transaction_id` dan URL gambar QR di `actions` dipetakan; kegagalan HTTP atau tanpa QR → melempar tanpa memuat kunci.
  - `handleCreatePayment`: tanpa user → 401; `packageId` bukan `'basic'` → 400; pending yang masih berlaku dengan `qrUrl` → tidak memanggil Midtrans lagi; sukses → `attachGateway` dipanggil; Midtrans gagal → 502 `gateway` dan pembelian tetap `pending`; `attachGateway` melempar → handler melempar.
  - `handleCallback`: body bukan JSON → 400; `signature_key` salah atau kosong → 401 tanpa `applyPayment`; `settlement` → `applyPayment(purchaseId, transaction_id, 'PAID', 10800)` dan 200 `{ success: true }`; `gross_amount` tak bulat → 400; callback kedua yang sama → 200, dan `applyPayment` mengembalikan `'paid'` tanpa efek (Review Focus 2); `PAID` yang tidak berujung `'paid'` atau `'mismatch'` → `report('paid-not-credited')`.
- [ ] **Step 2: Run** `npx vitest run src/server`. Expected: FAIL.
- [ ] **Step 3: Implementasi** sampai lulus.
- [ ] **Step 4: Run** `npx vitest run src/server`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): pembayaran QRIS Midtrans dan notifikasi bertanda tangan` (semula Tripay; lihat Task 4b)

---

## Task 5: Entrypoint Edge Functions, bundel, dan deploy

**Files:**
- Create: `supabase/functions-src/generate/index.ts`, `supabase/functions-src/create-payment/index.ts`, `supabase/functions-src/midtrans-callback/index.ts`, `supabase/functions-src/_shared/auth.ts`, `scripts/build-functions.mjs`
- Modify: `package.json` (script `build:functions`, `deploy:functions`), `.gitignore` (`supabase/functions/`, `supabase/.temp/`), `supabase/README.md`, `tsconfig.json` (exclude `supabase/functions-src` dari tipe browser bila perlu)
- Create via CLI: `supabase/config.toml` (`supabase init`), dengan `[functions.midtrans-callback] verify_jwt = false`
- Test: `scripts/build-functions.test.ts`

**Interfaces:**
- Consumes: `handleGenerate`, `handleCreatePayment`, `handleCallback`, `createDb`, `createModel`.
- Produces: `_shared/auth.ts` → `userFromRequest(req: Request): { id: string; email: string | null } | null`, yang membaca `sub` dan `email` dari payload JWT tanpa memverifikasi ulang, karena gateway Supabase sudah memverifikasi (`verify_jwt` bawaan `true` untuk `generate` dan `create-payment`).
- Tiap `index.ts` hanya berisi `Deno.serve`, membaca `Deno.env`, menangani CORS untuk `chrome-extension://<id>` dan `OPTIONS`, lalu memanggil handler.

- [ ] **Step 1: Tulis tes yang gagal** di `build-functions.test.ts`: menjalankan `node scripts/build-functions.mjs` menghasilkan `supabase/functions/<nama>/index.ts` untuk ketiga fungsi; bundel tidak memuat string `chrome.`, `browser.`, atau `wxt`; bundel `generate` memuat isi `CV_SYSTEM` (bukti satu sumber prompt).
- [ ] **Step 2: Run** `npx vitest run scripts`. Expected: FAIL.
- [ ] **Step 3: Tulis `scripts/build-functions.mjs`** memakai esbuild (`bundle: true`, `format: 'esm'`, `platform: 'neutral'`, `target: 'es2022'`) dan tiga entrypoint.
- [ ] **Step 4: Run** `npx vitest run scripts`. Expected: PASS.
- [ ] **Step 5:** Tambah ke `package.json`: `"build:functions": "node scripts/build-functions.mjs"` dan `"deploy:functions": "npm run build:functions && supabase functions deploy generate create-payment midtrans-callback --project-ref ktgcjqxoohuvxwvsjhif"`.
- [ ] **Step 6:** Di `supabase/README.md`, tulis cara PIC mengisi secrets (`supabase secrets set AI_BASE_URL=... AI_API_KEY=... AI_MODEL=deepseek-v4.1-flash AI_PRICE_IN=0.30 AI_PRICE_OUT=1.20 MONTHLY_AI_BUDGET_USD=5 MIDTRANS_MODE=sandbox ...`) dan URL notifikasi untuk dashboard Midtrans (`https://ktgcjqxoohuvxwvsjhif.supabase.co/functions/v1/midtrans-callback`). Kunci asli tidak ditulis di repo.
- [ ] **Step 7: Verifikasi deploy (PIC menjalankan, karena butuh login CLI):** `npm run deploy:functions`, lalu panggil `generate` dengan token uji. Expected: CV sungguhan kembali dan saldo berkurang 1. Catat token dan biaya di T58 `docs/plan.md`, yang juga menutup sisa T35.
- [ ] **Step 8: Verifikasi sandbox Midtrans:** buat pembayaran dari curl dengan token uji, bayar di simulator sandbox. Expected: `accounts.credits` +50, `unlocked_at` terisi.
- [ ] **Step 9: Commit** `feat(functions): entrypoint Edge Functions dan skrip bundel`

---

## Task 6: Mode AI di build dan klien akun di extension (T60, bagian data)

**Files:**
- Modify: `src/core/build.ts`, `package.json` (`dev:byok`, `build:byok`), `wxt.config.ts` (host Supabase menjadi `host_permissions` di mode server), `src/platform/sync.ts` (ekspor `currentSession`)
- Create: `src/core/account/access.ts`, `src/platform/account.ts`
- Test: `src/core/build.test.ts`, `src/core/account/access.test.ts`, `src/platform/account.test.ts`

**Interfaces:**
- Consumes: `GenerateRequest`, `GenerateResponse` (Task 2); `CreatePaymentResponse` (Task 4).
- Produces:
  ```ts
  // build.ts
  export type AiMode = 'server' | 'byok' | 'off'
  export function aiModeFrom(mode: unknown, share: unknown): AiMode   // share 'true' → 'off'; mode 'byok' → 'byok'; selain itu 'server'
  export const AI_MODE: AiMode
  export const AI_ENABLED: boolean   // AI_MODE !== 'off' (nama lama tetap)
  // access.ts
  export type AccountStatus = { credits: number; paid: boolean; trialGranted: boolean; expiresAt: string | null; checkedAt: string }
  export type AccessLevel = 'preview' | 'free' | 'trial' | 'paid'
  export function accessLevel(signedIn: boolean, status: AccountStatus | null): AccessLevel
  export type FeatureMode = 'open' | 'locked'
  export function featureMode(level: AccessLevel, status: AccountStatus | null): FeatureMode  // preview → locked; semua level masuk (free, trial, paid, status null) → open. Tombol AI mengikuti saldo (credits > 0), bukan featureMode
  export function expiryWarning(status: AccountStatus | null, now: Date): boolean            // credits > 0 dan ≤ 30 hari menuju expiresAt
  export const PACKAGE = { id: 'basic', priceIdr: 10800, credits: 50 } as const
  // platform/sync.ts
  export function currentSession(): Promise<Session | null>   // = liveSession yang sudah ada, kini diekspor
  // platform/account.ts
  export function loadAccountStatus(): Promise<AccountStatus | null>            // cache storage.local 'local:accountStatus'
  export function refreshAccountStatus(): Promise<AccountStatus | null>         // rpc ensure_account + select accounts
  export function callGenerate(request: GenerateRequest): Promise<GenerateResponse>
  export function createPayment(): Promise<CreatePaymentResponse>
  export function purchaseStatus(id: string): Promise<'pending'|'paid'|'expired'|'failed'|'mismatch'>
  export function loadLedger(limit?: number): Promise<{ at: string; delta: number; reason: string }[]>
  ```
- Nama `paid` dipakai agar tidak bentrok dengan `Account.unlocked` (kunci sinkron) di `platform/sync.ts`.

- [ ] **Step 1: Tulis tes yang gagal:** tabel kebenaran `aiModeFrom`; `accessLevel` (tanpa sesi → `preview`; `paid` → `paid`; credits 2 dan belum bayar → `trial`; credits 0, trialGranted, belum bayar → `free`); `featureMode` untuk semua level (`preview` → `locked`; semua level masuk → `open`: `paid`, `trial`, `free` dengan maupun tanpa `trialGranted`, dan `free` dengan status null); `expiryWarning` di batas 30 hari tepat; `callGenerate` mengirim `Authorization: Bearer <access>` dan `apikey` ke `/functions/v1/generate`; sesi null → `{ ok: false, error: 'unauthenticated' }` tanpa fetch; status dari `refreshAccountStatus` tersimpan di cache dan dipakai `loadAccountStatus` saat fetch gagal (offline).
- [ ] **Step 2: Run** `npx vitest run src/core/build.test.ts src/core/account src/platform/account.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementasi.** Tambah script `"dev:byok": "WXT_AI_MODE=byok wxt"` dan `"build:byok": "WXT_AI_MODE=byok wxt build"`.
- [ ] **Step 4: Run** perintah yang sama lalu `npm test` dan `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(account): mode AI per build dan status akun di extension`

---

## Task 7: Login wajib, preview, dan tingkatan akses di UI (T60)

**Files:**
- Create: `src/entrypoints/options/LoginGate.tsx`, `src/entrypoints/options/useAccess.ts`, `src/entrypoints/sidepanel/PanelLoginGate.tsx`
- Modify: `src/entrypoints/options/App.tsx` (sidebar dan gerbang), komponen akar panel di `src/entrypoints/sidepanel/`, halaman Lowongan dan Lamaran (`featureMode` = `open` di semua level setelah masuk, jadi tetap terbuka dan bisa diedit; hanya `preview` yang `locked`; hanya tombol AI mengikuti saldo)
- Test: `src/entrypoints/options/LoginGate.test.tsx`, `src/entrypoints/options/App.access.test.tsx`

**Interfaces:**
- Consumes: `accessLevel`, `featureMode`, `expiryWarning`, `refreshAccountStatus`, `currentSession`, `startLogin`, `finishLogin`; copy dari Task 0.
- Produces: `useAccess(): { level: AccessLevel; status: AccountStatus | null; refresh: () => Promise<void> }`, dipakai Task 8 dan 9.

- [ ] **Step 1: Tulis tes yang gagal** (happy-dom, pola `AccountPage.test.tsx`):
  - tanpa sesi: data contoh tampil, tombol Fill dan Buat `disabled`, teks "Masuk untuk memakai";
  - setelah `finishLogin` sukses, `ensure_account` dipanggil sekali dan profil sendiri tampil;
  - level `free` dengan trialGranted dan credits 0 (percobaan habis): Lowongan dan Lamaran tetap terbuka dan bisa diedit (Simpan, Buka & isi, filter jalan); tombol AI ("Nilai dengan AI · 1 kredit") `disabled`; "Siapkan lamaran" tanpa label biaya dan tetap aktif (aksi itu tidak memanggil AI; hanya `preview` yang mematikannya, keputusan akhir PIC: hanya AI yang berhenti) dengan teks "Kredit tidak cukup. Butuh 1 kredit; saldomu 0." (satu teks dengan state saldo kurang di Task 8) dan tombol "Beli kredit"; item sidebar tampil normal tanpa gembok atau badge, saldo "0 kredit" dengan "Percobaanmu habis. Hanya AI yang berhenti; halaman dan datamu tetap terbuka.";
  - level `free` tanpa `trialGranted` atau status null (sudah masuk): Lowongan dan Lamaran tetap terbuka dan bisa diedit; tombol AI mengikuti saldo; hanya tanpa sesi (`preview`) yang `locked`;
  - level `paid` dengan credits 0: Lowongan dan Lamaran tetap terbuka penuh;
  - frame mockup "sesi habis" (§10, S10): `currentSession` null → kembali ke gerbang masuk dengan judul "Masuk lagi ke job-kit" dan pesan "Sesi masukmu sudah habis. Masuk lagi untuk memakai AI. Data dan profilmu tetap ada di browser ini."; data `storage.local` (profil, lowongan, lamaran) tidak dihapus dan tampil lagi setelah masuk (Review Focus 3).
- [ ] **Step 2: Run** `npx vitest run src/entrypoints`. Expected: FAIL.
- [ ] **Step 3: Implementasi** mengikuti mockup Task 0 (§10 di `docs/design-system.html`), dengan teks persis dari mockup. Saldo dan penanda hangus di sidebar. Teks sidebar: percobaan "Percobaan gratis. Habis, hanya AI yang berhenti." dengan tombol "Beli kredit"; terbuka "Hangus 18 Des 2026" (tanggal contoh); belum masuk "Belum masuk" dan "Kamu sedang melihat preview dengan data contoh." dengan tombol "Masuk"; alert preview "Ini preview dengan data contoh. Lowongan, Lamaran, CV, dan Surat baru bisa dipakai setelah kamu masuk." dengan tombol "Masuk untuk memakai"; alert percobaan habis di Lowongan "Percobaan gratismu sudah habis. Lowongan dan Lamaran tetap terbuka dan bisa kamu edit; hanya Buat CV, Buat surat, dan Nilai dengan AI yang berhenti sampai kamu membeli kredit." dengan tombol "Beli kredit".
- [ ] **Step 4: Run** `npx vitest run src/entrypoints` lalu `npm test`. Expected: PASS.
- [ ] **Step 5: Verifikasi manual:** `npm run dev`, profil Chrome bersih → preview → masuk → profil dan Autofill bisa dipakai.
- [ ] **Step 6: Commit** `feat(options): login wajib, preview, dan tingkatan akses`

---

## Task 8: AI lewat server dan build pengguna tanpa kunci sendiri (T61)

**Files:**
- Modify: `src/platform/tailor.ts`, `src/platform/letter.ts`, `src/core/tailor/limits.ts` (alasan blokir baru), `src/core/feed/pipeline.ts`, `src/platform/feed-runner.ts`, Atur Lowongan (sembunyikan penyedia, model, kunci di mode server), halaman Lowongan (tombol "Nilai dengan AI"), `CvTab.tsx` dan tab Surat (label biaya)
- Create: `src/platform/remote.ts`
- Test: `src/platform/remote.test.ts`, tambahan di `src/core/tailor/limits.test.ts`, `src/core/feed/pipeline.test.ts`, `CvTab.test.tsx`, `src/core/build.test.ts` (bundle)

**Interfaces:**
- Consumes: `callGenerate`, `RemoteDocument`, `RemoteScore`, `RemoteRefusal`, `AI_MODE`, `useAccess`.
- Produces:
  ```ts
  // remote.ts
  export const remoteDocument: RemoteDocument   // callGenerate; ok:false → throw RemoteRefusal(error, message, violations); memperbarui cache saldo dari response.credits
  export const remoteScore: RemoteScore
  export function scoreTopWithAi(): Promise<{ scored: number; refused?: GenerateError }>  // 10 lowongan teratas berskor kasar, 1 kredit
  ```
- `cvAvailability` di mode server tidak memeriksa kunci. Alasan blokir baru: `'no-credits'` ("Kredit tidak cukup."), `'signed-out'` ("Masuk untuk memakai", teks gerbang di mockup), `'offline'` ("Tidak ada koneksi internet. Sambungkan dulu untuk memakai AI."). Plafon dan batas laju datang dari server sebagai `refused`.
- `runFeedPipeline` mendapat opsi `aiScoring: boolean`. Di mode server nilainya `false`, sehingga `scoreJobs({ limit: 0 })`.

- [ ] **Step 1: Tulis tes yang gagal**
  - `buildCv` di mode server memanggil `remoteDocument` dan tidak memanggil `clientWithPermission`.
  - response `{ ok: false, error: 'budget' }` → hasil `refused` dengan pesan "Layanan AI penuh bulan ini"; `'rate-limit'` → "Terlalu cepat, coba lagi sebentar"; `'unauthenticated'` → "Masuk lagi untuk memakai AI" dan saldo cache tidak berubah.
  - `fallback: true` dari server → pesan "CV disusun dari profilmu apa adanya; kredit tidak terpakai."
  - feed harian di mode server tidak memanggil `callGenerate`.
  - `scoreTopWithAi` mengirim tepat 10 lowongan teratas yang masih berskor kasar.
  - label tombol "Buat CV · 1 kredit"; saldo 0 → `disabled` dengan "Kredit tidak cukup" dan tombol "Beli kredit".
  - **bundle:** setelah `npm run build`, file di `.output/chrome-mv3/` tidak memuat `api.anthropic.com`, `generativelanguage.googleapis.com`, `opencode.ai`, `127.0.0.1:8787`, atau `bandelbanget` (tes dilewati bila `.output` tidak ada; dijalankan di Step 4).
- [ ] **Step 2: Run** `npx vitest run src/platform src/core src/entrypoints`. Expected: FAIL.
- [ ] **Step 3: Implementasi.** Jalur `byok` tetap seperti sekarang di balik `AI_MODE === 'byok'`.
- [ ] **Step 4: Run** `npm run build && npm test && npm run typecheck`. Expected: PASS, termasuk tes bundle.
- [ ] **Step 5: Verifikasi manual** di `npm run dev` dengan fungsi yang sudah di-deploy: Buat CV memotong 1 kredit, saldo baru tampil; ubah secret `AI_MODEL` ke nama yang salah → kredit kembali dan pesan gangguan tampil.
- [ ] **Step 6: Commit** `feat(ai): CV, surat, dan skor lewat server dengan kredit`

---

## Task 9: Beli kredit QRIS dan riwayat kredit (T62)

**Files:**
- Create: `src/entrypoints/options/BuyCreditsModal.tsx`, `src/core/account/purchase-flow.ts`
- Modify: `src/entrypoints/options/AccountPage.tsx` (saldo, tanggal hangus, riwayat), `wxt.config.ts` (CSP `img-src` menambah `https://api.midtrans.com` dan `https://api.sandbox.midtrans.com`)
- Test: `src/core/account/purchase-flow.test.ts`, `src/entrypoints/options/BuyCreditsModal.test.tsx`, tambahan di `AccountPage.test.tsx`

**Interfaces:**
- Consumes: `createPayment`, `purchaseStatus`, `refreshAccountStatus`, `loadLedger`, `PACKAGE`, `useAccess`.
- Produces:
  ```ts
  // purchase-flow.ts: mesin status murni, waktu disuntik
  export type FlowState =
    | { step: 'creating' }
    | { step: 'waiting'; purchaseId: string; qrUrl: string; expiresAt: string }
    | { step: 'paid'; credits: number }
    | { step: 'expired' }
    | { step: 'error'; message: string }
  export function nextState(state: FlowState, event: { type: 'created'; res: CreatePaymentResponse } | { type: 'polled'; status: string; credits?: number } | { type: 'tick'; now: Date }): FlowState
  export const POLL_MS = 3000
  ```

- [ ] **Step 1: Tulis tes yang gagal**
  - `nextState`: `created ok` → `waiting`; `polled 'paid'` → `paid`; `tick` setelah `expiresAt` → `expired`; `created` gagal → `error` dengan pesan "Kode QR belum bisa dibuat. Kamu belum ditagih. Cek koneksi internetmu, lalu coba lagi." (tombol "Coba lagi").
  - modal (teks persis dari mockup §10 S12): menampilkan "Rp10.800", "50 kredit ≈ 25 CV + 25 surat", "Sudah termasuk semua biaya", gambar dari `qrUrl`, hitung mundur "Berlaku 28:41" dan "Menunggu pembayaran…", catatan "kredit tidak bisa diuangkan, dan hangus 1 tahun sejak pembelian terakhir"; state kedaluwarsa menampilkan "Kode QR sudah kedaluwarsa. Kalau kamu sudah membayar, kredit tetap masuk. Kalau belum, buat kode baru." dengan tombol "Buat kode baru"; state berhasil menampilkan "Pembayaran diterima", "50 kredit sudah masuk. Kamu bisa memakai AI lagi.", "Saldo sekarang", dan tombol "Selesai"; tidak ada teks "admin"; menutup modal tidak membatalkan pembelian; membuka lagi saat pending masih berlaku menampilkan QR yang sama (karena `create_purchase` mengembalikan pending yang ada).
  - kontrak modal (mockup §10 S12): `role="dialog"` dengan `aria-modal="true"` dan nama (`aria-label` "Beli kredit AI"); fokus pindah ke dalam modal saat dibuka; Escape menutup; fokus kembali ke tombol "Beli kredit" yang membukanya;
  - tombol "Beli kredit" (pemicu) dan "Buat kode baru" / "Coba lagi" `disabled` selama permintaan `createPayment` berjalan, jadi klik berulang tidak membuat dua permintaan;
  - poller status beli punya batas waktu: tiap `purchaseStatus` dipanggil dengan timeout (10 detik) dan kegagalan satu putaran tidak menghentikan polling; polling berakhir di `expiresAt` (state `expired`) dan berhenti saat modal ditutup. Tes dengan timer palsu;
  - setelah `paid`: `refreshAccountStatus` dipanggil dan sidebar menampilkan saldo baru tanpa muat ulang.
  - Akun: riwayat menampilkan `purchase +50`, `generate -1`, `refund +1`, `trial +3`, `expire -n` dengan label Indonesia; tanggal hangus tampil; penanda muncul bila `expiryWarning`.
- [ ] **Step 2: Run** `npx vitest run src/core/account src/entrypoints/options`. Expected: FAIL.
- [ ] **Step 3: Implementasi.** Polling berhenti saat modal ditutup dan dilanjutkan saat dibuka lagi.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Verifikasi sandbox:** beli dari extension, bayar di simulator Midtrans. Expected: layar berhasil ≤ 1 menit, saldo +50, riwayat bertambah satu baris.
- [ ] **Step 6: Commit** `feat(options): beli kredit lewat QRIS dan riwayat kredit`

---

## Task 10: Website, privasi, uji ujung ke ujung, dan produksi (T63)

**Files:**
- Create: `site/_headers` (isi CSP dari `site/vercel.json`), `site/harga.html`
- Modify: `site/privasi.html` (tiga bagian), `site/index.html` (tautan Harga), `site/site.test.ts`, `README.md`, `docs/03-rfc.md` §3.3d, `docs/06-distribution.md`, `docs/plan.md` (centang T56–T63)
- Delete: `site/vercel.json` setelah `_headers` terbukti dipakai Cloudflare Pages

**Interfaces:**
- Consumes: semua task sebelumnya.

- [ ] **Step 1: Tulis tes yang gagal** di `site/site.test.ts`: `_headers` memuat CSP yang sama dengan `vercel.json`; `harga.html` memuat "Rp10.800", "50 kredit", "sudah termasuk semua biaya", "tidak bisa diuangkan", dan "1 tahun"; tidak memuat "admin"; `privasi.html` tidak lagi memuat "tidak memakai akun" dan "belum tersedia di versi ini", dan memuat "Midtrans" serta "penyedia AI".
- [ ] **Step 2: Run** `npx vitest run site`. Expected: FAIL.
- [ ] **Step 3: Implementasi.** Di `privasi.html`, ganti hanya tiga bagian: akun wajib (email, saldo, riwayat pembelian); AI lewat server PIC (payload tersamar, tidak disimpan, penyedia DeepSeek); pembayaran lewat Midtrans (email dan jumlah dikirim ke Midtrans). Sisanya tetap (keputusan PIC 2026-11-19).
- [ ] **Step 4: Run** `npx vitest run site`. Expected: PASS.
- [ ] **Step 5: Deploy website (PIC):** hubungkan repo ke Cloudflare Pages dengan direktori `site/`; cek header CSP di respons halaman.
- [ ] **Step 6: Uji ujung ke ujung (sandbox)** di profil Chrome bersih dari `npm run zip`: instal → preview → masuk → 3 kredit percobaan → Buat CV → beli → saldo 52 → riwayat. Catat hasilnya di T63.
- [ ] **Step 7: Produksi (PIC):** verifikasi akun Midtrans, `supabase secrets set MIDTRANS_MODE=production` beserta kunci produksi, satu transaksi nyata Rp10.800 oleh pengguna bukan PIC. Catat biaya AI + QRIS per paket (PRD §10).
- [ ] **Step 8:** Perbarui README, RFC §3.3d, dan `06-distribution.md` (centang "pembelian dalam aplikasi", formulir pengungkapan data: email, riwayat pembelian, isi CV tersamar ke penyedia AI; `key` manifest untuk ID tetap). Centang tiket di `docs/plan.md`.
- [ ] **Step 9: Commit** `feat(site): halaman harga, privasi diperbarui, pindah ke Cloudflare Pages`
