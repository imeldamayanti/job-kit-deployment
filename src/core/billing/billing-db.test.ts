// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(join(__dirname, '../../../supabase', rel), 'utf8')
const authStub = read('test/auth-stub.sql')
const billingSql = read('billing.sql')

type Account = {
  user_id: string
  credits: number
  unlocked_at: Date | null
  trial_granted_at: Date | null
  credits_expire_at: Date | null
}

let db: PGlite

beforeEach(async () => {
  db = new PGlite()
  await db.exec(authStub)
  await db.exec(billingSql)
}, 60_000)

// The ledger is the audit trail: its sum must equal the balance after every scenario.
afterEach(async () => {
  const { rows } = await db.query<{ user_id: string; credits: number; ledger: number }>(`
    select a.user_id, a.credits, coalesce(sum(l.delta), 0)::int as ledger
    from public.accounts a left join public.credit_ledger l on l.user_id = a.user_id
    group by a.user_id, a.credits`)
  for (const r of rows) expect(r.ledger, `ledger vs balance for ${r.user_id}`).toBe(r.credits)
  await db.close()
})

async function addUser(): Promise<string> {
  const id = randomUUID()
  await db.query('insert into auth.users (id) values ($1)', [id])
  return id
}

async function ensureAccount(user: string): Promise<Account> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user])
  const { rows } = await db.query<Account>('select * from public.ensure_account()')
  return one(rows)
}

async function account(user: string): Promise<Account> {
  const { rows } = await db.query<Account>('select * from public.accounts where user_id = $1', [user])
  return one(rows)
}

// Moves a balance the way an operator would, keeping the ledger in step.
async function adjust(user: string, delta: number) {
  await db.query('update public.accounts set credits = credits + $2 where user_id = $1', [user, delta])
  await db.query(`insert into public.credit_ledger (user_id, delta, reason) values ($1, $2, 'admin_grant')`, [user, delta])
}

async function reserve(user: string, kind = 'cv', cost = 1): Promise<string> {
  const { rows } = await db.query<{ id: string }>('select public.reserve_credits($1, $2, $3) as id', [user, kind, cost])
  return one(rows).id
}

async function settle(id: string, ok: boolean, reason: string | null = null, cost = 0.001) {
  const { rows } = await db.query<{ balance: number }>(
    'select public.settle_generation($1, $2, $3, $4, $5, $6, $7) as balance',
    [id, ok, reason, 'deepseek-flash', 100, 50, cost],
  )
  return one(rows).balance
}

async function ledgerRows(user: string) {
  const { rows } = await db.query<{ delta: number; reason: string }>(
    'select delta, reason from public.credit_ledger where user_id = $1 order by id',
    [user],
  )
  return rows
}

async function newPurchase(user: string) {
  const { rows } = await db.query<{ id: string; status: string; amount_idr: number; credits: number; expires_at: Date }>(
    `select * from public.create_purchase($1, 'basic')`,
    [user],
  )
  return one(rows)
}

async function pay(purchase: string, status = 'PAID', amount = 10800, reference = 'T123') {
  const { rows } = await db.query<{ s: string }>('select public.apply_payment($1, $2, $3, $4) as s', [
    purchase,
    reference,
    status,
    amount,
  ])
  return one(rows).s
}

function one<T>(rows: T[]): T {
  const row = rows[0]
  if (!row) throw new Error('expected one row')
  return row
}

const daysFromNow = (d: Date) => (d.getTime() - Date.now()) / 86_400_000

describe('trial credits (ensure_account)', () => {
  it('gives 3 trial credits once, expiring in a year', async () => {
    const user = await addUser()
    await ensureAccount(user)
    const acct = await ensureAccount(user)
    expect(acct.credits).toBe(3)
    expect(acct.trial_granted_at).not.toBeNull()
    expect((await ledgerRows(user)).filter((r) => r.reason === 'trial')).toHaveLength(1)
    expect(daysFromNow(acct.credits_expire_at!)).toBeCloseTo(365, 0)
  })

  it('stops granting trials after 30 accounts in one Jakarta day', async () => {
    for (let i = 0; i < 30; i++) expect((await ensureAccount(await addUser())).credits).toBe(3)
    const late = await ensureAccount(await addUser())
    expect(late.credits).toBe(0)
    expect(late.trial_granted_at).toBeNull()
    expect(late.credits_expire_at).toBeNull()
  }, 60_000)

  it('refuses a caller who is not signed in', async () => {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
    await expect(db.query('select * from public.ensure_account()')).rejects.toThrow(/unauthenticated/)
  })
})

describe('reserve and settle', () => {
  it('reserves under a row lock: balance 1, two reserves leave one insufficient', async () => {
    const user = await addUser()
    await ensureAccount(user)
    await adjust(user, -2)
    // pglite serves one connection, so the two calls run back to back; `for update` is checked in sql.test.ts.
    const results = await Promise.allSettled([reserve(user), reserve(user)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(failed.reason.message).toBe('insufficient')
    expect((await account(user)).credits).toBe(0)
  })

  it('rejects reserve when credits_expire_at has passed', async () => {
    const user = await addUser()
    await ensureAccount(user)
    await db.query(`update public.accounts set credits_expire_at = now() - interval '1 day' where user_id = $1`, [user])
    await expect(reserve(user)).rejects.toThrow(/^expired$/)
    expect((await account(user)).credits).toBe(3)
  })

  it('rejects a reserve for a user with no account', async () => {
    await expect(reserve(await addUser())).rejects.toThrow(/^insufficient$/)
  })

  it('settle ok keeps the charge; settle fail refunds once even if called twice', async () => {
    const user = await addUser()
    await ensureAccount(user)

    const kept = await reserve(user)
    expect(await settle(kept, true)).toBe(2)
    expect(await settle(kept, false, 'late')).toBe(2) // already done: no effect

    const failed = await reserve(user, 'letter')
    expect((await account(user)).credits).toBe(1)
    expect(await settle(failed, false, 'model-error')).toBe(2)
    expect(await settle(failed, false, 'model-error')).toBe(2)
    expect(await settle(failed, true)).toBe(2)

    const { rows } = await db.query<{ status: string; refund_reason: string | null; model: string | null; finished_at: Date | null }>(
      'select status, refund_reason, model, finished_at from public.generations where id = $1',
      [failed],
    )
    expect(one(rows)).toMatchObject({ status: 'refunded', refund_reason: 'model-error', model: 'deepseek-flash' })
    expect(one(rows).finished_at).not.toBeNull()
    expect((await ledgerRows(user)).filter((r) => r.reason === 'refund')).toHaveLength(1)
  })
})

describe('payments', () => {
  it('apply_payment PAID credits 50, sets unlocked_at and expiry, and is idempotent', async () => {
    const user = await addUser()
    await ensureAccount(user)
    const p = await newPurchase(user)
    expect(await pay(p.id)).toBe('paid')
    expect(await pay(p.id)).toBe('paid')
    const acct = await account(user)
    expect(acct.credits).toBe(53)
    expect(acct.unlocked_at).not.toBeNull()
    expect(daysFromNow(acct.credits_expire_at!)).toBeCloseTo(365, 0)
    expect((await ledgerRows(user)).filter((r) => r.reason === 'purchase')).toEqual([{ delta: 50, reason: 'purchase' }])
    const { rows } = await db.query<{ status: string; paid_at: Date; tripay_reference: string }>(
      'select status, paid_at, tripay_reference from public.purchases where id = $1',
      [p.id],
    )
    expect(one(rows).status).toBe('paid')
    expect(one(rows).paid_at).not.toBeNull()
    expect(one(rows).tripay_reference).toBe('T123')
  })

  it('apply_payment with a different amount marks mismatch and adds nothing', async () => {
    const user = await addUser()
    await ensureAccount(user)
    const p = await newPurchase(user)
    expect(await pay(p.id, 'PAID', 10000)).toBe('mismatch')
    expect(await pay(p.id, 'PAID', 10800)).toBe('mismatch') // a settled row is never reopened
    const acct = await account(user)
    expect(acct.credits).toBe(3)
    expect(acct.unlocked_at).toBeNull()
  })

  it('apply_payment PAID after expired still credits (money already received)', async () => {
    const user = await addUser()
    await ensureAccount(user)
    const p = await newPurchase(user)
    expect(await pay(p.id, 'EXPIRED')).toBe('expired')
    expect(await pay(p.id, 'PAID')).toBe('paid')
    expect((await account(user)).credits).toBe(53)
  })

  it('apply_payment FAILED ends a pending purchase and ignores an unknown status', async () => {
    const user = await addUser()
    await ensureAccount(user)
    const p = await newPurchase(user)
    expect(await pay(p.id, 'UNPAID')).toBe('pending')
    expect(await pay(p.id, 'FAILED')).toBe('failed')
    expect((await account(user)).credits).toBe(3)
  })

  it('apply_payment rejects an unknown purchase', async () => {
    await expect(pay(randomUUID())).rejects.toThrow(/not_found/)
  })

  it('apply_payment keeps the money record when the account was already deleted', async () => {
    const user = await addUser()
    await ensureAccount(user)
    const p = await newPurchase(user)
    await db.query('delete from auth.users where id = $1', [user])
    expect(await pay(p.id)).toBe('paid')
  })

  it('create_purchase returns the same pending purchase while it is still valid', async () => {
    const user = await addUser()
    await ensureAccount(user)
    const a = await newPurchase(user)
    const b = await newPurchase(user)
    expect(b.id).toBe(a.id)
    expect(a).toMatchObject({ status: 'pending', amount_idr: 10800, credits: 50 })
    expect((a.expires_at.getTime() - Date.now()) / 60_000).toBeCloseTo(30, 0)

    await db.query(`update public.purchases set expires_at = now() - interval '1 minute' where id = $1`, [a.id])
    expect((await newPurchase(user)).id).not.toBe(a.id)
  })

  it('create_purchase rejects an unknown or inactive package', async () => {
    const user = await addUser()
    await expect(db.query(`select * from public.create_purchase($1, 'nope')`, [user])).rejects.toThrow(/unknown_package/)
    await db.query(`update public.packages set active = false where id = 'basic'`)
    await expect(newPurchase(user)).rejects.toThrow(/unknown_package/)
  })

  it('attach_tripay stores the reference and QR url on a pending purchase', async () => {
    const user = await addUser()
    await ensureAccount(user)
    const p = await newPurchase(user)
    await db.query('select public.attach_tripay($1, $2, $3)', [p.id, 'T999', 'https://qr.example/x.png'])
    const { rows } = await db.query<{ tripay_reference: string; qr_url: string }>(
      'select tripay_reference, qr_url from public.purchases where id = $1',
      [p.id],
    )
    expect(one(rows)).toEqual({ tripay_reference: 'T999', qr_url: 'https://qr.example/x.png' })
    await expect(
      db.query('select public.attach_tripay($1, $2, $3)', [randomUUID(), 'T1', 'u']),
    ).rejects.toThrow(/not_found/)
  })

  it('a purchase extends the expiry of the whole balance to now + 1 year', async () => {
    const user = await addUser()
    await ensureAccount(user)
    await db.query(`update public.accounts set credits_expire_at = now() + interval '10 days' where user_id = $1`, [user])
    const p = await newPurchase(user)
    await pay(p.id)
    const acct = await account(user)
    expect(acct.credits).toBe(53)
    expect(daysFromNow(acct.credits_expire_at!)).toBeCloseTo(365, 0)
  })
})

describe('expiry and reaping', () => {
  it('expire_credits zeroes overdue balances with an expire ledger row', async () => {
    const overdue = await addUser()
    const fresh = await addUser()
    const empty = await addUser()
    await ensureAccount(overdue)
    await ensureAccount(fresh)
    await ensureAccount(empty)
    await adjust(empty, -3)
    await db.query(
      `update public.accounts set credits_expire_at = now() - interval '1 day' where user_id in ($1, $2)`,
      [overdue, empty],
    )
    const { rows } = await db.query<{ n: number }>('select public.expire_credits() as n')
    expect(one(rows).n).toBe(1)
    expect((await account(overdue)).credits).toBe(0)
    expect((await account(fresh)).credits).toBe(3)
    expect((await ledgerRows(overdue)).at(-1)).toEqual({ delta: -3, reason: 'expire' })
    expect((await ledgerRows(empty)).filter((r) => r.reason === 'expire')).toHaveLength(0)
    expect(one((await db.query<{ n: number }>('select public.expire_credits() as n')).rows).n).toBe(0)
  })

  it('reap_reserved refunds generations reserved more than 10 minutes ago', async () => {
    const user = await addUser()
    await ensureAccount(user)
    const stale = await reserve(user)
    const recent = await reserve(user)
    await db.query(`update public.generations set created_at = now() - interval '11 minutes' where id = $1`, [stale])
    const { rows } = await db.query<{ n: number }>('select public.reap_reserved() as n')
    expect(one(rows).n).toBe(1)
    const statuses = await db.query<{ id: string; status: string; refund_reason: string | null }>(
      'select id, status, refund_reason from public.generations',
    )
    expect(statuses.rows.find((r) => r.id === stale)).toMatchObject({ status: 'refunded', refund_reason: 'reaped' })
    expect(statuses.rows.find((r) => r.id === recent)?.status).toBe('reserved')
    expect((await account(user)).credits).toBe(2)
    expect(one((await db.query<{ n: number }>('select public.reap_reserved() as n')).rows).n).toBe(0)
  })
})

describe('ai_guard', () => {
  const guard = async (user: string, budget: number, rate: number) =>
    one((await db.query<{ g: string }>('select public.ai_guard($1, $2, $3) as g', [user, budget, rate])).rows).g

  it('returns budget when month cost_usd >= budget, rate-limit at 30 in the last hour', async () => {
    const user = await addUser()
    const other = await addUser()
    expect(await guard(user, 5, 30)).toBe('ok')

    await db.query(
      `insert into public.generations (user_id, kind, credits, status, cost_usd)
       select $1, 'cv', 1, 'done', 0.01 from generate_series(1, 29)`,
      [user],
    )
    expect(await guard(user, 5, 30)).toBe('ok')
    await db.query(`insert into public.generations (user_id, kind, credits, status, cost_usd) values ($1, 'cv', 1, 'done', 0.01)`, [user])
    expect(await guard(user, 5, 30)).toBe('rate-limit')
    expect(await guard(other, 5, 30)).toBe('ok') // the rate limit is per user

    // Older than an hour no longer counts toward the rate, but still counts toward the month.
    await db.query(`update public.generations set created_at = now() - interval '2 hours' where user_id = $1`, [user])
    expect(await guard(user, 5, 30)).toBe('ok')
    expect(await guard(other, 0.3, 30)).toBe('budget') // the budget is global: 30 x 0.01 = 0.30
    expect(await guard(other, 0.31, 30)).toBe('ok')
  })

  it('ignores spend from earlier months', async () => {
    const user = await addUser()
    await db.query(
      `insert into public.generations (user_id, kind, credits, status, cost_usd, created_at)
       values ($1, 'cv', 1, 'done', 99, now() - interval '40 days')`,
      [user],
    )
    expect(await guard(user, 5, 30)).toBe('ok')
  })
})

describe('account deletion', () => {
  it('deleting the auth user removes accounts and nulls user_id elsewhere', async () => {
    const user = await addUser()
    await ensureAccount(user)
    const p = await newPurchase(user)
    await pay(p.id)
    await settle(await reserve(user), true)

    await db.query('delete from auth.users where id = $1', [user])

    expect((await db.query('select 1 from public.accounts where user_id = $1', [user])).rows).toHaveLength(0)
    for (const table of ['purchases', 'generations', 'credit_ledger']) {
      const { rows } = await db.query<{ total: number; orphaned: number }>(
        `select count(*)::int as total, count(*) filter (where user_id is null)::int as orphaned from public.${table}`,
      )
      expect(one(rows).total).toBeGreaterThan(0)
      expect(one(rows).orphaned).toBe(one(rows).total)
    }
  })
})
