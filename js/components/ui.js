/* ==========================================================================
   UI KIT — composable page primitives
   ========================================================================== */

import { h } from "../utils/dom.js";
import { icon } from "./icons.js";
import { deltaChip } from "./metric-card.js";
import { formatInt } from "../utils/numbers.js";
import { getState } from "../state/store.js";

/** small stacked label + value block */
export function statBlock({ label, value, unit = "", sub = "", tone = "", delta = null, goodDirection = "up" } = {}) {
  return h("div", { class: "stack stack-2" }, [
    h("span", { class: "label", text: label }),
    h("div", { class: "metric__row" }, [
      h("span", { class: "kpi__v num", style: tone ? `color:${tone}` : "", text: value }),
      unit ? h("span", { class: "metric__unit", text: unit }) : null,
      delta !== null ? deltaChip(delta, goodDirection) : null,
    ]),
    sub ? h("span", { class: "muted", text: sub }) : null,
  ]);
}

export function kpiGrid(items = []) {
  return h("div", { class: "kpis" }, items.map((it) =>
    h("div", {}, [
      h("div", { class: "kpi__k", text: it.label }),
      h("div", { class: "kpi__v num", style: it.tone ? `color:${it.tone}` : "" }, [
        it.value,
        it.unit ? h("small", { text: it.unit }) : null,
      ]),
      it.sub ? h("div", { class: "muted", style: { fontSize: "var(--fs-2xs)", marginTop: "3px" }, text: it.sub }) : null,
    ])
  ));
}

/** horizontal bar rows: [{label, value, max, color, display}] */
export function bars(items = [], { showValue = true } = {}) {
  const max = Math.max(...items.map((i) => i.value || 0), 1);
  return h("div", { class: "stack" }, items.map((it) =>
    h("div", { class: "bar-row" }, [
      h("span", { class: "bar-row__label" }, [
        it.color ? h("i", { style: `--dot:${it.color}` }) : null,
        it.label,
      ]),
      h("div", { class: "bar-row__track" }, [
        h("div", { class: "bar", style: `--bar-color:${it.color || "var(--accent)"}` }, [
          h("div", {
            class: "bar__fill",
            style: { width: `${Math.min(100, ((it.value || 0) / (it.max || max)) * 100)}%` },
          }),
        ]),
      ]),
      showValue
        ? h("span", { class: "bar-row__value", text: it.display ?? formatInt(it.value) })
        : null,
    ])
  ));
}

export function legend(items = []) {
  return h("div", { class: "legend" }, items.map((it) =>
    h("span", { class: "legend__item" }, [
      h("i", { class: it.line ? "line" : "", style: `--dot:${it.color}` }),
      it.label,
    ])
  ));
}

export function badge(text, domain = "accent") {
  return h("span", { class: "badge-domain", style: `--badge-bg:var(--c-${domain}-soft);--badge-fg:var(--c-${domain})`, text });
}

export function listRow({ tile, domain = "accent", title, sub, value, subvalue }) {
  return h("div", { class: "row" }, [
    tile ? h("span", { class: `tile tile--${domain}` }, icon(tile)) : null,
    h("div", { class: "row__main" }, [
      h("div", { class: "row__title", text: title }),
      sub ? h("div", { class: "row__sub", text: sub }) : null,
    ]),
    value !== undefined
      ? h("div", { class: "row__value" }, [value, subvalue ? h("small", { text: subvalue }) : null])
      : null,
  ]);
}

/** card wrapper: header (tile + title + right actions) + flexible body */
export function panel({ title, tile, domain = "accent", subtitle, actions = [], body = [], foot = [], source = null, className = "", padSize = "" }) {
  const head = h("div", { class: "card__head" }, [
    h("div", { class: "card__title" }, [
      tile ? h("span", { class: `tile tile--${domain}` }, icon(tile)) : null,
      h("div", { class: "stack" }, [
        h("h4", { text: title }),
        subtitle ? h("span", { class: "muted", style: { fontSize: "var(--fs-2xs)" }, text: subtitle }) : null,
      ]),
    ]),
    actions.length ? h("div", { class: "card__actions" }, actions) : null,
  ]);
  const bodyEl = h("div", { class: "card__body" }, [].concat(body).filter(Boolean));
  const card = h("section", { class: ["card", className].filter(Boolean).join(" ") }, [head, bodyEl]);
  const footEls = [].concat(foot).filter(Boolean);
  if (source && getState().settings?.showProvenance) {
    footEls.push(h("span", { class: "chip chip--neutral", text: `Source · ${source}` }));
  }
  if (footEls.length) card.appendChild(h("div", { class: "card__foot" }, footEls));
  return card;
}

/** a chart viewport host with reserved height */
export function chartHost(height = 200, extraClass = "") {
  return h("div", { class: `chart ${extraClass}`.trim(), style: { minHeight: `${height}px` } });
}

export function note(text) {
  return h("div", {
    class: "muted",
    style: { fontSize: "var(--fs-2xs)", lineHeight: "1.5" },
    text,
  });
}

export function errWrap(title, sub) {
  return h("div", { class: "empty" }, [
    h("div", { class: "empty__icon" }, icon("info")),
    h("div", { class: "empty__title", text: title }),
    sub ? h("div", { class: "empty__sub", text: sub }) : null,
  ]);
}

/** consistent page header with period + date controls */
export function pageHeader({ title, subtitle, actions = [] }) {
  return h("div", { class: "page-head" }, [
    h("div", { class: "page-head__titles" }, [
      h("h2", { text: title }),
      subtitle ? h("p", { text: subtitle }) : null,
    ]),
    h("div", { class: "page-head__actions" }, actions),
  ]);
}