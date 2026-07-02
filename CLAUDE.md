# FORGE — Claude working context

Read this first. It's the shared catch-up doc for **every Claude session on this repo** (there are several, on different machines — desktop + iOS). Keep the **Status** section current when you land something big.

## ⚠️ Multi-session coordination (read before any git op)
- **Multiple Claude instances commit to `main` in parallel.** Always `git fetch origin` and check `origin/main` **before** pushing. Expect divergence.
- **`main` is canonical.** Never force-push it. If you diverge, rebase/merge onto `origin/main`; if changes conflict conceptually (e.g. two implementations of the same feature), stop and ask the user rather than guessing.
- Commit in small, self-describing units. Update the **Status** section below in the same commit when you finish a milestone, so the next instance sees it.
- No attribution/co-author trailers in commits (user preference).

## What FORGE is
Workout-generator app. **Vanilla JS static PWA, no bundler/build step** — plain `<script>` files sharing global scope. Wrapped for **Android + iOS via Capacitor**. App id: `app.forge.workout`. Web/PWA on GitHub Pages.

Core files: `index.html`, `app.js` (the monolith, ~9k lines), `i18n.js` (EN/RU `DICT` + `t(key,params)` + `applyI18n`), `exercises.js`, `styles.css`, `config.js` (Supabase + RevenueCat keys), `lib/` (utils, native, revenuecat), `sw.js` (network-first SW; bump `CACHE_NAME` + the `?v=` query in index.html when you change JS/CSS).

Data: `localStorage` (per-user keyed stores in `STORAGE_KEYS`) + **Supabase** cloud sync (auth + Postgres, RLS). `HAS_SUPABASE` gates cloud paths.

## Tests
`?test=1` runs the in-browser harness → `window.__FORGE_TEST_RESULTS__` (invariants + a 5040-combo generator sweep). **Baseline: 90 passing, 0 failing.** Keep it green. Preview via `.claude/launch.json` (`py -m http.server 8777`). Note: the browser console retains stale FAIL lines across reloads — trust `__FORGE_TEST_RESULTS__`, not old console errors.

## Monetization (SHIPPED)
Freemium that **gates saves, not generation**:
- **Free:** unlimited generation + logging + **3 saved workouts / rolling 7 days**.
- **Pro — $4.99/mo or $29.99/yr, 7-day trial:** unlimited saves + smart-intensity + body map + program mode + auto-progression + **cross-device sync**.
- Billing: **RevenueCat** (`lib/revenuecat.js`), entitlement drives `SubState`. Backend: `supabase/functions/revenuecat-webhook/` + `supabase/migrations/*_user_subscriptions.sql`. Paywall = `#paywall` modal; `showPaywall({trigger})`.

## Status (updated 2026-07-01)
Legend: ✅ done · ⏳ in progress · ⬜ not started (needs user/account)

**Shipped on `main`:**
- ✅ Web app + generator + logging + progression + history (mature)
- ✅ Capacitor Android; **signed release AAB build** (target API 35, Gradle 8.9/AGP 8.7.2). `android/` is committed with signing wired to `android/keystore.properties` (gitignored). **Desktop-machine build toolchain (2026-07-02):** JDK 21 at `~/.local-jdk/jdk-21.0.11+10` (Gradle 8.9 rejects the system JDK 25), Android SDK 35 + build-tools 35.0.0 installed, `ANDROID_HOME=~/Library/Android/sdk`. Build cmd: `export JAVA_HOME=~/.local-jdk/jdk-21.0.11+10/Contents/Home ANDROID_HOME=~/Library/Android/sdk; cd android && ./gradlew bundleRelease`. **Upload keystore** `android/forge-upload.keystore` (gitignored, backed up to `~/.forge-signing/`), alias `forge`, SHA256 `DC:89:CE:93:2A:9B:37:BB:...` — Play App Signing manages the real key, so this upload key is resettable if lost. Latest AAB: `~/Downloads/FORGE-Body-release.aab`.
- ✅ Monetization: paywall + save-gating + RevenueCat code + Supabase webhook + `user_subscriptions`
- ✅ **In-app account deletion** (Settings → Account) + `supabase/delete_account.sql` + `delete-account.html` — required by BOTH Play and App Store
- ✅ Legal/store: `privacy.html`, `terms.html`, `delete-account.html`, `store/listing.md` (App Store + Play copy), generated `assets/icon-*`/`splash.*`, `store/feature-graphic.*`
- ✅ iOS: `ios/App/App/PrivacyInfo.xcprivacy`; RevenueCat is cross-platform

**Pending — engineering:**
- ⏳ **iOS release build**: `npx cap add ios` on macOS + Xcode; App Store Connect setup. See `SETUP-IAP.md`. (Android release build is DONE — see above.)

**Pending — user/accounts:**
- ⬜ RevenueCat: create project, entitlement + offering, paste **public API key** into `config.js` (`REVENUECAT_API_KEY`), add Play/App Store credentials, deploy `revenuecat-webhook`.
- ⬜ Supabase: run `supabase/delete_account.sql` + the `user_subscriptions` migration.
- ⬜ Play Console: subscription products, Data Safety, **Privacy URL** + **Account-deletion URL** (both ready), closed test (personal accts: 12 testers / 14 days).
- ⬜ **Before submission (both stores)**: seed the review-only account as Pro so reviewers get full access without a sandbox purchase. Review acct email pattern: `smirsadykov+googleplay@gmail.com` / `smirsadykov+appstoreconnect@gmail.com`. SQL to run in Supabase once accounts exist:
  ```sql
  INSERT INTO user_subscriptions (user_id, status, product_id, expires_at)
  SELECT id, 'pro', 'forge.pro.yearly', '2030-12-31'::timestamptz
  FROM auth.users WHERE email LIKE 'smirsadykov+%@gmail.com'
  ON CONFLICT (user_id) DO UPDATE
    SET status='pro', expires_at='2030-12-31'::timestamptz;
  ```
- ⬜ App Store Connect: matching subscription products, privacy nutrition labels, review.

## Publishing URLs (live once GitHub Pages is enabled)
- Privacy: `https://smirsadykov.github.io/forge-workout/privacy.html`
- Terms: `.../terms.html`
- Account deletion: `.../delete-account.html`

## Setup docs
`SETUP-ANDROID.md` · `SETUP-IAP.md` · `SUPABASE-SETUP.md` · `store/listing.md`. The user also keeps a fuller project record in an Obsidian vault (`Main vault/FORGE/`) — not in the repo.

## iOS-publishing note (for the iOS instance)
Everything you need is already in the repo/`main`: RevenueCat is cross-platform (same entitlement), the App Store store copy is in `store/listing.md`, the iOS **PrivacyInfo.xcprivacy** exists, and **in-app account deletion is done** (App Store §5.1.1(v) requires it — the web app powers it on both platforms). Remaining iOS-specific work: `cap add ios`, App Store Connect products matching the RevenueCat product ids, privacy nutrition labels, and signing/upload via Xcode. Coordinate through `main` — pull before you push.
