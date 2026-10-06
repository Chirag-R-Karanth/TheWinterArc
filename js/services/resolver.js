/* ==========================================================================
   RESOLVER — source priority & conflict handling.
   Rules: (1) user priority, (2) freshest valid value, (3) no duplicate
   presentation, (4) deterministic, (5) provenance preserved, (6) never
   destructive — resolution happens on read, source data is untouched.
   ========================================================================== */

import { readCategory } from "./integrations.js";
import { recoveryScore } from "../utils/calc.js";

function candidates(priorities, connections, category) {
  const order = priorities[category] || [];
  const connected = order.filter((id) => connections[id]);
  // any connected provider not listed explicitly still participates (lowest)
  for (const id of Object.keys(connections)) {
    if (connections[id] && !connected.includes(id)) connected.push(id);
  }
  return connected;
}

function first(list, base, category) {
  for (const id of list) {
    const val = readCategory(id, category, base);
    if (val) return { value: val, source: id };
  }
  return { value: null, source: null };
}

/** merge objects left-to-right, keeping the first non-null field */
function fillMissing(target, source) {
  if (!source) return target;
  for (const [k, v] of Object.entries(source)) {
    if (v !== null && v !== undefined && (target[k] === null || target[k] === undefined)) {
      target[k] = v;
    }
  }
  return target;
}

export function resolveDay(base, settings) {
  const { priorities, connections } = settings;
  const prov = {};

  /* ---- steps + distance + energy ---- */
  const stepsRes = first(candidates(priorities, connections, "steps"), base, "steps");
  const steps = stepsRes.value;
  prov.steps = stepsRes.source;
  prov.distance = stepsRes.source;
  prov.energy = stepsRes.source;

  /* ---- heart rate / hrv ---- */
  const hrRes = first(candidates(priorities, connections, "heartRate"), base, "heartRate");
  prov.heartRate = hrRes.source;

  /* ---- sleep ---- */
  const sleepRes = first(candidates(priorities, connections, "sleep"), base, "sleep");
  prov.sleep = sleepRes.source;

  /* ---- workouts: union across sources, deduped, priority decides owner ---- */
  const workoutCats = candidates(priorities, connections, "workouts");
  const seen = new Set();
  const workouts = [];
  for (const id of workoutCats) {
    const res = readCategory(id, "workouts", base);
    if (!res) continue;
    for (const w of res.workouts) {
      const dedupe = `${w.type}:${w.min}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      workouts.push({ ...w, source: id });
    }
  }
  prov.workouts = workoutCats.filter((id) => readCategory(id, "workouts", base));

  /* ---- nutrition ---- */
  const nutRes = first(candidates(priorities, connections, "nutrition"), base, "nutrition");
  prov.nutrition = nutRes.source;

  /* ---- body ---- */
  const bodyList = candidates(priorities, connections, "body");
  const body = { weightKg: null, bodyFatPct: null, waistCm: null };
  for (const id of bodyList) {
    const res = readCategory(id, "body", base);
    if (res) fillMissing(body, res);
    if (body.weightKg !== null && body.waistCm !== null) break;
  }
  prov.body = bodyList.find((id) => readCategory(id, "body", base)) || null;

  /* ---- mind: full check-in first, then supplementary sources ---- */
  const moodList = candidates(priorities, connections, "mood");
  const mind = { mood: null, stress: null, energy: null, focus: null };
  let moodSource = null;
  for (const id of moodList) {
    const res = readCategory(id, "mood", base);
    if (!res) continue;
    if (!moodSource && res.mood !== null) moodSource = id;
    fillMissing(mind, res);
  }
  prov.mood = moodSource;
  prov.stress = moodList.find((id) => {
    const r = readCategory(id, "stress", base);
    return r && r.stress !== null;
  }) || null;

  return {
    date: base.date,
    activity: {
      steps: steps ? steps.steps : null,
      distanceKm: steps ? steps.distanceKm : null,
      activeKcal: steps ? steps.activeKcal : null,
      restingKcal: steps ? steps.restingKcal : null,
      workouts,
    },
    sleep: sleepRes.value,
    recovery: {
      hrvMs: hrRes.value ? hrRes.value.hrvMs : null,
      restingHr: hrRes.value ? hrRes.value.restingHr : null,
      load: base.recovery.load,
      score: recoveryScore({
        sleep: sleepRes.value,
        recovery: {
          hrvMs: hrRes.value ? hrRes.value.hrvMs : null,
          restingHr: hrRes.value ? hrRes.value.restingHr : null,
          load: base.recovery.load,
        },
      }),
    },
    nutrition: nutRes.value,
    body: body.weightKg === null && body.waistCm === null ? null : body,
    mind: mind.mood === null && mind.stress === null && mind.energy === null ? null : mind,
    provenance: prov,
  };
}
