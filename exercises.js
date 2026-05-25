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
  { name: "Dips", muscle: ["chest","triceps"], equipment: ["bodyweight"], group: ["push","upper"], pattern: "compound", difficulty: "intermediate" },

  // ─── PULL / BACK ────────────────────────────────────────────────────────
  { name: "Pull-Ups", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "advanced" },
  { name: "Chin-Ups", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },
  { name: "Inverted Rows", muscle: ["back","biceps"], equipment: ["bodyweight"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
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
  { name: "Lat Pulldown", muscle: ["back","biceps"], equipment: ["machine"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Cable Row", muscle: ["back","biceps"], equipment: ["machine"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Face Pulls", muscle: ["shoulders","back"], equipment: ["machine"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Cable Bicep Curl", muscle: ["biceps"], equipment: ["machine"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Banded Row", muscle: ["back","biceps"], equipment: ["bands"], group: ["pull","upper"], pattern: "compound", difficulty: "beginner" },
  { name: "Banded Pull-Apart", muscle: ["shoulders","back"], equipment: ["bands"], group: ["pull","upper"], pattern: "isolation", difficulty: "beginner" },
  { name: "Kettlebell Swing", muscle: ["back","glutes","hamstrings"], equipment: ["kettlebell"], group: ["pull","cardio","full_body"], pattern: "compound", difficulty: "intermediate" },
  { name: "Kettlebell High Pull", muscle: ["back","shoulders"], equipment: ["kettlebell"], group: ["pull","upper"], pattern: "compound", difficulty: "intermediate" },

  // ─── LEGS ───────────────────────────────────────────────────────────────
  { name: "Bodyweight Squat", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Jump Squat", muscle: ["quads","glutes","calves"], equipment: ["bodyweight"], group: ["legs","lower","cardio"], pattern: "compound", difficulty: "intermediate" },
  { name: "Walking Lunges", muscle: ["quads","glutes","hamstrings"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Reverse Lunges", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },
  { name: "Bulgarian Split Squat", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "intermediate" },
  { name: "Glute Bridge", muscle: ["glutes","hamstrings"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "isolation", difficulty: "beginner" },
  { name: "Single-Leg Glute Bridge", muscle: ["glutes","hamstrings"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "isolation", difficulty: "intermediate" },
  { name: "Pistol Squat", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["legs","lower"], pattern: "compound", difficulty: "advanced" },
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
  { name: "Kettlebell Goblet Squat", muscle: ["quads","glutes"], equipment: ["kettlebell"], group: ["legs","lower"], pattern: "compound", difficulty: "beginner" },

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

  // ─── CARDIO / CONDITIONING ──────────────────────────────────────────────
  { name: "Jumping Jacks", muscle: ["full_body"], equipment: ["bodyweight"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "High Knees", muscle: ["full_body"], equipment: ["bodyweight"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Burpees", muscle: ["full_body"], equipment: ["bodyweight"], group: ["cardio","full_body"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Box Jumps", muscle: ["quads","glutes","calves"], equipment: ["bodyweight"], group: ["cardio","legs"], pattern: "conditioning", difficulty: "intermediate" },
  { name: "Skater Hops", muscle: ["quads","glutes"], equipment: ["bodyweight"], group: ["cardio","legs"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Shadow Boxing", muscle: ["full_body"], equipment: ["bodyweight"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Jump Rope", muscle: ["calves","shoulders"], equipment: ["bodyweight"], group: ["cardio"], pattern: "conditioning", difficulty: "beginner" },
  { name: "Bear Crawl", muscle: ["full_body","core"], equipment: ["bodyweight"], group: ["cardio","full_body"], pattern: "conditioning", difficulty: "intermediate" },
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
];

// Prescriptions per goal: {sets, reps, rest_sec}
const PRESCRIPTIONS = {
  strength:    { sets: [4, 5], reps: [4, 6],   rest: 180, isoReps: [8, 10] },
  hypertrophy: { sets: [3, 4], reps: [8, 12],  rest: 75,  isoReps: [12, 15] },
  fat_loss:    { sets: [3, 4], reps: [12, 15], rest: 45,  isoReps: [15, 20] },
  endurance:   { sets: [2, 3], reps: [15, 20], rest: 30,  isoReps: [20, 25] },
  mobility:    { sets: [2, 3], reps: [8, 12],  rest: 20,  isoReps: [10, 12] },
};

// How many exercises to pick by duration (minutes)
const COUNT_BY_DURATION = {
  15: 4,
  30: 6,
  45: 8,
  60: 10,
  90: 12,
};
