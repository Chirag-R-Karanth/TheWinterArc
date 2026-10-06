/* ==========================================================================
   NUTRITION
   ========================================================================== */

import { h } from "../utils/dom.js";
import { panel, chartHost, legend, kpiGrid, note, listRow } from "../components/ui.js";
import { metricCard } from "../components/metric-card.js";
import { lineChart, barChart } from "../components/charts.js";
import { ring } from "../components/progress-ring.js";
import { pageFrame, gridRow, dateLabels, avgOf, requireData, sourceLabel } from "./_shared.js";
import * as health from "../services/health.js";
import { formatInt, formatDec, deltaPct, average, correlation } from "../utils/numbers.js";
import { wt, wtUnit } from "../utils/units.js";
import { relativeLabel } from "../utils/dates.js";
import { macroSplit } from "../utils/calc.js";

export function render(state) {
  const { days, prev } = health.periodWindow(state.period, state.rangeEnd);
  const nut = health.nutritionSummary(days, state.settings.goals);
  const prevNut = health.nutritionSummary(prev, state.settings.goals);
  const long = health.windowDays(state.rangeEnd, 30);
  const goals = state.settings.goals;
  const root = pageFrame(
    state,
    "Nutrition",
    nut ? `${formatInt(nut.kcal.avg)} kcal average · ${nut.coverage}% of days logged` : "Energy, macros and consistency"
  );
  if (requireData(root, nut, "No meals have been logged for this period. Connect a nutrition source to see energy and macros.")) return root;

  /* hero */
  gridRow(root,
    metricCard({
      className: "col-3", domain: "nutrition", tile: "nutrition",
      label: state.period === "day" ? "Energy · today" : "Energy · avg",
      value: state.period === "day" ? nut.kcal.latest : nut.kcal.avg,
      unit: "kcal", format: formatInt,
      status: `target ${formatInt(goals.energyKcal)}`,
      delta: deltaPct(nut.kcal.avg, prevNut?.kcal.avg),
      goodDirection: "down",
      spark: { values: days.map((d) => d.nutrition?.kcal), color: "var(--c-nutrition)" },
    }),
    metricCard({
      className: "col-3", domain: "activity", tile: "strength",
      label: "Protein", value: nut.protein.avg, unit: "g",
      format: formatInt,
      status: `target ${formatInt(goals.proteinG)}g`,
      delta: deltaPct(nut.protein.avg, prevNut?.protein.avg),
      spark: { values: days.map((d) => d.nutrition?.proteinG), color: "var(--c-activity)" },
    }),
    metricCard({
      className: "col-3", domain: "nutrition", tile: "flame",
      label: "Carbohydrate", value: nut.carbs.avg, unit: "g",
      format: formatInt,
      status: `target ${formatInt(goals.carbsG)}g`,
      delta: deltaPct(nut.carbs.avg, prevNut?.carbs.avg),
      spark: { values: days.map((d) => d.nutrition?.carbsG), color: "var(--c-nutrition)" },
    }),
    metricCard({
      className: "col-3", domain: "mind", tile: "drop",
      label: "Fat", value: nut.fat.avg, unit: "g",
      format: formatInt,
      status: `target ${formatInt(goals.fatG)}g`,
      delta: deltaPct(nut.fat.avg, prevNut?.fat.avg),
      spark: { values: days.map((d) => d.nutrition?.fatG), color: "var(--c-mind)" },
    })
  );

  /* energy balance + macros */
  const energyBody = h("div", { class: "stack stack-4", style: { alignItems: "center" } });
  const macroBody = h("div", { class: "stack stack-4" });
  gridRow(root,
    panel({
      className: "col-5", title: "Energy balance", tile: "target", domain: "nutrition",
      subtitle: "Average intake against target",
      body: [energyBody],
    }),
    panel({
      className: "col-7", title: "Macro distribution", tile: "spark", domain: "accent",
      subtitle: "How your energy is split",
      body: [macroBody],
    })
  );

  /* intake + adherence */
  const intakeHost = chartHost(250);
  const adhereBody = h("div", { class: "stack stack-4" });
  gridRow(root,
    panel({
      className: "col-8", title: "Daily intake", source: sourceLabel(state, "nutrition"), tile: "calendar", domain: "nutrition",
      subtitle: "Calories against target, with weight movement",
      actions: [legend([
        { color: "var(--c-nutrition)", label: "Intake" },
        { color: "var(--c-body)", label: "Weight", line: true },
      ])],
      body: [intakeHost],
    }),
    panel({
      className: "col-4", title: "Adherence", tile: "check", domain: "recovery",
      subtitle: "Consistency with your target",
      body: [adhereBody],
    })
  );

  /* meals */
  const mealBody = h("div", { class: "stack stack-4" });
  const recentBody = h("div", { class: "stack" });
  gridRow(root,
    panel({
      className: "col-5", title: "Meal distribution", tile: "clock", domain: "nutrition",
      subtitle: "Average energy by meal",
      body: [mealBody],
    }),
    panel({
      className: "col-7", title: "Most recent day", tile: "inbox", domain: "accent",
      subtitle: "Meals as logged",
      body: [recentBody],
      foot: [note("Nutrition integrates with body weight and activity across WinterArc.")],
    })
  );

  /* deferred drawing */
  queueMicrotask(() => {
    const pct = Math.min(1, nut.kcal.avg / goals.energyKcal);
    energyBody.appendChild(ring({
      size: 168, stroke: 14, pct,
      color: "var(--c-nutrition)",
      value: formatInt(nut.kcal.avg),
      label: `of ${formatInt(goals.energyKcal)} kcal`,
    }));
    energyBody.appendChild(h("div", { class: "kpis", style: "width:100%" }, [
      statCell("Remaining", `${formatInt(Math.max(0, goals.energyKcal - nut.kcal.avg))}`, "kcal"),
      statCell("Consistency", `±${nut.consistency}`, "kcal"),
      statCell("On target", `${nut.adherence}`, "%"),
    ]));

    const split = macroSplit({ kcal: nut.kcal.avg, proteinG: nut.protein.avg, carbsG: nut.carbs.avg, fatG: nut.fat.avg });
    macroBody.appendChild(h("div", { class: "bar bar--seg", style: "height:14px" }, [
      h("i", { style: `--seg-color:var(--c-activity);flex-grow:${split?.protein || 33}`, title: `Protein ${split?.protein}%` }),
      h("i", { style: `--seg-color:var(--c-nutrition);flex-grow:${split?.carbs || 34}`, title: `Carbs ${split?.carbs}%` }),
      h("i", { style: `--seg-color:var(--c-mind);flex-grow:${split?.fat || 33}`, title: `Fat ${split?.fat}%` }),
    ]));
    macroBody.appendChild(legend([
      { color: "var(--c-activity)", label: `Protein ${split?.protein ?? 0}%` },
      { color: "var(--c-nutrition)", label: `Carbs ${split?.carbs ?? 0}%` },
      { color: "var(--c-mind)", label: `Fat ${split?.fat ?? 0}%` },
    ]));
    macroBody.appendChild(h("div", { class: "stack stack-3 mt-3" }, [
      macroLine("Protein", nut.protein.avg, goals.proteinG, "var(--c-activity)"),
      macroLine("Carbohydrate", nut.carbs.avg, goals.carbsG, "var(--c-nutrition)"),
      macroLine("Fat", nut.fat.avg, goals.fatG, "var(--c-mind)"),
    ]));

    barChart(intakeHost, {
      height: 250,
      labels: dateLabels(days),
      values: days.map((d) => d.nutrition?.kcal),
      target: { value: goals.energyKcal, color: "var(--text-4)", label: `target ${formatInt(goals.energyKcal)}` },
      color: "var(--c-nutrition)",
      yFormat: (v) => (v >= 1000 ? `${formatDec(v / 1000, 1)}k` : String(v)),
      tipLabel: "Intake", tipFormat: (v) => `${formatInt(v)} kcal`,
      line: {
        values: days.map((d) => (d.body?.weightKg == null ? null : wt(d.body.weightKg))),
        color: "var(--c-body)", label: "weight",
        tipFormat: (v) => `${formatDec(v, 1)} ${wtUnit()}`,
      },
    });

    const within = days.filter((d) => d.nutrition && Math.abs(d.nutrition.kcal - goals.energyKcal) <= goals.energyKcal * 0.1).length;
    const proteinHit = days.filter((d) => d.nutrition && d.nutrition.proteinG >= goals.proteinG * 0.9).length;
    adhereBody.appendChild(kpiGrid([
      { label: "Days logged", value: nut.daysLogged },
      { label: "Coverage", value: nut.coverage, unit: "%" },
      { label: "Within ±10%", value: within },
      { label: "Protein target", value: proteinHit },
    ]));
    adhereBody.appendChild(h("div", { class: "stack stack-3 mt-3" }, [
      adherenceLine("Energy adherence", within, nut.daysLogged, "var(--c-nutrition)"),
      adherenceLine("Protein adherence", proteinHit, nut.daysLogged, "var(--c-activity)"),
      adherenceLine("Steady intake", Math.round(((nut.daysLogged - within / 2) / Math.max(1, nut.daysLogged)) * 100), 100, "var(--c-recovery)"),
    ]));
    const rCal = correlation(long.map((d) => d.nutrition?.kcal), long.map((d) => d.body?.weightKg));
    adhereBody.appendChild(h("div", { class: "between mt-4" }, [
      h("span", { class: "label", text: "Intake ↔ weight (30d)" }),
      h("span", { class: `chip ${rCal == null ? "chip--neutral" : rCal > 0.3 ? "chip--down" : "chip--neutral"}`, text: rCal == null ? "—" : `r ${formatDec(rCal, 2)}` }),
    ]));

    /* meal distribution */
    const slots = ["Breakfast", "Lunch", "Dinner", "Snacks"];
    const slotTotals = slots.map((s) => {
      const vals = days.flatMap((d) => (d.nutrition?.meals || []).filter((m) => m.slot === s).map((m) => m.kcal));
      return { slot: s, avg: average(vals) || 0 };
    });
    const maxSlot = Math.max(...slotTotals.map((x) => x.avg), 1);
    for (const s of slotTotals) {
      mealBody.appendChild(h("div", { class: "stack stack-2" }, [
        h("div", { class: "between" }, [
          h("span", { class: "label", text: s.slot }),
          h("span", { class: "num", style: "font-size:var(--fs-xs);font-weight:600", text: `${formatInt(s.avg)} kcal · ${Math.round((s.avg / (nut.kcal.avg || 1)) * 100)}%` }),
        ]),
        h("div", { class: "bar", style: "height:8px;--bar-color:var(--c-nutrition)" }, [
          h("div", { class: "bar__fill", style: { width: `${(s.avg / maxSlot) * 100}%` } }),
        ]),
      ]));
    }

    /* most recent logged day */
    const lastLogged = [...days].reverse().find((d) => d.nutrition);
    if (!lastLogged) {
      recentBody.appendChild(h("div", { class: "muted", text: "No meals to show." }));
    } else {
      recentBody.appendChild(h("div", { class: "between mb-3" }, [
        h("span", { class: "label", text: relativeLabel(lastLogged.date) }),
        h("span", { class: "num", style: "font-weight:600", text: `${formatInt(lastLogged.nutrition.kcal)} kcal` }),
      ]));
      for (const m of lastLogged.nutrition.meals) {
        recentBody.appendChild(listRow({
          tile: "nutrition", domain: "nutrition",
          title: m.name,
          sub: `${m.slot} · ${m.time} · P${m.proteinG} C${m.carbsG} F${m.fatG}`,
          value: `${formatInt(m.kcal)}`,
          subvalue: "kcal",
        }));
      }
    }
  });

  return root;
}

function statCell(label, value, unit) {
  return h("div", {}, [
    h("div", { class: "kpi__k", text: label }),
    h("div", { class: "kpi__v num" }, [value, unit ? h("small", { text: unit }) : null]),
  ]);
}

function macroLine(label, value, target, color) {
  return h("div", { class: "stack stack-2" }, [
    h("div", { class: "between" }, [
      h("span", { class: "label", text: label }),
      h("span", { class: "num", style: "font-size:var(--fs-xs);font-weight:600", text: `${formatInt(value)} / ${formatInt(target)} g` }),
    ]),
    h("div", { class: "bar", style: `height:8px;--bar-color:${color}` }, [
      h("div", { class: "bar__fill", style: { width: `${Math.min(100, (value / target) * 100)}%` } }),
    ]),
  ]);
}

function adherenceLine(label, hit, total, color) {
  const pctV = total ? Math.round((hit / total) * 100) : 0;
  return h("div", { class: "stack stack-2" }, [
    h("div", { class: "between" }, [
      h("span", { class: "label", text: label }),
      h("span", { class: "num", style: "font-size:var(--fs-xs);font-weight:600", text: `${pctV}%` }),
    ]),
    h("div", { class: "bar", style: `height:8px;--bar-color:${color}` }, [
      h("div", { class: "bar__fill", style: { width: `${pctV}%` } }),
    ]),
  ]);
}