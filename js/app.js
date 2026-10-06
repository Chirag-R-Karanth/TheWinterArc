/* ==========================================================================
   WINTERARC — application bootstrap & router
   ========================================================================== */

import { getState, setState, subscribe, actions } from "./state/store.js";
import { iso, today } from "./utils/dates.js";
import { mountSidebar } from "./components/sidebar.js";
import { mountTopbar } from "./components/topbar.js";
import { h, clear } from "./utils/dom.js";
import { skeletonCard, emptyState } from "./components/card.js";
import { getDays } from "./services/health.js";

import * as overview from "./pages/overview.js";
import * as activity from "./pages/activity.js";
import * as recovery from "./pages/recovery.js";
import * as sleep from "./pages/sleep.js";
import * as nutrition from "./pages/nutrition.js";
import * as body from "./pages/body.js";
import * as mind from "./pages/mind.js";
import * as trends from "./pages/trends.js";
import * as settings from "./pages/settings.js";

const PAGES = { overview, activity, recovery, sleep, nutrition, body, mind, trends, settings };
const VALID = new Set(Object.keys(PAGES));

const els = {
  sidebar: document.getElementById("sidebar"),
  topbar: document.getElementById("topbar"),
  page: document.getElementById("page"),
};

/* ------------------------------------------------------------------ theme */

function applyTheme(theme, animate = false) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0b0c0e" : "#e4e6ea");
  if (animate) {
    document.body.classList.add("theme-anim");
    window.clearTimeout(applyTheme._t);
    applyTheme._t = window.setTimeout(() => document.body.classList.remove("theme-anim"), 420);
  }
}

/* ------------------------------------------------------------- motion */

function applyMotion(settings) {
  document.body.classList.toggle("reduce-motion", !!settings?.reducedMotion);
}

/* ----------------------------------------------------------------- router */

function pageFromHash() {
  const raw = (location.hash || "#/overview").replace(/^#\/?/, "").split("?")[0];
  return VALID.has(raw) ? raw : "overview";
}

function render() {
  const state = getState();
  const mod = PAGES[state.page] || PAGES.overview;
  clear(els.page);
  try {
    const el = mod.render(state);
    el.classList.add("page");
    els.page.appendChild(el);
    els.page.scrollTop = 0;
    const scroller = document.getElementById("content");
    if (scroller) scroller.scrollTop = 0;
  } catch (err) {
    console.error("[winterarc] page failed to render", err);
    const wrap = h("div", { class: "page" });
    wrap.appendChild(emptyState({
      icon: "info",
      title: "This page could not be rendered",
      sub: "Something went wrong while composing this view. Your data has not been modified.",
    }));
    els.page.appendChild(wrap);
  }
}

function renderLoading() {
  clear(els.page);
  const wrap = h("div", { class: "page" });
  const grid = h("div", { class: "grid" });
  for (let i = 0; i < 3; i++) grid.appendChild(skeletonCard(2));
  grid.appendChild(skeletonCard(6));
  grid.appendChild(skeletonCard(6));
  wrap.appendChild(
    h("div", { class: "page-head" }, [
      h("div", { class: "page-head__titles" }, [
        h("div", { class: "sk", style: { height: "28px", width: "220px" } }),
        h("div", { class: "sk mt-3", style: { height: "12px", width: "160px" } }),
      ]),
    ])
  );
  wrap.appendChild(grid);
  els.page.appendChild(wrap);
}

function navigate(page, push = true) {
  if (!VALID.has(page)) page = "overview";
  if (push && pageFromHash() !== page) {
    location.hash = `#/${page}`;
    return;
  }
  actions.setPage(page);
}

/* ------------------------------------------------------------------- boot */

let firstPaint = true;

function boot() {
  if (!getState().rangeEnd) setState({ rangeEnd: iso(today()) }, "range");
  applyTheme(getState().theme);
  applyMotion(getState().settings);

  mountSidebar(els.sidebar);
  mountTopbar(els.topbar);

  window.addEventListener("hashchange", () => navigate(pageFromHash(), false));

  // hydrate skeleton → real dashboard (brief, deliberate)
  renderLoading();
  window.setTimeout(() => {
    firstPaint = false;
    render();
  }, 320);

  subscribe((state, topic) => {
    applyMotion(state.settings);
    if (topic === "theme") {
      applyTheme(state.theme, true);
      return;
    }
    if (topic === "page") {
      if (pageFromHash() !== state.page) location.hash = `#/${state.page}`;
      render();
      return;
    }
    if (topic === "period" || topic === "range" || topic === "settings" || topic === "state") {
      if (!firstPaint) render();
    }
  });

  // reflect the address bar on first load & deep links
  navigate(pageFromHash(), false);

  // keep "today" fresh across midnight / long sessions
  window.setInterval(() => {
    const t = iso(today());
    const days = getDays();
    if (getDaySafe(days, t) && getState().rangeEnd !== t) return;
  }, 60000);

  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input, select, textarea")) return;
    if (e.key === "[" || e.key === "]") {
      e.preventDefault();
      const state = getState();
      actions.shiftRange(e.key === "[" ? -1 : 1);
    }
    if (e.key.toLowerCase() === "t") actions.toggleTheme();
  });
}

function getDaySafe(days, isoDate) {
  return days.some((d) => d.date === isoDate);
}

document.addEventListener("DOMContentLoaded", boot);