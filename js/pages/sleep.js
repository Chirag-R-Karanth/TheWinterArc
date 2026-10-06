/* ==========================================================================
   SLEEP
   ========================================================================== */

import { h } from "../utils/dom.js";
import { panel, chartHost, legend, kpiGrid, note } from "../components/ui.js";
import { metricCard } from "../components/metric-card.js";
import { lineChart, barChart, sleepTimeline, scatterChart } from "../components/charts.js";
import { ring } from "../components/progress-ring.js";
import { pageFrame, gridRow, dateLabels, requireData, sourceLabel } from "./_shared.js";
import * as health from "../services/health.js";
import { formatDuration, formatInt, formatDec, deltaPct, correlation, sum, formatClock } from "../utils/numbers.js";
import { DAY_MIN, relativeLabel } from "../utils/dates.js";
import { sleepLabel } from "../utils/calc.js";

export function render(state) {
  const { days, prev } = health.periodWindow(state.period, state.rangeEnd);
  const sleep = health.sleepSummary(days);
  const prevSleep = health.sleepSummary(prev);
  const context = health.windowDays(state.rangeEnd, state.period === "month" ? 30 : 14);
  const long = health.windowDays(state.rangeEnd, 30);
  const goals = state.settings.goals;
  const root = pageFrame(
    state,
    "Sleep",
    sleep ? `${formatDuration(sleep.avgAsleep)} average · ${sleepLabel(sleep.avgScore)}` : "Duration, timing and quality"
  );
  if (requireData(root, sleep, "No sleep sessions have synced. Wear your tracker overnight to populate this view.")) return root;

  /* hero */
  gridRow(root,
    metricCard({
      className: "col-3", domain: "sleep", tile: "sleep",
      label: state.period === "day" ? "Slept · last night" : "Sleep · avg",
      value: state.period === "day" ? (days.at(-1)?.sleep?.asleepMin ?? sleep.avgAsleep) : sleep.avgAsleep,
      format: formatDuration,
      status: `goal ${formatDuration(goals.sleepMin)}`,
      delta: deltaPct(sleep.avgAsleep, prevSleep?.avgAsleep),
      spark: { values: days.map((d) => d.sleep?.asleepMin), color: "var(--c-sleep)" },
    }),
    metricCard({
      className: "col-3", domain: "sleep", tile: "spark",
      label: "Sleep score", value: sleep.avgScore, unit: "/100",
      format: (v) => String(Math.round(v)),
      status: sleepLabel(sleep.avgScore),
      delta: deltaPct(sleep.avgScore, prevSleep?.avgScore),
      spark: { values: days.map((d) => d.sleep?.score), color: "var(--c-recovery)" },
    }),
    metricCard({
      className: "col-3", domain: "sleep", tile: "clock",
      label: "Typical bedtime", value: sleep.bedtimeAvg != null ? formatClock(sleep.bedtimeAvg) : "—",
      format: (v) => String(v),
      status: sleep.wakeAvg != null ? `wake ${formatClock(sleep.wakeAvg)}` : "",
      spark: { values: context.map((d) => d.sleep?.bedtime ?? null), color: "var(--c-sleep)" },
    }),
    metricCard({
      className: "col-3", domain: "recovery", tile: "ruler",
      label: "Consistency", value: `±${formatDuration(sleep.consistency)}`,
      format: (v) => String(v),
      status: sleep.debt > 0 ? `Debt ${formatDuration(sleep.debt)}` : `Surplus ${formatDuration(-sleep.debt)}`,
      spark: { values: context.map((d) => d.sleep?.asleepMin), color: "var(--c-body)" },
    })
  );

  /* timeline + stages */
  const timelineHost = chartHost(Math.max(200, context.length * 24 + 40));
  const stagesBody = h("div", { class: "stack stack-4", style: { alignItems: "center", width: "100%" } });
  gridRow(root,
    panel({
      className: "col-8", title: "Sleep timing", tile: "moon", domain: "sleep",
      subtitle: "Bed to wake, coloured by stage",
      actions: [legend([
        { color: "var(--c-sleep)", label: "Deep" },
        { color: "#8a97e4", label: "REM" },
        { color: "var(--c-sleep-soft)", label: "Light" },
        { color: "var(--c-danger)", label: "Awake" },
      ])],
      body: [timelineHost],
    }),
    panel({
      className: "col-4", title: "Goal & stages", tile: "target", domain: "sleep",
      subtitle: `Average night vs ${formatDuration(goals.sleepMin)}`,
      body: [stagesBody],
    })
  );

  /* duration + score */
  const durHost = chartHost(210);
  const scoreHost = chartHost(210);
  gridRow(root,
    panel({
      className: "col-6", title: "Duration", source: sourceLabel(state, "sleep"), tile: "clock", domain: "sleep",
      subtitle: "Nightly asleep time against your goal",
      body: [durHost],
    }),
    panel({
      className: "col-6", title: "Sleep score", tile: "spark", domain: "recovery",
      subtitle: "Composite of duration, stages and efficiency",
      body: [scoreHost],
    })
  );

  /* debt + timing correlation */
  const debtHost = chartHost(200);
  const bedHost = h("div", { class: "chart", style: { minHeight: "200px" } });
  const rBed = correlation(long.map((d) => d.sleep?.bedtime), long.map((d) => d.sleep?.score));
  gridRow(root,
    panel({
      className: "col-4", title: "Sleep debt", tile: "scale", domain: "sleep",
      subtitle: "Cumulative against goal",
      body: [debtHost],
    }),
    panel({
      className: "col-8", title: "Timing → Quality", tile: "trends", domain: "accent",
      subtitle: "Last 30 nights · does later sleep cost you quality?",
      actions: [correlationChip(rBed)],
      body: [bedHost],
      foot: [note("Each dot is one night; the fit line shows the general direction.")],
    })
  );

  /* deferred drawing */
  queueMicrotask(() => {
    const nights = context
      .filter((d) => d.sleep)
      .map((d) => ({
        label: DAY_MIN[new Date(d.date + "T12:00").getDay()],
        title: relativeLabel(d.date),
        bed: d.sleep.bedtime,
        inBed: d.sleep.inBedMin,
        asleepMin: d.sleep.asleepMin,
        lightMin: d.sleep.lightMin,
        deepMin: d.sleep.deepMin,
        remMin: d.sleep.remMin,
        awakeMin: d.sleep.awakeMin,
        asleep: formatDuration(d.sleep.asleepMin),
        deep: formatDuration(d.sleep.deepMin),
        rem: formatDuration(d.sleep.remMin),
        awake: formatDuration(d.sleep.awakeMin),
        eff: `${Math.round(d.sleep.efficiency * 100)}%`,
      }));
    sleepTimeline(timelineHost, { nights, height: Math.max(200, nights.length * 24 + 40) });

    const pct = Math.min(1, sleep.avgAsleep / goals.sleepMin);
    stagesBody.appendChild(ring({
      size: 132, stroke: 12, pct,
      color: "var(--c-sleep)",
      value: formatDuration(sleep.avgAsleep),
      label: `${Math.round(pct * 100)}% of goal`,
    }));
    const stageItems = [
      { label: "Deep", value: sleep.deepAvg, color: "var(--c-sleep)" },
      { label: "REM", value: sleep.remAvg, color: "#8a97e4" },
      { label: "Light", value: Math.max(0, sleep.avgAsleep - sleep.deepAvg - sleep.remAvg) , color: "var(--c-sleep-soft)" },
    ];
    stagesBody.appendChild(h("div", { class: "stack stack-3", style: "width:100%" }, stageItems.map((s) => {
      const p = Math.round((s.value / sleep.avgAsleep) * 100);
      return h("div", { class: "stack stack-2" }, [
        h("div", { class: "between" }, [
          h("span", { class: "label", text: s.label }),
          h("span", { class: "num", style: "font-size:var(--fs-xs);font-weight:600", text: `${formatDuration(s.value)} · ${p}%` }),
        ]),
        h("div", { class: "bar", style: `height:7px;--bar-color:${s.color}` }, [
          h("div", { class: "bar__fill", style: { width: `${p}%` } }),
        ]),
      ]);
    })));
    stagesBody.appendChild(kpiGrid([
      { label: "Efficiency", value: `${sleep.efficiency}%` },
      { label: "Nights", value: sleep.nights },
      { label: "Shortest", value: formatDuration(sleep.min) },
      { label: "Longest", value: formatDuration(sleep.max) },
    ]));

    barChart(durHost, {
      height: 210,
      labels: dateLabels(days),
      values: days.map((d) => d.sleep?.asleepMin),
      target: { value: goals.sleepMin, color: "var(--text-4)", label: `goal ${formatDuration(goals.sleepMin)}` },
      color: "var(--c-sleep)",
      yFormat: (v) => `${formatDec(v / 60, 0)}h`,
      tipLabel: "Asleep", tipFormat: (v) => formatDuration(v),
    });
    lineChart(scoreHost, {
      height: 210,
      labels: dateLabels(days),
      series: [{ id: "score", label: "Sleep score", color: "var(--c-recovery)", values: days.map((d) => d.sleep?.score), tipFormat: (v) => String(Math.round(v)) }],
      min: 0, max: 100, yTicks: 4, yFormat: (v) => String(Math.round(v)),
      target: { value: 72, color: "var(--text-4)", label: "good" },
    });

    /* cumulative debt curve */
    let running = 0;
    const debt = context.map((d) => {
      if (d.sleep?.asleepMin == null) return null;
      running += d.sleep.asleepMin - goals.sleepMin;
      return Math.round(running);
    });
    lineChart(debtHost, {
      height: 200,
      labels: dateLabels(context),
      series: [{ id: "debt", label: "Debt", color: running >= 0 ? "var(--c-danger)" : "var(--c-recovery)", values: debt, tipFormat: (v) => `${v >= 0 ? "−" : "+"}${formatDuration(Math.abs(v))}` }],
      yFormat: (v) => `${v / 60 >= 0 ? "" : ""}${formatDec(v / 60, 0)}h`,
      yTicks: 3,
      smooth: false,
    });

    scatterChart(bedHost, {
      height: 200,
      x: long.map((d) => d.sleep?.bedtime),
      y: long.map((d) => d.sleep?.score),
      labels: long.map((d) => relativeLabel(d.date)),
      color: "var(--c-sleep)",
      fitColor: rBed != null && rBed < 0 ? "var(--c-danger)" : "var(--accent)",
      xFormat: (v) => formatClock(v), yFormat: (v) => String(Math.round(v)),
      xTip: (v) => formatClock(v), yTip: (v) => `${Math.round(v)}`,
    });
  });

  return root;
}

function correlationChip(r) {
  const cls = r == null ? "chip--neutral" : r > 0.35 ? "chip--up" : r < -0.35 ? "chip--down" : "chip--neutral";
  return h("span", { class: `chip ${cls}`, text: r == null ? "—" : `r ${formatDec(r, 2)}` });
}