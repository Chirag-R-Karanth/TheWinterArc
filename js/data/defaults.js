/* ==========================================================================
   DEFAULTS — goals, units, source priorities, connected sources
   ========================================================================== */

export const DEFAULT_GOALS = {
  steps: 10000,
  activeKcal: 600,
  sleepMin: 460,      // 7h 40m
  energyKcal: 2400,
  proteinG: 165,
  carbsG: 250,
  fatG: 75,
  waterMl: 2500,
  workoutsPerWeek: 5,
  weightKg: 78,
};

/** category -> ordered provider preference (highest first) */
export const DEFAULT_PRIORITIES = {
  steps: ["zepp", "apple-health", "google-fit"],
  distance: ["zepp", "apple-health", "google-fit"],
  heartRate: ["zepp", "apple-health"],
  hrv: ["zepp", "apple-health"],
  sleep: ["zepp", "apple-health"],
  workouts: ["strava", "hevy", "apple-health", "jefit", "lyfta"],
  nutrition: ["fatsecret", "apple-health"],
  body: ["apple-health", "zepp"],
  mood: ["how-we-feel", "bend"],
  stress: ["how-we-feel", "bend"],
};

export const CATEGORIES = [
  { id: "steps", label: "Steps & distance" },
  { id: "heartRate", label: "Heart rate & HRV" },
  { id: "sleep", label: "Sleep" },
  { id: "workouts", label: "Workouts" },
  { id: "nutrition", label: "Nutrition" },
  { id: "body", label: "Body weight" },
  { id: "mood", label: "Mood & stress" },
];

export const DEFAULT_SETTINGS = {
  theme: "light",
  units: "metric", // metric | imperial
  period: "week", // day | week | month
  reducedMotion: false,
  showProvenance: true,
  refreshMinutes: 15,
  notify: { weekly: true, lowRecovery: true, mealReminder: false, weighIn: true },
  profile: { name: "Alex", heightCm: 178, birthYear: 1994 },
  goals: { ...DEFAULT_GOALS },
  priorities: structuredClone(DEFAULT_PRIORITIES),
  /** which sources are connected */
  connections: {
    "apple-health": true,
    "zepp": true,
    "google-fit": false,
    "strava": true,
    "fatsecret": true,
    "how-we-feel": true,
    "hevy": true,
    "bend": false,
    "jefit": false,
    "lyfta": false,
  },
};
