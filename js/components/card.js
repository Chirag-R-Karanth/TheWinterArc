/* ==========================================================================
   CARD PRIMITIVES
   ========================================================================== */

import { h, clear } from "../utils/dom.js";
import { icon } from "./icons.js";

export function card({ className = "", title, tile, domain, actions, body, foot, onClick, style } = {}) {
  const el = h("div", {
    class: ["card", onClick ? "card--interactive" : "", className].filter(Boolean).join(" "),
    style,
    onClick,
  });

  if (title || actions) {
    el.appendChild(
      h("div", { class: "card__head" }, [
        h("div", { class: "card__title" }, [
          tile ? h("span", { class: `tile tile--${domain || "accent"}` }, icon(tile)) : null,
          title ? h("h4", { text: title }) : null,
        ]),
        actions ? h("div", { class: "card__actions" }, actions) : null,
      ])
    );
  }

  const bodyEl = h("div", { class: "card__body" });
  if (body) {
    for (const node of [].concat(body)) if (node) bodyEl.appendChild(node);
  }
  el.appendChild(bodyEl);

  if (foot) el.appendChild(h("div", { class: "card__foot" }, foot));
  return el;
}

export function sectionHead(title, right) {
  return h("div", { class: "section__head" }, [
    h("h3", { text: title }),
    right || null,
  ]);
}

export function emptyState({ title = "No data yet", sub = "", icon: ic = "inbox", action } = {}) {
  return h("div", { class: "empty" }, [
    h("div", { class: "empty__icon" }, icon(ic)),
    h("div", { class: "empty__title", text: title }),
    sub ? h("div", { class: "empty__sub", text: sub }) : null,
    action || null,
  ]);
}

export function skeletonCard(rows = 3) {
  const c = h("div", { class: "card" });
  const body = h("div", { class: "card__body stack stack-3" }, [
    h("div", { class: "sk", style: { height: "14px", width: "45%" } }),
    h("div", { class: "sk", style: { height: "34px", width: "70%" } }),
  ]);
  for (let i = 0; i < rows; i++) {
    body.appendChild(h("div", { class: "sk", style: { height: "10px" } }));
  }
  c.appendChild(body);
  return c;
}

/** domain-colored chip showing metric provenance (Settings / tooltips only) */
export function sourceNote(sourceName) {
  return h("span", { class: "chip chip--neutral", text: sourceName || "—" });
}

export function fill(el, nodes) {
  clear(el);
  for (const n of [].concat(nodes)) if (n) el.appendChild(n);
  return el;
}
