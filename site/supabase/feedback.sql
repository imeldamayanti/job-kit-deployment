-- Feedback from the website form. Run once in the Supabase SQL editor of the project.
-- Visitors (anon) may only INSERT. There is no select, update or delete policy, so nobody but the project owner (dashboard) can read rows.

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('Masalah', 'Saran', 'Lainnya')),
  message text not null check (char_length(message) between 1 and 2000),
  email text check (email is null or char_length(email) <= 254)
);

alter table public.feedback enable row level security;

drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback"
  on public.feedback
  for insert
  to anon
  with check (true);

-- Belt and braces: RLS already blocks reads, and the grants say the same.
revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon;
