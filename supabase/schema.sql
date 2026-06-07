-- FinDesk Supabase Schema
-- Run this in the Supabase SQL editor for your findesk project

-- ── Enable required extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── profiles (auto-created on signup) ───────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── analyses (saved company P&L + balance sheet) ────────────────────────────
create table if not exists public.analyses (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users on delete cascade,
  ticker              text not null,
  note                text,
  income_statements   jsonb,   -- IncomeStatement[]
  balance_sheets      jsonb,   -- BalanceSheet[]
  saved_at            timestamptz not null default now(),
  created_at          timestamptz default now()
);

create index if not exists analyses_user_id_idx   on public.analyses (user_id);
create index if not exists analyses_ticker_idx     on public.analyses (ticker);
create index if not exists analyses_saved_at_idx   on public.analyses (saved_at desc);

alter table public.analyses enable row level security;

create policy "Users can manage own analyses"
  on public.analyses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── stress_tests (saved credit stress models) ────────────────────────────────
create table if not exists public.stress_tests (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users on delete cascade,
  base        jsonb not null,    -- StressBaseInputs
  assumptions jsonb not null,    -- StressAssumptions
  result      jsonb,             -- StressResult
  saved_at    timestamptz not null default now(),
  created_at  timestamptz default now()
);

create index if not exists stress_tests_user_id_idx on public.stress_tests (user_id);
create index if not exists stress_tests_saved_at_idx on public.stress_tests (saved_at desc);

alter table public.stress_tests enable row level security;

create policy "Users can manage own stress tests"
  on public.stress_tests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── watchlists (optional future use) ────────────────────────────────────────
create table if not exists public.watchlists (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users on delete cascade,
  tickers    text[] not null default '{}',
  updated_at timestamptz default now()
);

alter table public.watchlists enable row level security;

create policy "Users can manage own watchlist"
  on public.watchlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
