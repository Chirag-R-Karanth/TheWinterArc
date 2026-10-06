/* ==========================================================================
   INTEGRATIONS — provider registry + provider-specific readers.
   Provider logic lives HERE and nowhere else. The UI only ever consumes
   normalized WinterArc records produced by the resolver.
   No real network calls: this is the seam where real APIs would attach.
   ========================================================================== */

import { round } from "../utils/numbers.js";
import { sleepScore } from "../utils/calc.js";

export const PROVIDERS = [
  { id: "apple-health", name: "Apple Health", monogram: "AH", tone: "#e8660f",
    sync: "2 min ago", supports: ["steps", "distance", "heartRate", "sleep", "workouts", "nutrition", "body"] },
  { id: "google-fit", name: "Google Fit", monogram: "GF", tone: "#4a76d8",
    sync: "18 min ago", supports: ["steps", "distance", "heartRate", "workouts"] },
  { id: "zepp", name: "Zepp", monogram: "ZP", tone: "#2f9490",
    sync: "6 min ago", supports: ["steps", "distance", "heartRate", "sleep", "body"] },
  { id: "strava", name: "Strava", monogram: "ST", tone: "#d9682a",
    sync: "11 min ago", supports: ["workouts"] },
  { id: "fatsecret", name: "FatSecret", monogram: "FS", tone: "#38956a",
    sync: "5 min ago", supports: ["nutrition"] },
  { id: "how-we-feel", name: "How We Feel", monogram: "HW", tone: "#7e64c9",
    sync: "40 min ago", supports: ["mood"] },
  { id: "hevy", name: "Hevy", monogram: "HV", tone: "#5566c9",
    sync: "1 h ago", supports: ["workouts"] },
  { id: "bend", name: "Bend", monogram: "BD", tone: "#2f9490",
    sync: "3 h ago", supports: ["mood"] },
  { id: "jefit", name: "Jefit", monogram: "JF", tone: "#c8503f",
    sync: "yesterday", supports: ["workouts"] },
  { id: "lyfta", name: "Lyfta", monogram: "LY", tone: "#5566c9",
    sync: "2 days ago", supports: ["workouts"] },
];

export const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));

export const CATEGORY_PROOF = {
  steps: "steps",
  distance: "distanceKm",
  heartRate: "hrvMs",
  sleep: "sleep",
  workouts: "workouts",
  nutrition: "nutrition",
  body: "body",
  mood: "mind",
  stress: "mind",
};

const WORKOUT_SCOPE = {
  strava: ["run", "cycle"],
  hevy: ["strength"],
  jefit: ["strength"],
  lyfta: ["strength", "run", "hiit"],
  "apple-health": null, // everything
  "google-fit": ["run", "cycle", "walk", "strength"],
};

/** deterministic 0..1 hash so provider jitter is stable across reloads */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const jit = (key, amount) => 1 + (hash(key) - 0.5) * 2 * amount;

/** scale a whole nutrition record the way a different app would log it */
function scaleNutrition(n, key) {
  if (!n) return null;
  const k = jit(key, 0.022);
  const kcal = Math.round(n.kcal * k);
  const proteinG = Math.round(n.proteinG * jit(key + "p", 0.03));
  const fatG = Math.round(n.fatG * jit(key + "f", 0.04));
  const carbsG = Math.max(60, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return {
    ...n,
    kcal,
    proteinG,
    carbsG,
    fatG,
    meals: (n.meals || []).map((m) => ({
      ...m,
      kcal: Math.round(m.kcal * k),
      proteinG: Math.round(m.proteinG * k),
      carbsG: Math.round(m.carbsG * k),
      fatG: Math.round(m.fatG * k),
    })),
  };
}

/**
 * Read one category from one provider for one normalized day.
 * Returns null when this provider has no data for that category/day.
 */
export function readCategory(providerId, category, day) {
  if (!day) return null;
  const key = `${providerId}:${day.date}:${category}`;
  switch (category) {
    case "steps": {
      if (day.activity?.steps == null) return null;
      const v = Math.round(day.activity.steps * jit(key, 0.03));
      return { steps: v, distanceKm: round(v * 0.00072, 2) };
    }
    case "distance":
      if (day.activity?.distanceKm == null) return null;
      return { distanceKm: round(day.activity.distanceKm * jit(key, 0.035), 2) };
    case "heartRate": {
      // some wearables only report HRV every other day
      if (providerId === "google-fit" && hash(key) < 0.45) return null;
      if (day.recovery?.hrvMs == null && day.recovery?.restingHr == null) return null;
      return {
        hrvMs: Math.round(day.recovery.hrvMs * jit(key, 0.07)),
        restingHr: round(day.recovery.restingHr + (hash(key + "r") - 0.5) * 1.6, 1),
      };
    }
    case "sleep": {
      if (!day.sleep) return null;
      if (providerId === "apple-health" && hash(key) < 0.12) return null;
      const asleepMin = Math.round(day.sleep.asleepMin * jit(key, 0.035));
      const awakeMin = Math.round(day.sleep.awakeMin * jit(key + "a", 0.3));
      const inBedMin = asleepMin + awakeMin + Math.round(8 + hash(key + "i") * 12);
      const deepMin = Math.round(day.sleep.deepMin * jit(key + "d", 0.09));
      const remMin = Math.round(day.sleep.remMin * jit(key + "rm", 0.09));
      const lightMin = Math.max(0, asleepMin - deepMin - remMin - awakeMin);
      const efficiency = asleepMin / inBedMin;
      return {
        ...day.sleep,
        asleepMin, awakeMin, inBedMin, deepMin, remMin, lightMin,
        efficiency: round(efficiency, 3),
        score: sleepScore({ asleepMin, deepMin, remMin, awakeMin, efficiency }),
      };
    }
    case "workouts": {
      if (!day.activity) return null;
      const scope = WORKOUT_SCOPE[providerId];
      const list = (day.activity.workouts || []).filter((w) => !scope || scope.includes(w.type));
      if (!list.length) return null;
      return { workouts: list };
    }
    case "nutrition": {
      if (!day.nutrition) return null;
      if (providerId === "apple-health" && hash(key) < 0.25) return null;
      return scaleNutrition(day.nutrition, key);
    }
    case "body": {
      // scales report intermittently — Zepp ~ every 3rd day
      if (day.body?.weightKg == null) return null;
      if (providerId === "zepp") {
        const idx = Number(day.date.slice(-1));
        if (idx % 3 !== 0) return null;
      }
      return {
        weightKg: round(day.body.weightKg + (hash(key) - 0.5) * 0.5, 1),
        bodyFatPct: day.body.bodyFatPct,
        waistCm: day.body.waistCm,
      };
    }
    case "mood":
    case "stress": {
      if (!day.mind) return null;
      if (providerId === "bend") {
        // Bend only captures practice-derived state, not full check-ins
        if (hash(key) < 0.55) return null;
        return { mood: null, stress: day.mind.stress, energy: day.mind.energy, focus: null };
      }
      return { ...day.mind };
    }
    default:
      return null;
  }
}
