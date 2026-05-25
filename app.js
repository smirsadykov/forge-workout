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
function logExercise(userId, exName, { weightKg, reps }) {
  const all = load(STORAGE_KEYS.stats, {});
  if (!all[userId]) all[userId] = {};
  const entry = {
    weightKg: Number(weightKg) || 0,
    reps: Number(reps) || 0,
    date: Date.now(),
  };
  const existing = all[userId][exName] || { history: [] };
  existing.weightKg = entry.weightKg;
  existing.reps = entry.reps;
  existing.date = entry.date;
  existing.history = (existing.history || []).concat([entry]).slice(-30);
  all[userId][exName] = existing;
  save(STORAGE_KEYS.stats, all);
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
  el.nav.classList.remove("hidden");
  el.authView.classList.add("hidden");
  el.userLabel.textContent = session.username;
  applyUnitsButtons();
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  el.generatorView.classList.toggle("hidden", view !== "generator");
  el.historyView.classList.toggle("hidden", view !== "history");
  el.settingsView.classList.toggle("hidden", view !== "settings");
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
  if (!isTrackable(ex.name)) return "";

  const usesWeight = exerciseUsesWeight(ex.name);
  const suggestion = getSuggestion(session.username, ex.name, ex, ex.pattern);
  const last = suggestion.last;
  const next = suggestion.next;

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

  // Pre-filled inputs (suggested next)
  const suggestedWeight = next ? toDisplay(next.weightKg, units) : "";
  const suggestedReps = next ? next.reps : parseRepRange(ex.reps)[0];

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
                <div class="exercise-name">${ex.name}</div>
                <div class="exercise-info">${ex.muscle.map(m => m.replace("_"," ")).join(" · ")}</div>
                ${ex.technique ? `
                  <div class="technique-badge">${ex.technique.name}</div>
                  <div class="technique-note">${ex.technique.note}</div>
                ` : ""}
              </div>
              <div class="exercise-prescription">
                ${ex.sets} × ${ex.reps}<br />
                <span class="exercise-rest">rest ${ex.rest}s</span>
              </div>
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

function attachWorkoutActions() {
  const saveBtn = document.getElementById("saveBtn");
  const regenBtn = document.getElementById("regenBtn");
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

      logExercise(session.username, exName, { weightKg, reps });

      // Swap the form for a logged badge so user has visual confirmation.
      const w = weightKg ? `${toDisplay(weightKg, units)} ${units} × ${reps}` : `${reps} reps`;
      logEl.innerHTML = `
        <span class="logged-badge">✓ Logged ${w}
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

// ─── INIT ────────────────────────────────────────────────────────────────
if (session && getUsers()[session.username]) {
  showApp("generator");
} else {
  session = null;
  localStorage.removeItem(STORAGE_KEYS.session);
  showAuth();
}
