/* ==========================================================================
   ANIMATION — small, intentional, physics-free
   ========================================================================== */

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

export function tween(duration, onFrame, ease = easeOutCubic) {
  const start = performance.now();
  let raf;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    onFrame(ease(t), t);
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** animate a numeric text node to a formatted target */
export function countUp(el, to, format = (v) => Math.round(v), duration = 900, from = 0) {
  if (!el) return;
  if (Number.isNaN(to) || to === null || to === undefined) {
    el.textContent = "—";
    return;
  }
  if (prefersReducedMotion()) {
    el.textContent = format(to);
    return;
  }
  const cancel = tween(duration, (e) => {
    el.textContent = format(from + (to - from) * e);
  }, easeOutQuint);
  el.addEventListener("animationend", cancel, { once: true });
  return cancel;
}

export function prefersReducedMotion() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    document.body.classList.contains("reduce-motion")
  );
}

/** animate a stroke-dashoffset ring from 0 → pct */
export function animateRing(circle, pct, radius) {
  const c = 2 * Math.PI * radius;
  circle.style.strokeDasharray = `${c}`;
  if (prefersReducedMotion()) {
    circle.style.strokeDashoffset = `${c * (1 - pct)}`;
    return;
  }
  circle.style.transition = "none";
  circle.style.strokeDashoffset = `${c}`;
  requestAnimationFrame(() => {
    circle.style.transition = "stroke-dashoffset 1.1s cubic-bezier(0.22,0.61,0.36,1)";
    circle.style.strokeDashoffset = `${c * (1 - Math.max(0, Math.min(1, pct)))}`;
  });
}
