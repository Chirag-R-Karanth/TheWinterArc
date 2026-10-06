/* ==========================================================================
   BODY
   ========================================================================== */

import { h } from "../utils/dom.js";
import { panel, chartHost, legend, kpiGrid, note, listRow } from "../components/ui.js";
import { metricCard } from "../components/metric-card.js";
import { lineChart, barChart, sparkline } from "../components/charts.js";
import { pageFrame, gridRow, dateLabels, requireData, sourceLabel } from "./_shared.js";
import * as health from "../services/health.js";
import { formatDec, formatInt, deltaPct, correlation, movingAverage } from "../utils/numbers.js";
import { relativeLabel } from "../utils/dates.js";
import { wt, wtUnit, len, lenUnit } from "../utils/units.js";

export function render(state) {
  const { days, prev } = health.periodWindow(state.period, state.rangeEnd);
  const body = health.bodySummary(days);
  const prevBody = health.bodySummary(prev);
  const trend = health.windowDays(state.rangeEnd, 90);
  const month = health.windowDays(state.rangeEnd, 30);
  const goals = state.settings.goals;
  const root = pageFrame(
    state,
    "Body",
    body ? `${formatDec(wt(body.latest), 1)} ${wtUnit()} · ${body.change <= 0 ? "down" : "up"} ${formatDec(wt(Math.abs(body.change)), 1)} ${wtUnit()} in view` : "Weight and composition trends"
  );
  if (requireData(root, body, "No weigh-ins for this period. Log a measurement to begin the trend.")) return root;

  const weeklyRate = (body.change / Math.max(1, days.length)) * 7;

  /* hero */
  gridRow(root,
    metricCard({
      className: "col-3", domain: "body", tile: "scale",
      label: "Weight", value: wt(body.latest), unit: wtUnit(),
      format: (v) => formatDec(v, 1),
      status: `avg ${formatDec(wt(body.avg), 1)} ${wtUnit()}`,
      delta: deltaPct(body.latest, body.first),
      goodDirection: "down",
      spark: { values: days.map((d) => d.body?.weightKg), color: "var(--c-body)" },
    }),
    metricCard({
      className: "col-3", domain: "body", tile: "trends",
      label: "Weekly rate", value: wt(weeklyRate), unit: wtUnit() + "/wk",
      format: (v) => `${v > 0 ? "+" : ""}${formatDec(v, 2)}`,
      status: Math.abs(weeklyRate) < 0.15 ? "Stable" : weeklyRate < 0 ? "Cutting" : "Gaining",
      delta: deltaPct(body.splitDelta, prevBody?.splitDelta),
      goodDirection: "down",
      spark: { values: movingAverage(trend.map((d) => d.body?.weightKg), 7), color: "var(--c-body)" },
    }),
    metricCard({
      className: "col-3", domain: "body", tile: "ruler",
      label: "Body fat", value: body.bodyFat, unit: "%",
      format: (v) => formatDec(v, 1),
      status: `${formatDec(wt(body.min), 1)}–${formatDec(wt(body.max), 1)} ${wtUnit()} range`,
    }),
    metricCard({
      className: "col-3", domain: "body", tile: "ruler",
      label: "Waist", value: len(body.waist), unit: lenUnit(),
      format: (v) => formatDec(v, 1),
      status: `${body.weighIns} weigh-ins`,
    })
  );

  /* trend + composition */
  const trendHost = chartHost(280);
  const compHost = h("div", { class: "stack stack-4" });
  gridRow(root,
    panel({
      className: "col-8", title: "Weight trend", source: sourceLabel(state, "body"), tile: "scale", domain: "body",
      subtitle: "Daily readings with a 7-day average",
      actions: [legend([
        { color: "var(--c-body)", label: "7-day average", line: true },
        { color: "var(--text-4)", label: "Daily" },
      ])],
      body: [trendHost],
      foot: [
        h("span", { text: `Low ${formatDec(wt(body.min), 1)} · High ${formatDec(wt(body.max), 1)} ${wtUnit()}` }),
        h("span", { text: `Goal ${formatDec(wt(goals.weightKg), 1)} ${wtUnit()}` }),
      ],
    }),
    panel({
      className: "col-4", title: "Composition", tile: "ruler", domain: "accent",
      subtitle: "Change across the window",
      body: [compHost],
    })
  );

  /* intake vs weight, activity vs weight */
  const intakeHost = chartHost(230);
  const actHost = chartHost(230);
  const rIntake = correlation(month.map((d) => d.nutrition?.kcal), month.map((d) => d.body?.weightKg));
  const rSteps = correlation(month.map((d) => d.activity.steps), month.map((d) => d.body?.weightKg));
  gridRow(root,
    panel({
      className: "col-6", title: "Intake → Weight", tile: "nutrition", domain: "nutrition",
      subtitle: "Last 30 days",
      actions: [correlationChip(rIntake)],
      body: [intakeHost],
    }),
    panel({
      className: "col-6", title: "Activity → Weight", tile: "activity", domain: "activity",
      subtitle: "Last 30 days",
      actions: [correlationChip(rSteps)],
      body: [actHost],
      foot: [note("Day-to-day weight moves with hydration and food in transit — read the average, not the point.")],
    })
  );

  /* measure log */
  const logHost = h("div", { class: "stack" });
  gridRow(root,
    panel({
      className: "col-12", title: "Recent weigh-ins", tile: "calendar", domain: "body",
      subtitle: "Newest first",
      body: [logHost],
    })
  );

  /* deferred drawing */
  queueMicrotask(() => {
    const raw = trend.map((d) => (d.body?.weightKg == null ? null : wt(d.body.weightKg)));
    const smooth = movingAverage(raw, 7);
    lineChart(trendHost, {
      height: 280,
      labels: dateLabels(trend),
      xTicks: 6,
      series: [
        { id: "daily", label: "Daily", color: "var(--text-4)", values: raw, width: 1.4, dashed: true, tipFormat: (v) => `${formatDec(v, 1)} ${wtUnit()}` },
        { id: "avg", label: "7-day average", color: "var(--c-body)", values: smooth, tipFormat: (v) => `${formatDec(v, 1)} ${wtUnit()}` },
      ],
      target: { value: wt(goals.weightKg), color: "var(--accent)", label: `goal ${formatDec(wt(goals.weightKg), 1)} ${wtUnit()}` },
      padPct: 0.14,
      yFormat: (v) => `${formatDec(v, 1)}`,
      yTicks: 4,
    });

    compHost.appendChild(kpiGrid([
      { label: "Change", value: `${body.change <= 0 ? "−" : "+"}${formatDec(wt(Math.abs(body.change)), 1)}`, unit: wtUnit() },
      { label: "Percent", value: `${body.changePct}`, unit: "%" },
      { label: "Weekly rate", value: `${weeklyRate > 0 ? "+" : ""}${formatDec(wt(weeklyRate), 2)}`, unit: wtUnit() },
      { label: "Weigh-ins", value: body.weighIns },
    ]));
    const spark = h("div", { style: { height: "74px", marginTop: "8px" } });
    compHost.appendChild(spark);
    queueMicrotask(() => sparkline(spark, { values: trend.map((d) => d.body?.waistCm ?? null), color: "var(--c-mind)", height: 74 }));
    compHost.appendChild(note("Waist and body-fat are shown only where a source provides them."));

    barChart(intakeHost, {
      height: 230,
      labels: dateLabels(month),
      values: month.map((d) => d.nutrition?.kcal),
      color: "var(--c-nutrition)",
      yFormat: (v) => (v >= 1000 ? `${formatDec(v / 1000, 1)}k` : String(v)),
      tipLabel: "Intake", tipFormat: (v) => `${formatInt(v)} kcal`,
      line: { values: month.map((d) => (d.body?.weightKg == null ? null : wt(d.body.weightKg))), color: "var(--c-body)", label: "weight", tipFormat: (v) => `${formatDec(v, 1)} ${wtUnit()}` },
    });
    barChart(actHost, {
      height: 230,
      labels: dateLabels(month),
      values: month.map((d) => d.activity.steps),
      color: "var(--c-activity)",
      yFormat: (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)),
      tipLabel: "Steps", tipFormat: formatInt,
      line: { values: month.map((d) => (d.body?.weightKg == null ? null : wt(d.body.weightKg))), color: "var(--c-body)", label: "weight", tipFormat: (v) => `${formatDec(v, 1)} ${wtUnit()}` },
    });

    const recent = [...days].filter((d) => d.body?.weightKg != null).reverse().slice(0, 8);
    for (const d of recent) {
      logHost.appendChild(listRow({
        tile: "scale", domain: "body",
        title: relativeLabel(d.date),
        sub: d.body.bodyFatPct != null ? `Body fat ${formatDec(d.body.bodyFatPct, 1)}%` : "Weight only",
        value: `${formatDec(wt(d.body.weightKg), 1)}`,
        subvalue: wtUnit(),
      }));
    }
  });

  return root;
}

function correlationChip(r) {
  const cls = r == null ? "chip--neutral" : r > 0.35 ? "chip--up" : r < -0.35 ? "chip--down" : "chip--neutral";
  return h("span", { class: `chip ${cls}`, text: r == null ? "—" : `r ${formatDec(r, 2)}` });
}