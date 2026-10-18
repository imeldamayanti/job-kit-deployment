// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EVENT_NAMES } from './events'

const sql = readFileSync(join(__dirname, '../../../supabase/telemetry.sql'), 'utf8')

describe('supabase/telemetry.sql', () => {
  it('allows exactly the names the extension can send', () => {
    const listed = [...(sql.match(/name in \(([^)]*)\)/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(listed).toEqual([...EVENT_NAMES])
  })

  it('stores no identifier and no free text', () => {
    const table = sql.slice(sql.indexOf('create table if not exists public.event_counts'), sql.indexOf(');', sql.indexOf('create table if not exists public.event_counts')))
    expect(table).not.toMatch(/user_id|device|session|email|message|url|ip\b/i)
  })

  it('lets visitors insert counts and nothing else', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('grant insert on public.event_counts to anon, authenticated')
    expect(sql).not.toMatch(/on public\.event_counts for (select|update|delete|all)/)
  })

  it('admin_stats only answers a signed-in admin from admin_users, with no email in the repo', () => {
    expect(sql).toContain('security definer set search_path')
    expect(sql).toContain("raise exception 'not allowed'")
    expect(sql).toContain('revoke all on function public.admin_stats() from public, anon')
    expect(sql).toContain('grant execute on function public.admin_stats() to authenticated')
    expect(sql).not.toMatch(/values \('[^<']+@/)
  })

  it('never reads the encrypted column', () => {
    const fn = sql.slice(sql.indexOf('create or replace function public.admin_stats'))
    expect(fn).not.toContain('ciphertext')
  })

  it('keeps admin_users unreadable by app roles', () => {
    expect(sql).toContain('revoke all on public.admin_users from anon, authenticated')
  })
})
