-- TEST ONLY. Stand-in for the parts of Supabase Auth that billing.sql depends on, so the
-- schema can run in pglite. Never run this against a real Supabase project.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key
);

-- Same contract as Supabase: the signed-in user comes from the request's JWT claims.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;
