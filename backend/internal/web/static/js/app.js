(function () {
  "use strict";

  window.WA = {};

  WA.fetchJSON = async function (url, opts) {
    const resp = await fetch(url, opts);
    if (!resp.ok) throw new Error(url + " -> " + resp.status);
    return resp.json();
  };

  WA.format = function (v, digits) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    const d = digits === undefined ? 0 : digits;
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: d });
  };

  WA.localDayStart = function (ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  WA.localDayEnd = function (ms) {
    return WA.localDayStart(ms) + 86400000 - 1;
  };
  WA.isToday = function (ms) {
    const now = Date.now();
    return ms >= WA.localDayStart(now) && ms <= WA.localDayEnd(now);
  };

  // Render a tiny sparkline into an <svg>.
  WA.sparkline = function (svg, data, color) {
    const W = svg.viewBox.baseVal.width || 320;
    const H = svg.viewBox.baseVal.height || 40;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";
    if (!data || data.length < 2) {
      const t = document.createElementNS(svgns, "text");
      t.setAttribute("x", W / 2);
      t.setAttribute("y", H / 2);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("fill", "var(--overlay0)");
      t.setAttribute("font-size", "11");
      t.textContent = "no data";
      svg.appendChild(t);
      return;
    }
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * (W - 4) + 2;
      const y = H - 3 - ((v - min) / range) * (H - 8);
      return x + "," + y;
    }).join(" ");
    const poly = document.createElementNS(svgns, "polyline");
    poly.setAttribute("points", pts);
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", color || "var(--accent-default)");
    poly.setAttribute("stroke-width", "2");
    poly.setAttribute("stroke-linejoin", "round");
    poly.setAttribute("stroke-linecap", "round");
    svg.appendChild(poly);
  };
  const svgns = "http://www.w3.org/2000/svg";

  // Flatten metrics response into {t, v} pairs.
  WA.metricSeries = function (data, transform) {
    if (!data || !data.metrics) return [];
    return data.metrics
      .filter((m) => m.value !== null && m.value !== undefined)
      .map((m) => ({ t: m.startMs, v: transform ? transform(m.value) : m.value }));
  };

  // Aggregate a metric into per-day totals/averages over local days.
  WA.daily = function (series, mode) {
    const re = WA.localDayStart;
    const buckets = new Map();
    for (const pt of series) {
      const day = re(pt.t);
      if (!buckets.has(day)) buckets.set(day, []);
      buckets.get(day).push(pt.v);
    }
    const out = [];
    for (const [day, vals] of buckets) {
      const sum = vals.reduce((a, b) => a + b, 0);
      const v = mode === "avg" ? sum / vals.length : sum;
      out.push({ date: new Date(day), v });
    }
    out.sort((a, b) => a.date - b.date);
    return out;
  };

  WA.color = function (name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue("--" + name).trim();
  };

  WA.rangeDays = function () {
    const el = document.getElementById("range");
    return el ? parseInt(el.value, 10) : 90;
  };

  WA.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  // Sync-health strip refresh.
  WA.refreshSync = async function () {
    try {
      const data = await WA.fetchJSON("/api/v1/source-health");
      const dots = document.getElementById("sync-dots");
      const meta = document.getElementById("sync-meta");
      const ok = [];
      const bad = [];
      if (dots) {
        dots.innerHTML = "";
        for (const s of data.sources) {
          const dot = document.createElement("span");
          dot.className = "sync-dot status-" + safeStatus(s.tokenStatus);
          dot.title = s.source + ": " + s.tokenStatus +
            (s.lastSuccess ? " · last sync " + new Date(s.lastSuccess).toLocaleString() : "") +
            (s.lastError ? " · " + s.lastError : "");
          dots.appendChild(dot);
          if (s.tokenStatus === "ok") ok.push(s.source);
          else bad.push(s.source + ":" + s.tokenStatus);
        }
      }
      if (meta) {
        meta.textContent = ok.length ? ok.join(", ") + " OK" : "";
        if (bad.length) meta.textContent += (meta.textContent ? " · " : "") + bad.join(", ");
      }
    } catch (e) {
      // silent; badge just stays stale
    }
  };

  function safeStatus(s) {
    return ["ok", "expired", "error", "missing", "revoked", "unconfigured", "unknown"].indexOf(s) >= 0 ? s : "unknown";
  }

  document.addEventListener("DOMContentLoaded", function () {
    WA.refreshSync();
    setInterval(WA.refreshSync, 60000);

    const clock = document.getElementById("clock");
    if (clock) {
      const tick = () => {
        clock.textContent = new Date().toLocaleString();
      };
      tick();
      setInterval(tick, 30000);
    }
  });
})();