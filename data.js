/* =========================================================================
   Program data — the source of truth for scheduled workouts.
   Everything is keyed by user so Caryn and (later) Chris stay fully separate.
   Dates are local 'YYYY-MM-DD'. Times are local wall-clock for display only.
   ========================================================================= */

// Tag -> visual treatment. Keep the vocabulary small and consistent.
const TAGS = {
  warmup:   { label: 'Warm-up',   accent: '#f6a15a' },
  upper:    { label: 'Upper Body',accent: '#7aa2ff' },
  lower:    { label: 'Lower Body',accent: '#8b7bff' },
  glutes:   { label: 'Glutes & Legs', accent: '#ff7ea8' },
  fullbody: { label: 'Full Body', accent: '#5fd0c5' },
  core:     { label: 'Core',      accent: '#ffd166' },
  ride:     { label: 'Ride',      accent: '#f78fb3' },
  cardio:   { label: 'Cardio',    accent: '#f6a15a' },
  walk:     { label: 'Walk',      accent: '#9ad17f' },
  hiit:     { label: 'HIIT',      accent: '#ff6b6b' },
  stretch:  { label: 'Stretch',   accent: '#a0aec0' },
  recovery: { label: 'Recovery',  accent: '#a0aec0' },
};

// A helper so the schedule below reads cleanly.
function block(id, time, title, detail, minutes, tag) {
  return { id, time, title, detail, minutes, tag };
}

/* -------------------------------------------------------------------------
   CARYN — 4-week block starting Monday, July 20, 2026.
   Mon / Wed / Fri, 6:30–7:15am.
   ------------------------------------------------------------------------- */
const CARYN_SESSIONS = [
  // ---- Week 1 ----
  {
    date: '2026-07-20', week: 1, day: 'Mon', focus: 'Upper Body + Glutes',
    window: '6:30–7:15 AM',
    blocks: [
      block('w1mon-1', '6:30', 'Treadmill warm-up', 'Easy pace to get the blood moving.', 5, 'warmup'),
      block('w1mon-2', '6:35', 'Upper Body Strength', 'Adrian Williams — choose a recent 20-min intermediate class.', 20, 'upper'),
      block('w1mon-3', '7:05', 'Glutes & Legs Strength', 'Selena Samuela (5/31/24) — EMOM-style glute workout.', 10, 'glutes'),
    ],
  },
  {
    date: '2026-07-22', week: 1, day: 'Wed', focus: 'Lower Body',
    window: '6:30–7:15 AM',
    blocks: [
      block('w1wed-1', '6:30', 'Glutes & Legs Strength', 'Selena Samuela (5/10/24) — heavy dumbbells, glute & leg focus.', 30, 'glutes'),
      block('w1wed-2', '7:00', 'Incline treadmill walk', 'Steady incline walk to finish the legs.', 10, 'walk'),
      block('w1wed-3', '7:10', 'Stretch', 'Cool down and stretch it out.', 5, 'stretch'),
    ],
  },
  {
    date: '2026-07-24', week: 1, day: 'Fri', focus: 'Full Body',
    window: '6:30–7:15 AM',
    blocks: [
      block('w1fri-1', '6:30', 'Full Body Strength', 'Jess Sims — 30 min.', 30, 'fullbody'),
      block('w1fri-2', '7:00', 'Glutes & Legs Strength', 'Selena Samuela (8/4/21) — hip bridges, clamshells, deadlifts.', 10, 'glutes'),
    ],
  },

  // ---- Week 2 ----
  {
    date: '2026-07-27', week: 2, day: 'Mon', focus: 'Upper Body + Core',
    window: '6:30–7:15 AM',
    blocks: [
      block('w2mon-1', '6:30', 'Upper Body Strength', 'Rad Lopez — 20 min.', 20, 'upper'),
      block('w2mon-2', '6:50', 'Strength Roll Call: Glutes & Legs', 'Selena Samuela (6/21/22) — 10 min.', 10, 'glutes'),
      block('w2mon-3', '7:00', 'Core', 'Olivia Amato — 10 min.', 10, 'core'),
    ],
  },
  {
    date: '2026-07-29', week: 2, day: 'Wed', focus: 'Lower Body',
    window: '6:30–7:15 AM',
    blocks: [
      block('w2wed-1', '6:30', 'Lower Body Strength', 'Rebecca Kennedy — 20 min.', 20, 'lower'),
      block('w2wed-2', '6:50', 'Glutes & Legs Strength', 'Selena Samuela (10/15/21) — 10 min.', 10, 'glutes'),
      block('w2wed-3', '7:00', 'Low Impact Ride', '10 min low impact ride.', 10, 'ride'),
    ],
  },
  {
    date: '2026-07-31', week: 2, day: 'Fri', focus: 'Full Body',
    window: '6:30–7:15 AM',
    blocks: [
      block('w2fri-1', '6:30', 'Full Body Strength', 'Adrian Williams — 20 min.', 20, 'fullbody'),
      block('w2fri-2', '6:50', 'Low Impact Ride', '15 min low impact ride.', 15, 'ride'),
      block('w2fri-3', '7:05', 'Glutes & Legs Strength', 'Selena Samuela (7/31/22) — 10 min.', 10, 'glutes'),
    ],
  },

  // ---- Week 3 ----
  {
    date: '2026-08-03', week: 3, day: 'Mon', focus: 'Upper Body + Core',
    window: '6:30–7:15 AM',
    blocks: [
      block('w3mon-1', '6:30', 'Upper Body Strength', 'Ben Alldis — 20 min.', 20, 'upper'),
      block('w3mon-2', '6:50', 'Core', 'Emma Lovewell — 10 min.', 10, 'core'),
      block('w3mon-3', '7:00', 'Glutes & Legs Strength', 'Selena Samuela (8/4/21) — 10 min.', 10, 'glutes'),
    ],
  },
  {
    date: '2026-08-05', week: 3, day: 'Wed', focus: 'Lower Body',
    window: '6:30–7:15 AM',
    blocks: [
      block('w3wed-1', '6:30', 'Glutes & Legs Strength', 'Selena Samuela (repeat 5/10/24, or a newer one if available) — 30 min.', 30, 'glutes'),
      block('w3wed-2', '7:00', 'Walk', '10 min walk to finish.', 10, 'walk'),
    ],
  },
  {
    date: '2026-08-07', week: 3, day: 'Fri', focus: 'Full Body + HIIT',
    window: '6:30–7:15 AM',
    blocks: [
      block('w3fri-1', '6:30', 'HIIT Ride', 'Kendall Toole — 20 min.', 20, 'hiit'),
      block('w3fri-2', '6:50', 'Full Body Strength', 'Adrian Williams — 15 min.', 15, 'fullbody'),
      block('w3fri-3', '7:05', 'Glutes & Legs Strength', 'Selena Samuela — 10 min.', 10, 'glutes'),
    ],
  },

  // ---- Week 4 ----
  {
    date: '2026-08-10', week: 4, day: 'Mon', focus: 'Upper Body',
    window: '6:30–7:15 AM',
    blocks: [
      block('w4mon-1', '6:30', 'Upper Body Strength', 'Rad Lopez — 30 min.', 30, 'upper'),
      block('w4mon-2', '7:00', 'Glutes & Legs Strength', 'Selena Samuela (5/31/24) — 10 min.', 10, 'glutes'),
    ],
  },
  {
    date: '2026-08-12', week: 4, day: 'Wed', focus: 'Lower Body',
    window: '6:30–7:15 AM',
    blocks: [
      block('w4wed-1', '6:30', 'Lower Body Strength', 'Callie Gullickson — 20 min.', 20, 'lower'),
      block('w4wed-2', '6:50', 'Glutes & Legs Strength', 'Selena Samuela (10/15/21) — 10 min.', 10, 'glutes'),
      block('w4wed-3', '7:00', 'Stretch', '10 min stretch.', 10, 'stretch'),
    ],
  },
  {
    date: '2026-08-14', week: 4, day: 'Fri', focus: 'Full Body',
    window: '6:30–7:15 AM',
    blocks: [
      block('w4fri-1', '6:30', 'Full Body Strength', 'Jess Sims — 30 min.', 30, 'fullbody'),
      block('w4fri-2', '7:00', 'Recovery Ride', '10 min recovery ride.', 10, 'recovery'),
      block('w4fri-3', '7:10', 'Glutes Stretch', '5 min glutes stretch.', 5, 'stretch'),
    ],
  },
];

// The user registry. Add Chris here later with his own sessions + goals.
const USERS = {
  caryn: {
    id: 'caryn',
    name: 'Caryn',
    emoji: '🌸',
    timezone: 'America/New_York',
    reminderTime: '06:15',
    goals: 'Build strength with a focus on glutes & legs; consistent 3x/week Peloton strength habit.',
    sessions: CARYN_SESSIONS,
  },
};

window.APP_DATA = { TAGS, USERS };
