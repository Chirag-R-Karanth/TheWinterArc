(function () {
  "use strict";

  const DAY = 86400000;

  function xSel() { return document.getElementById("x-metric").value; }
  function ySel() { return document.getElementById("y-metric").value; }

  function plotText() { return "var(--subtext1)"; }

  function renderCorrelation(body) {
    const box = document.getElementById("corr-charts");
    box.innerHTML = "";
    if (!body || !body.result) {
      box.innerHTML = '<p class="empty">No precomputed correlations yet — pick two metrics and compute.</p>';
      return;
    }
    const res = body.result;
    const points = res.points || [];
    const card = document.createElement("div");
    card.className = "chart-card";
    const rText = isFinite(res.r) ? res.r.toFixed(3) : "n/a";
    const n = res.n || 0;
    card.innerHTML = "<h3>Pearson r = " + rText + " · n = " + n + "</h3><div class='chart'></div>";
    const chart = card.querySelector(".chart");

    const domain = points.length ? [Math.min(...points.map(p => p.x)), Math.max(...points.map(p => p.x))] : [0, 1];
    const slope = (res.slope || 0) * (domain[1] - domain[0]);
    const inter = res.intercept || 0;
    const lineData = [
      { x: domain[0], y: inter + (res.slope || 0) * domain[0] },
      { x: domain[1], y: inter + (res.slope || 0) * domain[1] }
    ];

    chart.append(Plot.plot({
      width: 900, height: 320, marginLeft: 50, marginBottom: 40,
      style: { background: "transparent", color: plotText(), fontFamily: "inherit" },
      x: { grid: true, label: xSel() },
      y: { grid: true, label: ySel() },
      marks: [
        Plot.dot(points, { x: "x", y: "y", r: 3, fill: "var(--lavender)", fillOpacity: 0.8 }),
        Plot.line(lineData, { x: "x", y: "y", stroke: "var(--mauve)", strokeWidth: 2.5 })
      ]
    }));
    box.appendChild(card);
  }

  async function runCompute() {
    const status = document.getElementById("corr-status");
    status.className = "corr-status";
    status.textContent = "Contacting R analysis service…";
    const btn = document.getElementById("compute-btn");
    btn.disabled = true;
    try {
      const resp = await fetch("/api/v1/correlations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xMetric: xSel(), yMetric: ySel() })
      });
      const body = await resp.json();
      if (!resp.ok) {
        status.className = "corr-status error";
        status.textContent = (body.hint || body.error || "compute failed") + " — falling back to last good results.";
        renderCorrelation({ result: null });
        return;
      }
      status.className = "corr-status";
      status.textContent = "r = " + body.r.toFixed(3) + " on " + body.n + " points.",
      renderCorrelation({ result: body });
    } catch (e) {
      status.className = "corr-status error";
      status.textContent = "Analysis service unreachable. Dashboard keeps working without it.";
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("compute-btn").addEventListener("click", runCompute);
    runCompute();
  });
})();