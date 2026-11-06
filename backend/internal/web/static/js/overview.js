(function () {
  "use strict";

  const DAY = 86400000;

  function fetchSeries(type, days, transform) {
    const to = new Date();
    const from = new Date(to.getTime() - (days || 30) * DAY);
    return WA.fetchJSON(
      "/api/v1/metrics?metricType=" + type +
      "&from=" + from.toISOString() + "&to=" + to.toISOString()
    ).then((d) => WA.metricSeries(d, transform));
  }

  function setCard(card, value, unit) {
    const v = WA.format(value);
    card.querySelector(".stat-value").textContent = v;
    if (unit) card.querySelector(".stat-unit").textContent = unit;
    card.dataset.value = value;
  }

  function spark(sel, series, color) {
    const svg = document.querySelector(sel);
    if (!svg) return;
    WA.sparkline(svg, series.map((p) => p.v), color);
  }

  async function loadOverview() {
    const grid = document.getElementById("card-grid");
    const hero = document.getElementById("hero-sub");

    const sleepCar = document.querySelector('[data-card="sleep"]');
    const sleep = await fetchSeries("sleep", 30, (v) => v / 3600);
    const sleepNow = sleep.filter((p) => WA.isToday(p.t));
    const lastNight = sleep.length ? sleep[sleep.length - 1] : null;

    const stepsPoints = await fetchSeries("steps", 30);
    const todaySteps = stepsPoints
      .filter((p) => WA.isToday(p.t))
      .reduce((a, p) => a + p.v, 0);

    const calories = await fetchSeries("calories", 30);
    const todayCal = calories
      .filter((p) => WA.isToday(p.t))
      .reduce((a, p) => a + p.v, 0);

    const load = await fetchSeries("workout_cardio", 7, (v) => v / 1000);
    const strain = load.reduce((a, p) => a + p.v, 0);

    const mood = await fetchSeries("mood", 30);
    const moodNow = mood.length ? mood[mood.length - 1] : null;

    const weight = await fetchSeries("body_weight", 30);
    const latestW = weight.length ? weight[weight.length - 1] : null;

    setCard(document.querySelector('[data-card="calories"]'), todayCal, todayCal > 0 ? "kcal today" : "no entry");
    setCard(sleepCar, lastNight ? lastNight.v : 0, lastNight ? "last night" : "no data");
    setCard(document.querySelector('[data-card="steps"]'), todaySteps, "steps today");
    setCard(document.querySelector('[data-card="strain"]'), strain, strain > 0 ? "7-day km" : "7-day load");
    setCard(document.querySelector('[data-card="mood"]'), moodNow ? moodNow.v : 0, moodNow ? "latest" : "no data");
    setCard(document.querySelector('[data-card="weight"]'), latestW ? latestW.v : 0, latestW ? "kg" : "no data");

    spark('.stat-card[data-card="calories"] .stat-spark', WA.daily(calories), WA.color("accent-nutrition"));
    spark('.stat-card[data-card="sleep"] .stat-spark', WA.daily(sleep, "avg"), WA.color("accent-recovery"));
    spark('.stat-card[data-card="steps"] .stat-spark', WA.daily(stepsPoints), WA.color("accent-recovery"));
    spark('.stat-card[data-card="strain"] .stat-spark', WA.daily(load), WA.color("accent-cardio"));
    spark('.stat-card[data-card="mood"] .stat-spark', WA.daily(mood, "avg"), WA.color("accent-mental"));
    spark('.stat-card[data-card="weight"] .stat-spark', WA.daily(weight, "avg"), WA.color("accent-flexibility"));

    if (hero) {
      const d = new Date();
      hero.textContent = d.toLocaleDateString(undefined, {
        weekday: "long", month: "long", day: "numeric"
      }) + " · " + (todayCal ? WA.format(todayCal) + " kcal" : "no intake logged") +
        " · " + WA.format(todaySteps) + " steps";
    }

    grid.removeAttribute("aria-busy");
    grid.querySelectorAll(".stat-value").forEach((el) => {
      if (el.textContent === "—") el.textContent = "0";
    });

    await loadLastWorkout();
  }

  async function loadLastWorkout() {
    const box = document.getElementById("last-workout");
    if (!box) return;
    try {
      const data = await WA.fetchJSON("/api/v1/activities?limit=1");
      const acts = data.activities || [];
      if (!acts.length) {
        box.innerHTML = '<p class="empty">No workouts recorded yet.</p>';
        return;
      }
      const a = acts[0];
      const start = new Date(a.start);
      const h = (a.distanceM / 1000).toFixed(2);
      box.innerHTML =
        '<div class="last-workout-row">' +
        '<span><strong>' + escapeHtml(a.name || a.type || "Workout") + '</strong></span>' +
        '<span class="muted">' + escapeHtml(a.type || "") + ' · ' +
        start.toLocaleDateString() + " " + start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
        '</span>' +
        '<span class="muted">' + h + " km · " +
        Math.round(a.movingSec / 60) + " min</span>" +
        '<span><a href="/trends/cardio">Full trend →</a></span>' +
        '</div>';
    } catch (e) {
      box.innerHTML = '<p class="empty">Could not load workouts.</p>';
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  document.addEventListener("DOMContentLoaded", loadOverview);
})();