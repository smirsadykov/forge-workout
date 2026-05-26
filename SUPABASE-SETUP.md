# Connect FORGE to Supabase

Five minutes to a real cloud backend with multi-device sync. Free tier handles personal use indefinitely.

---

## 1. Create a Supabase project (2 min)

1. Go to https://supabase.com and click **Start your project**
2. Sign up / sign in (GitHub login works)
3. Click **New project**
4. Fill in:
   - **Name:** `forge` (or whatever)
   - **Database password:** click "Generate a password" and **save it somewhere** — you won't need it for the app, but you might later
   - **Region:** pick the one closest to you
   - **Pricing plan:** Free
5. Click **Create new project**. Wait ~2 minutes while it provisions.

## 2. Run the schema (30 sec)

1. In your project dashboard, click **SQL Editor** in the left sidebar.
2. Click **+ New query**.
3. Open `supabase-schema.sql` from this repo, **copy the entire contents**, paste into the editor.
4. Click **Run** (or hit ⌘/Ctrl + Enter). You should see "Success. No rows returned."

This creates four tables (`workouts`, `exercise_stats`, `user_prefs`, `user_loads`) with row-level security so each user only sees their own data.

## 3. Disable email confirmation (optional, recommended for personal use)

By default Supabase sends a confirmation email before letting you sign in. For a personal app you probably want to skip that:

1. Left sidebar → **Authentication** → **Providers** → **Email**
2. Toggle off **Confirm email**
3. Save

Skip this step if you want the security of email-verified accounts.

## 4. Get your credentials (30 sec)

1. Left sidebar → **Project Settings** (gear icon) → **API**
2. Copy two values:
   - **Project URL** — looks like `https://abcdef123456.supabase.co`
   - **anon public key** — long string starting with `eyJ...` (this is safe to expose; row-level security protects data)

## 5. Paste into `config.js` (1 min)

1. Open `config.js` in this repo.
2. Replace the empty strings with your values:
   ```js
   window.FORGE_CONFIG = {
     SUPABASE_URL: "https://abcdef123456.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGc...",
   };
   ```
3. Commit + push:
   ```
   git add config.js
   git commit -m "Enable Supabase backend"
   git push
   ```
4. GitHub Pages redeploys in ~30 seconds. Hard refresh the live site.

## 6. Sign up (10 sec)

- On the live site, click **Sign up**, enter your email + password, click Create account.
- If you disabled email confirmation in step 3, you're logged in immediately.
- Otherwise check your email for a confirmation link, click it, then log in.

---

## What changes once it's connected

- The **Username** field becomes **Email** and accepts a real email address.
- Every workout you save, every set you log, every preference change writes to the cloud in the background.
- Open the app on a different device, log in with the same email + password — all your data is there.
- The `forge:*` localStorage entries still exist as a cache for offline reads.

## Going back to local-only

Empty out the values in `config.js` and push. The app reverts to localStorage-only mode. (Your cloud data stays in Supabase; you can come back any time.)

## Costs

Supabase's free tier:
- 500MB database storage
- 50,000 monthly active users
- 5GB egress per month
- 1GB file storage

A personal FORGE account uses < 1MB. The free tier is permanent and never charges.
