// ═════════════════════════════════════════════════════════════════════════
// FORGE — Workout Generator
// Single-page app. State lives in localStorage.
// ═════════════════════════════════════════════════════════════════════════

const STORAGE_KEYS = {
  users: "forge:users",
  session: "forge:session",
  workouts: "forge:workouts",
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

// ─── DOM ─────────────────────────────────────────────────────────────────
const el = {
  nav: document.getElementById("nav"),
  userLabel: document.getElementById("userLabel"),
  logoutBtn: document.getElementById("logoutBtn"),
  authView: document.getElementById("authView"),
  generatorView: document.getElementById("generatorView"),
  historyView: document.getElementById("historyView"),
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
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  el.generatorView.classList.toggle("hidden", view !== "generator");
  el.historyView.classList.toggle("hidden", view !== "history");
  if (view === "history") renderHistory();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showApp(btn.dataset.view));
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
const formState = { goal: null, equipment: [], target: null, duration: null, difficulty: null };

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
    });
  });
});

function resetForm() {
  formState.goal = null;
  formState.equipment = [];
  formState.target = null;
  formState.duration = null;
  formState.difficulty = null;
  document.querySelectorAll(".chip.selected").forEach(c => c.classList.remove("selected"));
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

function pickPrescription(goal, difficulty, exercise) {
  const p = PRESCRIPTIONS[goal] || PRESCRIPTIONS.hypertrophy;
  let sets = randInt(p.sets[0], p.sets[1]);
  let rest = p.rest;

  // Difficulty scales volume + rest.
  if (difficulty === "beginner") {
    sets = Math.max(2, sets - 1);
    rest = Math.round(rest * 1.2); // a bit more rest while learning
  } else if (difficulty === "advanced") {
    sets = sets + 1;
    rest = Math.max(20, Math.round(rest * 0.85)); // tighter rest, more intensity
  }

  const isIso = exercise.pattern === "isolation";
  let repsRange = isIso ? p.isoReps : p.reps;

  // Advanced gets harder rep schemes for compounds (lower-end strength bias on
  // strength goal, drop sets implied on hypertrophy via higher reps).
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
  return { sets, reps, rest };
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

function generateWorkout({ goal, equipment, target, duration, difficulty }) {
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
    if ((goal === "fat_loss" || goal === "endurance") &&
        (ex.pattern === "compound" || ex.pattern === "conditioning")) score += 6;
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

  // Re-order: mobility → compound → isolation → conditioning
  const orderKey = (e) => {
    if (e.pattern === "mobility") return 0;
    if (e.pattern === "compound") return 1;
    if (e.pattern === "isolation") return 2;
    return 3;
  };
  picked.sort((a, b) => orderKey(a) - orderKey(b));

  // Update anti-repeat memory with this workout's exercises.
  lastPickedNames = new Set(picked.map(e => e.name));

  const exercises = picked.map(ex => ({
    name: ex.name,
    muscle: ex.muscle,
    pattern: ex.pattern,
    ...pickPrescription(goal, difficulty, ex),
  }));

  return {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    inputs: { goal, equipment, target, duration, difficulty },
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

function renderWorkout(workout, container, { showSave = true } = {}) {
  const { inputs, exercises } = workout;
  const dateStr = new Date(workout.createdAt).toLocaleString();

  const tags = [
    GOAL_LABELS[inputs.goal],
    TARGET_LABELS[inputs.target],
    `${inputs.duration} min`,
    inputs.difficulty[0].toUpperCase() + inputs.difficulty.slice(1),
  ].map(t => `<span class="tag">${t}</span>`).join("");

  const sections = {
    "Warm-up / Mobility": exercises.filter(e => e.pattern === "mobility"),
    "Main Work": exercises.filter(e => e.pattern === "compound" || e.pattern === "isolation"),
    "Conditioning / Finisher": exercises.filter(e => e.pattern === "conditioning"),
  };

  const exercisesHtml = Object.entries(sections)
    .filter(([, list]) => list.length > 0)
    .map(([title, list]) => `
      <h3 class="section-header">${title}</h3>
      <div class="exercise-list">
        ${list.map(ex => `
          <div class="exercise">
            <div class="exercise-main">
              <div class="exercise-name">${ex.name}</div>
              <div class="exercise-info">${ex.muscle.map(m => m.replace("_"," ")).join(" · ")}</div>
            </div>
            <div class="exercise-prescription">
              ${ex.sets} × ${ex.reps}<br />
              <span class="exercise-rest">rest ${ex.rest}s</span>
            </div>
          </div>
        `).join("")}
      </div>
    `).join("");

  container.innerHTML = `
    <div class="workout-header">
      <div>
        <div class="workout-title">${TARGET_LABELS[inputs.target]} · ${GOAL_LABELS[inputs.goal]}</div>
        <div class="workout-meta">${tags}</div>
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
  });

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

function attachWorkoutActions() {
  const saveBtn = document.getElementById("saveBtn");
  const regenBtn = document.getElementById("regenBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (!currentWorkout || !session) return;
      addWorkout(session.username, currentWorkout);
      saveBtn.textContent = "Saved ✓";
      saveBtn.disabled = true;
    });
  }
  if (regenBtn) {
    regenBtn.addEventListener("click", () => el.generateBtn.click());
  }
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

// ─── INIT ────────────────────────────────────────────────────────────────
if (session && getUsers()[session.username]) {
  showApp("generator");
} else {
  session = null;
  localStorage.removeItem(STORAGE_KEYS.session);
  showAuth();
}
