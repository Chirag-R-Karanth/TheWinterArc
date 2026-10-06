/* ==========================================================================
   MIND — mood, stress, energy and focus. Calm, never clinical.
   ========================================================================== */

import { h } from "../utils/dom.js";
import { panel, chartHost, legend, kpiGrid, note, listRow } from "../components/ui.js";
import { metricCard } from "../components/metric-card.js";
import { lineChart, barChart, scatterChart } from "../components/charts.js";
import { ring } from "../components/progress-ring.js";
import { pageFrame, gridRow, dateLabels, weekdayAverages, requireData, sourceLabel } from "./_shared.js";
import * as health from "../services/health.js";
import { formatDec, deltaPct, correlation } from "../utils/numbers.js";
import { moodLabel } from "../utils/calc.js";
import { relativeLabel } from "../utils/dates.js";

export function render(state) {
  const { days, prev } = health.periodWindow(state.period, state.rangeEnd);
  const mind = health.mindSummary(days);
  const prevMind = health.mindSummary(prev);
  const long = health.windowDays(state.rangeEnd, 30);
  const root = pageFrame(
    state,
    "Mind",
    mind
      ? `${mind.logged} check-ins · mood ${formatDec(mind.moodAvg, 1)}/5 · ${moodLabel(mind.moodAvg)}`
      : "Mood, stress, energy and focus"
  );
  if (requireData(root, mind, "No check-ins in this period. Connect a mood source such as How We Feel to begin.")) return root;

  /* ---------------------------------------------------------------- hero */
  gridRow(root,
    metricCard({
      className: "col-3", domain: "mind", tile: "mind",
      label: "Mood · avg", value: mind.moodAvg, format: (v) => formatDec(v, 1),
      unit: "/5", status: moodLabel(mind.moodAvg),
      delta: deltaPct(mind.moodAvg, prevMind?.moodAvg),
      spark: { values: days.map((d) => d.mind?.mood), color: "var(--c-mind)" },
    }),
    metricCard({
      className: "col-3", domain: "nutrition", tile: "zap",
      label: "Stress · avg", value: mind.stressAvg, format: (v) => formatDec(v, 1),
      unit: "/5", status: mind.stressAvg <= 2.4 ? "Settled" : mind.stressAvg >= 3.4 ? "Elevated" : "Typical",
      delta: deltaPct(mind.stressAvg, prevMind?.stressAvg),
      goodDirection: "down",
      spark: { values: days.map((d) => d.mind?.stress), color: "var(--c-nutrition)" },
    }),
    metricCard({
      className: "col-3", domain: "activity", tile: "bolt",
      label: "Energy · avg", value: mind.energyAvg, format: (v) => formatDec(v, 1),
      unit: "/5", status: mind.energyAvg >= 3.4 ? "High" : mind.energyAvg < 2.6 ? "Low" : "Steady",
      delta: deltaPct(mind.energyAvg, prevMind?.energyAvg),
      spark: { values: days.map((d) => d.mind?.energy), color: "var(--c-activity)" },
    }),
    metricCard({
      className: "col-3", domain: "sleep", tile: "eye",
      label: "Focus · avg", value: mind.focusAvg, format: (v) => formatDec(v, 1),
      unit: "/5", status: mind.focusAvg >= 3.4 ? "Sharp" : mind.focusAvg < 2.6 ? "Scattered" : "Even",
      delta: deltaPct(mind.focusAvg, prevMind?.focusAvg),
      spark: { values: days.map((d) => d.mind?.focus), color: "var(--c-sleep)" },
    })
  );

  /* ------------------------------------------------- trend + coverage */
  const moodHost = chartHost(252);
  const coverBody = h("div", { class: "stack stack-4", style: { alignItems: "center" } });
  gridRow(root,
    panel({
      className: "col-7", title: "Mood & stress", source: sourceLabel(state, "mood"), tile: "mind", domain: "mind",
      subtitle: `${days.length} days in view`,
      actions: [legend([
        { color: "var(--c-mind)", label: "Mood" },
        { color: "var(--c-nutrition)", label: "Stress", line: true },
      ])],
      body: [moodHost],
      foot: [
        h("span", { text: `Best day ${formatDec(mind.best, 1)}/5 · Lowest ${formatDec(mind.worst, 1)}/5` }),
        h("span", { text: `Stress ${formatDec(mind.stressAvg, 1)}/5` }),
      ],
    }),
    panel({
      className: "col-5", title: "Check-in rhythm", tile: "calendar", domain: "accent",
      subtitle: "How consistently state is captured",
      body: [coverBody],
    })
  );

  /* ---------------------------------------------- energy + weekday mix */
  const energyHost = chartHost(226);
  const weekHost = chartHost(226);
  gridRow(root,
    panel({
      className: "col-6", title: "Energy & focus", tile: "bolt", domain: "activity",
      subtitle: "Daily self-report",
      actions: [legend([
        { color: "var(--c-activity)", label: "Energy" },
        { color: "var(--c-sleep)", label: "Focus", line: true },
      ])],
      body: [energyHost],
    }),
    panel({
      className: "col-6", title: "Mood by weekday", tile: "calendar", domain: "mind",
      subtitle: "Average mood across the week",
      body: [weekHost],
      foot: [note("Patterns across your own check-ins — a rhythm, not a verdict.")],
    })
  );

  /* -------------------------------------------------- correlations */
  const s1 = h("div", { class: "chart", style: { minHeight: "214px" } });
  const s2 = h("div", { class: "chart", style: { minHeight: "214px" } });
  const rSleep = correlation(long.map((d) => d.mind?.mood), long.map((d) => d.sleep?.asleepMin));
  const rSteps = correlation(long.map((d) => d.mind?.mood), long.map((d) => d.activity.steps));
  gridRow(root,
    panel({
      className: "col-6", title: "Sleep → Mood", tile: "sleep", domain: "sleep",
      subtitle: "Last 30 nights against mood",
      actions: [correlationChip(rSleep)],
      body: [s1],
      foot: [note("Each dot is one day. The dashed line is the best fit.")],
    }),
    panel({
      className: "col-6", title: "Movement → Mood", tile: "activity", domain: "activity",
      subtitle: "Last 30 days of steps against mood",
      actions: [correlationChip(rSteps)],
      body: [s2],
      foot: [note("Association only — moving more and feeling better travel together here.")],
    })
  );

  /* ------------------------------------------------ recent check-ins */
  const logBody = h("div", { class: "stack" });
  gridRow(root,
    panel({
      className: "col-12", title: "Recent check-ins", tile: "inbox", domain: "accent",
      subtitle: "Newest first",
      body: [logBody],
    })
  );

  /* --------------------------------------------------- deferred drawing */
  queueMicrotask(() => {
    lineChart(moodHost, {
      height: 252,
      labels: dateLabels(days),
      series: [
        { id: "mood", label: "Mood", color: "var(--c-mind)", values: days.map((d) => d.mind?.mood), tipFormat: (v) => `${formatDec(v, 1)}/5` },
        { id: "stress", label: "Stress", color: "var(--c-nutrition)", values: days.map((d) => d.mind?.stress), dashed: true, tipFormat: (v) => `${formatDec(v, 1)}/5` },
      ],
      min: 1, max: 5, yTicks: 4, yFormat: (v) => formatDec(v, 0),
    });

    /* coverage ring + mood distribution */
    const coverage = Math.round((mind.logged / Math.max(1, days.length)) * 100);
    coverBody.appendChild(ring({
      size: 140, stroke: 13,
      pct: coverage / 100,
      color: "var(--c-mind)",
      value: `${coverage}%`,
      label: "days logged",
    }));
    coverBody.appendChild(h("div", { class: "stack stack-3", style: "width:100%" }, [
      kpiGrid([
        { label: "Check-ins", value: mind.logged, unit: `/${days.length}` },
        { label: "Average", value: formatDec(mind.moodAvg, 1), unit: "/5" },
        { label: "Best", value: formatDec(mind.best, 1), unit: "/5" },
        { label: "Lowest", value: formatDec(mind.worst, 1), unit: "/5" },
      ]),
      distribution(days),
    ]));

    lineChart(energyHost, {
      height: 226,
      labels: dateLabels(days),
      series: [
        { id: "energy", label: "Energy", color: "var(--c-activity)", values: days.map((d) => d.mind?.energy), tipFormat: (v) => `${formatDec(v, 1)}/5` },
        { id: "focus", label: "Focus", color: "var(--c-sleep)", values: days.map((d) => d.mind?.focus), dashed: true, tipFormat: (v) => `${formatDec(v, 1)}/5` },
      ],
      min: 1, max: 5, yTicks: 4, yFormat: (v) => formatDec(v, 0),
    });

    const wk = weekdayAverages(days, (d) => d.mind?.mood);
    barChart(weekHost, {
      height: 226,
      labels: wk.map((x) => x.label),
      values: wk.map((x) => x.value),
      min: 1, max: 5,
      color: "var(--c-mind)",
      colorFor: (v) => (v >= 4 ? "var(--c-recovery)" : v >= 3 ? "var(--c-mind)" : "var(--c-nutrition)"),
      barW: 30,
      yFormat: (v) => formatDec(v, 0),
      tipLabel: "Avg mood", tipFormat: (v) => `${formatDec(v, 1)}/5`,
    });

    scatterChart(s1, {
      height: 214,
      x: long.map((d) => d.sleep?.asleepMin), y: long.map((d) => d.mind?.mood),
      labels: long.map((d) => relativeLabel(d.date)),
      color: "var(--c-mind)", fitColor: rSleep != null && rSleep < -0.2 ? "var(--c-danger)" : "var(--c-sleep)",
      xLabel: "Sleep", yLabel: "Mood",
      xFormat: (v) => `${Math.round(v / 60)}h`, yFormat: (v) => formatDec(v, 1),
      xTip: (v) => `${formatDec(v / 60, 1)} h`, yTip: (v) => `${formatDec(v, 1)}/5`,
    });
    scatterChart(s2, {
      height: 214,
      x: long.map((d) => d.activity.steps), y: long.map((d) => d.mind?.mood),
      labels: long.map((d) => relativeLabel(d.date)),
      color: "var(--c-mind)", fitColor: "var(--c-activity)",
      xLabel: "Steps", yLabel: "Mood",
      xFormat: (v) => `${Math.round(v / 1000)}k`, yFormat: (v) => formatDec(v, 1),
      xTip: (v) => `${Math.round(v).toLocaleString("en-US")} steps`, yTip: (v) => `${formatDec(v, 1)}/5`,
    });

    /* recent check-ins */
    const recent = [...days].reverse().filter((d) => d.mind).slice(0, 7);
    if (!recent.length) {
      logBody.appendChild(h("div", { class: "muted", text: "No check-ins in this range." }));
    } else {
      for (const d of recent) {
        logBody.appendChild(listRow({
          tile: "mind", domain: "mind",
          title: `${relativeLabel(d.date)} · ${moodLabel(d.mind.mood)}`,
          sub: `Mood ${formatDec(d.mind.mood, 1)} · Stress ${formatDec(d.mind.stress, 1)} · Energy ${formatDec(d.mind.energy, 1)} · Focus ${formatDec(d.mind.focus, 1)}`,
          value: formatDec(d.mind.mood, 1),
          subvalue: "/5",
        }));
      }
    }
  });

  return root;
}

/** mood rating distribution as compact horizontal bars */
function distribution(days) {
  const buckets = [5, 4, 3, 2, 1].map((score) => ({
    score,
    count: days.filter((d) => d.mind && Math.round(d.mind.mood) === score).length,
  }));
  const total = Math.max(1, buckets.reduce((a, b) => a + b.count, 0));
  const wrap = h("div", { class: "stack stack-2" });
  for (const b of buckets) {
    const pct = Math.round((b.count / total) * 100);
    wrap.appendChild(h("div", { class: "stack stack-2" }, [
      h("div", { class: "between" }, [
        h("span", { class: "label", text: `${b.score} · ${moodLabel(b.score)}` }),
        h("span", { class: "num", style: "font-size:var(--fs-2xs);font-weight:600", text: `${b.count} · ${pct}%` }),
      ]),
      h("div", { class: "bar", style: "height:7px;--bar-color:var(--c-mind)" }, [
        h("div", { class: "bar__fill", style: { width: `${pct}%` } }),
      ]),
    ]));
  }
  return wrap;
}

function correlationChip(r) {
  const cls = r == null ? "chip--neutral" : r > 0.35 ? "chip--up" : r < -0.35 ? "chip--down" : "chip--neutral";
  return h("span", { class: `chip ${cls}`, text: r == null ? "—" : `r ${formatDec(r, 2)}` });
}
