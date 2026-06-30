-- FORGE Pro — subscription state synced from RevenueCat webhooks.
--
-- Design: one row per Supabase user, written ONLY by the webhook (service
-- role bypass). The client reads its own row via RLS but never writes;
-- the source of truth is RevenueCat → webhook → this table.
--
-- The webhook (supabase/functions/revenuecat-webhook) translates every RC
-- event (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION,
-- BILLING_ISSUE, PRODUCT_CHANGE) into an UPSERT on this row. The client
-- subscription helpers in app.js read it on session resume + after any
-- entitlement-change SDK event.
--
-- Run this once in your Supabase project: SQL editor → paste → Run.

create table if not exists public.user_subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  -- "free" | "trial" | "pro" — driven by entitlement state, not subscription
  -- product. A user with an active trial reads as "trial"; a paid renewal
  -- reads as "pro"; both unlock the same feature gates.
  status             text not null default 'free' check (status in ('free','trial','pro')),
  product_id         text,        -- forge.pro.monthly | forge.pro.yearly | null
  expires_at         timestamptz, -- next renewal or trial-end timestamp
  -- RevenueCat appUserID — for traceability when debugging webhook flow.
  -- Same value as user_id in our case (we identify with Supabase UUID).
  rc_app_user_id     text,
  -- Latest RC event we processed; useful for debugging "why is my user free?"
  last_event_type    text,
  last_event_at      timestamptz default now(),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- Auto-touch updated_at on every write.
create or replace function public.touch_user_subscriptions()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_user_subscriptions_trigger on public.user_subscriptions;
create trigger touch_user_subscriptions_trigger
  before update on public.user_subscriptions
  for each row execute function public.touch_user_subscriptions();

-- RLS: user can read their own row only. Writes are blocked for everyone
-- except the service role (which the Edge Function uses).
alter table public.user_subscriptions enable row level security;

drop policy if exists "Users read own subscription" on public.user_subscriptions;
create policy "Users read own subscription"
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

-- Insert/update/delete all blocked at the row level — only service role
-- bypasses RLS. No matching policy = denied by default.

-- Helpful index for the webhook's UPSERT path (primary key already
-- covers user_id, but rc_app_user_id is a secondary lookup when
-- debugging "this RC user maps to which Supabase user").
create index if not exists idx_user_subscriptions_rc_app_user_id
  on public.user_subscriptions(rc_app_user_id)
  where rc_app_user_id is not null;
