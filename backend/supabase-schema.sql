-- ERGOFIT cloud backend: Supabase/Postgres
create extension if not exists pgcrypto;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  client_id text unique not null,
  name text not null,
  job text not null,
  exposures text[] not null default '{}',
  zones text[] not null default '{}',
  fatigue integer not null check (fatigue between 0 and 10),
  duration text,
  alarm text not null default 'no',
  level text,
  created_at timestamptz not null default now(),
  source text not null default 'ergofit-web'
);

create index if not exists registrations_created_at_idx on public.registrations(created_at desc);
create index if not exists registrations_level_idx on public.registrations(level);

alter table public.registrations enable row level security;

drop policy if exists "public can create registration" on public.registrations;
create policy "public can create registration" on public.registrations for insert to anon, authenticated with check (true);

drop policy if exists "authenticated admins can read registrations" on public.registrations;
create policy "authenticated admins can read registrations" on public.registrations for select to authenticated using (true);

drop policy if exists "authenticated admins can update registrations" on public.registrations;
create policy "authenticated admins can update registrations" on public.registrations for update to authenticated using (true) with check (true);

drop policy if exists "authenticated admins can delete registrations" on public.registrations;
create policy "authenticated admins can delete registrations" on public.registrations for delete to authenticated using (true);

alter publication supabase_realtime add table public.registrations;
