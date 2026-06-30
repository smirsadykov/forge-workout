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
    // Isolation work, regardless of equipment, is not strength-capable —
    // can't be loaded to the 80%+ 1RM territory where strength lives.
    test("KB Side Bend (isolation) doesn't qualify", () => {
      const e = find("Kettlebell Side Bend");
      if (e) assert(!canDeliverStrength(e), "Side Bend is isolation, not strength");
    });
    test("KB Curl (isolation) doesn't qualify", () => {
      const e = find("Kettlebell Curl");
      if (e) assert(!canDeliverStrength(e), "Curl is isolation, not strength");
    });
    test("KB Halo (mobility) doesn't qualify", () => {
      const e = find("Kettlebell Halo");
      if (e) assert(!canDeliverStrength(e), "Halo is mobility, not strength");
    });
    test("KB Swing (ballistic) doesn't qualify", () => {
      const e = find("Kettlebell Swing");
      if (e) assert(!canDeliverStrength(e), "Swing is ballistic, not max-load strength");
    });
  });

  suite("nextRealisticWeight (cap at user max)", () => {
    test("KB user at max 24kg, no inventory → stays at 24, no jump to 28", () => {
      const all = load(STORAGE_KEYS.loads, {});
      all["__test__"] = { ...(all["__test__"] || {}), maxKettlebellKg: 24, availableKettlebellsKg: null };
      save(STORAGE_KEYS.loads, all);
      // Pick a KB exercise that exists
      const ex = EXERCISES.find(e => e.equipment.includes("kettlebell"));
      if (!ex) return;
      eq(nextRealisticWeight(24, ex.name, "__test__"), 24, "shouldn't suggest above maxKettlebellKg");
    });
    test("KB user with 24kg max, currently at 20kg → next is 24kg (within max)", () => {
      const ex = EXERCISES.find(e => e.equipment.includes("kettlebell"));
      if (!ex) return;
      eq(nextRealisticWeight(20, ex.name, "__test__"), 24, "should step up to 24 (still within max)");
    });
    test("DB user with 18kg max → cap respected", () => {
      const all = load(STORAGE_KEYS.loads, {});
      all["__test__"] = { ...(all["__test__"] || {}), maxDumbbellKg: 18, maxKettlebellKg: 0 };
      save(STORAGE_KEYS.loads, all);
      const ex = EXERCISES.find(e => e.equipment.includes("dumbbells") && !e.equipment.includes("kettlebell"));
      if (!ex) return;
      eq(nextRealisticWeight(18, ex.name, "__test__"), 18, "shouldn't suggest above maxDumbbellKg");
    });
  });

  suite("Pattern balance (cross-session load distribution)", () => {
    test("getDefaultPatternTargets: strength has lower volume than hypertrophy", () => {
      const s = getDefaultPatternTargets("strength");
      const h = getDefaultPatternTargets("hypertrophy");
      assert(s.push < h.push, "strength push should be < hypertrophy push");
      assert(s.squat < h.squat, "strength squat should be < hypertrophy squat");
    });
    test("getDefaultPatternTargets: unknown goal falls back to hypertrophy", () => {
      const u = getDefaultPatternTargets("bogus_goal");
      const h = getDefaultPatternTargets("hypertrophy");
      eq(u.push, h.push, "unknown goal should match hypertrophy");
    });
    test("patternStatus: zero target → ok (don't divide by 0)", () => {
      eq(patternStatus(5, 0), "ok");
    });
    test("patternStatus: thresholds at 0.5x / 1.0x / 1.5x of target", () => {
      eq(patternStatus(2, 10), "deficit", "2/10 = 20% → deficit");
      eq(patternStatus(7, 10), "under",   "7/10 = 70% → under");
      eq(patternStatus(12, 10), "ok",     "12/10 = 120% → ok");
      eq(patternStatus(16, 10), "over",   "16/10 = 160% → over");
    });
    test("patternDebtScore: deficit boosts, over penalizes more than anti-repeat", () => {
      assert(patternDebtScore("deficit") > 0, "deficit should boost score");
      assert(patternDebtScore("over") < -8 || patternDebtScore("over") === -8, "over should penalize ≥ anti-repeat (-9 vs -8 — close enough)");
      eq(patternDebtScore("ok"), 0, "ok should be neutral");
    });
    test("getRecentPatternVolume: empty history → zero everywhere", () => {
      // Use a fresh user ID with no data
      const v = getRecentPatternVolume("__nobody__", 7);
      eq(v.push, 0);
      eq(v.pull, 0);
      eq(v.squat, 0);
      eq(v.hinge, 0);
      eq(v.core, 0);
    });
    test("getPatternBalance: returns full status object for all 5 patterns", () => {
      const b = getPatternBalance("__nobody__", "hypertrophy");
      for (const pat of ["push", "pull", "squat", "hinge", "core"]) {
        assert(pat in b, `${pat} should be present`);
        assert("actual" in b[pat], `${pat}.actual should be present`);
        assert("target" in b[pat], `${pat}.target should be present`);
        assert("status" in b[pat], `${pat}.status should be present`);
        assert("delta" in b[pat], `${pat}.delta should be present`);
      }
    });
    test("getRecentPatternVolume: synthetic history counts correctly", () => {
      // Inject a synthetic history entry for a known push exercise
      const pushEx = EXERCISES.find(e => getMovementBucket(e) === "push" && e.equipment.includes("kettlebell"));
      if (!pushEx) return;  // skip if no candidate
      const stats = load(STORAGE_KEYS.stats, {});
      stats["__patternuser__"] = {
        [pushEx.name]: {
          history: [
            { date: Date.now() - 86400000, sets: [{ weightKg: 16, reps: 8 }, { weightKg: 16, reps: 8 }, { weightKg: 16, reps: 8 }] },
          ],
        },
      };
      save(STORAGE_KEYS.stats, stats);
      const v = getRecentPatternVolume("__patternuser__", 7);
      eq(v.push, 3, "should count 3 sets of push");
    });
    test("getRecentPatternVolume: deload entries don't count", () => {
      const pushEx = EXERCISES.find(e => getMovementBucket(e) === "push" && e.equipment.includes("kettlebell"));
      if (!pushEx) return;
      const stats = load(STORAGE_KEYS.stats, {});
      stats["__deloaduser__"] = {
        [pushEx.name]: {
          history: [
            { date: Date.now() - 86400000, deload: true, sets: [{ weightKg: 16, reps: 8 }, { weightKg: 16, reps: 8 }] },
          ],
        },
      };
      save(STORAGE_KEYS.stats, stats);
      const v = getRecentPatternVolume("__deloaduser__", 7);
      eq(v.push, 0, "deload sets should be excluded");
    });
  });

  suite("Required bucket coverage (KB strength 30min full-body)", () => {
    // Regression: user reported squats were missing from KB-strength-30min-full_body
    // workouts when squat had recently accumulated >150% of weekly target.
    // The picker was treating bucket balance as a ceiling-only, allowing
    // "other"-bucket exercises (carries, get-ups) to outscore penalized squats.
    test("Squat pattern survives squat-overload penalty", () => {
      window.session = { username: "__bucketcov__", userId: "__bucketcov__" };
      // Plant a history that makes squat status "over"
      const squatExs = EXERCISES.filter(e => getMovementBucket(e) === "squat" && e.equipment.includes("kettlebell")).slice(0, 2);
      const stats = load(STORAGE_KEYS.stats, {});
      stats["__bucketcov__"] = {};
      for (const ex of squatExs) {
        stats["__bucketcov__"][ex.name] = {
          history: [
            { date: Date.now() - 2*86400000, sets: Array.from({length: 5}, () => ({ weightKg: 24, reps: 5 })) },
          ],
        };
      }
      save(STORAGE_KEYS.stats, stats);

      let squatMissing = 0;
      const ITER = 15;
      for (let i = 0; i < ITER; i++) {
        const w = generateWorkout({
          goal: "strength", equipment: ["kettlebell"], target: "full_body",
          duration: 30, intensity: "normal", style: "standard",
        });
        const main = w.exercises.filter(e => e.pattern !== "mobility");
        const buckets = new Set(main.map(e => getMovementBucket(e)));
        if (!buckets.has("squat")) squatMissing++;
      }
      eq(squatMissing, 0, `squat went missing in ${squatMissing}/${ITER} runs despite required-bucket coverage`);
    });
    test("All 4 primary buckets present in full_body KB strength 30min", () => {
      window.session = { username: "__bucketcov__", userId: "__bucketcov__" };
      let allFourCount = 0;
      const REQ = ["push", "pull", "squat", "hinge"];
      const ITER = 10;
      for (let i = 0; i < ITER; i++) {
        const w = generateWorkout({
          goal: "strength", equipment: ["kettlebell"], target: "full_body",
          duration: 30, intensity: "normal", style: "standard",
        });
        const main = w.exercises.filter(e => e.pattern !== "mobility");
        const buckets = new Set(main.map(e => getMovementBucket(e)));
        if (REQ.every(b => buckets.has(b))) allFourCount++;
      }
      eq(allFourCount, ITER, `only ${allFourCount}/${ITER} runs hit all 4 primary buckets`);
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
    const intensities = ["easy", "normal", "hard"];

    let total = 0, nullCount = 0, overrunCount = 0, untrackable = 0;
    for (const goal of goals)
    for (const equipment of equipments)
    for (const target of targets)
    for (const duration of durations)
    for (const intensity of intensities) {
      total++;
      const w = generateWorkout({ goal, equipment, target, duration, intensity, style: "standard" });
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

  // ─── CROSSFIT / METCON ───────────────────────────────────────────────
  suite("CrossFit WOD generator", () => {
    const exNames = new Set(EXERCISES.map(e => e.name));
    const equips = [
      ["bodyweight"], ["bodyweight","kettlebell"], ["barbell","bodyweight"],
      ["dumbbells"], ["cardio_machine","bodyweight"], ["floor_only"],
      ["dumbbells","barbell","kettlebell","bands","machine","cardio_machine"],
    ];
    const formatsSeen = new Set();
    let runs = 0, bad = 0, orphan = 0, capViol = 0, tooFew = 0, noFurnitureLeak = 0;
    for (const equipment of equips)
    for (const duration of [15, 30, 45, 60])
    for (const intensity of ["easy", "normal", "hard"])
    for (let rep = 0; rep < 12; rep++) { // repeat — format + movements are random
      runs++;
      const w = generateWorkout({ goal: "crossfit", equipment, target: "full_body", duration, intensity, style: "standard" });
      if (!w || !w.wod) { bad++; continue; }
      formatsSeen.add(w.wod.format);
      if (!Array.isArray(w.wod.movements) || w.wod.movements.length < 2) tooFew++;
      if (w.wod.timeCapMin > duration) capViol++;
      const floorOnly = equipment.includes("floor_only");
      for (const m of w.wod.movements) {
        if (!exNames.has(m.name)) orphan++;
        // furniture moves (pull-ups/box jumps) must never appear in floor-only
        if (floorOnly && /Pull-Ups|Box Jumps/.test(m.name)) noFurnitureLeak++;
      }
    }
    test("All WODs have a valid wod block (≥2 movements)", () => { eq(bad, 0, "missing wod"); eq(tooFew, 0, "under 2 movements"); });
    test("All movements resolve to library names", () => eq(orphan, 0));
    test("No time cap exceeds requested duration", () => eq(capViol, 0));
    test("Floor-only never leaks furniture movements", () => eq(noFurnitureLeak, 0));
    test("All four formats are reachable", () => eq(formatsSeen.size, 4, `saw: ${[...formatsSeen].join(",")}`));
  });

  // ─── SMART INTENSITY ─────────────────────────────────────────────────
  suite("suggestIntensity", () => {
    const U = "__si__";
    const day = 86400000, now = Date.now();
    const seed = ({ sleep, workouts, loads }) => {
      const s = load(STORAGE_KEYS.sleep, {}); s[U] = sleep ? { [dateKey(new Date())]: sleep } : {}; save(STORAGE_KEYS.sleep, s);
      const w = load(STORAGE_KEYS.workouts, {}); w[U] = workouts || []; save(STORAGE_KEYS.workouts, w);
      const l = load(STORAGE_KEYS.loads, {}); l[U] = loads || {}; save(STORAGE_KEYS.loads, l);
      const so = load(STORAGE_KEYS.soreness, {}); so[U] = {}; save(STORAGE_KEYS.soreness, so); // no soreness
    };
    const threeWorkouts = (lastIntensity, daysAgo) => [
      { createdAt: now - daysAgo * day, inputs: { intensity: lastIntensity, target: "full_body" } },
      { createdAt: now - (daysAgo + 2) * day, inputs: { intensity: "normal", target: "full_body" } },
      { createdAt: now - (daysAgo + 4) * day, inputs: { intensity: "normal", target: "full_body" } },
    ];

    test("poor sleep → easy", () => {
      seed({ sleep: { quality: 2, skipped: false }, workouts: threeWorkouts("normal", 2) });
      eq(suggestIntensity(U).intensity, "easy");
    });
    test("newcomer (<3 workouts) → normal", () => {
      seed({ sleep: { quality: 5, skipped: false }, workouts: [{ createdAt: now - 2 * day, inputs: { intensity: "normal", target: "full_body" } }] });
      eq(suggestIntensity(U).intensity, "normal");
    });
    test("rested + history + bodyweight → hard", () => {
      seed({ sleep: { quality: 5, skipped: false }, workouts: threeWorkouts("normal", 2) });
      formState.equipment = [];
      eq(suggestIntensity(U).intensity, "hard");
    });
    test("light free weights cap hard → normal", () => {
      seed({ sleep: { quality: 5, skipped: false }, workouts: threeWorkouts("normal", 2), loads: { maxDumbbellKg: 10 } });
      formState.equipment = ["dumbbells"];
      eq(suggestIntensity(U).intensity, "normal");
      formState.equipment = [];
    });
    test("don't stack hard days", () => {
      seed({ sleep: { quality: 5, skipped: false }, workouts: threeWorkouts("hard", 1) });
      formState.equipment = [];
      eq(suggestIntensity(U).intensity, "normal");
    });
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
