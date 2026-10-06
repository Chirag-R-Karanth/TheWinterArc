/* ==========================================================================
   HEALTH SERVICE — the only data API the UI is allowed to touch.
   Inputs: generated history + provider resolution.
   Outputs: normalized WinterArc days, windows and domain summaries.
   ========================================================================== */

import { buildDataset } from "../data/generator.js";
import { resolveDay } from "./resolver.js";
import { getState, subscribe } from "../state/store.js";
import { iso, today, addDays, parseISO, fmtRange } from "../utils/dates.js";
import { average, sum, round, median, extent, deltaPct } from "../utils/numbers.js";
import {
  sleepConsistency,
  sleepDebt,
  macroSplit,
  workoutDistribution,
} from "../utils/calc.js";

const HISTORY_DAYS = 140;

let baseCache = null;
let resolvedCache = null;
let resolvedKey = "";

function settingsKey(s) {
  return JSON.stringify([s.priorities, s.connections]);
}

export function getBase() {
  if (!baseCache) baseCache = buildDataset(iso(today()), HISTORY_DAYS);
  return baseCache;
}

export function getDays() {
  const st = getState();
  const key = settingsKey(st.settings);
  if (!resolvedCache || resolvedKey !== key) {
    resolvedCache = getBase().map((d) => resolveDay(d, st.settings));
    resolvedKey = key;
  }
  return resolvedCache;
}

export function invalidate() {
  resolvedCache = null;
  resolvedKey = "";
}

subscribe((state, topic) => {
  if (topic === "settings") invalidate();
});

export function getDay(dateISO) {
  return getDays().find((d) => d.date === dateISO) || null;
}

/** last `count` days ending on or before endISO, ascending */
export function windowDays(endISO, count) {
  const all = getDays();
  const endIdx = all.findIndex((d) => d.date === endISO);
  const hi = endIdx === -1 ? all.length : endIdx + 1;
  return all.slice(Math.max(0, hi - count), hi);
}

export function prevWindow(endISO, count) {
  const all = getDays();
  const endIdx = all.findIndex((d) => d.date === endISO);
  const hi = endIdx === -1 ? all.length : endIdx + 1;
  return all.slice(Math.max(0, hi - count * 2), Math.max(0, hi - count));
}

export const PERIOD_DAYS = { day: 1, week: 7, month: 30, quarter: 90 };

export function periodWindow(period, endISO) {
  const count = PERIOD_DAYS[period] || 7;
  const days = windowDays(endISO, count);
  const prev = prevWindow(endISO, count);
  const label = days.length
    ? days.length === 1
      ? days[0].date
      : fmtRange(days[0].date, days[days.length - 1].date)
    : "No data";
  return { days, prev, count, label };
}

export function provenance(dateISO, category) {
  return getDay(dateISO)?.provenance?.[category] || null;
}

/* ==========================================================================
   DOMAIN SUMMARIES
   ========================================================================== */

const nz = (v) => (v === null || v === undefined ? null : v);

export function activitySummary(days) {
  const steps = days.map((d) => nz(d.activity.steps)).filter((v) => v != null);
  const active = days.map((d) => nz(d.activity.activeKcal)).filter((v) => v != null);
  const dist = days.map((d) => nz(d.activity.distanceKm)).filter((v) => v != null);
  const workouts = days.flatMap((d) => d.activity.workouts || []);
  if (!steps.length && !workouts.length) return null;
  return {
    steps: { avg: average(steps), total: sum(steps), latest: steps.at(-1) ?? null },
    distance: { total: round(sum(dist), 1), avg: round(average(dist), 1) },
    activeKcal: { total: sum(active), avg: round(average(active)) },
    workouts: {
      count: workouts.length,
      minutes: sum(workouts.map((w) => w.min)),
      kcal: sum(workouts.map((w) => w.kcal)),
      list: workouts,
      distribution: workoutDistribution(days),
    },
    streak: activeStreak(days),
  };
}

function activeStreak(days) {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if ((d.activity.workouts || []).length || (d.activity.steps || 0) >= 7000) n++;
    else break;
  }
  return n;
}

export function sleepSummary(days) {
  const asleep = days.map((d) => nz(d.sleep?.asleepMin));
  const present = asleep.filter((v) => v != null);
  if (!present.length) return null;
  const scores = days.map((d) => nz(d.sleep?.score)).filter((v) => v != null);
  const deep = days.map((d) => nz(d.sleep?.deepMin)).filter((v) => v != null);
  const rem = days.map((d) => nz(d.sleep?.remMin)).filter((v) => v != null);
  const eff = days.map((d) => nz(d.sleep?.efficiency)).filter((v) => v != null);
  return {
    avgAsleep: round(average(present)),
    total: sum(present),
    avgScore: round(average(scores)),
    consistency: sleepConsistency(days),
    debt: sleepDebt(days),
    deepAvg: round(average(deep)),
    remAvg: round(average(rem)),
    efficiency: round(average(eff) * 100),
    nights: present.length,
    min: Math.min(...present),
    max: Math.max(...present),
    bedtimeAvg: circularAvg(days.map((d) => nz(d.sleep?.bedtime))),
    wakeAvg: circularAvg(days.map((d) => nz(d.sleep?.wake))),
  };
}

/** average clock time (handles 23:50 / 00:30 wrap) */
function circularAvg(values) {
  const vals = values.filter((v) => v != null).map((v) => (v % 1440 < 720 ? (v % 1440) + 1440 : v % 1440));
  if (!vals.length) return null;
  return Math.round(average(vals)) % 1440;
}

export function recoverySummary(days) {
  const scores = days.map((d) => nz(d.recovery.score)).filter((v) => v != null);
  if (!scores.length) return null;
  const hrv = days.map((d) => nz(d.recovery.hrvMs)).filter((v) => v != null);
  const rhr = days.map((d) => nz(d.recovery.restingHr)).filter((v) => v != null);
  const load = days.map((d) => nz(d.recovery.load)).filter((v) => v != null);
  return {
    avgScore: round(average(scores)),
    latest: scores.at(-1),
    hrvAvg: round(average(hrv)),
    hrvLatest: hrv.at(-1) ?? null,
    rhrAvg: round(average(rhr), 1),
    rhrLatest: rhr.at(-1) ?? null,
    loadAvg: round(average(load)),
    loadLatest: load.at(-1) ?? null,
    best: Math.max(...scores),
    worst: Math.min(...scores),
    sleepScoreAvg: (() => {
      const v = average(days.map((d) => nz(d.sleep?.score)).filter((x) => x != null));
      return v == null ? null : round(v);
    })(),
  };
}

export function nutritionSummary(days, goals) {
  const rows = days.filter((d) => d.nutrition);
  if (!rows.length) return null;
  const kcal = rows.map((d) => d.nutrition.kcal);
  const protein = rows.map((d) => d.nutrition.proteinG);
  const carbs = rows.map((d) => d.nutrition.carbsG);
  const fat = rows.map((d) => d.nutrition.fatG);
  const loggedDays = rows.length;
  const avgK = average(kcal);
  const mean = avgK;
  const sd = Math.sqrt(average(kcal.map((k) => (k - mean) ** 2)));
  return {
    daysLogged: loggedDays,
    coverage: Math.round((loggedDays / Math.max(1, days.length)) * 100),
    kcal: { avg: round(avgK), total: sum(kcal), latest: kcal.at(-1), min: Math.min(...kcal), max: Math.max(...kcal) },
    protein: { avg: round(average(protein)), latest: protein.at(-1) },
    carbs: { avg: round(average(carbs)), latest: carbs.at(-1) },
    fat: { avg: round(average(fat)), latest: fat.at(-1) },
    split: macroSplit({ kcal: avgK, proteinG: average(protein), carbsG: average(carbs), fatG: average(fat) }),
    consistency: round(sd),          // kcal stdev — lower is steadier
    adherence: round(
      (average(kcal.map((k) => Math.max(0, 1 - Math.abs(k - (goals?.energyKcal || 2400)) / (goals?.energyKcal || 2400)))) || 0) * 100
    ),
    goals,
  };
}

export function bodySummary(days) {
  const rows = days.filter((d) => d.body?.weightKg != null);
  if (!rows.length) return null;
  const weights = rows.map((d) => d.body.weightKg);
  const first = weights[0];
  const latest = weights.at(-1);
  const [min, max] = extent(weights);
  const half = Math.floor(weights.length / 2);
  const prevAvg = average(weights.slice(0, half));
  const currAvg = average(weights.slice(half));
  const fats = rows.map((d) => d.body.bodyFatPct).filter((v) => v != null);
  const waists = rows.map((d) => d.body.waistCm).filter((v) => v != null);
  return {
    latest,
    first,
    change: round(latest - first, 1),
    changePct: round(((latest - first) / first) * 100, 1),
    min,
    max,
    avg: round(average(weights), 1),
    splitDelta: round(currAvg - prevAvg, 1),
    bodyFat: fats.at(-1) ?? null,
    waist: waists.at(-1) ?? null,
    weighIns: weights.length,
  };
}

export function mindSummary(days) {
  const rows = days.filter((d) => d.mind);
  if (!rows.length) return null;
  const moods = rows.map((d) => d.mind.mood).filter((v) => v != null);
  const stress = rows.map((d) => d.mind.stress).filter((v) => v != null);
  const energy = rows.map((d) => d.mind.energy).filter((v) => v != null);
  const focus = rows.map((d) => d.mind.focus).filter((v) => v != null);
  return {
    logged: rows.length,
    moodAvg: round(average(moods), 1),
    moodLatest: moods.at(-1) ?? null,
    stressAvg: round(average(stress), 1),
    energyAvg: round(average(energy), 1),
    focusAvg: round(average(focus), 1),
    best: moods.length ? Math.max(...moods) : null,
    worst: moods.length ? Math.min(...moods) : null,
  };
}

/** combined glance used by Overview header cards */
export function glance(days, goals) {
  const a = activitySummary(days);
  const s = sleepSummary(days);
  const r = recoverySummary(days);
  const n = nutritionSummary(days, goals);
  const b = bodySummary(days);
  const m = mindSummary(days);
  return { activity: a, sleep: s, recovery: r, nutrition: n, body: b, mind: m };
}

export { deltaPct, median };
