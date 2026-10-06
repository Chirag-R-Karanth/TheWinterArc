/* ==========================================================================
   UNITS — metric ⇄ imperial at display time.
   Stored values always stay metric; only presentation converts.
   ========================================================================== */

import { getState } from "../state/store.js";

const KG_TO_LB = 2.2046226218;
const KM_TO_MI = 0.621371;

export const isImperial = () => getState().units === "imperial";

export const wtUnit = () => (isImperial() ? "lb" : "kg");
export const distUnit = () => (isImperial() ? "mi" : "km");
export const lenUnit = () => (isImperial() ? "in" : "cm");
export const rateUnit = () => (isImperial() ? "lb/wk" : "kg/wk");

/** kilograms → display weight */
export function wt(kg) {
  if (kg === null || kg === undefined || Number.isNaN(kg)) return null;
  return isImperial() ? kg * KG_TO_LB : kg;
}

/** kilometres → display distance */
export function dist(km) {
  if (km === null || km === undefined || Number.isNaN(km)) return null;
  return isImperial() ? km * KM_TO_MI : km;
}

/** centimetres → display length */
export function len(cm) {
  if (cm === null || cm === undefined || Number.isNaN(cm)) return null;
  return isImperial() ? cm / 2.54 : cm;
}
