-- ════════════════════════════════════════════════════════════════════════
-- FORGE — Supabase schema
-- Run this once in your Supabase project's SQL Editor (one-shot).
-- ════════════════════════════════════════════════════════════════════════

-- ─── TABLES ─────────────────────────────────────────────────────────────

-- One row per saved workout. The full workout shape (inputs, exercises,
-- prescriptions) is stored as JSONB so the schema doesn't need to change
-- when the generator evolves.
create table if not exists public.workouts (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now()
);
create index if not exists workouts_user_created_idx
  on public.workouts (user_id, created_at desc);

-- One row per user × exercise. Latest weight/reps/date are denormalized
-- columns for quick "last session" lookups; full history lives in JSONB.
create table if not exists public.exercise_stats (
  user_id uuid references auth.users(id) on delete cascade not null,
  exercise_name text not null,
  weight_kg numeric default 0,
  reps int default 0,
  date timestamptz default now(),
  history jsonb default '[]'::jsonb,
  primary key (user_id, exercise_name)
);

-- One row per user: kg/lb preference (extensible to other prefs later).
create table if not exists public.user_prefs (
  user_id uuid references auth.users(id) on delete cascade primary key,
  units text default 'kg',
  updated_at timestamptz default now()
);

-- One row per user: heaviest available equipment loads.
create table if not exists public.user_loads (
  user_id uuid references auth.users(id) on delete cascade primary key,
  max_dumbbell_kg numeric default 0,
  max_kettlebell_kg numeric default 0,
  has_heavy_barbell boolean default false,
  updated_at timestamptz default now()
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────
-- Every user can only read/write their own rows. Without this, the anon
-- key in your client could read anyone's data.

alter table public.workouts        enable row level security;
alter table public.exercise_stats  enable row level security;
alter table public.user_prefs      enable row level security;
alter table public.user_loads      enable row level security;

-- Workouts
drop policy if exists "own workouts select" on public.workouts;
drop policy if exists "own workouts insert" on public.workouts;
drop policy if exists "own workouts update" on public.workouts;
drop policy if exists "own workouts delete" on public.workouts;

create policy "own workouts select" on public.workouts
  for select using (auth.uid() = user_id);
create policy "own workouts insert" on public.workouts
  for insert with check (auth.uid() = user_id);
create policy "own workouts update" on public.workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workouts delete" on public.workouts
  for delete using (auth.uid() = user_id);

-- Exercise stats
drop policy if exists "own stats all" on public.exercise_stats;
create policy "own stats all" on public.exercise_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Prefs
drop policy if exists "own prefs all" on public.user_prefs;
create policy "own prefs all" on public.user_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Loads
drop policy if exists "own loads all" on public.user_loads;
create policy "own loads all" on public.user_loads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
