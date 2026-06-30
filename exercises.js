// Exercise database.
// Tags:
//   muscle: chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core, full_body
//   equipment: bodyweight, dumbbells, barbell, kettlebell, bands, machine, cardio_machine
//   group: push, pull, legs, core, cardio, mobility
//   pattern: compound | isolation | conditioning | mobility
//   difficulty: beginner | intermediate | advanced

const EXERCISES = [
  // ─── PUSH / CHEST ───────────────────────────────────────────────────────
  { name: "Push-Ups", muscle: ["chest","triceps","shoulders"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Incline Push-Ups", muscle: ["chest","triceps"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Decline Push-Ups", muscle: ["chest","shoulders"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Diamond Push-Ups", muscle: ["triceps","chest"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Pike Push-Ups", muscle: ["shoulders","triceps"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Handstand Push-Ups", muscle: ["shoulders","triceps"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Dumbbell Bench Press", muscle: ["chest","triceps","shoulders"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Dumbbell Incline Press", muscle: ["chest","shoulders"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Fly", muscle: ["chest"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Dumbbell Shoulder Press", muscle: ["shoulders","triceps"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Lateral Raises", muscle: ["shoulders"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Front Raises", muscle: ["shoulders"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Dumbbell Tricep Extension", muscle: ["triceps"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Tricep Kickbacks", muscle: ["triceps"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Barbell Bench Press", muscle: ["chest","triceps","shoulders"], equipment: ["barbell"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Incline Barbell Press", muscle: ["chest","shoulders"], equipment: ["barbell"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Overhead Press", muscle: ["shoulders","triceps"], equipment: ["barbell"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Close-Grip Bench Press", muscle: ["triceps","chest"], equipment: ["barbell"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Cable Chest Fly", muscle: ["chest"], equipment: ["machine"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Cable Tricep Pushdown", muscle: ["triceps"], equipment: ["machine"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Machine Chest Press", muscle: ["chest","triceps"], equipment: ["machine"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Banded Chest Press", muscle: ["chest","triceps"], equipment: ["bands"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Banded Shoulder Press", muscle: ["shoulders"], equipment: ["bands"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Overhead Press", muscle: ["shoulders","triceps"], equipment: ["kettlebell"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Floor Press", muscle: ["chest","triceps","shoulders"], equipment: ["kettlebell"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Bottoms-Up Press", muscle: ["shoulders","core","triceps"], equipment: ["kettlebell"], group: ["push","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Kettlebell Z-Press", muscle: ["shoulders","core","triceps"], equipment: ["kettlebell","dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Kettlebell Arnold Press", muscle: ["shoulders","triceps"], equipment: ["kettlebell"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell See-Saw Press", muscle: ["shoulders","triceps","core"], equipment: ["kettlebell"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  // Double KB press — terminal tier for vertical press progression chain.
  { name: "Kettlebell Double Press", muscle: ["shoulders","triceps","core"], equipment: ["kettlebell"], group: ["push","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Kettlebell Halo", muscle: ["shoulders","core"], equipment: ["kettlebell"], group: ["mobility","upper"], pattern: "mobility", difficulty: "beginner" },
  { name: "Dips", muscle: ["chest","triceps"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Weighted Dips", muscle: ["chest","triceps"], equipment: ["bodyweight","dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Archer Push-Ups", muscle: ["chest","triceps"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Plyo Push-Ups", muscle: ["chest","shoulders"], equipment: ["bodyweight"], group: ["push","upper","cardio"], pattern: "ballistic", difficulty: "advanced" },
  { name: "One-Arm Push-Ups", muscle: ["chest","triceps","core"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Wide Push-Ups", muscle: ["chest","shoulders"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Spider Push-Ups", muscle: ["chest","core","triceps"], equipment: ["bodyweight"], group: ["push","upper","core"], pattern: "compound", difficulty: "intermediate" },
  { name: "Hindu Push-Ups", muscle: ["chest","shoulders","triceps","core"], equipment: ["bodyweight"], group: ["push","upper","mobility"], pattern: "compound", difficulty: "intermediate" },
  { name: "T Push-Ups", muscle: ["chest","core","shoulders"], equipment: ["bodyweight"], group: ["push","upper","core"], pattern: "compound", difficulty: "intermediate" },
  { name: "Deficit Push-Ups", muscle: ["chest","triceps","shoulders"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Tempo Push-Ups", muscle: ["chest","triceps"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Push Press", muscle: ["shoulders","triceps"], equipment: ["barbell","dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Arnold Press", muscle: ["shoulders","triceps"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Tempo Bench Press", muscle: ["chest","triceps"], equipment: ["barbell","dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Dumbbell Decline Press", muscle: ["chest","triceps"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Floor Press", muscle: ["chest","triceps"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Dumbbell Z-Press", muscle: ["shoulders","core","triceps"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Dumbbell Push Press", muscle: ["shoulders","triceps","quads"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Thruster", muscle: ["shoulders","quads","glutes","triceps"], equipment: ["dumbbells"], group: ["push","full_body","cardio"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Dumbbell Snatch", muscle: ["shoulders","back","glutes","hamstrings"], equipment: ["dumbbells"], group: ["pull","full_body","cardio"], pattern: "ballistic", difficulty: "advanced" },
  { name: "Dumbbell Clean", muscle: ["back","glutes","shoulders"], equipment: ["dumbbells"], group: ["pull","full_body"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Dumbbell Clean and Press", muscle: ["shoulders","back","glutes","triceps"], equipment: ["dumbbells"], group: ["push","pull","full_body"], pattern: "ballistic", difficulty: "advanced" },
  { name: "Dumbbell Crush Press", muscle: ["chest","triceps"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Dumbbell Skull Crusher", muscle: ["triceps"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Dumbbell Upright Row", muscle: ["shoulders","back"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Dumbbell Cuban Press", muscle: ["shoulders"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Tate Press", muscle: ["triceps"], equipment: ["dumbbells"], group: ["push","upper"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Dumbbell Y-Raise", muscle: ["shoulders","back"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },

  // ─── PULL / BACK ────────────────────────────────────────────────────────
  { name: "Pull-Ups", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Chin-Ups", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Inverted Rows", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Wide-Grip Pull-Ups", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Neutral-Grip Pull-Ups", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Commando Pull-Ups", muscle: ["back","biceps","core"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Towel Pull-Ups", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Assisted Pull-Ups", muscle: ["back","biceps"], equipment: ["bodyweight","bands"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Negative Pull-Ups", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Australian Pull-Ups", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Superman Hold", muscle: ["back","core"], equipment: ["bodyweight"], group: ["pull"], pattern: "isolation", difficulty: "beginner" },
  { name: "Dumbbell Row", muscle: ["back","biceps"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Renegade Row", muscle: ["back","core"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Curl", muscle: ["biceps"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Hammer Curl", muscle: ["biceps"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Reverse Fly", muscle: ["shoulders","back"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Dumbbell Pullover", muscle: ["back","chest"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Row", muscle: ["back","biceps"], equipment: ["barbell"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Curl", muscle: ["biceps"], equipment: ["barbell"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Pendlay Row", muscle: ["back"], equipment: ["barbell"], group: ["pull","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Weighted Pull-Ups", muscle: ["back","biceps"], equipment: ["bodyweight","dumbbells"], group: ["pull","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Muscle-Ups", muscle: ["back","chest","triceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Archer Pull-Ups", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Single-Arm Dumbbell Row", muscle: ["back","biceps"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Concentration Curl", muscle: ["biceps"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Spider Curl", muscle: ["biceps"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Preacher Curl", muscle: ["biceps"], equipment: ["barbell","dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Dumbbell Pendlay Row", muscle: ["back","biceps"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Drag Curl", muscle: ["biceps"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Dumbbell Reverse Curl", muscle: ["biceps"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Dumbbell Zottman Curl", muscle: ["biceps"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Dumbbell Shrug", muscle: ["back","shoulders"], equipment: ["dumbbells"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Barbell Push Press", muscle: ["shoulders","triceps","quads"], equipment: ["barbell"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Thruster", muscle: ["shoulders","quads","glutes","triceps"], equipment: ["barbell"], group: ["push","full_body","cardio"], pattern: "ballistic", difficulty: "advanced" },
  { name: "Barbell Power Clean", muscle: ["back","glutes","shoulders","quads"], equipment: ["barbell"], group: ["pull","full_body"], pattern: "ballistic", difficulty: "advanced" },
  { name: "Barbell Hang Clean", muscle: ["back","glutes","shoulders"], equipment: ["barbell"], group: ["pull","full_body"], pattern: "ballistic", difficulty: "advanced" },
  { name: "Barbell Clean and Press", muscle: ["shoulders","back","glutes","triceps"], equipment: ["barbell"], group: ["push","pull","full_body"], pattern: "ballistic", difficulty: "advanced" },
  { name: "Barbell Power Snatch", muscle: ["shoulders","back","glutes","hamstrings"], equipment: ["barbell"], group: ["pull","full_body"], pattern: "ballistic", difficulty: "advanced" },
  { name: "Barbell Yates Row", muscle: ["back","biceps"], equipment: ["barbell"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Drag Curl", muscle: ["biceps"], equipment: ["barbell"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Barbell Skull Crusher", muscle: ["triceps"], equipment: ["barbell"], group: ["push","upper"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Barbell Reverse Curl", muscle: ["biceps"], equipment: ["barbell"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Barbell Shrug", muscle: ["back","shoulders"], equipment: ["barbell"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Barbell Floor Press", muscle: ["chest","triceps"], equipment: ["barbell"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Decline Bench Press", muscle: ["chest","triceps"], equipment: ["barbell"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Lat Pulldown", muscle: ["back","biceps"], equipment: ["machine"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Cable Row", muscle: ["back","biceps"], equipment: ["machine"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Face Pulls", muscle: ["shoulders","back"], equipment: ["machine"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Cable Bicep Curl", muscle: ["biceps"], equipment: ["machine"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Row", muscle: ["back","biceps"], equipment: ["bands"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Banded Pull-Apart", muscle: ["shoulders","back"], equipment: ["bands"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Bicep Curl", muscle: ["biceps"], equipment: ["bands"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Tricep Pushdown", muscle: ["triceps"], equipment: ["bands"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Face Pull", muscle: ["shoulders","back"], equipment: ["bands"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Front Raise", muscle: ["shoulders"], equipment: ["bands"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Lateral Raise", muscle: ["shoulders"], equipment: ["bands"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Lat Pulldown", muscle: ["back","biceps"], equipment: ["bands"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Banded Overhead Extension", muscle: ["triceps"], equipment: ["bands"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Reverse Fly", muscle: ["shoulders","back"], equipment: ["bands"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Cable Pull-Through", muscle: ["glutes","hamstrings"], equipment: ["machine"], group: ["pull","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Cable Hammer Curl", muscle: ["biceps"], equipment: ["machine"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Cable Lateral Raise", muscle: ["shoulders"], equipment: ["machine"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Cable Front Raise", muscle: ["shoulders"], equipment: ["machine"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Cable Reverse Fly", muscle: ["shoulders","back"], equipment: ["machine"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Cable Wood Chop", muscle: ["core"], equipment: ["machine"], group: ["core"], pattern: "compound", difficulty: "intermediate" },
  { name: "Cable Crossover", muscle: ["chest"], equipment: ["machine"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Smith Machine Bench Press", muscle: ["chest","triceps"], equipment: ["machine"], group: ["push","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Pec Deck", muscle: ["chest"], equipment: ["machine"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Cable Overhead Tricep Extension", muscle: ["triceps"], equipment: ["machine"], group: ["push","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Single-Arm Cable Row", muscle: ["back","biceps"], equipment: ["machine"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "T-Bar Row", muscle: ["back","biceps"], equipment: ["machine"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Cable Lateral Raise 21s", muscle: ["shoulders"], equipment: ["machine"], group: ["push","upper"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Kettlebell Swing", muscle: ["back","glutes","hamstrings"], equipment: ["kettlebell"], group: ["pull","cardio","full_body"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Kettlebell Single-Arm Swing", muscle: ["back","glutes","hamstrings","core"], equipment: ["kettlebell"], group: ["pull","cardio","full_body"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Kettlebell American Swing", muscle: ["back","glutes","shoulders"], equipment: ["kettlebell"], group: ["pull","cardio","full_body"], pattern: "ballistic", difficulty: "advanced" },
  { name: "Kettlebell High Pull", muscle: ["back","shoulders"], equipment: ["kettlebell"], group: ["pull","upper"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Kettlebell Snatch", muscle: ["back","shoulders","glutes","hamstrings"], equipment: ["kettlebell"], group: ["pull","full_body","cardio"], pattern: "ballistic", difficulty: "advanced" },
  { name: "Kettlebell Clean", muscle: ["back","glutes","shoulders"], equipment: ["kettlebell"], group: ["pull","full_body"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Kettlebell Clean and Press", muscle: ["shoulders","back","glutes","triceps"], equipment: ["kettlebell"], group: ["push","pull","full_body"], pattern: "ballistic", difficulty: "advanced" },

  // ─── KB SPORT (GIREVOY) ─────────────────────────────────────────────────
  // Competition lifts. Used by the "KB Sport" goal as 8-10 min continuous
  // time blocks. kbSport: true is a picker hint so these lifts dominate
  // when that goal is selected.
  { name: "Kettlebell Long Cycle", muscle: ["full_body","shoulders","back","glutes","quads"], equipment: ["kettlebell"], group: ["push","pull","full_body","cardio"], pattern: "ballistic", difficulty: "advanced", kbSport: true },
  { name: "Kettlebell Jerk", muscle: ["shoulders","triceps","quads","core"], equipment: ["kettlebell"], group: ["push","full_body","cardio"], pattern: "ballistic", difficulty: "intermediate", kbSport: true },
  { name: "Kettlebell Push Jerk", muscle: ["shoulders","triceps","quads","core"], equipment: ["kettlebell"], group: ["push","full_body","cardio"], pattern: "ballistic", difficulty: "intermediate", kbSport: true },
  { name: "Kettlebell Half Snatch", muscle: ["back","shoulders","glutes","hamstrings"], equipment: ["kettlebell"], group: ["pull","full_body","cardio"], pattern: "ballistic", difficulty: "intermediate", kbSport: true },
  { name: "Kettlebell One-Arm Long Cycle", muscle: ["full_body","shoulders","back","glutes","core"], equipment: ["kettlebell"], group: ["push","pull","full_body","cardio"], pattern: "ballistic", difficulty: "advanced", kbSport: true },
  { name: "Kettlebell One-Arm Jerk", muscle: ["shoulders","triceps","core","quads"], equipment: ["kettlebell"], group: ["push","full_body","cardio"], pattern: "ballistic", difficulty: "intermediate", kbSport: true },
  { name: "Kettlebell Single-Arm Row", muscle: ["back","biceps","core"], equipment: ["kettlebell"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Bent-Over Row", muscle: ["back","biceps"], equipment: ["kettlebell"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  // Added 2026-06: beginner KB users only had 2 pull options before. These
  // expand the rotation without raising difficulty — both are technique-
  // friendly variations that don't require extra equipment beyond a KB.
  { name: "Kettlebell Dead-Stop Row", muscle: ["back","biceps","core"], equipment: ["kettlebell"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Pendlay Row", muscle: ["back","biceps"], equipment: ["kettlebell"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Gorilla Row", muscle: ["back","biceps","core"], equipment: ["kettlebell"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Renegade Row", muscle: ["back","core","biceps"], equipment: ["kettlebell"], group: ["pull","upper","core"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Curl", muscle: ["biceps"], equipment: ["kettlebell"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },

  // ─── LEGS ───────────────────────────────────────────────────────────────
  { name: "Bodyweight Squat", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Jump Squat", muscle: ["quads","glutes","calves"], equipment: ["bodyweight"], group: ["legs","lower","cardio"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Walking Lunges", muscle: ["quads","glutes","hamstrings"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Reverse Lunges", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Bulgarian Split Squat", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Glute Bridge", muscle: ["glutes","hamstrings"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Single-Leg Glute Bridge", muscle: ["glutes","hamstrings"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Pistol Squat", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "advanced" },
  { name: "Sumo Squat", muscle: ["quads","glutes","hamstrings"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Sissy Squat", muscle: ["quads"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Curtsy Lunge", muscle: ["glutes","quads"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Lateral Lunge", muscle: ["quads","glutes","hamstrings"], equipment: ["bodyweight"], group: ["legs","lower","mobility"], pattern: "compound", difficulty: "beginner" },
  { name: "Jumping Lunge", muscle: ["quads","glutes","calves"], equipment: ["bodyweight"], group: ["legs","lower","cardio"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Shrimp Squat Assist", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Single-Leg Calf Raise", muscle: ["calves"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Shrimp Squat", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "advanced" },
  { name: "Nordic Hamstring Curl", muscle: ["hamstrings"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "isolation", difficulty: "advanced" },
  { name: "Tempo Back Squat", muscle: ["quads","glutes"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "advanced" },
  { name: "Single-Leg Romanian Deadlift", muscle: ["hamstrings","glutes"], equipment: ["dumbbells","kettlebell","bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Pause Squat", muscle: ["quads","glutes"], equipment: ["barbell","dumbbells"], group: ["legs","lower"], pattern: "compound", difficulty: "advanced" },
  { name: "Deficit Deadlift", muscle: ["hamstrings","glutes","back"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "advanced" },
  { name: "Dumbbell Front Squat", muscle: ["quads","glutes","core"], equipment: ["dumbbells"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Reverse Lunge", muscle: ["quads","glutes"], equipment: ["dumbbells"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Dumbbell Lateral Lunge", muscle: ["quads","glutes","hamstrings"], equipment: ["dumbbells"], group: ["legs","lower","mobility"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Bulgarian Split Squat", muscle: ["quads","glutes"], equipment: ["dumbbells"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Sumo Deadlift", muscle: ["glutes","hamstrings","back"], equipment: ["dumbbells"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Suitcase Deadlift", muscle: ["glutes","hamstrings","back","core"], equipment: ["dumbbells"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "beginner" },
  { name: "Dumbbell Stiff-Leg Deadlift", muscle: ["hamstrings","glutes"], equipment: ["dumbbells"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Lunge", muscle: ["quads","glutes","hamstrings"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Reverse Lunge", muscle: ["quads","glutes"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Step-Up", muscle: ["quads","glutes"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Box Squat", muscle: ["quads","glutes"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Bulgarian Split Squat", muscle: ["quads","glutes"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "advanced" },
  { name: "Barbell Sumo Deadlift", muscle: ["glutes","hamstrings","back"], equipment: ["barbell"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Stiff-Leg Deadlift", muscle: ["hamstrings","glutes"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Good Morning", muscle: ["hamstrings","glutes","back"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Barbell Rack Pull", muscle: ["back","glutes","hamstrings"], equipment: ["barbell"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "intermediate" },
  { name: "Banded Lateral Walk", muscle: ["glutes"], equipment: ["bands"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Monster Walk", muscle: ["glutes","quads"], equipment: ["bands"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Clamshell", muscle: ["glutes"], equipment: ["bands"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Single-Leg Glute Bridge", muscle: ["glutes","hamstrings"], equipment: ["bands"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded RDL", muscle: ["hamstrings","glutes"], equipment: ["bands"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Banded Pull-Through", muscle: ["glutes","hamstrings"], equipment: ["bands"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "beginner" },
  { name: "Banded Hip Thrust", muscle: ["glutes","hamstrings"], equipment: ["bands"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Hack Squat Machine", muscle: ["quads","glutes"], equipment: ["machine"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Smith Machine Squat", muscle: ["quads","glutes"], equipment: ["machine"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Hip Abduction Machine", muscle: ["glutes"], equipment: ["machine"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Hip Adduction Machine", muscle: ["quads"], equipment: ["machine"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Glute Kickback", muscle: ["glutes"], equipment: ["machine"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Reverse Hyperextension", muscle: ["glutes","hamstrings","back"], equipment: ["machine"], group: ["legs","lower"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Calf Raises", muscle: ["calves"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Wall Sit", muscle: ["quads"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Goblet Squat", muscle: ["quads","glutes"], equipment: ["dumbbells","kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Dumbbell Lunge", muscle: ["quads","glutes"], equipment: ["dumbbells"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Dumbbell Romanian Deadlift", muscle: ["hamstrings","glutes"], equipment: ["dumbbells"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Dumbbell Step-Up", muscle: ["quads","glutes"], equipment: ["dumbbells"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Back Squat", muscle: ["quads","glutes"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Front Squat", muscle: ["quads","glutes","core"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "advanced" },
  { name: "Deadlift", muscle: ["hamstrings","glutes","back"], equipment: ["barbell"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "intermediate" },
  { name: "Romanian Deadlift", muscle: ["hamstrings","glutes"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Hip Thrust", muscle: ["glutes","hamstrings"], equipment: ["barbell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Leg Press", muscle: ["quads","glutes"], equipment: ["machine"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Leg Curl", muscle: ["hamstrings"], equipment: ["machine"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Leg Extension", muscle: ["quads"], equipment: ["machine"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Seated Calf Raise", muscle: ["calves"], equipment: ["machine"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Squat", muscle: ["quads","glutes"], equipment: ["bands"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Banded Glute Bridge", muscle: ["glutes"], equipment: ["bands"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Kettlebell Front Squat", muscle: ["quads","glutes","core"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Double Front Squat", muscle: ["quads","glutes","core"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "advanced" },
  { name: "Kettlebell Sumo Squat", muscle: ["quads","glutes","hamstrings"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Lunge", muscle: ["quads","glutes","hamstrings"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Reverse Lunge", muscle: ["quads","glutes"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Racked Lunge", muscle: ["quads","glutes","core"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Bulgarian Split Squat", muscle: ["quads","glutes"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Step-Up", muscle: ["quads","glutes"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  // Beginner-accessible KB squat-bucket variations — added because users on
  // beginner difficulty were stuck with 5 KB leg options (lunge, reverse
  // lunge, goblet, sumo, step-up) and the rotation felt repetitive across
  // sessions. These add frontal-plane (lateral), transverse-plane (curtsy),
  // technique-focused (pause), and locomotor (walking) variety without
  // raising the difficulty bar.
  { name: "Kettlebell Lateral Lunge", muscle: ["quads","glutes","hamstrings"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Curtsy Lunge", muscle: ["quads","glutes"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Pause Squat", muscle: ["quads","glutes","core"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Walking Lunge", muscle: ["quads","glutes","hamstrings"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Cossack Squat", muscle: ["quads","glutes","hamstrings"], equipment: ["kettlebell"], group: ["legs","lower","mobility"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Suitcase Deadlift", muscle: ["glutes","hamstrings","back","core"], equipment: ["kettlebell"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "beginner" },
  // Added 2026-06: beginner KB users had ONLY Suitcase Deadlift as a hinge
  // option — every session repeated the same lift. These add the basic
  // two-hand KB deadlift (foundational pull-from-floor pattern), a supine
  // glute-bridge variation (no spinal load — accessible recovery work), and
  // a Good Morning (hip-hinge teaching tool with a light bell at chest).
  { name: "Kettlebell Deadlift", muscle: ["glutes","hamstrings","back"], equipment: ["kettlebell"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Glute Bridge", muscle: ["glutes","hamstrings"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Good Morning", muscle: ["hamstrings","glutes","back"], equipment: ["kettlebell"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "beginner" },
  { name: "Kettlebell Sumo Deadlift", muscle: ["glutes","hamstrings","back"], equipment: ["kettlebell"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Romanian Deadlift", muscle: ["hamstrings","glutes","back"], equipment: ["kettlebell"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Stiff-Leg Deadlift", muscle: ["hamstrings","glutes"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  // High-tier KB hinge variants — added 2026-06 to give the progression
  // chain real terminal nodes for users who've capped a single bell at
  // their stated max. Single-Arm RDL = unilateral offset overload, Double
  // RDL = legitimate jump to 2× the bell weight.
  { name: "Kettlebell Single-Arm RDL", muscle: ["hamstrings","glutes","back","core"], equipment: ["kettlebell"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Double Romanian Deadlift", muscle: ["hamstrings","glutes","back"], equipment: ["kettlebell"], group: ["legs","lower","pull"], pattern: "compound", difficulty: "advanced" },
  { name: "Kettlebell Pistol Squat Assist", muscle: ["quads","glutes","core"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "advanced" },

  // ─── CORE ───────────────────────────────────────────────────────────────
  { name: "Plank", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Side Plank", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Crunches", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Bicycle Crunches", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Russian Twists", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Leg Raises", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Hanging Knee Raises", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Hollow Body Hold", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Dead Bug", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Bird Dog", muscle: ["core","back"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Mountain Climbers", muscle: ["core"], equipment: ["bodyweight"], group: ["core","cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "V-Ups", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Weighted Russian Twist", muscle: ["core"], equipment: ["dumbbells","kettlebell"], group: ["core"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Cable Crunch", muscle: ["core"], equipment: ["machine"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Ab Wheel Rollout", muscle: ["core"], equipment: ["machine"], group: ["core"], pattern: "isolation", difficulty: "advanced" },
  { name: "Dragon Flag", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "advanced" },
  { name: "L-Sit Hold", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "advanced" },
  { name: "Hanging Toes-to-Bar", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "advanced" },
  { name: "Reverse Crunch", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Scissor Kicks", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Flutter Kicks", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Hollow Rocks", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Plank Up-Down", muscle: ["core","shoulders","triceps"], equipment: ["bodyweight"], group: ["core","upper"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Toe Touch Crunch", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "beginner" },
  { name: "Side Plank Raises", muscle: ["core"], equipment: ["bodyweight"], group: ["core"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Kettlebell Turkish Get-Up", muscle: ["full_body","shoulders","core"], equipment: ["kettlebell"], group: ["full_body","core","upper","lower"], pattern: "compound", difficulty: "advanced" },
  { name: "Kettlebell Half Get-Up", muscle: ["shoulders","core"], equipment: ["kettlebell"], group: ["core","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell Windmill", muscle: ["core","shoulders","hamstrings"], equipment: ["kettlebell"], group: ["core","mobility"], pattern: "isolation", difficulty: "advanced" },
  { name: "Kettlebell Side Bend", muscle: ["core"], equipment: ["kettlebell"], group: ["core"], pattern: "isolation", difficulty: "beginner" },

  // ─── CARDIO / CONDITIONING ──────────────────────────────────────────────
  { name: "Jumping Jacks", muscle: ["full_body"], equipment: ["bodyweight"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "High Knees", muscle: ["full_body"], equipment: ["bodyweight"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Burpees", muscle: ["full_body"], equipment: ["bodyweight"], group: ["cardio","full_body"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Box Jumps", muscle: ["quads","glutes","calves"], equipment: ["bodyweight"], group: ["cardio","legs"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Skater Hops", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["cardio","legs"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Shadow Boxing", muscle: ["full_body"], equipment: ["bodyweight"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Jump Rope", muscle: ["calves","shoulders"], equipment: ["bodyweight"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Bear Crawl", muscle: ["full_body","core"], equipment: ["bodyweight"], group: ["cardio","full_body"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Crab Walk", muscle: ["full_body","core","shoulders"], equipment: ["bodyweight"], group: ["cardio","full_body"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Tuck Jumps", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["cardio","legs"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Broad Jumps", muscle: ["quads","glutes","hamstrings"], equipment: ["bodyweight"], group: ["cardio","legs"], pattern: "ballistic", difficulty: "intermediate" },
  { name: "Burpee Pull-Ups", muscle: ["full_body","back"], equipment: ["bodyweight"], group: ["cardio","full_body"], pattern: "conditioning", difficulty: "advanced" },
  { name: "Assault Bike", muscle: ["full_body","quads"], equipment: ["cardio_machine"], group: ["cardio","full_body"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "SkiErg", muscle: ["back","shoulders","core","full_body"], equipment: ["cardio_machine"], group: ["cardio","upper","full_body"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Sled Push", muscle: ["quads","glutes","calves"], equipment: ["cardio_machine"], group: ["cardio","legs","full_body"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Kettlebell Suitcase Carry", muscle: ["core","back","full_body"], equipment: ["kettlebell"], group: ["full_body","core","cardio"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Kettlebell Racked Carry", muscle: ["core","shoulders","full_body"], equipment: ["kettlebell"], group: ["full_body","core","upper"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Kettlebell Overhead Carry", muscle: ["shoulders","core","full_body"], equipment: ["kettlebell"], group: ["full_body","upper","core"], pattern: "conditioning", difficulty: "advanced" },
  { name: "Kettlebell Farmer's Carry", muscle: ["full_body","core","back"], equipment: ["kettlebell","dumbbells"], group: ["full_body","core","cardio"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Kettlebell Front Rack March", muscle: ["core","shoulders","quads"], equipment: ["kettlebell"], group: ["full_body","core"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Treadmill Run", muscle: ["full_body"], equipment: ["cardio_machine"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Stationary Bike", muscle: ["quads"], equipment: ["cardio_machine"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Rowing Machine", muscle: ["back","legs","core"], equipment: ["cardio_machine"], group: ["cardio","full_body"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Elliptical", muscle: ["full_body"], equipment: ["cardio_machine"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Stair Climber", muscle: ["quads","glutes"], equipment: ["cardio_machine"], group: ["cardio","legs"], pattern: "conditioning", difficulty: "beginner" },

  // ─── MOBILITY ───────────────────────────────────────────────────────────
  { name: "Cat-Cow", muscle: ["back","core"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Downward Dog", muscle: ["full_body"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "World's Greatest Stretch", muscle: ["full_body"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Hip Flexor Stretch", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Pigeon Pose", muscle: ["glutes"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Thoracic Rotations", muscle: ["back"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Shoulder Dislocates", muscle: ["shoulders"], equipment: ["bodyweight","bands"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Couch Stretch", muscle: ["quads"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Cossack Squat", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["mobility","legs"], pattern: "mobility", difficulty: "intermediate" },
  { name: "90/90 Hip Stretch", muscle: ["glutes"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Kettlebell Around-the-World", muscle: ["shoulders","core"], equipment: ["kettlebell"], group: ["mobility","upper"], pattern: "mobility", difficulty: "beginner" },
  { name: "Kettlebell Figure 8", muscle: ["core","shoulders"], equipment: ["kettlebell"], group: ["mobility","full_body"], pattern: "mobility", difficulty: "beginner" },
  { name: "Cobra Pose", muscle: ["back","core"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Child's Pose", muscle: ["back","shoulders"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Frog Stretch", muscle: ["glutes","hamstrings"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Deep Squat Hold", muscle: ["quads","glutes","hamstrings"], equipment: ["bodyweight"], group: ["mobility","legs"], pattern: "mobility", difficulty: "beginner" },
  { name: "Standing Forward Fold", muscle: ["hamstrings","back"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Seated Spinal Twist", muscle: ["back","core"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "beginner" },
  { name: "Wall Angels", muscle: ["shoulders","back"], equipment: ["bodyweight"], group: ["mobility","upper"], pattern: "mobility", difficulty: "beginner" },
  { name: "Scapular Pull-Ups", muscle: ["back","shoulders"], equipment: ["bodyweight"], group: ["mobility","upper"], pattern: "mobility", difficulty: "intermediate" },
  { name: "Pike Walk", muscle: ["hamstrings","shoulders","core"], equipment: ["bodyweight"], group: ["mobility","full_body"], pattern: "mobility", difficulty: "intermediate" },

  // ─── ANIMAL FLOW / GROUND MOVEMENT ──────────────────────────────────────
  // Ground-based movement system: quadrupedal positions, animal-pattern
  // locomotion, flow-style sequences. Pure bodyweight, zero furniture —
  // perfect for floor-only / hotel-room workouts and active-recovery days.
  // Tagged with "full_body" so the muscle-cap logic doesn't double up.
  { name: "Beast Hold", muscle: ["full_body","core","shoulders"], equipment: ["bodyweight"], group: ["mobility","full_body","core"], pattern: "mobility", difficulty: "intermediate" },
  { name: "Crab Hold", muscle: ["full_body","core","shoulders","glutes"], equipment: ["bodyweight"], group: ["mobility","full_body","core"], pattern: "mobility", difficulty: "beginner" },
  { name: "Loaded Beast Rock", muscle: ["full_body","core","shoulders","quads"], equipment: ["bodyweight"], group: ["mobility","full_body"], pattern: "mobility", difficulty: "intermediate" },
  { name: "Ape Hold", muscle: ["quads","glutes","core"], equipment: ["bodyweight"], group: ["mobility","legs","full_body"], pattern: "mobility", difficulty: "beginner" },
  { name: "Beast Reach", muscle: ["full_body","core","shoulders"], equipment: ["bodyweight"], group: ["mobility","full_body","core"], pattern: "mobility", difficulty: "intermediate" },
  { name: "Scorpion Reach", muscle: ["full_body","core","back"], equipment: ["bodyweight"], group: ["mobility","full_body","core"], pattern: "mobility", difficulty: "intermediate" },
  { name: "Crab Reach", muscle: ["full_body","core","shoulders","glutes"], equipment: ["bodyweight"], group: ["mobility","full_body","core"], pattern: "mobility", difficulty: "beginner" },
  { name: "Ape Reach", muscle: ["quads","glutes","core","shoulders"], equipment: ["bodyweight"], group: ["mobility","legs","full_body"], pattern: "mobility", difficulty: "beginner" },
  { name: "Forward Beast Travel", muscle: ["full_body","core","shoulders"], equipment: ["bodyweight"], group: ["cardio","full_body","core"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Lateral Beast Travel", muscle: ["full_body","core","shoulders"], equipment: ["bodyweight"], group: ["cardio","full_body","core"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Ape Hop", muscle: ["quads","glutes","core"], equipment: ["bodyweight"], group: ["cardio","legs","full_body"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Underswitch", muscle: ["full_body","core","shoulders"], equipment: ["bodyweight"], group: ["full_body","core"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Side Kick Through", muscle: ["full_body","core","shoulders"], equipment: ["bodyweight"], group: ["full_body","core"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Front Step Through", muscle: ["full_body","core","shoulders","hamstrings"], equipment: ["bodyweight"], group: ["full_body","core","mobility"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Beast to Crab Switch", muscle: ["full_body","core","shoulders"], equipment: ["bodyweight"], group: ["full_body","core"], pattern: "conditioning", difficulty: "intermediate" },

  // ─── PREHAB / ACTIVATION ────────────────────────────────────────────────
  // Targeted activation + injury-prevention work. Most are isolation/mobility
  // pattern, so they support mobility/recovery sessions and fill accessory
  // slots without competing with main compound work in standard sessions.
  { name: "Lateral Band Walk", muscle: ["glutes"], equipment: ["bands","bodyweight"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Copenhagen Plank", muscle: ["core","glutes"], equipment: ["bodyweight"], group: ["core","lower"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Tibialis Raise", muscle: ["calves"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Y-T-W Raises", muscle: ["shoulders","back"], equipment: ["bodyweight","dumbbells"], group: ["mobility","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Wall Slides", muscle: ["shoulders","back"], equipment: ["bodyweight"], group: ["mobility","upper"], pattern: "mobility", difficulty: "beginner" },
  { name: "Band Pull-Apart", muscle: ["shoulders","back"], equipment: ["bands"], group: ["upper","mobility"], pattern: "isolation", difficulty: "beginner" },
  { name: "External Rotation", muscle: ["shoulders"], equipment: ["bands","dumbbells"], group: ["upper","mobility"], pattern: "isolation", difficulty: "beginner" },
  { name: "Sleeper Stretch", muscle: ["shoulders"], equipment: ["bodyweight"], group: ["mobility","upper"], pattern: "mobility", difficulty: "beginner" },
  { name: "Bretzel Stretch", muscle: ["back","quads"], equipment: ["bodyweight"], group: ["mobility"], pattern: "mobility", difficulty: "intermediate" },
  { name: "Pallof Press", muscle: ["core"], equipment: ["bands"], group: ["core"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Wrist Curl", muscle: ["biceps"], equipment: ["dumbbells","bodyweight"], group: ["upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Reverse Wrist Curl", muscle: ["biceps"], equipment: ["dumbbells","bodyweight"], group: ["upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Ankle Circles", muscle: ["calves"], equipment: ["bodyweight"], group: ["mobility","lower"], pattern: "mobility", difficulty: "beginner" },
];

// Prescriptions per goal: {sets, reps, rest_sec}
const PRESCRIPTIONS = {
  strength:    { sets: [4, 5], reps: [4, 6],   rest: 180, isoReps: [8, 10] },
  hypertrophy: { sets: [3, 4], reps: [8, 12],  rest: 75,  isoReps: [12, 15] },
  fat_loss:    { sets: [3, 4], reps: [12, 15], rest: 45,  isoReps: [15, 20] },
  endurance:   { sets: [2, 3], reps: [15, 20], rest: 30,  isoReps: [20, 25] },
  mobility:    { sets: [2, 3], reps: [8, 12],  rest: 20,  isoReps: [10, 12] },
  // Light loaded session for when you're under-recovered. Easy to start,
  // promotes blood flow without adding stress. Keep momentum, don't dig in.
  recovery:    { sets: [2, 3], reps: [10, 15], rest: 60,  isoReps: [12, 18] },
};

// How many exercises to pick by duration (minutes)
const COUNT_BY_DURATION = {
  15: 4,
  30: 6,
  45: 8,
  60: 10,
  90: 12,
};

// ─── PROGRESSION CHAINS ──────────────────────────────────────────────────
// Maps exercise → family + tier. When a user plateaus on a given exercise
// (RIR ≤ 1 at their max load for 3+ sessions), the generator surfaces the
// next tier in the same family instead of rotating to a sibling. This is
// the "follow favor in history" mechanism: same chain, harder variant.
//
// Tiers are sport-science progressions, not arbitrary difficulty bumps:
//   T1 = base bilateral / two-hand variant (easiest leverage)
//   T2 = single-implement / unilateral variant (asymmetric load)
//   T3 = single-side or instability variant (max-difficulty single bell)
//   T4 = double-implement variant (real load jump)
//   T5 = explosive / fully advanced (Olympic-style)
//
// Adding a new family: pick a key (snake_case), list members by tier.
// detectPlateaus + getNextTierForFamily live in app.js and read this map.
const PROGRESSION_FAMILIES = {
  hinge_kb: {
    1: ["Kettlebell Suitcase Deadlift", "Kettlebell Deadlift", "Kettlebell Glute Bridge", "Kettlebell Good Morning"],
    2: ["Kettlebell Sumo Deadlift", "Kettlebell Romanian Deadlift", "Kettlebell Stiff-Leg Deadlift"],
    3: ["Single-Leg Romanian Deadlift", "Kettlebell Single-Arm RDL"],
    4: ["Kettlebell Double Romanian Deadlift"],
  },
  squat_kb: {
    1: ["Goblet Squat", "Kettlebell Sumo Squat", "Kettlebell Lunge", "Kettlebell Reverse Lunge", "Kettlebell Step-Up", "Kettlebell Lateral Lunge", "Kettlebell Curtsy Lunge", "Kettlebell Pause Squat", "Kettlebell Walking Lunge"],
    2: ["Kettlebell Front Squat", "Kettlebell Racked Lunge", "Kettlebell Bulgarian Split Squat", "Kettlebell Cossack Squat"],
    3: ["Kettlebell Pistol Squat Assist"],
    4: ["Kettlebell Double Front Squat"],
  },
  vpress_kb: {
    1: ["Kettlebell Overhead Press", "Kettlebell Arnold Press"],
    2: ["Kettlebell See-Saw Press"],
    3: ["Kettlebell Bottoms-Up Press", "Kettlebell Z-Press"],
    4: ["Kettlebell Double Press"],
  },
  hpress_kb: {
    1: ["Kettlebell Floor Press"],
  },
  hpull_kb: {
    1: ["Kettlebell Bent-Over Row", "Kettlebell Dead-Stop Row", "Kettlebell Pendlay Row"],
    2: ["Kettlebell Single-Arm Row"],
    3: ["Kettlebell Gorilla Row"],
    4: ["Kettlebell Renegade Row"],
  },
  ballistic_kb: {
    1: ["Kettlebell Swing"],
    2: ["Kettlebell Single-Arm Swing", "Kettlebell Clean"],
    3: ["Kettlebell American Swing", "Kettlebell Half Snatch"],
    4: ["Kettlebell Snatch", "Kettlebell Clean and Press"],
  },
};

// Reverse index: exercise name → { family, tier }. Built once at module
// load to make per-candidate lookups O(1) during generation scoring.
const PROGRESSION_INDEX = (() => {
  const idx = {};
  for (const [family, tiers] of Object.entries(PROGRESSION_FAMILIES)) {
    for (const [tier, names] of Object.entries(tiers)) {
      for (const n of names) {
        idx[n] = { family, tier: Number(tier) };
      }
    }
  }
  return idx;
})();
