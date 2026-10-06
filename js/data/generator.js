/* ==========================================================================
   DATA GENERATOR
   Produces a deterministic, correlated 140-day health history so every
   chart, trend and correlation in WinterArc has something truthful to say.
   Nothing here is UI-specific — it emits the normalized WinterArc day model.
   ========================================================================== */

import { addDays, iso, weekdayIndex, isWeekend } from "../utils/dates.js";
import { clamp, round } from "../utils/numbers.js";
import { sleepScore, recoveryScore } from "../utils/calc.js";
import { MEAL_FOODS, WORKOUT_TYPES } from "./taxonomy.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INTENSITY = { hiit: 1.3, run: 1.0, swim: 0.85, strength: 0.9, cycle: 0.8, walk: 0.35, yoga: 0.25 };
const KCAL_PER_MIN = { hiit: 11, run: 10.4, swim: 9, strength: 5.6, cycle: 8.1, walk: 3.6, yoga: 3.1 };

function planWorkout(dow, rnd) {
  const restRoll = rnd();
  if (restRoll < 0.12) return null;
  let w = null;
  switch (dow) {
    case 0: w = rnd() < 0.55 ? { type: "walk", min: 50 + Math.round(rnd() * 30), title: "Long walk" } : null; break;
    case 1: w = { type: "strength", min: 50 + Math.round(rnd() * 12), title: "Upper body" }; break;
    case 2: w = { type: "run", min: 38 + Math.round(rnd() * 16), title: rnd() < 0.35 ? "Tempo intervals" : "Easy run" }; break;
    case 3: w = rnd() < 0.7 ? { type: "yoga", min: 26 + Math.round(rnd() * 12), title: "Mobility flow" } : null; break;
    case 4: w = { type: "strength", min: 50 + Math.round(rnd() * 12), title: "Lower body" }; break;
    case 5: w = rnd() < 0.6 ? { type: "swim", min: 34 + Math.round(rnd() * 14), title: "Pool sets" } : null; break;
    case 6: w = rnd() < 0.55
      ? { type: "run", min: 68 + Math.round(rnd() * 25), title: "Long run" }
      : { type: "cycle", min: 75 + Math.round(rnd() * 30), title: "Road ride" }; break;
  }
  if (w && rnd() < 0.16) w.title = rnd() < 0.5 ? "Zone 2 " + WORKOUT_TYPES[w.type].label.toLowerCase() : w.title;
  return w;
}

function pick(arr, rnd) {
  return arr[Math.floor(rnd() * arr.length)];
}

export function buildDataset(endISO, count = 140) {
  const rnd = mulberry32(0x51f3d2a7);
  const days = [];

  const startWeight = 83.1;
  let weight = startWeight;
  let bodyFat = 17.9;
  let hrv = 58;
  let prevLoad = 42;
  let prevSleepScore = 76;
  let streak = 0;

  const end = new Date(endISO + "T12:00:00");

  for (let i = count - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const dateISO = iso(date);
    const dow = weekdayIndex(dateISO);
    const weekend = isWeekend(dateISO);
    const n = count - 1 - i; // day index from start

    /* ---------------- sleep ---------------- */
    const sleepMissing = rnd() < 0.02;
    const baseBed = weekend ? 1505 : 1392; // 01:05 vs 23:12
    const bedtime = Math.round(baseBed + (rnd() - 0.5) * 78 + (prevSleepScore < 60 ? -34 : 0));
    const sleepTarget = weekend ? 494 : 448;
    const asleepMin = Math.round(clamp(sleepTarget + (rnd() - 0.5) * 86 + (bedtime > 1450 ? -22 : 8), 285, 566));
    const awakeMin = Math.round(clamp(asleepMin * (0.04 + rnd() * 0.07), 8, 62));
    const inBed = asleepMin + awakeMin + Math.round(6 + rnd() * 14);
    const deepMin = Math.round(asleepMin * (0.17 + rnd() * 0.06));
    const remMin = Math.round(asleepMin * (0.2 + rnd() * 0.06));
    const lightMin = Math.max(0, asleepMin - deepMin - remMin - awakeMin);
    const efficiency = asleepMin / inBed;

    const sleep = sleepMissing ? null : {
      inBedMin: inBed,
      asleepMin,
      awakeMin,
      deepMin,
      remMin,
      lightMin,
      bedtime,
      wake: bedtime + inBed,
      efficiency: round(efficiency, 3),
      score: sleepScore({ asleepMin, deepMin, remMin, awakeMin, efficiency }),
    };
    const sleepSc = sleep?.score ?? prevSleepScore;

    /* ---------------- workouts ---------------- */
    const sick = rnd() < 0.018;
    let workout = sick ? null : planWorkout(dow, rnd);
    if (sick) streak = 0;
    const wIntensity = workout ? INTENSITY[workout.type] : 0;
    const workoutKcal = workout ? Math.round(workout.min * KCAL_PER_MIN[workout.type] * (0.9 + rnd() * 0.2)) : 0;
    if (workout) streak++; else streak = 0;

    /* ---------------- activity ---------------- */
    let steps = sick
      ? Math.round(600 + rnd() * 700)
      : Math.round(
          (weekend ? 6800 : 6100) +
            (workout ? workout.min * 62 : 0) +
            (workout?.type === "run" ? 1800 : 0) +
            rnd() * 3600 -
            900
        );
    steps = Math.max(320, steps);
    const distanceKm = round(steps * (0.00071 + rnd() * 0.00004), 2);
    const activeKcal = Math.round(steps * 0.043 + workoutKcal * 0.72 + rnd() * 55);
    const restingKcal = Math.round(1690 + (weight - 80) * 8 + rnd() * 45);

    const activity = {
      steps,
      distanceKm,
      activeKcal,
      restingKcal,
      workouts: workout
        ? [{
            id: `${dateISO}-${workout.type}`,
            type: workout.type,
            title: workout.title,
            min: workout.min,
            kcal: workoutKcal,
            avgHr: Math.round(112 + wIntensity * 26 + rnd() * 9),
          }]
        : [],
    };

    /* ---------------- recovery inputs ---------------- */
    const loadRaw = (workout ? workout.min * wIntensity : 0) + (steps / 1000) * 3.4;
    const dayLoad = Math.round(clamp(loadRaw * 0.95, 6, 100));
    const load = Math.round(prevLoad * 0.55 + dayLoad * 0.45);
    const hrvNext = clamp(
      41 + (sleepSc - 62) * 0.42 - (prevLoad - 46) * 0.17 + (rnd() - 0.5) * 9 + (workout?.type === "yoga" ? 3 : 0),
      34, 84
    );
    hrv = Math.round(hrv * 0.45 + hrvNext * 0.55);
    const restingHr = round(
      clamp(55.5 - (hrv - 52) * 0.13 - (sleepSc - 72) * 0.05 + (rnd() - 0.5) * 2.4 + (sick ? 5 : 0), 46, 64),
      1
    );

    const recovery = { hrvMs: hrv, restingHr, load: dayLoad, acuteLoad: load };

    /* ---------------- nutrition ---------------- */
    const training = !!workout && workout.min >= 35;
    const expenditure = restingKcal + activeKcal;
    const nutritionMissing = !sick && rnd() < 0.045;
    let nutrition = null;
    if (!nutritionMissing) {
      const targetKcal = 2400;
      const kcal = Math.round(
        clamp(expenditure - 105 + (rnd() - 0.5) * 190 + (training ? 90 : -40), 1550, 3250)
      );
      const proteinG = Math.round(clamp(150 + rnd() * 34 + (training ? 12 : 0), 118, 205));
      const fatG = Math.round(clamp(58 + rnd() * 24, 44, 96));
      const carbsG = Math.max(90, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));

      const share = [
        0.24 + (rnd() - 0.5) * 0.05,
        0.33 + (rnd() - 0.5) * 0.05,
        0.31 + (rnd() - 0.5) * 0.05,
        0.12 + (rnd() - 0.5) * 0.04,
      ];
      const sumShare = share.reduce((a, b) => a + b, 0);
      const mealTimes = ["07:40", "12:45", "19:20", "21:30"];
      const meals = share.map((s, idx) => {
        const k = Math.round((kcal * s) / sumShare);
        const p = Math.round((proteinG * s) / sumShare);
        const f = Math.round((fatG * s) / sumShare);
        const c = Math.max(8, Math.round((k - p * 4 - f * 9) / 4));
        return {
          name: MEAL_FOODS[["Breakfast", "Lunch", "Dinner", "Snacks"][idx]][Math.floor(rnd() * 5)],
          slot: ["Breakfast", "Lunch", "Dinner", "Snacks"][idx],
          time: mealTimes[idx],
          kcal: k,
          proteinG: p,
          carbsG: c,
          fatG: f,
        };
      });

      nutrition = {
        kcal,
        targetKcal,
        proteinG,
        carbsG,
        fatG,
        waterMl: Math.round((2000 + rnd() * 1000 + (training ? 400 : 0)) / 100) * 100,
        meals,
      };
    }

    /* ---------------- body ---------------- */
    const intake = nutrition ? nutrition.kcal : expenditure + 140;
    const deltaKg = (intake - expenditure) / 7700;
    const carbWater = nutrition ? (nutrition.carbsG - 235) * 0.0034 : 0;
    weight = clamp(weight + deltaKg + (rnd() - 0.5) * 0.06, 74, 92);
    const scaleWeight = round(weight + carbWater + (rnd() - 0.5) * 0.34, 1);
    bodyFat = round(clamp(bodyFat - 0.0042 + (rnd() - 0.5) * 0.05, 12, 26), 1);

    const body = {
      weightKg: scaleWeight,
      trendKg: round(weight, 2),
      bodyFatPct: rnd() < 0.35 ? bodyFat : null, // measured a few times a week
      waistCm: round(clamp(84 - n * 0.022 + (rnd() - 0.5) * 0.7, 74, 95), 1),
    };

    /* ---------------- mind ---------------- */
    const logged = rnd() > 0.13;
    const stressBase = [2.6, 3.0, 2.7, 2.6, 2.9, 2.1, 2.0][dow];
    const stress = round(clamp(stressBase + (rnd() - 0.5) * 1.1 - (sleepSc - 72) * 0.014, 1, 5), 1);
    const moodRaw =
      2.55 +
      (sleepSc - 72) * 0.024 +
      (steps / 1000) * 0.13 -
      stress * 0.34 +
      (workout ? 0.24 : 0) +
      (rnd() - 0.5) * 0.7 +
      (weekend ? 0.2 : 0);
    const mind = logged
      ? {
          mood: round(clamp(moodRaw, 1, 5), 1),
          stress,
          energy: round(clamp(2.4 + (sleepSc - 70) * 0.026 + (workout ? 0.3 : 0) - stress * 0.18 + (rnd() - 0.5) * 0.8, 1, 5), 1),
          focus: round(clamp(2.6 + (sleepSc - 72) * 0.02 - stress * 0.2 + (rnd() - 0.5) * 0.8, 1, 5), 1),
        }
      : null;

    /* ---------------- assemble ---------------- */
    const day = {
      date: dateISO,
      activity,
      sleep,
      recovery: {
        ...recovery,
        score: recoveryScore({
          sleep,
          recovery: { hrvMs: hrv, restingHr, load: dayLoad },
        }),
      },
      nutrition,
      body,
      mind,
    };
    days.push(day);

    prevLoad = load;
    prevSleepScore = sleepSc;
  }

  return days;
}

