(function () {
  "use strict";

  const DAY = 86400000;

  const deepText = () => "var(--subtext1)";

  // ---------- data helpers ----------

  async function load(type, days, transform) {
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY);
    const url = "/api/v1/metrics?metricType=" + type +
      "&from=" + from.toISOString() + "&to=" + to.toISOString();
    const data = await WA.fetchJSON(url);
    return WA.metricSeries(data, transform);
  }

  function dailySum(series) { return WA.daily(series, "sum"); }
  function dailyAvg(series) { return WA.daily(series, "avg"); }

  function weekBucket(dateMs) {
    const d = new Date(dateMs);
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - dow);
    return d.getTime();
  }

  function weekly(series) {
    const map = new Map();
    for (const p of series) {
      const wk = weekBucket(p.t);
      map.set(wk, (map.get(wk) || 0) + p.v);
    }
    return [...map.entries()]
      .map(([t, v]) => ({ date: new Date(t), v }))
      .sort((a, b) => a.date - b.date);
  }

  function weeklyCount(series) {
    const map = new Map();
    for (const p of series) {
      const wk = weekBucket(p.t);
      map.set(wk, (map.get(wk) || 0) + 1);
    }
    return [...map.entries()]
      .map(([t, v]) => ({ date: new Date(t), v }))
      .sort((a, b) => a.date - b.date);
  }

  function trailingAvg(daily, window) {
    return daily.map((pt, i) => {
      const from = Math.max(0, i - window + 1);
      let s = 0, n = 0;
      for (let j = from; j <= i; j++) { s += daily[j].v; n++; }
      return { date: pt.date, v: s / n };
    });
  }

  async function loadSingle(type, days) {
    const rows = await load(type, days);
    return { raw: rows, daily: dailySum(rows), avg: dailyAvg(rows) };
  }

  function empty(el) {
    el.innerHTML = '<p class="plot-fallback">No data yet for this metric.</p>';
  }

  function chartCard(stack, title) {
    const card = document.createElement("div");
    card.className = "chart-card";
    card.innerHTML = "<h3>" + title + "</h3><div class='chart'></div>";
    stack.appendChild(card);
    return card.querySelector(".chart");
  }

  // ---------- generic renders ----------

  function renderBars(el, data, yLabel, colorH) {
    if (!data.length) return empty(el);
    colorH = colorH || "var(--accent-default)";
    el.append(Plot.plot({
      width: 900, height: 240, marginLeft: 46, marginBottom: 30,
      style: { background: "transparent", color: deepText(), fontFamily: "inherit" },
      x: { grid: false, tickFormat: Plot.formatDay("%b %e") },
      y: { grid: true, label: yLabel, color: "overlay0" },
      marks: [
        Plot.rectY(data, { x: "date", y: "v", fill: colorH, insetTop: 4, rx: 3 })
      ]
    }));
  }

  function renderLine(el, seriesList, yLabel) {
    const all = seriesList.map((s) => s.data).flat();
    if (!all.length) return empty(el);
    const marks = seriesList.map((s) =>
      Plot.line(s.data, { x: "date", y: "v", stroke: s.color, strokeWidth: 2 })
    );
    el.append(Plot.plot({
      width: 900, height: 240, marginLeft: 46, marginBottom: 30,
      style: { background: "transparent", color: deepText(), fontFamily: "inherit" },
      x: { grid: false, tickFormat: Plot.formatDay("%b %e") },
      y: { grid: true, label: yLabel },
      marks: marks
    }));
  }

  function lerpColor(a, b, t) {
    const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return "rgb(" + c.join(",") + ")";
  }

  function renderHeatmap(el, days, series) {
    if (!series.length) return empty(el);
    const cells = new Map();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY);
      d.setHours(0, 0, 0, 0);
      cells.set(d.getTime(), 0);
    }
    for (const p of series) {
      const key = WA.localDayStart(p.t);
      if (cells.has(key)) cells.set(key, cells.get(key) + 1);
    }
    const data = [...cells.entries()].map(([t, count]) => ({
      week: weekBucket(t), dow: new Date(t).getDay() % 7, count: Math.min(count, 6)
    }));
    const base = WA.color("surface0");
    const accent = WA.color("mauve");
    el.append(Plot.plot({
      width: 900, height: 150, marginLeft: 30, marginBottom: 5,
      style: { background: "transparent", fontFamily: "inherit" },
      color: { range: [0, 6], interpolate: (t) => lerpColor(base, accent, t) },
      marks: [
        Plot.cell(data, { x: "week", y: "dow", fill: "count" }),
        Plot.text(data, {
          x: "week", y: "dow", filter: (d) => d.count >= 1,
          text: (d) => d.count, fill: WA.color("base"), fontSize: 8
        })
      ],
      x: { ticks: 0, axis: null },
      y: { ticks: 0, axis: null }
    }));
  }

  function pad(data) {
    return data.map((d) => ({ date: d.date, v: d.v }));
  }

  // ---------- category configs ----------

  const CATS = {
    training: {
      label: "Training",
      accent: "mauve",
      charts(el, days) {
        Promise.all([loadSingle("workout_duration", days), loadSingle("workout_strength", days)])
          .then(([dur, strength]) => {
            const load = [...dur.daily];
            renderBars(chartCard(el, "Daily training load (minutes)", "mauve"), load.map(d => ({ date: d.date, v: d.v / 60 })), "min", "var(--mauve)");
            const hd = chartCard(el, "Workout frequency", "mauve");
            renderHeatmap(hd, days, [...dur.raw, ...strength.raw]);
          });
      }
    },
    cardio: {
      label: "Cardio",
      accent: "blue",
      charts(el, days) {
        Promise.all([loadSingle("workout_cardio", days)])
          .then(([c]) => {
            renderBars(chartCard(el, "Weekly distance (km)", "blue"),
              weekly(c.raw).map(d => ({ date: d.date, v: d.v / 1000 })), "km", "var(--blue)");
            const pace = c.raw.map(p => ({ date: new Date(p.t), v: p.v > 0 ? 3600 / (p.v / 1000) : 0 }))
              .filter(p => p.v > 0);
            renderLine(chartCard(el, "Run pace (min/km)", "blue"),
              [{ data: pace, color: "var(--blue)" }], "min/km");
            mapCard(el, days);
          });
      }
    },
    nutrition: {
      label: "Nutrition",
      accent: "yellow",
      charts(el, days) {
        Promise.all([
          loadSingle("calories", days),
          loadSingle("carbohydrates", days),
          loadSingle("protein", days),
          loadSingle("fat", days),
          loadSingle("body_weight", days)
        ]).then(([cal, carbs, prot, fat, w]) => {
          const cur = chartCard(el, "Daily calories with 7-day average", "yellow");
          if (!cal.daily.length) return empty(cur);
          const bars = cal.daily.map(d => ({ date: d.date, v: d.v }));
          const avg = trailingAvg(cal.daily, 7);
          cur.append(Plot.plot({
            width: 900, height: 240, marginLeft: 46, marginBottom: 30,
            style: { background: "transparent", color: deepText(), fontFamily: "inherit" },
            x: { tickFormat: Plot.formatDay("%b %e") },
            y: { grid: true, label: "kcal" },
            marks: [
              Plot.rectY(bars, { x: "date", y: "v", fill: "var(--yellow)", opacity: 0.55, rx: 2 }),
              Plot.line(avg, { x: "date", y: "v", stroke: "var(--peach)", strokeWidth: 2.5 })
            ]
          }));

          const mc = chartCard(el, "Macros (g)", "yellow");
          const macroData = [];
          const byDay = new Map();
          const all = [["carbohydrates", carbs], ["protein", prot], ["fat", fat]];
          for (const [name, ser] of all) {
            for (const d of dailySum(ser)) {
              const key = d.date.getTime();
              if (!byDay.has(key)) byDay.set(key, { date: d.date });
              byDay.get(key)[name] = d.v;
            }
          }
          for (const row of byDay.values()) {
            if (row.carbohydrates !== undefined && row.protein !== undefined && row.fat !== undefined) {
              macroData.push(
                { date: row.date, macro: "Carbs", value: row.carbohydrates },
                { date: row.date, macro: "Protein", value: row.protein },
                { date: row.date, macro: "Fat", value: row.fat }
              );
            }
          }
          if (macroData.length) {
            mc.append(Plot.plot({
              width: 900, height: 240, marginLeft: 46, marginBottom: 30,
              style: { background: "transparent", color: deepText(), fontFamily: "inherit" },
              x: { tickFormat: Plot.formatDay("%b %e") },
              y: { grid: true, label: "g · share of day" },
              color: {
                legend: true, range: ["var(--yellow)", "var(--green)", "var(--maroon)"]
              },
              marks: [
                Plot.areaY(macroData, {
                  x: "date", y: "value", z: "macro", fill: "macro",
                  curve: "monotone", stack: "normalize", opacity: 0.85
                })
              ]
            }));
          } else {
            mc.innerHTML = '<p class="plot-fallback">No macro data yet.</p>';
          }

          const wc = chartCard(el, "Body weight (kg)", "yellow");
          renderLine(wc, [{ data: pad(w.daily), color: "var(--yellow)" }], "kg");
        });
      }
    },
    recovery: {
      label: "Recovery",
      accent: "teal",
      charts(el, days) {
        Promise.all([
          loadSingle("sleep", days),
          loadSingle("hrv", days),
        ]).then(([sleep, hrv]) => {
          renderBars(chartCard(el, "Sleep per night (h)", "teal"),
            dailyAvg(sleep).map(d => ({ date: d.date, v: d.v })), "h", "var(--teal)");
          renderLine(chartCard(el, "HRV (ms)", "teal"),
            [{ data: dailyAvg(hrv), color: "var(--sapphire)" }], "ms");
        });
      }
    },
    mental: {
      label: "Mental Health",
      accent: "pink",
      charts(el, days) {
        Promise.all([loadSingle("mood", days), loadSingle("workout_duration", days)])
          .then(([mood, load]) => {
            const cur = chartCard(el, "Mood over time", "pink");
            renderLine(cur, [{ data: dailyAvg(mood), color: "var(--pink)" }], "mood");
            const ov = chartCard(el, "Mood vs training load", "pink");
            if (!mood.daily.length) return empty(ov);
            const m = dailyAvg(mood);
            const ml = m.map(p => ({ date: p.date, v: p.v * 10 })); // scale mood to compare
            const ld = dailySum(load);
            ov.append(Plot.plot({
              width: 900, height: 240, marginLeft: 46, marginBottom: 30,
              style: { background: "transparent", color: deepText(), fontFamily: "inherit" },
              x: { tickFormat: Plot.formatDay("%b %e") },
              y: { grid: true, label: "mood ↑ / load" },
              marks: [
                Plot.line(m, { x: "date", y: "v", stroke: "var(--pink)", strokeWidth: 2 }),
                Plot.areaY(ml, { x: "date", y: "v", fill: "var(--mauve)", opacity: 0.25 })
              ]
            }));
          });
      }
    },
    flexibility: {
      label: "Flexibility",
      accent: "green",
      charts(el, days) {
        Promise.all([loadSingle("workout_flex", days)])
          .then(([f]) => {
            renderBars(chartCard(el, "Bend sessions per week"),
              weeklyCount(f.raw).map(d => ({ date: d.date, v: d.v })),
              "sessions", "var(--green)");
            renderLine(chartCard(el, "Session duration (min)"),
              [{ data: dailySum(f.raw).map(d => ({ date: d.date, v: d.v / 60 })), color: "var(--green)" }],
              "min");
          });
      }
    }
  };

  // ---------- map ----------

  function mapCard(el, days) {
    const card = document.createElement("div");
    card.className = "chart-card";
    card.innerHTML =
      "<h3>Routes</h3>" +
      "<div class='map-toolbar'>" +
      "<select id='route-select' class='select'></select>" +
      "</div><div id='route-map'></div>";
    el.appendChild(card);

    const to = new Date();
    const from = new Date(to.getTime() - days * DAY);
    WA.fetchJSON("/api/v1/activities?from=" + from.toISOString() + "&to=" + to.toISOString())
      .then(function (data) {
        const acts = (data.activities || []).filter((a) => a.polyline);
        const sel = card.querySelector("#route-select");
        const mapHost = card.querySelector("#route-map");
        if (!acts.length) {
          mapHost.innerHTML = '<p class="plot-fallback">No mapped activities in range.</p>';
          return;
        }
        for (const a of acts) {
          const opt = document.createElement("option");
          opt.value = a.id;
          opt.textContent = (a.name || a.type || "Activity") + " · " +
            new Date(a.start).toLocaleDateString() + " · " + (a.distanceM / 1000).toFixed(2) + " km";
          sel.appendChild(opt);
        }
        const map = L.map(mapHost, { zoomControl: true })
          .setView([20, 0], 2);
        L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png", {
          maxZoom: 20,
          attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; OpenMapTiles'
        }).addTo(map);

        let current = null;
        function show(id) {
          const a = acts.find((x) => x.id === id);
          if (!a) return;
          if (current) map.removeLayer(current);
          const latlngs = polyline.decode(a.polyline);
          current = L.polyline(latlngs, { color: "#8aadf4", weight: 4, opacity: 0.9 }).addTo(map);
          if (latlngs.length) {
            map.fitBounds(current.getBounds(), { padding: [40, 40] });
          }
        }
        sel.addEventListener("change", (e) => show(Number(e.target.value)));
        show(Number(sel.value));
      })
      .catch(function () {
        card.querySelector("#route-map").innerHTML =
          '<p class="plot-fallback">Could not load routes.</p>';
      });
  }

  // ---------- boot ----------

  function boot() {
    const html = document.documentElement;
    const catKey = html.getAttribute("data-category");
    const cfg = CATS[catKey];
    const title = document.getElementById("category-title");
    const sub = document.getElementById("trend-sub");
    if (cfg) {
      title.textContent = cfg.label;
      sub.textContent = "Fixed queries, no magic. Pick a range.";
    }
    const stack = document.getElementById("chart-stack");
    const run = () => {
      stack.innerHTML = "";
      if (cfg) cfg.charts(stack, WA.rangeDays());
    };
    run();
    const range = document.getElementById("range");
    if (range) range.addEventListener("change", run);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();