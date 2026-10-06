/* ==========================================================================
   DATE UTILITIES — ISO-first, local-safe
   ========================================================================== */

const MS_DAY = 86400000;

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_MIN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function iso(date) {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseISO(str) {
  if (str instanceof Date) return new Date(str);
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function today() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / MS_DAY);
}

export function startOfWeek(date) {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(d, -dow);
}

export function startOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

export function fmtDate(date, opts = { day: "numeric", month: "short" }) {
  return parseISO(typeof date === "string" ? date : iso(date)).toLocaleDateString(
    "en-GB",
    opts
  );
}

export function fmtLong(date) {
  return parseISO(typeof date === "string" ? date : iso(date)).toLocaleDateString(
    "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" }
  );
}

export function fmtRange(fromISO, toISO) {
  const a = parseISO(fromISO);
  const b = parseISO(toISO);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const left = fmtDate(a, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  return `${left} – ${fmtDate(b, { day: "numeric", month: "short" })}`;
}

export function relativeLabel(dateISO) {
  const t = iso(today());
  if (dateISO === t) return "Today";
  if (dateISO === iso(addDays(today(), -1))) return "Yesterday";
  return fmtDate(dateISO, { weekday: "short", day: "numeric", month: "short" });
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still awake";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function listDays(endDateISO, count) {
  const out = [];
  const end = parseISO(endDateISO);
  for (let i = count - 1; i >= 0; i--) out.push(iso(addDays(end, -i)));
  return out;
}

export function weekdayIndex(dateISO) {
  return parseISO(dateISO).getDay();
}

export function isWeekend(dateISO) {
  const d = weekdayIndex(dateISO);
  return d === 0 || d === 6;
}
