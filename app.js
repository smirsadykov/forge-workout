// ═════════════════════════════════════════════════════════════════════════
// FORGE — Workout Generator
// Single-page app. State lives in localStorage.
// ═════════════════════════════════════════════════════════════════════════

const STORAGE_KEYS = {
  users: "forge:users",
  session: "forge:session",
  workouts: "forge:workouts",
  stats: "forge:stats",   // per-user, per-exercise logs (always stored in kg)
  prefs: "forge:prefs",   // per-user preferences (units, etc.)
  loads: "forge:loads",   // per-user available equipment loads (kg)
  soreness: "forge:soreness", // per-user, per-muscle soreness (decays over time)
  volumeTargets: "forge:volumeTargets", // per-user weekly sets target per muscle
  sleep: "forge:sleep",   // per-user, per-date sleep quality rating (1-5)
};

// Muscle groups we expose in soreness + volume target UI.
const MAJOR_MUSCLES = ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "core"];

// ─── SUPABASE BACKEND (optional) ─────────────────────────────────────────
const _configReady = !!(window.FORGE_CONFIG?.SUPABASE_URL && window.FORGE_CONFIG?.SUPABASE_ANON_KEY);
const _sdkReady = !!window.supabase;
// User-forced override: if they've explicitly chosen local-only mode (e.g.
// because their network blocks Supabase), respect that even with valid cloud
// config. Set via the "Use offline mode" button on auth or Settings toggle.
const _userForcedLocal = localStorage.getItem("forge:forceLocal") === "1";
const HAS_SUPABASE = !_userForcedLocal && _configReady && _sdkReady;
const sb = HAS_SUPABASE
  ? window.supabase.createClient(
      window.FORGE_CONFIG.SUPABASE_URL,
      window.FORGE_CONFIG.SUPABASE_ANON_KEY
    )
  : null;

// Show a status pill on the auth view so the user (and we) can see at a
// glance whether cloud mode is wired up.
function getCloudStatus() {
  if (HAS_SUPABASE) return { mode: "ok", text: "✓ Cloud sync ready" };
  if (_userForcedLocal) return { mode: "local", text: "ⓘ Offline mode (you chose this) — re-enable cloud in Settings" };
  if (_configReady && !_sdkReady) return { mode: "err", text: "⚠ Cloud config set but Supabase SDK didn't load — check your network or refresh" };
  if (!_configReady && _sdkReady) return { mode: "warn", text: "⚠ Supabase SDK loaded but config.js is empty — paste credentials per SUPABASE-SETUP.md" };
  return { mode: "local", text: "ⓘ Local-only mode — your data lives on this device" };
}

// Render the pill as early as possible — even if later JS errors out, this
// gives the user (and remote debug) a clear signal of which mode is active.
// Wrapped in DOMContentLoaded so the cloudStatus element exists.
(function renderPillEarly() {
  const fire = () => {
    try {
      const status = getCloudStatus();
      const cs = document.getElementById("cloudStatus");
      if (cs) {
        cs.textContent = status.text;
        cs.className = `cloud-status cloud-status-${status.mode}`;
      }
    } catch (e) { /* swallow */ }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fire);
  } else {
    fire();
  }
})();

// Fire-and-forget cloud push. Catches errors so a missing network or
// schema mismatch never breaks the local UX. Also drives the sync
// status indicator in the top nav.
function cloudPush(fn) {
  if (!sb || !session?.userId) return;
  setSyncStatus("syncing");
  Promise.resolve(fn())
    .then(() => setSyncStatus("ok"))
    .catch(() => setSyncStatus("error"));
}

// ─── SYNC STATUS INDICATOR ───────────────────────────────────────────────
const syncState = { status: "idle", lastOk: 0, lastErr: 0 };

function setSyncStatus(status) {
  syncState.status = status;
  if (status === "ok") syncState.lastOk = Date.now();
  if (status === "error") syncState.lastErr = Date.now();
  renderSyncIndicator();
}

function renderSyncIndicator() {
  const elx = document.getElementById("syncIndicator");
  if (!elx) return;
  if (!HAS_SUPABASE) {
    elx.classList.remove("hidden");
    elx.className = "sync-indicator sync-local";
    elx.innerHTML = `<span class="sync-dot"></span><span>Local</span>`;
    elx.title = "Local-only mode — data lives in this browser";
    return;
  }
  if (!session?.userId) {
    elx.classList.add("hidden");
    return;
  }
  elx.classList.remove("hidden");
  const map = {
    idle:    { cls: "sync-idle",    text: "Cloud",     title: "Tap to sync now" },
    syncing: { cls: "sync-pending", text: "Syncing…",  title: "Pushing to cloud" },
    ok:      { cls: "sync-ok",      text: "Synced",    title: `Last sync ${new Date(syncState.lastOk).toLocaleTimeString()} — tap to sync again` },
    error:   { cls: "sync-err",     text: "Offline",   title: `Cloud unreachable — changes saved locally. Tap to retry (enable VPN first if your network blocks Supabase).` },
  };
  const s = map[syncState.status] || map.idle;
  elx.className = `sync-indicator ${s.cls}`;
  elx.innerHTML = `<span class="sync-dot"></span><span class="sync-label">${s.text}</span>`;
  elx.title = s.title;
}

// Watch browser-level connectivity. If we go online and we're authed,
// run a tiny probe query to confirm Supabase itself is reachable.
window.addEventListener("online", () => {
  if (HAS_SUPABASE && session?.userId) {
    sb.from("user_prefs").select("user_id").limit(1).maybeSingle()
      .then(() => setSyncStatus("ok"))
      .catch(() => setSyncStatus("error"));
  }
});
window.addEventListener("offline", () => {
  if (HAS_SUPABASE && session?.userId) setSyncStatus("error");
});

// Manual sync — push all local user data to Supabase, then pull back any
// remote changes from other devices. Useful on blocked networks where the
// user toggles VPN on briefly to sync, off otherwise.
async function forceSyncAll() {
  if (!sb || !session?.userId) return { ok: false, reason: "not signed in" };
  setSyncStatus("syncing");
  const uid = session.userId;
  const username = session.username;
  try {
    // Push workouts (upsert all)
    const workouts = getWorkouts(username);
    if (workouts.length > 0) {
      const rows = workouts.map(w => ({
        id: w.id, user_id: uid, data: w,
        created_at: new Date(w.createdAt).toISOString(),
      }));
      const { error } = await sb.from("workouts").upsert(rows);
      if (error) throw error;
    }
    // Push exercise stats
    const stats = getStats(username);
    const statRows = Object.entries(stats).map(([exName, stat]) => ({
      user_id: uid,
      exercise_name: exName,
      weight_kg: Number(stat.weightKg) || 0,
      reps: Number(stat.reps) || 0,
      date: new Date(stat.date || Date.now()).toISOString(),
      history: stat.history || [],
    }));
    if (statRows.length > 0) {
      const { error } = await sb.from("exercise_stats").upsert(statRows);
      if (error) throw error;
    }
    // Push prefs
    const prefs = getPrefs(username);
    {
      const { error } = await sb.from("user_prefs").upsert({
        user_id: uid, units: prefs.units || "kg",
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }
    // Push loads
    const loads = getLoads(username);
    {
      const { error } = await sb.from("user_loads").upsert({
        user_id: uid,
        max_dumbbell_kg: Number(loads.maxDumbbellKg) || 0,
        max_kettlebell_kg: Number(loads.maxKettlebellKg) || 0,
        has_heavy_barbell: !!loads.hasHeavyBarbell,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }
    // Pull whatever the server has back into the local cache.
    await syncFromCloud();
    setSyncStatus("ok");
    return { ok: true };
  } catch (e) {
    setSyncStatus("error");
    return { ok: false, error: e.message || String(e) };
  }
}

// Make the indicator clickable — manual sync trigger.
document.addEventListener("DOMContentLoaded", () => {
  // Apply translations to all static DOM elements tagged with data-i18n.
  if (window.i18n) window.i18n.applyI18n(document);

  const indicator = document.getElementById("syncIndicator");
  if (indicator) {
    indicator.addEventListener("click", async () => {
      if (!HAS_SUPABASE || !session?.userId) return;
      const result = await forceSyncAll();
      if (result.ok) {
        indicator.title = `✓ Sync complete · ${new Date().toLocaleTimeString()}`;
      } else {
        indicator.title = `Sync failed: ${result.error || "network unreachable"} — tap to retry`;
      }
    });
  }
});

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────
const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// Lightweight password hash (FNV-1a + salt). Not crypto-secure — adequate
// for a client-side demo so plaintext isn't sitting in localStorage.
function hashPassword(password, salt) {
  const input = salt + ":" + password;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}
function randomSalt() {
  return Math.random().toString(36).slice(2, 12);
}

// ─── AUTH STATE ──────────────────────────────────────────────────────────
let session = load(STORAGE_KEYS.session, null);
let authMode = "login";

function getUsers() { return load(STORAGE_KEYS.users, {}); }
function setUsers(users) { save(STORAGE_KEYS.users, users); }
function getWorkouts(userId) {
  const all = load(STORAGE_KEYS.workouts, {});
  return all[userId] || [];
}
function addWorkout(userId, workout) {
  const all = load(STORAGE_KEYS.workouts, {});
  if (!all[userId]) all[userId] = [];
  all[userId].unshift(workout);
  save(STORAGE_KEYS.workouts, all);
  cloudPush(() => sb.from("workouts").insert({
    id: workout.id,
    user_id: session.userId,
    data: workout,
    created_at: new Date(workout.createdAt).toISOString(),
  }));
}
function deleteWorkout(userId, workoutId) {
  const all = load(STORAGE_KEYS.workouts, {});
  if (!all[userId]) return;
  all[userId] = all[userId].filter(w => w.id !== workoutId);
  save(STORAGE_KEYS.workouts, all);
  cloudPush(() => sb.from("workouts").delete().eq("id", workoutId));
}

// Update arbitrary fields on an existing saved workout (notes, etc.).
function updateWorkout(userId, workoutId, partial) {
  const all = load(STORAGE_KEYS.workouts, {});
  if (!all[userId]) return;
  const w = all[userId].find(x => x.id === workoutId);
  if (!w) return;
  Object.assign(w, partial);
  save(STORAGE_KEYS.workouts, all);
  cloudPush(() => sb.from("workouts").update({ data: w }).eq("id", workoutId));
}

// ─── PROGRESSION: stats + prefs ──────────────────────────────────────────
// Stats are always stored in kg internally. UI converts at render time.
function getStats(userId) {
  const all = load(STORAGE_KEYS.stats, {});
  return all[userId] || {};
}
function getExerciseStat(userId, exName) {
  return getStats(userId)[exName] || null;
}
// Epley estimated 1-rep max — captures both rep PRs and load PRs in one number.
function calculateE1RM(weightKg, reps) {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

// Normalize either old single-set history entries or new sets-array entries
// into the new shape: { date, sets: [{ weightKg, reps }] }.
function normalizeHistoryEntry(entry) {
  if (!entry) return { date: Date.now(), sets: [] };
  if (Array.isArray(entry.sets)) return entry;
  return {
    date: entry.date || Date.now(),
    sets: [{ weightKg: entry.weightKg || 0, reps: entry.reps || 0 }],
  };
}

function sessionBestE1RM(sets) {
  return sets.reduce((m, s) => Math.max(m, calculateE1RM(s.weightKg, s.reps)), 0);
}
function sessionBestReps(sets) {
  return sets.reduce((m, s) => Math.max(m, s.reps || 0), 0);
}

function isPR(sets, history) {
  if (!history || history.length === 0) return false;
  if (!sets || sets.length === 0) return false;
  const newBestE1 = sessionBestE1RM(sets);
  const oldBestE1 = history.reduce((m, h) => Math.max(m, sessionBestE1RM(normalizeHistoryEntry(h).sets)), 0);
  if (newBestE1 > 0 && newBestE1 > oldBestE1 + 0.01) return true;
  // Bodyweight: pure rep PR
  const newBestReps = sessionBestReps(sets);
  const oldBestReps = history.reduce((m, h) =>
    Math.max(m, sessionBestReps(normalizeHistoryEntry(h).sets)), 0);
  return newBestReps > oldBestReps;
}

// Log a set OR an array of sets for an exercise. Accepts:
//   { weightKg, reps }         — single set (back-compat)
//   { sets: [{...}, ...] }     — multi-set session
//   [{ weightKg, reps }, ...]  — bare array
// Empty sets (reps == 0) are dropped silently.
function logExercise(userId, exName, payload) {
  let sets;
  if (Array.isArray(payload)) {
    sets = payload;
  } else if (payload && Array.isArray(payload.sets)) {
    sets = payload.sets;
  } else if (payload) {
    sets = [{ weightKg: payload.weightKg, reps: payload.reps }];
  } else {
    sets = [];
  }
  sets = sets
    .map(s => {
      const out = { weightKg: Number(s.weightKg) || 0, reps: Number(s.reps) || 0 };
      if (s.side === "R" || s.side === "L") out.side = s.side;
      // Reps In Reserve (0-4): how many reps were left in the tank.
      // Optional — only persisted if the user logged it.
      if (s.rir != null && !Number.isNaN(Number(s.rir))) {
        const rir = Math.max(0, Math.min(4, Number(s.rir)));
        out.rir = rir;
      }
      return out;
    })
    .filter(s => s.reps > 0);
  if (sets.length === 0) return { pr: false };

  const all = load(STORAGE_KEYS.stats, {});
  if (!all[userId]) all[userId] = {};
  const existing = all[userId][exName] || { history: [] };
  const pr = isPR(sets, existing.history);

  // Working set = the heaviest set this session (used for "last session" lookups).
  const workingSet = sets.reduce((best, s) =>
    calculateE1RM(s.weightKg, s.reps) > calculateE1RM(best.weightKg, best.reps) ? s : best, sets[0]);

  const entry = { date: Date.now(), sets };
  existing.weightKg = workingSet.weightKg;
  existing.reps = workingSet.reps;
  existing.date = entry.date;
  existing.history = (existing.history || []).concat([entry]).slice(-30);
  all[userId][exName] = existing;
  save(STORAGE_KEYS.stats, all);
  cloudPush(() => sb.from("exercise_stats").upsert({
    user_id: session.userId,
    exercise_name: exName,
    weight_kg: existing.weightKg,
    reps: existing.reps,
    date: new Date(existing.date).toISOString(),
    history: existing.history,
  }));
  return { pr };
}

function getPrefs(userId) {
  const all = load(STORAGE_KEYS.prefs, {});
  return all[userId] || { units: "kg" };
}
function setPrefs(userId, prefs) {
  const all = load(STORAGE_KEYS.prefs, {});
  all[userId] = { ...getPrefs(userId), ...prefs };
  save(STORAGE_KEYS.prefs, all);
  cloudPush(() => sb.from("user_prefs").upsert({
    user_id: session.userId,
    units: all[userId].units,
    updated_at: new Date().toISOString(),
  }));
}

// ─── VOLUME LANDMARKS (MEV / MAV / MRV) ──────────────────────────────────
// Per-muscle WEEKLY set targets, from the evidence-based programming
// literature (Israetel volume landmarks, cross-referenced with Schoenfeld
// meta-analyses on dose response).
//
//   MEV = Minimum Effective Volume — below this, muscle stops growing
//   MAV = Maximum Adaptive Volume — productive working range
//   MRV = Maximum Recoverable Volume — over this, recovery fails
//
// These are population midpoints; individuals vary ±30%. The app uses them
// to color the heatmap and surface "undertrained / well-trained / overdone"
// status rather than treating volume as a single accumulating gradient.
const VOLUME_LANDMARKS = {
  chest:      { mev: 8,  mavLow: 12, mavHigh: 20, mrv: 22 },
  back:       { mev: 10, mavLow: 14, mavHigh: 22, mrv: 25 },
  shoulders:  { mev: 8,  mavLow: 16, mavHigh: 22, mrv: 26 },
  biceps:     { mev: 6,  mavLow: 12, mavHigh: 20, mrv: 24 },
  triceps:    { mev: 6,  mavLow: 10, mavHigh: 18, mrv: 22 },
  quads:      { mev: 8,  mavLow: 12, mavHigh: 18, mrv: 20 },
  hamstrings: { mev: 6,  mavLow: 10, mavHigh: 16, mrv: 20 },
  glutes:     { mev: 0,  mavLow: 8,  mavHigh: 16, mrv: 18 },
  calves:     { mev: 8,  mavLow: 12, mavHigh: 16, mrv: 20 },
  core:       { mev: 0,  mavLow: 8,  mavHigh: 16, mrv: 25 },
};

// Classify a 7-day set count against the landmarks. Status drives color.
function classifyVolumeStatus(muscle, weeklySets) {
  const lm = VOLUME_LANDMARKS[muscle];
  if (!lm) return { status: "unknown", color: "#1e2230" };
  const s = weeklySets || 0;
  if (s < lm.mev) {
    return {
      status: "under",
      color: s < lm.mev * 0.5 ? "#1e2230" : "#3a3f55",
      label: `${s.toFixed(0)}/${lm.mev} MEV`,
      message: t("vol.belowMev"),
    };
  }
  if (s < lm.mavLow) {
    return {
      status: "approaching",
      color: "#9a8c2b", // muted yellow
      label: `${s.toFixed(0)} ${t("wo.sets")}`,
      message: t("vol.approachingMsg"),
    };
  }
  if (s <= lm.mavHigh) {
    return {
      status: "optimal",
      color: "#3da35d", // green
      label: `${s.toFixed(0)} ${t("wo.sets")}`,
      message: t("vol.optimalMsg"),
    };
  }
  if (s <= lm.mrv) {
    return {
      status: "high",
      color: "#d68f2c", // amber
      label: `${s.toFixed(0)}/${lm.mrv} MRV`,
      message: t("vol.highMsg"),
    };
  }
  return {
    status: "over",
    color: "#c0392b", // red
    label: `${s.toFixed(0)} ${t("wo.sets")}`,
    message: t("vol.overMsg"),
  };
}

// ─── MUSCLE CONTRIBUTION MAP ─────────────────────────────────────────────
// Single source of truth for "how much does this exercise count toward each
// muscle's weekly set count?" Compound lifts produce real stimulus in muscles
// beyond the primary; ignoring that systematically overstates the primary and
// under-credits arms/shoulders (the "why do my biceps grow but I never train
// them?" effect). Fractional credit is the standard approach in evidence-based
// programming (Israetel, Helms, Schoenfeld).
//
// Returns: { muscle: factor }. Primary = 1.0; listed secondaries = 0.5;
// pattern-derived synergists = 0.5 or 0.25.
function getMuscleContributions(exercise) {
  if (!exercise) return {};
  const contrib = {};
  const muscles = exercise.muscle || [];
  if (!muscles.length) return contrib;

  // Author-tagged primary + secondary muscles
  contrib[muscles[0]] = 1.0;
  for (let i = 1; i < muscles.length; i++) {
    if (contrib[muscles[i]] == null) contrib[muscles[i]] = 0.5;
  }

  const addIfMissing = (m, w) => { if (contrib[m] == null) contrib[m] = w; };
  const name = (exercise.name || "").toLowerCase();
  const primary = muscles[0];

  // Pattern-derived synergists. Each line encodes a well-known biomechanical
  // assist: pressing recruits triceps + front delt, pulling recruits biceps,
  // squatting recruits glutes, hinging recruits glutes + erectors, etc.

  // Horizontal push → triceps + front delt
  if (primary === "chest" || /bench|push.?up|chest press|fly/.test(name)) {
    if (!/fly|flye/.test(name)) {
      // Flies are isolation-ish; minimal triceps. Skip the tri credit.
      addIfMissing("triceps", 0.5);
    }
    addIfMissing("shoulders", 0.25);
  }
  // Vertical push (overhead press variants) → triceps
  if (/overhead press|shoulder press|ohp|military|arnold|push press/.test(name)
      || (primary === "shoulders" && /press/.test(name))) {
    addIfMissing("triceps", 0.5);
  }
  // Vertical pull (pull-up / lat pulldown) → biceps
  if (/pull.?up|chin.?up|pulldown|pull.?down|lat pull/.test(name)) {
    addIfMissing("biceps", 0.5);
  }
  // Horizontal pull (row variants) → biceps
  if (/row/.test(name) && !/upright row/.test(name)) {
    addIfMissing("biceps", 0.5);
  }
  // Upright row → side delts + biceps
  if (/upright row/.test(name)) {
    addIfMissing("shoulders", 0.5);
    addIfMissing("biceps", 0.25);
  }
  // Squat patterns → glutes (and ham as antagonist stabilizer)
  if (/squat|lunge|step.?up|split squat|bulgarian/.test(name)) {
    addIfMissing("glutes", 0.5);
    if (primary === "quads") addIfMissing("hamstrings", 0.25);
  }
  // Hinge patterns → glutes + hams + erectors (back)
  if (/deadlift|good morning|rdl|romanian|hip thrust|kettlebell swing|clean|snatch/.test(name)) {
    addIfMissing("glutes", 0.5);
    addIfMissing("hamstrings", 0.5);
    addIfMissing("back", 0.25);
  }
  // Loaded carries → core + grip/traps (we don't track traps separately,
  // so we credit shoulders as the closest proxy)
  if (/carry|farmer|suitcase walk|loaded carry/.test(name)) {
    addIfMissing("core", 0.5);
    addIfMissing("shoulders", 0.25);
  }
  // Dips → chest + triceps depending on lean; credit both half-strength
  if (/\bdip\b|dips/.test(name)) {
    addIfMissing("chest", 0.5);
    addIfMissing("triceps", 0.5);
  }
  // Curl variants → minor forearm work (no forearm muscle tracked; skip)
  // Triceps extension → minor anterior delt (skip — too small)

  // Most compounds engage the core for stabilization. Credit a small amount.
  if (/squat|deadlift|overhead|standing press|push press|pull.?up|chin.?up|row|carry|swing|clean|snatch/.test(name)) {
    addIfMissing("core", 0.25);
  }

  return contrib;
}

// ─── WEEKLY VOLUME ANALYTICS ─────────────────────────────────────────────
// Snap a date to Monday 00:00 — defines the ISO week bucket.
function weekStartOf(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

// Sum total recent training volume + set count by muscle over the last N days.
// Uses fractional synergist credit (see getMuscleContributions) so compound
// lifts properly attribute work to triceps, biceps, glutes, etc.
// Unilateral sets count as 0.5 (each side) so a "5 sets per side" log is
// equivalent to 5 bilateral sets, not 10.
function getRecentMuscleVolume(userId, daysBack = 14) {
  const cutoff = Date.now() - daysBack * 86400000;
  const stats = getStats(userId);
  const byMuscle = {};
  for (const [exName, stat] of Object.entries(stats)) {
    const ex = EXERCISES.find(e => e.name === exName);
    if (!ex) continue;
    const contributions = getMuscleContributions(ex);
    for (const entry of (stat.history || [])) {
      const n = normalizeHistoryEntry(entry);
      if (n.date < cutoff) continue;
      const vol = n.sets.reduce((s, set) =>
        s + (Number(set.weightKg) || 0) * (Number(set.reps) || 0), 0);
      const setCount = n.sets.reduce((c, s) => c + (s.side ? 0.5 : 1), 0);
      for (const [m, factor] of Object.entries(contributions)) {
        if (!byMuscle[m]) byMuscle[m] = { vol: 0, sets: 0 };
        byMuscle[m].vol += vol * factor;
        byMuscle[m].sets += setCount * factor;
      }
    }
  }
  return byMuscle;
}

// Interpolate intensity (0-1) into a heat color. 0 = cold slate, 0.5 = orange,
// 1 = bright red. No work at all returns the empty/dark color.
function heatColor(intensity) {
  if (intensity <= 0) return "#1e2230";
  if (intensity < 0.3) {
    const t = intensity / 0.3;
    return `hsl(220, ${20 + t * 20}%, ${28 + t * 8}%)`;
  }
  if (intensity < 0.7) {
    const t = (intensity - 0.3) / 0.4;
    const hue = 220 - t * 200;
    return `hsl(${hue}, ${40 + t * 40}%, ${36 + t * 10}%)`;
  }
  const t = (intensity - 0.7) / 0.3;
  const hue = 20 - t * 20;
  return `hsl(${hue}, ${80 + t * 15}%, ${48 + t * 4}%)`;
}

function renderBodyHeatmap(userId) {
  // 14-day window divided by 2 ≈ weekly average; this is the number we
  // compare against MEV/MAV/MRV landmarks.
  const data = getRecentMuscleVolume(userId, 14);
  const muscles = ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "core"];
  const totalSets = muscles.reduce((s, m) => s + (data[m]?.sets || 0), 0);
  if (totalSets < 1) return ""; // not enough data to be meaningful

  const weeklySets = (m) => (data[m]?.sets || 0) / 2; // 14d → per-week
  const status = (m) => classifyVolumeStatus(m, weeklySets(m));
  const fill = (m) => status(m).color;
  const units = getPrefs(userId).units;
  const tooltip = (m) => {
    const d = data[m];
    const ws = weeklySets(m);
    const st = status(m);
    if (!d || d.sets < 0.5) {
      const lm = VOLUME_LANDMARKS[m];
      return lm ? `${m}: 0 sets/wk (MEV ${lm.mev})` : `${m}: no work`;
    }
    const volDisplay = d.vol > 0
      ? ` · ${Math.round(toDisplay(d.vol, units)).toLocaleString()} ${units}/2wk`
      : "";
    return `${m}: ${ws.toFixed(1)} sets/wk · ${st.message}${volDisplay}`;
  };

  // Region helper: emit a muscle shape with a <title> tooltip child.
  const rect = (m, x, y, w, h, rx = 0) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill(m)}" class="muscle-region" data-muscle="${m}"><title>${tooltip(m)}</title></rect>`;
  const ell = (m, cx, cy, rx, ry) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill(m)}" class="muscle-region" data-muscle="${m}"><title>${tooltip(m)}</title></ellipse>`;
  const poly = (m, d) =>
    `<path d="${d}" fill="${fill(m)}" class="muscle-region" data-muscle="${m}"><title>${tooltip(m)}</title></path>`;

  return `
    <div class="body-heatmap">
      <h3 class="volume-chart-title">${t("history.bodyHeatmap")} <span class="volume-chart-sub">${t("history.bodyHeatmapSub")}</span></h3>
      <svg viewBox="0 0 420 410" class="body-svg" preserveAspectRatio="xMidYMid meet" aria-label="Body heatmap">
        <!-- FRONT -->
        <g class="figure-front">
          <text x="100" y="14" class="figure-label">FRONT</text>
          <circle cx="100" cy="40" r="16" fill="#1e2230" stroke="#3a3f55" />
          <rect x="94" y="54" width="12" height="9" fill="#1e2230" stroke="#3a3f55" />
          <path d="M 56 72 L 144 72 L 138 165 L 62 165 Z" fill="#1e2230" stroke="#3a3f55" />
          ${rect("chest", 72, 80, 56, 32, 8)}
          ${ell("shoulders", 58, 84, 14, 11)}
          ${ell("shoulders", 142, 84, 14, 11)}
          ${ell("biceps", 44, 123, 10, 22)}
          ${ell("biceps", 156, 123, 10, 22)}
          <rect x="36" y="148" width="16" height="32" rx="4" fill="#1e2230" stroke="#3a3f55" />
          <rect x="148" y="148" width="16" height="32" rx="4" fill="#1e2230" stroke="#3a3f55" />
          ${rect("core", 76, 118, 48, 44, 6)}
          <path d="M 62 165 L 138 165 L 134 195 L 66 195 Z" fill="#1e2230" stroke="#3a3f55" />
          ${ell("quads", 80, 235, 16, 38)}
          ${ell("quads", 120, 235, 16, 38)}
          ${ell("calves", 80, 318, 12, 30)}
          ${ell("calves", 120, 318, 12, 30)}
          <ellipse cx="80" cy="365" rx="14" ry="7" fill="#1e2230" stroke="#3a3f55" />
          <ellipse cx="120" cy="365" rx="14" ry="7" fill="#1e2230" stroke="#3a3f55" />
        </g>

        <!-- BACK -->
        <g transform="translate(210, 0)">
          <text x="100" y="14" class="figure-label">BACK</text>
          <circle cx="100" cy="40" r="16" fill="#1e2230" stroke="#3a3f55" />
          <rect x="94" y="54" width="12" height="9" fill="#1e2230" stroke="#3a3f55" />
          <path d="M 56 72 L 144 72 L 138 165 L 62 165 Z" fill="#1e2230" stroke="#3a3f55" />
          ${poly("back", "M 70 82 L 130 82 L 134 160 L 66 160 Z")}
          ${ell("shoulders", 58, 84, 14, 11)}
          ${ell("shoulders", 142, 84, 14, 11)}
          ${ell("triceps", 44, 123, 10, 22)}
          ${ell("triceps", 156, 123, 10, 22)}
          <rect x="36" y="148" width="16" height="32" rx="4" fill="#1e2230" stroke="#3a3f55" />
          <rect x="148" y="148" width="16" height="32" rx="4" fill="#1e2230" stroke="#3a3f55" />
          ${poly("glutes", "M 62 165 L 138 165 L 135 208 L 65 208 Z")}
          ${ell("hamstrings", 80, 250, 16, 38)}
          ${ell("hamstrings", 120, 250, 16, 38)}
          ${ell("calves", 80, 328, 12, 30)}
          ${ell("calves", 120, 328, 12, 30)}
          <ellipse cx="80" cy="375" rx="14" ry="7" fill="#1e2230" stroke="#3a3f55" />
          <ellipse cx="120" cy="375" rx="14" ry="7" fill="#1e2230" stroke="#3a3f55" />
        </g>
      </svg>
      <div class="heatmap-legend landmarks">
        <span class="lm-swatch" style="background:#1e2230"></span><span>${t("vol.underMev")}</span>
        <span class="lm-swatch" style="background:#9a8c2b"></span><span>${t("vol.approaching")}</span>
        <span class="lm-swatch" style="background:#3da35d"></span><span>${t("vol.optimal")}</span>
        <span class="lm-swatch" style="background:#d68f2c"></span><span>${t("vol.high")}</span>
        <span class="lm-swatch" style="background:#c0392b"></span><span>${t("vol.overMrv")}</span>
      </div>
      ${renderVolumeStatusList(userId, data)}
    </div>
  `;
}

// Compact list below the body diagram: each muscle's per-week sets and status,
// sorted by how problematic it is (over MRV first, then under MEV, then OK).
function renderVolumeStatusList(userId, data) {
  const muscles = ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "core"];
  const rows = muscles.map(m => {
    const weeklySets = (data[m]?.sets || 0) / 2;
    const st = classifyVolumeStatus(m, weeklySets);
    const lm = VOLUME_LANDMARKS[m];
    const target = lm ? `MEV ${lm.mev} · MAV ${lm.mavLow}–${lm.mavHigh}` : "";
    return {
      muscle: m,
      weeklySets,
      status: st,
      target,
      sortOrder: { over: 0, under: 1, high: 2, approaching: 3, optimal: 4, unknown: 5 }[st.status] ?? 5,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  return `
    <div class="volume-status-list">
      ${rows.map(r => `
        <div class="vol-status-row status-${r.status.status}">
          <span class="vol-status-dot" style="background:${r.status.color}"></span>
          <span class="vol-status-muscle">${MUSCLE_LABELS[r.muscle]}</span>
          <span class="vol-status-sets">${r.weeklySets.toFixed(1)} ${t("vol.setsPerWeek")}</span>
          <span class="vol-status-msg">${r.status.message || ""}</span>
        </div>
      `).join("")}
    </div>
  `;
}

// Walk all of a user's exercise_stats history and aggregate by muscle,
// bucketed into ISO weeks. Uses fractional synergist credit (compounds
// distribute work across multiple muscles). Returns
// { muscle: { weekStartMs: { kg, sets } } }.
function getWeeklyVolume(userId, weeksBack = 8) {
  const stats = getStats(userId);
  const cutoffMs = weekStartOf(Date.now()) - (weeksBack - 1) * 7 * 86400000;
  const byMuscle = {};

  for (const [exName, stat] of Object.entries(stats)) {
    const ex = EXERCISES.find(e => e.name === exName);
    if (!ex) continue;
    const contributions = getMuscleContributions(ex);

    for (const entry of (stat.history || [])) {
      const n = normalizeHistoryEntry(entry);
      const ws = weekStartOf(n.date);
      if (ws < cutoffMs) continue;
      const vol = n.sets.reduce((sum, s) =>
        sum + (Number(s.weightKg) || 0) * (Number(s.reps) || 0), 0);
      // Unilateral sides count as 0.5 each.
      const setCount = n.sets.reduce((c, s) => c + (s.side ? 0.5 : 1), 0);

      for (const [muscle, factor] of Object.entries(contributions)) {
        if (!byMuscle[muscle]) byMuscle[muscle] = {};
        if (!byMuscle[muscle][ws]) byMuscle[muscle][ws] = { kg: 0, sets: 0 };
        byMuscle[muscle][ws].kg += vol * factor;
        byMuscle[muscle][ws].sets += setCount * factor;
      }
    }
  }
  return byMuscle;
}

// Render a row of stacked sparkline bars for each muscle with at least one
// week of volume. Empty data → returns "" so the section can be omitted.
function renderWeeklyVolumeChart(userId, weeksBack = 8) {
  const byMuscle = getWeeklyVolume(userId, weeksBack);
  const targets = getVolumeTargets(userId);
  const muscleNames = Object.keys(byMuscle).sort((a, b) => {
    const totalA = Object.values(byMuscle[a]).reduce((s, v) => s + v.kg, 0);
    const totalB = Object.values(byMuscle[b]).reduce((s, v) => s + v.kg, 0);
    return totalB - totalA;
  });
  if (muscleNames.length === 0) return "";

  const units = getPrefs(userId).units;
  const thisWeek = weekStartOf(Date.now());
  const weekStarts = Array.from({ length: weeksBack }, (_, i) =>
    thisWeek - (weeksBack - 1 - i) * 7 * 86400000);

  const allKg = muscleNames.flatMap(m => weekStarts.map(w => byMuscle[m][w]?.kg || 0));
  const globalMax = Math.max(1, ...allKg);

  const rows = muscleNames.map(muscle => {
    const cells = weekStarts.map(w => byMuscle[muscle][w] || { kg: 0, sets: 0 });
    const latest = cells[cells.length - 1];
    const target = targets[muscle] || 0;
    const targetMet = target > 0 && latest.sets >= target;
    const targetMark = target > 0
      ? `<span class="vol-target ${targetMet ? "met" : "miss"}">${latest.sets}/${target}${targetMet ? " ✓" : ""}</span>`
      : "";
    const latestDisplay = latest.kg > 0
      ? `${Math.round(toDisplay(latest.kg, units)).toLocaleString()} ${units}`
      : "—";
    const bars = cells.map((c, idx) => {
      const height = (c.kg / globalMax) * 100;
      const cls = c.kg > 0 ? "bar-filled" : "bar-empty";
      const setsTxt = c.sets ? ` · ${c.sets} sets` : "";
      const display = c.kg > 0
        ? `${Math.round(toDisplay(c.kg, units)).toLocaleString()} ${units}${setsTxt}`
        : "no work";
      const weekDate = new Date(weekStarts[idx]).toLocaleDateString();
      return `<div class="vol-bar-wrap" title="${display} · week of ${weekDate}">
        <div class="vol-bar ${cls}" style="height: ${height}%;"></div>
      </div>`;
    }).join("");
    return `
      <div class="vol-row">
        <span class="vol-muscle">${MUSCLE_LABELS[muscle]}${targetMark}</span>
        <div class="vol-bars">${bars}</div>
        <span class="vol-latest">${latestDisplay}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="volume-chart">
      <h3 class="volume-chart-title">${t("history.weeklyVolume")} <span class="volume-chart-sub">${t("history.weeklyVolumeSub", { n: weeksBack })}</span></h3>
      <div class="vol-rows">${rows}</div>
    </div>
  `;
}

// ─── EQUIPMENT LOADS ─────────────────────────────────────────────────────
// All loads stored in kg internally.
function getLoads(userId) {
  const all = load(STORAGE_KEYS.loads, {});
  return all[userId] || { maxDumbbellKg: 0, maxKettlebellKg: 0, hasHeavyBarbell: false };
}
// ─── SORENESS TRACKING ───────────────────────────────────────────────────
// Stores per-muscle soreness levels (0-3 scale). Decays over time so old
// soreness doesn't poison future generations.
function getVolumeTargets(userId) {
  const all = load(STORAGE_KEYS.volumeTargets, {});
  return all[userId] || {};
}
function setVolumeTargets(userId, targets) {
  const all = load(STORAGE_KEYS.volumeTargets, {});
  all[userId] = { ...all[userId], ...targets };
  save(STORAGE_KEYS.volumeTargets, all);
}

function setSoreness(userId, muscle, level) {
  const all = load(STORAGE_KEYS.soreness, {});
  if (!all[userId]) all[userId] = {};
  all[userId][muscle] = { level: Math.max(0, Math.min(3, level)), at: Date.now() };
  save(STORAGE_KEYS.soreness, all);
}

// ─── SLEEP TRACKING ──────────────────────────────────────────────────────
function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getSleepRating(userId, date = new Date()) {
  const all = load(STORAGE_KEYS.sleep, {});
  const userSleep = all[userId];
  if (!userSleep) return null;
  return userSleep[dateKey(date)] || null;
}

function setSleepRating(userId, quality) {
  const all = load(STORAGE_KEYS.sleep, {});
  if (!all[userId]) all[userId] = {};
  all[userId][dateKey()] = { quality, recordedAt: Date.now() };
  save(STORAGE_KEYS.sleep, all);
}

// Mark "user explicitly chose not to rate today." Stored as quality: null
// with skipped: true so it's distinguishable from a real rating but still
// satisfies the "have we asked today" check.
function setSleepSkipped(userId) {
  const all = load(STORAGE_KEYS.sleep, {});
  if (!all[userId]) all[userId] = {};
  all[userId][dateKey()] = { quality: null, skipped: true, recordedAt: Date.now() };
  save(STORAGE_KEYS.sleep, all);
}

// Returns true if user has a real numeric rating for today (not skip-marker).
function hasRealSleepRating(record) {
  return !!(record && typeof record.quality === "number" && record.quality > 0);
}

// Detect under-recovery from sleep + accumulated soreness. Returns an
// object describing the reasons, or null if we're fine.
function getUnderRecoveryStatus(userId) {
  const sleep = getSleepRating(userId);
  // Only count sleep as bad if we have an actual numeric rating ≤2.
  // Skipped/null ratings shouldn't trigger the recovery banner.
  const badSleep = hasRealSleepRating(sleep) && sleep.quality <= 2;
  const all = load(STORAGE_KEYS.soreness, {});
  const us = all[userId] || {};
  let highSore = 0;
  const soreMuscles = [];
  for (const muscle of Object.keys(us)) {
    if (getCurrentSoreness(userId, muscle) >= 2.0) {
      highSore++;
      soreMuscles.push(muscle);
    }
  }
  if (!badSleep && highSore < 3) return null;
  return { badSleep, highSore, soreMuscles };
}

function getCurrentSoreness(userId, muscle) {
  if (!userId) return 0;
  const all = load(STORAGE_KEYS.soreness, {});
  const entry = all[userId]?.[muscle];
  if (!entry) return 0;
  const hoursSince = (Date.now() - entry.at) / 3600000;
  // Full strength for first 18h, then halves every 24h after that.
  if (hoursSince <= 18) return entry.level;
  return entry.level * Math.pow(0.5, (hoursSince - 18) / 24);
}

function setLoads(userId, loads) {
  const all = load(STORAGE_KEYS.loads, {});
  all[userId] = { ...getLoads(userId), ...loads };
  save(STORAGE_KEYS.loads, all);
  cloudPush(() => sb.from("user_loads").upsert({
    user_id: session.userId,
    max_dumbbell_kg: all[userId].maxDumbbellKg || 0,
    max_kettlebell_kg: all[userId].maxKettlebellKg || 0,
    has_heavy_barbell: !!all[userId].hasHeavyBarbell,
    updated_at: new Date().toISOString(),
  }));
}

// Decide whether the user's available equipment can support the chosen goal +
// difficulty. Strength training needs near-maximal loads; with a single light
// kettlebell or just bodyweight, it's mostly impossible past beginner.
//
// Returns null if everything is fine, otherwise an object describing the
// mismatch (used to render the warning banner).
function checkLoadAdequacy({ goal, equipment, difficulty, style }, loads) {
  if (goal !== "strength") return null;
  if (difficulty === "beginner") return null;
  // Intensity Mode solves the light-load problem — no warning needed.
  if (style === "intensity") return null;

  // "Heavy" sources of resistance: loaded barbell, gym machines.
  const hasHeavyBarbell = equipment.includes("barbell") && loads.hasHeavyBarbell;
  const hasMachine = equipment.includes("machine");
  if (hasHeavyBarbell || hasMachine) return null;

  // Thresholds for strength training (single-implement, near-max load needed).
  // Intermediate strength: need at least a 20kg DB or 20kg KB.
  // Advanced strength:     need at least a 30kg DB or 28kg KB.
  const need = difficulty === "advanced"
    ? { db: 30, kb: 28 }
    : { db: 20, kb: 20 };

  const maxDB = equipment.includes("dumbbells") ? (loads.maxDumbbellKg || 0) : 0;
  const maxKB = equipment.includes("kettlebell") ? (loads.maxKettlebellKg || 0) : 0;

  if (maxDB >= need.db || maxKB >= need.kb) return null;

  // Mismatch — figure out the best summary line.
  let reason;
  if (maxDB === 0 && maxKB === 0 && !equipment.includes("barbell") && !hasMachine) {
    reason = t("warn.reasonNoneSelected");
  } else if (maxDB === 0 && maxKB === 0) {
    reason = t("warn.reasonUnknownMax");
  } else {
    const units = session ? getPrefs(session.username).units : "kg";
    const limit = Math.max(maxDB, maxKB);
    reason = t("warn.reasonTooLight", { weight: toDisplay(limit, units), units, diff: t(`diff.${difficulty}`) });
  }

  return {
    reason,
    recommendation: t("warn.recommendation"),
    suggestedGoal: "hypertrophy",
  };
}

// ─── UNIT CONVERSION ─────────────────────────────────────────────────────
function kgToLb(kg) { return Math.round(kg * 2.20462 * 2) / 2; }
function lbToKg(lb) { return Math.round((lb / 2.20462) * 4) / 4; }
function toDisplay(kg, units) {
  if (kg == null || isNaN(kg)) return 0;
  return units === "lb" ? kgToLb(kg) : roundHalf(kg);
}
function fromDisplay(val, units) {
  const n = Number(val);
  if (!isFinite(n)) return 0;
  return units === "lb" ? lbToKg(n) : n;
}
function roundHalf(x) { return Math.round(x * 2) / 2; }

// ─── PROGRESSION ALGORITHM (double progression) ──────────────────────────
// If user hit top of rep range → add weight (or reps for bodyweight).
// If user was inside rep range → same weight, push for one more rep.
// If user fell below bottom of range → suggest a deload.
// Parse time-based reps strings into seconds. Handles "30-60 sec",
// "X sec", "X-Y min", "X min steady state", etc. Returns null when
// the reps string isn't time-based.
function parseTimeReps(reps) {
  if (typeof reps !== "string") return null;
  let m = reps.match(/(\d+)\s*[\-–]\s*(\d+)\s*sec/);
  if (m) return Math.round((Number(m[1]) + Number(m[2])) / 2);
  m = reps.match(/(\d+)\s*sec/);
  if (m) return Number(m[1]);
  m = reps.match(/(\d+)\s*[\-–]\s*(\d+)\s*min/);
  if (m) return Math.round((Number(m[1]) + Number(m[2])) / 2) * 60;
  m = reps.match(/(\d+)\s*min/);
  if (m) return Number(m[1]) * 60;
  return null;
}

// Pretty-print seconds. 45 → "45s", 90 → "1:30", 180 → "3:00".
function formatSecs(s) {
  if (s == null || isNaN(s)) return "";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function parseRepRange(repsStr) {
  if (typeof repsStr !== "string") return [8, 12];
  if (/sec/i.test(repsStr)) return [0, 0]; // time-based; no rep progression
  const m = repsStr.match(/(\d+)[^\d]+(\d+)/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  const single = repsStr.match(/(\d+)/);
  if (single) return [parseInt(single[1], 10), parseInt(single[1], 10)];
  return [8, 12];
}

function progressionIncrementKg(pattern) {
  return pattern === "isolation" ? 1.25 : 2.5;
}

// Real-world equipment doesn't increment in 2.5kg steps. Snap the suggested
// next weight to the smallest realistic jump for the actual equipment.
// For kettlebells specifically, the user can list what they own in Settings
// (e.g. "10, 12, 16, 24, 32") — the algorithm picks the next available.
function nextRealisticWeight(currentKg, exerciseName, userId) {
  const ex = EXERCISES.find(e => e.name === exerciseName);
  const eqs = ex?.equipment || [];

  // Honor user's actual kettlebell inventory if set
  if (eqs.includes("kettlebell") && userId) {
    const loads = getLoads(userId);
    const inventory = loads.availableKettlebellsKg;
    if (Array.isArray(inventory) && inventory.length > 0) {
      const sorted = [...inventory].sort((a, b) => a - b);
      const next = sorted.find(w => w > currentKg);
      if (next) return next;
      // Already at max — return the same so caller sees no jump available
      return currentKg;
    }
  }

  let stepKg;
  if (eqs.includes("kettlebell")) stepKg = 4;
  else if (eqs.includes("dumbbells")) stepKg = 2;
  else if (eqs.includes("barbell")) stepKg = 5;
  else if (eqs.includes("machine")) stepKg = 2.5;
  else return currentKg + progressionIncrementKg(ex?.pattern || "compound");
  return Math.ceil((currentKg + 0.001) / stepKg) * stepKg;
}

// Double progression with EXTENDED ranges — applied in every scenario.
// Rationale: pushing reps to topOfRange + 5 before adding weight banks more
// volume, smooths the next jump (real equipment increments are often 2.5–8kg,
// which is non-trivial relative to working weight), and avoids the rep crater
// that follows a premature load increase. This is the best tradeoff whether
// the jump is 5% (barbell adding 5kg) or 50% (kettlebell 16→24).
function smartProgression(currentKg, exerciseName, topOfRange, userId, lastReps) {
  const extensionTarget = topOfRange + 5;
  const nextKg = nextRealisticWeight(currentKg, exerciseName, userId);
  const hasEarnedJump = lastReps != null && lastReps >= extensionTarget;
  const jumpPct = currentKg > 0 ? (nextKg - currentKg) / currentKg : 0;

  // Haven't hit the extended target yet — keep pushing reps at current weight.
  if (!hasEarnedJump) {
    const noteTail = nextKg > currentKg
      ? `then jump to ${nextKg}kg${jumpPct > 0.30 ? ` (+${Math.round(jumpPct * 100)}%)` : ""}`
      : `at max weight available`;
    return {
      mode: "extend-reps",
      weight: currentKg,
      reps: extensionTarget,
      note: `push to ${extensionTarget} reps · ${noteTail}`,
    };
  }

  // Earned the jump but nothing heavier exists — keep climbing reps.
  if (nextKg <= currentKg) {
    return {
      mode: "extend-reps",
      weight: currentKg,
      reps: Math.max(extensionTarget, (lastReps || 0) + 1),
      note: `at max available weight · keep extending reps`,
    };
  }

  // Take the jump. Warn if it's a big one so user knows to expect fewer reps.
  return {
    mode: "add-weight",
    weight: nextKg,
    reps: null,
    note: jumpPct > 0.30
      ? `big jump to ${nextKg}kg (+${Math.round(jumpPct * 100)}%) · expect fewer reps`
      : null,
  };
}

function exerciseUsesWeight(name) {
  const ex = EXERCISES.find(e => e.name === name);
  if (!ex) return false;
  if (ex.pattern === "mobility") return false;
  return ex.equipment.some(e => e !== "bodyweight");
}

// Find a replacement for an exercise within the same form inputs. Tiers from
// strict (same primary muscle + pattern) to loose (anything matching the
// workout's filters) so swap almost always succeeds.
function findAlternativeExercise(currentName, inputs, excludeNames) {
  const current = EXERCISES.find(e => e.name === currentName);
  if (!current) return null;
  const exclude = new Set([currentName, ...(excludeNames || [])]);

  const baseCandidates = EXERCISES.filter(ex => {
    if (exclude.has(ex.name)) return false;
    const equipOk = ex.equipment.some(e => inputs.equipment.includes(e));
    const diffOk = matchesDifficulty(ex.difficulty, inputs.difficulty);
    const targetOk = matchesTarget(ex, inputs.target);
    return equipOk && diffOk && targetOk;
  });
  if (!baseCandidates.length) return null;

  const pickRandom = (arr) => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;

  // Tier 1: exact primary muscle + same pattern
  let pool = baseCandidates.filter(e => e.muscle[0] === current.muscle[0] && e.pattern === current.pattern);
  if (pool.length) return pickRandom(pool);

  // Tier 2: same pattern, any muscle overlap
  pool = baseCandidates.filter(e => e.pattern === current.pattern && e.muscle.some(m => current.muscle.includes(m)));
  if (pool.length) return pickRandom(pool);

  // Tier 3: same pattern, anything
  pool = baseCandidates.filter(e => e.pattern === current.pattern);
  if (pool.length) return pickRandom(pool);

  // Tier 4: same primary muscle, any pattern
  pool = baseCandidates.filter(e => e.muscle[0] === current.muscle[0]);
  if (pool.length) return pickRandom(pool);

  return null;
}

function isTrackable(name) {
  // Mobility / cardio machine work isn't logged with reps the same way.
  const ex = EXERCISES.find(e => e.name === name);
  if (!ex) return false;
  if (ex.pattern === "mobility") return false;
  if (ex.equipment.length === 1 && ex.equipment[0] === "cardio_machine") return false;
  return true;
}

function getSuggestion(userId, exerciseName, prescription, pattern, goal) {
  const stat = getExerciseStat(userId, exerciseName);
  if (!stat || !stat.history?.length) return { last: null, next: null, trend: null };

  const [lo, hi] = parseRepRange(prescription.reps);
  const usesWeight = exerciseUsesWeight(exerciseName);
  const inc = progressionIncrementKg(pattern);

  // Find the working set from the last session (heaviest set, by e1RM).
  const lastSession = normalizeHistoryEntry(stat.history[stat.history.length - 1]);
  if (lastSession.sets.length === 0) return { last: null, next: null, trend: null };
  const workingSet = lastSession.sets.reduce((best, s) =>
    calculateE1RM(s.weightKg, s.reps) > calculateE1RM(best.weightKg, best.reps) ? s : best, lastSession.sets[0]);
  const lastKg = workingSet.weightKg;

  // For unilateral exercises, progression is gated by the WEAKER side —
  // both sides must hit the top of the rep range before adding load.
  // Pick the lowest rep count across the most-recent matched R/L pair.
  let lastReps = workingSet.reps;
  const isUnilateralSession = lastSession.sets.some(s => s.side);
  if (isUnilateralSession) {
    const rSets = lastSession.sets.filter(s => s.side === "R");
    const lSets = lastSession.sets.filter(s => s.side === "L");
    if (rSets.length && lSets.length) {
      const minR = Math.min(...rSets.map(s => s.reps));
      const minL = Math.min(...lSets.map(s => s.reps));
      lastReps = Math.min(minR, minL);
    }
  }

  // RIR (Reps In Reserve) signal — average across the last-session's sets
  // that logged it. Lower = closer to failure. Used to autoregulate:
  //   • Hit-top + high RIR (≥3) → "you had reps left, push harder before jumping"
  //   • In-range + low RIR (0-1) → "you're already near failure, hold weight"
  //   • Miss-bottom + high RIR (≥3) → reps low but easy — likely a logging issue,
  //     not a weight issue; don't deload.
  //   • Miss-bottom + low RIR (0-1) → genuine deload signal
  const setsWithRir = lastSession.sets.filter(s => s.rir != null);
  const avgRir = setsWithRir.length
    ? setsWithRir.reduce((s, x) => s + x.rir, 0) / setsWithRir.length
    : null;

  let nextKg = lastKg;
  let nextReps = lastReps;
  let trend = "same";

  let progressionNote = null;
  if (lo > 0 && lastReps >= hi) {
    // Hit top of range. If RIR was high (≥3), we have evidence the user
    // didn't push — defer the jump and ask for more reps at current weight.
    if (avgRir != null && avgRir >= 3 && usesWeight) {
      nextKg = lastKg;
      nextReps = Math.min(hi + 5, lastReps + 3);
      progressionNote = `last session avg RIR ${avgRir.toFixed(1)} · reps in the tank · push harder before adding weight`;
      trend = "same";
    } else if (usesWeight) {
      const smart = smartProgression(lastKg, exerciseName, hi, userId, lastReps);
      nextKg = smart.weight;
      nextReps = smart.reps != null ? smart.reps : lo;
      progressionNote = smart.note;
      trend = "up";
    } else {
      nextReps = lastReps + 1;
      trend = "up";
    }
  } else if (lo > 0 && lastReps < lo) {
    // Missed bottom of range. Distinguish "weight genuinely too heavy"
    // (low RIR — hit failure early) from "didn't push" (high RIR).
    if (avgRir != null && avgRir >= 3) {
      // High RIR + missed bottom = inconsistency, not weight problem.
      // Hold the weight; ask for a real effort next session.
      nextKg = lastKg;
      nextReps = Math.round((lo + hi) / 2);
      progressionNote = `RIR ${avgRir.toFixed(1)} with low reps · push closer to failure next time`;
      trend = "same";
    } else if (usesWeight) {
      nextKg = Math.max(0, lastKg - inc);
      nextReps = Math.round((lo + hi) / 2);
      trend = "down";
    } else {
      nextReps = Math.max(1, lastReps - 1);
      trend = "down";
    }
  } else {
    // In range — default is push for one more rep. But if RIR was very high,
    // hint that the user should push harder rather than just creep up.
    if (lo > 0) nextReps = Math.min(hi, Math.max(lo, lastReps + 1));
    if (avgRir != null && avgRir >= 3) {
      progressionNote = `RIR ${avgRir.toFixed(1)} · room to push harder`;
    } else if (avgRir != null && avgRir <= 1 && lastReps < hi) {
      // Already at/near failure mid-range — don't add weight, hold and grind.
      progressionNote = `RIR ${avgRir.toFixed(1)} · near failure · hold weight, build reps`;
    }
    trend = "same";
  }

  // Recovery override: regardless of progression math, suggest ~55% of last
  // working weight at the prescription's mid-rep range. Whole point is light.
  if (goal === "recovery" && usesWeight && lastKg > 0) {
    nextKg = Math.max(0, Math.round(lastKg * 0.55 * 2) / 2);
    nextReps = Math.round((lo + hi) / 2);
    trend = "recovery";
    progressionNote = null;
  }

  return {
    last: { weightKg: lastKg, reps: lastReps, date: lastSession.date, allSets: lastSession.sets, avgRir },
    next: { weightKg: nextKg, reps: nextReps },
    trend,
    note: progressionNote,
  };
}

// ─── DOM ─────────────────────────────────────────────────────────────────
const el = {
  nav: document.getElementById("nav"),
  userLabel: document.getElementById("userLabel"),
  logoutBtn: document.getElementById("logoutBtn"),
  authView: document.getElementById("authView"),
  generatorView: document.getElementById("generatorView"),
  historyView: document.getElementById("historyView"),
  settingsView: document.getElementById("settingsView"),
  guidedView: document.getElementById("guidedView"),
  libraryView: document.getElementById("libraryView"),
  loadWarning: document.getElementById("loadWarning"),
  deloadBanner: document.getElementById("deloadBanner"),
  recommendationBanner: document.getElementById("recommendationBanner"),
  sleepPrompt: document.getElementById("sleepPrompt"),
  recoveryBanner: document.getElementById("recoveryBanner"),
  levelBanner: document.getElementById("levelBanner"),
  authForm: document.getElementById("authForm"),
  authSubmit: document.getElementById("authSubmit"),
  authError: document.getElementById("authError"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  confirmPanel: document.getElementById("confirmPanel"),
  confirmPanelEmail: document.getElementById("confirmPanelEmail"),
  confirmResendBtn: document.getElementById("confirmResendBtn"),
  confirmBackBtn: document.getElementById("confirmBackBtn"),
  confirmStatus: document.getElementById("confirmStatus"),
  generateBtn: document.getElementById("generateBtn"),
  formError: document.getElementById("formError"),
  workoutResult: document.getElementById("workoutResult"),
  historyList: document.getElementById("historyList"),
};

// ─── ROUTING / VIEWS ─────────────────────────────────────────────────────
function showAuth() {
  el.nav.classList.add("hidden");
  // Close the mobile menu in case it's open (otherwise it overlays auth)
  el.nav.classList.remove("menu-open");
  el.authView.classList.remove("hidden");
  // Hide ALL app views — not just generator+history, because if the user
  // clicks Logout from Settings/Library/Guided, those need to vanish too
  // or they'll stack on top of the auth view and the screen looks frozen.
  el.generatorView.classList.add("hidden");
  el.historyView.classList.add("hidden");
  el.settingsView?.classList.add("hidden");
  el.libraryView?.classList.add("hidden");
  el.guidedView?.classList.add("hidden");
  // Render cloud status indicator
  const status = getCloudStatus();
  const cs = document.getElementById("cloudStatus");
  if (cs) {
    cs.textContent = status.text;
    cs.className = `cloud-status cloud-status-${status.mode}`;
  }
}
function showApp(view = "generator") {
  el.nav.classList.toggle("hidden", view === "guided");
  el.authView.classList.add("hidden");
  el.userLabel.textContent = session.username;
  applyUnitsButtons();
  // Initial sync state — assume OK on first paint; cloudPush calls will update.
  if (HAS_SUPABASE && session?.userId && syncState.status === "idle") {
    setSyncStatus(navigator.onLine ? "ok" : "error");
  } else {
    renderSyncIndicator();
  }
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  el.generatorView.classList.toggle("hidden", view !== "generator");
  el.historyView.classList.toggle("hidden", view !== "history");
  el.settingsView.classList.toggle("hidden", view !== "settings");
  el.guidedView.classList.toggle("hidden", view !== "guided");
  el.libraryView.classList.toggle("hidden", view !== "library");
  if (view === "history") renderHistory();
  if (view === "settings") renderSettings();
  if (view === "library") renderLibrary();
  if (view === "generator") {
    refreshLoadWarning();
    refreshDeloadBanner();
    refreshRecommendationBanner();
    refreshStreakBadge();
    refreshSleepPrompt();
    refreshRecoveryBanner();
    refreshLevelBanner();
  }
  // Daily sleep modal — fires once per session, any view, if today is unrated.
  // Don't pop it during a Guided session (would interrupt mid-workout).
  if (view !== "guided") maybeShowDailySleepModal();
}

// Look at the user's recent RPE ratings and recommend bumping difficulty
// up (sessions felt easy) or down (sessions felt all-out). Returns null if
// not enough data yet.
const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"];

function getLevelRecommendation(userId) {
  const workouts = getWorkouts(userId);
  // Only look at the last 5 workouts that have an RPE rating
  const rated = workouts.filter(w => typeof w.rpe === "number").slice(0, 5);
  if (rated.length < 2) return null;

  const avgRpe = rated.reduce((s, w) => s + w.rpe, 0) / rated.length;
  // Mode of difficulty across rated workouts (what they've been training at)
  const diffCounts = {};
  rated.forEach(w => {
    const d = w.inputs?.difficulty;
    if (d) diffCounts[d] = (diffCounts[d] || 0) + 1;
  });
  const currentDiff = Object.keys(diffCounts).sort((a, b) => diffCounts[b] - diffCounts[a])[0];
  if (!currentDiff) return null;
  const idx = DIFFICULTY_ORDER.indexOf(currentDiff);

  if (avgRpe >= 4.3 && idx > 0) {
    const to = DIFFICULTY_ORDER[idx - 1];
    return {
      direction: "down",
      from: currentDiff,
      to,
      reason: t("level.reasonDown", { n: rated.length, avg: avgRpe.toFixed(1), next: t(`diff.${to}`) }),
    };
  }
  if (avgRpe <= 2 && idx < DIFFICULTY_ORDER.length - 1) {
    const to = DIFFICULTY_ORDER[idx + 1];
    return {
      direction: "up",
      from: currentDiff,
      to,
      reason: t("level.reasonUp", { n: rated.length, avg: avgRpe.toFixed(1), next: t(`diff.${to}`) }),
    };
  }
  return null;
}

function refreshLevelBanner() {
  if (!session || !el.levelBanner) return;
  // Don't show if user already picked a difficulty
  if (formState.difficulty) {
    el.levelBanner.classList.add("hidden");
    el.levelBanner.innerHTML = "";
    return;
  }
  const rec = getLevelRecommendation(session.username);
  if (!rec) {
    el.levelBanner.classList.add("hidden");
    el.levelBanner.innerHTML = "";
    return;
  }
  el.levelBanner.classList.remove("hidden");
  const arrow = rec.direction === "up" ? "↑" : "↓";
  el.levelBanner.innerHTML = `
    <div class="level-banner-icon">${arrow}</div>
    <div class="level-banner-content">
      <div class="level-banner-title">${rec.direction === "up" ? t("level.titleUp") : t("level.titleDown")}</div>
      <div class="level-banner-body">${rec.reason}</div>
    </div>
    <div class="level-banner-actions">
      <button class="primary-btn" data-level-action="apply" data-target="${rec.to}">${t("level.try", { level: t(`diff.${rec.to}`) })}</button>
      <button class="secondary-btn" data-level-action="dismiss">${t("level.skip")}</button>
    </div>
  `;
  el.levelBanner.querySelector("[data-level-action='apply']").addEventListener("click", (e) => {
    const target = e.target.dataset.target;
    const chip = document.querySelector(`.chip[data-value="${target}"]`);
    if (chip) chip.click();
    el.levelBanner.classList.add("hidden");
  });
  el.levelBanner.querySelector("[data-level-action='dismiss']").addEventListener("click", () => {
    el.levelBanner.classList.add("hidden");
  });
}

// Pick a target the user hasn't trained recently. Body-part balance.
function getRecommendedTarget(userId) {
  const workouts = getWorkouts(userId);
  if (!workouts.length) {
    return { target: "full_body", reason: t("recm.reasonFirst") };
  }
  const last = workouts[0];
  const lastTarget = last.inputs?.target;
  const hoursSince = (Date.now() - last.createdAt) / 3600000;

  if (hoursSince < 12) {
    return {
      target: "mobility",
      reason: t("recm.reasonRecent", { last: TARGET_LABELS[lastTarget] || lastTarget }),
    };
  }

  const opposite = {
    upper: "lower", lower: "upper",
    push: "pull", pull: "push",
    legs: "upper", core: "full_body",
    full_body: "mobility", cardio: "full_body",
    mobility: "full_body",
  }[lastTarget] || "full_body";

  return {
    target: opposite,
    reason: t("recm.reasonBalance", { last: TARGET_LABELS[lastTarget] || lastTarget, opp: TARGET_LABELS[opposite] }),
  };
}

// Count consecutive training days ending today (or yesterday — grace day).
function getStreak(userId) {
  const stats = getStats(userId);
  const dates = new Set();
  for (const stat of Object.values(stats)) {
    for (const entry of (stat.history || [])) {
      const n = normalizeHistoryEntry(entry);
      const d = new Date(n.date);
      d.setHours(0, 0, 0, 0);
      dates.add(d.getTime());
    }
  }
  const workouts = getWorkouts(userId);
  for (const w of workouts) {
    const d = new Date(w.createdAt);
    d.setHours(0, 0, 0, 0);
    dates.add(d.getTime());
  }
  if (dates.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = today.getTime();
  // Grace: allow today to be empty if user hasn't trained yet today.
  if (!dates.has(cursor)) cursor -= 86400000;
  if (!dates.has(cursor)) return 0;
  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor -= 86400000;
  }
  return streak;
}

function refreshStreakBadge() {
  const badge = document.getElementById("streakBadge");
  if (!badge || !session) return;
  const streak = getStreak(session.username);
  if (streak < 2) {
    badge.classList.add("hidden");
    return;
  }
  badge.classList.remove("hidden");
  badge.textContent = `🔥 ${streak}`;
  badge.title = `${streak} day training streak — keep it going`;
}

// ─── DAILY SLEEP MODAL ───────────────────────────────────────────────────
// Pops a modal once per day on app open if today's sleep isn't logged yet.
// Fires from any entry view (Generator, History, Library, Settings) — the
// inline banner on Generator was easy to miss if users headed straight to
// another tab.
//
// Once shown in a session, it doesn't re-show even if user dismisses with
// X (avoids spam). They can still rate later from Settings → Sleep.
let _sleepModalShownThisSession = false;

function maybeShowDailySleepModal() {
  if (_sleepModalShownThisSession) return;
  if (!session) return;
  const modal = document.getElementById("sleepModal");
  if (!modal) return;
  const today = getSleepRating(session.username);
  if (today) return; // already rated or explicitly skipped today

  _sleepModalShownThisSession = true;

  // Reset listener state (each open binds fresh)
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // prevent background scroll on iOS

  const closeModal = () => {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  };

  modal.querySelectorAll("[data-sleep-modal]").forEach(btn => {
    btn.onclick = () => {
      const q = Number(btn.dataset.sleepModal);
      setSleepRating(session.username, q);
      closeModal();
      // Refresh dependent UI
      refreshSleepPrompt();
      refreshRecoveryBanner();
    };
  });

  const skipBtn = document.getElementById("sleepModalSkip");
  const closeBtn = document.getElementById("sleepModalClose");
  if (skipBtn) skipBtn.onclick = () => {
    setSleepSkipped(session.username);
    closeModal();
    refreshSleepPrompt();
  };
  // X just dismisses for this session — does NOT mark skip, so the inline
  // Generator banner will still nudge them.
  if (closeBtn) closeBtn.onclick = () => closeModal();

  // Click outside the card also closes (same as X — non-committing).
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
}

// One-tap sleep prompt that appears once per day until rated OR skipped.
function refreshSleepPrompt() {
  if (!session || !el.sleepPrompt) return;
  const today = getSleepRating(session.username);
  if (today) {
    // Already rated or explicitly skipped — don't re-prompt until tomorrow.
    el.sleepPrompt.classList.add("hidden");
    el.sleepPrompt.innerHTML = "";
    return;
  }
  el.sleepPrompt.classList.remove("hidden");
  el.sleepPrompt.innerHTML = `
    <div class="sleep-prompt-title">${t("sleep.promptTitle")}</div>
    <div class="sleep-prompt-options">
      <button class="sleep-btn" data-sleep="5" title="${t("sleep.greatDesc")}">😴 ${t("sleep.great")}</button>
      <button class="sleep-btn" data-sleep="4" title="${t("sleep.okDesc")}">🙂 ${t("sleep.ok")}</button>
      <button class="sleep-btn" data-sleep="2" title="${t("sleep.mehDesc")}">😐 ${t("sleep.meh")}</button>
      <button class="sleep-btn" data-sleep="1" title="${t("sleep.badDesc")}">😩 ${t("sleep.bad")}</button>
      <button class="sleep-btn skip" data-sleep="skip">${t("common.skip")}</button>
    </div>
  `;
  el.sleepPrompt.querySelectorAll(".sleep-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.sleep;
      if (v === "skip") setSleepSkipped(session.username);
      else setSleepRating(session.username, Number(v));
      el.sleepPrompt.classList.add("hidden");
      refreshRecoveryBanner();
    });
  });
}

// Recovery banner: shows when bad sleep + accumulated soreness suggest the
// user should skip the heavy session and do a light Recovery workout instead.
function refreshRecoveryBanner() {
  if (!session || !el.recoveryBanner) return;
  // Don't show if user has already picked recovery as their goal.
  if (formState.goal === "recovery") {
    el.recoveryBanner.classList.add("hidden");
    el.recoveryBanner.innerHTML = "";
    return;
  }
  const status = getUnderRecoveryStatus(session.username);
  if (!status) {
    el.recoveryBanner.classList.add("hidden");
    el.recoveryBanner.innerHTML = "";
    return;
  }
  const reasons = [];
  if (status.badSleep) reasons.push(t("rec.reasonBadSleep"));
  if (status.highSore >= 3) reasons.push(t("rec.reasonSore", { n: status.highSore }));
  el.recoveryBanner.classList.remove("hidden");
  el.recoveryBanner.innerHTML = `
    <div class="recovery-banner-icon">🌙</div>
    <div class="recovery-banner-content">
      <div class="recovery-banner-title">${t("rec.title")}</div>
      <div class="recovery-banner-body">${t("rec.body", { reasons: reasons.join(" + ") })}</div>
    </div>
    <div class="recovery-banner-actions">
      <button class="primary-btn" data-rec-action="apply">${t("rec.start")}</button>
      <button class="secondary-btn" data-rec-action="dismiss">${t("rec.dismiss")}</button>
    </div>
  `;
  el.recoveryBanner.querySelector("[data-rec-action='apply']").addEventListener("click", () => {
    // Select the Recovery goal chip
    const chip = document.querySelector('.chip[data-value="recovery"]');
    if (chip) chip.click();
  });
  el.recoveryBanner.querySelector("[data-rec-action='dismiss']").addEventListener("click", () => {
    el.recoveryBanner.classList.add("hidden");
  });
}

function refreshRecommendationBanner() {
  if (!session || !el.recommendationBanner) return;
  // Don't show if the user has already selected a target (they know what they want)
  if (formState.target) {
    el.recommendationBanner.classList.add("hidden");
    el.recommendationBanner.innerHTML = "";
    return;
  }
  // Suppress if recovery banner is active — recovery is more important and
  // the recommendation would conflict with the under-recovered messaging.
  if (el.recoveryBanner && !el.recoveryBanner.classList.contains("hidden")) {
    el.recommendationBanner.classList.add("hidden");
    el.recommendationBanner.innerHTML = "";
    return;
  }
  const rec = getRecommendedTarget(session.username);
  el.recommendationBanner.classList.remove("hidden");
  el.recommendationBanner.innerHTML = `
    <div class="rec-banner-icon">★</div>
    <div class="rec-banner-content">
      <div class="rec-banner-title">${t("recm.title")} <strong>${TARGET_LABELS[rec.target]}</strong></div>
      <div class="rec-banner-body">${rec.reason}</div>
    </div>
    <div class="rec-banner-actions">
      <button class="primary-btn" data-rec-action="apply" data-target="${rec.target}">${t("recm.apply")}</button>
      <button class="secondary-btn" data-rec-action="dismiss">${t("recm.dismiss")}</button>
    </div>
  `;
  el.recommendationBanner.querySelector("[data-rec-action='apply']").addEventListener("click", (e) => {
    const t = e.target.dataset.target;
    const chip = document.querySelector(`.chip[data-value="${t}"]`);
    if (chip) chip.click();
    el.recommendationBanner.classList.add("hidden");
  });
  el.recommendationBanner.querySelector("[data-rec-action='dismiss']").addEventListener("click", () => {
    el.recommendationBanner.classList.add("hidden");
  });
}

function refreshDeloadBanner() {
  if (!session || !el.deloadBanner) return;
  if (formState.deload || !shouldSuggestDeload(session.username)) {
    el.deloadBanner.classList.add("hidden");
    el.deloadBanner.innerHTML = "";
    return;
  }
  const weeks = weeksSinceLastDeload(session.username);
  const reason = deloadReason(session.username);
  const bodyText = reason.kind === "soreness"
    ? t("deload.bodySoreness")
    : t("deload.bodyWeeks", { weeks: `<strong>${weeks}</strong>` });

  el.deloadBanner.classList.remove("hidden");
  el.deloadBanner.innerHTML = `
    <div class="deload-banner-title">${reason.title}</div>
    <div class="deload-banner-body">${bodyText}</div>
    <div class="deload-banner-actions">
      <button class="primary-btn" data-deload-action="start">${t("deload.start")}</button>
      <button class="secondary-btn" data-deload-action="dismiss">${t("deload.notYet")}</button>
    </div>
  `;
  el.deloadBanner.querySelector("[data-deload-action='start']").addEventListener("click", () => {
    formState.deload = true;
    setPrefs(session.username, { lastDeloadAt: Date.now() });
    refreshDeloadBanner();
    // Visual confirmation: brief flash on the Generate button
    el.generateBtn.style.boxShadow = "0 0 0 4px var(--accent-soft)";
    setTimeout(() => { el.generateBtn.style.boxShadow = ""; }, 1000);
  });
  el.deloadBanner.querySelector("[data-deload-action='dismiss']").addEventListener("click", () => {
    el.deloadBanner.classList.add("hidden");
  });
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    showApp(btn.dataset.view);
    // Auto-close mobile menu on selection
    el.nav.classList.remove("menu-open");
    const menuBtn = document.getElementById("navMenuBtn");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  });
});

// Hamburger toggle (mobile)
const navMenuBtn = document.getElementById("navMenuBtn");
if (navMenuBtn) {
  navMenuBtn.addEventListener("click", () => {
    const isOpen = el.nav.classList.toggle("menu-open");
    navMenuBtn.setAttribute("aria-expanded", String(isOpen));
  });
  // Tap outside menu closes it
  document.addEventListener("click", (e) => {
    if (!el.nav.classList.contains("menu-open")) return;
    if (el.nav.contains(e.target)) return;
    el.nav.classList.remove("menu-open");
    navMenuBtn.setAttribute("aria-expanded", "false");
  });
}

// ─── UNITS TOGGLE ────────────────────────────────────────────────────────
function applyUnitsButtons() {
  if (!session) return;
  const u = getPrefs(session.username).units;
  document.querySelectorAll(".units-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.units === u);
  });
}
document.querySelectorAll(".units-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!session) return;
    setPrefs(session.username, { units: btn.dataset.units });
    applyUnitsButtons();
    // Re-render the visible workout so weights convert immediately.
    if (currentWorkout && !el.workoutResult.classList.contains("hidden")) {
      renderWorkout(currentWorkout, el.workoutResult, { showSave: !workoutIsSaved });
      attachWorkoutActions();
    }
    // If the settings view is showing, re-render so units + values update.
    if (!el.settingsView.classList.contains("hidden")) renderSettings();
    // Refresh the warning banner too (weight thresholds get re-stringified).
    refreshLoadWarning();
  });
});

// ─── AUTH TABS ───────────────────────────────────────────────────────────
// Escape hatch: if cloud is configured but unreachable, let the user opt
// into offline mode. Creates a separate local account, no sync. Visible
// only when cloud is configured (otherwise local is already the default).
const offlineModeBtn = document.getElementById("offlineModeBtn");
if (offlineModeBtn) {
  if (_configReady) offlineModeBtn.classList.remove("hidden");
  offlineModeBtn.addEventListener("click", () => {
    if (!confirm("Switch to offline mode? This creates a separate local account on this device that won't sync with the cloud. Your cloud account is untouched — you can re-enable cloud sync in Settings later.")) return;
    localStorage.setItem("forge:forceLocal", "1");
    location.replace(location.pathname);
  });
}

// Self-rescue for users stuck on a cached old version (looking at you, iOS Safari).
const resetBtn = document.getElementById("resetCacheBtn");
if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    resetBtn.disabled = true;
    resetBtn.textContent = "Clearing…";
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {}
    // Add a cache-bust query so the next fetch dodges any HTTP cache too.
    location.replace(location.pathname + "?reset=" + Date.now());
  });
}

document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    authMode = tab.dataset.tab;
    el.authSubmit.textContent = authMode === "login" ? t("auth.submitLogin") : t("auth.submitSignup");
    el.password.setAttribute("autocomplete", authMode === "login" ? "current-password" : "new-password");
    el.authError.textContent = "";
    el.authError.style.color = "";
    // Hide confirmation panel if it's stuck open from a previous signup
    el.confirmPanel?.classList.add("hidden");
    el.authForm?.classList.remove("hidden");
    // Forgot password only makes sense on login + cloud mode
    const forgot = document.getElementById("forgotPasswordBtn");
    if (forgot) forgot.classList.toggle("hidden", authMode !== "login" || !HAS_SUPABASE);
  });
});

// ─── EMAIL CONFIRMATION PANEL ────────────────────────────────────────────
// Shown when signUp returns no session — meaning Supabase has email
// confirmation enabled and the user must click the email link to activate.
// The previous version was a single line on top of the existing form, which
// hid the actual call to action behind cluttered context. This is a
// dedicated panel with a clear next step and a recovery (resend) path.

let _pendingConfirmEmail = null;
let _lastResendAt = 0;

function showConfirmPanel(email) {
  _pendingConfirmEmail = email;
  if (el.confirmPanelEmail) el.confirmPanelEmail.textContent = email;
  if (el.confirmStatus) el.confirmStatus.textContent = "";
  // Hide the auth form + tabs, show the panel
  el.authForm?.classList.add("hidden");
  document.querySelector(".auth-tabs")?.classList.add("hidden");
  document.getElementById("forgotPasswordBtn")?.classList.add("hidden");
  el.confirmPanel?.classList.remove("hidden");
}

function hideConfirmPanel() {
  _pendingConfirmEmail = null;
  el.confirmPanel?.classList.add("hidden");
  el.authForm?.classList.remove("hidden");
  document.querySelector(".auth-tabs")?.classList.remove("hidden");
  // Restore forgot-password visibility based on current mode + cloud
  const forgot = document.getElementById("forgotPasswordBtn");
  if (forgot) forgot.classList.toggle("hidden", authMode !== "login" || !HAS_SUPABASE);
}

// Wire Back button — sends user back to login (NOT signup, since they
// already have an account in Supabase, just unconfirmed).
el.confirmBackBtn?.addEventListener("click", () => {
  // Switch tabs to "login" so the form is in the right mode.
  const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
  if (loginTab) loginTab.click();
  hideConfirmPanel();
});

// Wire Resend button. Supabase rate-limits resends — we add a 30s
// client-side cooldown on top to avoid mashing the button.
el.confirmResendBtn?.addEventListener("click", async () => {
  if (!_pendingConfirmEmail || !HAS_SUPABASE) return;
  const elapsed = Date.now() - _lastResendAt;
  const cooldown = 30000;
  if (_lastResendAt && elapsed < cooldown) {
    const remaining = Math.ceil((cooldown - elapsed) / 1000);
    if (el.confirmStatus) el.confirmStatus.textContent = t("confirm.cooldown", { sec: remaining });
    return;
  }
  el.confirmResendBtn.disabled = true;
  el.confirmResendBtn.textContent = t("confirm.resending");
  if (el.confirmStatus) el.confirmStatus.textContent = "";
  try {
    const redirectUrl = location.origin + location.pathname;
    // supabase-js v2: resend by type=signup
    const { error } = await sb.auth.resend({
      type: "signup",
      email: _pendingConfirmEmail,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) {
      if (el.confirmStatus) el.confirmStatus.textContent = error.message || t("confirm.resendError");
      if (el.confirmStatus) el.confirmStatus.style.color = "";
    } else {
      _lastResendAt = Date.now();
      if (el.confirmStatus) {
        el.confirmStatus.textContent = t("confirm.resent");
        el.confirmStatus.style.color = "var(--success)";
      }
    }
  } catch (e) {
    if (el.confirmStatus) el.confirmStatus.textContent = t("confirm.resendError");
  } finally {
    el.confirmResendBtn.disabled = false;
    el.confirmResendBtn.textContent = t("confirm.resend");
  }
});

el.authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.authError.textContent = "";
  const identifier = el.username.value.trim();
  const password = el.password.value;
  if (!identifier || !password) return;

  // ─── Cloud path: Supabase email/password ────────────────────────────
  if (HAS_SUPABASE) {
    el.authSubmit.disabled = true;
    el.authSubmit.textContent = authMode === "signup" ? t("auth.creating") : t("auth.loggingIn");
    try {
      let result;
      try {
        // Race against a 10s timeout so we don't sit on 'Logging in…' for the
        // full network stack timeout (~30s+) when the host is unreachable.
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 10000));
        // Critical: pass emailRedirectTo so the confirmation email points
        // back to *this* deployed path. Without it, Supabase falls back to
        // the project's default Site URL and users land on a 404.
        const redirectUrl = location.origin + location.pathname;
        const authCall = authMode === "signup"
          ? sb.auth.signUp({
              email: identifier,
              password,
              options: { emailRedirectTo: redirectUrl },
            })
          : sb.auth.signInWithPassword({ email: identifier, password });
        result = await Promise.race([authCall, timeout]);
      } catch (netErr) {
        el.authError.textContent = "Can't reach Supabase. Your network is blocking it — turn on Cloudflare WARP (free 1.1.1.1 app) or a working VPN, then try again.";
        return;
      }
      if (authMode === "signup") {
        if (result.error) {
          el.authError.textContent = result.error.message;
          return;
        }
        // If email confirmation is on, user must verify before signing in.
        // Show a dedicated "check inbox" panel instead of just a one-liner,
        // and offer a Resend button so the user has a recovery path if the
        // email gets lost.
        if (!result.data.session) {
          showConfirmPanel(identifier);
          return;
        }
      } else {
        if (result.error) {
          el.authError.textContent = result.error.message;
          return;
        }
      }
      const user = result.data.user;
      session = {
        username: user.email,
        userId: user.id,
        loggedInAt: Date.now(),
      };
      save(STORAGE_KEYS.session, session);
      // Don't block the UI on cloud fetch — navigate immediately, let sync
      // populate in the background. The sync indicator shows progress.
      syncFromCloud().catch(() => {});
      showApp("generator");
    } finally {
      el.authSubmit.disabled = false;
      el.authSubmit.textContent = authMode === "signup" ? t("auth.submitSignup") : t("auth.submitLogin");
      el.authError.style.color = "";
    }
    return;
  }

  // ─── Local path: legacy localStorage auth ───────────────────────────
  // If the identifier looks like an email AND we have no local users yet, it
  // strongly suggests the user thought they were in cloud mode. Surface that.
  if (identifier.includes("@") && Object.keys(getUsers()).length === 0 && authMode === "login") {
    el.authError.textContent = "Cloud sync isn't loaded on this device, so we can't reach your email-based account. Hard-refresh the page or try a Private window — the status pill above should turn green.";
    return;
  }

  const username = identifier.toLowerCase();
  const users = getUsers();

  if (authMode === "signup") {
    if (users[username]) {
      el.authError.textContent = "Username already taken.";
      return;
    }
    const salt = randomSalt();
    users[username] = {
      username,
      salt,
      passwordHash: hashPassword(password, salt),
      createdAt: Date.now(),
    };
    setUsers(users);
    session = { username, loggedInAt: Date.now() };
    save(STORAGE_KEYS.session, session);
    showApp("generator");
    return;
  }

  const user = users[username];
  if (!user) {
    el.authError.textContent = "No account with that username on this device. Sign up to create one, or check that the app loaded cloud mode (says 'Email' instead of 'Username').";
    return;
  }
  if (user.passwordHash !== hashPassword(password, user.salt)) {
    el.authError.textContent = "Wrong password.";
    return;
  }
  session = { username, loggedInAt: Date.now() };
  save(STORAGE_KEYS.session, session);
  showApp("generator");
});

// ─── PASSWORD RESET (cloud mode only) ────────────────────────────────────
const forgotBtn = document.getElementById("forgotPasswordBtn");
if (forgotBtn) {
  forgotBtn.addEventListener("click", async () => {
    if (!HAS_SUPABASE) return;
    const email = el.username.value.trim();
    if (!email) {
      el.authError.textContent = "Enter your email above first, then click Forgot password.";
      return;
    }
    forgotBtn.disabled = true;
    forgotBtn.textContent = "Sending…";
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname,
      });
      if (error) {
        el.authError.textContent = error.message;
        el.authError.style.color = "";
      } else {
        el.authError.textContent = `Reset link sent to ${email}. Check your inbox (and spam folder).`;
        el.authError.style.color = "var(--success)";
      }
    } catch (e) {
      el.authError.textContent = "Network error — try again.";
    } finally {
      forgotBtn.disabled = false;
      forgotBtn.textContent = "Forgot password?";
    }
  });
}

// Handle the password-update form (shown after Supabase redirects with a
// recovery hash). Renamed from `resetForm` to avoid colliding with the
// earlier `resetForm()` function that clears the generator chips.
const resetPasswordForm = document.getElementById("resetForm");
if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!HAS_SUPABASE) return;
    const resetError = document.getElementById("resetError");
    const newPw = document.getElementById("resetPassword").value;
    if (!newPw || newPw.length < 6) {
      resetError.textContent = "Password must be at least 6 characters.";
      return;
    }
    const submitBtn = resetPasswordForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Updating…";
    try {
      const { error } = await sb.auth.updateUser({ password: newPw });
      if (error) {
        resetError.textContent = error.message;
        return;
      }
      const { data } = await sb.auth.getSession();
      if (data?.session) {
        const user = data.session.user;
        session = {
          username: user.email,
          userId: user.id,
          loggedInAt: Date.now(),
        };
        save(STORAGE_KEYS.session, session);
        history.replaceState(null, "", location.pathname);
        await syncFromCloud();
        showApp("generator");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update password";
    }
  });
}

// Pull all data for the current user from Supabase into localStorage. Runs
// the four table queries in parallel + races against an 8s overall timeout
// so a hanging network never blocks the UI for long.
async function syncFromCloud() {
  if (!sb || !session?.userId) return;
  const uid = session.userId;
  const username = session.username;

  const withTimeout = (p, ms = 8000) =>
    Promise.race([p, new Promise((_, reject) =>
      setTimeout(() => reject(new Error("sync-timeout")), ms))]);

  try {
    setSyncStatus("syncing");
    const [wsRes, statsRes, pfRes, ldRes] = await withTimeout(Promise.all([
      sb.from("workouts").select("data, created_at").eq("user_id", uid).order("created_at", { ascending: false }),
      sb.from("exercise_stats").select("exercise_name, weight_kg, reps, date, history").eq("user_id", uid),
      sb.from("user_prefs").select("units").eq("user_id", uid).maybeSingle(),
      sb.from("user_loads").select("max_dumbbell_kg, max_kettlebell_kg, has_heavy_barbell").eq("user_id", uid).maybeSingle(),
    ]));

    if (wsRes?.data) {
      const all = load(STORAGE_KEYS.workouts, {});
      all[username] = wsRes.data.map(r => r.data);
      save(STORAGE_KEYS.workouts, all);
    }
    if (statsRes?.data) {
      const all = load(STORAGE_KEYS.stats, {});
      all[username] = {};
      for (const row of statsRes.data) {
        all[username][row.exercise_name] = {
          weightKg: Number(row.weight_kg) || 0,
          reps: Number(row.reps) || 0,
          date: new Date(row.date).getTime(),
          history: row.history || [],
        };
      }
      save(STORAGE_KEYS.stats, all);
    }
    if (pfRes?.data) {
      const all = load(STORAGE_KEYS.prefs, {});
      all[username] = { units: pfRes.data.units || "kg" };
      save(STORAGE_KEYS.prefs, all);
    }
    if (ldRes?.data) {
      const all = load(STORAGE_KEYS.loads, {});
      all[username] = {
        maxDumbbellKg: Number(ldRes.data.max_dumbbell_kg) || 0,
        maxKettlebellKg: Number(ldRes.data.max_kettlebell_kg) || 0,
        hasHeavyBarbell: !!ldRes.data.has_heavy_barbell,
      };
      save(STORAGE_KEYS.loads, all);
    }
    setSyncStatus("ok");
  } catch {
    setSyncStatus("error");
  }
}

el.logoutBtn.addEventListener("click", async () => {
  if (HAS_SUPABASE) {
    try { await sb.auth.signOut(); } catch {}
  }
  session = null;
  localStorage.removeItem(STORAGE_KEYS.session);
  el.username.value = "";
  el.password.value = "";
  el.workoutResult.classList.add("hidden");
  el.workoutResult.innerHTML = "";
  // Clean up any active in-app state (guided wake-lock, rest timer, etc.)
  // so the user actually sees the auth screen instead of stale chrome.
  try { stopRestTimer?.(true); } catch {}
  try { releaseWakeLock?.(); } catch {}
  if (typeof guided === "object" && guided) guided.active = false;
  currentWorkout = null;
  _sleepModalShownThisSession = false; // re-fire for next user on this device
  resetForm();
  showAuth();
});

// ─── CHIP SELECTION ──────────────────────────────────────────────────────
const formState = { goal: null, equipment: [], target: null, duration: null, difficulty: null, style: "standard", deload: false };

// ─── DELOAD DETECTION ────────────────────────────────────────────────────
// Counts ISO weeks containing a saved workout, since the last marked deload.
function weeksSinceLastDeload(userId) {
  if (!userId) return 0;
  const prefs = getPrefs(userId);
  const lastDeload = prefs.lastDeloadAt || 0;
  const workouts = getWorkouts(userId);
  if (!workouts.length) return 0;
  const recent = workouts.filter(w => w.createdAt > lastDeload);
  if (!recent.length) return 0;
  const weekBuckets = new Set();
  recent.forEach(w => {
    const d = new Date(w.createdAt);
    // Snap to Monday 00:00 — defines the week.
    const monday = new Date(d);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    weekBuckets.add(monday.getTime());
  });
  return weekBuckets.size;
}

// Auto-trigger: if 3+ muscles are still at level ≥ 2 after decay, that's
// cumulative fatigue — recommend a deload regardless of week count.
function hasHighAccumulatedSoreness(userId) {
  const all = load(STORAGE_KEYS.soreness, {});
  const us = all[userId] || {};
  let high = 0;
  for (const muscle of Object.keys(us)) {
    if (getCurrentSoreness(userId, muscle) >= 2.0) high++;
  }
  return high >= 3;
}

function shouldSuggestDeload(userId) {
  return weeksSinceLastDeload(userId) >= 4 || hasHighAccumulatedSoreness(userId);
}

function deloadReason(userId) {
  if (hasHighAccumulatedSoreness(userId)) {
    return { kind: "soreness", title: t("deload.titleSoreness") };
  }
  return { kind: "weeks", title: t("deload.titleWeeks") };
}

document.querySelectorAll(".chip-row").forEach(row => {
  const field = row.dataset.field;
  const multi = row.dataset.multi === "true";
  row.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      const value = chip.dataset.value;
      if (multi) {
        const arr = formState[field];
        const idx = arr.indexOf(value);
        if (idx === -1) arr.push(value);
        else arr.splice(idx, 1);
        chip.classList.toggle("selected");
      } else {
        row.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        formState[field] = value;
      }
      el.formError.textContent = "";
      refreshLoadWarning();
      refreshRecommendationBanner();
      refreshRecoveryBanner();
      refreshLevelBanner();
    });
  });
});

function resetForm() {
  formState.goal = null;
  formState.equipment = [];
  formState.target = null;
  formState.duration = null;
  formState.difficulty = null;
  formState.style = "standard";
  document.querySelectorAll(".chip.selected").forEach(c => c.classList.remove("selected"));
  const standardChip = document.querySelector('.chip[data-value="standard"]');
  if (standardChip) standardChip.classList.add("selected");
  refreshLoadWarning();
}

// ─── LOAD WARNING ────────────────────────────────────────────────────────
function refreshLoadWarning() {
  if (!session || !el.loadWarning) return;
  const { goal, equipment, difficulty, style } = formState;
  if (!goal || !equipment.length || !difficulty) {
    el.loadWarning.classList.add("hidden");
    el.loadWarning.innerHTML = "";
    return;
  }
  const loads = getLoads(session.username);
  const issue = checkLoadAdequacy({ goal, equipment, difficulty, style }, loads);
  if (!issue) {
    el.loadWarning.classList.add("hidden");
    el.loadWarning.innerHTML = "";
    return;
  }
  el.loadWarning.classList.remove("hidden");
  el.loadWarning.innerHTML = `
    <div class="load-warning-title">${t("warn.loadTitle", { diff: t(`diff.${difficulty}`) })}</div>
    <div class="load-warning-body">${issue.reason} ${issue.recommendation} <strong>${t("warn.intensityHint")}</strong></div>
    <div class="load-warning-actions">
      <button class="primary-btn" data-warn-action="switch-goal" data-goal="${issue.suggestedGoal}">${t("warn.switchTo", { goal: GOAL_LABELS[issue.suggestedGoal] })}</button>
      <button class="secondary-btn" data-warn-action="use-intensity">${t("warn.useIntensity")}</button>
      <button class="secondary-btn" data-warn-action="open-settings">${t("warn.openSettings")}</button>
    </div>
  `;
  el.loadWarning.querySelector("[data-warn-action='switch-goal']").addEventListener("click", (e) => {
    const newGoal = e.target.dataset.goal;
    const chip = document.querySelector(`.chip[data-value="${newGoal}"]`);
    if (chip) chip.click();
  });
  el.loadWarning.querySelector("[data-warn-action='use-intensity']").addEventListener("click", () => {
    const chip = document.querySelector('.chip[data-value="intensity"]');
    if (chip) chip.click();
  });
  el.loadWarning.querySelector("[data-warn-action='open-settings']").addEventListener("click", () => {
    showApp("settings");
  });
}

// ─── WORKOUT GENERATION ──────────────────────────────────────────────────
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Round rest periods to clean numbers: nearest 5s when short, nearest 15s otherwise.
function roundRest(s) {
  if (s <= 45) return Math.round(s / 5) * 5;
  return Math.round(s / 15) * 15;
}

// Pick an intensity technique appropriate to the movement pattern.
// Returns null when techniques don't apply (ballistic, mobility, conditioning).
function getIntensityTechnique(exercise) {
  if (!exercise) return null;
  if (exercise.pattern === "ballistic" ||
      exercise.pattern === "mobility" ||
      exercise.pattern === "conditioning") {
    return null;
  }

  const name = exercise.name;
  const isSquatHinge = /squat|deadlift|rdl|romanian|lunge|step-up|hip thrust|glute bridge|wall sit|cossack/i.test(name);
  const isPress = /press|push-up|push up|bench|dip|push press|fly/i.test(name);
  const isPull = /row|pull|chin|curl|pulldown|face pull/i.test(name);

  if (isSquatHinge) {
    return { name: "Tempo 3-1-1", note: "3-sec descent, 1-sec pause at bottom, 1-sec drive up" };
  }
  if (isPress) {
    return { name: "Pause 2s at bottom", note: "Lower under control, hold 2 sec, then press explosively" };
  }
  if (isPull) {
    return { name: "Tempo 3-0-1", note: "3-sec lowering phase, no pause, 1-sec pull" };
  }
  if (exercise.pattern === "isolation") {
    return { name: "Tempo 2-1-2", note: "Slow eccentric, 1-sec squeeze, controlled return" };
  }
  return { name: "Tempo 3-1-1", note: "Slow eccentric for max time-under-tension" };
}

// Optional "finisher" — an extra-intensity technique applied to the FINAL
// working set of a fraction of exercises when Intensity Mode is on. Picks
// the appropriate finisher per movement pattern.
const INTENSITY_FINISHERS = {
  squatHinge: { name: "Drop set on final", note: "After last working set, drop weight 20% and continue to failure" },
  press:      { name: "AMRAP final set",   note: "Final set: as many reps as possible — stop when form breaks" },
  pull:       { name: "Cluster final set", note: "Final set: 3 reps, rest 15s, 3 reps, rest 15s, 3 reps" },
  isolation:  { name: "1.5 reps final",    note: "Final set: each rep = full ROM + bottom half-rep, counts as one" },
};

function getIntensityFinisher(exercise) {
  if (!exercise || exercise.pattern === "ballistic" ||
      exercise.pattern === "mobility" ||
      exercise.pattern === "conditioning") return null;
  // Only apply to ~50% of eligible exercises so the workout stays varied
  // rather than every exercise getting a finisher.
  if (Math.random() < 0.5) return null;

  const name = exercise.name;
  if (/squat|deadlift|rdl|romanian|lunge|step-up|hip thrust|glute bridge|cossack/i.test(name)) {
    return INTENSITY_FINISHERS.squatHinge;
  }
  if (/press|push-up|push up|bench|dip|fly/i.test(name)) {
    return INTENSITY_FINISHERS.press;
  }
  if (/row|pull|chin|pulldown|face pull/i.test(name)) {
    return INTENSITY_FINISHERS.pull;
  }
  return INTENSITY_FINISHERS.isolation;
}

// Detect whether an exercise is performed unilaterally (one side at a time)
// vs bilaterally (both sides simultaneously). Reps for unilateral exercises
// are "per side" and they take ~2x the time per set.
function isUnilateralExercise(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  // Explicit one-side names
  if (/single-?arm|single-?leg|one-?arm|one-?leg/.test(n)) return true;
  // Lunges, split squats, step-ups, pistol/shrimp squats = per leg
  if (/\blunges?\b|split squat|step-?up|pistol squat|shrimp squat/.test(n)) return true;
  // Get-ups + windmills are inherently one-side
  if (/get-?up|windmill/.test(n)) return true;
  // Specific kettlebell movements that are unilateral by tradition:
  // pressing variants, snatches, cleans, single-bell rows, carries
  if (/kettlebell\s+(arnold|overhead|floor|bottoms-?up|z-?press|see-saw)/.test(n)) return true;
  if (/kettlebell\s+(snatch|clean|high pull|gorilla row|renegade row|cuban)/.test(n)) return true;
  if (/kettlebell\s+(suitcase|racked carry|overhead carry)/.test(n)) return true;
  // Renegade row (bodyweight or DB) is alternating arms, counted per side
  if (/renegade row/.test(n)) return true;
  return false;
}

// "X reps" → "X reps per side" when unilateral. Time-based reps get
// "per side" too. For ballistic ranges keep the per-side suffix.
function displayReps(ex) {
  let reps = ex.reps;
  // Localize time units for display. The stored value stays English so the
  // parser (parseTimeReps) keeps working regardless of UI language.
  if (typeof reps === "string") {
    const secWord = t("time.sec");
    const minWord = t("time.min");
    if (secWord !== "sec") reps = reps.replace(/\bsec\b/g, secWord);
    if (minWord !== "min") reps = reps.replace(/\bmin\b/g, minWord);
  }
  if (!ex.unilateral) return reps;
  // Don't double up if 'per side' is already in the string somehow
  if (/per side|each side|each arm|each leg|на сторону|на руку|на ногу/i.test(reps)) return reps;
  return `${reps} ${t("wo.perSide")}`;
}

// Cap sets based on requested workout duration so short sessions don't
// inherit 5-set ballistic prescriptions that take 10+ minutes each.
function maxSetsForDuration(duration) {
  if (!duration) return 5;
  if (duration <= 15) return 3;
  if (duration <= 30) return 4;
  if (duration <= 45) return 4;
  return 5;
}

function pickPrescription(goal, difficulty, exercise, style = "standard", deload = false, duration = 45) {
  // Mobility exercises always use the mobility prescription regardless of
  // the workout's main goal — they're brief warm-ups, not the main work.
  const effectiveGoal = exercise.pattern === "mobility" ? "mobility" : goal;
  const p = PRESCRIPTIONS[effectiveGoal] || PRESCRIPTIONS.hypertrophy;
  let sets = randInt(p.sets[0], p.sets[1]);
  let rest = p.rest;
  // Recovery goal disables intensity techniques (whole point is to be easy).
  const intensity = goal !== "recovery" && style === "intensity";

  // Ballistic / explosive movements (KB swings, jumps, plyos) follow their own
  // template: moderate reps with explosive intent, generous rest for power
  // output. The strength rep scheme of "3-4 reps" is wrong here — swings are
  // about hip drive, not 1RM strength.
  if (exercise.pattern === "ballistic") {
    sets = difficulty === "beginner" ? 3 : difficulty === "advanced" ? 5 : 4;
    // Cap by duration so short workouts don't blow past the time budget.
    sets = Math.min(sets, maxSetsForDuration(duration));
    let reps;
    if (goal === "endurance") reps = "20–30";
    else if (goal === "fat_loss") reps = "15–25";
    else if (goal === "strength") reps = "5–8";
    else reps = "10–15";
    // Short sessions get tighter rest too (60s vs 90s).
    const ballisticRest = duration && duration <= 20 ? 60 : 90;
    return { sets, reps, rest: roundRest(ballisticRest) };
  }

  // Difficulty scales volume + rest.
  if (difficulty === "beginner") {
    sets = Math.max(2, sets - 1);
    rest = rest * 1.2;
  } else if (difficulty === "advanced") {
    sets = sets + 1;
    rest = Math.max(20, rest * 0.85);
  }

  const isIso = exercise.pattern === "isolation";
  let repsRange = isIso ? p.isoReps : p.reps;

  if (difficulty === "advanced" && !isIso) {
    if (goal === "strength") repsRange = [Math.max(3, repsRange[0] - 1), repsRange[0]];
    if (goal === "hypertrophy") repsRange = [repsRange[0], repsRange[1] + 3];
  }

  let reps = `${repsRange[0]}–${repsRange[1]}`;
  if (exercise.pattern === "mobility") reps = "30–60 sec";
  if (exercise.pattern === "conditioning" && goal !== "strength") {
    const time = difficulty === "advanced" ? "40–60 sec" : difficulty === "beginner" ? "20–30 sec" : "30–45 sec";
    reps = time;
  }

  // Intensity techniques: each rep is much harder due to tempo/pause, so reduce
  // reps and extend rest. Only applies to compound/isolation lifts (ballistic
  // / mobility / conditioning already returned above).
  let technique = null;
  let finisher = null;
  if (intensity && (exercise.pattern === "compound" || exercise.pattern === "isolation")) {
    technique = getIntensityTechnique(exercise);
    finisher = getIntensityFinisher(exercise);
    if (technique) {
      // Pull reps down and rest up to reflect the longer time-under-tension.
      if (goal === "strength") {
        // Strength at light load: 4-5 × 5-8 reps becomes the sweet spot
        const lo = isIso ? 6 : 5;
        const hi = isIso ? 8 : 8;
        reps = `${lo}–${hi}`;
        rest = isIso ? 75 : 120;
      } else if (goal === "hypertrophy") {
        // Hypertrophy: keep middle of range, longer rest for slow reps
        const lo = isIso ? 8 : 6;
        const hi = isIso ? 10 : 8;
        reps = `${lo}–${hi}`;
        rest = isIso ? 75 : 90;
      } else if (goal === "fat_loss" || goal === "endurance") {
        // Higher rep goals: trim top end so the slow reps stay feasible
        const lo = isIso ? 10 : 8;
        const hi = isIso ? 12 : 10;
        reps = `${lo}–${hi}`;
        rest = 60;
      }
      // Sets: keep similar to non-intensity, advanced gets one more.
      // (Sets were already adjusted by difficulty above.)
    }
  }

  // Deload week: cut sets by ~30%, give 10% more rest. Volume drops without
  // changing the rep ranges so the movements still feel familiar.
  if (deload && exercise.pattern !== "mobility") {
    sets = Math.max(2, Math.round(sets * 0.7));
    rest = roundRest(rest * 1.1);
    finisher = null;
  }

  // Final guard: cap sets by requested duration so the time budget holds.
  sets = Math.min(sets, maxSetsForDuration(duration));

  return { sets, reps, rest: roundRest(rest), technique, finisher };
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function matchesTarget(exercise, target) {
  if (target === "full_body") return true;
  if (target === "cardio") return exercise.group.includes("cardio");
  if (target === "core") return exercise.group.includes("core");
  if (target === "upper") return exercise.group.includes("upper");
  if (target === "lower") return exercise.group.includes("lower") || exercise.group.includes("legs");
  if (target === "push") return exercise.group.includes("push");
  if (target === "pull") return exercise.group.includes("pull");
  if (target === "legs") return exercise.group.includes("legs") || exercise.group.includes("lower");
  return true;
}

function matchesDifficulty(exDiff, target) {
  // Beginners get beginner only.
  // Intermediate gets beginner + intermediate.
  // Advanced gets all three.
  const order = { beginner: 0, intermediate: 1, advanced: 2 };
  return order[exDiff] <= order[target];
}

// Cardio target produces one (or two) steady-state blocks rather than picking
// six different cardio "exercises". Warm-up still prepended.
function generateCardioWorkout({ goal, equipment, duration, difficulty }) {
  const warmupCount = duration >= 30 ? 2 : 1;
  const warmupMin = warmupCount * 2;
  const cardioMin = Math.max(duration - warmupMin, 8);
  const numBlocks = cardioMin >= 40 ? 2 : 1;
  const perBlockMin = Math.floor(cardioMin / numBlocks);

  const warmups = pickWarmupExercises("cardio", warmupCount);
  const warmupExercises = warmups.map(ex => ({
    name: ex.name,
    muscle: ex.muscle,
    pattern: ex.pattern,
    unilateral: isUnilateralExercise(ex.name),
    ...pickPrescription(goal, difficulty, ex, "standard", false, duration),
  }));

  const cardioCandidates = EXERCISES.filter(e =>
    e.group.includes("cardio") &&
    e.pattern === "conditioning" &&
    e.equipment.some(eq => equipment.includes(eq))
  );

  const cardioExercises = [];
  if (cardioCandidates.length === 0) {
    return null;
  }
  const shuffled = shuffle(cardioCandidates);
  const styleByGoal = {
    fat_loss:  "intervals (1 min hard / 1 min easy)",
    endurance: "steady state",
    strength:  "tempo intervals (30s push / 30s recovery)",
    hypertrophy: "moderate steady state",
    mobility:  "light steady state",
  };
  const styleLabel = styleByGoal[goal] || "steady state";

  for (let i = 0; i < numBlocks && i < shuffled.length; i++) {
    const ex = shuffled[i];
    cardioExercises.push({
      name: ex.name,
      muscle: ex.muscle,
      pattern: ex.pattern,
      sets: 1,
      reps: `${perBlockMin} min ${styleLabel}`,
      rest: numBlocks > 1 && i < numBlocks - 1 ? 60 : 0,
      isTimeBlock: true,
    });
  }

  return {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    inputs: { goal, equipment, target: "cardio", duration, difficulty, style: "standard", deload: false },
    exercises: [...warmupExercises, ...cardioExercises],
  };
}

// Anti-repeat memory: exercises picked in the immediately previous workout
// get penalized so Regenerate produces visibly different sessions.
let lastPickedNames = new Set();

const DIFF_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

// Which muscles a chosen target touches — used to bias warm-up selection
// toward joints / tissues you're actually about to work.
const TARGET_MUSCLES = {
  legs:      ["quads", "glutes", "hamstrings", "calves"],
  lower:     ["quads", "glutes", "hamstrings", "calves"],
  upper:     ["chest", "back", "shoulders", "biceps", "triceps"],
  push:      ["chest", "shoulders", "triceps"],
  pull:      ["back", "biceps", "shoulders"],
  core:      ["core"],
  full_body: ["chest", "back", "shoulders", "quads", "glutes", "hamstrings", "core"],
  cardio:    ["full_body", "quads", "calves"],
};

// Pair main-work exercises into supersets (size 2) or circuits (size 3).
// Annotates exercises in-place with groupId / groupPosition / groupSize and
// normalises sets + rest within a group so the round structure works.
function pairIntoGroups(exercises, size) {
  if (size < 2) return;
  const mainIndices = exercises
    .map((e, i) => (e.pattern === "compound" || e.pattern === "isolation") ? i : -1)
    .filter(i => i !== -1);

  let groupIdx = 0;
  for (let i = 0; i + size <= mainIndices.length; i += size) {
    const indices = mainIndices.slice(i, i + size);
    const group = indices.map(j => exercises[j]);
    const gid = `g${++groupIdx}`;
    const masterSets = group[0].sets;
    const masterRest = Math.max(group[0].rest, size === 3 ? 60 : 75);
    group.forEach((e, p) => {
      e.groupId = gid;
      e.groupPosition = p;
      e.groupSize = size;
      e.sets = masterSets;
      e.rest = masterRest;
    });
  }
}

// Pick N mobility/dynamic exercises biased to the target muscle group(s).
// Warm-ups are always bodyweight so they work regardless of equipment.
function pickWarmupExercises(target, count) {
  if (count <= 0) return [];
  const targetMuscles = TARGET_MUSCLES[target] || [];
  const candidates = EXERCISES.filter(ex =>
    ex.pattern === "mobility" && ex.equipment.includes("bodyweight")
  );
  if (candidates.length === 0) return [];
  const scored = candidates.map(ex => ({
    ex,
    score:
      (ex.muscle.some(m => targetMuscles.includes(m)) ? 5 : 0) +
      (ex.muscle.includes("full_body") ? 2 : 0) +
      (lastPickedNames.has(ex.name) ? -3 : 0) +
      Math.random() * 2,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.ex);
}

function generateWorkout({ goal, equipment, target, duration, difficulty, style = "standard", deload = false }) {
  // Cardio target gets a special handler: warm-up + one steady-state block
  // (or two for long durations) instead of 6 separate cardio "exercises".
  if (target === "cardio") {
    return generateCardioWorkout({ goal, equipment, duration, difficulty });
  }

  const count = COUNT_BY_DURATION[duration] || 6;
  const targetDiff = DIFF_ORDER[difficulty];

  // Always prepend a brief dynamic warm-up unless the goal IS mobility
  // (in which case the whole workout is mobility-focused already).
  const warmupCount = goal === "mobility" ? 0 : (duration >= 30 ? 2 : 1);
  const mainCount = Math.max(1, count - warmupCount);
  const warmups = pickWarmupExercises(target, warmupCount);
  const warmupNames = new Set(warmups.map(w => w.name));

  // Filter by equipment + difficulty cap + target. Exclude warm-up picks
  // so the main pool can't double-pick a mobility move we already added.
  const candidates = EXERCISES.filter(ex => {
    if (warmupNames.has(ex.name)) return false;
    const equipOk = ex.equipment.some(e => equipment.includes(e));
    const diffOk = matchesDifficulty(ex.difficulty, difficulty);
    const targetOk = matchesTarget(ex, target);
    return equipOk && diffOk && targetOk;
  });

  // Score each candidate. Higher = preferred.
  const scored = candidates.map(ex => {
    let score = 0;
    const exDiff = DIFF_ORDER[ex.difficulty];

    // Strong bias toward exercises matching the chosen difficulty.
    const diffGap = targetDiff - exDiff;       // 0 = exact, 1 = one below, 2 = two below
    if (diffGap === 0) score += 12;
    else if (diffGap === 1) score += 5;
    else if (diffGap === 2) score += 1;

    // Goal-pattern bias
    if ((goal === "strength" || goal === "hypertrophy") && ex.pattern === "compound") score += 6;
    if ((goal === "strength" || goal === "hypertrophy") && ex.pattern === "isolation") score += 2;
    if ((goal === "strength" || goal === "hypertrophy") && ex.pattern === "ballistic") score += 3;
    if ((goal === "fat_loss" || goal === "endurance") &&
        (ex.pattern === "compound" || ex.pattern === "conditioning" || ex.pattern === "ballistic")) score += 6;
    if (goal === "mobility" && ex.pattern === "mobility") score += 10;
    // Recovery: prefer compounds + isolations for blood flow; skip ballistic
    // entirely (too intense) and avoid conditioning (raises HR too much).
    if (goal === "recovery") {
      if (ex.pattern === "ballistic" || ex.pattern === "conditioning") score -= 100; // effectively excluded
      if (ex.pattern === "compound" || ex.pattern === "isolation") score += 5;
    }

    // Anti-repeat penalty for exercises from the previous workout.
    if (lastPickedNames.has(ex.name)) score -= 9;

    // Soreness penalty — sum decayed soreness across this exercise's muscles
    // and subtract. Highly-sore primary muscles strongly deprioritize their
    // exercises so the user doesn't pound them again before recovery.
    if (session?.username) {
      const sore = ex.muscle.reduce((s, m) => s + getCurrentSoreness(session.username, m), 0);
      score -= sore * 6;
    }

    // Random jitter so equal-scored items shuffle naturally on each regen.
    score += Math.random() * 4;

    return { ex, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // De-dup by primary muscle so we don't get an all-chest workout.
  const maxPerMuscle = duration >= 60 ? 3 : 2;
  const muscleCount = {};
  const picked = [];

  for (const { ex } of scored) {
    if (picked.length >= mainCount) break;
    const primary = ex.muscle[0];
    muscleCount[primary] = muscleCount[primary] || 0;
    if (muscleCount[primary] >= maxPerMuscle) continue;
    picked.push(ex);
    muscleCount[primary]++;
  }

  // Fill from leftovers if muscle cap left us short.
  if (picked.length < mainCount) {
    for (const { ex } of scored) {
      if (picked.length >= mainCount) break;
      if (!picked.includes(ex)) picked.push(ex);
    }
  }

  // Merge warm-ups in front of the main work.
  picked.unshift(...warmups);

  // Re-order: warm-up → power → main → accessories → finisher.
  // Ballistic (explosive) work goes early when the nervous system is fresh.
  const orderKey = (e) => {
    if (e.pattern === "mobility") return 0;
    if (e.pattern === "ballistic") return 1;
    if (e.pattern === "compound") return 2;
    if (e.pattern === "isolation") return 3;
    return 4;
  };
  picked.sort((a, b) => orderKey(a) - orderKey(b));

  // Update anti-repeat memory with this workout's exercises.
  lastPickedNames = new Set(picked.map(e => e.name));

  const exercises = picked.map(ex => ({
    name: ex.name,
    muscle: ex.muscle,
    pattern: ex.pattern,
    unilateral: isUnilateralExercise(ex.name),
    ...pickPrescription(goal, difficulty, ex, style, deload, duration),
  }));

  // Group into supersets/circuits if the style calls for it.
  if (style === "supersets") pairIntoGroups(exercises, 2);
  if (style === "circuits") pairIntoGroups(exercises, 3);

  // Time-budget guard: estimate total session time and trim sets if we're
  // still over by more than 15%. The set-cap above handles most cases but
  // ballistic + isolation combos can still overflow.
  enforceTimeBudget(exercises, duration);

  return {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    inputs: { goal, equipment, target, duration, difficulty, style, deload },
    exercises,
  };
}

// Approximate seconds for one exercise in the workout, including rest
// between sets. We assume the last set doesn't need its rest, so total =
// sets × work + (sets - 1) × rest.
function estimateExerciseSeconds(ex) {
  const sets = ex.sets || 1;
  const rest = ex.rest || 0;
  let workPerSet;
  const timeSec = parseTimeReps(ex.reps);
  if (timeSec) {
    workPerSet = timeSec;
  } else {
    const [lo, hi] = parseRepRange(ex.reps);
    const midReps = (lo + hi) / 2 || 10;
    const secPerRep =
      ex.pattern === "ballistic" ? 1.5 :
      ex.pattern === "isolation" ? 2.5 :
      ex.pattern === "compound"  ? 3   :
      ex.pattern === "mobility"  ? 0   : 2;
    workPerSet = midReps * secPerRep;
  }
  // Unilateral exercises take ~2x the work time per set (do one side, then the other).
  if (ex.unilateral) workPerSet *= 2;
  return sets * workPerSet + Math.max(0, sets - 1) * rest;
}

function estimateWorkoutSeconds(exercises) {
  const work = exercises.reduce((s, ex) => s + estimateExerciseSeconds(ex), 0);
  // Transition between exercises (setup, water, weight changes) ~30s each.
  const transitions = Math.max(0, exercises.length - 1) * 30;
  return work + transitions;
}

// Trim sets on the highest-volume exercises until total fits the duration
// (within 15% over). Skips warm-up moves and exercises already at 2 sets.
function enforceTimeBudget(exercises, durationMin) {
  if (!durationMin) return;
  const budgetSec = durationMin * 60;
  const ceiling = budgetSec * 1.15;
  let attempts = 0;
  while (estimateWorkoutSeconds(exercises) > ceiling && attempts < 30) {
    attempts++;
    // Find the heaviest exercise (most time) that still has room to trim.
    let worstIdx = -1, worstSec = 0;
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      if (ex.pattern === "mobility") continue;
      if ((ex.sets || 1) <= 2) continue;
      const sec = estimateExerciseSeconds(ex);
      if (sec > worstSec) { worstSec = sec; worstIdx = i; }
    }
    if (worstIdx === -1) break;
    exercises[worstIdx].sets -= 1;
  }
}

// ─── RENDERING ───────────────────────────────────────────────────────────
// Labels now come from the i18n dictionary; these are Proxies so that
// `LABEL[key]` syntax keeps working in existing call sites while always
// returning the currently-active language. Falls back to the key (humanized)
// when the translation is missing.
const _humanize = (k) => String(k).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const _labelProxy = (prefix) => new Proxy({}, {
  get(_, key) {
    if (typeof key !== "string") return undefined;
    const fromDict = window.t ? window.t(`${prefix}.${key}`) : null;
    // window.t returns the key itself when missing; detect & humanize.
    if (!fromDict || fromDict === `${prefix}.${key}`) return _humanize(key);
    return fromDict;
  },
});

const GOAL_LABELS = _labelProxy("goal");
const TARGET_LABELS = _labelProxy("target");
const EQUIP_LABELS = _labelProxy("eq");
const MUSCLE_LABELS = _labelProxy("muscle");

function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderExerciseLog(ex, units) {
  if (!session) return "";
  if (workoutReadOnly) return "";
  if (!isTrackable(ex.name)) return "";

  const usesWeight = exerciseUsesWeight(ex.name);
  const workoutGoal = currentWorkout?.inputs?.goal;
  const suggestion = getSuggestion(session.username, ex.name, ex, ex.pattern, workoutGoal);
  const last = suggestion.last;
  const next = suggestion.next;
  // recentlyLogged now holds an array of sets per exercise (per-set logging),
  // not a single set. Falls back gracefully for older entries.
  const justLogged = recentlyLogged[ex.name];

  // Last-session pill — summarises all sets if available
  let pill = "";
  if (last) {
    let summary;
    const allSets = last.allSets || [];
    const hasSideData = allSets.some(s => s.side);
    if (hasSideData) {
      // Unilateral: show R/L breakdown (best of each)
      const rSets = allSets.filter(s => s.side === "R");
      const lSets = allSets.filter(s => s.side === "L");
      const wt = last.weightKg ? `${toDisplay(last.weightKg, units)} ${units}` : "bw";
      const rBest = rSets.length ? Math.max(...rSets.map(s => s.reps)) : "—";
      const lBest = lSets.length ? Math.max(...lSets.map(s => s.reps)) : "—";
      summary = `${wt} · R ${rBest} · L ${lBest}`;
    } else if (allSets.length > 1) {
      const bestSet = allSets.reduce((b, s) =>
        calculateE1RM(s.weightKg, s.reps) > calculateE1RM(b.weightKg, b.reps) ? s : b, allSets[0]);
      const bestStr = bestSet.weightKg > 0
        ? `${toDisplay(bestSet.weightKg, units)} ${units} × ${bestSet.reps}`
        : `${bestSet.reps} reps`;
      summary = `${allSets.length} sets · best ${bestStr}`;
    } else {
      const w = last.weightKg ? `${toDisplay(last.weightKg, units)} ${units}` : "bw";
      summary = usesWeight ? `${w} × ${last.reps}` : `${last.reps} reps`;
    }
    const trendArrow =
      suggestion.trend === "up" ? "↑" :
      suggestion.trend === "down" ? "↓" :
      suggestion.trend === "recovery" ? "↻" : "·";
    const trendClass =
      suggestion.trend === "up" ? "up" :
      suggestion.trend === "down" ? "down" :
      suggestion.trend === "recovery" ? "down" : "";
    const trendLabel =
      suggestion.trend === "up" ? t("wo.progress") :
      suggestion.trend === "down" ? t("wo.deload") :
      suggestion.trend === "recovery" ? t("wo.recoveryLight") :
      t("wo.pushReps");
    const noteHtml = suggestion.note
      ? `<span class="progress-note">${suggestion.note}</span>` : "";
    pill = `<span class="last-pill">${summary}</span>
            <span class="progress-hint ${trendClass}">${trendArrow} ${trendLabel}</span>
            ${noteHtml}`;
  }

  // Build set rows. For unilateral exercises, render two rows per set
  // (one for each side) so the user can track R/L independently.
  const totalSets = ex.sets || 1;
  const stepW = units === "lb" ? 5 : 2.5;
  const defaultRep = next ? next.reps : parseRepRange(ex.reps)[0];
  const defaultWeight = next ? toDisplay(next.weightKg, units) : "";
  const isUni = !!ex.unilateral;
  const sidesPerSet = isUni ? ["R", "L"] : [null];

  const rows = [];
  let entryIdx = 0;
  for (let setN = 1; setN <= totalSets; setN++) {
    for (const side of sidesPerSet) {
      const restored = justLogged?.sets?.[entryIdx];
      const w = restored ? toDisplay(restored.weightKg, units)
              : (entryIdx === 0 ? defaultWeight : "");
      const r = restored ? restored.reps
              : (entryIdx === 0 ? defaultRep : "");
      const restoredRir = restored?.rir;
      const label = side ? `Set ${setN} <span class="side-tag side-${side.toLowerCase()}">${side}</span>` : `Set ${setN}`;
      // RIR (Reps In Reserve) — only meaningful on the LAST set of each side,
      // since prior sets are usually held in reserve. Show it on every row
      // anyway but make it cleanly optional (defaults to —).
      const rirHtml = `
        <div class="rir-picker" data-log-set="rir-group" title="Reps In Reserve — how many reps did you have left? (0 = to failure, 3+ = easy)">
          ${[0, 1, 2, 3, 4].map(n =>
            `<button type="button" class="rir-btn ${restoredRir === n ? "active" : ""}" data-rir="${n}">${n}</button>`
          ).join("")}
        </div>`;
      rows.push(`
        <div class="set-row" data-set-idx="${entryIdx}" ${side ? `data-side="${side}"` : ""}>
          <span class="set-num">${label}</span>
          ${usesWeight ? `
            <label class="log-field compact">
              <input type="number" inputmode="decimal" step="${stepW}" min="0" data-log-set="weight"
                     placeholder="${defaultWeight || "wt"}" value="${w || ""}" />
              <span class="log-field-suffix">${units}</span>
            </label>` : ""}
          <label class="log-field compact">
            <input type="number" inputmode="numeric" step="1" min="0" data-log-set="reps"
                   placeholder="${defaultRep}" value="${r || ""}" />
            <span class="log-field-suffix">reps</span>
          </label>
          <div class="rir-wrap">
            <span class="rir-label" title="Reps In Reserve">RIR</span>
            ${rirHtml}
          </div>
        </div>
      `);
      entryIdx++;
    }
  }
  const setRows = rows.join("");

  return `
    <div class="exercise-log" data-exercise="${escapeAttr(ex.name)}">
      <div class="exercise-log-head">
        ${pill || `<span class="last-pill empty">No log yet</span>`}
      </div>
      <div class="set-list">${setRows}</div>
      <div class="log-form">
        <button class="log-btn" data-action="log-set">✓ Save sets</button>
      </div>
    </div>
  `;
}

// Render a single exercise card. opts.inGroup hides the per-card rest line
// (rest is shown on the group wrapper). opts.groupPosition prefixes the name
// with "A" / "B" / "C" so positions are obvious within a superset.
function renderExerciseCard(ex, units, opts = {}) {
  const positionPrefix = opts.groupPosition != null
    ? `<span class="group-position-letter">${String.fromCharCode(65 + opts.groupPosition)}</span>`
    : "";
  const inGroup = !!opts.inGroup;
  const repsDisplay = displayReps(ex);
  let restLine;
  if (inGroup) {
    restLine = `${repsDisplay}`;
  } else if (ex.isTimeBlock) {
    // Cardio block: single time-based prescription, no sets×reps frame.
    const cardioSec = parseTimeReps(ex.reps);
    const startBtn = !workoutReadOnly && cardioSec
      ? `<button class="start-set-btn" data-action="start-set" data-duration="${cardioSec}" data-name="${escapeAttr(ex.name)}" title="Start set timer">▶ Start</button>`
      : "";
    restLine = `<span class="time-block-prescription">${repsDisplay}</span> ${startBtn}${
      ex.rest > 0 ? `<br /><span class="exercise-rest">rest ${ex.rest}s</span>` : ""
    }`;
  } else {
    const setSec = parseTimeReps(ex.reps);
    const setBtn = !workoutReadOnly && setSec
      ? `<button class="start-set-btn inline" data-action="start-set" data-duration="${setSec}" data-name="${escapeAttr(ex.name)}" title="Start set timer">▶</button>`
      : "";
    restLine = `${ex.sets} × ${repsDisplay} ${setBtn}<br /><span class="exercise-rest">rest ${ex.rest}s${workoutReadOnly ? "" : `<button class="start-rest-btn" data-action="start-rest" data-rest="${ex.rest}" data-name="${escapeAttr(ex.name)}" title="Start rest timer">⏱</button>`}</span>`;
  }
  return `
    <div class="exercise${inGroup ? " in-group" : ""}" data-name="${escapeAttr(ex.name)}">
      <div class="exercise-row">
        <div class="exercise-main">
          <div class="exercise-name-row">
            <div class="exercise-name">${positionPrefix}${ex.name}${ex.unilateral ? ` <span class="unilateral-tag">${/\blunges?\b|split squat|step-?up|single-?leg|pistol|shrimp/i.test(ex.name) ? "per leg" : "per side"}</span>` : ""}</div>
            ${renderExerciseExtras(ex.name)}
          </div>
          <div class="exercise-info">${ex.muscle.map(m => m.replace("_", " ")).join(" · ")}</div>
          ${ex.technique ? `
            <div class="technique-badge">${ex.technique.name}</div>
            <div class="technique-note">${ex.technique.note}</div>
          ` : ""}
          ${ex.finisher ? `
            <div class="technique-badge finisher-badge">★ ${ex.finisher.name}</div>
            <div class="technique-note">${ex.finisher.note}</div>
          ` : ""}
          ${renderFormCues(ex.name)}
          ${renderProgressChart(ex.name)}
        </div>
        <div class="exercise-prescription">${restLine}</div>
        ${workoutReadOnly ? "" : `<button class="swap-btn" data-action="swap" title="Swap for an alternative" aria-label="Swap exercise">↻</button>`}
      </div>
      ${renderExerciseLog(ex, units)}
    </div>
  `;
}

// Walk a flat exercise list, grouping consecutive same-groupId items into
// superset/circuit blocks, and emit the appropriate markup.
let _groupCounter = 0;
function renderExerciseList(list, units) {
  let html = "";
  let i = 0;
  while (i < list.length) {
    const ex = list[i];
    if (ex.groupId) {
      const groupExs = [];
      const gid = ex.groupId;
      while (i < list.length && list[i].groupId === gid) {
        groupExs.push(list[i]);
        i++;
      }
      _groupCounter += 1;
      const size = groupExs.length;
      const sets = groupExs[0].sets;
      const rest = groupExs[0].rest;
      const label = size === 2
        ? `SUPERSET ${String.fromCharCode(64 + _groupCounter)}`
        : `CIRCUIT ${_groupCounter}`;
      const labelAttr = escapeAttr(label);
      html += `
        <div class="exercise-group" data-group-id="${gid}">
          <div class="exercise-group-header">
            <span class="exercise-group-label">${label}</span>
            <span class="exercise-group-prescription">
              ${sets} rounds · rest <strong>${rest}s</strong> after each round
              ${workoutReadOnly ? "" : `<button class="start-rest-btn" data-action="start-rest" data-rest="${rest}" data-name="${labelAttr}" title="Start rest timer">⏱</button>`}
            </span>
          </div>
          <div class="exercise-group-body">
            ${groupExs.map((e, p) => renderExerciseCard(e, units, { inGroup: true, groupPosition: p })).join("")}
          </div>
        </div>
      `;
    } else {
      html += renderExerciseCard(ex, units);
      i++;
    }
  }
  return html;
}

function renderWorkout(workout, container, { showSave = true } = {}) {
  _groupCounter = 0; // reset per render so labels run A, B, C from scratch
  const { inputs, exercises } = workout;
  const dateStr = new Date(workout.createdAt).toLocaleString();
  const units = session ? getPrefs(session.username).units : "kg";

  const tags = [
    GOAL_LABELS[inputs.goal],
    TARGET_LABELS[inputs.target],
    `${inputs.duration} min`,
    inputs.difficulty[0].toUpperCase() + inputs.difficulty.slice(1),
  ].map(t => `<span class="tag">${t}</span>`).join("");

  const sections = {
    "Warm-up / Mobility": exercises.filter(e => e.pattern === "mobility"),
    "Power / Ballistic": exercises.filter(e => e.pattern === "ballistic"),
    "Main Work": exercises.filter(e => e.pattern === "compound" || e.pattern === "isolation"),
    "Conditioning / Finisher": exercises.filter(e => e.pattern === "conditioning"),
  };

  const exercisesHtml = Object.entries(sections)
    .filter(([, list]) => list.length > 0)
    .map(([title, list]) => `
      <h3 class="section-header">${title}</h3>
      <div class="exercise-list">
        ${renderExerciseList(list, units)}
      </div>
    `).join("");

  const intensityFlag = inputs.style === "intensity"
    ? `<span class="intensity-flag">Intensity Mode</span>` : "";
  const deloadFlag = inputs.deload
    ? `<span class="deload-flag">${t("wo.deloadFlag")}</span>` : "";

  const notesText = workout.notes || "";
  const notesHtml = `
    <details class="workout-notes" ${notesText ? "open" : ""}>
      <summary><span class="notes-summary">📝 ${notesText ? t("wo.notes") : t("wo.addNotes")}</span></summary>
      <textarea class="notes-input" id="workoutNotes" rows="3"
        placeholder="${t("wo.notesPlaceholder")}">${notesText.replace(/</g, "&lt;")}</textarea>
      <div class="notes-status" id="notesStatus" aria-live="polite"></div>
    </details>
  `;

  container.innerHTML = `
    <div class="workout-header">
      <div>
        <div class="workout-title">${TARGET_LABELS[inputs.target]} · ${GOAL_LABELS[inputs.goal]}</div>
        <div class="workout-meta">${tags} ${intensityFlag} ${deloadFlag}</div>
        <div class="workout-date">${dateStr}</div>
      </div>
      <div class="workout-actions">
        <button class="primary-btn" id="startWorkoutBtn">▶ ${t("wo.startWorkout")}</button>
        ${showSave ? `<button class="secondary-btn" id="saveBtn">${t("settings.save")}</button>` : ""}
        <button class="secondary-btn" id="shareBtn">🔗 ${t("wo.share")}</button>
        <button class="secondary-btn" id="regenBtn">${t("wo.regenerate")}</button>
      </div>
    </div>
    ${notesHtml}
    ${exercisesHtml}
  `;
}

// ─── GENERATE BUTTON ─────────────────────────────────────────────────────
let currentWorkout = null;

el.generateBtn.addEventListener("click", () => {
  el.formError.textContent = "";
  const { goal, equipment, target, duration, difficulty } = formState;
  if (!goal) return el.formError.textContent = "Pick a goal.";
  if (!equipment.length) return el.formError.textContent = "Pick at least one equipment option.";
  if (!target) return el.formError.textContent = "Pick a target.";
  if (!duration) return el.formError.textContent = "Pick a duration.";
  if (!difficulty) return el.formError.textContent = "Pick a difficulty.";

  currentWorkout = generateWorkout({
    goal, equipment, target,
    duration: parseInt(duration, 10),
    difficulty,
    style: formState.style || "standard",
    deload: !!formState.deload,
  });
  workoutIsSaved = false;
  workoutReadOnly = false;
  recentlyLogged = {};

  if (!currentWorkout.exercises.length) {
    el.formError.textContent = "No matching exercises. Try adding more equipment or a different target.";
    el.workoutResult.classList.add("hidden");
    return;
  }

  el.workoutResult.classList.remove("hidden");
  renderWorkout(currentWorkout, el.workoutResult);
  attachWorkoutActions();
  // re-trigger slide-up animation on regenerate
  el.workoutResult.style.animation = "none";
  void el.workoutResult.offsetWidth;
  el.workoutResult.style.animation = "";
  el.workoutResult.scrollIntoView({ behavior: "smooth", block: "start" });
});

let workoutIsSaved = false;

// ─── SHARE WORKOUT ───────────────────────────────────────────────────────
// Encodes a workout into a URL hash so anyone can open it without an account.
// Strips muscle/pattern fields that we can re-derive from EXERCISES on load.
function buildShareLink(workout) {
  const compact = {
    n: `${TARGET_LABELS[workout.inputs.target]} · ${GOAL_LABELS[workout.inputs.goal]}`,
    i: workout.inputs,
    e: workout.exercises.map(e => ({
      n: e.name,
      s: e.sets,
      r: e.reps,
      x: e.rest,
      t: e.technique || null,
      f: e.finisher || null,
      g: e.groupId || null,
      gp: e.groupPosition,
      gs: e.groupSize,
      tb: e.isTimeBlock || false,
    })),
    notes: workout.notes || "",
  };
  const json = JSON.stringify(compact);
  // UTF-8-safe base64 via encodeURIComponent → escape → btoa idiom.
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return `${location.origin}${location.pathname}#w=${encoded}`;
}

function decodeSharedWorkoutFromHash() {
  if (!location.hash.startsWith("#w=")) return null;
  try {
    const encoded = location.hash.slice(3);
    const json = decodeURIComponent(escape(atob(encoded)));
    const c = JSON.parse(json);
    if (!c || !Array.isArray(c.e)) return null;
    // Rehydrate exercise muscle/pattern from the exercise library.
    const exercises = c.e.map(e => {
      const lib = EXERCISES.find(x => x.name === e.n);
      return {
        name: e.n,
        muscle: lib ? lib.muscle : ["full_body"],
        pattern: lib ? lib.pattern : "compound",
        sets: e.s, reps: e.r, rest: e.x,
        technique: e.t || null, finisher: e.f || null,
        groupId: e.g || undefined,
        groupPosition: e.gp,
        groupSize: e.gs,
        isTimeBlock: !!e.tb,
      };
    });
    return {
      id: `shared_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      inputs: c.i,
      exercises,
      notes: c.notes || "",
      isShared: true,
    };
  } catch { return null; }
}

let sharedWorkoutPending = null;
// Track exercises logged during the current viewing pass so the "edit" affordance
// restores the values the user just entered (instead of the progression suggestion
// for next session).
let recentlyLogged = {};
// Whether the currently displayed workout is read-only (e.g. viewing from history).
let workoutReadOnly = false;

function attachWorkoutActions() {
  const saveBtn = document.getElementById("saveBtn");
  const regenBtn = document.getElementById("regenBtn");
  const startBtn = document.getElementById("startWorkoutBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => startGuidedMode());
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (!currentWorkout || !session) return;
      addWorkout(session.username, currentWorkout);
      saveBtn.textContent = t("settings.saved");
      saveBtn.disabled = true;
      workoutIsSaved = true;
    });
  }
  if (regenBtn) {
    regenBtn.addEventListener("click", () => {
      workoutIsSaved = false;
      el.generateBtn.click();
    });
  }

  const shareBtn = document.getElementById("shareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      if (!currentWorkout) return;
      const link = buildShareLink(currentWorkout);
      try {
        await navigator.clipboard.writeText(link);
        shareBtn.textContent = "✓ Link copied";
        setTimeout(() => { shareBtn.textContent = "🔗 Share"; }, 1800);
      } catch {
        // Fallback: show in a prompt the user can copy manually
        prompt("Copy this link to share the workout:", link);
      }
    });
  }

  // ─── NOTES AUTO-SAVE ───────────────────────────────────────────────────
  const notesEl = document.getElementById("workoutNotes");
  if (notesEl) {
    let notesTimer = null;
    const persistNotes = () => {
      if (!currentWorkout) return;
      const val = notesEl.value;
      currentWorkout.notes = val;
      // If this workout is already saved, persist the edit.
      if (workoutIsSaved && session?.username) {
        updateWorkout(session.username, currentWorkout.id, { notes: val });
        const status = document.getElementById("notesStatus");
        if (status) {
          status.textContent = t("settings.saved");
          setTimeout(() => { if (status) status.textContent = ""; }, 1500);
        }
      }
      // Update the summary label
      const summary = notesEl.parentElement?.querySelector(".notes-summary");
      if (summary) summary.textContent = `📝 ${val.trim() ? t("wo.notes") : t("wo.addNotes")}`;
    };
    notesEl.addEventListener("input", () => {
      clearTimeout(notesTimer);
      notesTimer = setTimeout(persistNotes, 600);
    });
    notesEl.addEventListener("blur", persistNotes);
  }

  // ─── FORM CUES TOGGLE ──────────────────────────────────────────────────
  document.querySelectorAll("[data-action='toggle-cues']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const container = btn.closest(".exercise, .guided-card");
      const panel = container?.querySelector(".form-cues");
      if (panel) panel.classList.toggle("hidden");
      btn.classList.toggle("active");
    });
  });

  // ─── PROGRESS CHART TOGGLE ─────────────────────────────────────────────
  document.querySelectorAll("[data-action='toggle-progress']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const container = btn.closest(".exercise, .guided-card");
      const panel = container?.querySelector(".progress-panel");
      if (panel) panel.classList.toggle("hidden");
      btn.classList.toggle("active");
    });
  });

  // ─── MANUAL REST TIMER START ───────────────────────────────────────────
  document.querySelectorAll("[data-action='start-rest']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const seconds = parseInt(btn.dataset.rest, 10) || 60;
      const exName = btn.dataset.name || "Rest";
      startRestTimer(seconds, `Rest — ${exName}`);
    });
  });

  // ─── SET TIMER (time-based exercises like planks / carries / cardio) ──
  document.querySelectorAll("[data-action='start-set']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const seconds = parseInt(btn.dataset.duration, 10) || 30;
      const exName = btn.dataset.name || "Active set";
      startRestTimer(seconds, `Set — ${exName}`);
    });
  });

  // ─── SWAP BUTTONS ──────────────────────────────────────────────────────
  document.querySelectorAll("[data-action='swap']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!currentWorkout) return;
      const exEl = btn.closest(".exercise");
      if (!exEl) return;
      const exName = exEl.dataset.name;
      const idx = currentWorkout.exercises.findIndex(x => x.name === exName);
      if (idx === -1) return;

      const excludeNames = currentWorkout.exercises.map(x => x.name);
      const alt = findAlternativeExercise(exName, currentWorkout.inputs, excludeNames);

      if (!alt) {
        // No replacement found — pulse the card so the user knows.
        exEl.style.transition = "none";
        exEl.style.borderColor = "var(--danger)";
        setTimeout(() => {
          exEl.style.transition = "border-color 0.4s";
          exEl.style.borderColor = "";
        }, 50);
        return;
      }

      const inputs = currentWorkout.inputs;
      const newEx = {
        name: alt.name,
        muscle: alt.muscle,
        pattern: alt.pattern,
        ...pickPrescription(inputs.goal, inputs.difficulty, alt, inputs.style || "standard"),
      };
      currentWorkout.exercises[idx] = newEx;

      // Re-order in case the swap crossed pattern buckets.
      const orderKey = (x) => {
        if (x.pattern === "mobility") return 0;
        if (x.pattern === "ballistic") return 1;
        if (x.pattern === "compound") return 2;
        if (x.pattern === "isolation") return 3;
        return 4;
      };
      currentWorkout.exercises.sort((a, b) => orderKey(a) - orderKey(b));

      renderWorkout(currentWorkout, el.workoutResult, { showSave: !workoutIsSaved });
      attachWorkoutActions();
    });
  });

  // Wire RIR pickers: clicking a number activates it, clicking the same
  // number again clears it (so the user can un-log RIR if needed).
  document.querySelectorAll(".rir-picker .rir-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const group = btn.closest(".rir-picker");
      const wasActive = btn.classList.contains("active");
      group.querySelectorAll(".rir-btn").forEach(b => b.classList.remove("active"));
      if (!wasActive) btn.classList.add("active");
    });
  });

  // ─── EXERCISE LOG BUTTONS ──────────────────────────────────────────────
  document.querySelectorAll("[data-action='log-set']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const logEl = btn.closest(".exercise-log");
      if (!logEl) return;
      const exName = logEl.dataset.exercise;
      const units = getPrefs(session.username).units;

      // Gather sets from each row — skip rows without a reps value.
      const setRows = logEl.querySelectorAll(".set-row");
      const sets = [];
      setRows.forEach(row => {
        const repsInput = row.querySelector("[data-log-set='reps']");
        const weightInput = row.querySelector("[data-log-set='weight']");
        const reps = Number(repsInput?.value);
        if (!reps || reps <= 0) return;
        const weightDisplay = weightInput ? Number(weightInput.value) : 0;
        const weightKg = weightInput ? fromDisplay(weightDisplay, units) : 0;
        const side = row.dataset.side; // "R" or "L" for unilateral, undefined otherwise
        const rirBtn = row.querySelector(".rir-picker .rir-btn.active");
        const rir = rirBtn ? Number(rirBtn.dataset.rir) : null;
        const entry = { weightKg, reps };
        if (side) entry.side = side;
        if (rir != null && !Number.isNaN(rir)) entry.rir = rir;
        sets.push(entry);
      });

      if (sets.length === 0) {
        // Highlight first empty rep input as an affordance
        logEl.querySelector("[data-log-set='reps']")?.focus();
        return;
      }

      const result = logExercise(session.username, exName, sets);
      recentlyLogged[exName] = { sets };

      // Auto-start rest timer using the exercise's prescribed rest.
      const ex = currentWorkout?.exercises.find(x => x.name === exName);
      if (ex && ex.rest > 0) startRestTimer(ex.rest, `Rest — ${exName}`);

      // Working set = heaviest by e1RM
      const workingSet = sets.reduce((best, s) =>
        calculateE1RM(s.weightKg, s.reps) > calculateE1RM(best.weightKg, best.reps) ? s : best, sets[0]);
      const wText = workingSet.weightKg
        ? `${toDisplay(workingSet.weightKg, units)} ${units} × ${workingSet.reps}`
        : `${workingSet.reps} reps`;
      const isUnilateralLog = sets.some(s => s.side);
      const setsCount = sets.length;
      const summary = isUnilateralLog
        ? `${setsCount / 2 | 0} sets per side · best ${wText}`
        : (setsCount > 1 ? `${setsCount} sets · best ${wText}` : wText);

      // "Ready to push weight" hint: did the user hit the top of the rep
      // range on the gating side? For unilateral, both sides must hit top.
      const [lo, hi] = parseRepRange(ex.reps);
      let progressHint = "";
      if (hi > 0) {
        let gatingReps;
        if (isUnilateralLog) {
          const minR = Math.min(...sets.filter(s => s.side === "R").map(s => s.reps), Infinity);
          const minL = Math.min(...sets.filter(s => s.side === "L").map(s => s.reps), Infinity);
          gatingReps = Math.min(minR, minL);
        } else {
          gatingReps = Math.max(...sets.map(s => s.reps));
        }
        if (gatingReps >= hi) {
          progressHint = `<span class="progress-ready-tag">→ ready to push weight</span>`;
        } else if (gatingReps < lo) {
          progressHint = `<span class="progress-ready-tag down">↓ deload next time</span>`;
        }
      }
      const prBadge = result.pr ? `<span class="pr-celebrate">🏆 NEW PR</span>` : "";

      logEl.innerHTML = `
        <span class="logged-badge">✓ Logged ${summary}${prBadge}${progressHint}
          <span class="edit-link" data-action="edit-log">edit</span>
        </span>
      `;
      logEl.querySelector("[data-action='edit-log']").addEventListener("click", () => {
        renderWorkout(currentWorkout, el.workoutResult, { showSave: !workoutIsSaved });
        attachWorkoutActions();
      });
    });
  });
}

// ─── HISTORY ─────────────────────────────────────────────────────────────
function renderHistory() {
  const items = getWorkouts(session.username);
  const heatmapHtml = renderBodyHeatmap(session.username);
  const volumeChartHtml = renderWeeklyVolumeChart(session.username, 8);

  if (!items.length) {
    el.historyList.innerHTML = `
      ${heatmapHtml}
      ${volumeChartHtml}
      <div class="empty-state">
        <div class="empty-state-icon">🏋️</div>
        <div class="empty-state-title">${t("history.empty")}</div>
        <div class="empty-state-sub">${t("history.emptySub")}</div>
      </div>
    `;
    return;
  }

  el.historyList.innerHTML = heatmapHtml + volumeChartHtml + items.map(w => {
    const notes = (w.notes || "").trim();
    const notesPreview = notes
      ? `<div class="history-notes">📝 ${notes.length > 90 ? notes.slice(0, 90).replace(/</g, "&lt;") + "…" : notes.replace(/</g, "&lt;")}</div>`
      : "";
    return `
    <div class="history-item" data-id="${w.id}">
      <div class="history-item-header">
        <div>
          <div class="history-title">${TARGET_LABELS[w.inputs.target]} · ${GOAL_LABELS[w.inputs.goal]}</div>
          <div class="workout-meta">
            <span class="tag">${w.inputs.duration} min</span>
            <span class="tag">${w.exercises.length} exercises</span>
            <span class="tag">${w.inputs.difficulty}</span>
            ${w.inputs.style === "intensity" ? `<span class="tag">Intensity ⚡</span>` : ""}
            ${w.inputs.deload ? `<span class="tag">Deload</span>` : ""}
          </div>
          ${notesPreview}
        </div>
        <div class="history-side">
          <span class="history-date">${new Date(w.createdAt).toLocaleDateString()}</span>
          <button class="link-btn" data-action="delete" data-id="${w.id}">Delete</button>
        </div>
      </div>
    </div>
  `;
  }).join("");

  el.historyList.querySelectorAll(".history-item").forEach(item => {
    item.addEventListener("click", (e) => {
      if (e.target.dataset.action === "delete") {
        e.stopPropagation();
        deleteWorkout(session.username, e.target.dataset.id);
        renderHistory();
        return;
      }
      const id = item.dataset.id;
      const workout = getWorkouts(session.username).find(w => w.id === id);
      if (!workout) return;
      currentWorkout = workout;
      workoutIsSaved = true;
      workoutReadOnly = true;
      recentlyLogged = {};
      showApp("generator");
      el.workoutResult.classList.remove("hidden");
      renderWorkout(workout, el.workoutResult, { showSave: false });
      attachWorkoutActions();
      el.workoutResult.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// ─── EXERCISE LIBRARY VIEW ───────────────────────────────────────────────
const libraryState = {
  search: "",
  muscle: null,         // single-select
  equipment: [],        // multi-select
  pattern: null,        // single-select
  difficulty: null,     // single-select
};
let libraryInitialized = false;

const LIBRARY_FILTER_OPTIONS = {
  muscle: ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "core", "full_body"],
  equipment: ["bodyweight", "dumbbells", "barbell", "kettlebell", "bands", "machine", "cardio_machine"],
  pattern: ["compound", "isolation", "ballistic", "conditioning", "mobility"],
  difficulty: ["beginner", "intermediate", "advanced"],
};

const PATTERN_LABELS = _labelProxy("pattern");

function initLibraryFilters() {
  if (libraryInitialized) return;
  libraryInitialized = true;

  // Render the count + surrounding text via i18n so both update on language switch.
  const subEl = document.getElementById("libraryViewSub");
  if (subEl) subEl.textContent = t("lib.sub", { count: EXERCISES.length });

  Object.entries(LIBRARY_FILTER_OPTIONS).forEach(([field, values]) => {
    const row = document.querySelector(`.library-filter[data-lib-filter="${field}"]`);
    if (!row) return;
    row.innerHTML = values.map(v => {
      const label = field === "equipment"
        ? EQUIP_LABELS[v] || v
        : field === "pattern"
          ? PATTERN_LABELS[v] || v
          : v.replace("_", " ");
      return `<button class="chip" data-lib-value="${v}">${label}</button>`;
    }).join("");
    row.querySelectorAll(".chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.libValue;
        if (field === "equipment") {
          const arr = libraryState[field];
          const idx = arr.indexOf(value);
          if (idx === -1) arr.push(value);
          else arr.splice(idx, 1);
          btn.classList.toggle("selected");
        } else {
          const wasSelected = btn.classList.contains("selected");
          row.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
          if (!wasSelected) {
            btn.classList.add("selected");
            libraryState[field] = value;
          } else {
            libraryState[field] = null;
          }
        }
        renderLibrary();
      });
    });
  });

  document.getElementById("librarySearch").addEventListener("input", (e) => {
    libraryState.search = e.target.value.toLowerCase().trim();
    renderLibrary();
  });

  document.getElementById("libraryClearBtn").addEventListener("click", () => {
    libraryState.search = "";
    libraryState.muscle = null;
    libraryState.equipment = [];
    libraryState.pattern = null;
    libraryState.difficulty = null;
    document.getElementById("librarySearch").value = "";
    document.querySelectorAll(".library-filter .chip.selected").forEach(c => c.classList.remove("selected"));
    renderLibrary();
  });
}

function renderLibrary() {
  initLibraryFilters();

  const filtered = EXERCISES.filter(ex => {
    if (libraryState.search) {
      const hit = ex.name.toLowerCase().includes(libraryState.search) ||
                  ex.muscle.some(m => m.toLowerCase().includes(libraryState.search)) ||
                  ex.equipment.some(e => e.toLowerCase().includes(libraryState.search));
      if (!hit) return false;
    }
    if (libraryState.muscle && !ex.muscle.includes(libraryState.muscle)) return false;
    if (libraryState.equipment.length > 0 &&
        !ex.equipment.some(e => libraryState.equipment.includes(e))) return false;
    if (libraryState.pattern && ex.pattern !== libraryState.pattern) return false;
    if (libraryState.difficulty && ex.difficulty !== libraryState.difficulty) return false;
    return true;
  });

  document.getElementById("libraryCount").textContent =
    `${filtered.length} exercise${filtered.length === 1 ? "" : "s"}`;

  document.getElementById("libraryList").innerHTML = filtered.map(ex => `
    <div class="library-card" data-name="${escapeAttr(ex.name)}">
      <div class="library-card-head">
        <div class="library-card-name">${ex.name}</div>
        ${renderExerciseExtras(ex.name)}
      </div>
      <div class="library-card-meta">
        <span class="tag">${PATTERN_LABELS[ex.pattern] || ex.pattern}</span>
        <span class="tag">${ex.difficulty}</span>
      </div>
      <div class="library-card-info">
        <strong>Muscles:</strong> ${ex.muscle.map(m => m.replace("_", " ")).join(" · ")}
      </div>
      <div class="library-card-info">
        <strong>Equipment:</strong> ${ex.equipment.map(e => EQUIP_LABELS[e] || e).join(", ")}
      </div>
      ${renderFormCues(ex.name)}
    </div>
  `).join("") || `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">${t("lib.empty")}</div><div class="empty-state-sub">${t("lib.emptySub")}</div></div>`;

  // Wire form-cues toggles inside the library
  document.querySelectorAll(".library-card [data-action='toggle-cues']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const panel = btn.closest(".library-card")?.querySelector(".form-cues");
      if (panel) panel.classList.toggle("hidden");
      btn.classList.toggle("active");
    });
  });
}

// ─── SETTINGS ────────────────────────────────────────────────────────────
function renderSettings() {
  if (!session) return;
  const units = getPrefs(session.username).units;
  const loads = getLoads(session.username);

  document.querySelectorAll("[data-unit-label]").forEach(s => s.textContent = units);
  // Available KB label has a nested unit span — re-render it with i18n + unit.
  const kbLabel = document.getElementById("availableKBLabel");
  if (kbLabel) kbLabel.textContent = t("settings.availableKB", { unit: units });

  const dbInput = document.getElementById("maxDumbbell");
  const kbInput = document.getElementById("maxKettlebell");
  const bbCheck = document.getElementById("hasHeavyBarbell");

  dbInput.value = loads.maxDumbbellKg ? toDisplay(loads.maxDumbbellKg, units) : "";
  kbInput.value = loads.maxKettlebellKg ? toDisplay(loads.maxKettlebellKg, units) : "";
  bbCheck.checked = !!loads.hasHeavyBarbell;
  const kbList = document.getElementById("availableKettlebells");
  if (kbList) {
    const arr = loads.availableKettlebellsKg;
    kbList.value = Array.isArray(arr)
      ? arr.map(w => toDisplay(w, units)).join(", ")
      : "";
  }

  renderSettingsSoreness();
  renderVolumeTargets();
  renderSettingsSleep();
  renderCloudToggle();
  renderLanguageChips();
}

// Highlight the active language chip and wire clicks. Changing language
// re-applies static HTML translations and re-renders any currently visible
// dynamic view so labels update without a hard reload.
function renderLanguageChips() {
  const wrap = document.getElementById("languageChips");
  if (!wrap) return;
  const current = window.i18n?.getLang() || "en";
  wrap.querySelectorAll("[data-lang-value]").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.langValue === current);
    btn.onclick = () => {
      const newLang = btn.dataset.langValue;
      if (!newLang || newLang === window.i18n?.getLang()) return;
      window.i18n.setLang(newLang);
      window.i18n.applyI18n(document);
      // Re-render dynamic content
      refreshActiveView();
    };
  });
}

// Force a re-render of whatever view is currently active so dynamic strings
// (built inside JS template literals) pick up the new language.
function refreshActiveView() {
  // Static HTML attrs already updated by applyI18n. Re-render the rest.
  if (el.settingsView && !el.settingsView.classList.contains("hidden")) renderSettings();
  if (el.historyView && !el.historyView.classList.contains("hidden")) renderHistory();
  if (el.libraryView && !el.libraryView.classList.contains("hidden")) {
    libraryInitialized = false;
    initLibraryFilters();
    renderLibrary();
  }
  // Library sub has an injected count — needs JS-side retranslation
  const libSub = document.getElementById("libraryViewSub");
  if (libSub) libSub.textContent = t("lib.sub", { count: EXERCISES.length });
  // If a workout is being viewed, re-render it
  if (currentWorkout && el.workoutResult && !el.workoutResult.classList.contains("hidden")) {
    renderWorkout(currentWorkout, el.workoutResult, { showSave: !workoutIsSaved });
    attachWorkoutActions();
  }
  // Guided mode
  if (guided?.active) renderGuided();
}

function renderCloudToggle() {
  const card = document.getElementById("cloudToggleCard");
  const btn = document.getElementById("cloudToggleBtn");
  const status = document.getElementById("cloudToggleStatus");
  if (!card || !btn) return;
  // Only show this card when cloud is actually configured (otherwise nothing
  // to toggle — local is already the default).
  if (!_configReady) {
    card.style.display = "none";
    return;
  }
  card.style.display = "";
  const isLocal = _userForcedLocal;
  btn.textContent = isLocal ? "Re-enable cloud sync" : "Switch to offline mode";
  status.textContent = isLocal
    ? "Currently: offline — local-only, no sync"
    : "Currently: cloud sync active";
  btn.onclick = () => {
    if (isLocal) {
      // Re-enabling cloud
      if (!confirm("Re-enable cloud sync? You'll be asked to log in to your cloud account. Your local-only data on this device stays where it is.")) return;
      localStorage.removeItem("forge:forceLocal");
    } else {
      if (!confirm("Switch to offline mode? Your cloud data stays in the cloud — this device just won't sync with it. Re-enable any time.")) return;
      localStorage.setItem("forge:forceLocal", "1");
    }
    location.replace(location.pathname);
  };
}

function renderSettingsSleep() {
  const grid = document.getElementById("settingsSleep");
  if (!grid || !session) return;
  const current = getSleepRating(session.username);
  const opts = [
    { q: 5, label: `😴 ${t("sleep.great")}`, desc: t("sleep.greatDesc") },
    { q: 4, label: `🙂 ${t("sleep.ok")}`,    desc: t("sleep.okDesc") },
    { q: 2, label: `😐 ${t("sleep.meh")}`,   desc: t("sleep.mehDesc") },
    { q: 1, label: `😩 ${t("sleep.bad")}`,   desc: t("sleep.badDesc") },
  ];
  grid.innerHTML = opts.map(o => `
    <button class="sleep-btn ${current?.quality === o.q ? "selected" : ""}"
            data-settings-sleep="${o.q}" title="${o.desc}">${o.label}</button>
  `).join("");
  grid.querySelectorAll("[data-settings-sleep]").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = Number(btn.dataset.settingsSleep);
      setSleepRating(session.username, q);
      renderSettingsSleep();
    });
  });
}

function renderSettingsSoreness() {
  const grid = document.getElementById("settingsSorenessGrid");
  if (!grid || !session) return;
  grid.innerHTML = MAJOR_MUSCLES.map(m => {
    const current = Math.round(getCurrentSoreness(session.username, m) * 10) / 10;
    return `
      <div class="soreness-row" data-muscle="${m}">
        <span class="soreness-muscle">${m} <span class="soreness-current">${current > 0 ? `(${current})` : ""}</span></span>
        <div class="soreness-buttons">
          ${[0,1,2,3].map(l => `<button class="soreness-btn" data-settings-soreness data-muscle="${m}" data-level="${l}" title="${["Not sore","A bit sore","Properly sore","Wrecked"][l]}">${["😌","😐","😣","😱"][l]}</button>`).join("")}
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll("[data-settings-soreness]").forEach(btn => {
    btn.addEventListener("click", () => {
      const muscle = btn.dataset.muscle;
      const level = Number(btn.dataset.level);
      setSoreness(session.username, muscle, level);
      // Update display
      const row = btn.closest(".soreness-row");
      row.querySelectorAll(".soreness-btn").forEach(b =>
        b.classList.toggle("selected", b === btn));
      const label = row.querySelector(".soreness-current");
      if (label) label.textContent = level > 0 ? `(${level})` : "";
    });
  });
}

function renderVolumeTargets() {
  const grid = document.getElementById("volumeTargetsGrid");
  if (!grid || !session) return;
  const targets = getVolumeTargets(session.username);
  grid.innerHTML = MAJOR_MUSCLES.map(m => `
    <label class="settings-field">
      <span>${m}</span>
      <div class="settings-input narrow">
        <input type="number" min="0" max="40" step="1" data-vt-muscle="${m}"
               value="${targets[m] || ""}" placeholder="0" />
        <span class="settings-unit">sets / wk</span>
      </div>
    </label>
  `).join("");
}

document.getElementById("saveTargetsBtn").addEventListener("click", () => {
  if (!session) return;
  const targets = {};
  document.querySelectorAll("[data-vt-muscle]").forEach(inp => {
    const m = inp.dataset.vtMuscle;
    const v = Number(inp.value) || 0;
    if (v > 0) targets[m] = v;
  });
  setVolumeTargets(session.username, targets);
  const saved = document.getElementById("targetsSaved");
  saved.classList.remove("hidden");
  setTimeout(() => saved.classList.add("hidden"), 1500);
});

// ─── PLATE CALCULATOR ───────────────────────────────────────────────────
function calculatePlates(totalDisplay, units) {
  const barWeight = units === "lb" ? 45 : 20;
  if (totalDisplay <= barWeight) {
    if (totalDisplay === barWeight) return { plates: [], remainder: 0, bar: barWeight };
    return null;
  }
  const perSide = (totalDisplay - barWeight) / 2;
  const plates = units === "lb"
    ? [45, 35, 25, 10, 5, 2.5]
    : [25, 20, 15, 10, 5, 2.5, 1.25];
  let remaining = perSide;
  const result = [];
  for (const p of plates) {
    const count = Math.floor(remaining / p);
    if (count > 0) {
      result.push({ plate: p, count });
      remaining = Math.round((remaining - count * p) * 1000) / 1000;
    }
  }
  return { plates: result, remainder: remaining, bar: barWeight };
}

document.getElementById("plateCalcBtn").addEventListener("click", () => {
  const units = getPrefs(session.username).units;
  const total = Number(document.getElementById("plateInput").value);
  const out = document.getElementById("plateResult");
  if (!total) { out.innerHTML = ""; return; }
  const r = calculatePlates(total, units);
  if (!r) {
    out.innerHTML = `<div class="tool-warn">Below bar weight (${units === "lb" ? 45 : 20} ${units}). Just lift the empty bar.</div>`;
    return;
  }
  if (r.plates.length === 0) {
    out.innerHTML = `<div class="tool-pass">Just the bar — no plates needed.</div>`;
    return;
  }
  const plateText = r.plates.map(p => `<span class="plate-chip">${p.count} × ${p.plate}${units}</span>`).join("");
  const remainderNote = r.remainder > 0.05
    ? `<div class="tool-warn">⚠ Couldn't make exact — short by ${r.remainder * 2} ${units} total.</div>`
    : "";
  out.innerHTML = `
    <div class="plate-result">
      <div class="plate-result-label">Per side:</div>
      <div class="plate-result-plates">${plateText}</div>
    </div>
    <div class="plate-result-meta">Bar: ${r.bar} ${units} · Per side: ${(total - r.bar) / 2} ${units} · Total: ${total} ${units}</div>
    ${remainderNote}
  `;
});

// ─── 1RM CALCULATOR ─────────────────────────────────────────────────────
document.getElementById("oneRmCalcBtn").addEventListener("click", () => {
  const units = getPrefs(session.username).units;
  const w = Number(document.getElementById("oneRmWeight").value);
  const r = Number(document.getElementById("oneRmReps").value);
  const out = document.getElementById("oneRmResult");
  if (!w || !r) { out.innerHTML = ""; return; }
  if (r > 15) {
    out.innerHTML = `<div class="tool-warn">Formulas lose accuracy past 12-15 reps. Use a lower-rep set for a real estimate.</div>`;
    return;
  }
  const epley = w * (1 + r / 30);
  const brzycki = w / (1.0278 - 0.0278 * r);
  const lombardi = w * Math.pow(r, 0.1);
  const avg = (epley + brzycki + lombardi) / 3;
  const fmt = (v) => `${Math.round(v * 2) / 2} ${units}`;
  out.innerHTML = `
    <div class="onerm-result">
      <div class="onerm-headline">≈ ${fmt(avg)} <span class="onerm-headline-sub">estimated 1RM</span></div>
      <div class="onerm-breakdown">
        <span>Epley: <strong>${fmt(epley)}</strong></span>
        <span>Brzycki: <strong>${fmt(brzycki)}</strong></span>
        <span>Lombardi: <strong>${fmt(lombardi)}</strong></span>
      </div>
    </div>
  `;
});

// ─── DATA EXPORT / IMPORT ───────────────────────────────────────────────
const EXPORT_KEYS = [
  STORAGE_KEYS.users,
  STORAGE_KEYS.workouts,
  STORAGE_KEYS.stats,
  STORAGE_KEYS.prefs,
  STORAGE_KEYS.loads,
  STORAGE_KEYS.soreness,
];

document.getElementById("exportDataBtn").addEventListener("click", () => {
  const data = { exportedAt: new Date().toISOString(), version: 1 };
  for (const key of EXPORT_KEYS) {
    const v = localStorage.getItem(key);
    if (v != null) data[key] = JSON.parse(v);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `forge-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showDataStatus("Exported ✓", "success");
});

document.getElementById("importDataInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm("Importing will overwrite your local data (users, workouts, stats, settings). Continue?")) {
    e.target.value = "";
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    let imported = 0;
    for (const key of EXPORT_KEYS) {
      if (data[key] != null) {
        localStorage.setItem(key, JSON.stringify(data[key]));
        imported++;
      }
    }
    showDataStatus(`Imported ${imported} section${imported === 1 ? "" : "s"}. Reloading…`, "success");
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    showDataStatus("Import failed: " + err.message, "error");
  }
  e.target.value = "";
});

function showDataStatus(text, kind = "success") {
  const el = document.getElementById("dataStatus");
  if (!el) return;
  el.textContent = text;
  el.style.color = kind === "error" ? "var(--danger)" : "var(--success)";
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2400);
}

document.getElementById("saveSettingsBtn").addEventListener("click", () => {
  if (!session) return;
  const units = getPrefs(session.username).units;
  const dbVal = Number(document.getElementById("maxDumbbell").value) || 0;
  const kbVal = Number(document.getElementById("maxKettlebell").value) || 0;
  // Parse comma-separated KB list into kg numbers
  const kbListRaw = document.getElementById("availableKettlebells").value;
  const kbInventory = kbListRaw
    .split(/[,;\s]+/)
    .map(s => Number(s))
    .filter(n => n > 0)
    .map(n => fromDisplay(n, units));
  setLoads(session.username, {
    maxDumbbellKg: dbVal ? fromDisplay(dbVal, units) : 0,
    maxKettlebellKg: kbVal ? fromDisplay(kbVal, units) : 0,
    hasHeavyBarbell: document.getElementById("hasHeavyBarbell").checked,
    availableKettlebellsKg: kbInventory.length > 0 ? kbInventory : undefined,
  });
  const saved = document.getElementById("settingsSaved");
  saved.classList.remove("hidden");
  setTimeout(() => saved.classList.add("hidden"), 1800);
});

// ─── EXERCISE FORM CUES + EXTERNAL VIDEO LINKS ───────────────────────────
// Each cue set is keyed by movement pattern. The matcher picks the most
// specific applicable pattern for an exercise's name.
const FORM_CUES = {
  squat: [
    "Knees track over toes — push them out, not in",
    "Chest up, ribcage stacked over pelvis — don't fold forward",
    "Descend to at least parallel; drive through midfoot to stand",
  ],
  hinge: [
    "Push hips back first — knees bend only as much as needed",
    "Flat back, lats engaged, weight close to the body",
    "Squeeze glutes hard at the top — don't hyperextend the lower back",
  ],
  lunge: [
    "Step long enough that the front shin stays near vertical at the bottom",
    "Drive through the front heel to stand; torso stays upright",
    "Front knee tracks over toes — controlled descent, no crash",
  ],
  horizPress: [
    "Shoulders back and down — pinch the shoulder blades together",
    "Lower under control to mid-chest; elbows tucked ~45° to torso",
    "Drive feet into the floor for full-body tension",
  ],
  vertPress: [
    "Brace core hard — ribs down, glutes squeezed, no lumbar arch",
    "Bar/dumbbells travel in a straight line over mid-foot",
    "Shrug shoulders up at the top — full lockout",
  ],
  horizPull: [
    "Pull elbows back, not up — drive them past your ribs",
    "Squeeze shoulder blades together at the top",
    "Torso braced — no yanking with the lower back",
  ],
  vertPull: [
    "Start with shoulders depressed — initiate from the lats, not biceps",
    "Drive elbows down toward your hips; chest leads to the bar",
    "Control the descent — full dead hang at the bottom",
  ],
  curl: [
    "Keep elbows pinned at your sides — no swinging",
    "Squeeze biceps hard at the top, brief pause",
    "Full extension at the bottom — don't cheat the range",
  ],
  triExt: [
    "Lock elbows in place; only the forearm moves",
    "Squeeze triceps at full extension",
    "Slow the eccentric — feel the stretch under the elbow",
  ],
  ballistic: [
    "Power comes from the hips — explosive snap, not a curl or squat",
    "Maximum acceleration on the concentric phase",
    "Reset position fully between reps — no flow-through cheating",
  ],
  carry: [
    "Brace 360° core — pretend someone's about to punch you",
    "Walk tall — don't lean toward the loaded side (suitcase) or hunch",
    "Smooth, controlled breathing — no breath-holding",
  ],
  coreAntiExt: [
    "Squeeze glutes and quads — body is one rigid plank",
    "Posterior tilt the pelvis (tailbone tucked under)",
    "Don't let hips sag or pike up — keep the line",
  ],
  coreFlex: [
    "Focus on the contraction — exhale at the top of the rep",
    "Don't pull on your neck; keep chin neutral",
    "Slow the eccentric — control all the way back",
  ],
  coreRot: [
    "Rotate through the rib cage, not the lumbar spine",
    "Hips and pelvis stay stable — only the upper body turns",
    "Controlled tempo — speed comes from the obliques, not momentum",
  ],
  mobility: [
    "Breathe into the stretch — exhale to deepen",
    "Hold without bouncing — at least 30 sec for tissue change",
    "Maintain alignment — quality over depth",
  ],
  shoulderIso: [
    "Lead with the elbow — wrist follows the elbow",
    "Stop just shy of full lockout to keep tension on the muscle",
    "Slow eccentrics — most growth happens on the lowering phase",
  ],
  calf: [
    "Full range — stretch down at the bottom, peak contraction up top",
    "Pause 1 sec at full plantarflexion (toes pointed)",
    "Don't bounce — control the descent",
  ],
  tgu: [
    "Eyes on the bell the entire movement",
    "Locked-out elbow stays vertical at every transition",
    "Slow and deliberate — never rush a transition",
  ],
  windmill: [
    "Hinge at the hip, not the spine — push hips back and away",
    "Top arm stays vertical; eyes lock on the weight",
    "Lower only as far as your hip and hamstring mobility allow",
  ],
  kbCircles: [
    "Initiate from the shoulders — keep the core braced",
    "Smooth, controlled tempo — no momentum-flinging",
    "Light grip — let the bell hang naturally",
  ],
  generic: [
    "Move with intent and control — every rep is practice",
    "Full range of motion — partials only when used deliberately",
    "Breathe steadily — exhale on effort, inhale on return",
  ],
};

function getFormCues(name) {
  const n = String(name).toLowerCase();
  // most specific first
  if (/turkish|get[-\s]?up/.test(n)) return FORM_CUES.tgu;
  if (/windmill/.test(n)) return FORM_CUES.windmill;
  if (/halo|figure 8|around-the-world/.test(n)) return FORM_CUES.kbCircles;
  if (/swing|snatch|clean|jerk|thruster|plyo|jump|high pull/.test(n)) return FORM_CUES.ballistic;
  if (/carry|farmer|march/.test(n)) return FORM_CUES.carry;
  if (/plank|dead bug|hollow|bird dog|superman/.test(n)) return FORM_CUES.coreAntiExt;
  if (/crunch|sit-?up|v-?up|leg raise|toes-to-bar|knee raise|flutter|scissor|toe touch/.test(n)) return FORM_CUES.coreFlex;
  if (/russian twist|wood chop|side bend/.test(n)) return FORM_CUES.coreRot;
  if (/stretch|pose|fold|cobra|cat-cow|spinal|dislocate|wall angel|scapular/.test(n)) return FORM_CUES.mobility;
  if (/curl/.test(n)) return FORM_CUES.curl;
  if (/extension|kickback|skull|pushdown|tate press/.test(n)) return FORM_CUES.triExt;
  if (/pull-?up|chin-?up|lat pulldown|muscle-up/.test(n)) return FORM_CUES.vertPull;
  if (/\brow\b|face pull|pull-?through/.test(n)) return FORM_CUES.horizPull;
  if (/overhead press|push press|z-?press|arnold|pike push|see-saw|cuban|handstand/.test(n)) return FORM_CUES.vertPress;
  if (/bench press|floor press|push-?up|fly|crush press|dip|chest press|pec deck|crossover/.test(n)) return FORM_CUES.horizPress;
  if (/deadlift|rdl|romanian|good morning|hip thrust|glute bridge|hyperextension|rack pull/.test(n)) return FORM_CUES.hinge;
  if (/lunge|step-?up|split squat|cossack/.test(n)) return FORM_CUES.lunge;
  if (/squat|wall sit|sissy/.test(n)) return FORM_CUES.squat;
  if (/shrug|upright row|lateral raise|front raise|reverse fly|y-raise|pull-apart/.test(n)) return FORM_CUES.shoulderIso;
  if (/calf/.test(n)) return FORM_CUES.calf;
  return FORM_CUES.generic;
}

function exerciseSearchUrl(name) {
  const q = encodeURIComponent(`how to ${name} form`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

function renderExerciseExtras(name) {
  const url = exerciseSearchUrl(name);
  return `
    <span class="ex-icon-row">
      <a class="ex-icon-btn" href="${url}" target="_blank" rel="noopener noreferrer" title="Watch demo on YouTube" aria-label="Watch demo">▶</a>
      <button class="ex-icon-btn" data-action="toggle-cues" title="Form cues" aria-label="Toggle form cues">ⓘ</button>
      <button class="ex-icon-btn" data-action="toggle-progress" title="Progress chart" aria-label="Toggle progress chart">📈</button>
    </span>
  `;
}

// Render a small inline SVG chart of weight × reps over time, plotted as
// estimated 1RM for weighted exercises or reps for bodyweight.
function renderProgressChart(exerciseName) {
  if (!session) return "";
  const stat = getExerciseStat(session.username, exerciseName);
  const history = stat?.history || [];

  if (history.length === 0) {
    return `
      <div class="progress-panel hidden">
        <div class="progress-empty">No log yet for this exercise — hit ✓ Log to start tracking progress.</div>
      </div>
    `;
  }

  const usesWeight = exerciseUsesWeight(exerciseName);
  const units = getPrefs(session.username).units;

  // Per-session: best e1RM for weighted, best reps for bodyweight.
  const normalized = history.map(normalizeHistoryEntry);
  const rawValues = usesWeight
    ? normalized.map(n => sessionBestE1RM(n.sets))
    : normalized.map(n => sessionBestReps(n.sets));

  if (rawValues.every(v => v === 0)) {
    return `
      <div class="progress-panel hidden">
        <div class="progress-empty">Log weight + reps to start seeing your trend.</div>
      </div>
    `;
  }

  // Display-units values (lb conversion for weighted)
  const displayValues = usesWeight
    ? rawValues.map(v => Number(toDisplay(v, units).toFixed(1)))
    : rawValues;

  const W = 320, H = 100, P = 10;
  const maxV = Math.max(...displayValues);
  const minV = Math.min(...displayValues);
  const range = (maxV - minV) || maxV || 1;
  const n = displayValues.length;

  const points = displayValues.map((v, i) => {
    const x = n === 1 ? W / 2 : P + (i / (n - 1)) * (W - 2 * P);
    const y = H - P - ((v - minV) / range) * (H - 2 * P);
    return [x, y];
  });

  const polyline = points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaPath = n === 1
    ? ""
    : `M${points[0][0]},${H} ` +
      points.map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") +
      ` L${points[n-1][0]},${H} Z`;

  const dots = points.map((p, i) => {
    const n = normalized[i];
    const dateStr = new Date(n.date).toLocaleDateString();
    const setsSummary = n.sets.map(s => s.weightKg > 0
      ? `${toDisplay(s.weightKg, units)} ${units}×${s.reps}`
      : `${s.reps} reps`).join(", ");
    const tooltip = usesWeight
      ? `${setsSummary}  ·  best e1RM ${displayValues[i]}  ·  ${dateStr}`
      : `${setsSummary}  ·  ${dateStr}`;
    return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--accent)"><title>${escapeAttr(tooltip)}</title></circle>`;
  }).join("");

  const valueLabel = usesWeight ? `Est. 1RM (${units})` : "Max reps";
  const bestStr = usesWeight ? `Best: ${maxV} ${units}` : `Best: ${maxV} reps`;
  const first = displayValues[0];
  const last = displayValues[n - 1];
  const trend = n > 1 ? ((last - first) / Math.max(first, 1)) * 100 : 0;
  const trendCls = trend > 0.5 ? "up" : trend < -0.5 ? "down" : "";
  const trendStr = n < 2
    ? "log again for trend"
    : trend >= 0 ? `↑ +${trend.toFixed(1)}%` : `↓ ${trend.toFixed(1)}%`;
  const dateRange = n > 1
    ? `${new Date(normalized[0].date).toLocaleDateString()} → ${new Date(normalized[n-1].date).toLocaleDateString()}`
    : new Date(normalized[0].date).toLocaleDateString();

  return `
    <div class="progress-panel hidden">
      <div class="progress-header">
        <span class="progress-label">${valueLabel}</span>
        <span class="progress-best">${bestStr}</span>
      </div>
      <svg class="progress-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Progress chart">
        ${areaPath ? `<path d="${areaPath}" fill="var(--accent-soft)" />` : ""}
        ${n > 1 ? `<polyline points="${polyline}" fill="none" stroke="var(--accent)" stroke-width="2"/>` : ""}
        ${dots}
      </svg>
      <div class="progress-stats">
        <span class="progress-stat">${n} session${n > 1 ? "s" : ""}</span>
        <span class="progress-stat ${trendCls}">${trendStr}</span>
        <span class="progress-stat dim">${dateRange}</span>
      </div>
    </div>
  `;
}

function renderFormCues(name) {
  const cues = getFormCues(name);
  return `
    <div class="form-cues hidden">
      <h4>Form cues</h4>
      <ul>${cues.map(c => `<li>${c}</li>`).join("")}</ul>
    </div>
  `;
}

// ─── WAKE LOCK ───────────────────────────────────────────────────────────
// Keep the screen on during Guided Mode so the phone doesn't lock mid-set.
let wakeLockSentinel = null;

async function acquireWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => { wakeLockSentinel = null; });
  } catch { /* permission denied or unsupported context — ignore */ }
}

async function releaseWakeLock() {
  if (!wakeLockSentinel) return;
  try { await wakeLockSentinel.release(); } catch {}
  wakeLockSentinel = null;
}

// Reacquire if the tab returned to the foreground while guided mode is active.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && guided.active && !wakeLockSentinel) {
    acquireWakeLock();
  }
});

// ─── GUIDED MODE ─────────────────────────────────────────────────────────
const guided = { active: false, exIdx: 0, set: 1 };
const guidedSession = {
  startTime: 0,
  setsDone: 0,
  setsSkipped: 0,
  exercisesCompleted: 0,
  volumeKg: 0,
  prs: [],
};

function resetGuidedSession() {
  guidedSession.startTime = Date.now();
  guidedSession.setsDone = 0;
  guidedSession.setsSkipped = 0;
  guidedSession.exercisesCompleted = 0;
  guidedSession.volumeKg = 0;
  guidedSession.prs = [];
  guidedSession.exerciseSets = {}; // { exName → [{weightKg, reps}, ...] }
}

function startGuidedMode() {
  if (!currentWorkout || !currentWorkout.exercises.length) return;
  guided.active = true;
  guided.exIdx = 0;
  guided.set = 1;
  // Starting a guided session is "doing the workout now" — clear any
  // read-only flag so logs apply to today's stats.
  workoutReadOnly = false;
  workoutIsSaved = false;
  recentlyLogged = {};
  resetGuidedSession();
  acquireWakeLock();
  showApp("guided");
  renderGuided();
}

function exitGuided() {
  guided.active = false;
  stopRestTimer(true);
  releaseWakeLock();
  showApp("generator");
}

function getSection(pattern) {
  if (pattern === "mobility") return t("guided.warmup");
  if (pattern === "ballistic") return t("guided.power");
  if (pattern === "conditioning") return t("guided.conditioning");
  return t("guided.mainWork");
}

function renderGuided() {
  if (!currentWorkout) return exitGuided();
  const total = currentWorkout.exercises.length;
  if (guided.exIdx >= total) return finishGuidedWorkout();

  const ex = currentWorkout.exercises[guided.exIdx];
  const isLastSet = guided.set >= ex.sets;
  const isLastExercise = guided.exIdx >= total - 1;
  const trackable = isTrackable(ex.name);
  const usesWeight = exerciseUsesWeight(ex.name);
  const units = getPrefs(session.username).units;
  const suggestion = trackable
    ? getSuggestion(session.username, ex.name, ex, ex.pattern, currentWorkout?.inputs?.goal)
    : { last: null, next: null, trend: null };

  // Update top progress bar
  const progress = ((guided.exIdx + (guided.set - 1) / Math.max(1, ex.sets)) / total) * 100;
  document.getElementById("guidedExNum").textContent = guided.exIdx + 1;
  document.getElementById("guidedExTotal").textContent = total;
  document.getElementById("guidedProgressFill").style.width = `${Math.min(100, progress)}%`;

  // Last-session line
  let lastLine = "";
  if (suggestion.last) {
    const w = suggestion.last.weightKg
      ? `${toDisplay(suggestion.last.weightKg, units)} ${units}` : "bw";
    const trendLabel = suggestion.trend === "up" ? `↑ ${t("wo.progress")}`
      : suggestion.trend === "down" ? `↓ ${t("wo.deload")}` : `· ${t("wo.pushReps")}`;
    lastLine = `<div class="guided-last">${t("guided.last")} <strong>${
      usesWeight ? `${w} × ${suggestion.last.reps}` : `${suggestion.last.reps} reps`
    }</strong> &nbsp;${trendLabel}</div>`;
  }

  // Inputs visible on every set so the user can log per-set actuals.
  // Pre-fill: carry the previous set's values forward, or use progression
  // suggestion on the very first set.
  let inputsHtml = "";
  if (trackable) {
    const buffered = guidedSession.exerciseSets?.[ex.name] || [];
    const prevSet = buffered[buffered.length - 1];
    const sugW = prevSet
      ? toDisplay(prevSet.weightKg, units)
      : (suggestion.next ? toDisplay(suggestion.next.weightKg, units) : "");
    const sugR = prevSet
      ? prevSet.reps
      : (suggestion.next ? suggestion.next.reps : parseRepRange(ex.reps)[0]);
    inputsHtml = `
      <div class="guided-log-row">
        ${usesWeight ? `
          <label class="log-field">
            <input type="number" id="guidedWeight" min="0" step="${units === "lb" ? 5 : 2.5}" value="${sugW || ""}" placeholder="weight"/>
            <span class="log-field-suffix">${units}</span>
          </label>` : ""}
        <label class="log-field">
          <input type="number" id="guidedReps" min="0" step="1" value="${sugR || ""}" placeholder="reps"/>
          <span class="log-field-suffix">reps</span>
        </label>
      </div>
      <div class="guided-rir-row" title="Reps In Reserve — how many reps left in the tank? 0 = to failure, 3+ = easy">
        <span class="guided-rir-label">RIR</span>
        <div class="rir-picker" id="guidedRirPicker">
          ${[0, 1, 2, 3, 4].map(n =>
            `<button type="button" class="rir-btn" data-rir="${n}">${n}</button>`
          ).join("")}
        </div>
      </div>
    `;
  }

  // Technique badge
  let techHtml = "";
  if (ex.technique) {
    techHtml = `
      <div class="guided-technique-badge">⚡ ${ex.technique.name.toUpperCase()}</div>
      <div class="guided-technique-note">${ex.technique.note}</div>
    `;
  }

  const muscleStr = ex.muscle.map(m => m.replace("_", " ")).join(" · ");
  const doneLabel = isLastSet
    ? (isLastExercise ? t("guided.finish") : t("guided.doneNext"))
    : t("guided.doneSet");

  const inGroup = !!ex.groupId;
  const positionLetter = inGroup ? String.fromCharCode(65 + (ex.groupPosition || 0)) : "";
  const groupContext = inGroup
    ? `<div class="guided-group-context">${ex.groupSize === 2 ? "SUPERSET" : "CIRCUIT"} · POSITION ${positionLetter} of ${ex.groupSize}</div>`
    : "";
  const setLabel = inGroup ? t("guided.round") : t("guided.set");

  // Time-based exercise? (planks, holds, cardio blocks, mobility holds, etc.)
  // Show a "Start timer" button that runs a countdown using the same bottom
  // bar as the rest timer. Without this, Guided Mode left the user with no
  // way to time these sets — they had to use a phone clock.
  const setTimeSec = parseTimeReps(ex.reps);
  const timerHtml = setTimeSec
    ? `<div class="guided-timer-row">
        <button class="primary-btn timer-btn" data-guided-action="start-set-timer" data-duration="${setTimeSec}">
          ▶ ${t("guided.startTimer")} · ${formatSecs(setTimeSec)}
        </button>
      </div>`
    : "";

  // For time-based exercises the reps "input" doesn't make sense (user can't
  // type "30 sec" as a number). Show repsHtml but hide the inputs row when
  // we already have a timer — the auto-fill on Done Set covers it.
  const inputsBlock = setTimeSec ? "" : inputsHtml;

  document.getElementById("guidedContent").innerHTML = `
    <div class="guided-section-badge">${getSection(ex.pattern)}</div>
    ${groupContext}
    <h2 class="guided-exercise-name">${ex.name}</h2>
    <div class="guided-muscle">${muscleStr}</div>
    <div class="guided-icon-row">${renderExerciseExtras(ex.name)}</div>
    ${renderFormCues(ex.name)}
    ${renderProgressChart(ex.name)}
    ${techHtml}

    <div class="guided-set-block">
      <div class="guided-set-num">
        <span class="guided-set-label">${setLabel}</span>
        <span class="guided-set-big">${guided.set}</span>
        <span class="guided-set-of">${t("guided.of")} ${ex.sets}</span>
      </div>
      <div class="guided-target"><strong>${displayReps(ex)}</strong>${setTimeSec ? "" : ` ${t("guided.reps")}`} · ${inGroup ? (ex.groupSize === 2 ? t("guided.restAfterPair") : t("guided.restAfterCircuit")) : `${t("wo.rest")} <strong>${ex.rest}s</strong>`}</div>
    </div>

    ${lastLine}
    ${timerHtml}
    ${inputsBlock}

    <div class="guided-actions">
      <button class="primary-btn big" data-guided-action="done">${doneLabel}</button>
      <button class="ghost-btn" data-guided-action="skip">${isLastSet ? t("guided.skipExercise") : t("guided.skipSet")}</button>
    </div>
  `;

  document.querySelector("[data-guided-action='done']").addEventListener("click", onDoneSet);
  document.querySelector("[data-guided-action='skip']").addEventListener("click", onSkipSet);
  // Wire set-timer for time-based exercises in Guided Mode
  document.querySelectorAll("[data-guided-action='start-set-timer']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const seconds = parseInt(btn.dataset.duration, 10) || 30;
      startRestTimer(seconds, `${t("guided.setTimerLabel")} — ${ex.name}`);
    });
  });
  // Wire guided RIR picker (single-select, toggle off on re-click)
  document.querySelectorAll("#guidedRirPicker .rir-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const wasActive = btn.classList.contains("active");
      document.querySelectorAll("#guidedRirPicker .rir-btn").forEach(b => b.classList.remove("active"));
      if (!wasActive) btn.classList.add("active");
    });
  });
  // Wire form-cues + progress chart toggles inside the guided card
  document.querySelectorAll("#guidedContent [data-action='toggle-cues']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const panel = btn.closest(".guided-card")?.querySelector(".form-cues");
      if (panel) panel.classList.toggle("hidden");
      btn.classList.toggle("active");
    });
  });
  document.querySelectorAll("#guidedContent [data-action='toggle-progress']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const panel = btn.closest(".guided-card")?.querySelector(".progress-panel");
      if (panel) panel.classList.toggle("hidden");
      btn.classList.toggle("active");
    });
  });
}

function onDoneSet() {
  if (!currentWorkout) return;
  const ex = currentWorkout.exercises[guided.exIdx];
  if (!ex) return finishGuidedWorkout();

  const trackable = isTrackable(ex.name);
  const usesWeight = exerciseUsesWeight(ex.name);
  const units = getPrefs(session.username).units;

  // ── Group-aware advance logic ────────────────────────────────────────
  // For a superset/circuit, sets count at the ROUND level. Within a round,
  // we step through each position (A→B[→C]) with no rest. After the last
  // position, rest, then start the next round at position A.
  const inGroup = !!ex.groupId;
  const groupSize = ex.groupSize || 1;
  const positionInGroup = ex.groupPosition || 0;
  const isLastInGroup = !inGroup || positionInGroup === groupSize - 1;
  const isLastSet = guided.set >= ex.sets;
  const isLastSetOfGroup = isLastInGroup && isLastSet;

  // Always capture this set's actuals into a per-exercise buffer. We log
  // the full sets[] array when the exercise (or group) completes so each
  // session has one history entry with all the work in it.
  if (trackable) {
    const rEl = document.getElementById("guidedReps");
    const wEl = document.getElementById("guidedWeight");
    const rirBtn = document.querySelector("#guidedRirPicker .rir-btn.active");
    const reps = Number(rEl?.value || 0);
    if (reps > 0) {
      const weightDisplay = wEl ? Number(wEl.value || 0) : 0;
      const weightKg = wEl ? fromDisplay(weightDisplay, units) : 0;
      const setEntry = { weightKg, reps };
      if (rirBtn) {
        const rir = Number(rirBtn.dataset.rir);
        if (!Number.isNaN(rir)) setEntry.rir = rir;
      }
      if (!guidedSession.exerciseSets[ex.name]) guidedSession.exerciseSets[ex.name] = [];
      guidedSession.exerciseSets[ex.name].push(setEntry);
    }
  }

  guidedSession.setsDone += 1;
  if (isLastSet) guidedSession.exercisesCompleted += 1;

  // Flush the per-exercise buffer when we're about to leave that exercise
  // for good. For singles: at the last set. For groups: when the whole
  // group completes (last position of last round).
  const flushNow = isLastSet && (!inGroup || isLastSetOfGroup);
  if (flushNow) {
    const namesToFlush = inGroup
      ? currentWorkout.exercises.filter(e => e.groupId === ex.groupId).map(e => e.name)
      : [ex.name];
    for (const name of namesToFlush) {
      const setsToLog = guidedSession.exerciseSets[name];
      if (!setsToLog || setsToLog.length === 0) continue;
      const result = logExercise(session.username, name, setsToLog);
      if (result.pr) {
        const bestSet = setsToLog.reduce((b, s) =>
          calculateE1RM(s.weightKg, s.reps) > calculateE1RM(b.weightKg, b.reps) ? s : b, setsToLog[0]);
        guidedSession.prs.push({ name, weightKg: bestSet.weightKg, reps: bestSet.reps });
      }
      const vol = setsToLog.reduce((sum, s) => sum + (s.weightKg || 0) * (s.reps || 0), 0);
      guidedSession.volumeKg += vol;
      delete guidedSession.exerciseSets[name];
    }
  }

  // Within a group round (not at last position): jump to next position, NO rest.
  if (inGroup && !isLastInGroup) {
    guided.exIdx += 1;
    renderGuided();
    return;
  }

  // At last position OR a single exercise: rest now.
  if (ex.rest > 0) {
    const label = inGroup ? t("guided.restGroup") : `${t("rest.label")} — ${ex.name}`;
    startRestTimer(ex.rest, label);
  }

  // If we're NOT at the last set of this exercise/group: stay on this
  // exercise (for groups, loop back to position A) and bump the set counter.
  if (!isLastSet) {
    if (inGroup) guided.exIdx = guided.exIdx - (groupSize - 1);
    guided.set += 1;
    renderGuided();
    return;
  }

  // All sets done for this exercise/group: move to the next exercise (or finish).
  if (guided.exIdx >= currentWorkout.exercises.length - 1) return finishGuidedWorkout();
  guided.exIdx += 1;
  guided.set = 1;
  renderGuided();
}

function onSkipSet() {
  if (!currentWorkout) return;
  const ex = currentWorkout.exercises[guided.exIdx];
  if (!ex) return finishGuidedWorkout();
  guidedSession.setsSkipped += 1;

  // In a group: skip jumps past the entire group (simpler + predictable).
  if (ex.groupId) {
    let idx = guided.exIdx;
    while (idx < currentWorkout.exercises.length && currentWorkout.exercises[idx].groupId === ex.groupId) {
      idx++;
    }
    if (idx >= currentWorkout.exercises.length) return finishGuidedWorkout();
    guided.exIdx = idx;
    guided.set = 1;
    renderGuided();
    return;
  }

  const isLastSet = guided.set >= ex.sets;
  const isLastExercise = guided.exIdx >= currentWorkout.exercises.length - 1;
  if (isLastSet) {
    if (isLastExercise) return finishGuidedWorkout();
    guided.exIdx += 1;
    guided.set = 1;
  } else {
    guided.set += 1;
  }
  renderGuided();
}

function finishGuidedWorkout() {
  stopRestTimer(true);
  if (!workoutIsSaved && session && currentWorkout) {
    addWorkout(session.username, currentWorkout);
    workoutIsSaved = true;
  }
  document.getElementById("guidedProgressFill").style.width = "100%";

  const durationSec = Math.max(1, Math.round((Date.now() - guidedSession.startTime) / 1000));
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const durationStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const units = getPrefs(session.username).units;
  const totalEx = currentWorkout.exercises.length;
  const volumeDisplay = guidedSession.volumeKg > 0
    ? `${Math.round(toDisplay(guidedSession.volumeKg, units)).toLocaleString()} ${units}`
    : "—";

  // Collect muscles trained in this workout for the soreness prompt
  const trainedMuscles = new Set();
  currentWorkout.exercises.forEach(ex => {
    if (ex.pattern === "mobility") return;
    ex.muscle.forEach(m => trainedMuscles.add(m));
  });
  const muscleList = Array.from(trainedMuscles).filter(m => m !== "full_body");
  const sorenessHtml = muscleList.length ? `
    <h3 class="summary-prs-title">How sore are you?</h3>
    <div class="soreness-grid">
      ${muscleList.map(m => `
        <div class="soreness-row" data-muscle="${m}">
          <span class="soreness-muscle">${m.replace("_", " ")}</span>
          <div class="soreness-buttons">
            <button class="soreness-btn" data-level="0" title="Not sore">😌</button>
            <button class="soreness-btn" data-level="1" title="A bit sore">😐</button>
            <button class="soreness-btn" data-level="2" title="Properly sore">😣</button>
            <button class="soreness-btn" data-level="3" title="Wrecked">😱</button>
          </div>
        </div>
      `).join("")}
    </div>
  ` : "";

  const prsHtml = guidedSession.prs.length ? `
    <h3 class="summary-prs-title">🏆 New Personal Records</h3>
    <ul class="summary-prs">
      ${guidedSession.prs.map(pr => {
        const w = pr.weightKg > 0
          ? `${toDisplay(pr.weightKg, units)} ${units} × ${pr.reps}`
          : `${pr.reps} reps`;
        return `<li><strong>${pr.name}</strong> — ${w}</li>`;
      }).join("")}
    </ul>` : "";

  document.getElementById("guidedContent").innerHTML = `
    <div class="guided-celebration">
      <div class="guided-celebration-icon">🏆</div>
      <h2 class="guided-exercise-name">Workout Complete</h2>
      <div class="guided-muscle">Logged and saved to history.</div>

      <div class="summary-stats">
        <div class="summary-stat">
          <div class="summary-stat-label">Duration</div>
          <div class="summary-stat-value">${durationStr}</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-label">Exercises</div>
          <div class="summary-stat-value">${guidedSession.exercisesCompleted}<span class="summary-stat-sub">/${totalEx}</span></div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-label">Sets</div>
          <div class="summary-stat-value">${guidedSession.setsDone}${guidedSession.setsSkipped ? `<span class="summary-stat-sub"> (+${guidedSession.setsSkipped} skipped)</span>` : ""}</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-label">Volume</div>
          <div class="summary-stat-value">${volumeDisplay}</div>
        </div>
      </div>

      ${prsHtml}

      <h3 class="summary-prs-title">How was that?</h3>
      <div class="rpe-prompt" id="rpePrompt">
        <button class="rpe-btn" data-rpe="1"><span class="rpe-emoji">😎</span><span class="rpe-label">Easy</span></button>
        <button class="rpe-btn" data-rpe="2"><span class="rpe-emoji">🙂</span><span class="rpe-label">Light</span></button>
        <button class="rpe-btn" data-rpe="3"><span class="rpe-emoji">😤</span><span class="rpe-label">Right effort</span></button>
        <button class="rpe-btn" data-rpe="4"><span class="rpe-emoji">😣</span><span class="rpe-label">Hard</span></button>
        <button class="rpe-btn" data-rpe="5"><span class="rpe-emoji">🥵</span><span class="rpe-label">Maxed</span></button>
      </div>

      ${sorenessHtml}

      <div class="guided-actions">
        <button class="primary-btn big" id="guidedFinishBtn">Done</button>
      </div>
    </div>
  `;
  document.getElementById("guidedFinishBtn").addEventListener("click", exitGuided);

  // Wire RPE buttons
  document.querySelectorAll(".rpe-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const rpe = Number(btn.dataset.rpe);
      if (!currentWorkout) return;
      currentWorkout.rpe = rpe;
      if (workoutIsSaved && session?.username) {
        updateWorkout(session.username, currentWorkout.id, { rpe });
      }
      document.querySelectorAll(".rpe-btn").forEach(b =>
        b.classList.toggle("selected", b === btn));
    });
  });

  // Wire soreness buttons
  document.querySelectorAll(".soreness-row").forEach(row => {
    const muscle = row.dataset.muscle;
    row.querySelectorAll(".soreness-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const level = Number(btn.dataset.level);
        setSoreness(session.username, muscle, level);
        row.querySelectorAll(".soreness-btn").forEach(b =>
          b.classList.toggle("selected", b === btn));
      });
    });
  });
}

document.getElementById("guidedExitBtn").addEventListener("click", () => {
  if (confirm("Exit the workout? Your progress so far is saved.")) exitGuided();
});

// ─── REST TIMER ──────────────────────────────────────────────────────────
const restTimer = {
  total: 0,
  remaining: 0,
  intervalId: null,
  paused: false,
};

function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function startRestTimer(seconds, label = "Rest") {
  stopRestTimer(true);
  restTimer.total = seconds;
  restTimer.remaining = seconds;
  restTimer.paused = false;

  const root = document.getElementById("restTimer");
  root.classList.remove("hidden", "urgent", "done");
  document.getElementById("restTimerLabel").textContent = label;
  document.getElementById("restTimerTotal").textContent = formatTime(seconds);
  updateRestTimerUI();

  const pauseBtn = document.getElementById("restPauseBtn");
  pauseBtn.textContent = "Pause";
  pauseBtn.classList.add("primary");

  restTimer.intervalId = setInterval(tickRestTimer, 1000);
}

function tickRestTimer() {
  if (restTimer.paused) return;
  restTimer.remaining -= 1;
  if (restTimer.remaining <= 0) {
    restTimer.remaining = 0;
    finishRestTimer();
  }
  updateRestTimerUI();
}

function updateRestTimerUI() {
  const root = document.getElementById("restTimer");
  const remaining = Math.max(0, restTimer.remaining);
  const total = Math.max(1, restTimer.total);
  document.getElementById("restTimerTime").textContent = formatTime(remaining);
  document.getElementById("restTimerTotal").textContent = formatTime(restTimer.total);
  document.getElementById("restTimerFill").style.width = `${(remaining / total) * 100}%`;
  // Urgent style in final 10s
  root.classList.toggle("urgent", remaining > 0 && remaining <= 10);
}

function finishRestTimer() {
  clearInterval(restTimer.intervalId);
  restTimer.intervalId = null;
  const root = document.getElementById("restTimer");
  root.classList.remove("urgent");
  root.classList.add("done");
  playChime();
  // Auto-hide after a few seconds
  setTimeout(() => {
    if (restTimer.remaining === 0) stopRestTimer(false);
  }, 4000);
}

function stopRestTimer(immediate) {
  if (restTimer.intervalId) clearInterval(restTimer.intervalId);
  restTimer.intervalId = null;
  const root = document.getElementById("restTimer");
  if (immediate) {
    root.classList.add("hidden");
    root.classList.remove("urgent", "done");
  } else {
    root.classList.add("hidden");
    root.classList.remove("urgent", "done");
  }
}

function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const playTone = (freq, when, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + dur + 0.05);
    };
    playTone(660, 0,    0.18);
    playTone(880, 0.2,  0.25);
  } catch {}
}

document.querySelectorAll("[data-rest-action]").forEach(btn => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.restAction;
    if (action === "skip") return stopRestTimer(true);
    if (action === "plus") {
      restTimer.total += 15;
      restTimer.remaining += 15;
      return updateRestTimerUI();
    }
    if (action === "minus") {
      restTimer.remaining = Math.max(0, restTimer.remaining - 15);
      if (restTimer.remaining === 0) return finishRestTimer();
      return updateRestTimerUI();
    }
    if (action === "pause") {
      restTimer.paused = !restTimer.paused;
      const pauseBtn = document.getElementById("restPauseBtn");
      pauseBtn.textContent = restTimer.paused ? "Resume" : "Pause";
    }
  });
});

// Show a shared workout (from a #w= hash) on the generator view. Read-only.
function showSharedWorkout(workout) {
  currentWorkout = workout;
  workoutIsSaved = false;
  workoutReadOnly = true;
  recentlyLogged = {};
  showApp("generator");
  el.workoutResult.classList.remove("hidden");
  // Banner-style hint above the workout card
  const existingHint = document.getElementById("sharedHint");
  if (existingHint) existingHint.remove();
  const hint = document.createElement("div");
  hint.id = "sharedHint";
  hint.className = "shared-hint";
  hint.innerHTML = `
    <div class="shared-hint-title">Shared workout</div>
    <div class="shared-hint-body">Someone shared this session with you. Tap <strong>Save</strong> to add it to your library, or <strong>▶ Start Workout</strong> to run it right now.</div>
    <button class="primary-btn" id="saveSharedBtn">Save to my library</button>
  `;
  el.workoutResult.parentElement.insertBefore(hint, el.workoutResult);
  renderWorkout(workout, el.workoutResult, { showSave: false });
  attachWorkoutActions();
  document.getElementById("saveSharedBtn").addEventListener("click", () => {
    if (!session) return;
    // Clone with fresh id + timestamp so it owns the entry
    const cloned = { ...workout, id: `w_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, createdAt: Date.now(), isShared: false };
    addWorkout(session.username, cloned);
    workoutIsSaved = true;
    workoutReadOnly = false;
    currentWorkout = cloned;
    hint.remove();
    history.replaceState(null, "", location.pathname);
    renderWorkout(cloned, el.workoutResult, { showSave: false });
    attachWorkoutActions();
  });
}

// ─── INIT ────────────────────────────────────────────────────────────────
async function bootstrap() {
  // Always render the cloud status pill at boot, regardless of which path
  // bootstrap takes. Diagnostic value: if anything else errors, the pill
  // still tells you what state the app is in.
  try {
    const status = getCloudStatus();
    const cs = document.getElementById("cloudStatus");
    if (cs) {
      cs.textContent = status.text;
      cs.className = `cloud-status cloud-status-${status.mode}`;
    }
  } catch (e) { console.warn("FORGE: cloud status render failed", e); }

  // Detect a shared-workout link first — process AFTER auth so it shows once
  // the user is in. Stash for now.
  sharedWorkoutPending = decodeSharedWorkoutFromHash();

  // Auth UI label tweak when running in cloud mode.
  if (HAS_SUPABASE) {
    const usernameLabel = el.username.closest("label");
    if (usernameLabel) {
      const text = Array.from(usernameLabel.childNodes).find(n => n.nodeType === 3);
      if (text) text.textContent = "\n            Email\n            ";
      el.username.type = "email";
      el.username.autocomplete = "email";
      el.username.removeAttribute("minlength");
      el.username.removeAttribute("maxlength");
    }
    // Show 'Forgot password?' under the login form by default (mode = login).
    const forgot = document.getElementById("forgotPasswordBtn");
    if (forgot) forgot.classList.remove("hidden");

    // Password recovery flow: Supabase appends #access_token=...&type=recovery
    // to the redirect. If we see that, show the reset form instead of login.
    if (location.hash.includes("type=recovery") || location.hash.includes("access_token")) {
      try {
        // The SDK reads the hash automatically; give it a tick.
        await new Promise(r => setTimeout(r, 200));
        const { data } = await sb.auth.getSession();
        if (data?.session) {
          // Show reset-password form
          document.querySelector(".auth-tabs")?.classList.add("hidden");
          document.getElementById("authForm")?.classList.add("hidden");
          document.getElementById("resetForm")?.classList.remove("hidden");
          el.authView.classList.remove("hidden");
          el.nav.classList.add("hidden");
          return;
        }
      } catch {}
    }
  }

  if (HAS_SUPABASE) {
    // Restore Supabase session if one exists.
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session) {
        const user = data.session.user;
        session = {
          username: user.email,
          userId: user.id,
          loggedInAt: Date.now(),
        };
        save(STORAGE_KEYS.session, session);
        // Background sync — don't block app load on slow networks.
        syncFromCloud().catch(() => {});
        showApp("generator");
        if (sharedWorkoutPending) {
          showSharedWorkout(sharedWorkoutPending);
          sharedWorkoutPending = null;
        }
        return;
      }
    } catch {}
    showAuth();
    return;
  }

  // Local-only mode: existing localStorage session path.
  if (session && getUsers()[session.username]) {
    showApp("generator");
    if (sharedWorkoutPending) {
      showSharedWorkout(sharedWorkoutPending);
      sharedWorkoutPending = null;
    }
  } else {
    session = null;
    localStorage.removeItem(STORAGE_KEYS.session);
    showAuth();
  }
}
bootstrap();

// ─── SERVICE WORKER REGISTRATION ────────────────────────────────────────
// Enables PWA install + offline support. SW won't register on file:// — only
// http(s) — so local double-click of index.html silently skips this.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Registration may fail in unsupported environments — ignore.
    });
  });
}
