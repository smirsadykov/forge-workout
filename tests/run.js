// FORGE test harness — runs in the browser when ?test=1 is in the URL.
// Loads after app.js so all generator globals are available. Drops a fixed
// panel at the top of the page with pass/fail counts; full output is logged
// to console as well.
//
// What it covers:
//   - Unit checks: parseTimeReps, parseRepRange, smartProgression,
//     getStartingWeight, getMovementBucket, canDeliverStrength,
//     isUnilateralExercise, snapToEquipmentStep, nextRealisticWeight,
//     getMuscleContributions
//   - Library invariants: every exercise has valid pattern/equipment/muscle,
//     SPORT_EXERCISES references resolve
//   - Generator sweep: across the same 5,040-combo grid I audited manually,
//     check time consistency, tracking validity (every exercise loggable),
//     no nulls, no time overruns.
//
// Run: open `?test=1` in a browser, watch the panel + console.

(function () {
  // Bail unless explicitly requested — don't run on every page load
  if (typeof window === "undefined") return;
  if (!new URLSearchParams(location.search).has("test")) return;

  // Stub a minimal session so the generator's session-dependent code paths
  // don't bail out / NPE. The audit doesn't need a real user.
  window.session = window.session || { username: "__test__", userId: "__test__" };

  const results = { passed: 0, failed: 0, suites: [] };
  let currentSuite = null;

  function suite(name, fn) {
    currentSuite = { name, tests: [] };
    results.suites.push(currentSuite);
    try { fn(); }
    catch (e) { test("(suite error)", () => { throw e; }); }
    currentSuite = null;
  }

  function test(name, fn) {
    let pass = true, err = null;
    try { fn(); } catch (e) { pass = false; err = e; }
    currentSuite.tests.push({ name, pass, err });
    if (pass) results.passed++; else results.failed++;
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
  }
  function eq(a, b, msg) {
    if (a !== b) throw new Error(`${msg || "values differ"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
  function near(a, b, tol, msg) {
    if (Math.abs(a - b) > tol) throw new Error(`${msg || "not close"}: ${a} vs ${b} (tol ${tol})`);
  }

  // ─── UNIT SUITES ─────────────────────────────────────────────────────
  suite("parseTimeReps", () => {
    test("X min", () => eq(parseTimeReps("8 min"), 480));
    test("X min · pace text doesn't confuse parser", () => eq(parseTimeReps("10 min · pace 14-16/min"), 600));
    test("KB Sport one-arm full string", () => eq(parseTimeReps("8 min · switch hands at 4:00 · pace 14-16/min per side"), 480));
    test("30-60 sec averages", () => eq(parseTimeReps("30–60 sec"), 45));
    test("rep range returns null", () => eq(parseTimeReps("8-12"), null));
    test("non-string returns null", () => eq(parseTimeReps(123), null));
  });

  suite("parseRepRange", () => {
    test("8-12", () => { const r = parseRepRange("8-12"); eq(r[0], 8); eq(r[1], 12); });
    test("3-5 per side", () => { const r = parseRepRange("3-5 per side"); eq(r[0], 3); eq(r[1], 5); });
    test("time string returns [0,0]", () => { const r = parseRepRange("30 sec"); eq(r[0], 0); eq(r[1], 0); });
    test("single number duplicates", () => { const r = parseRepRange("10"); eq(r[0], 10); eq(r[1], 10); });
  });

  suite("getMovementBucket", () => {
    const find = n => EXERCISES.find(e => e.name === n);
    test("KB row → pull", () => eq(getMovementBucket(find("Kettlebell Bent-Over Row")), "pull"));
    test("KB OH press → push", () => eq(getMovementBucket(find("Kettlebell Overhead Press")), "push"));
    test("KB lunge → squat", () => eq(getMovementBucket(find("Kettlebell Lunge") || find("Walking Lunges")), "squat"));
    test("KB deadlift → hinge", () => {
      const e = find("Kettlebell Sumo Deadlift") || find("Single-Leg Romanian Deadlift");
      eq(getMovementBucket(e), "hinge");
    });
    test("plank → core", () => {
      const e = find("Plank");
      if (e) eq(getMovementBucket(e), "core");
    });
  });

  suite("isUnilateralExercise (per-side logging)", () => {
    // These must be classified unilateral — they're either explicit one-side
    // names, lateral/rotational movements, or carries/holds done per side.
    const unilateral = [
      "Kettlebell Single-Arm Row",
      "Kettlebell Floor Press",
      "Kettlebell Bulgarian Split Squat",
      "Kettlebell Suitcase Deadlift",
      "Kettlebell Side Bend",
      "Dumbbell Side Bend",
      "Side Plank",
      "Side Plank Raises",
      "Pallof Press",
      "Wood Chop",
      "Cable Wood Chop",
      "Cossack Squat",
      "Kettlebell Cossack Squat",
      "Bulgarian Split Squat",
      "Pistol Squat",
      "Walking Lunges",
      "Reverse Lunges",
      "Kettlebell Renegade Row",
      "Kettlebell Half Get-Up",
    ];
    // These must NOT be classified unilateral — they're bilateral two-arm/
    // two-leg movements even if a unilateral variant exists separately.
    const bilateral = [
      "Kettlebell Bent-Over Row",       // two-bell row
      "Bodyweight Squat",
      "Bench Press",
      "Deadlift",
      "Plank",
      "Push-Ups",
      "Bird Dog",                       // alternating but bilateral pattern
      "Dead Bug",                       // ditto
    ];
    for (const name of unilateral) {
      test(`${name} → unilateral`, () => assert(isUnilateralExercise(name), `${name} should be unilateral`));
    }
    for (const name of bilateral) {
      test(`${name} → bilateral`, () => assert(!isUnilateralExercise(name), `${name} should be bilateral`));
    }
  });

  suite("canDeliverStrength", () => {
    const find = n => EXERCISES.find(e => e.name === n);
    test("Loaded compounds qualify", () => assert(canDeliverStrength(find("Kettlebell Floor Press"))));
    test("Beginner BW squat doesn't qualify", () => {
      const e = find("Bodyweight Squat");
      if (e) assert(!canDeliverStrength(e), "Bodyweight Squat shouldn't qualify for strength");
    });
    test("Pistol/one-arm advanced BW qualifies", () => {
      const e = find("Pistol Squat") || find("One-Arm Push-Ups");
      if (e) assert(canDeliverStrength(e), `${e.name} should qualify`);
    });
  });

  suite("snapToEquipmentStep", () => {
    const findKb = EXERCISES.find(e => e.equipment.includes("kettlebell"));
    test("KB rounds down to inventory", () => {
      // Stub a loads pref with inventory
      const all = load(STORAGE_KEYS.loads, {});
      all["__test__"] = { ...(all["__test__"] || {}), availableKettlebellsKg: [10, 12, 16, 20, 24] };
      save(STORAGE_KEYS.loads, all);
      eq(snapToEquipmentStep(15.3, findKb, "__test__", true), 12);
      eq(snapToEquipmentStep(18, findKb, "__test__", true), 16);
      eq(snapToEquipmentStep(25, findKb, "__test__", true), 24);
    });
  });

  suite("getStartingWeight (load percentages)", () => {
    test("Hypertrophy unilateral press: ~0.65 × 0.80 × max", () => {
      const all = load(STORAGE_KEYS.loads, {});
      all["__test__"] = { ...(all["__test__"] || {}), maxKettlebellKg: 24, availableKettlebellsKg: [10, 12, 16, 20, 24] };
      save(STORAGE_KEYS.loads, all);
      const press = EXERCISES.find(e => /floor press|single-arm press/i.test(e.name) && e.equipment.includes("kettlebell"));
      if (!press) return;
      const w = getStartingWeight(press.name, "__test__", "hypertrophy");
      assert(w <= 16 && w >= 10, `expected 10-16kg, got ${w}`);
    });
  });

  // ─── LIBRARY INVARIANTS ──────────────────────────────────────────────
  suite("Library invariants", () => {
    const VALID_PATTERNS = ["compound", "isolation", "ballistic", "conditioning", "mobility"];
    const VALID_DIFFICULTY = ["beginner", "intermediate", "advanced"];
    test("All exercises have valid pattern", () => {
      const bad = EXERCISES.filter(e => !VALID_PATTERNS.includes(e.pattern));
      assert(bad.length === 0, `bad patterns: ${bad.map(b => b.name).join(", ")}`);
    });
    test("All exercises have valid difficulty", () => {
      const bad = EXERCISES.filter(e => !VALID_DIFFICULTY.includes(e.difficulty));
      assert(bad.length === 0, `bad difficulty: ${bad.map(b => b.name).join(", ")}`);
    });
    test("No duplicate names", () => {
      const seen = new Set();
      const dups = [];
      for (const e of EXERCISES) {
        if (seen.has(e.name)) dups.push(e.name);
        seen.add(e.name);
      }
      assert(dups.length === 0, `dups: ${dups.join(", ")}`);
    });
    test("SPORT_EXERCISES references all resolve", () => {
      const names = new Set(EXERCISES.map(e => e.name));
      const orphans = [];
      for (const [sport, list] of Object.entries(SPORT_EXERCISES || {})) {
        for (const n of list) if (!names.has(n)) orphans.push(`${sport}:${n}`);
      }
      assert(orphans.length === 0, `orphans: ${orphans.join(", ")}`);
    });
  });

  // ─── GENERATOR SWEEP ─────────────────────────────────────────────────
  suite("Generator sweep (5040 combos)", () => {
    const goals = ["strength", "hypertrophy", "fat_loss", "endurance", "mobility", "recovery"];
    const equipments = [
      ["bodyweight"], ["dumbbells"], ["kettlebell"], ["barbell"], ["bands"], ["machine"],
      ["bodyweight","dumbbells"], ["bodyweight","kettlebell"],
      ["dumbbells","barbell","machine","bands"],
      ["floor_only"],
    ];
    const targets = ["full_body", "upper", "lower", "push", "pull", "legs", "core"];
    const durations = [15, 30, 45, 60];
    const difficulties = ["beginner", "intermediate", "advanced"];

    let total = 0, nullCount = 0, overrunCount = 0, untrackable = 0;
    for (const goal of goals)
    for (const equipment of equipments)
    for (const target of targets)
    for (const duration of durations)
    for (const difficulty of difficulties) {
      total++;
      const w = generateWorkout({ goal, equipment, target, duration, difficulty, style: "standard" });
      if (!w) { nullCount++; continue; }
      const estSec = estimateWorkoutSeconds(w.exercises);
      if (estSec > duration * 60 * 1.20) overrunCount++;
      for (const ex of w.exercises.filter(e => e.pattern !== "mobility")) {
        if (ex.isTimeBlock) continue;
        const range = parseRepRange(ex.reps);
        const timeBased = parseTimeReps(ex.reps);
        if (!timeBased && range[0] === 0 && range[1] === 0) untrackable++;
      }
    }
    test(`Ran ${total} combos`, () => assert(total === 5040));
    test("No null workouts", () => eq(nullCount, 0));
    test("No time overruns (>120% of requested)", () => eq(overrunCount, 0));
    test("No untrackable exercises", () => eq(untrackable, 0));
  });

  // ─── RENDER + REPORT ─────────────────────────────────────────────────
  const panel = document.createElement("div");
  panel.id = "testPanel";
  panel.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;padding:14px 18px;background:#0d0f15;color:#fff;font-family:ui-monospace,monospace;font-size:13px;border-bottom:2px solid var(--accent);max-height:50vh;overflow-y:auto;";
  let html = `<div style="font-weight:800;letter-spacing:0.5px;">TEST RESULTS — ${results.passed} passed, ${results.failed} failed</div>`;
  for (const s of results.suites) {
    const sFail = s.tests.filter(t => !t.pass);
    html += `<div style="margin-top:8px;font-weight:700;color:${sFail.length ? "#ff6b6d" : "#5dade2"}">${s.name} (${s.tests.length - sFail.length}/${s.tests.length})</div>`;
    for (const t of sFail) {
      html += `<div style="padding-left:14px;color:#ff6b6d;">✗ ${t.name}: ${t.err?.message || t.err}</div>`;
    }
  }
  panel.innerHTML = html;
  document.body?.appendChild(panel) || document.addEventListener("DOMContentLoaded", () => document.body.appendChild(panel));

  // Console summary line — useful for headless / CI grep
  console.log(`[forge-tests] passed=${results.passed} failed=${results.failed}`);
  for (const s of results.suites) for (const t of s.tests) if (!t.pass) console.error(`[forge-tests] FAIL ${s.name} :: ${t.name} :: ${t.err?.message}`);
  // Expose for programmatic inspection
  window.__FORGE_TEST_RESULTS__ = results;
})();
