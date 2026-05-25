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
};

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
}
function deleteWorkout(userId, workoutId) {
  const all = load(STORAGE_KEYS.workouts, {});
  if (!all[userId]) return;
  all[userId] = all[userId].filter(w => w.id !== workoutId);
  save(STORAGE_KEYS.workouts, all);
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

function isPR(weightKg, reps, history) {
  if (!history || history.length === 0) return false; // baseline is not a PR
  if (weightKg > 0) {
    const newE1 = calculateE1RM(weightKg, reps);
    const bestE1 = history.reduce((m, h) => Math.max(m, calculateE1RM(h.weightKg, h.reps)), 0);
    return newE1 > bestE1 + 0.01; // small epsilon to avoid float ties
  }
  const bestReps = history.reduce((m, h) => Math.max(m, h.reps || 0), 0);
  return reps > bestReps;
}

function logExercise(userId, exName, { weightKg, reps }) {
  const all = load(STORAGE_KEYS.stats, {});
  if (!all[userId]) all[userId] = {};
  const existing = all[userId][exName] || { history: [] };
  const pr = isPR(Number(weightKg) || 0, Number(reps) || 0, existing.history);
  const entry = {
    weightKg: Number(weightKg) || 0,
    reps: Number(reps) || 0,
    date: Date.now(),
  };
  existing.weightKg = entry.weightKg;
  existing.reps = entry.reps;
  existing.date = entry.date;
  existing.history = (existing.history || []).concat([entry]).slice(-30);
  all[userId][exName] = existing;
  save(STORAGE_KEYS.stats, all);
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
}

// ─── EQUIPMENT LOADS ─────────────────────────────────────────────────────
// All loads stored in kg internally.
function getLoads(userId) {
  const all = load(STORAGE_KEYS.loads, {});
  return all[userId] || { maxDumbbellKg: 0, maxKettlebellKg: 0, hasHeavyBarbell: false };
}
function setLoads(userId, loads) {
  const all = load(STORAGE_KEYS.loads, {});
  all[userId] = { ...getLoads(userId), ...loads };
  save(STORAGE_KEYS.loads, all);
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
    reason = "You haven't selected any equipment that can be loaded heavy (barbell, dumbbells, kettlebell, or machine).";
  } else if (maxDB === 0 && maxKB === 0) {
    reason = "You haven't told us how heavy your dumbbells / kettlebells go. Set this in Settings for accurate recommendations.";
  } else {
    const units = session ? getPrefs(session.username).units : "kg";
    const limit = Math.max(maxDB, maxKB);
    reason = `Your heaviest available weight (${toDisplay(limit, units)} ${units}) is too light for ${difficulty} strength training.`;
  }

  return {
    reason,
    recommendation: "Switch to Hypertrophy or Endurance — with limited load, high-volume training is where you'll actually grow.",
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

function getSuggestion(userId, exerciseName, prescription, pattern) {
  const stat = getExerciseStat(userId, exerciseName);
  if (!stat) return { last: null, next: null, trend: null };

  const [lo, hi] = parseRepRange(prescription.reps);
  const usesWeight = exerciseUsesWeight(exerciseName);
  const inc = progressionIncrementKg(pattern);

  const lastReps = stat.reps;
  const lastKg = stat.weightKg;

  let nextKg = lastKg;
  let nextReps = lastReps;
  let trend = "same";

  if (lo > 0 && lastReps >= hi) {
    if (usesWeight) { nextKg = lastKg + inc; nextReps = lo; }
    else { nextReps = lastReps + 1; }
    trend = "up";
  } else if (lo > 0 && lastReps < lo) {
    if (usesWeight) { nextKg = Math.max(0, lastKg - inc); nextReps = Math.round((lo + hi) / 2); }
    else { nextReps = Math.max(1, lastReps - 1); }
    trend = "down";
  } else {
    // In range or time-based — push for one more rep at same weight.
    if (lo > 0) nextReps = Math.min(hi, Math.max(lo, lastReps + 1));
    trend = "same";
  }

  return {
    last: { weightKg: lastKg, reps: lastReps, date: stat.date },
    next: { weightKg: nextKg, reps: nextReps },
    trend,
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
  loadWarning: document.getElementById("loadWarning"),
  authForm: document.getElementById("authForm"),
  authSubmit: document.getElementById("authSubmit"),
  authError: document.getElementById("authError"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  generateBtn: document.getElementById("generateBtn"),
  formError: document.getElementById("formError"),
  workoutResult: document.getElementById("workoutResult"),
  historyList: document.getElementById("historyList"),
};

// ─── ROUTING / VIEWS ─────────────────────────────────────────────────────
function showAuth() {
  el.nav.classList.add("hidden");
  el.authView.classList.remove("hidden");
  el.generatorView.classList.add("hidden");
  el.historyView.classList.add("hidden");
}
function showApp(view = "generator") {
  el.nav.classList.toggle("hidden", view === "guided");
  el.authView.classList.add("hidden");
  el.userLabel.textContent = session.username;
  applyUnitsButtons();
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  el.generatorView.classList.toggle("hidden", view !== "generator");
  el.historyView.classList.toggle("hidden", view !== "history");
  el.settingsView.classList.toggle("hidden", view !== "settings");
  el.guidedView.classList.toggle("hidden", view !== "guided");
  if (view === "history") renderHistory();
  if (view === "settings") renderSettings();
  if (view === "generator") refreshLoadWarning();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showApp(btn.dataset.view));
});

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
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    authMode = tab.dataset.tab;
    el.authSubmit.textContent = authMode === "login" ? "Log in" : "Create account";
    el.password.setAttribute("autocomplete", authMode === "login" ? "current-password" : "new-password");
    el.authError.textContent = "";
  });
});

el.authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  el.authError.textContent = "";
  const username = el.username.value.trim().toLowerCase();
  const password = el.password.value;
  if (!username || !password) return;

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

  // login
  const user = users[username];
  if (!user || user.passwordHash !== hashPassword(password, user.salt)) {
    el.authError.textContent = "Invalid username or password.";
    return;
  }
  session = { username, loggedInAt: Date.now() };
  save(STORAGE_KEYS.session, session);
  showApp("generator");
});

el.logoutBtn.addEventListener("click", () => {
  session = null;
  localStorage.removeItem(STORAGE_KEYS.session);
  el.username.value = "";
  el.password.value = "";
  el.workoutResult.classList.add("hidden");
  el.workoutResult.innerHTML = "";
  resetForm();
  showAuth();
});

// ─── CHIP SELECTION ──────────────────────────────────────────────────────
const formState = { goal: null, equipment: [], target: null, duration: null, difficulty: null, style: "standard" };

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
    <div class="load-warning-title">Equipment may be too light for ${difficulty} strength</div>
    <div class="load-warning-body">${issue.reason} ${issue.recommendation} <strong>Or use Intensity Mode</strong> — tempo and pause reps create real strength stimulus even at lighter loads.</div>
    <div class="load-warning-actions">
      <button class="primary-btn" data-warn-action="switch-goal" data-goal="${issue.suggestedGoal}">Switch to ${GOAL_LABELS[issue.suggestedGoal]}</button>
      <button class="secondary-btn" data-warn-action="use-intensity">Use Intensity Mode ⚡</button>
      <button class="secondary-btn" data-warn-action="open-settings">Open Settings</button>
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

function pickPrescription(goal, difficulty, exercise, style = "standard") {
  const p = PRESCRIPTIONS[goal] || PRESCRIPTIONS.hypertrophy;
  let sets = randInt(p.sets[0], p.sets[1]);
  let rest = p.rest;
  const intensity = style === "intensity";

  // Ballistic / explosive movements (KB swings, jumps, plyos) follow their own
  // template: moderate reps with explosive intent, generous rest for power
  // output. The strength rep scheme of "3-4 reps" is wrong here — swings are
  // about hip drive, not 1RM strength.
  if (exercise.pattern === "ballistic") {
    sets = difficulty === "beginner" ? 3 : difficulty === "advanced" ? 5 : 4;
    let reps;
    if (goal === "endurance") reps = "20–30";
    else if (goal === "fat_loss") reps = "15–25";
    else if (goal === "strength") reps = "5–8";   // heavy/explosive doubles up
    else reps = "10–15";                          // hypertrophy / power default
    return { sets, reps, rest: roundRest(90) };
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
  if (intensity && (exercise.pattern === "compound" || exercise.pattern === "isolation")) {
    technique = getIntensityTechnique(exercise);
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

  return { sets, reps, rest: roundRest(rest), technique };
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

// Anti-repeat memory: exercises picked in the immediately previous workout
// get penalized so Regenerate produces visibly different sessions.
let lastPickedNames = new Set();

const DIFF_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

function generateWorkout({ goal, equipment, target, duration, difficulty, style = "standard" }) {
  const count = COUNT_BY_DURATION[duration] || 6;
  const targetDiff = DIFF_ORDER[difficulty];

  // Filter by equipment + difficulty cap + target
  const candidates = EXERCISES.filter(ex => {
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

    // Anti-repeat penalty for exercises from the previous workout.
    if (lastPickedNames.has(ex.name)) score -= 9;

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
    if (picked.length >= count) break;
    const primary = ex.muscle[0];
    muscleCount[primary] = muscleCount[primary] || 0;
    if (muscleCount[primary] >= maxPerMuscle) continue;
    picked.push(ex);
    muscleCount[primary]++;
  }

  // Fill from leftovers if muscle cap left us short.
  if (picked.length < count) {
    for (const { ex } of scored) {
      if (picked.length >= count) break;
      if (!picked.includes(ex)) picked.push(ex);
    }
  }

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
    ...pickPrescription(goal, difficulty, ex, style),
  }));

  return {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    inputs: { goal, equipment, target, duration, difficulty, style },
    exercises,
  };
}

// ─── RENDERING ───────────────────────────────────────────────────────────
const GOAL_LABELS = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  fat_loss: "Fat Loss",
  endurance: "Endurance",
  mobility: "Mobility",
};
const TARGET_LABELS = {
  full_body: "Full Body",
  upper: "Upper Body",
  lower: "Lower Body",
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  core: "Core",
  cardio: "Cardio",
};
const EQUIP_LABELS = {
  bodyweight: "Bodyweight",
  dumbbells: "Dumbbells",
  barbell: "Barbell",
  kettlebell: "Kettlebell",
  bands: "Bands",
  machine: "Machine",
  cardio_machine: "Cardio Machine",
};

function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderExerciseLog(ex, units) {
  if (!session) return "";
  if (workoutReadOnly) return "";
  if (!isTrackable(ex.name)) return "";

  const usesWeight = exerciseUsesWeight(ex.name);
  const suggestion = getSuggestion(session.username, ex.name, ex, ex.pattern);
  const last = suggestion.last;
  const next = suggestion.next;
  // If the user already logged this exercise during the current viewing
  // pass, pre-fill with what they just entered (so 'edit' restores their
  // values rather than jumping to the next-session progression suggestion).
  const justLogged = recentlyLogged[ex.name];

  // Last-session pill
  let pill = "";
  if (last) {
    const w = last.weightKg ? `${toDisplay(last.weightKg, units)} ${units}` : "bw";
    const trendArrow = suggestion.trend === "up" ? "↑" : suggestion.trend === "down" ? "↓" : "·";
    const trendClass = suggestion.trend === "up" ? "up" : suggestion.trend === "down" ? "down" : "";
    pill = `<span class="last-pill">${usesWeight ? `${w} × ${last.reps}` : `${last.reps} reps`}</span>
            <span class="progress-hint ${trendClass}">${trendArrow} ${
              suggestion.trend === "up" ? "progress" :
              suggestion.trend === "down" ? "deload" :
              "push reps"
            }</span>`;
  }

  // Pre-filled inputs — prefer just-logged values over progression suggestion
  const suggestedWeight = justLogged
    ? toDisplay(justLogged.weightKg, units)
    : (next ? toDisplay(next.weightKg, units) : "");
  const suggestedReps = justLogged
    ? justLogged.reps
    : (next ? next.reps : parseRepRange(ex.reps)[0]);

  const weightField = usesWeight ? `
    <label class="log-field">
      <input type="number" inputmode="decimal" step="${units === "lb" ? 5 : 2.5}" min="0" data-log="weight"
             placeholder="weight" value="${suggestedWeight || ""}" />
      <span class="log-field-suffix">${units}</span>
    </label>` : "";

  const repsField = `
    <label class="log-field">
      <input type="number" inputmode="numeric" step="1" min="0" data-log="reps"
             placeholder="reps" value="${suggestedReps || ""}" />
      <span class="log-field-suffix">reps</span>
    </label>`;

  return `
    <div class="exercise-log" data-exercise="${escapeAttr(ex.name)}">
      ${pill}
      <div class="log-form">
        ${weightField}
        ${repsField}
        <button class="log-btn" data-action="log-set">✓ Log</button>
      </div>
    </div>
  `;
}

function renderWorkout(workout, container, { showSave = true } = {}) {
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
        ${list.map(ex => `
          <div class="exercise" data-name="${escapeAttr(ex.name)}">
            <div class="exercise-row">
              <div class="exercise-main">
                <div class="exercise-name-row">
                  <div class="exercise-name">${ex.name}</div>
                  ${renderExerciseExtras(ex.name)}
                </div>
                <div class="exercise-info">${ex.muscle.map(m => m.replace("_"," ")).join(" · ")}</div>
                ${ex.technique ? `
                  <div class="technique-badge">${ex.technique.name}</div>
                  <div class="technique-note">${ex.technique.note}</div>
                ` : ""}
                ${renderFormCues(ex.name)}
                ${renderProgressChart(ex.name)}
              </div>
              <div class="exercise-prescription">
                ${ex.sets} × ${ex.reps}<br />
                <span class="exercise-rest">rest ${ex.rest}s${workoutReadOnly ? "" : `<button class="start-rest-btn" data-action="start-rest" data-rest="${ex.rest}" data-name="${escapeAttr(ex.name)}" title="Start rest timer">⏱</button>`}</span>
              </div>
              ${workoutReadOnly ? "" : `<button class="swap-btn" data-action="swap" title="Swap for an alternative" aria-label="Swap exercise">↻</button>`}
            </div>
            ${renderExerciseLog(ex, units)}
          </div>
        `).join("")}
      </div>
    `).join("");

  const intensityFlag = inputs.style === "intensity"
    ? `<span class="intensity-flag">Intensity Mode</span>` : "";

  container.innerHTML = `
    <div class="workout-header">
      <div>
        <div class="workout-title">${TARGET_LABELS[inputs.target]} · ${GOAL_LABELS[inputs.goal]}</div>
        <div class="workout-meta">${tags} ${intensityFlag}</div>
        <div class="workout-date">${dateStr}</div>
      </div>
      <div class="workout-actions">
        <button class="primary-btn" id="startWorkoutBtn">▶ Start Workout</button>
        ${showSave ? `<button class="secondary-btn" id="saveBtn">Save</button>` : ""}
        <button class="secondary-btn" id="regenBtn">Regenerate</button>
      </div>
    </div>
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
      saveBtn.textContent = "Saved ✓";
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

  // ─── EXERCISE LOG BUTTONS ──────────────────────────────────────────────
  document.querySelectorAll("[data-action='log-set']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const logEl = btn.closest(".exercise-log");
      if (!logEl) return;
      const exName = logEl.dataset.exercise;
      const weightInput = logEl.querySelector("[data-log='weight']");
      const repsInput = logEl.querySelector("[data-log='reps']");
      const reps = Number(repsInput?.value);
      if (!reps || reps <= 0) {
        repsInput?.focus();
        return;
      }
      const units = getPrefs(session.username).units;
      const weightDisplay = weightInput ? Number(weightInput.value) : 0;
      const weightKg = weightInput ? fromDisplay(weightDisplay, units) : 0;

      const result = logExercise(session.username, exName, { weightKg, reps });
      recentlyLogged[exName] = { weightKg, reps };

      // Auto-start the rest timer using this exercise's prescribed rest.
      const ex = currentWorkout?.exercises.find(x => x.name === exName);
      if (ex && ex.rest > 0) startRestTimer(ex.rest, `Rest — ${exName}`);

      // Swap the form for a logged badge so user has visual confirmation.
      const w = weightKg ? `${toDisplay(weightKg, units)} ${units} × ${reps}` : `${reps} reps`;
      const prBadge = result.pr ? `<span class="pr-celebrate">🏆 NEW PR</span>` : "";
      logEl.innerHTML = `
        <span class="logged-badge">✓ Logged ${w}${prBadge}
          <span class="edit-link" data-action="edit-log">edit</span>
        </span>
      `;
      logEl.querySelector("[data-action='edit-log']").addEventListener("click", () => {
        // Re-render the whole workout so the new "last" data flows through suggestions.
        renderWorkout(currentWorkout, el.workoutResult, { showSave: !workoutIsSaved });
        attachWorkoutActions();
      });
    });
  });
}

// ─── HISTORY ─────────────────────────────────────────────────────────────
function renderHistory() {
  const items = getWorkouts(session.username);
  if (!items.length) {
    el.historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏋️</div>
        <div class="empty-state-title">No saved workouts yet</div>
        <div class="empty-state-sub">Generate one and hit Save to see it here.</div>
      </div>
    `;
    return;
  }

  el.historyList.innerHTML = items.map(w => `
    <div class="history-item" data-id="${w.id}">
      <div class="history-item-header">
        <div>
          <div class="history-title">${TARGET_LABELS[w.inputs.target]} · ${GOAL_LABELS[w.inputs.goal]}</div>
          <div class="workout-meta">
            <span class="tag">${w.inputs.duration} min</span>
            <span class="tag">${w.exercises.length} exercises</span>
            <span class="tag">${w.inputs.difficulty}</span>
          </div>
        </div>
        <div class="history-side">
          <span class="history-date">${new Date(w.createdAt).toLocaleDateString()}</span>
          <button class="link-btn" data-action="delete" data-id="${w.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join("");

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

// ─── SETTINGS ────────────────────────────────────────────────────────────
function renderSettings() {
  if (!session) return;
  const units = getPrefs(session.username).units;
  const loads = getLoads(session.username);

  document.querySelectorAll("[data-unit-label]").forEach(s => s.textContent = units);

  const dbInput = document.getElementById("maxDumbbell");
  const kbInput = document.getElementById("maxKettlebell");
  const bbCheck = document.getElementById("hasHeavyBarbell");

  dbInput.value = loads.maxDumbbellKg ? toDisplay(loads.maxDumbbellKg, units) : "";
  kbInput.value = loads.maxKettlebellKg ? toDisplay(loads.maxKettlebellKg, units) : "";
  bbCheck.checked = !!loads.hasHeavyBarbell;
}

document.getElementById("saveSettingsBtn").addEventListener("click", () => {
  if (!session) return;
  const units = getPrefs(session.username).units;
  const dbVal = Number(document.getElementById("maxDumbbell").value) || 0;
  const kbVal = Number(document.getElementById("maxKettlebell").value) || 0;
  setLoads(session.username, {
    maxDumbbellKg: dbVal ? fromDisplay(dbVal, units) : 0,
    maxKettlebellKg: kbVal ? fromDisplay(kbVal, units) : 0,
    hasHeavyBarbell: document.getElementById("hasHeavyBarbell").checked,
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

  // Raw values (kg-based for e1RM, integer reps for bodyweight)
  const rawValues = usesWeight
    ? history.map(h => calculateE1RM(h.weightKg, h.reps))
    : history.map(h => h.reps || 0);

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
    const h = history[i];
    const dateStr = new Date(h.date).toLocaleDateString();
    const tooltip = usesWeight
      ? `${toDisplay(h.weightKg, units)} ${units} × ${h.reps}  ·  e1RM ${displayValues[i]}  ·  ${dateStr}`
      : `${h.reps} reps  ·  ${dateStr}`;
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
    ? `${new Date(history[0].date).toLocaleDateString()} → ${new Date(history[n-1].date).toLocaleDateString()}`
    : new Date(history[0].date).toLocaleDateString();

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
  if (pattern === "mobility") return "WARM-UP / MOBILITY";
  if (pattern === "ballistic") return "POWER / BALLISTIC";
  if (pattern === "conditioning") return "CONDITIONING / FINISHER";
  return "MAIN WORK";
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
    ? getSuggestion(session.username, ex.name, ex, ex.pattern)
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
    const trendLabel = suggestion.trend === "up" ? "↑ progress"
      : suggestion.trend === "down" ? "↓ deload" : "· push reps";
    lastLine = `<div class="guided-last">Last: <strong>${
      usesWeight ? `${w} × ${suggestion.last.reps}` : `${suggestion.last.reps} reps`
    }</strong> &nbsp;${trendLabel}</div>`;
  }

  // Inputs (only on last set; intermediate sets just advance + timer)
  let inputsHtml = "";
  if (trackable && isLastSet) {
    const sugW = suggestion.next ? toDisplay(suggestion.next.weightKg, units) : "";
    const sugR = suggestion.next ? suggestion.next.reps : parseRepRange(ex.reps)[0];
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
    ? (isLastExercise ? "✓ Finish Workout" : "✓ Done Set — Next Exercise →")
    : "✓ Done Set";

  document.getElementById("guidedContent").innerHTML = `
    <div class="guided-section-badge">${getSection(ex.pattern)}</div>
    <h2 class="guided-exercise-name">${ex.name}</h2>
    <div class="guided-muscle">${muscleStr}</div>
    <div class="guided-icon-row">${renderExerciseExtras(ex.name)}</div>
    ${renderFormCues(ex.name)}
    ${renderProgressChart(ex.name)}
    ${techHtml}

    <div class="guided-set-block">
      <div class="guided-set-num">
        <span class="guided-set-label">Set</span>
        <span class="guided-set-big">${guided.set}</span>
        <span class="guided-set-of">of ${ex.sets}</span>
      </div>
      <div class="guided-target"><strong>${ex.reps}</strong> reps · rest <strong>${ex.rest}s</strong></div>
    </div>

    ${lastLine}
    ${inputsHtml}

    <div class="guided-actions">
      <button class="primary-btn big" data-guided-action="done">${doneLabel}</button>
      <button class="ghost-btn" data-guided-action="skip">Skip ${isLastSet ? "Exercise" : "Set"}</button>
    </div>
  `;

  document.querySelector("[data-guided-action='done']").addEventListener("click", onDoneSet);
  document.querySelector("[data-guided-action='skip']").addEventListener("click", onSkipSet);
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

  const isLastSet = guided.set >= ex.sets;
  const isLastExercise = guided.exIdx >= currentWorkout.exercises.length - 1;
  const trackable = isTrackable(ex.name);
  const usesWeight = exerciseUsesWeight(ex.name);
  const units = getPrefs(session.username).units;

  // Log only on the working (last) set
  if (trackable && isLastSet) {
    const rEl = document.getElementById("guidedReps");
    const wEl = document.getElementById("guidedWeight");
    const reps = Number(rEl?.value || 0);
    if (reps > 0) {
      const weightDisplay = wEl ? Number(wEl.value || 0) : 0;
      const weightKg = wEl ? fromDisplay(weightDisplay, units) : 0;
      const result = logExercise(session.username, ex.name, { weightKg, reps });
      if (result.pr) {
        guidedSession.prs.push({ name: ex.name, weightKg, reps });
      }
      // Approximate session volume: assume all sets matched the working set.
      if (weightKg > 0) {
        guidedSession.volumeKg += weightKg * reps * ex.sets;
      }
    }
  }

  guidedSession.setsDone += 1;
  if (isLastSet) guidedSession.exercisesCompleted += 1;

  // Start rest timer after every set (including the last one before next exercise)
  if (ex.rest > 0) startRestTimer(ex.rest, `Rest — ${ex.name}`);

  if (isLastSet) {
    if (isLastExercise) return finishGuidedWorkout();
    guided.exIdx += 1;
    guided.set = 1;
  } else {
    guided.set += 1;
  }
  renderGuided();
}

function onSkipSet() {
  if (!currentWorkout) return;
  const ex = currentWorkout.exercises[guided.exIdx];
  if (!ex) return finishGuidedWorkout();
  const isLastSet = guided.set >= ex.sets;
  const isLastExercise = guided.exIdx >= currentWorkout.exercises.length - 1;
  guidedSession.setsSkipped += 1;
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

      <div class="guided-actions">
        <button class="primary-btn big" id="guidedFinishBtn">Done</button>
      </div>
    </div>
  `;
  document.getElementById("guidedFinishBtn").addEventListener("click", exitGuided);
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

// ─── INIT ────────────────────────────────────────────────────────────────
if (session && getUsers()[session.username]) {
  showApp("generator");
} else {
  session = null;
  localStorage.removeItem(STORAGE_KEYS.session);
  showAuth();
}

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
