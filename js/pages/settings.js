/* ==========================================================================
   SETTINGS — appearance, profile, goals, connections, priorities.
   Every control writes through store actions; nothing is kept locally
   except the active source category while this page is open.
   ========================================================================== */

import { h } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { segmented } from "../components/controls.js";
import { note } from "../components/ui.js";
import { pageFrame, gridRow } from "./_shared.js";
import { actions } from "../state/store.js";
import { PROVIDERS } from "../services/integrations.js";
import { CATEGORIES } from "../data/defaults.js";
import { wipe } from "../services/persistence.js";
import { wt, wtUnit, len, lenUnit, isImperial, distUnit } from "../utils/units.js";

let activeCat = "steps";

export function render(state) {
  const s = state.settings;
  const imp = isImperial();

  const root = pageFrame(
    state,
    "Settings",
    "Appearance, goals, connected sources and data priorities"
  );

  /* --------------------------------------------------------- appearance */
  const themeSeg = segmented({
    value: state.theme,
    options: [{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }],
    onChange: (v) => actions.setTheme(v),
  });

  const unitsSeg = segmented({
    value: imp ? "imperial" : "metric",
    options: [
      { id: "metric", label: "Metric" },
      { id: "imperial", label: "Imperial" },
    ],
    onChange: (v) => actions.updateSettings({ units: v }),
  });

  const appearance = setGroup({
    className: "col-6",
    title: "Appearance",
    desc: "How WinterArc looks and measures",
    rows: [
      row({ label: "Theme", desc: "Or press T anywhere in the app", control: themeSeg }),
      row({ label: "Units", desc: `Weights in ${wtUnit()}, distances in ${distUnit()}`, control: unitsSeg }),
      row({
        label: "Reduce motion",
        desc: "Disables count-ups, ring animation and chart easing",
        control: sw(!!s.reducedMotion, (on) => actions.updateSettings({ reducedMotion: on })),
      }),
      row({
        label: "Show data provenance",
        desc: "Keep the source note visible under every chart",
        control: sw(!!s.showProvenance, (on) => actions.updateSettings({ showProvenance: on })),
      }),
    ],
  });

  /* ------------------------------------------------------------- profile */
  const profile = setGroup({
    className: "col-6",
    title: "Profile",
    desc: "Used for pace, BMI and calorie estimates",
    rows: [
      row({
        label: "Display name",
        desc: "Shown in the sidebar greeting",
        control: textField(s.profile.name || "", (v) => actions.updateSettings({ profile: { name: v } })),
      }),
      row({
        label: "Height",
        desc: `Stored in centimetres, shown in ${lenUnit()}`,
        control: numField({
          value: len(s.profile.heightCm) ?? 178, unit: lenUnit(), step: imp ? 0.5 : 1,
          onCommit: (v) => {
            const cm = imp ? v * 2.54 : v;
            actions.updateSettings({ profile: { heightCm: Math.round(cm) } });
          },
        }),
      }),
      row({
        label: "Birth year",
        desc: "Age adjusts training and calorie bands",
        control: numField({
          value: s.profile.birthYear, unit: "yr", step: 1, min: 1920, max: new Date().getFullYear(),
          onCommit: (v) => actions.updateSettings({ profile: { birthYear: Math.round(v) } }),
        }),
      }),
    ],
  });

  /* --------------------------------------------------------------- goals */
  const goals = setGroup({
    className: "col-12",
    title: "Goals",
    desc: "Targets used across every ring, chart and delta",
    body: goalGrid(s.goals, imp),
  });

  /* --------------------------------------------------------- connections */
  const connRows = PROVIDERS.map((p) => {
    const on = !!s.connections[p.id];
    return h("div", { class: `src-item${on ? "" : " src-item--off"}` }, [
      h("span", { class: "src-logo", style: `--tone:${p.tone}` }, p.monogram),
      h("div", { class: "row__main" }, [
        h("div", { class: "row__title", text: p.name }),
        h("div", { class: "row__sub", text: on ? `Synced ${p.sync} · ${p.supports.length} categories` : "Not connected" }),
      ]),
      sw(on, () => actions.toggleConnection(p.id), p.name),
    ]);
  });

  const connections = setGroup({
    className: "col-6",
    title: "Connections",
    desc: `${Object.values(s.connections).filter(Boolean).length} of ${PROVIDERS.length} sources active`,
    rows: connRows,
  });

  /* -------------------------------------------------------- notifications */
  const notifySpecs = [
    ["weekly", "Weekly summary", "Sunday recap of training, sleep and recovery"],
    ["lowRecovery", "Low recovery alert", "Flagged when recovery drops below 40"],
    ["mealReminder", "Meal reminder", "Nudge to log lunch on training days"],
    ["weighIn", "Weigh-in reminder", "Morning weigh-in prompt, Monday and Thursday"],
  ];
  const notifications = setGroup({
    className: "col-6",
    title: "Notifications",
    desc: "Local prompts only — nothing leaves this device",
    rows: notifySpecs.map(([key, label, desc]) =>
      row({
        label, desc,
        control: sw(!!s.notify[key], (on) => actions.updateSettings({ notify: { [key]: on } })),
      })
    ),
  });

  /* ---------------------------------------------------- source priority */
  const listHost = h("div", {});
  const catSelect = h("select", { class: "select" },
    CATEGORIES.map((c) =>
      h("option", { value: c.id, text: c.label, ...(c.id === activeCat ? { selected: true } : {}) })
    )
  );
  catSelect.addEventListener("change", () => {
    activeCat = catSelect.value;
    paintPriority();
  });

  const priority = setGroup({
    className: "col-6",
    title: "Source priority",
    desc: "When two sources disagree, the higher one wins",
    rows: [
      row({ label: "Category", desc: "Reordering applies immediately", control: catSelect }),
    ],
    body: [listHost, h("div", { style: "padding:0 var(--s-5) var(--s-4)" }, [note("Provenance stays visible so you always know which app a number came from.")])],
  });

  function paintPriority() {
    listHost.innerHTML = "";
    const ids = s.priorities[activeCat] || [];
    const catLabel = CATEGORIES.find((c) => c.id === activeCat)?.label || activeCat;
    if (!ids.length) {
      listHost.appendChild(h("div", { class: "set-row" }, [
        h("div", { class: "set-row__desc", text: `No sources feed ${catLabel.toLowerCase()} yet.` }),
      ]));
      return;
    }
    ids.forEach((id, i) => {
      const p = PROVIDERS.find((x) => x.id === id);
      if (!p) return;
      listHost.appendChild(
        h("div", { class: "src-item" }, [
          h("span", { class: "src-item__rank", text: String(i + 1) }),
          h("span", { class: "src-logo src-logo--sm", style: `--tone:${p.tone}` }, p.monogram),
          h("span", { class: "src-item__name", text: p.name }),
          h("span", { class: "src-item__meta", text: s.connections[p.id] ? "connected" : "idle" }),
          h("span", { class: "src-item__ctrl" }, [
            moveBtn("arrowUp", i === 0, () => actions.movePriority(activeCat, id, -1), `Move ${p.name} up`),
            moveBtn("arrowDown", i === ids.length - 1, () => actions.movePriority(activeCat, id, 1), `Move ${p.name} down`),
          ]),
        ])
      );
    });
  }
  paintPriority();

  /* ----------------------------------------------------- data & refresh */
  const refreshSelect = h("select", { class: "select" },
    [5, 15, 30, 60].map((m) =>
      h("option", { value: String(m), text: m >= 60 ? "Every hour" : `Every ${m} min`, ...(m === s.refreshMinutes ? { selected: true } : {}) })
    )
  );
  refreshSelect.addEventListener("change", () =>
    actions.updateSettings({ refreshMinutes: Number(refreshSelect.value) })
  );

  const dataGroup = setGroup({
    className: "col-6",
    title: "Data & storage",
    desc: "Everything lives in this browser",
    rows: [
      row({ label: "Refresh interval", desc: "How often connected sources are polled", control: refreshSelect }),
      row({
        label: "Restore defaults",
        desc: "Clears stored settings, goals and connections on this device",
        control: h("button", {
          class: "pill pill--danger",
          text: "Restore defaults",
          onClick: () => {
            if (!window.confirm("Restore all WinterArc settings to their defaults? This clears your local configuration.")) return;
            wipe();
            location.reload();
          },
        }),
      }),
    ],
  });
  dataGroup.appendChild(h("div", { style: "padding:0 var(--s-5) var(--s-4)" }, [
    note("No account, no sync, no telemetry. Goals, check-ins and preferences stay in local storage."),
  ]));

  /* ------------------------------------------------------------ assemble */
  gridRow(root, appearance, profile);
  gridRow(root, goals);
  gridRow(root, connections, notifications);
  gridRow(root, priority, dataGroup);

  return root;
}

/* ---------------------------------------------------------------- widgets */

function setGroup({ title, desc = "", rows = [], body = [], className = "" }) {
  const kids = [].concat(rows || [], body || []).filter(Boolean);
  return h("section", { class: `set-group ${className}`.trim() }, [
    h("div", { class: "set-group__head" }, [
      h("div", {}, [
        h("h4", { text: title }),
        desc ? h("p", { text: desc }) : null,
      ]),
    ]),
    ...kids,
  ]);
}

function row({ label, desc = "", control }) {
  return h("div", { class: "set-row" }, [
    h("div", {}, [
      h("div", { class: "set-row__label", text: label }),
      desc ? h("div", { class: "set-row__desc", text: desc }) : null,
    ]),
    control,
  ]);
}

function sw(on, onChange, label = "") {
  const btn = h("button", {
    class: `switch${on ? " is-on" : ""}`,
    role: "switch",
    "aria-checked": String(!!on),
    "aria-label": label || undefined,
    title: label || undefined,
  });
  btn.addEventListener("click", () => {
    const next = !btn.classList.contains("is-on");
    btn.classList.toggle("is-on", next);
    btn.setAttribute("aria-checked", String(next));
    onChange(next);
  });
  return btn;
}

function textField(value, onCommit) {
  const input = h("input", { class: "input", type: "text", value: value ?? "" });
  input.addEventListener("change", () => onCommit(input.value.trim()));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });
  return input;
}

function numField({ value, unit = "", step = 1, min, max, onCommit }) {
  const input = h("input", {
    class: "input", type: "number", value: value == null ? "" : String(value),
    step: String(step),
    ...(min != null ? { min: String(min) } : {}),
    ...(max != null ? { max: String(max) } : {}),
  });
  const commit = () => {
    const v = Number(input.value);
    if (!Number.isFinite(v)) return;
    let out = v;
    if (min != null) out = Math.max(min, out);
    if (max != null) out = Math.min(max, out);
    input.value = String(out);
    onCommit(out);
  };
  input.addEventListener("change", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });
  const wrap = h("span", { class: "inline" }, [input]);
  if (unit) wrap.appendChild(h("span", { class: "label", text: unit }));
  return wrap;
}

function moveBtn(ic, disabled, onClick, title) {
  const b = h("button", { title, onClick, ...(disabled ? { disabled: true } : {}) }, icon(ic));
  return b;
}

/* ------------------------------------------------------------ goals grid */

const GOAL_FIELDS = [
  { key: "steps", label: "Steps / day", step: 500, min: 1000, max: 50000, get: (g) => g.steps, unit: () => "steps" },
  { key: "activeKcal", label: "Active energy", step: 25, min: 0, max: 3000, get: (g) => g.activeKcal, unit: () => "kcal" },
  { key: "energyKcal", label: "Energy intake", step: 50, min: 800, max: 8000, get: (g) => g.energyKcal, unit: () => "kcal" },
  { key: "proteinG", label: "Protein", step: 5, min: 0, max: 500, get: (g) => g.proteinG, unit: () => "g" },
  { key: "carbsG", label: "Carbs", step: 5, min: 0, max: 900, get: (g) => g.carbsG, unit: () => "g" },
  { key: "fatG", label: "Fat", step: 5, min: 0, max: 300, get: (g) => g.fatG, unit: () => "g" },
  { key: "workoutsPerWeek", label: "Workouts / week", step: 1, min: 0, max: 14, get: (g) => g.workoutsPerWeek, unit: () => "/wk" },
];

function goalGrid(goals, imp) {
  const grid = h("div", { class: "goal-grid" });

  const cell = (label, field) => h("div", { class: "goal" }, [
    h("span", { class: "goal__k", text: label }),
    field,
  ]);

  for (const f of GOAL_FIELDS) {
    grid.appendChild(cell(f.label, numField({
      value: f.get(goals), step: f.step, min: f.min, max: f.max, unit: f.unit(),
      onCommit: (v) => actions.updateSettings({ goals: { [f.key]: v } }),
    })));
  }

  /* sleep: stored in minutes, edited in hours */
  grid.appendChild(cell("Sleep", numField({
    value: Math.round((goals.sleepMin / 60) * 2) / 2, step: 0.5, min: 3, max: 14, unit: "h",
    onCommit: (v) => actions.updateSettings({ goals: { sleepMin: Math.round(v * 60) } }),
  })));

  /* water: stored in ml, edited in L (or fl oz when imperial) */
  grid.appendChild(cell("Water", imp
    ? numField({
      value: Math.round(goals.waterMl / 29.5735), step: 8, min: 16, max: 400, unit: "fl oz",
      onCommit: (v) => actions.updateSettings({ goals: { waterMl: Math.round(v * 29.5735) } }),
    })
    : numField({
      value: Math.round(goals.waterMl / 100) / 10, step: 0.1, min: 0.5, max: 8, unit: "L",
      onCommit: (v) => actions.updateSettings({ goals: { waterMl: Math.round(v * 1000) } }),
    })));

  /* weight target */
  grid.appendChild(cell("Target weight", numField({
    value: Math.round(wt(goals.weightKg) * 10) / 10, step: 0.1, min: 30, max: 300, unit: wtUnit(),
    onCommit: (v) => actions.updateSettings({ goals: { weightKg: Math.round((imp ? v / 2.2046226218 : v) * 10) / 10 } }),
  })));

  return grid;
}
