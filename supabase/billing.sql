-- job-kit billing (monetisasi, design section 5.3). Run once in the Supabase SQL editor, after sync.sql
-- (delete_account() lives there). Safe to run again.
-- Clients may only READ their own rows. Every write goes through a security definer function that
-- only service_role (the Edge Functions) can call; ensure_account() is the one function users call themselves.

-- packages: what can be bought. Readable by everyone, price is all-in (what shows is what is paid).
create table if not exists public.packages (
  id text primary key,
  price_idr integer not null check (price_idr > 0),
  credits integer not null check (credits > 0),
  active boolean not null default true
);

insert into public.packages (id, price_idr, credits, active) values
  ('basic', 10800, 50, true)
on conflict (id) do nothing;

-- accounts: one balance per user. credits_expire_at covers the WHOLE balance.
create table if not exists public.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  unlocked_at timestamptz,
  trial_granted_at timestamptz,
  credits_expire_at timestamptz,
  created_at timestamptz not null default now()
);

-- purchases: id is the first part of the order_id sent to the payment gateway. Kept (user_id null) after account deletion.
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  package_id text not null references public.packages (id),
  amount_idr integer not null,
  credits integer not null,
  status text not null check (status in ('pending', 'paid', 'expired', 'failed', 'mismatch')),
  gateway_reference text unique,
  qr_url text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- generations: one row per AI call. Never stores the prompt or the result.
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('cv', 'letter', 'score')),
  credits integer not null,
  status text not null check (status in ('reserved', 'done', 'refunded')),
  refund_reason text,
  model text,
  in_tokens integer,
  out_tokens integer,
  cost_usd numeric(10, 6),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- credit_ledger: audit trail. Per account, sum(delta) always equals accounts.credits.
create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  delta integer not null,
  reason text not null check (reason in ('purchase', 'trial', 'generate', 'refund', 'admin_grant', 'expire')),
  purchase_id uuid references public.purchases (id),
  generation_id uuid references public.generations (id),
  created_at timestamptz not null default now()
);

-- Indexes for the foreign keys that account deletion nulls out, and for the guard and the reaper.
create index if not exists purchases_user_idx on public.purchases (user_id, status);
create index if not exists generations_user_idx on public.generations (user_id, created_at);
create index if not exists generations_created_idx on public.generations (created_at);
create index if not exists generations_reserved_idx on public.generations (created_at) where status = 'reserved';
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id);
create index if not exists accounts_expiry_idx on public.accounts (credits_expire_at) where credits > 0;

-- Row Level Security: read-only, own rows.
alter table public.packages enable row level security;
alter table public.accounts enable row level security;
alter table public.purchases enable row level security;
alter table public.generations enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists "packages: select" on public.packages;
drop policy if exists "own rows: select" on public.accounts;
drop policy if exists "own rows: select" on public.purchases;
drop policy if exists "own rows: select" on public.generations;
drop policy if exists "own rows: select" on public.credit_ledger;

create policy "packages: select" on public.packages
  for select to anon, authenticated using (true);
create policy "own rows: select" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: select" on public.purchases
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: select" on public.generations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: select" on public.credit_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.packages from anon, authenticated;
revoke all on public.accounts from anon, authenticated;
revoke all on public.purchases from anon, authenticated;
revoke all on public.generations from anon, authenticated;
revoke all on public.credit_ledger from anon, authenticated;
grant select on public.packages to anon, authenticated;
grant select on public.accounts to authenticated;
grant select on public.purchases to authenticated;
grant select on public.generations to authenticated;
grant select on public.credit_ledger to authenticated;

-- ensure_account: called by the signed-in user. Creates their account row and, once per account,
-- gives 3 trial credits valid for a year, unless 30 trials were already given today (Jakarta time).
create or replace function public.ensure_account() returns public.accounts
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_acct public.accounts;
  v_given integer;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  insert into public.accounts (user_id) values (v_user) on conflict (user_id) do nothing;
  select * into v_acct from public.accounts where user_id = v_user for update;

  if v_acct.trial_granted_at is null then
    -- One lock for the daily quota, so concurrent sign-ups cannot all slip under the cap.
    perform pg_advisory_xact_lock(hashtext('billing.trial-quota'));
    select count(*) into v_given from public.accounts
      where (trial_granted_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date;
    if v_given < 30 then
      update public.accounts
        set credits = credits + 3,
            trial_granted_at = now(),
            credits_expire_at = greatest(coalesce(credits_expire_at, now()), now() + interval '1 year')
        where user_id = v_user
        returning * into v_acct;
      insert into public.credit_ledger (user_id, delta, reason) values (v_user, 3, 'trial');
    end if;
  end if;

  return v_acct;
end;
$$;

-- reserve_credits: takes the credits up front under a row lock. Raises 'insufficient' or 'expired'.
create or replace function public.reserve_credits(p_user uuid, p_kind text, p_cost integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_acct public.accounts;
  v_id uuid;
begin
  if p_cost is null or p_cost <= 0 then
    raise exception 'invalid_cost';
  end if;

  select * into v_acct from public.accounts
    where user_id = p_user
    for update;

  if not found then
    raise exception 'insufficient';
  end if;
  -- An overdue balance is refused even if expire_credits() has not swept it yet.
  if v_acct.credits > 0 and v_acct.credits_expire_at is not null and v_acct.credits_expire_at < now() then
    raise exception 'expired';
  end if;
  if v_acct.credits < p_cost then
    raise exception 'insufficient';
  end if;

  update public.accounts set credits = credits - p_cost where user_id = p_user;
  insert into public.generations (user_id, kind, credits, status)
    values (p_user, p_kind, p_cost, 'reserved') returning id into v_id;
  insert into public.credit_ledger (user_id, delta, reason, generation_id)
    values (p_user, -p_cost, 'generate', v_id);
  return v_id;
end;
$$;

-- settle_generation: ok keeps the charge; not ok gives the credits back. Only a 'reserved' row changes,
-- so calling it twice has no second effect. Returns the balance afterwards.
create or replace function public.settle_generation(
  p_id uuid, p_ok boolean, p_refund_reason text, p_model text, p_in integer, p_out integer, p_cost numeric
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_gen public.generations;
  v_balance integer;
begin
  select * into v_gen from public.generations where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_gen.status = 'reserved' then
    if p_ok then
      update public.generations
        set status = 'done', model = p_model, in_tokens = p_in, out_tokens = p_out,
            cost_usd = p_cost, finished_at = now()
        where id = p_id;
    else
      update public.generations
        set status = 'refunded', refund_reason = p_refund_reason, model = p_model, in_tokens = p_in,
            out_tokens = p_out, cost_usd = p_cost, finished_at = now()
        where id = p_id;
      -- user_id is null once the account was deleted: nothing to give back to.
      if v_gen.user_id is not null then
        update public.accounts set credits = credits + v_gen.credits where user_id = v_gen.user_id;
        insert into public.credit_ledger (user_id, delta, reason, generation_id)
          values (v_gen.user_id, v_gen.credits, 'refund', p_id);
      end if;
    end if;
  end if;

  select credits into v_balance from public.accounts where user_id = v_gen.user_id;
  return coalesce(v_balance, 0);
end;
$$;

-- ai_guard: checked before reserve_credits. 'budget' = this month's AI spend (all users, Jakarta calendar
-- month) reached the ceiling; 'rate-limit' = this user made p_rate or more calls in the last hour.
create or replace function public.ai_guard(p_user uuid, p_budget_usd numeric, p_rate integer) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  v_spent numeric;
  v_recent integer;
begin
  select coalesce(sum(cost_usd), 0) into v_spent from public.generations where created_at >= v_month_start;
  if v_spent >= p_budget_usd then
    return 'budget';
  end if;

  select count(*) into v_recent from public.generations
    where user_id = p_user and created_at > now() - interval '1 hour';
  if v_recent >= p_rate then
    return 'rate-limit';
  end if;

  return 'ok';
end;
$$;

-- create_purchase: the user's still-valid pending purchase for this package, or a new one (30 minutes).
create or replace function public.create_purchase(p_user uuid, p_package text) returns public.purchases
language plpgsql security definer set search_path = '' as $$
declare
  v_pkg public.packages;
  v_purchase public.purchases;
begin
  select * into v_pkg from public.packages where id = p_package and active;
  if not found then
    raise exception 'unknown_package';
  end if;

  -- The account row is the lock that serialises concurrent calls for one user.
  insert into public.accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  perform 1 from public.accounts where user_id = p_user for update;

  select * into v_purchase from public.purchases
    where user_id = p_user and package_id = p_package and status = 'pending' and expires_at > now()
    order by created_at desc limit 1;
  if found then
    return v_purchase;
  end if;

  insert into public.purchases (user_id, package_id, amount_idr, credits, status, expires_at)
    values (p_user, v_pkg.id, v_pkg.price_idr, v_pkg.credits, 'pending', now() + interval '30 minutes')
    returning * into v_purchase;
  return v_purchase;
end;
$$;

-- attach_gateway: records the gateway's reference and QR image on a pending purchase, first writer wins. A purchase has one
-- recorded QR: when a concurrent call already attached one, nothing is overwritten. Returns the recorded QR image, which is
-- the one the caller must show, whether it was just written or was there already.
create or replace function public.attach_gateway(p_purchase uuid, p_reference text, p_qr_url text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_qr text;
begin
  update public.purchases set gateway_reference = p_reference, qr_url = p_qr_url
    where id = p_purchase and status = 'pending' and gateway_reference is null
    returning qr_url into v_qr;
  if found then
    return v_qr;
  end if;

  select qr_url into v_qr from public.purchases where id = p_purchase and qr_url is not null;
  if not found then
    raise exception 'not_found';
  end if;
  return v_qr;
end;
$$;

-- apply_payment: the gateway's callback. Only a 'pending', 'expired' or 'failed' purchase can change, so a repeated
-- callback has no second effect. PAID with the right amount credits the balance, even after 'expired' or 'failed'
-- (the money was received). A different amount becomes 'mismatch' and credits nothing. EXPIRED and FAILED only end a
-- pending purchase, and only when they come from the recorded gateway transaction (an orphan charge's must not end it).
-- A balance past its expiry that the daily sweep has not zeroed yet is zeroed (with an 'expire' ledger row) before
-- the purchased credits are added, so a purchase never revives credits that were already lost.
-- Returns the final status, or 'duplicate' when a PAID callback names another gateway transaction than the one
-- that already paid the purchase (a second charge was paid: nothing is credited, the caller reports it).
create or replace function public.apply_payment(p_purchase uuid, p_reference text, p_status text, p_amount integer) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.purchases;
  v_status text := upper(p_status);
  v_credits integer;
  v_expires timestamptz;
begin
  select * into v_p from public.purchases where id = p_purchase for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_p.status not in ('pending', 'expired', 'failed') then
    if v_p.status = 'paid' and v_status = 'PAID' and v_p.gateway_reference is distinct from p_reference then
      return 'duplicate';
    end if;
    return v_p.status;
  end if;

  if v_status = 'PAID' then
    if p_amount is distinct from v_p.amount_idr then
      update public.purchases set status = 'mismatch', gateway_reference = coalesce(gateway_reference, p_reference)
        where id = p_purchase;
      return 'mismatch';
    end if;

    update public.purchases
      set status = 'paid', paid_at = now(), gateway_reference = coalesce(gateway_reference, p_reference)
      where id = p_purchase;
    -- user_id is null once the account was deleted: the payment is recorded, there is nobody to credit.
    if v_p.user_id is not null then
      insert into public.accounts (user_id) values (v_p.user_id) on conflict (user_id) do nothing;
      select credits, credits_expire_at into v_credits, v_expires from public.accounts where user_id = v_p.user_id for update;
      if v_credits > 0 and v_expires < now() then
        insert into public.credit_ledger (user_id, delta, reason) values (v_p.user_id, -v_credits, 'expire');
        update public.accounts set credits = 0 where user_id = v_p.user_id;
      end if;
      update public.accounts
        set credits = credits + v_p.credits,
            unlocked_at = coalesce(unlocked_at, now()),
            credits_expire_at = now() + interval '1 year'
        where user_id = v_p.user_id;
      insert into public.credit_ledger (user_id, delta, reason, purchase_id)
        values (v_p.user_id, v_p.credits, 'purchase', p_purchase);
    end if;
    return 'paid';
  end if;

  -- EXPIRED and FAILED only end a pending purchase, and only for the transaction on record (none recorded yet counts as
  -- a match). A different one is an orphan charge, e.g. a QR that was created but never attached. Anything else
  -- (UNPAID, REFUND) changes nothing.
  if v_p.status = 'pending' and v_status in ('EXPIRED', 'FAILED')
     and (v_p.gateway_reference is null or v_p.gateway_reference = p_reference) then
    update public.purchases set status = lower(v_status) where id = p_purchase;
    return lower(v_status);
  end if;

  return v_p.status;
end;
$$;

-- expire_credits (daily, pg_cron): zeroes balances past credits_expire_at and records it.
create or replace function public.expire_credits() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_touched integer;
begin
  with due as (
    select user_id, credits from public.accounts
      where credits > 0 and credits_expire_at < now()
      for update
  ), zeroed as (
    update public.accounts a set credits = 0 from due d where a.user_id = d.user_id returning a.user_id
  ), logged as (
    insert into public.credit_ledger (user_id, delta, reason)
      select user_id, -credits, 'expire' from due
  )
  select count(*) into v_touched from zeroed;
  return v_touched;
end;
$$;

-- reap_reserved (every 5 minutes, pg_cron): a generation still 'reserved' after 10 minutes means the
-- function died before settling. Give the credits back.
create or replace function public.reap_reserved() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_touched integer := 0;
begin
  for v_id in
    select id from public.generations
      where status = 'reserved' and created_at < now() - interval '10 minutes'
      for update skip locked
  loop
    perform public.settle_generation(v_id, false, 'reaped', null, null, null, null);
    v_touched := v_touched + 1;
  end loop;
  return v_touched;
end;
$$;

revoke all on function public.ensure_account() from public, anon;
grant execute on function public.ensure_account() to authenticated;

revoke all on function public.reserve_credits(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_credits(uuid, text, integer) to service_role;
revoke all on function public.settle_generation(uuid, boolean, text, text, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.settle_generation(uuid, boolean, text, text, integer, integer, numeric) to service_role;
revoke all on function public.ai_guard(uuid, numeric, integer) from public, anon, authenticated;
grant execute on function public.ai_guard(uuid, numeric, integer) to service_role;
revoke all on function public.create_purchase(uuid, text) from public, anon, authenticated;
grant execute on function public.create_purchase(uuid, text) to service_role;
revoke all on function public.attach_gateway(uuid, text, text) from public, anon, authenticated;
grant execute on function public.attach_gateway(uuid, text, text) to service_role;
revoke all on function public.apply_payment(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid, text, text, integer) to service_role;
revoke all on function public.expire_credits() from public, anon, authenticated;
grant execute on function public.expire_credits() to service_role;
revoke all on function public.reap_reserved() from public, anon, authenticated;
grant execute on function public.reap_reserved() to service_role;
