/* ==========================================================================
   ACTIVITY
   ========================================================================== */

import { h } from "../utils/dom.js";
import { panel, chartHost, legend, listRow, kpiGrid, badge } from "../components/ui.js";
import { metricCard, deltaChip } from "../components/metric-card.js";
import { barChart, lineChart, sparkline } from "../components/charts.js";
import { ringCluster } from "../components/progress-ring.js";
import { icon } from "../components/icons.js";
import { pageFrame, gridRow, dayLabels, dateLabels, weekdayAverages, avgOf, requireData, sourceLabel } from "./_shared.js";
import * as health from "../services/health.js";
import { WORKOUT_TYPES } from "../data/taxonomy.js";
import { formatInt, formatDuration, formatDec, deltaPct } from "../utils/numbers.js";
import { dist, distUnit } from "../utils/units.js";
import { relativeLabel } from "../utils/dates.js";

export function render(state) {
  const { days, prev } = health.periodWindow(state.period, state.rangeEnd);
  const act = health.activitySummary(days);
  const prevAct = health.activitySummary(prev);
  const goals = state.settings.goals;
  const root = pageFrame(
    state,
    "Activity",
    act ? `${formatInt(act.steps.total)} steps · ${formatInt(act.activeKcal.total)} active kcal in view` : "Movement, energy and sessions"
  );
  if (requireData(root, act, "No activity has synced for this period. Connect a tracker or step back in time.")) return root;

  const perDay = state.period === "day" ? "today" : "per day";
  const stepFactor = days.length;

  /* hero metrics */
  gridRow(root,
    metricCard({
      className: "col-3", domain: "activity", tile: "steps",
      label: state.period === "day" ? "Steps · today" : "Steps · avg",
      value: act.steps.avg, unit: "steps", format: formatInt,
      status: `max ${formatInt(act.steps.total ? Math.max(...days.map((d) => d.activity.steps || 0)) : 0)}`,
      delta: deltaPct(act.steps.avg, prevAct?.steps.avg),
      spark: { values: days.map((d) => d.activity.steps), color: "var(--c-activity)" },
    }),
    metricCard({
      className: "col-3", domain: "activity", tile: "flame",
      label: "Active energy",
      value: act.activeKcal.avg, unit: "kcal", format: formatInt,
      status: `${formatInt(act.activeKcal.total)} total`,
      delta: deltaPct(act.activeKcal.avg, prevAct?.activeKcal.avg),
      spark: { values: days.map((d) => d.activity.activeKcal), color: "var(--c-nutrition)" },
    }),
    metricCard({
      className: "col-3", domain: "activity", tile: "run",
      label: "Distance",
      value: dist(act.distance.avg), unit: distUnit(), format: (v) => formatDec(v, 1),
      status: `${formatDec(dist(act.distance.total), 1)} ${distUnit()} total`,
      delta: deltaPct(act.distance.avg, prevAct?.distance.avg),
      spark: { values: days.map((d) => d.activity.distanceKm), color: "var(--c-body)" },
    }),
    metricCard({
      className: "col-3", domain: "activity", tile: "strength",
      label: "Sessions",
      value: act.workouts.count, unit: "",
      format: formatInt,
      status: `${formatDuration(act.workouts.minutes)} · ${formatInt(act.workouts.kcal)} kcal`,
      delta: deltaPct(act.workouts.count, prevAct?.workouts.count),
    })
  );

  /* movement + goal rings */
  const moveHost = chartHost(250);
  const goalsBody = h("div", { class: "stack stack-4", style: { alignItems: "center" } });
  gridRow(root,
    panel({
      className: "col-8", title: "Movement", source: sourceLabel(state, "steps"), tile: "activity", domain: "activity",
      subtitle: `${days.length} days`,
      actions: [legend([
        { color: "var(--c-activity)", label: "Steps" },
        { color: "var(--c-nutrition)", label: "Active kcal", line: true },
      ])],
      body: [moveHost],
      foot: [
        h("span", { text: `${act.streak}-day active streak` }),
        h("span", { text: `avg distance ${formatDec(dist(act.distance.avg), 1)} ${distUnit()} ${perDay}` }),
      ],
    }),
    panel({
      className: "col-4", title: "Goal completion", tile: "target", domain: "accent",
      subtitle: "Against your daily goals",
      body: [goalsBody],
    })
  );

  /* workout mix + sessions */
  const mixHost = h("div", { class: "stack stack-4" });
  const sessionsBody = h("div", { class: "stack" });
  gridRow(root,
    panel({
      className: "col-5", title: "Workout mix", tile: "bolt", domain: "activity",
      subtitle: `${act.workouts.count} sessions`,
      body: [mixHost],
    }),
    panel({
      className: "col-7", title: "Sessions", tile: "clock", domain: "accent",
      subtitle: "Most recent first",
      body: [sessionsBody],
    })
  );

  /* weekday rhythm + consistency */
  const weekHost = chartHost(190);
  const consistencyBody = h("div", { class: "stack stack-4" });
  gridRow(root,
    panel({
      className: "col-6", title: "Weekday rhythm", tile: "calendar", domain: "activity",
      subtitle: "Average steps by day of week",
      body: [weekHost],
    }),
    panel({
      className: "col-6", title: "Consistency", tile: "spark", domain: "accent",
      subtitle: "How reliably you move",
      body: [consistencyBody],
    })
  );

  /* deferred drawing */
  queueMicrotask(() => {
    barChart(moveHost, {
      height: 250,
      labels: dateLabels(days),
      values: days.map((d) => d.activity.steps),
      target: { value: goals.steps, color: "var(--text-4)", label: `goal ${formatInt(goals.steps)}` },
      color: "var(--c-activity)",
      yFormat: (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)),
      tipLabel: "Steps", tipFormat: formatInt,
      line: {
        values: days.map((d) => d.activity.activeKcal),
        color: "var(--c-nutrition)", label: "active kcal", tipFormat: formatInt,
      },
    });

    const weeks = Math.max(1, days.length / 7);
    goalsBody.appendChild(ringCluster({
      size: 168,
      rings: [
        { pct: act.steps.avg / goals.steps, color: "var(--c-activity)", value: `${Math.round((act.steps.avg / goals.steps) * 100)}%`, label: "steps" },
        { pct: act.activeKcal.avg / goals.activeKcal, color: "var(--c-nutrition)" },
        { pct: act.workouts.count / (goals.workoutsPerWeek * weeks), color: "var(--c-recovery)" },
      ],
    }));
    goalsBody.appendChild(h("div", { class: "stack stack-3", style: "width:100%" }, [
      goalLine("Steps", act.steps.avg, goals.steps, "var(--c-activity)", formatInt),
      goalLine("Active kcal", act.activeKcal.avg, goals.activeKcal, "var(--c-nutrition)", formatInt),
      goalLine("Sessions / week", act.workouts.count / weeks, goals.workoutsPerWeek, "var(--c-recovery)", (v) => formatDec(v, 1)),
    ]));

    const dist = act.workouts.distribution;
    if (!dist.length) {
      mixHost.appendChild(h("div", { class: "muted", text: "No sessions logged in this period." }));
    } else {
      const totalMin = dist.reduce((a, b) => a + b.minutes, 0) || 1;
      mixHost.appendChild(h("div", { class: "bar bar--seg", style: "height:12px" },
        dist.map((d) => h("i", {
          style: `--seg-color:${typeColor(d.type)};flex-grow:${Math.max(1, d.minutes / totalMin * 100)}`,
          title: `${WORKOUT_TYPES[d.type]?.label}: ${d.minutes} min`,
        }))
      ));
      mixHost.appendChild(h("div", { class: "stack stack-3" }, dist.map((d) =>
        h("div", { class: "between" }, [
          h("span", { class: "inline", style: "gap:8px" }, [
            h("span", { class: "tile tile--activity", style: "width:24px;height:24px;flex-basis:24px" }, icon(WORKOUT_TYPES[d.type]?.icon || "bolt")),
            h("span", { class: "label", style: "text-transform:none;letter-spacing:0;font-size:var(--fs-xs);color:var(--text-2)", text: WORKOUT_TYPES[d.type]?.label || d.type }),
          ]),
          h("span", { class: "num", style: "font-size:var(--fs-xs);font-weight:600", text: `${d.sessions}× · ${formatDuration(d.minutes)} · ${formatInt(d.kcal)} kcal` }),
        ])
      )));
    }

    const sessions = days
      .flatMap((d) => (d.activity.workouts || []).map((w) => ({ ...w, date: d.date })))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 7);
    if (!sessions.length) {
      sessionsBody.appendChild(h("div", { class: "muted", text: "No workouts in this range." }));
    } else {
      for (const w of sessions) {
        sessionsBody.appendChild(listRow({
          tile: WORKOUT_TYPES[w.type]?.icon || "bolt",
          domain: "activity",
          title: w.title,
          sub: `${relativeLabel(w.date)} · ${WORKOUT_TYPES[w.type]?.label || w.type}`,
          value: formatDuration(w.min),
          subvalue: `${formatInt(w.kcal)} kcal${w.avgHr ? ` · ${w.avgHr} bpm` : ""}`,
        }));
      }
    }

    barChart(weekHost, {
      height: 190,
      labels: weekdayAverages(days, (d) => d.activity.steps).map((x) => x.label),
      values: weekdayAverages(days, (d) => d.activity.steps).map((x) => x.value),
      color: "var(--c-activity)",
      target: { value: goals.steps, color: "var(--text-4)" },
      yFormat: (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)),
      tipLabel: "Avg steps", tipFormat: formatInt,
      barW: 34,
    });

    consistencyBody.appendChild(kpiGrid([
      { label: "Active streak", value: act.streak, unit: "d" },
      { label: "Sessions", value: act.workouts.count },
      { label: "Avg session", value: act.workouts.count ? formatDuration(act.workouts.minutes / act.workouts.count) : "—" },
      { label: "Total time", value: formatDuration(act.workouts.minutes) },
    ]));
    const activeDays = days.filter((d) => (d.activity.steps || 0) >= 7000).length;
    consistencyBody.appendChild(h("div", { class: "stack stack-3 mt-3" }, [
      goalLine("Days over 7,000 steps", activeDays, days.length, "var(--c-activity)", (v) => formatInt(v)),
      goalLine("Goal achievement", avgOf(days.map((d) => Math.min(1.2, (d.activity.steps || 0) / goals.steps))) * 100, 100, "var(--c-recovery)", (v) => `${Math.round(v)}%`),
    ]));
  });

  return root;
}

function goalLine(label, value, target, color, fmt) {
  return h("div", { class: "stack stack-2" }, [
    h("div", { class: "between" }, [
      h("span", { class: "label", text: label }),
      h("span", { class: "num", style: "font-size:var(--fs-xs);font-weight:600", text: `${fmt(value)} / ${fmt(target)}` }),
    ]),
    h("div", { class: "bar", style: `height:7px;--bar-color:${color}` }, [
      h("div", { class: "bar__fill", style: { width: `${Math.min(100, (value / target) * 100)}%` } }),
    ]),
  ]);
}

function typeColor(type) {
  return {
    run: "var(--c-activity)", cycle: "var(--c-body)", swim: "var(--c-sleep)",
    strength: "var(--accent)", walk: "var(--c-recovery)", yoga: "var(--c-mind)", hiit: "var(--c-danger)",
  }[type] || "var(--accent)";
}