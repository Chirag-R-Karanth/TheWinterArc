/* ==========================================================================
   METRIC CARD — the workhorse of every dashboard surface
   ========================================================================== */

import { h } from "../utils/dom.js";
import { icon } from "./icons.js";
import { sparkline } from "./charts.js";
import { countUp } from "../utils/anim.js";
import { formatInt, formatDuration, formatDec } from "../utils/numbers.js";

export function deltaChip(pct, goodDirection = "up", suffix = "%") {
  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    return h("span", { class: "chip chip--neutral", text: "—" });
  }
  const rounded = Math.abs(pct) >= 100 ? Math.round(pct) : Math.round(pct * 10) / 10;
  const up = pct >= 0;
  const neutral = Math.abs(pct) < 0.5;
  let cls = "chip chip--neutral";
  if (!neutral) cls = (goodDirection === "up" ? up : !up) ? "chip chip--up" : "chip chip--down";
  const arrow = neutral ? "→" : up ? "↑" : "↓";
  return h("span", { class: cls, text: `${arrow} ${Math.abs(rounded)}%` });
}

export function metricCard({
  className = "col-3",
  domain = "activity",
  tile = null,
  label,
  value = null,
  unit = "",
  format = formatInt,
  status = "",
  delta = null,
  goodDirection = "up",
  spark = null,
  foot = [],
  onClick = null,
  valueSize = "",
} = {}) {
  const head = h("div", { class: "card__head card__head--tight" }, [
    h("span", { class: "label", text: label }),
    tile ? h("span", { class: `tile tile--${domain}` }, icon(tile)) : null,
  ]);

  const valueEl = h("div", { class: ["metric__value", valueSize].filter(Boolean).join(" ") });
  const valueRow = h("div", { class: "metric__row" }, [
    valueEl,
    unit ? h("span", { class: "metric__unit", text: unit }) : null,
    status ? h("span", { class: "metric__status", text: status }) : null,
  ]);

  const metric = h("div", { class: "metric" }, [valueRow]);

  if (spark && spark.values?.length) {
    const sparkHost = h("div", { class: "metric__spark" });
    metric.appendChild(
      h("div", { class: "metric__foot" }, [
        sparkHost,
        delta ? h("div", { class: "stack", style: "align-items:flex-end;gap:4px" }, [
          deltaChip(delta, goodDirection),
          h("span", { class: "label", text: "vs prev" }),
        ]) : null,
      ])
    );
    requestAnimationFrame(() =>
      sparkline(sparkHost, {
        values: spark.values,
        color: spark.color || `var(--c-${domain})`,
        height: 42,
        area: spark.area !== false,
      })
    );
  } else if (delta !== null) {
    metric.appendChild(h("div", { class: "metric__foot" }, [deltaChip(delta, goodDirection)]));
  }

  if (foot.length) metric.appendChild(h("div", { class: "metric__foot" }, foot));

  const el = h("section", {
    class: ["card", "metric-card", className].filter(Boolean).join(" "),
    onClick,
  }, [head, metric]);
  if (onClick) el.classList.add("card--interactive");

  if (typeof value === "number") {
    if (valueEl.isConnected) countUp(valueEl, value, format);
    else requestAnimationFrame(() => countUp(valueEl, value, format));
  } else {
    valueEl.textContent = value === null || value === undefined ? "—" : String(value);
  }

  el.__setValue = (v, fmt = format) => {
    if (typeof v === "number") countUp(valueEl, v, fmt);
    else valueEl.textContent = v ?? "—";
  };
  return el;
}

export const FORMATTERS = {
  int: formatInt,
  kcal: formatInt,
  minutes: formatDuration,
  kg: (v) => formatDec(v, 1),
  score: (v) => String(Math.round(v)),
  pct: (v) => `${Math.round(v)}%`,
};