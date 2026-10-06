/* ==========================================================================
   CHART ENGINE — dependency-free SVG visualisation
   All charts: measure host → draw → observe resize → animate → tooltip.
   ========================================================================== */

import { s, clear } from "../utils/dom.js";
import { showTip, hideTip } from "./tooltip.js";
import { tween, prefersReducedMotion } from "../utils/anim.js";
import { clamp, formatInt, formatClock } from "../utils/numbers.js";

/* ------------------------------------------------------------------ utils */

function width(host, fallback = 640) {
  return Math.max(240, Math.round(host.clientWidth || fallback));
}

function lin(d0, d1, r0, r1) {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

function domainOf(series, opts = {}) {
  let min = Infinity;
  let max = -Infinity;
  for (const ser of series) {
    for (const v of ser.values || []) {
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (opts.target) {
    min = Math.min(min, opts.target.value);
    max = Math.max(max, opts.target.value);
  }
  if (!isFinite(min)) return [0, 1];
  if (opts.min !== undefined) min = opts.min;
  if (opts.max !== undefined) max = opts.max;
  if (opts.zero && min > 0) min = 0;
  if (min === max) {
    if (opts.zero) max = min + 1;
    else { min -= 1; max += 1; }
  }
  const pad = (max - min) * (opts.padPct ?? 0.1);
  if (opts.min === undefined) min -= pad;
  if (opts.max === undefined) max += pad;
  if (opts.zero && opts.min === undefined) min = 0;
  return [min, max];
}

/** smooth path through points (Catmull-Rom → cubic bezier) */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    d += `C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function linePath(pts, smooth) {
  if (!pts.length) return "";
  return smooth ? smoothPath(pts) : pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("");
}

/** split into runs of non-null values */
function segments(values, xs, ys) {
  const out = [];
  let cur = [];
  values.forEach((v, i) => {
    if (v === null || v === undefined || Number.isNaN(v)) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push([xs[i], ys(v)]);
  });
  if (cur.length) out.push(cur);
  return out;
}

function xIndices(n, maxLabels = 7) {
  if (n <= maxLabels) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil((n - 1) / (maxLabels - 1));
  const idx = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  if (idx.at(-1) !== n - 1) idx.push(n - 1);
  return idx;
}

function observe(host, draw) {
  let last = width(host);
  let pending = false;
  const redraw = () => {
    const w = width(host);
    if (Math.abs(w - last) < 2) return;
    last = w;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      draw();
    });
  };
  const ro = new ResizeObserver(redraw);
  ro.observe(host);
  // one deferred measure: catches hosts rendered before being attached
  requestAnimationFrame(() => {
    const w = width(host);
    if (Math.abs(w - last) > 2) {
      last = w;
      draw();
    }
  });
  return () => ro.disconnect();
}

function empty(host, message) {
  clear(host);
  const d = document.createElement("div");
  d.className = "empty";
  d.innerHTML = `<div class="empty__title">No data yet</div><div class="empty__sub">${message}</div>`;
  host.appendChild(d);
}

/* ============================================================ LINE CHART */

export function lineChart(host, spec) {
  const draw = () => {
    const W = width(host);
    const H = spec.height || 220;
    const pad = { t: 16, r: 12, b: 24, l: spec.axisL ?? 42, ...spec.pad };
    const labels = spec.labels || [];
    const series = (spec.series || []).filter((x) => x.values?.length);
    const hasData = series.some((ser) => ser.values.some((v) => v != null && !Number.isNaN(v)));
    if (!hasData) {
      empty(host, spec.emptyText || "Nothing has been recorded for this period.");
      return;
    }

    clear(host);
    const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    const n = Math.max(...series.map((x) => x.values.length));
    const [dMin, dMax] = domainOf(series, spec);
    const x = lin(0, Math.max(1, n - 1), pad.l, W - pad.r);
    const y = lin(dMin, dMax, H - pad.b, pad.t);
    const fmtY = spec.yFormat || ((v) => formatInt(v));
    const fmtX = spec.xFormat || ((v) => v);

    /* grid + y labels */
    const g = s("g", { class: "chart__grid" });
    for (const t of niceTicks(dMin, dMax, spec.yTicks ?? 3)) {
      const yy = Math.round(y(t)) + 0.5;
      g.appendChild(s("line", { x1: pad.l, x2: W - pad.r, y1: yy, y2: yy }));
      g.appendChild(
        s("text", { x: pad.l - 8, y: yy + 3.5, "text-anchor": "end", class: "chart__axis" }, fmtY(t))
      );
    }
    svg.appendChild(g);

    /* x labels */
    for (const i of xIndices(n, spec.xTicks ?? 7)) {
      if (!labels[i] && labels[i] !== 0) continue;
      svg.appendChild(
        s("text", {
          x: x(i), y: H - 7, "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle",
          class: "chart__axis",
        }, String(fmtX(labels[i])))
      );
    }

    /* target line */
    if (spec.target) {
      const yy = Math.round(y(spec.target.value)) + 0.5;
      svg.appendChild(
        s("line", {
          x1: pad.l, x2: W - pad.r, y1: yy, y2: yy,
          stroke: spec.target.color || "var(--text-4)",
          "stroke-width": 1.2, "stroke-dasharray": "5 5", opacity: 0.85,
        })
      );
      if (spec.target.label) {
        svg.appendChild(
          s("text", {
            x: W - pad.r, y: yy - 6, "text-anchor": "end",
            class: "chart__axis", fill: spec.target.color || "var(--text-4)",
          }, spec.target.label)
        );
      }
    }

    /* series */
    const xs = Array.from({ length: n }, (_, i) => x(i));
    let clipId = 0;
    series.forEach((ser, si) => {
      const color = ser.color || "var(--accent)";
      const segs = segments(ser.values, xs, y);
      if (spec.area !== false && si === 0 && segs.length) {
        const gid = `grad-${host.dataset.chartId || (host.dataset.chartId = Math.random().toString(36).slice(2))}-${clipId++}`;
        const defs = s("defs");
        const lg = s("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
        lg.appendChild(s("stop", { offset: "0%", "stop-color": color, "stop-opacity": 0.32 }));
        lg.appendChild(s("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }));
        defs.appendChild(lg);
        svg.appendChild(defs);
        for (const seg of segs) {
          if (seg.length < 2) continue;
          const base = H - pad.b;
          const d =
            linePath(seg, spec.smooth) +
            `L${seg[seg.length - 1][0]},${base}L${seg[0][0]},${base}Z`;
          svg.appendChild(s("path", { d, fill: `url(#${gid})`, class: "chart__area" }));
        }
      }
      for (const seg of segs) {
        if (seg.length === 1) {
          svg.appendChild(s("circle", { cx: seg[0][0], cy: seg[0][1], r: 3.2, fill: color }));
          continue;
        }
        const path = s("path", {
          d: linePath(seg, spec.smooth),
          class: "chart__line",
          stroke: color,
          "stroke-width": ser.width || 2.2,
          ...(ser.dashed ? { "stroke-dasharray": "5 5" } : {}),
        });
        svg.appendChild(path);
      }
      /* end dot */
      const vals = ser.values;
      for (let i = n - 1; i >= 0; i--) {
        if (vals[i] != null) {
          svg.appendChild(s("circle", { cx: x(i), cy: y(vals[i]), r: 3.6, fill: color, class: "chart__dot" }));
          break;
        }
      }
    });

    /* hover layer */
    const cross = s("line", {
      class: "chart__crosshair", y1: pad.t, y2: H - pad.b, x1: 0, x2: 0, opacity: 0,
    });
    svg.appendChild(cross);
    const dots = series.map((ser) => {
      const c = s("circle", {
        r: 4.5, fill: ser.color || "var(--accent)", stroke: "var(--card)",
        "stroke-width": 2.5, opacity: 0,
      });
      svg.appendChild(c);
      return c;
    });

    const hit = s("rect", {
      x: pad.l, y: pad.t, width: Math.max(1, W - pad.r - pad.l), height: Math.max(1, H - pad.b - pad.t),
      class: "chart__hit",
    });
    svg.appendChild(hit);

    const nearest = (evt) => {
      const r = svg.getBoundingClientRect();
      const px = ((evt.clientX - r.left) / r.width) * W;
      const i = clamp(Math.round(((px - pad.l) / (W - pad.r - pad.l)) * (n - 1)), 0, n - 1);
      return i;
    };

    hit.addEventListener("mousemove", (evt) => {
      const i = nearest(evt);
      const cx = x(i);
      cross.setAttribute("x1", cx);
      cross.setAttribute("x2", cx);
      cross.setAttribute("opacity", 1);
      const rows = [];
      series.forEach((ser, si) => {
        const v = ser.values[i];
        if (v == null || Number.isNaN(v)) {
          dots[si].setAttribute("opacity", 0);
          rows.push({ label: ser.label, value: "—", color: ser.color });
        } else {
          dots[si].setAttribute("cx", cx);
          dots[si].setAttribute("cy", y(v));
          dots[si].setAttribute("opacity", 1);
          rows.push({ label: ser.label, value: (ser.tipFormat || fmtY)(v), color: ser.color });
        }
      });
      showTip({
        x: evt.clientX, y: evt.clientY,
        title: labels[i] != null ? (spec.tipTitle ? spec.tipTitle(labels[i]) : labels[i]) : "",
        rows,
      });
    });
    hit.addEventListener("mouseleave", () => {
      cross.setAttribute("opacity", 0);
      dots.forEach((d) => d.setAttribute("opacity", 0));
      hideTip();
    });

    host.appendChild(svg);

    if (spec.animate !== false && !prefersReducedMotion()) {
      svg.classList.add("chart-draw");
      svg.querySelectorAll(".chart__line").forEach((p) => {
        try { p.style.setProperty("--len", p.getTotalLength()); } catch { /* ignore */ }
      });
    }
  };

  draw();
  return observe(host, draw);
}

/* ============================================================= BAR CHART */

export function barChart(host, spec) {
  const draw = () => {
    const W = width(host);
    const H = spec.height || 200;
    const pad = { t: 18, r: 8, b: 24, l: spec.axisL ?? 40, ...spec.pad };
    const values = spec.values || [];
    const labels = spec.labels || [];
    const n = values.length;
    const hasData = values.some((v) => v != null && !Number.isNaN(v));
    if (!hasData) {
      empty(host, spec.emptyText || "Nothing recorded in this range.");
      return;
    }
    clear(host);

    const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    const maxV = spec.max ?? Math.max(...values.filter((v) => v != null), spec.target?.value ?? 0) * 1.12;
    const minV = spec.min ?? 0;
    const y = lin(minV, maxV, H - pad.b, pad.t);
    const bandW = (W - pad.l - pad.r) / Math.max(1, n);
    const barW = Math.min(spec.barW ?? 26, bandW * 0.62);
    const fmtY = spec.yFormat || ((v) => formatInt(v));

    const g = s("g", { class: "chart__grid" });
    for (const t of niceTicks(minV, maxV, spec.yTicks ?? 3)) {
      const yy = Math.round(y(t)) + 0.5;
      g.appendChild(s("line", { x1: pad.l, x2: W - pad.r, y1: yy, y2: yy }));
      g.appendChild(s("text", { x: pad.l - 8, y: yy + 3.5, "text-anchor": "end", class: "chart__axis" }, fmtY(t)));
    }
    svg.appendChild(g);

    for (const i of xIndices(n, spec.xTicks ?? 7)) {
      if (labels[i] == null) continue;
      svg.appendChild(
        s("text", {
          x: pad.l + bandW * (i + 0.5), y: H - 7,
          "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle",
          class: "chart__axis",
        }, String(labels[i]))
      );
    }

    if (spec.target) {
      const yy = Math.round(y(spec.target.value)) + 0.5;
      svg.appendChild(s("line", {
        x1: pad.l, x2: W - pad.r, y1: yy, y2: yy,
        stroke: spec.target.color || "var(--text-4)", "stroke-width": 1.2, "stroke-dasharray": "5 5",
      }));
    }

    const base = H - pad.b;
    const bars = values.map((v, i) => {
      if (v == null || Number.isNaN(v)) return null;
      const cx = pad.l + bandW * (i + 0.5);
      const yy = y(v);
      const h = Math.max(2, base - yy);
      const r = Math.min(7, barW / 2);
      const path = s("path", {
        d: `M${cx - barW / 2},${base} v${-h} a${r},${r} 0 0 1 ${r},${-r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h} Z`,
        fill: spec.colorFor
          ? spec.colorFor(values[i], i)
          : Array.isArray(spec.color)
            ? spec.color[i % spec.color.length]
            : spec.color || "var(--c-activity)",
        opacity: spec.highlight != null && spec.highlight !== i ? 0.34 : 0.95,
      });
      path.style.transformOrigin = `${cx}px ${base}px`;
      svg.appendChild(path);
      if (spec.valueLabels && n <= 14) {
        svg.appendChild(s("text", {
          x: cx, y: yy - 7, "text-anchor": "middle", class: "chart__axis",
        }, (spec.valueFormat || fmtY)(v)));
      }
      return { path, v, cx, h };
    });

    /* optional overlay line (dual axis) */
    if (spec.line?.values?.some((v) => v != null)) {
      const lv = spec.line.values;
      const [lMin, lMax] = domainOf([{ values: lv }], { padPct: 0.14, min: spec.line.min, max: spec.line.max });
      const ly = lin(lMin, lMax, H - pad.b, pad.t);
      const pts = lv.map((v, i) => (v == null ? null : [pad.l + bandW * (i + 0.5), ly(v)])).filter(Boolean);
      if (pts.length > 1) {
        svg.appendChild(s("path", {
          d: linePath(pts, spec.line.smooth ?? true),
          class: "chart__line", stroke: spec.line.color || "var(--c-body)", "stroke-width": 2.2,
        }));
        const last = pts.at(-1);
        svg.appendChild(s("circle", { cx: last[0], cy: last[1], r: 3.6, fill: spec.line.color, class: "chart__dot" }));
      }
      if (spec.line.label) {
        svg.appendChild(s("text", {
          x: W - pad.r, y: pad.t - 6, "text-anchor": "end", class: "chart__axis",
          fill: spec.line.color,
        }, spec.line.label));
      }
    }

    const hit = s("rect", { x: pad.l, y: pad.t, width: W - pad.l - pad.r, height: H - pad.t - pad.b, class: "chart__hit" });
    svg.appendChild(hit);
    hit.addEventListener("mousemove", (evt) => {
      const r = svg.getBoundingClientRect();
      const px = ((evt.clientX - r.left) / r.width) * W;
      const i = clamp(Math.floor((px - pad.l) / bandW), 0, n - 1);
      const rows = [{ label: spec.tipLabel || "Value", value: (spec.tipFormat || fmtY)(values[i] ?? 0), color: Array.isArray(spec.color) ? spec.color[i % spec.color.length] : spec.color }];
      if (spec.line?.values?.[i] != null) {
        rows.push({
          label: spec.line.label || "Overlay",
          value: (spec.line.tipFormat || ((v) => String(v)))(spec.line.values[i]),
          color: spec.line.color,
        });
      }
      bars.forEach((b, bi) => b && b.path.setAttribute("opacity", bi === i ? 1 : 0.34));
      showTip({ x: evt.clientX, y: evt.clientY, title: labels[i] ?? "", rows });
    });
    hit.addEventListener("mouseleave", () => {
      bars.forEach((b) => b && b.path.setAttribute("opacity", 0.95));
      hideTip();
    });

    host.appendChild(svg);

    if (!prefersReducedMotion()) {
      bars.forEach((b, i) => {
        if (!b) return;
        b.path.style.transform = "scaleY(0.02)";
        b.path.style.opacity = "0";
        setTimeout(() => {
          b.path.style.transition = "transform .6s cubic-bezier(.22,.61,.36,1), opacity .4s ease";
          b.path.style.transform = "scaleY(1)";
          b.path.style.opacity = spec.highlight != null && spec.highlight !== i ? "0.34" : "0.95";
        }, 40 + i * 34);
      });
    }
  };

  draw();
  return observe(host, draw);
}

/* ============================================================ SPARKLINE */

export function sparkline(host, spec) {
  const draw = () => {
    const W = Math.max(80, host.clientWidth || 160);
    const H = spec.height || 40;
    const values = spec.values || [];
    if (!values.some((v) => v != null)) {
      clear(host);
      host.style.height = `${H}px`;
      return;
    }
    clear(host);
    const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    const [dMin, dMax] = domainOf([{ values }], { padPct: 0.18 });
    const n = values.length;
    const x = lin(0, Math.max(1, n - 1), 2, W - 2);
    const y = lin(dMin, dMax, H - 4, 4);
    const pts = values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    const color = spec.color || "var(--accent)";

    if (spec.area !== false && pts.length > 1) {
      const gid = `sg-${Math.random().toString(36).slice(2)}`;
      const defs = s("defs");
      const lg = s("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
      lg.appendChild(s("stop", { offset: "0%", "stop-color": color, "stop-opacity": 0.3 }));
      lg.appendChild(s("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }));
      defs.appendChild(lg);
      svg.appendChild(defs);
      svg.appendChild(s("path", {
        d: linePath(pts, true) + `L${pts.at(-1)[0]},${H}L${pts[0][0]},${H}Z`,
        fill: `url(#${gid})`, class: "chart__area", opacity: 1,
      }));
    }
    if (pts.length > 1) {
      svg.appendChild(s("path", { d: linePath(pts, true), class: "chart__line", stroke: color, "stroke-width": spec.width || 2 }));
    }
    const last = pts.at(-1);
    if (last) svg.appendChild(s("circle", { cx: last[0], cy: last[1], r: 3, fill: color, class: "chart__dot" }));
    host.appendChild(svg);
    if (spec.animate !== false && !prefersReducedMotion()) {
      svg.classList.add("chart-draw");
      svg.querySelectorAll(".chart__line").forEach((p) => {
        try { p.style.setProperty("--len", p.getTotalLength()); } catch { /* ignore */ }
      });
    }
  };
  draw();
  return observe(host, draw);
}

/* ====================================================== SLEEP TIMELINE */

const STAGE_COLOR = {
  deep: "var(--c-sleep)",
  rem: "#8a97e4",
  light: "var(--c-sleep-soft)",
  awake: "var(--c-danger-soft)",
};

export function sleepTimeline(host, spec) {
  const draw = () => {
    const W = width(host);
    const nights = spec.nights || [];
    if (!nights.length) {
      empty(host, "No sleep sessions recorded in this range.");
      return;
    }
    const rowH = spec.rowH || 16;
    const gap = 8;
    const H = spec.height || nights.length * (rowH + gap) + 34;
    const pad = { t: 8, r: 10, b: 26, l: 46 };
    clear(host);

    let lo = Infinity, hi = -Infinity;
    for (const nt of nights) {
      lo = Math.min(lo, nt.bed);
      hi = Math.max(hi, nt.bed + nt.inBed);
    }
    lo = Math.floor((lo - 20) / 60) * 60;
    hi = Math.ceil((hi + 20) / 60) * 60;
    const x = lin(lo, hi, pad.l, W - pad.r);
    const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });

    /* time gridlines every 2h */
    const g = s("g", { class: "chart__grid" });
    for (let t = lo; t <= hi; t += 120) {
      const xx = Math.round(x(t)) + 0.5;
      g.appendChild(s("line", { x1: xx, x2: xx, y1: pad.t, y2: H - pad.b }));
      svg.appendChild(s("text", {
        x: xx, y: H - 8, "text-anchor": "middle", class: "chart__axis",
      }, formatClock(((t % 1440) + 1440) % 1440)));
    }
    svg.appendChild(g);

    nights.forEach((nt, i) => {
      const yy = pad.t + i * (rowH + gap);
      svg.appendChild(s("text", {
        x: pad.l - 8, y: yy + rowH - 4, "text-anchor": "end", class: "chart__axis",
      }, nt.label || ""));
      svg.appendChild(s("rect", {
        x: pad.l, y: yy, width: W - pad.r - pad.l, height: rowH,
        rx: rowH / 2, fill: "var(--track)", opacity: 0.6,
      }));

      let cursor = nt.bed;
      /* composed stage blocks: settling → deep → light → REM → awake → REM */
      const seq = [
        ["light", Math.round(nt.lightMin * 0.35)],
        ["deep", nt.deepMin],
        ["light", Math.round(nt.lightMin * 0.4)],
        ["rem", nt.remMin],
        ["awake", nt.awakeMin],
        ["light", Math.max(0, nt.lightMin - Math.round(nt.lightMin * 0.75))],
        ["rem", Math.round(nt.remMin * 0.4)],
      ];
      for (const [stage, mins] of seq) {
        if (!mins || cursor >= nt.bed + nt.inBed) continue;
        const w = Math.max(2, x(Math.min(cursor + mins, nt.bed + nt.inBed)) - x(cursor));
        svg.appendChild(s("rect", {
          x: x(cursor), y: yy, width: w, height: rowH,
          fill: STAGE_COLOR[stage], rx: stage === "awake" ? 2 : 1,
        }));
        cursor += mins;
      }
      if (cursor < nt.bed + nt.inBed) {
        svg.appendChild(s("rect", {
          x: x(cursor), y: yy, width: x(nt.bed + nt.inBed) - x(cursor), height: rowH,
          fill: STAGE_COLOR.light, rx: 1,
        }));
      }
      const hit = s("rect", { x: pad.l, y: yy, width: W - pad.r - pad.l, height: rowH, fill: "transparent" });
      hit.addEventListener("mousemove", (evt) =>
        showTip({
          x: evt.clientX, y: evt.clientY, title: nt.title || nt.label,
          rows: [
            { label: "Asleep", value: nt.asleep, color: "var(--c-sleep)" },
            { label: "Deep", value: nt.deep, color: STAGE_COLOR.deep },
            { label: "REM", value: nt.rem, color: STAGE_COLOR.rem },
            { label: "Awake", value: nt.awake, color: "var(--c-danger)" },
            { label: "Efficiency", value: nt.eff, color: "rgba(255,255,255,.5)" },
          ],
        })
      );
      hit.addEventListener("mouseleave", hideTip);
      svg.appendChild(hit);
    });

    host.appendChild(svg);
  };
  draw();
  return observe(host, draw);
}

/* ========================================================== SCATTER FIT */

export function scatterChart(host, spec) {
  const draw = () => {
    const W = width(host);
    const H = spec.height || 240;
    const pad = { t: 16, r: 14, b: 34, l: 46, ...spec.pad };
    const pts = [];
    (spec.x || []).forEach((xv, i) => {
      const yv = spec.y?.[i];
      if (xv == null || yv == null) return;
      pts.push({ x: xv, y: yv, label: spec.labels?.[i] || "", i });
    });
    if (pts.length < 3) {
      empty(host, spec.emptyText || "Not enough overlapping data to relate these metrics yet.");
      return;
    }
    clear(host);
    const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    const [xMin, xMax] = domainOf([{ values: pts.map((p) => p.x) }], { padPct: 0.12 });
    const [yMin, yMax] = domainOf([{ values: pts.map((p) => p.y) }], { padPct: 0.14 });
    const sx = lin(xMin, xMax, pad.l, W - pad.r);
    const sy = lin(yMin, yMax, H - pad.b, pad.t);

    const g = s("g", { class: "chart__grid" });
    for (const t of niceTicks(yMin, yMax, 3)) {
      const yy = Math.round(sy(t)) + 0.5;
      g.appendChild(s("line", { x1: pad.l, x2: W - pad.r, y1: yy, y2: yy }));
      g.appendChild(s("text", { x: pad.l - 8, y: yy + 3.5, "text-anchor": "end", class: "chart__axis" },
        (spec.yFormat || formatInt)(t)));
    }
    svg.appendChild(g);
    for (const t of niceTicks(xMin, xMax, 4)) {
      const xx = Math.round(sx(t)) + 0.5;
      g.appendChild(s("line", { x1: xx, x2: xx, y1: pad.t, y2: H - pad.b }));
      svg.appendChild(s("text", { x: xx, y: H - 14, "text-anchor": "middle", class: "chart__axis" },
        (spec.xFormat || formatInt)(t)));
    }
    svg.appendChild(s("text", { x: W - pad.r, y: H - 2, "text-anchor": "end", class: "chart__axis" },
      spec.xLabel || ""));
    svg.appendChild(s("text", { x: pad.l - 8, y: pad.t - 4, "text-anchor": "end", class: "chart__axis" },
      spec.yLabel || ""));

    /* least-squares fit of y on x */
    const fit = (() => {
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      let num = 0, den = 0;
      for (let i = 0; i < xs.length; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        den += (xs[i] - mx) ** 2;
      }
      const m = den ? num / den : 0;
      return { m, b: my - m * mx };
    })();

    if (fit) {
      const p1 = [xMin, fit.m * xMin + fit.b];
      const p2 = [xMax, fit.m * xMax + fit.b];
      svg.appendChild(s("line", {
        x1: sx(p1[0]), y1: sy(p1[1]), x2: sx(p2[0]), y2: sy(p2[1]),
        stroke: spec.fitColor || "var(--accent)", "stroke-width": 2,
        "stroke-dasharray": "6 5", opacity: 0.9,
      }));
    }

    const color = spec.color || "var(--c-activity)";
    for (const p of pts) {
      const c = s("circle", {
        cx: sx(p.x), cy: sy(p.y), r: 4.6, fill: color, opacity: 0.62,
        stroke: "var(--card)", "stroke-width": 1.5,
      });
      c.addEventListener("mousemove", (evt) =>
        showTip({
          x: evt.clientX, y: evt.clientY, title: p.label,
          rows: [
            { label: spec.xLabel || "X", value: (spec.xTip || spec.xFormat || formatInt)(p.x), color },
            { label: spec.yLabel || "Y", value: (spec.yTip || spec.yFormat || formatInt)(p.y), color: spec.fitColor || "var(--accent)" },
          ],
        })
      );
      c.addEventListener("mouseleave", hideTip);
      c.addEventListener("mouseenter", () => c.setAttribute("opacity", 1));
      svg.appendChild(c);
    }

    host.appendChild(svg);
  };
  draw();
  return observe(host, draw);
}

export { tween };
