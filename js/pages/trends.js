/* ==========================================================================
   TRENDS — how signals move together over time.
   Relationships are shown, never asserted: association ≠ causation.
   ========================================================================== */

import { h } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { panel, chartHost, legend, note } from "../components/ui.js";
import { metricCard } from "../components/metric-card.js";
import { lineChart, scatterChart } from "../components/charts.js";
import { pageFrame, gridRow, dateLabels } from "./_shared.js";
import * as health from "../services/health.js";
import { formatDec, correlation } from "../utils/numbers.js";
import { relativeLabel } from "../utils/dates.js";
import { wt, wtUnit } from "../utils/units.js";

/* ------------------------------------------------------------- pair model */

const PAIRS = [
  {
    id: "sleep-recovery", title: "Sleep → Recovery",
    x: {
      label: "Sleep", color: "var(--c-sleep)", acc: (d) => d.sleep?.asleepMin,
      fmt: (v) => `${formatDec(v / 60, 1)}h`, tip: (v) => `${formatDec(v / 60, 1)} h`,
    },
    y: {
      label: "Recovery", color: "var(--c-recovery)", acc: (d) => d.recovery.score,
      fmt: (v) => String(Math.round(v)), tip: (v) => `${Math.round(v)} / 100`,
    },
  },
  {
    id: "mood-sleep", title: "Mood → Sleep",
    x: {
      label: "Mood", color: "var(--c-mind)", acc: (d) => d.mind?.mood,
      fmt: (v) => formatDec(v, 1), tip: (v) => `${formatDec(v, 1)}/5`,
    },
    y: {
      label: "Sleep", color: "var(--c-sleep)", acc: (d) => d.sleep?.asleepMin,
      fmt: (v) => `${Math.round(v / 60)}h`, tip: (v) => `${formatDec(v / 60, 1)} h`,
    },
  },
  {
    id: "load-recovery", title: "Load → Recovery",
    x: {
      label: "Training load", color: "var(--c-activity)", acc: (d) => d.recovery.load,
      fmt: (v) => String(Math.round(v)), tip: (v) => `${Math.round(v)}`,
    },
    y: {
      label: "Recovery", color: "var(--c-recovery)", acc: (d) => d.recovery.score,
      fmt: (v) => String(Math.round(v)), tip: (v) => `${Math.round(v)} / 100`,
    },
  },
  {
    id: "sleep-activity", title: "Sleep → Activity",
    x: {
      label: "Sleep", color: "var(--c-sleep)", acc: (d) => d.sleep?.asleepMin,
      fmt: (v) => `${formatDec(v / 60, 1)}h`, tip: (v) => `${formatDec(v / 60, 1)} h`,
    },
    y: {
      label: "Steps", color: "var(--c-activity)", acc: (d) => d.activity.steps,
      fmt: (v) => `${Math.round(v / 1000)}k`, tip: (v) => `${Math.round(v).toLocaleString("en-US")}`,
    },
  },
  {
    id: "steps-weight", title: "Steps → Weight",
    x: {
      label: "Steps", color: "var(--c-activity)", acc: (d) => d.activity.steps,
      fmt: (v) => `${Math.round(v / 1000)}k`, tip: (v) => `${Math.round(v).toLocaleString("en-US")} steps`,
    },
    y: {
      label: `Weight`, color: "var(--c-body)", acc: (d) => d.body?.weightKg,
      fmt: (v) => `${formatDec(wt(v), 1)} ${wtUnit()}`, tip: (v) => `${formatDec(wt(v), 1)} ${wtUnit()}`,
    },
  },
  {
    id: "intake-weight", title: "Intake → Weight",
    x: {
      label: "Energy", color: "var(--c-nutrition)", acc: (d) => d.nutrition?.kcal,
      fmt: (v) => `${Math.round(v / 1000)}k`, tip: (v) => `${Math.round(v).toLocaleString("en-US")} kcal`,
    },
    y: {
      label: `Weight`, color: "var(--c-body)", acc: (d) => d.body?.weightKg,
      fmt: (v) => `${formatDec(wt(v), 1)} ${wtUnit()}`, tip: (v) => `${formatDec(wt(v), 1)} ${wtUnit()}`,
    },
  },
];

const HERO = ["sleep-recovery", "steps-weight", "mood-sleep", "intake-weight"];

function strength(r) {
  if (r == null) return { text: "Not enough overlap", cls: "chip--neutral" };
  const a = Math.abs(r);
  const dir = r >= 0 ? "positive" : "negative";
  const word = a >= 0.6 ? "Strong" : a >= 0.35 ? "Moderate" : a >= 0.15 ? "Slight" : "Little";
  return {
    text: `${word} ${dir}`,
    cls: a >= 0.35 ? (r > 0 ? "chip--up" : "chip--down") : "chip--neutral",
  };
}

const rChipClass = (r) => (r == null ? "chip--neutral" : r > 0.35 ? "chip--up" : r < -0.35 ? "chip--down" : "chip--neutral");

function indexSeries(values) {
  const vals = values.filter((v) => v != null && !Number.isNaN(v));
  if (!vals.length) return values.map(() => null);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  return values.map((v) => (v == null ? null : ((v - min) / span) * 100));
}

/* ------------------------------------------------------------------ page */

export function render(state) {
  const span = state.period === "day" ? 14 : state.period === "month" ? 90 : 30;
  const long = health.windowDays(state.rangeEnd, span);
  const wide = health.windowDays(state.rangeEnd, 60);

  const root = pageFrame(
    state,
    "Trends",
    `${span}-day relationship window · ${long.length} days ending ${relativeLabel(state.rangeEnd).toLowerCase()}`
  );

  let selected = PAIRS[0].id;
  const pair = () => PAIRS.find((p) => p.id === selected) || PAIRS[0];
  const rOf = (p) => correlation(long.map(p.x.acc), long.map(p.y.acc));

  /* ------------------------------------------------------- hero signals */
  const heroGrid = h("div", { class: "grid" });
  const heroCards = new Map();
  for (const id of HERO) {
    const p = PAIRS.find((x) => x.id === id);
    const r = rOf(p);
    const s = strength(r);
    const card = metricCard({
      className: "col-3", domain: "accent", tile: "trends",
      label: p.title,
      value: r == null ? null : r,
      format: (v) => formatDec(v, 2),
      status: s.text,
      spark: { values: long.map(p.y.acc), color: p.y.color },
      onClick: () => select(p.id),
    });
    heroCards.set(p.id, card);
    heroGrid.appendChild(card);
  }

  /* --------------------------------------------------------- explorer */
  const listHost = h("div", { class: "stack" });
  const scatterHost = chartHost(330);
  const moveHost = chartHost(224);
  const rChip = h("span", { class: "chip chip--neutral", text: "—" });
  const nChip = h("span", { class: "chip chip--neutral", text: "—" });

  gridRow(root,
    panel({
      className: "col-4", title: "Compare", tile: "trends", domain: "accent",
      subtitle: "Choose two signals",
      body: [listHost],
      foot: [note("Rank reflects the strength of association in the current window.")],
    }),
    panel({
      className: "col-8", title: "Relationship", tile: "spark", domain: "accent",
      subtitle: "Each dot is one day",
      actions: [rChip, nChip],
      body: [scatterHost],
      foot: [note("The dashed line is the least-squares fit across your own history — association, not cause.")],
    })
  );

  /* ----------------------------------------------------- co-movement */
  const moveLegendHost = h("div", { class: "legend" });
  gridRow(root,
    panel({
      className: "col-12", title: "Indexed movement", tile: "activity", domain: "activity",
      subtitle: "Both signals rescaled 0–100 so their shape can be compared directly",
      actions: [moveLegendHost],
      body: [moveHost],
      foot: [note("Indexing removes units; it shows when the two signals rise and fall together.")],
    })
  );

  /* --------------------------------------- domain trends + strength board */
  const domainHost = chartHost(250);
  const boardHost = h("div", { class: "stack" });
  gridRow(root,
    panel({
      className: "col-8", title: "Domain trends", tile: "overview", domain: "accent",
      subtitle: "60-day movement, each domain indexed to its own range",
      actions: [legend([
        { color: "var(--c-recovery)", label: "Recovery" },
        { color: "var(--c-sleep)", label: "Sleep" },
        { color: "var(--c-activity)", label: "Activity" },
        { color: "var(--c-mind)", label: "Mood" },
      ])],
      body: [domainHost],
      foot: [note("Cross-domain drift is easier to see when every signal shares one scale.")],
    }),
    panel({
      className: "col-4", title: "Signal strength", tile: "target", domain: "accent",
      subtitle: `Pearson r across ${span} days`,
      body: [boardHost],
    })
  );

  /* --------------------------------------------------- interaction model */
  function select(id) {
    selected = id;
    listHost.querySelectorAll(".row--select").forEach((el) =>
      el.classList.toggle("is-active", el.dataset.pair === id)
    );
    drawSelected();
  }

  let disposeScatter = null;
  let disposeMove = null;

  function drawSelected() {
    const p = pair();
    const r = rOf(p);
    const s = strength(r);
    rChip.className = `chip ${s.cls}`;
    rChip.textContent = r == null ? "—" : `r ${formatDec(r, 2)}`;
    nChip.className = "chip chip--neutral";
    nChip.textContent = `${long.filter((d) => p.x.acc(d) != null && p.y.acc(d) != null).length} days`;

    if (disposeScatter) disposeScatter();
    if (disposeMove) disposeMove();

    disposeScatter = scatterChart(scatterHost, {
      height: 330,
      x: long.map(p.x.acc),
      y: long.map(p.y.acc),
      labels: long.map((d) => relativeLabel(d.date)),
      color: p.x.color,
      fitColor: r != null && r < -0.2 ? "var(--c-danger)" : p.y.color,
      xLabel: p.x.label,
      yLabel: p.y.label,
      xFormat: p.x.fmt,
      yFormat: p.y.fmt,
      xTip: p.x.tip,
      yTip: p.y.tip,
      emptyText: "Not enough overlapping days to relate these signals yet.",
    });

    disposeMove = lineChart(moveHost, {
      height: 224,
      labels: dateLabels(long),
      series: [
        { id: "x", label: p.x.label, color: p.x.color, values: indexSeries(long.map(p.x.acc)), tipFormat: (v) => `${Math.round(v)} idx` },
        { id: "y", label: p.y.label, color: p.y.color, values: indexSeries(long.map(p.y.acc)), dashed: true, tipFormat: (v) => `${Math.round(v)} idx` },
      ],
      min: 0, max: 100, yTicks: 4, yFormat: (v) => String(Math.round(v)),
      emptyText: "One of these signals has no data in this window.",
    });

    moveLegendHost.innerHTML = "";
    moveLegendHost.appendChild(legendItem(p.x.color, p.x.label, false));
    moveLegendHost.appendChild(legendItem(p.y.color, p.y.label, true));
  }

  /* pair list */
  PAIRS.forEach((p) => {
    const r = rOf(p);
    const s = strength(r);
    const row = h("div", {
      class: "row row--select",
      dataset: { pair: p.id },
      onClick: () => select(p.id),
    }, [
      h("span", { class: "tile tile--accent" }, icon("trends")),
      h("div", { class: "row__main" }, [
        h("div", { class: "row__title", text: p.title }),
        h("div", { class: "row__sub", text: `${p.x.label} against ${p.y.label}` }),
      ]),
      h("span", { class: `chip ${s.cls}`, text: r == null ? "—" : `r ${formatDec(r, 2)}` }),
    ]);
    listHost.appendChild(row);
  });

  /* signal strength board (sorted by |r|) */
  const ranked = PAIRS.map((p) => ({ p, r: rOf(p) })).sort(
    (a, b) => Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0)
  );
  for (const { p, r } of ranked) {
    boardHost.appendChild(
      h("div", {
        class: "row row--select",
        dataset: { pair: p.id },
        onClick: () => select(p.id),
      }, [
        h("div", { class: "row__main" }, [
          h("div", { class: "row__title", text: p.title }),
          h("div", { class: "row__sub", text: strength(r).text }),
        ]),
        h("span", { class: `chip ${rChipClass(r)}`, text: r == null ? "—" : `r ${formatDec(r, 2)}` }),
      ])
    );
  }

  /* --------------------------------------------------- deferred drawing */
  queueMicrotask(() => {
    drawSelected();

    /* domain trends over a wider 60-day window */
    const series = [
      { id: "recovery", label: "Recovery", color: "var(--c-recovery)", values: indexSeries(wide.map((d) => d.recovery.score)) },
      { id: "sleep", label: "Sleep", color: "var(--c-sleep)", values: indexSeries(wide.map((d) => d.sleep?.asleepMin)) },
      { id: "activity", label: "Activity", color: "var(--c-activity)", values: indexSeries(wide.map((d) => d.activity.steps)) },
      { id: "mood", label: "Mood", color: "var(--c-mind)", values: indexSeries(wide.map((d) => d.mind?.mood)) },
    ];
    lineChart(domainHost, {
      height: 250,
      labels: dateLabels(wide),
      series: series.map((s) => ({ ...s, tipFormat: (v) => `${Math.round(v)} idx` })),
      min: 0, max: 100, yTicks: 4, yFormat: (v) => String(Math.round(v)),
      xTicks: 6,
      emptyText: "Not enough history to plot domain movement yet.",
    });
  });

  return root;
}

function legendItem(color, label, line) {
  return h("span", { class: "legend__item" }, [
    h("i", { class: line ? "line" : "", style: `--dot:${color}` }),
    label,
  ]);
}
