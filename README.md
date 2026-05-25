# FORGE — Workout Generator

A zero-backend workout generator. Pick a goal, equipment, target muscle group, duration, and difficulty — get a custom session in seconds.

**Live demo:** https://smirsadykov.github.io/forge-workout/

## Features

- 5 goals (strength, hypertrophy, fat loss, endurance, mobility) with goal-appropriate sets/reps/rest prescriptions
- 7 equipment options (bodyweight, dumbbells, barbell, kettlebell, bands, machines, cardio)
- 8 target areas (full body, upper, lower, push, pull, legs, core, cardio)
- 100+ exercises with muscle group, equipment, and difficulty tagging
- Accounts (client-side, localStorage) with workout history save/load
- Smart de-duping — caps exercises per muscle group so sessions aren't all-chest
- Mobile-first responsive layout
- Modern dark theme

## Tech

Pure static site — HTML, CSS, vanilla JS. No build step, no backend, no dependencies.

## Run locally

Open `index.html` directly, or serve it:

```
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Caveats

Accounts live in `localStorage`, so they're per-browser. Passwords are salted + hashed (FNV-1a) — fine for a demo, not for anything you'd put a real lock on. Drop in Supabase / Firebase / a tiny Node API if you want real auth.
