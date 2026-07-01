# FORGE — Android build (Capacitor)

FORGE is a static web app; Capacitor wraps it in a native Android shell so it
can ship as a real app. One codebase — the same files still run as the web PWA.

- **App ID:** `app.forge.workout`  ·  **App name:** FORGE  ·  **webDir:** `dist/`
- Android builds **entirely on Windows** (no Mac needed).

## 0. One-time: install the toolchain
You already have **Node.js**. You still need:

- **Android Studio** — https://developer.android.com/studio
  Bundles the Android SDK, build-tools, an emulator, and a JDK. Install it,
  open it once, and let it finish the first-run SDK download. Then either:
  - create an emulator (Device Manager → add a Pixel + recent system image), **or**
  - enable **USB debugging** on your phone (Settings → Developer options) and plug it in.

> Publishing to Google Play is separate and **not** needed to build/test:
> it needs a Play Console account ($25 one-time) and a privacy-policy URL
> (you collect emails + workout data via Supabase).

## 1. Install JS dependencies (in the repo root)
```
npm install
```

## 2. Build the web bundle + add the Android project (one-time)
```
npm run build:web        # mirrors the web files into dist/
npx cap add android      # generates the android/ native project (one-time)
```

## 3. (Optional but recommended) Real app icons + splash
Capacitor uses a placeholder icon until you provide one. To generate every
density from a single source:
```
# put a square 1024x1024 PNG at resources/icon.png (and optional resources/splash.png)
npx capacitor-assets generate --android
```
(The current `icon.svg` lightning mark is a fine basis — export it to a 1024px PNG.)

## 4. Sync + open in Android Studio
```
npx cap sync android     # copies dist/ + plugins into the native project
npx cap open android     # opens Android Studio
```
In Android Studio, pick your emulator/device and hit **Run** ▶. That builds and
installs the APK. To get an installable file directly:
**Build ▸ Build Bundle(s)/APK(s) ▸ Build APK(s)** → `android/app/build/outputs/apk/debug/app-debug.apk`.

## After you change the web code
```
npm run sync             # build:web + cap sync, then Run again in Android Studio
```
(`npm run open:android` does sync + open in one go.)

## Notes / known follow-ups
- **Service worker** is auto-skipped in the native app (handled in `app.js`) — no stale-cache issue there.
- **Login** uses Supabase email/password and works in the app (verified).
- **Password reset** emails redirect to a web URL; in-app reset needs a deep link
  or a hosted reset page — deferred (login + signup are unaffected).
- **External links** (exercise demos) open in the system browser via `lib/native.js`.
- **External links** already covered above.

## Release build (signed AAB for Play) — DONE, here's how to reproduce

The `android/` project is **committed** with release config: `targetSdk`/`compileSdk` **35**
(Play's current requirement), **Gradle 8.9 / AGP 8.7.2** (needed for API 35 + JDK 21),
and a `release` signingConfig that reads `android/keystore.properties`.

**Signing (already set up on this machine):**
- Upload keystore: `C:\Users\smirs\Downloads\forge-upload.keystore` (alias `forge`).
  ⚠️ **Back this file up somewhere safe.** With Play App Signing you *can* reset a lost
  upload key, but keep it anyway. Password is in `android/keystore.properties`
  (gitignored — never committed).
- `android/keystore.properties` (local, gitignored) points to the keystore + holds the
  passwords. On a new machine, recreate it:
  ```
  storeFile=/abs/path/to/forge-upload.keystore
  storePassword=...
  keyAlias=forge
  keyPassword=...
  ```
  Generate a keystore with:
  ```
  keytool -genkeypair -v -keystore forge-upload.keystore -alias forge \
    -keyalg RSA -keysize 2048 -validity 10000
  ```

**Build the AAB:**
```bash
npm install            # populates node_modules the committed android/ references
npm run sync           # build:web + cap sync (regenerates plugin bridge + web assets)
cd android
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew bundleRelease
#   → android/app/build/outputs/bundle/release/app-release.aab   (upload this to Play)
```
Latest signed AAB is also copied to `C:\Users\smirs\Downloads\FORGE-release.aab`.

**Bump the version** for each Play release in `android/app/build.gradle`
(`versionCode` +1, `versionName`).

**Upload:** Play Console → Testing/Production → new release → upload the `.aab` → enroll
in **Play App Signing** on first upload. Full store flow in `SETUP-IAP.md` / `store/listing.md`.

## Notes / historical
- **Service worker** is auto-skipped in the native app (handled in `app.js`).
- **Password reset** emails redirect to a web URL; in-app reset needs a deep link — deferred.
