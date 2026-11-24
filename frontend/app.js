const api = "/api/v1";
const get = (id) => document.getElementById(id);
const controls = document.querySelectorAll("button, input");
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
]);

async function request(path, options) {
  const response = await fetch(`${api}${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Request failed (${response.status})`);
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

async function refreshPanel(id, path, render, emptyOnError) {
  try {
    render(await request(path));
  } catch (error) {
    get(id).textContent = emptyOnError;
    throw error;
  }
}

async function refresh() {
  const query = new URLSearchParams({timezone: get("timezone").value.trim()});
  const results = await Promise.allSettled([
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
