-- FORGE — server-side account deletion.
--
-- Google Play requires an in-app path that deletes the user's account AND data.
-- A client (anon key) can delete its own ROWS via RLS, but cannot delete the
-- auth.users record. This SECURITY DEFINER function runs with the definer's
-- privileges (so it can touch auth.users) but only ever acts on auth.uid() —
-- the caller's own id — so it's safe to expose to authenticated users.
--
-- Deploy: paste into Supabase → SQL editor → Run. The app calls it via
-- supabase.rpc('delete_account'). Add any future per-user tables to the list.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Delete user data. Add new per-user tables here as the schema grows.
  delete from public.workouts           where user_id = uid;
  delete from public.user_prefs         where user_id = uid;
  begin
    delete from public.user_subscriptions where user_id = uid;
  exception when undefined_table then null;
  end;
  begin
    delete from public.client_errors    where user_id = uid;
  exception when undefined_table then null;
  end;

  -- Finally remove the auth user (cascades sessions/identities).
  delete from auth.users where id = uid;
end;
$$;

-- Allow signed-in users to call it; block anonymous.
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
