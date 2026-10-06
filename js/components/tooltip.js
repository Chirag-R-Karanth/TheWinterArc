/* ==========================================================================
   TOOLTIP — one shared floating surface for charts & hints
   ========================================================================== */

let tip = null;

function ensure() {
  if (tip) return tip;
  tip = document.createElement("div");
  tip.className = "wa-tip";
  document.body.appendChild(tip);
  return tip;
}

/**
 * rows: [{ label, value, color }]
 */
export function showTip({ x, y, title, rows }) {
  const el = ensure();
  const titleHTML = title ? `<div class="wa-tip__title">${title}</div>` : "";
  const rowsHTML = (rows || [])
    .filter(Boolean)
    .map(
      (r) => `<div class="wa-tip__row"><span>${
        r.color ? `<i style="--dot:${r.color}"></i>` : ""
      }${r.label}</span><b>${r.value}</b></div>`
    )
    .join("");
  el.innerHTML = titleHTML + rowsHTML;
  el.classList.add("is-on");
  position(el, x, y);
}

function position(el, x, y) {
  const pad = 14;
  const r = el.getBoundingClientRect();
  let left = x + pad;
  let top = y - r.height / 2;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - pad;
  if (left < 8) left = 8;
  top = Math.max(8, Math.min(window.innerHeight - r.height - 8, top));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

export function hideTip() {
  if (tip) tip.classList.remove("is-on");
}

export function tipVisible() {
  return !!tip && tip.classList.contains("is-on");
}
