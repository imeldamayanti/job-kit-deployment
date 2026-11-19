// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(__dirname, '../../../supabase/billing.sql'), 'utf8')
const cron = readFileSync(join(__dirname, '../../../supabase/billing-cron.sql'), 'utf8')

const TABLES = ['packages', 'accounts', 'purchases', 'generations', 'credit_ledger']
const SERVICE_FUNCTIONS = [
  'reserve_credits',
  'settle_generation',
  'ai_guard',
  'create_purchase',
  'attach_tripay',
  'apply_payment',
  'expire_credits',
  'reap_reserved',
]

describe('supabase/billing.sql', () => {
  it('turns on RLS on all five tables', () => {
    for (const t of TABLES) expect(sql).toContain(`alter table public.${t} enable row level security`)
  })

  it('has only select policies, scoped to the owner (packages: readable by everyone)', () => {
    const policies = [...sql.matchAll(/create policy "[^"]+" on public\.(\w+)\s+for (\w+)[^;]*;/g)]
    expect(policies).toHaveLength(TABLES.length)
    for (const [, , op] of policies) expect(op).toBe('select')
    for (const [stmt, table] of policies) {
      if (table === 'packages') expect(stmt).toContain('using (true)')
      else expect(stmt).toContain('using ((select auth.uid()) = user_id)')
    }
    expect(sql).not.toMatch(/create policy[^;]*for (insert|update|delete|all)/)
    expect(sql).not.toMatch(/with check/)
  })

  it('never grants insert, update or delete to anon or authenticated', () => {
    expect(sql).not.toMatch(/grant[^;]*\b(insert|update|delete|all)\b[^;]*to[^;]*\b(anon|authenticated)\b/i)
    for (const t of TABLES) expect(sql).toContain(`revoke all on public.${t} from anon, authenticated`)
    expect(sql).toContain('grant select on public.packages to anon, authenticated')
  })

  it('locks every service function to service_role', () => {
    for (const f of SERVICE_FUNCTIONS) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon, authenticated;`))
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role;`))
    }
  })

  it('ensure_account is for signed-in users only', () => {
    expect(sql).toContain('revoke all on function public.ensure_account() from public, anon;')
    expect(sql).toContain('grant execute on function public.ensure_account() to authenticated;')
    expect(sql).toContain('(select auth.uid())')
  })

  it('every function is security definer with an empty search_path', () => {
    const fns = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1])
    expect(fns.sort()).toEqual([...SERVICE_FUNCTIONS, 'ensure_account'].sort())
    expect(sql.match(/security definer set search_path = ''/g)).toHaveLength(fns.length)
  })

  it('locks the account row before it changes a balance', () => {
    expect(sql).toMatch(/from public\.accounts\s+where user_id = p_user\s+for update/)
  })

  it('seeds the single package at the all-in price, with no admin fee', () => {
    expect(sql).toContain("('basic', 10800, 50, true)")
    // The packages table and its seed sit together, ahead of accounts.
    const pricing = sql.slice(sql.indexOf('create table if not exists public.packages'), sql.indexOf('create table if not exists public.accounts'))
    expect(pricing).toContain('10800')
    expect(pricing).not.toMatch(/admin/i)
  })

  it('keeps purchase, generation and ledger records after the account is deleted', () => {
    expect(sql.match(/references auth\.users \(id\) on delete set null/g)).toHaveLength(3)
    expect(sql).toContain('references auth.users (id) on delete cascade')
  })

  it('accepts the trial and expire ledger reasons', () => {
    expect(sql).toContain("('purchase', 'trial', 'generate', 'refund', 'admin_grant', 'expire')")
  })
})

describe('supabase/billing-cron.sql', () => {
  it('schedules the reaper every 5 minutes and the expiry daily at 00:15 WIB', () => {
    expect(cron).toContain("cron.schedule('reap-reserved', '*/5 * * * *', 'select public.reap_reserved()')")
    expect(cron).toContain("cron.schedule('expire-credits', '15 17 * * *', 'select public.expire_credits()')")
  })
})
