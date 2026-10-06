/* ==========================================================================
   STORE — single source of truth + pub/sub
   ========================================================================== */

import { hydrate, persist } from "../services/persistence.js";
import { DEFAULT_SETTINGS } from "../data/defaults.js";

const listeners = new Set();

const { data: persisted } = hydrate({
  theme: DEFAULT_SETTINGS.theme,
  units: DEFAULT_SETTINGS.units,
  period: DEFAULT_SETTINGS.period,
  settings: DEFAULT_SETTINGS,
});

let state = {
  page: "overview",
  ready: false,
  loading: true,
  theme: persisted.theme,
  units: persisted.units,
  period: persisted.period,
  settings: persisted.settings,
  /** window end date (ISO) — the dashboard anchor */
  rangeEnd: null,
};

function notify(topic) {
  for (const fn of listeners) {
    try {
      fn(state, topic);
    } catch (err) {
      console.error("[store] listener failed", err);
    }
  }
}

export function getState() {
  return state;
}

export function setState(patch, topic = "state") {
  state = { ...state, ...patch };
  notify(topic);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function persistSlice() {
  persist({
    theme: state.theme,
    units: state.units,
    period: state.period,
    settings: state.settings,
  });
}

export const actions = {
  setPage(page) {
    if (state.page === page) return;
    setState({ page }, "page");
  },

  setTheme(theme) {
    setState({ theme }, "theme");
    persistSlice();
  },

  toggleTheme() {
    actions.setTheme(state.theme === "light" ? "dark" : "light");
  },

  setPeriod(period) {
    setState({ period }, "period");
    persistSlice();
  },

  setRangeEnd(iso) {
    setState({ rangeEnd: iso }, "range");
  },

  shiftRange(days) {
    const cur = state.rangeEnd;
    if (!cur) return;
    const d = new Date(cur);
    d.setDate(d.getDate() + days);
    const next = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
    actions.setRangeEnd(next);
  },

  updateSettings(patch) {
    const settings = {
      ...state.settings,
      ...patch,
      goals: { ...state.settings.goals, ...(patch.goals || {}) },
      profile: { ...state.settings.profile, ...(patch.profile || {}) },
      notify: { ...state.settings.notify, ...(patch.notify || {}) },
      priorities: { ...state.settings.priorities, ...(patch.priorities || {}) },
      connections: { ...state.settings.connections, ...(patch.connections || {}) },
    };
    if (patch.units) setState({ units: patch.units }, "settings");
    setState({ settings }, "settings");
    persistSlice();
  },

  toggleConnection(id) {
    const cur = !!state.settings.connections[id];
    actions.updateSettings({ connections: { [id]: !cur } });
  },

  movePriority(category, providerId, dir) {
    const list = [...(state.settings.priorities[category] || [])];
    const i = list.indexOf(providerId);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    actions.updateSettings({ priorities: { [category]: list } });
  },
};
