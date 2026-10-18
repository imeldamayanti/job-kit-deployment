-- Opt-in anonymous usage counts + the private admin view (Fase 3, RFC D18 and D19). Run once in the Supabase SQL editor,
-- after sync.sql. The admin email is set by the owner below; it is NOT in the repo.

-- 1. Counts. No user id, no device id, no free text: a fixed list of names, a day, a version, a count.
create table if not exists public.event_counts (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  name text not null check (name in ('fill', 'application_added', 'cv_built', 'letter_built', 'feed_run', 'sync_run', 'error')),
  day date not null,
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$' and char_length(version) <= 20),
  count integer not null check (count between 1 and 100000)
);

alter table public.event_counts enable row level security;

drop policy if exists "anyone can add counts" on public.event_counts;
create policy "anyone can add counts" on public.event_counts for insert to anon, authenticated with check (true);

revoke all on public.event_counts from anon, authenticated;
grant insert on public.event_counts to anon, authenticated;

-- 2. Who may read the admin numbers. Fill with the owner's own email, once:
--    insert into public.admin_users (email) values ('<your email>');
create table if not exists public.admin_users (email text primary key);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

-- 3. The numbers, for the admin only. Never reads user_data.ciphertext: only user ids and write times.
create or replace function public.admin_stats() returns json
language plpgsql security definer set search_path = '' as $$
declare
  caller text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
begin
  if caller = '' or not exists (select 1 from public.admin_users a where lower(a.email) = caller) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return json_build_object(
    'accounts_total', (select count(*) from auth.users),
    'accounts_new_by_day', coalesce((
      select json_agg(json_build_object('day', d, 'count', c) order by d)
      from (select (created_at at time zone 'utc')::date as d, count(*) as c from auth.users where created_at > now() - interval '30 days' group by 1) t
    ), '[]'::json),
    'accounts_writing_7d', (select count(distinct user_id) from public.user_data where updated_at > now() - interval '7 days' and kind <> 'meta'),
    'events_7d', coalesce((
      select json_agg(json_build_object('name', name, 'version', version, 'count', n) order by name, version)
      from (select name, version, sum(count) as n from public.event_counts where day > (now() - interval '7 days')::date group by 1, 2) t
    ), '[]'::json),
    'events_by_version_30d', coalesce((
      select json_agg(json_build_object('version', version, 'count', n) order by version)
      from (select version, sum(count) as n from public.event_counts where day > (now() - interval '30 days')::date group by 1) t
    ), '[]'::json)
  );
end;
$$;

revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
