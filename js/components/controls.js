/* ==========================================================================
   CONTROLS — segmented period switch, date navigator, tabs
   ========================================================================== */

import { h, clear } from "../utils/dom.js";
import { icon } from "./icons.js";
import { fmtRange, fmtDate, relativeLabel, iso, today, addDays, parseISO } from "../utils/dates.js";

export function segmented({ options, value, onChange, className = "" }) {
  const el = h("div", { class: ["seg", className].filter(Boolean).join(" ") });
  for (const opt of options) {
    const btn = h("button", {
      class: ["seg__btn", opt.id === value ? "is-active" : ""].filter(Boolean).join(" "),
      text: opt.label,
      title: opt.title || opt.label,
      onClick: () => {
        if (opt.id === value) return;
        el.querySelectorAll(".seg__btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        onChange(opt.id);
      },
    });
    el.appendChild(btn);
  }
  el.__setValue = (v) => {
    el.querySelectorAll(".seg__btn").forEach((b, i) =>
      b.classList.toggle("is-active", options[i].id === v)
    );
  };
  return el;
}

export function tabs({ items, value, onChange }) {
  const el = h("div", { class: "tabs" });
  for (const item of items) {
    const btn = h("button", {
      class: ["tabs__btn", item.id === value ? "is-active" : ""].filter(Boolean).join(" "),
      text: item.label,
      onClick: () => {
        if (item.id === value) return;
        el.querySelectorAll(".tabs__btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        onChange(item.id);
      },
    });
    el.appendChild(btn);
  }
  return el;
}

export function periodSwitch({ value, onChange }) {
  return segmented({
    value,
    onChange,
    options: [
      { id: "day", label: "Day" },
      { id: "week", label: "Week" },
      { id: "month", label: "Month" },
    ],
  });
}

/**
 * dateControl — prev / label / next over the active window
 */
export function dateControl({ endISO, period, onShift, canNext = true }) {
  const step = period === "day" ? 1 : period === "week" ? 7 : 30;
  const label = windowLabel(endISO, period);
  const el = h("div", { class: "datectl" }, [
    h("button", { class: "datectl__btn", title: "Previous", onClick: () => onShift(-step) }, icon("chevronL")),
    h("span", { class: "datectl__label", text: label }),
    h("button", {
      class: "datectl__btn",
      title: "Next",
      style: canNext ? "" : "opacity:.35;pointer-events:none",
      onClick: () => onShift(step),
    }, icon("chevronR")),
  ]);
  return el;
}

export function windowLabel(endISO, period) {
  if (!endISO) return "";
  const end = parseISO(endISO);
  if (period === "day") return relativeLabel(endISO);
  const days = period === "week" ? 6 : 29;
  const start = addDays(end, -days);
  return fmtRange(iso(start), endISO);
}

export function fullDate(dateISO) {
  return fmtDate(dateISO, { weekday: "long", day: "numeric", month: "long" });
}
