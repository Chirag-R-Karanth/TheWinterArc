/* ==========================================================================
   NUMBER UTILITIES — formatting + math
   ========================================================================== */

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function round(v, digits = 0) {
  const p = Math.pow(10, digits);
  return Math.round(v * p) / p;
}

export function formatInt(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString("en-US");
}

export function formatDec(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCompact(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (Math.abs(v) >= 10000) return (v / 1000).toFixed(v >= 100000 ? 0 : 1) + "k";
  return formatInt(v);
}

export function formatPct(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "" : ""}${round(v, digits)}%`;
}

export function formatSigned(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const r = round(v, digits);
  return `${r > 0 ? "+" : ""}${r.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** 7h 42m | 48m | 8h */
export function formatDuration(min) {
  if (min === null || min === undefined || Number.isNaN(min)) return "—";
  const m = Math.round(min);
  const hh = Math.floor(Math.abs(m) / 60);
  const mm = Math.abs(m) % 60;
  if (hh === 0) return `${mm}m`;
  if (mm === 0) return `${hh}h`;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

export function formatClock(minOfDay) {
  const m = Math.round(minOfDay);
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function deltaPct(curr, prev) {
  if (!isFinite(curr) || !isFinite(prev) || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function sum(arr) {
  return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}

export function average(arr) {
  const vals = arr.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (!vals.length) return null;
  return sum(vals) / vals.length;
}

export function median(arr) {
  const vals = arr.filter((v) => v !== null && v !== undefined).slice().sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

export function extent(arr) {
  const vals = arr.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (!vals.length) return [0, 1];
  return [Math.min(...vals), Math.max(...vals)];
}

export function movingAverage(arr, window = 7) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - window + 1), i + 1).filter((v) => v != null);
    return slice.length ? sum(slice) / slice.length : null;
  });
}

/** Pearson correlation coefficient */
export function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  const pairs = [];
  for (let i = 0; i < n; i++) {
    if (a[i] == null || b[i] == null) continue;
    pairs.push([a[i], b[i]]);
  }
  if (pairs.length < 3) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = average(xs);
  const my = average(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < pairs.length; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : num / den;
}

/** least-squares slope + intercept: y = m*x + b */
export function linearFit(ys) {
  const pts = ys
    .map((y, x) => (y == null ? null : [x, y]))
    .filter(Boolean);
  if (pts.length < 2) return null;
  const n = pts.length;
  const sx = sum(pts.map((p) => p[0]));
  const sy = sum(pts.map((p) => p[1]));
  const sxx = sum(pts.map((p) => p[0] * p[0]));
  const sxy = sum(pts.map((p) => p[0] * p[1]));
  const den = n * sxx - sx * sx;
  if (den === 0) return null;
  const m = (n * sxy - sx * sy) / den;
  const b = (sy - m * sx) / n;
  return { m, b, at: (x) => m * x + b };
}

/** normalize into 0..1 */
export function normalize(v, [min, max]) {
  if (v == null || !isFinite(v)) return null;
  if (max === min) return 0.5;
  return clamp((v - min) / (max - min), 0, 1);
}

/** 0..1 completion against a target */
export function progress(value, target) {
  if (value == null || !target) return 0;
  return clamp(value / target, 0, 1);
}
