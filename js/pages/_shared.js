/* ==========================================================================
   PAGE SHARED HELPERS
   ========================================================================== */

import { h } from "../utils/dom.js";
import { pageHeader } from "../components/ui.js";
import { rangeBar } from "../components/range-bar.js";
import { average, deltaPct } from "../utils/numbers.js";
import { DAY_MIN } from "../utils/dates.js";
import * as health from "../services/health.js";
import { PROVIDER_MAP } from "../services/integrations.js";

/** provider behind a signal on this page — null hides the chip */
export function sourceLabel(state, category) {
  if (!state.settings?.showProvenance) return null;
  const pid = health.provenance(state.rangeEnd, category);
  const p = pid ? PROVIDER_MAP[pid] : null;
  return p ? p.name : null;
}

export const avgOf = (arr) => average((arr || []).filter((v) => v != null));

export function pageFrame(state, title, subtitle) {
  const root = h("div", { class: "stack" });
  root.appendChild(pageHeader({ title, subtitle, actions: [rangeBar(state)] }));
  return root;
}

export function gridRow(root, ...cards) {
  const g = h("div", { class: "grid" });
  for (const c of cards) if (c) g.appendChild(c);
  root.appendChild(g);
  return g;
}

export function sectionBlock(root, node) {
  root.appendChild(node);
  return node;
}

export function dayLabels(days) {
  return days.map((d) => DAY_MIN[new Date(d.date + "T12:00").getDay()]);
}

export function dateLabels(days) {
  return days.map((d) => {
    const dt = new Date(d.date + "T12:00");
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
  });
}

export function weekdayAverages(days, accessor) {
  const buckets = Array.from({ length: 7 }, () => []);
  for (const d of days) {
    const v = accessor(d);
    if (v == null) continue;
    buckets[new Date(d.date + "T12:00").getDay()].push(v);
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dow) => ({
    label: DAY_MIN[dow === 0 ? 0 : dow],
    value: avgOf(buckets[dow]),
    count: buckets[dow].length,
  })).map((x) => ({ ...x, label: x.label }));
}

export function pctDelta(curr, prev) {
  return deltaPct(curr, prev);
}

export function requireData(root, ok, message) {
  if (ok) return false;
  root.appendChild(
    h("section", { class: "card", style: "min-height:240px" }, [
      h("div", { class: "empty" }, [
        h("div", { class: "empty__title", text: "Not enough data" }),
        h("div", { class: "empty__sub", text: message }),
      ]),
    ])
  );
  return true;
}