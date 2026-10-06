/* ==========================================================================
   PERSISTENCE — encapsulated, validated, non-destructive
   LocalStorage is an implementation detail behind this layer so it can be
   swapped for a remote store without touching the UI.
   ========================================================================== */

const NS = "winterarc.v1";

function safeParse(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/** shallow-merge stored payload over defaults; unknown keys are dropped */
export function hydrate(defaults) {
  let stored = null;
  try {
    stored = safeParse(localStorage.getItem(NS));
  } catch {
    stored = null;
  }
  if (!stored || typeof stored !== "object") return { data: defaults, restored: false };

  const out = structuredClone(defaults);
  for (const key of Object.keys(defaults)) {
    const d = defaults[key];
    const s = stored[key];
    if (s === undefined || s === null) continue;
    if (Array.isArray(d)) {
      if (Array.isArray(s)) out[key] = s.slice(0, 400);
    } else if (d && typeof d === "object") {
      out[key] = { ...d, ...(s && typeof s === "object" ? s : {}) };
    } else if (typeof s === typeof d) {
      out[key] = s;
    }
  }
  out.__version = 1;
  return { data: out, restored: true };
}

export function persist(payload) {
  try {
    localStorage.setItem(NS, JSON.stringify({ ...payload, __version: 1 }));
    return true;
  } catch {
    return false;
  }
}

export function wipe() {
  try {
    localStorage.removeItem(NS);
  } catch {
    /* non-fatal */
  }
}
