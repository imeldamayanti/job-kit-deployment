-- job-kit sync (Fase 2, RFC D17). Run once in the Supabase SQL editor.
-- The server only ever holds ciphertext. Row Level Security: a user reads and writes only their own rows.

create table if not exists public.user_data (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 'meta' holds the key salt and a check value (public by design); the rest hold encrypted data.
  kind text not null check (kind in ('meta', 'profile', 'applications', 'cvs', 'letters')),
  ciphertext text not null check (char_length(ciphertext) <= 4000000),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.user_data enable row level security;

drop policy if exists "own rows: select" on public.user_data;
drop policy if exists "own rows: insert" on public.user_data;
drop policy if exists "own rows: update" on public.user_data;
drop policy if exists "own rows: delete" on public.user_data;

create policy "own rows: select" on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.user_data for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;

-- updated_at is the server's clock, so a wrong clock on a device cannot win a conflict.
create or replace function public.touch_user_data() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.user_id = coalesce(new.user_id, auth.uid());
  return new;
end;
$$;

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch before insert or update on public.user_data
  for each row execute function public.touch_user_data();

-- "Hapus akun": removes the login and, through on delete cascade, every row. Callable only by the signed-in user, for themselves.
create or replace function public.delete_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
