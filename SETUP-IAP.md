# FORGE Pro — In-App Purchase setup

Step-by-step runbook for wiring real subscriptions via RevenueCat on iOS + Android. Everything below complements `SETUP-ANDROID.md` (which covers the Android build itself).

App config (don't change without updating code too):
- **Bundle ID / Package**: `app.forge.workout`
- **Product IDs**: `forge.pro.monthly`, `forge.pro.yearly`
- **Entitlement**: `pro`
- **Pricing**: $4.99/month, $29.99/year with 7-day intro trial
- **Free tier cap**: 3 saved workouts per rolling 7 days

## 1. App Store Connect (iOS)
1. Sign in → My Apps → **+ → New App**
   - Platform: iOS
   - Name: FORGE
   - Bundle ID: `app.forge.workout` (must exist in your developer account)
   - SKU: `forge-workout`
   - User Access: Full Access
2. App Information → **App-Specific Information**
   - Category: Health & Fitness
3. Pricing and Availability → **Free** (subscription is added separately)
4. **In-App Purchases → Subscriptions → + Subscription Group**
   - Reference Name: `FORGE Pro`
5. Inside the group, **+ Subscription** × 2:
   - **Monthly**
     - Reference Name: `FORGE Pro — Monthly`
     - Product ID: `forge.pro.monthly`
     - Subscription Duration: 1 Month
     - Price: $4.99 (set tiers in all territories)
     - Introductory Offer (Free Trial): 7 days, customer-pay = Free
   - **Yearly**
     - Reference Name: `FORGE Pro — Yearly`
     - Product ID: `forge.pro.yearly`
     - Subscription Duration: 1 Year
     - Price: $29.99
     - Introductory Offer (Free Trial): 7 days (Apple shares one trial across the group — already covered if user trialled monthly)
   - For both: fill in **Localizations** (Display Name, Description) in EN + RU at minimum.
   - **Review Information**: upload one screenshot of the paywall + a one-line note "Subscription required to save more than 3 workouts per week."
6. Status will be "Ready to Submit" — Apple validates with the first build. No "Submit for Review" yet.

## 2. Google Play Console (Android)
1. Console → **Create app**
   - App name: FORGE
   - Default language: English (US)
   - App or Game: App
   - Free or paid: Free
2. **Monetisation setup** (left sidebar) → **Subscriptions → Create subscription**
   - Product ID: `forge.pro.monthly` → Name: `FORGE Pro — Monthly`
   - Add a **Base plan**: `monthly` → Auto-renewing, Billing period: 1 month, Price: $4.99
   - Add an **Offer** under the base plan: `intro-trial` → Eligibility: New customers → 7 days free
3. Repeat with `forge.pro.yearly` → Base plan `yearly`, 1 year, $29.99, same 7-day intro offer.
4. **App content** → Privacy Policy: `https://smirsadykov.github.io/forge-workout/privacy.html`
5. **App content** → Data Safety: see "Data Safety answers" at the bottom of this doc.

## 3. RevenueCat
1. Sign up at app.revenuecat.com → **New project: FORGE**
2. **Apps → + Add app**
   - **Apple App Store**
     - Bundle ID: `app.forge.workout`
     - App-Specific Shared Secret: paste from App Store Connect → Users and Access → Integrations → App-Specific Shared Secret
     - Service Credentials: upload your App Store Connect API key (.p8 file)
   - **Google Play Store**
     - Package: `app.forge.workout`
     - Service Account JSON: upload from Google Play Console → Setup → API access
3. **Products** → import from store, check both `forge.pro.monthly` and `forge.pro.yearly` show up.
4. **Entitlements → + New Entitlement**
   - Identifier: `pro`
   - Attach both products to it.
5. **Offerings → + Offering**
   - Identifier: `default`
   - Add packages: `$rc_monthly` → forge.pro.monthly, `$rc_annual` → forge.pro.yearly
   - Mark `default` as Current.
6. **Project Settings → API keys**
   - Copy the **Apple public SDK key** (starts with `appl_`) → paste into `config.js` → `REVENUECAT_IOS_KEY`
   - Copy the **Google public SDK key** (starts with `goog_`) → paste into `config.js` → `REVENUECAT_ANDROID_KEY`
   - Commit + push.
7. **Project Settings → Integrations → + Add → Custom Webhook**
   - URL: (filled in after step 4 below)
   - Authorization header: `Bearer <your-random-secret>` — generate one with `openssl rand -hex 32`
   - Events: enable all

## 4. Supabase migration + webhook
1. **Run migration**: open Supabase Dashboard → SQL Editor → paste `supabase/migrations/20260630_user_subscriptions.sql` → Run.
2. **Install Supabase CLI** (one-time): `brew install supabase/tap/supabase`
3. **Link project**: `supabase login` then `supabase link --project-ref <your-project-ref>`
4. **Set webhook secret**: `supabase secrets set FORGE_RC_WEBHOOK_SECRET=<paste the secret from step 3.7 above>`
5. **Deploy function**: `supabase functions deploy revenuecat-webhook --no-verify-jwt`
   - The flag is required because RC isn't a Supabase auth client.
6. **Grab the function URL** from Supabase dashboard → Edge Functions → `revenuecat-webhook`. It'll look like `https://<project-ref>.functions.supabase.co/revenuecat-webhook`
7. Paste that URL into RevenueCat (step 3.7 above) → **Send test event** to confirm 200 OK.

## 5. Capacitor — install + sync
```
npm install                       # picks up @revenuecat/purchases-capacitor + @capacitor/ios
npx cap add ios                   # if iOS not already added (needs Mac + Xcode)
npx cap sync ios android
```

In Xcode: open `ios/App/App.xcworkspace` → **Signing & Capabilities → + Capability → In-App Purchase**. Also `+ Capability → Sign In with Apple` (Apple Guideline 4.8 — required because we offer email signin).

In Android Studio: open `android/` → make sure `billing` permission shows up automatically (Capacitor plugin adds it).

## 6. Smoke test
1. **iOS Sandbox**: in App Store Connect → Users and Access → Sandbox Testers, create a test Apple ID. On iPhone/simulator, Settings → App Store → Sandbox Account → sign in with it.
2. **Android License Tester**: Play Console → Setup → License testing → add your test Gmail.
3. Build and run, tap Upgrade. Real-money flow won't charge in sandbox/license-test accounts; receipt should fire through RevenueCat → webhook → Supabase row appears with `status="trial"`.
4. Watch the Supabase `user_subscriptions` table populate. If it doesn't, check `supabase functions logs revenuecat-webhook`.

## 7. Submit
- **iOS**: Xcode → Product → Archive → upload to App Store Connect → fill out remaining metadata (screenshots, app review info, attach a sandbox tester account for review) → Submit. First review ~24-48h.
- **Android**: Android Studio → Build → Generate Signed Bundle → upload .aab to Play Console → Internal testing track first, then Production after a clean test run.

---

## Data Safety answers (Google Play)
- **Personal info → Email address**: Collected (for account); Required; Not shared; Encrypted in transit. Purposes: App functionality, Account management.
- **Health and fitness → Fitness info**: Collected (logged workouts); Required; Not shared; Encrypted. Purposes: App functionality.
- **App activity → In-app actions**: Collected (workouts logged, settings); Required; Not shared. Purposes: App functionality.
- **App info and performance → Crash logs, Diagnostics**: Collected; Optional; Not shared. Purposes: App functionality.
- **Financial → Purchase history**: Collected (subscription status only — no card data, no purchase amounts; Apple/Google handle payment); Required for Pro users; Not shared. Purposes: App functionality.
- **Data deletion**: link to <https://smirsadykov.github.io/forge-workout/privacy.html> + state that users can delete their account via Settings → Delete Account, or by email.

## App Store privacy (App Privacy section)
Use the same categorization. Apple's app privacy form covers the same ground; "Linked to user" = yes for all of the above (everything is tied to the Supabase user UUID).
