const api = "/api/v1";
const get = (id) => document.getElementById(id);
const controls = document.querySelectorAll("button, input, select");
function showCurrentSection() {
  const hash = location.hash || "#overview-heading";
  for (const link of document.querySelectorAll(".rail nav a")) {
    if (link.hash === hash) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
addEventListener("hashchange", showCurrentSection);
showCurrentSection();
const example = JSON.stringify([
  {metric: "weight", value: 73, unit: "kg", observed_at: "2025-12-25T08:00:00Z"},
  {metric: "weight", value: 72.5, unit: "kg", observed_at: "2026-01-01T08:00:00Z"},
  {metric: "weight", value: null, unit: "kg", observed_at: "2026-01-02T08:00:00Z"},
  {metric: "sleep_duration", value: 7, unit: "h", observed_at: "2026-01-01T01:00:00Z"},
  {metric: "sleep_duration", value: 480, unit: "min", observed_at: "2026-01-01T08:00:00Z"},
  {metric: "sleep_duration", value: null, unit: "min", observed_at: "2026-01-02T01:00:00Z"},
  {metric: "nutrition_energy", value: 8368, unit: "kJ", observed_at: "2026-01-01T08:00:00Z"},
  {metric: "nutrition_energy", value: null, unit: "kcal", observed_at: "2026-01-02T08:00:00Z"},
  {metric: "nutrition_protein", value: 90, unit: "g", observed_at: "2026-01-01T08:00:00Z"},
  {metric: "nutrition_fibre", value: 0, unit: "g", observed_at: "2026-01-01T08:00:00Z"},
  {metric: "heart_rate", value: 72, unit: "bpm", observed_at: "2026-01-01T08:00:00Z"},
]);

async function request(path, options) {
  const response = await fetch(`${api}${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(Array.isArray(error.detail) ? error.detail.map(({msg}) => msg).join(". ")
      : error.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

function table(id, headers, rows, empty) {
  const target = get(id);
  if (!rows.length) {
    target.textContent = empty;
    return;
  }
  const table = document.createElement("table");
  table.setAttribute("aria-labelledby", `${id}-heading`);
  const head = table.createTHead().insertRow();
  for (const label of headers) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    head.append(cell);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const value of values) row.insertCell().textContent = value;
  }
  target.replaceChildren(table);
}

const metricLabels = {weight: "Weight", body_fat: "Body fat", lean_mass: "Lean mass"};
const numbers = new Intl.NumberFormat(undefined, {maximumFractionDigits: 2});
const coverage = ({observed_days, total_days}) => `${observed_days} of ${total_days} days`;
const measurement = (value, unit) => value === null ? "Unavailable" : `${numbers.format(value)} ${unit}`;

function renderBody(summary) {
  const {as_of_date: date, timezone, metrics} = summary;
  get("body-context").textContent = date ? `Windows ending ${date} (${timezone}).`
    : `No supported body measurements in ${timezone}. Import the example fixture to see window coverage.`;
  table("body-windows", ["Metric", "Window", "Current average", "Current coverage",
    "Prior coverage", "Change"], date ? Object.entries(metrics).flatMap(([metric, {unit, windows}]) =>
    Object.entries(windows).map(([period, {current, previous, change}]) => [
      metricLabels[metric] ?? metric, period, measurement(current.average, unit), coverage(current),
      coverage(previous), measurement(change, unit === "%" ? "percentage points" : unit),
    ])) : [], "No window averages yet.");
}

function renderSleep({as_of_date: date, timezone, unit, windows}) {
  get("sleep-context").textContent = date ? `Windows ending ${date} (${timezone}).`
    : `No supported sleep duration totals in ${timezone}. Import the example fixture to see window coverage.`;
  table("sleep-windows", ["Window", "Average daily duration", "Coverage", "Valid samples"],
    date ? Object.entries(windows).map(([period, window]) => [
      period, measurement(window.average, unit), coverage(window), window.sample_count,
    ]) : [], "No duration averages yet.");
}

const nutrientLabels = {
  nutrition_energy: "Energy", nutrition_protein: "Protein", nutrition_carbohydrates: "Carbohydrates",
  nutrition_fat: "Fat", nutrition_fibre: "Fibre", nutrition_sodium: "Sodium", nutrition_iron: "Iron",
};

const metricName = (id) => ({...metricLabels, ...nutrientLabels, sleep_duration: "Sleep duration",
  heart_rate: "Heart rate"})[id] ?? id;

function plot(id, label, points, curves = [], domain = []) {
  const target = get(id);
  target.replaceChildren();
  if (!points.length) return;
  const element = (name, attrs) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const scale = (values, start, end) => {
    let min = Infinity, max = -Infinity;
    for (const value of values) { min = Math.min(min, value); max = Math.max(max, value); }
    const factor = Math.max(Math.abs(min), Math.abs(max)) || 1;
    return {min, max, pixel: (value) => max === min ? (start + end) / 2
      : start + (end - start) * ((value / factor - min / factor) / (max / factor - min / factor))};
  };
  const all = points.concat(...curves.map(({points}) => points));
  const x = scale(domain.length ? domain : all.map((p) => p.x), 75, 595);
  const y = scale(all.map((p) => p.y), 188, 16);
  const svg = element("svg", {viewBox: "0 0 620 225", width: "100%", role: "img", "aria-label": label});
  svg.append(element("path", {d: "M75 16V188H595", fill: "none", stroke: "currentColor"}));
  for (const [px, py, text, anchor] of [[70, 16, y.max, "end"], [70, 188, y.min, "end"],
    [75, 206, domain.length ? new Date(x.min).toISOString().slice(0, 10) : x.min, "start"],
    [595, 206, domain.length ? new Date(x.max).toISOString().slice(0, 10) : x.max, "end"]]) {
    const tick = element("text", {x: px, y: py, "text-anchor": anchor, "font-size": 12, fill: "currentColor"});
    tick.textContent = typeof text === "number" ? Number(text.toPrecision(4)) : text;
    svg.append(tick);
  }
  for (const curve of curves) {
    svg.append(element("polyline", {points: curve.points.map((p) => `${x.pixel(p.x)},${y.pixel(p.y)}`).join(" "),
      fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-dasharray": curve.dash}));
  }
  for (const p of points) svg.append(element("circle", {cx: x.pixel(p.x), cy: y.pixel(p.y), r: 3, fill: "currentColor"}));
  target.append(svg);
}

let registry;
let dailyRequest = 0;
async function refreshDaily() {
  const seq = ++dailyRequest;
  const selected = get("daily-metric").value;
  const query = new URLSearchParams({timezone: get("timezone").value.trim()});
  const download = get("daily-export");
  download.hidden = true;
  get("daily-status").textContent = "Loading daily measurements…";
  get("daily-chart").replaceChildren();
  get("daily-data").replaceChildren();
  let summary;
  try {
    summary = await request(`/metrics/${encodeURIComponent(selected)}/daily?${query}`);
  } catch (error) {
    if (seq === dailyRequest) throw error;
    return;
  }
  if (seq !== dailyRequest) return;
  const {daily, unit, timezone} = summary;
  if (get("daily-metric").value !== selected || get("timezone").value.trim() !== timezone) return;
  download.href = `${api}/metrics/${encodeURIComponent(selected)}/daily.csv?${query}`;
  download.hidden = false;
  const observed = daily.filter(({value}) => value !== null && Number.isFinite(value));
  const label = `${metricName(selected)} (${unit}), daily means in ${timezone}`;
  get("daily-status").textContent = `${label}. ${observed.length} observed days; gaps are not filled.`;
  plot("daily-chart", label, observed.map(({date, value}) => ({x: Date.parse(date), y: value})), [],
    daily.length > 1 ? [Date.parse(daily[0].date), Date.parse(daily.at(-1).date)]
      : daily.map(({date}) => Date.parse(date)));
  table("daily-data", ["Date", label, "Valid samples", "Measurement IDs"], daily.map((p) =>
    [p.date, measurement(p.value, unit), p.sample_count, p.measurement_ids.join(", ")]), "No supported measurements.");
}

const photoSlots = ["before", "after"].map((slot) => {
  const input = get(`photo-${slot}`);
  const image = get(`preview-${slot}`);
  const status = get("photo-status");
  let url;
  function release() {
    image.hidden = true;
    image.removeAttribute("src");
    if (url) URL.revokeObjectURL(url);
    url = undefined;
  }
  input.addEventListener("change", () => {
    release();
    status.textContent = "";
    const [file] = input.files;
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) {
      status.textContent = "Choose a JPEG, PNG or WebP file no larger than 20 MiB.";
      input.value = "";
      return;
    }
    url = URL.createObjectURL(file);
    image.src = url;
    image.hidden = false;
  });
  image.addEventListener("error", () => {
    release();
    input.value = "";
    status.textContent = "This photo could not be displayed.";
  });
  return () => { release(); input.value = ""; };
});
get("photo-clear").addEventListener("click", () => {
  photoSlots.forEach((clear) => clear());
  get("photo-status").textContent = "Previews cleared.";
});

async function refreshMetricRegistry() {
  if (!registry) {
    registry = await request("/metrics");
    for (const [id, preferred] of [["daily-metric", "weight"], ["correlation-x", "weight"],
      ["correlation-y", "sleep_duration"]]) {
      get(id).replaceChildren(...registry.map(({id, unit}) => new Option(`${metricName(id)} (${unit})`, id)));
      get(id).value = preferred;
    }
  }
  await refreshDaily();
}

const statistic = (value) => value === null ? "Unavailable" : Number(value.toPrecision(5));
function clearCorrelation(message) {
  get("correlation-status").textContent = message;
  for (const id of ["correlation-method", "correlation-plot", "correlation-rolling",
    "correlation-pairs", "correlation-distributions"]) get(id).replaceChildren();
}

function renderCorrelation(result) {
  const {paired_n: n, total_days: days, pearson, spearman, x_metric, y_metric, pairs, linear, loess} = result;
  const x = `${metricName(x_metric)} (${result.x_unit})`, y = `${metricName(y_metric)} (${result.y_unit})`;
  get("correlation-status").textContent = `${n} paired days of ${days}. X observed: ${result.x_observed_days}; ` +
    `lag-aligned Y observed: ${result.y_observed_days}. Pearson: ${statistic(pearson)}. Spearman: ${statistic(spearman)}.`;
  get("correlation-method").textContent = `${x} vs ${y}; ${result.start_date ?? "no dates"} to ` +
    `${result.end_date ?? "no dates"} (${result.timezone}, X dates). ${result.lag_convention}, lag ${result.lag_days}. ` +
    `${result.rolling_days}-calendar-day windows. ${result.engine}${result.engine_version ? ` ${result.engine_version}` : ""}, ` +
    `method v${result.method_version}. ${result.limitations}`;
  const curves = [];
  if (linear) {
    const ends = [Math.min(...pairs.map((p) => p.x)), Math.max(...pairs.map((p) => p.x))];
    const points = ends.map((x) => ({x, y: linear.intercept + x * linear.slope}));
    if (points.every(({y}) => Number.isFinite(y))) curves.push({points, dash: "6 4"});
  }
  if (loess.length) curves.push({points: loess, dash: "1 0"});
  plot("correlation-plot", `Paired daily means: X ${x}, Y ${y}`, pairs, curves);
  const caption = document.createElement("p");
  caption.textContent = `X: ${x}; Y: ${y}. ` + (linear
    ? `Linear fit (dashed): intercept ${statistic(linear.intercept)}, slope ${statistic(linear.slope)}. `
    : "Linear fit unavailable. ") + (loess.length ? "LOESS (solid)." : "LOESS unavailable.");
  get("correlation-plot").append(caption);
  table("correlation-distributions", ["Metric", "Minimum", "Q1", "Median", "Q3", "Maximum"],
    Object.entries(result.distributions).map(([axis, values]) => [axis === "x" ? x : y, ...values.map(statistic)]),
    "No paired values.");
  table("correlation-rolling", ["X window end", "Paired days", "Pearson", "Spearman"], result.rolling.map((p) =>
    [p.end_date, p.paired_n, statistic(p.pearson), statistic(p.spearman)]), "No full calendar windows in range.");
  table("correlation-pairs", ["X date", x, "X IDs", "Y date", y, "Y IDs"], pairs.map((p) =>
    [p.x_date, p.x, p.x_measurement_ids.join(", "), p.y_date, p.y, p.y_measurement_ids.join(", ")]),
    "No overlapping valid days at this lag.");
}

get("daily-metric").addEventListener("change", () => refreshDaily().catch((error) => {
  get("daily-chart").replaceChildren();
  get("daily-data").replaceChildren();
  get("daily-status").textContent = error.message;
}));
get("correlation-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  controls.forEach((control) => { control.disabled = true; });
  clearCorrelation("Analyzing local data…");
  try {
    renderCorrelation(await request("/analysis/correlation", {
      method: "POST", headers: {"Content-Type": "application/json", "X-WinterArc-Local": "1"},
      body: JSON.stringify({x: get("correlation-x").value, y: get("correlation-y").value,
        timezone: get("timezone").value.trim(), lag_days: get("lag-days").valueAsNumber,
        rolling_days: get("rolling-days").valueAsNumber, start_date: get("correlation-start").value || null,
        end_date: get("correlation-end").value || null}),
    }));
  } catch (error) {
    clearCorrelation(error.message);
  } finally {
    controls.forEach((control) => { control.disabled = false; });
  }
});
get("correlation-form").addEventListener("input", () => clearCorrelation("Run analysis with the updated settings."));

function renderNutrition({as_of_date: date, timezone, metrics}) {
  get("nutrition-context").textContent = date ? `Windows ending ${date} (${timezone}).`
    : `No supported nutrition totals in ${timezone}. Import the example fixture to see window coverage.`;
  table("nutrition-windows", ["Nutrient", "Window", "Average daily total", "Coverage", "Valid samples"],
    date ? Object.entries(metrics).flatMap(([metric, {unit, windows}]) =>
      Object.entries(windows).map(([period, window]) => [
        nutrientLabels[metric] ?? metric, period, measurement(window.average, unit),
        coverage(window), window.sample_count,
      ])) : [], "No nutrition averages yet.");
}

function renderCardio({as_of_date: date, timezone, metrics}) {
  const {unit, windows} = metrics.heart_rate;
  get("cardio-context").textContent = date ? `Windows ending ${date} (${timezone}).`
    : `No supported heart-rate samples in ${timezone}.`;
  table("cardio-windows", ["Window", "Average of daily sample means", "Coverage", "Valid samples"],
    date ? Object.entries(windows).map(([period, window]) => [
      period, measurement(window.average, unit), coverage(window), window.sample_count,
    ]) : [], "No heart-rate averages yet.");
}

function renderOverview({as_of_date: date, timezone, metrics}) {
  const labels = {weight: "Weight", sleep_duration: "Sleep duration", nutrition_energy: "Energy",
    heart_rate: "Heart rate"};
  get("overview-context").textContent = date ? `Common reporting week ending ${date} (${timezone}).`
    : `No supported overview measurements in ${timezone}.`;
  const weekly = (window, unit) => `${measurement(window.average, unit)} (${coverage(window)})`;
  get("overview-cards").replaceChildren(...Object.entries(labels).map(([metric, label]) => {
    const entry = metrics[metric];
    const card = document.createElement("article");
    card.className = "metric-tile";
    card.dataset.metric = metric;
    const heading = document.createElement("h3");
    heading.textContent = label;
    const value = document.createElement("p");
    value.className = "metric-value";
    value.textContent = entry?.latest ? measurement(entry.latest.value, entry.latest.unit) : "—";
    const note = document.createElement("p");
    note.textContent = entry?.latest ? `${coverage(entry.current)} this week` : "No measurements yet";
    card.append(heading, value, note);
    return card;
  }));
  table("overview-windows", ["Metric", "Latest valid observation (UTC)", "Current week", "Prior week", "Change"],
    date ? Object.entries(metrics).map(([metric, {unit, latest, current, previous, change}]) => [
      labels[metric], latest ? `${measurement(latest.value, latest.unit)} · ${latest.observed_at} · Fixture #${latest.import_id}`
        : "Unavailable", weekly(current, unit), weekly(previous, unit), measurement(change, unit),
    ]) : [], "No overview measurements yet.");
}

async function refreshPanel(id, path, render, emptyOnError, contextId) {
  try {
    render(await request(path));
  } catch (error) {
    get(id).textContent = emptyOnError;
    if (id === "overview-windows") get("overview-cards").replaceChildren();
    if (contextId) get(contextId).textContent = error.message;
    throw error;
  }
}

async function refresh() {
  const query = new URLSearchParams({timezone: get("timezone").value.trim()});
  const results = await Promise.allSettled([
    refreshMetricRegistry().catch((error) => {
      get("daily-chart").replaceChildren();
      get("daily-data").replaceChildren();
      get("daily-status").textContent = error.message;
      throw error;
    }),
    refreshPanel("overview-windows", `/overview/summary?${query}`, renderOverview,
      "Overview unavailable.", "overview-context"),
    refreshPanel("cardio-windows", `/cardio/summary?${query}`, renderCardio,
      "Heart-rate averages unavailable.", "cardio-context"),
    refreshPanel("series", "/series", (series) => table("series",
      ["Observed (UTC)", "Metric", "Value", "Unit", "Fixture import"],
      series.map((row) => [row.observed_at, row.metric, row.value ?? "Missing", row.unit, `#${row.import_id}`]),
      "No synthetic measurements yet."), "Measurements unavailable."),
    refreshPanel("imports", "/imports", (imports) => table("imports",
      ["Fixture import", "Imported (UTC)", "Rows", "SHA-256"],
      imports.map((row) => [`#${row.id}`, row.imported_at, row.row_count, row.sha256]),
      "No synthetic fixtures imported yet."), "Import history unavailable."),
    refreshPanel("sources", "/sources", (sources) => table("sources", ["Provider", "Status", "Details"],
      sources.map(({name, status, reason}) => [name, status, reason]), "No provider sources configured."),
    "Provider status unavailable."),
    refreshPanel("body-windows", `/body/summary?${query}`, renderBody, "Window averages unavailable.")
      .catch((error) => {
        get("body-context").textContent = `Body summary unavailable. ${error.message}`;
        throw error;
      }),
    refreshPanel("sleep-windows", `/sleep/summary?${query}`, renderSleep, "Duration averages unavailable.")
      .catch((error) => {
        get("sleep-context").textContent = `Sleep summary unavailable. ${error.message}`;
        throw error;
      }),
    refreshPanel("nutrition-windows", `/nutrition/summary?${query}`, renderNutrition, "Nutrition averages unavailable.")
      .catch((error) => {
        get("nutrition-context").textContent = `Nutrition summary unavailable. ${error.message}`;
        throw error;
      }),
  ]);
  const errors = results.filter(({status}) => status === "rejected");
  if (errors.length) throw new Error([...new Set(errors.map(({reason}) => reason.message))].join(". "));
}

async function run(payload) {
  clearCorrelation("Select metrics and run an analysis.");
  controls.forEach((control) => { control.disabled = true; });
  get("status").textContent = payload === undefined ? "Loading local data…" : "Importing synthetic fixture…";
  let result = "";
  try {
    if (payload !== undefined) {
      if (payload.size > 8 * 1024 * 1024) throw new Error("Synthetic fixture exceeds 8 MiB");
      const manifest = await request("/imports", {
        method: "POST", headers: {"Content-Type": "application/json", "X-WinterArc-Local": "1"}, body: payload,
      });
      result = manifest.duplicate ? `Fixture #${manifest.id} already imported.`
        : `Imported synthetic fixture #${manifest.id} (${manifest.row_count} rows).`;
      get("status").textContent = `${result} Refreshing local data…`;
    }
    await refresh();
    get("status").textContent = result || "Local data loaded.";
  } catch (error) {
    get("status").textContent = `${result ? `${result} ` : ""}${error.message}`;
  } finally {
    controls.forEach((control) => { control.disabled = false; });
  }
}

get("sample").addEventListener("click", () => run(example));
get("refresh").addEventListener("click", () => run());
get("summary-timezone").addEventListener("submit", (event) => {
  event.preventDefault();
  run();
});
get("upload").addEventListener("submit", (event) => {
  event.preventDefault();
  const [file] = get("fixture").files;
  if (file) run(file);
});
run();
