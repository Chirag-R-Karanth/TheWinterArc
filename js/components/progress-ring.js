/* ==========================================================================
   PROGRESS RING — single + concentric cluster
   ========================================================================== */

import { h, s } from "../utils/dom.js";
import { animateRing, prefersReducedMotion } from "../utils/anim.js";
import { clamp } from "../utils/numbers.js";

/**
 * ring({ size, stroke, pct, color, value, format, label, thick })
 */
export function ring({
  size = 132,
  stroke = 10,
  pct = 0,
  color = "var(--accent)",
  value = "",
  label = "",
  format = (v) => `${Math.round(v * 100)}`,
  trackColor,
} = {}) {
  const r = (size - stroke) / 2;
  const svg = s("svg", { class: "ring", width: size, height: size, viewBox: `0 0 ${size} ${size}` });
  const track = s("circle", {
    class: "ring__track", cx: size / 2, cy: size / 2, r,
    style: `stroke-width:${stroke}${trackColor ? `;stroke:${trackColor}` : ""}`,
  });
  const fillEl = s("circle", {
    class: "ring__fill", cx: size / 2, cy: size / 2, r,
    style: `stroke-width:${stroke};stroke:${color}`,
  });
  svg.appendChild(track);
  svg.appendChild(fillEl);

  const wrap = h("div", {
    class: "ring-wrap",
    style: { width: `${size}px`, height: `${size}px`, "--ring-fs": size > 150 ? "2rem" : size > 110 ? "1.5rem" : "1.15rem" },
  });
  wrap.appendChild(svg);
  if (value !== "" || label) {
    wrap.appendChild(
      h("div", { class: "ring__center" }, [
        value !== "" ? h("span", { class: "v", text: value }) : null,
        label ? h("span", { class: "k", text: label }) : null,
      ])
    );
  }
  requestAnimationFrame(() => animateRing(fillEl, clamp(pct, 0, 1), r));
  wrap.__setPct = (p) => animateRing(fillEl, clamp(p, 0, 1), r);
  return wrap;
}

/** concentric activity-style rings */
export function ringCluster({ size = 150, rings = [] } = {}) {
  const svg = s("svg", { class: "ring", width: size, height: size, viewBox: `0 0 ${size} ${size}` });
  const wrap = h("div", { class: "ring-wrap", style: { width: `${size}px`, height: `${size}px` } });
  const gap = 6;
  let radius = size / 2 - 7;
  const step = rings.length > 1 ? Math.min(16, (size / 2 - 8) / rings.length) : 14;
  const circles = [];
  for (const r of rings) {
    const stroke = Math.max(7, step - gap);
    svg.appendChild(s("circle", {
      class: "ring__track", cx: size / 2, cy: size / 2, r: radius, style: `stroke-width:${stroke}`,
    }));
    const c = s("circle", {
      class: "ring__fill", cx: size / 2, cy: size / 2, r: radius, style: `stroke-width:${stroke};stroke:${r.color}`,
    });
    svg.appendChild(c);
    circles.push({ c, radius, pct: r.pct });
    radius -= step;
  }
  wrap.appendChild(svg);
  if (rings[0]?.center !== false) {
    wrap.appendChild(
      h("div", { class: "ring__center" }, [
        h("span", { class: "v", text: rings[0]?.value ?? "" }),
        h("span", { class: "k", text: rings[0]?.label ?? "" }),
      ])
    );
  }
  requestAnimationFrame(() => {
    circles.forEach(({ c, radius: rr, pct }, i) => {
      if (prefersReducedMotion()) animateRing(c, pct, rr);
      else setTimeout(() => animateRing(c, pct, rr), i * 130);
    });
  });
  return wrap;
}
