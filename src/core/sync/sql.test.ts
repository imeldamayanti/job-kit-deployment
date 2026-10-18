// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(__dirname, '../../../supabase/sync.sql'), 'utf8')

describe('supabase/sync.sql', () => {
  it('turns on RLS and scopes every operation to the owner', () => {
    expect(sql).toContain('enable row level security')
    for (const op of ['select', 'insert', 'update', 'delete']) expect(sql).toContain(`"own rows: ${op}"`)
    expect(sql.match(/auth\.uid\(\)\) = user_id/g)?.length).toBeGreaterThanOrEqual(5)
  })

  it('gives anon nothing and never opens a policy to everyone', () => {
    expect(sql).toContain('revoke all on public.user_data from anon')
    expect(sql).not.toMatch(/using \(true\)|with check \(true\)/)
    expect(sql).not.toMatch(/to anon/)
  })

  it('uses the server clock for updated_at and cascades on account deletion', () => {
    expect(sql).toContain('new.updated_at = now()')
    expect(sql).toContain('on delete cascade')
  })

  it('delete_account is security definer with a fixed search_path, for the caller only, not callable by anon', () => {
    expect(sql).toContain('security definer set search_path')
    expect(sql).toContain('where id = (select auth.uid())')
    expect(sql).toContain('revoke all on function public.delete_account() from public, anon')
    expect(sql).toContain('grant execute on function public.delete_account() to authenticated')
  })

  it('allows only the five known kinds', () => {
    expect(sql).toContain("('meta', 'profile', 'applications', 'cvs', 'letters')")
  })
})
