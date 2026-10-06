/* ==========================================================================
   TOPBAR — page context + global utilities (sync state, theme)
   ========================================================================== */

import { h } from "../utils/dom.js";
import { icon } from "./icons.js";
import { subscribe, actions, getState } from "../state/store.js";
import { getDays } from "../services/health.js";
import { relativeLabel } from "../utils/dates.js";
import { windowLabel } from "./controls.js";

const PAGE_LABELS = {
  overview: "Overview",
  activity: "Activity",
  recovery: "Recovery",
  sleep: "Sleep",
  nutrition: "Nutrition",
  body: "Body",
  mind: "Mind",
  trends: "Trends",
  settings: "Settings",
};

export function mountTopbar(host) {
  const title = h("h1", { text: "Overview" });
  const crumb = h("span", { class: "crumb", text: "" });
  const syncPill = h("button", { class: "pill", title: "Aggregated from connected sources" }, [
    h("span", { style: { width: "7px", height: "7px", borderRadius: "50%", background: "var(--c-positive)", display: "inline-block" } }),
    h("span", { text: "Sources synced" }),
  ]);
  const themeBtn = h("button", { class: "pill", style: { gap: "7px" } });

  host.appendChild(
    h("div", { class: "topbar__title" }, [title, crumb])
  );
  host.appendChild(h("div", { class: "topbar__tools" }, [syncPill, themeBtn]));

  const paintTheme = (theme) => {
    themeBtn.innerHTML = "";
    themeBtn.appendChild(icon(theme === "dark" ? "sun" : "moon", { strokeWidth: 1.7 }));
    themeBtn.appendChild(h("span", { text: theme === "dark" ? "Light" : "Dark" }));
    themeBtn.title = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  };
  themeBtn.addEventListener("click", () => actions.toggleTheme());

  let lastSync = null;
  const paint = (state) => {
    title.textContent = PAGE_LABELS[state.page] || "WinterArc";
    const days = getDays();
    const latest = days.at(-1);
    if (latest && latest.date !== lastSync) {
      lastSync = latest.date;
      const srcs = new Set(
        Object.values(latest.provenance || {}).filter(Boolean)
      );
      syncPill.lastChild.textContent = `${srcs.size} sources · updated ${relativeLabel(latest.date).toLowerCase()}`;
    }
    if (state.page === "settings") {
      crumb.textContent = "Preferences & connections";
    } else if (state.page === "trends") {
      crumb.textContent = "Relationships over time";
    } else {
      crumb.textContent = windowLabel(state.rangeEnd, state.period);
    }
    paintTheme(state.theme);
  };

  paintTheme("light");
  const unsub = subscribe(paint);
  paint(getState());
  return unsub;
}