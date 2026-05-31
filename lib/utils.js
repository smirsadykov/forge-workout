// FORGE utils — stateless helpers used by generator + render paths.
// Loaded as a regular <script> before app.js. Every function below becomes
// a window-scoped global; existing call sites in app.js need no changes.
// Why split: app.js was 6,500+ lines. Extracting the pure helpers (no
// session/storage/DOM dependencies) reduces surface area and makes these
// trivially testable in isolation.

// ─── E1RM + history utilities ────────────────────────────────────────────
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

// ─── Rep range + duration parsing ────────────────────────────────────────
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

// ─── Exercise-property checks ────────────────────────────────────────────
// Each looks up EXERCISES (a global from exercises.js, loaded before this
// file). Pure: no session/storage/DOM access.

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

function isUnilateralExercise(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  // Explicit one-side names
  if (/single-?arm|single-?leg|one-?arm|one-?leg/.test(n)) return true;
  // Lunges, split squats, step-ups, pistol/shrimp squats = per leg
  if (/\blunges?\b|split squat|step-?up|pistol squat|shrimp squat/.test(n)) return true;
  // Get-ups + windmills are inherently one-side
  if (/get-?up|windmill/.test(n)) return true;
  // Specific kettlebell movements that are unilateral by tradition
  if (/kettlebell\s+(arnold|overhead|floor|bottoms-?up|z-?press|see-saw)/.test(n)) return true;
  if (/kettlebell\s+(snatch|clean|high pull|gorilla row|renegade row|cuban)/.test(n)) return true;
  if (/kettlebell\s+(suitcase|racked carry|overhead carry)/.test(n)) return true;
  if (/renegade row/.test(n)) return true;
  return false;
}

function maxSetsForDuration(duration) {
  if (!duration) return 5;
  if (duration <= 15) return 3;
  if (duration <= 30) return 4;
  if (duration <= 45) return 4;
  return 5;
}

// ─── Movement pattern bucket (push/pull/squat/hinge/core/etc.) ───────────
function getMovementBucket(exercise) {
  if (!exercise) return "other";
  if (exercise.pattern === "mobility") return "mobility";
  if (exercise.pattern === "conditioning") return "conditioning";
  const name = (exercise.name || "").toLowerCase();
  const primary = (exercise.muscle && exercise.muscle[0]) || "";

  if (/deadlift|\brdl\b|romanian|swing|\bclean\b|snatch|hip thrust|good morning|hyperextension|kettlebell jerk|nordic/.test(name)) {
    return "hinge";
  }
  if (/squat|lunge|step-?up|split squat|bulgarian|cossack|pistol|sissy|shrimp/.test(name)) {
    return "squat";
  }
  if (/pull-?up|chin-?up|pulldown|pull-?down|lat pull|inverted row|\brow\b|face pull|reverse fly|rear delt/.test(name)) {
    return "pull";
  }
  if (/press|push-?up|push up|bench|\bfly\b|\bflye\b|\bdip\b/.test(name)) {
    return "push";
  }
  if (/curl|tricep extension|skull crusher|kickback|pushdown/.test(name)) {
    return "arm_iso";
  }
  if (/lateral raise|front raise|shrug|upright row/.test(name)) {
    return "shoulder_iso";
  }
  if (primary === "core" || /plank|crunch|sit-?up|leg raise|hollow|dead bug|bird dog|ab wheel|cable crunch|russian twist|wood chop|mountain climb|hanging knee|knees to elbows|toes to bar/.test(name)) {
    return "core";
  }
  if (primary === "calves" || /calf raise|calf press/.test(name)) {
    return "calf";
  }
  return "other";
}

// ─── Equipment-aware filters ─────────────────────────────────────────────
function requiresFurniture(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  if (/\b(pull-?ups?|chin-?ups?|muscle-?up|hanging|inverted row|toes to bar|knees to elbows|l-?sit hang)/i.test(n)) return true;
  if (/\bdips?\b/i.test(n)) return true;
  if (/step-?up|box jump|box squat|bench (jump|step)|bulgarian|elevated/i.test(n)) return true;
  if (/incline push|decline push|feet-elevated|hands-elevated/i.test(n)) return true;
  if (/doorway row|towel row/i.test(n)) return true;
  return false;
}

function canDeliverStrength(exercise) {
  if (!exercise) return false;
  const eqs = exercise.equipment || [];
  if (eqs.some(e => ["dumbbells", "barbell", "kettlebell", "machine"].includes(e))) return true;
  if (eqs.includes("bands")) return exercise.difficulty === "advanced";
  if (eqs.includes("bodyweight")) {
    if (exercise.difficulty !== "advanced") return false;
    const n = (exercise.name || "").toLowerCase();
    return /pistol|one-?arm|handstand|planche|archer|lever|muscle-?up|deficit|nordic|shrimp|dragon|skater squat/.test(n);
  }
  return false;
}

function matchesDifficulty(exDiff, target) {
  const order = { beginner: 0, intermediate: 1, advanced: 2 };
  return order[exDiff] <= order[target];
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

// ─── Random utilities ────────────────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
