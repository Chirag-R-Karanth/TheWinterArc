/* ==========================================================================
   DOMAIN CALCULATIONS — derived health insight, no raw dumps
   ========================================================================== */

import { average, sum, clamp, round, deltaPct, movingAverage } from "./numbers.js";
import { isWeekend } from "./dates.js";

/** Recovery status label from score */
export function recoveryLabel(score) {
  if (score == null) return "—";
  if (score >= 80) return "Excellent";
  if (score >= 68) return "Good";
  if (score >= 52) return "Fair";
  if (score >= 38) return "Low";
  return "Strained";
}

export function sleepLabel(score) {
  if (score == null) return "—";
  if (score >= 85) return "Restorative";
  if (score >= 72) return "Solid";
  if (score >= 58) return "Broken";
  return "Poor";
}

export function moodLabel(v) {
  if (v == null) return "—";
  return ["", "Low", "Meh", "Even", "Good", "Great"][clamp(Math.round(v), 1, 5)] || "—";
}

/** sleep quality from stages + duration + consistency */
export function sleepScore({ asleepMin, deepMin, remMin, awakeMin, efficiency }) {
  if (!asleepMin) return null;
  const durScore = clamp((asleepMin - 300) / 180, 0, 1) * 100; // 5h→0 8h→100
  const deepScore = clamp((deepMin || 0) / (asleepMin * 0.2), 0, 1) * 100;
  const remScore = clamp((remMin || 0) / (asleepMin * 0.22), 0, 1) * 100;
  const effScore = clamp((efficiency || 0.9) * 100, 0, 100);
  const awakePenalty = clamp(((awakeMin || 0) / asleepMin) * 240, 0, 30);
  const raw = durScore * 0.34 + deepScore * 0.22 + remScore * 0.2 + effScore * 0.24;
  return Math.round(clamp(raw - awakePenalty, 0, 100));
}

/** composite recovery from sleep, rhr, hrv, load */
export function recoveryScore(day) {
  if (!day) return null;
  const sleep = day.sleep?.score;
  const hrv = day.recovery?.hrvMs;
  const rhr = day.recovery?.restingHr;
  const load = day.recovery?.load;
  const parts = [];
  if (sleep != null) parts.push([sleep, 0.42]);
  if (hrv != null) parts.push([clamp(((hrv - 32) / 48) * 100, 0, 100), 0.28]);
  if (rhr != null) parts.push([clamp(100 - (rhr - 42) * 3.4, 0, 100), 0.16]);
  if (load != null) parts.push([clamp(100 - (load - 40) * 1.15, 0, 100), 0.14]);
  if (!parts.length) return null;
  const w = sum(parts.map((p) => p[1]));
  return Math.round(sum(parts.map((p) => p[0] * p[1])) / w);
}

/** sleep debt vs 7-day target (minutes) */
export function sleepDebt(days, targetMin = 460) {
  const vals = days.map((d) => d?.sleep?.asleepMin).filter((v) => v != null);
  if (!vals.length) return null;
  return Math.round(sum(vals) - targetMin * vals.length);
}

/** rolling consistency: stdev of sleep duration, lower = better */
export function sleepConsistency(days) {
  const vals = days.map((d) => d?.sleep?.asleepMin).filter((v) => v != null);
  if (vals.length < 2) return null;
  const mean = average(vals);
  const variance = average(vals.map((v) => (v - mean) ** 2));
  return Math.round(Math.sqrt(variance));
}

/** macro split percentages */
export function macroSplit(n) {
  if (!n || !n.kcal) return null;
  const pK = (n.proteinG || 0) * 4;
  const cK = (n.carbsG || 0) * 4;
  const fK = (n.fatG || 0) * 9;
  const t = pK + cK + fK || 1;
  return {
    protein: Math.round((pK / t) * 100),
    carbs: Math.round((cK / t) * 100),
    fat: Math.round((fK / t) * 100),
  };
}

/** weekly aggregation used by every domain page */
export function weekly(days, accessor) {
  const vals = days.map(accessor).filter((v) => v != null);
  if (!vals.length) return null;
  return {
    avg: round(average(vals), 1),
    total: round(sum(vals), 1),
    min: Math.min(...vals),
    max: Math.max(...vals),
    count: vals.length,
  };
}

/** comparison of a window vs the preceding window of equal length */
export function compareWindows(days, accessor) {
  const n = days.length;
  if (n < 4) return null;
  const half = Math.floor(n / 2);
  const prev = days.slice(0, half).map(accessor);
  const curr = days.slice(n - half).map(accessor);
  const a = average(prev);
  const b = average(curr);
  if (a == null || b == null) return null;
  return { current: b, previous: a, delta: deltaPct(b, a), direction: b >= a ? "up" : "down" };
}

export function trendSpark(days, accessor, window = 7) {
  return movingAverage(days.map(accessor), window);
}

/** weekday vs weekend split */
export function dayTypeSplit(days, accessor) {
  const wd = days.filter((d) => !isWeekend(d.date)).map(accessor).filter((v) => v != null);
  const we = days.filter((d) => isWeekend(d.date)).map(accessor).filter((v) => v != null);
  return { weekday: average(wd), weekend: average(we) };
}

/** activity distribution across workout types */
export function workoutDistribution(days) {
  const map = new Map();
  for (const d of days) {
    for (const w of d?.activity?.workouts || []) {
      const cur = map.get(w.type) || { type: w.type, sessions: 0, minutes: 0, kcal: 0 };
      cur.sessions += 1;
      cur.minutes += w.min || 0;
      cur.kcal += w.kcal || 0;
      map.set(w.type, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}
