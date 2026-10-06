/* ==========================================================================
   RECOVERY
   ========================================================================== */

import { h } from "../utils/dom.js";
import { panel, chartHost, legend, kpiGrid, note } from "../components/ui.js";
import { metricCard } from "../components/metric-card.js";
import { lineChart, barChart, scatterChart } from "../components/charts.js";
import { pageFrame, gridRow, dateLabels, requireData, sourceLabel } from "./_shared.js";
import * as health from "../services/health.js";
import { formatInt, formatDec, deltaPct, clamp, correlation } from "../utils/numbers.js";
import { recoveryLabel } from "../utils/calc.js";

export function render(state) {
  const { days, prev } = health.periodWindow(state.period, state.rangeEnd);
  const rec = health.recoverySummary(days);
  const prevRec = health.recoverySummary(prev);
  const long = health.windowDays(state.rangeEnd, 30);
  const root = pageFrame(
    state,
    "Recovery",
    rec ? `Composite readiness across ${days.length} days · ${recoveryLabel(rec.avgScore)}` : "Readiness, HRV and training load"
  );
  if (requireData(root, rec, "Recovery needs a night of sleep or a heart-rate reading to appear.")) return root;

  /* hero */
  gridRow(root,
    metricCard({
      className: "col-3", domain: "recovery", tile: "recovery",
      label: state.period === "day" ? "Readiness · today" : "Readiness · avg",
      value: state.period === "day" ? rec.latest : rec.avgScore,
      format: (v) => String(Math.round(v)),
      status: recoveryLabel(state.period === "day" ? rec.latest : rec.avgScore),
      delta: deltaPct(rec.avgScore, prevRec?.avgScore),
      spark: { values: days.map((d) => d.recovery.score), color: "var(--c-recovery)" },
    }),
    metricCard({
      className: "col-3", domain: "sleep", tile: "bolt",
      label: "HRV", value: rec.hrvAvg, unit: "ms",
      format: (v) => formatInt(v),
      status: rec.hrvLatest != null ? `${formatInt(rec.hrvLatest)} latest` : "",
      delta: deltaPct(rec.hrvAvg, prevRec?.hrvAvg),
      spark: { values: days.map((d) => d.recovery.hrvMs), color: "var(--c-sleep)" },
    }),
    metricCard({
      className: "col-3", domain: "recovery", tile: "heart",
      label: "Resting HR", value: rec.rhrAvg, unit: "bpm",
      format: (v) => formatDec(v, 1),
      status: rec.rhrLatest != null ? `${formatDec(rec.rhrLatest, 1)} latest` : "",
      delta: deltaPct(rec.rhrAvg, prevRec?.rhrAvg),
      goodDirection: "down",
      spark: { values: days.map((d) => d.recovery.restingHr), color: "var(--c-danger)" },
    }),
    metricCard({
      className: "col-3", domain: "activity", tile: "flame",
      label: "Training load", value: rec.loadAvg, unit: "",
      format: (v) => formatInt(v),
      status: rec.loadAvg > 65 ? "High strain" : rec.loadAvg < 40 ? "Light week" : "Balanced",
      delta: deltaPct(rec.loadAvg, prevRec?.loadAvg),
      spark: { values: days.map((d) => d.recovery.load), color: "var(--c-activity)" },
    })
  );

  /* readiness + signals */
  const readyHost = chartHost(250);
  const signalsBody = h("div", { class: "stack stack-4" });
  gridRow(root,
    panel({
      className: "col-7", title: "Readiness", tile: "recovery", domain: "recovery",
      subtitle: "Recovery against load",
      actions: [legend([
        { color: "var(--c-recovery)", label: "Recovery" },
        { color: "var(--c-activity)", label: "Load" },
      ])],
      body: [readyHost],
      foot: [
        h("span", { text: `Best ${rec.best} · Lowest ${rec.worst}` }),
        h("span", { text: `${rec.avgScore >= 68 ? "Trending well" : "Needs attention"}` }),
      ],
    }),
    panel({
      className: "col-5", title: "Signals", tile: "spark", domain: "accent",
      subtitle: "What is driving readiness",
      body: [signalsBody],
    })
  );

  /* hrv + rhr */
  const hrvHost = chartHost(200);
  const rhrHost = chartHost(200);
  gridRow(root,
    panel({
      className: "col-6", title: "Heart-rate variability", source: sourceLabel(state, "heartRate"), tile: "bolt", domain: "sleep",
      subtitle: "Higher generally indicates better recovery",
      body: [hrvHost],
    }),
    panel({
      className: "col-6", title: "Resting heart rate", tile: "heart", domain: "recovery",
      subtitle: "Lower generally indicates better recovery",
      body: [rhrHost],
    })
  );

  /* correlations */
  const s1 = h("div", { class: "chart", style: { minHeight: "210px" } });
  const s2 = h("div", { class: "chart", style: { minHeight: "210px" } });
  const rSleep = correlation(long.map((d) => d.sleep?.asleepMin), long.map((d) => d.recovery.score));
  const rLoad = correlation(long.map((d) => d.recovery.load), long.map((d) => d.recovery.score));
  gridRow(root,
    panel({
      className: "col-6", title: "Sleep → Recovery", tile: "sleep", domain: "sleep",
      subtitle: "Last 30 days",
      actions: [correlationChip(rSleep)],
      body: [s1],
      foot: [note("Each dot is one night. The dashed line is the best fit.")],
    }),
    panel({
      className: "col-6", title: "Load → Recovery", tile: "flame", domain: "activity",
      subtitle: "Training strain against readiness",
      actions: [correlationChip(rLoad)],
      body: [s2],
      foot: [note("Harder training days tend to pull readiness down shortly after.")],
    })
  );

  queueMicrotask(() => {
    lineChart(readyHost, {
      height: 250,
      labels: dateLabels(days),
      series: [
        { id: "recovery", label: "Recovery", color: "var(--c-recovery)", values: days.map((d) => d.recovery.score), tipFormat: (v) => String(Math.round(v)) },
        { id: "load", label: "Load", color: "var(--c-activity)", values: days.map((d) => d.recovery.load), dashed: true, tipFormat: (v) => String(Math.round(v)) },
      ],
      min: 0, max: 100, yTicks: 4, yFormat: (v) => String(Math.round(v)),
    });

    barChart(hrvHost, {
      height: 200,
      labels: dateLabels(days),
      values: days.map((d) => d.recovery.hrvMs),
      color: "var(--c-sleep)",
      yFormat: (v) => String(Math.round(v)),
      tipLabel: "HRV", tipFormat: (v) => `${formatInt(v)} ms`,
      target: { value: rec.hrvAvg, color: "var(--text-4)", label: `avg ${formatInt(rec.hrvAvg)}` },
    });
    barChart(rhrHost, {
      height: 200,
      labels: dateLabels(days),
      values: days.map((d) => d.recovery.restingHr),
      color: "var(--c-danger)",
      min: Math.max(0, Math.floor(rec.rhrAvg - 10)),
      yFormat: (v) => formatDec(v, 0),
      tipLabel: "Resting HR", tipFormat: (v) => `${formatDec(v, 1)} bpm`,
    });

    signalsBody.appendChild(kpiGrid([
      { label: "Sleep", value: rec.sleepScoreAvg ?? "—", unit: rec.sleepScoreAvg != null ? "/100" : "" },
      { label: "HRV", value: rec.hrvAvg ?? "—", unit: "ms" },
      { label: "Rest HR", value: rec.rhrAvg ?? "—", unit: "bpm" },
      { label: "Load", value: rec.loadAvg ?? "—" },
    ]));
    signalsBody.appendChild(h("div", { class: "stack stack-4 mt-3" }, [
      signalBar("Sleep quality", rec.sleepScoreAvg, "var(--c-sleep)"),
      signalBar("Autonomic (HRV)", rec.hrvAvg == null ? null : clamp((rec.hrvAvg - 30) / 0.6, 0, 100), "var(--c-recovery)"),
      signalBar("Rest (RHR)", rec.rhrAvg == null ? null : clamp(100 - (rec.rhrAvg - 42) * 3.2, 0, 100), "var(--c-activity)"),
      signalBar("Recovery capacity", rec.loadAvg == null ? null : clamp(100 - (rec.loadAvg - 35) * 1.2, 0, 100), "var(--accent)"),
    ]));
    signalsBody.appendChild(note("Sub-scores are relative to your own recent baseline, not a clinical measure."));

    scatterChart(s1, {
      height: 210, x: long.map((d) => d.sleep?.asleepMin), y: long.map((d) => d.recovery.score),
      labels: long.map((d) => d.date), color: "var(--c-sleep)",
      xFormat: (v) => `${formatDec(v / 60, 1)}h`, yFormat: (v) => String(Math.round(v)),
    });
    scatterChart(s2, {
      height: 210, x: long.map((d) => d.recovery.load), y: long.map((d) => d.recovery.score),
      labels: long.map((d) => d.date), color: "var(--c-activity)", fitColor: "var(--c-danger)",
      xFormat: (v) => String(Math.round(v)), yFormat: (v) => String(Math.round(v)),
    });
  });

  return root;
}

function correlationChip(r) {
  const cls = r == null ? "chip--neutral" : r > 0.35 ? "chip--up" : r < -0.35 ? "chip--down" : "chip--neutral";
  return h("span", { class: `chip ${cls}`, text: r == null ? "—" : `r ${formatDec(r, 2)}` });
}

function signalBar(label, value, color) {
  const v = value == null || Number.isNaN(value) ? 0 : value;
  return h("div", { class: "stack stack-2" }, [
    h("div", { class: "between" }, [
      h("span", { class: "label", text: label }),
      h("span", { class: "num", style: "font-size:var(--fs-xs);font-weight:600", text: value == null ? "—" : String(Math.round(v)) }),
    ]),
    h("div", { class: "bar", style: `height:8px;--bar-color:${color}` }, [
      h("div", { class: "bar__fill", style: { width: `${clamp(v, 0, 100)}%` } }),
    ]),
  ]);
}