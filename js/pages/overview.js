/* ==========================================================================
   OVERVIEW — the observatory's primary composition
   ========================================================================== */

import { h } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { rangeBar } from "../components/range-bar.js";
import { metricCard } from "../components/metric-card.js";
import { panel, chartHost, legend, note } from "../components/ui.js";
import { lineChart, barChart, sparkline, scatterChart } from "../components/charts.js";
import { ring } from "../components/progress-ring.js";
import * as health from "../services/health.js";
import { actions } from "../state/store.js";
import {
  formatInt, formatDuration, formatDec, deltaPct, average, correlation,
} from "../utils/numbers.js";
import { dist, distUnit, wt, wtUnit } from "../utils/units.js";
import { greeting, fmtDate, DAY_MIN, relativeLabel } from "../utils/dates.js";
import { recoveryLabel, sleepLabel } from "../utils/calc.js";
import { sourceLabel } from "./_shared.js";

const avgOf = (arr) => average(arr.filter((v) => v != null));

export function render(state) {
  const root = h("div", { class: "stack" });
  const { days, prev } = health.periodWindow(state.period, state.rangeEnd);
  if (!days.length) return emptyPage();

  const contextCount = state.period === "day" ? 14 : state.period === "week" ? 7 : 30;
  const context = health.windowDays(state.rangeEnd, contextCount);
  const latest = days[days.length - 1];
  const goals = state.settings.goals;

  const act = health.activitySummary(days);
  const sleep = health.sleepSummary(days);
  const rec = health.recoverySummary(days);
  const nut = health.nutritionSummary(days, goals);
  const body = health.bodySummary(days);
  const mind = health.mindSummary(days);

  const latestAct = health.activitySummary([latest]);
  const latestRec = health.recoverySummary([latest]);
  const latestSleep = health.sleepSummary([latest]);
  const latestNut = health.nutritionSummary([latest], goals);

  /* ---------------------------------------------------------------- header */
  const header = h("div", { class: "page-head" }, [
    h("div", { class: "page-head__titles" }, [
      h("h2", { text: greeting() }),
      h("p", { text: `${relativeLabel(state.rangeEnd)} · ${fmtDate(state.rangeEnd, { weekday: "long", day: "numeric", month: "long" })}` }),
    ]),
    rangeBar(state),
  ]);

  /* ------------------------------------------------------------ hero cards */
  const heroGrid = h("div", { class: "grid" });
  const pick = (latestVal, avgVal) => (state.period === "day" ? latestVal : avgVal);

  const stepsVal = pick(latest?.activity.steps, act?.steps?.avg);
  heroGrid.appendChild(metricCard({
    className: "col-3", domain: "activity", tile: "steps",
    label: state.period === "day" ? "Steps · today" : "Steps · daily avg",
    value: stepsVal ?? null,
    unit: "steps",
    format: (v) => formatInt(v),
    status: act ? `${formatDec(dist(act.distance.avg || 0), 1)} ${distUnit()} avg` : "",
    delta: deltaPct(avgOf(days.map((d) => d.activity.steps)), avgOf((prev || []).map((d) => d.activity.steps))),
    goodDirection: "up",
    spark: { values: context.map((d) => d.activity.steps), color: "var(--c-activity)" },
    onClick: () => actions.setPage("activity"),
  }));

  const recVal = pick(latestRec?.latest, rec?.avgScore);
  heroGrid.appendChild(metricCard({
    className: "col-3", domain: "recovery", tile: "recovery",
    label: state.period === "day" ? "Recovery · today" : "Recovery · avg",
    value: recVal ?? null,
    format: (v) => String(Math.round(v)),
    status: recoveryLabel(recVal),
    delta: deltaPct(avgOf(days.map((d) => d.recovery.score)), avgOf((prev || []).map((d) => d.recovery.score))),
    goodDirection: "up",
    spark: { values: context.map((d) => d.recovery.score), color: "var(--c-recovery)" },
    onClick: () => actions.setPage("recovery"),
  }));

  const sleepVal = pick(latestSleep?.avgAsleep, sleep?.avgAsleep);
  heroGrid.appendChild(metricCard({
    className: "col-3", domain: "sleep", tile: "sleep",
    label: state.period === "day" ? "Sleep · last night" : "Sleep · avg",
    value: sleepVal ?? null,
    format: (v) => formatDuration(v),
    status: sleepLabel(pick(latestSleep?.avgScore, sleep?.avgScore)),
    delta: deltaPct(avgOf(days.map((d) => d.sleep?.asleepMin)), avgOf((prev || []).map((d) => d.sleep?.asleepMin))),
    goodDirection: "up",
    spark: { values: context.map((d) => d.sleep?.asleepMin), color: "var(--c-sleep)" },
    onClick: () => actions.setPage("sleep"),
  }));

  const kcalVal = pick(latestNut?.kcal?.latest, nut?.kcal?.avg);
  const nutCard = metricCard({
    className: "col-3", domain: "nutrition", tile: "nutrition",
    label: state.period === "day" ? "Intake · today" : "Energy · daily avg",
    value: kcalVal ?? null,
    unit: "kcal",
    format: (v) => formatInt(v),
    status: nut ? `${nut.coverage}% logged` : "",
    delta: deltaPct(avgOf(days.map((d) => d.nutrition?.kcal)), avgOf((prev || []).map((d) => d.nutrition?.kcal))),
    goodDirection: "down",
    onClick: () => actions.setPage("nutrition"),
  });
  if (nut) {
    const pct = Math.min(100, (nut.kcal.avg / goals.energyKcal) * 100);
    nutCard.querySelector(".metric").appendChild(
      h("div", { class: "metric__foot", style: { flexDirection: "column", alignItems: "stretch", gap: "7px" } }, [
        h("div", { class: "bar", style: "height:6px;--bar-color:var(--c-nutrition)" }, [
          h("div", { class: "bar__fill", style: { width: `${pct}%` } }),
        ]),
        h("div", { class: "between" }, [
          h("span", { class: "label", text: `${formatInt(Math.max(0, goals.energyKcal - nut.kcal.avg))} remaining` }),
          h("span", { class: "label", text: `goal ${formatInt(goals.energyKcal)}` }),
        ]),
      ])
    );
  }
  heroGrid.appendChild(nutCard);

  /* ------------------------------------------------- recovery / sleep / body */
  const grid2 = h("div", { class: "grid" });

  const recHost = chartHost(226);
  grid2.appendChild(panel({
    className: "col-6", title: "Recovery balance", source: sourceLabel(state, "heartRate"), tile: "recovery", domain: "recovery",
    subtitle: "Composite readiness against training load",
    actions: [legend([
      { color: "var(--c-recovery)", label: "Recovery" },
      { color: "var(--c-activity)", label: "Load" },
    ])],
    body: [recHost],
    foot: rec ? [
      h("span", { text: `Best ${rec.best} · Lowest ${rec.worst}` }),
      h("span", { text: `HRV ${rec.hrvAvg ?? "—"} ms · RHR ${rec.rhrAvg ?? "—"} bpm` }),
    ] : [],
  }));

  const sleepRingHost = h("div", { class: "between", style: { alignItems: "center", gap: "18px" } });
  grid2.appendChild(panel({
    className: "col-3", title: "Sleep", tile: "sleep", domain: "sleep",
    subtitle: sleep ? `${sleep.nights} nights recorded` : "Not recorded",
    body: [sleepRingHost],
    foot: sleep ? [
      h("span", { text: `Consistency ±${formatDuration(sleep.consistency)}` }),
      h("span", { text: sleep.debt > 0 ? `Debt ${formatDuration(sleep.debt)}` : `Surplus ${formatDuration(-sleep.debt)}` }),
    ] : [],
  }));

  const bodyHost = h("div", { class: "stack stack-3" });
  grid2.appendChild(panel({
    className: "col-3", title: "Body", tile: "body", domain: "body",
    subtitle: body ? "Weight trend" : "No measurements",
    body: [bodyHost],
    foot: body ? [
      h("span", { text: `${body.weighIns} weigh-ins` }),
      body.bodyFat ? h("span", { text: `Body fat ${formatDec(body.bodyFat, 1)}%` }) : h("span", { text: `${formatDec(wt(body.min), 1)}–${formatDec(wt(body.max), 1)} ${wtUnit()}` }),
    ] : [],
  }));

  /* ------------------------------------------------- activity / nutrition */
  const grid3 = h("div", { class: "grid" });

  const actHost = chartHost(236);
  grid3.appendChild(panel({
    className: "col-8", title: "Daily movement", source: sourceLabel(state, "steps"), tile: "activity", domain: "activity",
    subtitle: `${context.length}-day context`,
    actions: [legend([
      { color: "var(--c-activity)", label: "Steps" },
      { color: "var(--c-nutrition)", label: "Active kcal", line: true },
    ])],
    body: [actHost],
    foot: act ? [
      h("span", { text: `${act.workouts.count} workouts · ${formatDuration(act.workouts.minutes)}` }),
      h("span", { text: `${formatInt(act.activeKcal.total)} active kcal · ${formatDec(dist(act.distance.total), 0)} ${distUnit()}` }),
    ] : [],
  }));

  const nutBodyHost = h("div", { class: "stack stack-4" });
  grid3.appendChild(panel({
    className: "col-4", title: "Nutrition", tile: "nutrition", domain: "nutrition",
    subtitle: nut ? `${nut.coverage}% of days logged` : "Not logged",
    body: [nutBodyHost],
  }));

  /* ------------------------------------------------------- mood / patterns */
  const grid4 = h("div", { class: "grid" });

  const moodHost = chartHost(204);
  grid4.appendChild(panel({
    className: "col-4", title: "Mood & stress", tile: "mind", domain: "mind",
    subtitle: mind ? `${mind.logged} check-ins` : "No check-ins",
    actions: [legend([
      { color: "var(--c-mind)", label: "Mood" },
      { color: "var(--c-nutrition)", label: "Stress" },
    ])],
    body: [moodHost],
    foot: mind ? [
      h("span", { text: `Mood ${formatDec(mind.moodAvg, 1)}/5` }),
      h("span", { text: `Stress ${formatDec(mind.stressAvg, 1)}/5` }),
    ] : [],
  }));

  const corrHost = h("div", { class: "grid grid--tight" });
  grid4.appendChild(panel({
    className: "col-8", title: "Patterns", tile: "trends", domain: "accent",
    subtitle: "How these signals move together over the last 30 days",
    body: [corrHost],
    foot: [note("Association across your own history — not a claim of causation.")],
  }));

  root.appendChild(header);
  root.appendChild(heroGrid);
  root.appendChild(grid2);
  root.appendChild(grid3);
  root.appendChild(grid4);

  /* ------------------------------------------------------ deferred drawing */
  queueMicrotask(() => {
    lineChart(recHost, {
      height: 226,
      labels: context.map((d) => DAY_MIN[new Date(d.date + "T12:00").getDay()]),
      tipTitle: (l) => l,
      series: [
        { id: "recovery", label: "Recovery", color: "var(--c-recovery)", values: context.map((d) => d.recovery.score), tipFormat: (v) => String(Math.round(v)) },
        { id: "load", label: "Load", color: "var(--c-activity)", values: context.map((d) => d.recovery.load), dashed: true, tipFormat: (v) => String(Math.round(v)) },
      ],
      min: 0, max: 100, yTicks: 4, yFormat: (v) => String(Math.round(v)),
    });

    drawSleepSummary(sleepRingHost, sleep, goals);
    drawBody(bodyHost, context, body);

    barChart(actHost, {
      height: 236,
      labels: context.map((d) => DAY_MIN[new Date(d.date + "T12:00").getDay()]),
      values: context.map((d) => d.activity.steps),
      target: { value: goals.steps, color: "var(--text-4)", label: `goal ${formatInt(goals.steps)}` },
      color: "var(--c-activity)",
      yFormat: (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)),
      tipLabel: "Steps",
      tipFormat: (v) => formatInt(v),
      line: {
        values: context.map((d) => d.activity.activeKcal),
        color: "var(--c-nutrition)",
        label: "active kcal",
        tipFormat: (v) => formatInt(v),
      },
    });

    drawNutritionSummary(nutBodyHost, nut, goals);

    lineChart(moodHost, {
      height: 204,
      labels: context.map((d) => DAY_MIN[new Date(d.date + "T12:00").getDay()]),
      series: [
        { id: "mood", label: "Mood", color: "var(--c-mind)", values: context.map((d) => d.mind?.mood), tipFormat: (v) => `${formatDec(v, 1)}/5` },
        { id: "stress", label: "Stress", color: "var(--c-nutrition)", values: context.map((d) => d.mind?.stress), dashed: true, tipFormat: (v) => `${formatDec(v, 1)}/5` },
      ],
      min: 1, max: 5, yTicks: 4, yFormat: (v) => formatDec(v, 0),
    });

    drawPatterns(corrHost, health.windowDays(state.rangeEnd, 30));
  });

  return root;
}

/* ------------------------------------------------------------- sub-renderers */

function drawSleepSummary(host, sleep, goals) {
  if (!sleep) {
    host.appendChild(h("div", { class: "muted", text: "No sleep recorded in this range." }));
    return;
  }
  host.appendChild(ring({
    size: 112, stroke: 11,
    pct: Math.min(1, sleep.avgAsleep / goals.sleepMin),
    color: "var(--c-sleep)",
    value: formatDuration(sleep.avgAsleep),
    label: "avg sleep",
  }));
  host.appendChild(h("div", { class: "stack stack-3 grow" }, [
    miniStat("Deep", formatDuration(sleep.deepAvg)),
    miniStat("REM", formatDuration(sleep.remAvg)),
    miniStat("Efficiency", `${sleep.efficiency}%`),
  ]));
}

function miniStat(label, value) {
  return h("div", { class: "between" }, [
    h("span", { class: "label", text: label }),
    h("span", { class: "num", style: { fontWeight: "600", fontSize: "var(--fs-sm)" }, text: value }),
  ]);
}

function drawBody(host, context, body) {
  if (!body) {
    host.appendChild(h("div", { class: "muted", text: "No weigh-ins recorded." }));
    return;
  }
  host.appendChild(h("div", { class: "metric__row", style: { alignItems: "baseline" } }, [
    h("span", { class: "metric__value metric__value--sm num", text: formatDec(wt(body.latest), 1) }),
    h("span", { class: "metric__unit", text: wtUnit() }),
  ]));
  const spark = h("div", { style: { height: "46px" } });
  host.appendChild(spark);
  host.appendChild(h("div", { class: "between" }, [
    h("span", {
      class: `chip ${body.change <= 0 ? "chip--up" : "chip--down"}`,
      text: `${body.change <= 0 ? "↓" : "↑"} ${formatDec(wt(Math.abs(body.change)), 1)} ${wtUnit()}`,
    }),
    h("span", { class: "label", text: `${context.length}d trend` }),
  ]));
  queueMicrotask(() => sparkline(spark, {
    values: context.map((d) => d.body?.weightKg ?? null),
    color: "var(--c-body)",
    height: 46,
  }));
}

function drawNutritionSummary(host, nut, goals) {
  if (!nut) {
    host.appendChild(h("div", { class: "muted", text: "No meals logged in this range." }));
    return;
  }
  host.appendChild(h("div", { class: "between", style: { alignItems: "center", gap: "16px" } }, [
    ring({
      size: 102, stroke: 10,
      pct: Math.min(1, nut.kcal.avg / goals.energyKcal),
      color: "var(--c-nutrition)",
      value: formatInt(nut.kcal.avg),
      label: "avg kcal",
    }),
    h("div", { class: "grow stack stack-3" }, [
      macroBar("Protein", nut.protein.avg, goals.proteinG, "var(--c-activity)"),
      macroBar("Carbs", nut.carbs.avg, goals.carbsG, "var(--c-nutrition)"),
      macroBar("Fat", nut.fat.avg, goals.fatG, "var(--c-mind)"),
    ]),
  ]));
  host.appendChild(h("div", { class: "between", style: { marginTop: "4px" } }, [
    h("span", { class: "label", text: `Consistency ±${nut.consistency} kcal` }),
    h("span", { class: "label", text: `${nut.adherence}% on target` }),
  ]));
}

function macroBar(label, value, target, color) {
  return h("div", { class: "stack stack-2" }, [
    h("div", { class: "between" }, [
      h("span", { class: "label", text: label }),
      h("span", { class: "num", style: { fontSize: "var(--fs-xs)", fontWeight: "600" }, text: `${formatInt(value)}/${formatInt(target)}g` }),
    ]),
    h("div", { class: "bar", style: `height:7px;--bar-color:${color}` }, [
      h("div", { class: "bar__fill", style: { width: `${Math.min(100, (value / target) * 100)}%` } }),
    ]),
  ]);
}

function drawPatterns(host, long) {
  const tasks = [
    { a: "Sleep", b: "Recovery", x: long.map((d) => d.sleep?.asleepMin), y: long.map((d) => d.recovery.score), xFormat: (v) => `${Math.round(v / 60)}h`, yFormat: (v) => String(Math.round(v)) },
    { a: "Load", b: "Recovery", x: long.map((d) => d.recovery.load), y: long.map((d) => d.recovery.score), xFormat: (v) => String(Math.round(v)), yFormat: (v) => String(Math.round(v)) },
    { a: "Steps", b: "Intake", x: long.map((d) => d.activity.steps), y: long.map((d) => d.nutrition?.kcal), xFormat: (v) => `${Math.round(v / 1000)}k`, yFormat: (v) => formatInt(v) },
    { a: "Mood", b: "Sleep", x: long.map((d) => d.mind?.mood), y: long.map((d) => d.sleep?.asleepMin), xFormat: (v) => formatDec(v, 1), yFormat: (v) => `${Math.round(v / 60)}h` },
  ];

  for (const t of tasks) {
    const r = correlation(t.x, t.y);
    const host2 = h("div", { class: "chart", style: { minHeight: "104px" } });
    host.appendChild(h("div", { class: "card card--soft", style: "padding:12px;grid-column:span 6" }, [
      h("div", { class: "between", style: { marginBottom: "4px" } }, [
        h("span", { class: "label", text: `${t.a} → ${t.b}` }),
        h("span", {
          class: `chip ${r == null ? "chip--neutral" : r > 0.35 ? "chip--up" : r < -0.35 ? "chip--down" : "chip--neutral"}`,
          text: r == null ? "—" : `r ${formatDec(r, 2)}`,
        }),
      ]),
      host2,
    ]));
    queueMicrotask(() => scatterChart(host2, {
      height: 100, x: t.x, y: t.y,
      labels: long.map((d) => relativeLabel(d.date)),
      color: "var(--c-activity)",
      fitColor: r != null && r < -0.2 ? "var(--c-danger)" : "var(--accent)",
      xFormat: t.xFormat, yFormat: t.yFormat,
    }));
  }
}

function emptyPage() {
  return h("div", { class: "stack" }, [
    h("div", { class: "page-head" }, [
      h("div", { class: "page-head__titles" }, [
        h("h2", { text: greeting() }),
        h("p", { text: "No health data available for this period." }),
      ]),
    ]),
    h("section", { class: "card", style: "min-height:280px" }, [
      h("div", { class: "empty" }, [
        h("div", { class: "empty__icon" }, icon("inbox")),
        h("div", { class: "empty__title", text: "Nothing to observe yet" }),
        h("div", { class: "empty__sub", text: "Connect a source or shift the date range to bring this period into view." }),
      ]),
    ]),
  ]);
}