# FORGE — Google Play Store Listing

Everything you paste into Play Console. Copy blocks are ready to use; tweak voice as you like.

---

## App identity

| Field | Value |
|---|---|
| App name (max 30) | `FORGE — Workout Generator` (25 chars) |
| Package / Application ID | `app.forge.workout` |
| Default language | English (United States) |
| App category | Health & Fitness |
| Tags | Fitness, Workout, Strength training |
| Contact email | smirsadykov@gmail.com |
| Privacy Policy URL | `https://smirsadykov.github.io/forge-workout/privacy.html` |
| Website (optional) | `https://smirsadykov.github.io/forge-workout/` |

---

## Short description (max 80 chars)

```
Smart workout generator that adapts to your gear, goals, and progress.
```
(70 chars)

Alternates:
```
Generate strength, mobility & CrossFit workouts. Logs sets & auto-progresses.
```
```
Your training brain: pick gear & goal, get a workout, log it, level up.
```

---

## Full description (max 4000 chars)

```
FORGE builds the workout you should do today — then remembers it and tells you what comes next.

No endless scrolling through exercise libraries. Pick your equipment, your goal, and how long you've got. FORGE generates a focused session tuned to what you actually have and where you actually are in your training.

━━━━━━━━━━━━━━━━━━━━━━
WHAT IT DOES
━━━━━━━━━━━━━━━━━━━━━━

• SMART GENERATION — Tell FORGE your equipment (kettlebells, dumbbells, barbell, bands, bodyweight, or nothing at all), your goal, the session type, and the time you have. It assembles a balanced workout that fits.

• SESSION TYPES — Standard strength & hypertrophy, Mobility, Recovery, and CrossFit-style WODs.

• LOG IN SECONDS — Tick off sets, reps, and weight as you train. Clean, fast, made for the gym floor.

• AUTO-PROGRESSION — FORGE reads your history and tells you exactly what to do next set: add weight, add reps, hold and earn it, or move to a harder variation when you've outgrown a lift. No guesswork, no plateaus.

• TRAINS TO YOUR LEVEL — Targets adjust to your real performance and the equipment you own, so the plan stays challenging without becoming impossible.

• WORKS OFFLINE — Generate and log without a connection.

━━━━━━━━━━━━━━━━━━━━━━
FREE vs PREMIUM
━━━━━━━━━━━━━━━━━━━━━━

FREE
• Generate workouts every day
• Log your sessions
• Recent history on this device

PREMIUM
• Unlimited generation
• Cloud sync across all your devices
• Unlimited history & full progression insights
• Structured multi-week programs
• Data export & backup

Premium is available as a monthly or annual subscription, or a one-time lifetime unlock.

━━━━━━━━━━━━━━━━━━━━━━
WHO IT'S FOR
━━━━━━━━━━━━━━━━━━━━━━

Lifters, kettlebell and calisthenics athletes, home-gym trainees, and anyone who wants a real plan without paying for a coach or fighting a bloated app. Whether you have a full rack or a single pair of bells, FORGE meets you there.

Train smarter. Forge yourself.

—
Subscriptions auto-renew unless cancelled at least 24 hours before the period ends; manage or cancel anytime in Google Play. Privacy policy: https://smirsadykov.github.io/forge-workout/privacy.html
```

---

## Graphics checklist (upload in Play Console → Store listing)

| Asset | Spec | Source |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | From Ideogram icon (#1) — resized |
| Feature graphic | 1024×500 PNG/JPG, no alpha | From Ideogram feature graphic (#3) |
| Phone screenshots | 2–8, PNG/JPG, 16:9 or 9:16, min 320px | Capture from live app (generator, workout, log, history, paywall) |
| Tablet screenshots | optional | — |

---

## Content rating questionnaire (expected answers)

- Category: **Reference, News, or Educational / Health & Fitness** (utility).
- Violence / sexual / profanity / drugs / gambling: **No** to all.
- User-generated content shared with others: **No** (data is personal, not social).
- Does the app share user location: **No**.
- Expected rating: **Everyone / PEGI 3.**

---

## Target audience & content

- Target age group: **18+** (or 13+; avoid the "designed for families" program — it adds requirements).
- Not directed at children: **Yes, correct** (keeps you out of the Families policy).

---

## Data Safety form answers

Play Console → App content → Data safety. Use these:

**Does your app collect or share any of the required user data types?** → **Yes**

**Data collected:**

| Data type | Collected | Shared | Processed ephemerally | Required/Optional | Purpose |
|---|---|---|---|---|---|
| Email address | Yes | No | No | Required | Account management |
| Other user-generated content (workout logs) | Yes | No | No | Optional* | App functionality |
| Purchase history | Yes | No | No | Required | App functionality (unlock Premium) |
| App activity / Other actions (in-app actions) | Yes | No | No | Optional | App functionality, analytics(none)→leave off |
| Device or other IDs | Yes | No | No | Required | App functionality (purchase validation) |

\* Workout logs are only sent off-device if the user enables cloud sync (Premium).

**Security practices:**
- Is data encrypted in transit? → **Yes**.
- Can users request data deletion? → **Yes** (in-app: Settings → Account → Delete account; web: /delete-account.html).
- Committed to Play Families Policy? → **No** (not a children's app).
- Independent security review? → **No**.

**Data NOT collected:** location, contacts, photos/videos, audio, health & fitness sensors (we store what the user types, not sensor data — declare under "user-generated content," not the Health category), financial info (Google handles payments), messages, calendar, browsing history.

---

## In-app products (Play Console → Monetize → Products)

Create one **Subscription** with two base plans + one **In-app product** (lifetime). Product IDs must match the RevenueCat config exactly.

**Subscription** — Product ID: `forge_premium`
| Base plan ID | Billing period | Price | Notes |
|---|---|---|---|
| `monthly` | P1M | $4.99 | Auto-renewing |
| `annual` | P1Y | $29.99 | Auto-renewing; mark as the highlighted/best-value plan |

(Optional free trial: add a 7-day free-trial offer on the annual plan to lift conversion.)

**In-app product (non-consumable)** — Product ID: `forge_lifetime`
| Field | Value |
|---|---|
| Type | One-time / Non-consumable |
| Price | $79.99 |

> Google's service fee is **15%** on subscriptions and on your first $1M/yr of all earnings.

---

## RevenueCat mapping (Monetize → Entitlements/Offerings)

- Entitlement identifier: **`premium`** (this is the string the app checks).
- Attach all three products (`forge_premium:monthly`, `forge_premium:annual`, `forge_lifetime`) to the `premium` entitlement.
- Create an Offering `default` with three packages: Monthly, Annual, Lifetime.
- Put the **Google Play API key** from RevenueCat into the app config (see `lib/billing.js`).

---

## "What's new" (release notes, max 500 chars)

```
First release of FORGE. Generate strength, mobility, recovery, and CrossFit-style workouts around the gear you own, log them in seconds, and let auto-progression tell you exactly what to do next. Go Premium for cloud sync, unlimited history, and structured programs.
```
