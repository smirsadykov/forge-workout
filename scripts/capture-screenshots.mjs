#!/usr/bin/env node
/**
 * FORGE — Store screenshot generator.
 *
 * Spawns headless Chromium via Puppeteer, seeds a demo account with
 * realistic 14-day workout history, navigates each key screen, and
 * captures PNGs at App Store / Play Store recommended dimensions.
 *
 * Outputs:
 *   store/screenshots/ios-6.7/   — 1290×2796 (iPhone 15/16 Pro Max)
 *   store/screenshots/ios-5.5/   — 1242×2208 (iPhone 8 Plus)
 *   store/screenshots/android/   — 1080×1920 (phone)
 *
 * Usage:
 *   1. Start a static server in this repo root: `npx serve -p 8000` or
 *      `python3 -m http.server 8000`.
 *   2. `npm install` (picks up puppeteer from devDependencies).
 *   3. `node scripts/capture-screenshots.mjs`.
 *   4. Inspect the output PNGs, drop them in App Store Connect and Play
 *      Console.
 *
 * To preview at one viewport without writing files, pass `--viewport=mobile`:
 *   `node scripts/capture-screenshots.mjs --viewport=ios-6.7 --skip-write`
 */

import puppeteer from "puppeteer";
import { writeFile, mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE_URL = process.env.FORGE_BASE_URL || "http://localhost:8000";

// Viewport presets — width × height is LOGICAL points; deviceScaleFactor
// multiplies into physical pixels for the captured PNG. So ios-6.7 at
// 430×932 @ 3x = 1290×2796 (App Store target).
const VIEWPORTS = {
  "ios-6.7":  { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true },  // iPhone 15 Pro Max
  "ios-5.5":  { width: 414, height: 736, deviceScaleFactor: 3, isMobile: true, hasTouch: true },  // iPhone 8 Plus
  "android":  { width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true },  // Pixel-class
};

// Each screen below is { name, navigate, label } — navigate is a fn that
// runs inside the page and gets to a stable state to capture.
const SCREENS = [
  {
    name: "01-generator",
    label: "Generator form",
    navigate: async (page) => {
      await page.evaluate(() => {
        showApp("generator");
        window.scrollTo(0, 0);
      });
      await sleep(500);
    },
  },
  {
    name: "02-workout",
    label: "Generated workout",
    navigate: async (page) => {
      await page.evaluate(() => {
        const w = generateWorkout({
          goal: "hypertrophy", equipment: ["kettlebell"], target: "full_body",
          duration: 45, intensity: "normal", style: "standard",
          deload: false, phaseSetMod: 0, phase: null,
        });
        currentWorkout = w;
        workoutIsSaved = false;
        el.workoutResult.classList.remove("hidden");
        renderWorkout(currentWorkout, el.workoutResult, { showSave: true });
        el.workoutResult.scrollIntoView({ behavior: "instant", block: "start" });
        window.scrollBy(0, -60);
      });
      await sleep(500);
    },
  },
  {
    name: "03-settings-sub",
    label: "Settings — Subscription card (free plan, 3/3 used)",
    navigate: async (page) => {
      await page.evaluate(() => {
        // Force "3 of 3 used" by inflating workout count if needed
        const u = session.username;
        const all = JSON.parse(localStorage.getItem("forge:workouts") || "{}");
        const now = Date.now(), day = 86400 * 1000;
        all[u] = all[u] || [];
        // Ensure 3 saves in last 7 days
        const recent = all[u].filter(w => (w.createdAt || 0) >= now - 7 * day);
        if (recent.length < 3) {
          for (let i = 0; i < 3 - recent.length; i++) {
            all[u].unshift({ id: "pad_" + i, createdAt: now - i * day, name: "Sample", inputs: {}, exercises: [] });
          }
          localStorage.setItem("forge:workouts", JSON.stringify(all));
        }
        showApp("settings");
        setTimeout(() => {
          document.querySelectorAll('.modal-overlay, [class*="onboard"]').forEach(el => { el.style.display = "none"; });
          document.body.style.overflow = "";
          document.getElementById("subscriptionCard")?.scrollIntoView({ behavior: "instant", block: "start" });
          window.scrollBy(0, -60);
        }, 400);
      });
      await sleep(900);
    },
  },
  {
    name: "04-paywall",
    label: "Paywall — annual highlighted",
    navigate: async (page) => {
      await page.evaluate(() => {
        showPaywall({ trigger: "save_limit", remaining: 0 });
        setTimeout(() => {
          document.querySelector('[data-paywall-plan="annual"]')?.click();
        }, 200);
      });
      await sleep(600);
    },
  },
];

// Seed the same demo account every time so screenshots stay reproducible.
async function seedDemo(page) {
  await page.evaluate(() => {
    const u = "demo";
    const now = Date.now(), day = 86400 * 1000;
    localStorage.clear();
    localStorage.setItem("forge:forceLocal", "1");
    localStorage.setItem("forge:users", JSON.stringify({ [u]: { username: u, passwordHash: "0", salt: "demo", createdAt: now - 30 * day } }));
    localStorage.setItem("forge:prefs", JSON.stringify({ [u]: { units: "kg", language: "ru", theme: "dark", equipment: ["kettlebell","dumbbells","bodyweight"], cloudSync: false } }));
    localStorage.setItem("forge:loads", JSON.stringify({ [u]: { maxDumbbellKg: 24, maxKettlebellKg: 24, hasHeavyBarbell: false, availableKettlebellsKg: [12,16,20,24], availableDumbbellsKg: [10,15,20,24] } }));
    const wo = (daysAgo, name, goal, ex) => ({
      id: `w_${now - daysAgo*day}_${Math.random().toString(36).slice(2,7)}`,
      createdAt: now - daysAgo * day, name, inputs: { goal, equipment: ["kettlebell"], target: "full_body", duration: 45, intensity: "normal", style: "standard", deload: false }, exercises: ex, notes: "",
    });
    const ex = (n, s, r, x) => ({ name: n, sets: s, reps: r, weight: x });
    localStorage.setItem("forge:workouts", JSON.stringify({ [u]: [
      wo(1, "Full Body · Strength", "hypertrophy", [
        ex("Kettlebell Goblet Squat", 4, "5–7", 24),
        ex("Kettlebell Bent-Over Row", 4, "5–7", 24),
        ex("Kettlebell Overhead Press", 4, "5–7", 16),
        ex("Kettlebell Romanian Deadlift", 3, "8–12", 24),
      ]),
      wo(3, "Upper Body · Hypertrophy", "hypertrophy", []),
      wo(5, "Lower Body · Strength", "hypertrophy", []),
    ]}));
    localStorage.setItem("forge:onboardingDone:" + u, "1");
    localStorage.setItem("forge:onboardingDone", "1");
    localStorage.setItem("forge:sub", JSON.stringify({ [u]: { status: "free", expiresAt: null, productId: null } }));
    localStorage.setItem("forge:session", JSON.stringify({ username: u, loggedInAt: now }));
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function captureViewport(browser, vpName) {
  const vp = VIEWPORTS[vpName];
  const outDir = join(ROOT, "store", "screenshots", vpName);
  await mkdir(outDir, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport(vp);
  console.log(`\n[${vpName}] ${vp.width}×${vp.height} @ ${vp.deviceScaleFactor}x`);
  await page.goto(`${BASE_URL}/?t=${Date.now()}`, { waitUntil: "networkidle2" });
  await seedDemo(page);
  await page.goto(`${BASE_URL}/?t=${Date.now()}`, { waitUntil: "networkidle2" });
  // Wait for app boot + dismiss onboarding overlay
  await sleep(800);
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, [class*="onboard"]').forEach(el => { el.style.display = "none"; });
    document.body.style.overflow = "";
  });
  for (const s of SCREENS) {
    await s.navigate(page);
    const file = join(outDir, `${s.name}.png`);
    await page.screenshot({ path: file, type: "png" });
    console.log(`  ✓ ${s.name}.png — ${s.label}`);
  }
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  for (const vp of Object.keys(VIEWPORTS)) {
    await captureViewport(browser, vp);
  }
  await browser.close();
  console.log("\nDone. Output in store/screenshots/");
})().catch(err => {
  console.error(err);
  process.exit(1);
});
