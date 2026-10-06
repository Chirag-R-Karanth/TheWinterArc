/* ==========================================================================
   ICONS — one geometric language: 24px grid, 1.6 stroke, round caps
   ========================================================================== */

const P = {
  overview: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  activity: '<path d="M3 12.5h3.8L9.5 5l4 14 2.4-6.5H21"/>',
  recovery: '<path d="M12 20.2S4.5 15.5 4.5 10.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7.5 2.3c0 5.2-7.5 9.9-7.5 9.9z"/><path d="M8 12h2l1.2-2.2L13 14l1.2-2H17"/>',
  sleep: '<path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.6 8.6 0 1 0 11.3 11.3z"/><path d="M15.5 4.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>',
  nutrition: '<path d="M6 3v6a2.2 2.2 0 0 0 4.4 0V3M8.2 9.2V21"/><path d="M17.4 3c-1.6 0-2.8 2-2.8 5.4s1.2 4.6 2.8 4.6V21"/>',
  body: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M12 8.5v3.2l2.4 1.6"/><path d="M7.5 8h1.2M16.5 8h-1.2"/>',
  mind: '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 13.6c.9-1.9 1.9-1.9 2.8 0s1.9 1.9 2.8 0"/>',
  trends: '<path d="M3 17.5l5.4-5.6 3.6 3.4L21 6.5"/><path d="M15 6h6v6"/>',
  settings: '<circle cx="12" cy="12" r="3.1"/><path d="M18.9 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.5 1.5 0 0 0-1.4.9z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
  moon: '<path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.6 8.6 0 1 0 11.3 11.3z"/>',
  chevronL: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  chevronR: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  chevronD: '<path d="M5.5 9L12 15.5 18.5 9"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M18 13l-6 6-6-6"/>',
  arrowRight: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  flame: '<path d="M12 3c3 3.8 6 5.4 6 9.4A6 6 0 0 1 6 12.4C6 9 8 7.2 9 5.2c.6 2 1.6 3 3 3.5C11.4 6.4 12 4.6 12 3z"/>',
  steps: '<path d="M7.2 20.5c-1.5 0-2.6-1-2.6-2.6 0-1.7 1.1-2.9 1.5-5.2.4-2.3.6-4.4 2.2-4.4s2 1.6 2 4-.6 5.8-1 7.4-.6 3.4-2.1 3.4z"/><path d="M16.8 19.6c-1.3 0-2.1-.8-2.1-2.1 0-1.4.8-2.6 1.2-5 .4-2.4.4-4.4 1.9-4.4s1.9 1.5 1.9 4-.6 5.3-1 6.8-.7 4.7-1.9 4.7z"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.2l3.4 2"/>',
  drop: '<path d="M12 3.2s6.2 6.6 6.2 10.6a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.2 12 3.2z"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v4.5h-4.5"/>',
  link: '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.3 1.3"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.3-1.3"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>',
  database: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  zap: '<path d="M13 2.5L4.8 13.4h6L10 21.5l8.7-11.4h-6.2z"/>',
  run: '<circle cx="15.2" cy="4.6" r="2.1"/><path d="M12.6 21.5l1.7-5.9-3.2-2.7.7-4.7 3.7 2.2 3.3 1.4"/><path d="M4.5 12.6l3.2-2.9 2.7.6"/>',
  strength: '<path d="M4 9.2v5.6M7.2 6.8v10.4M16.8 6.8v10.4M20 9.2v5.6M7.2 12h9.6"/>',
  cycle: '<circle cx="5.6" cy="16.8" r="3.4"/><circle cx="18.4" cy="16.8" r="3.4"/><path d="M12 16.8l-2.7-6.4H7.1M12 16.8l3-6.4h2.4M9.4 10.4l4.4 6.4M14.4 5.6h2.8l1.6 4.8"/>',
  swim: '<path d="M3 18.4c1.8 0 1.8 1.6 3.6 1.6s1.8-1.6 3.6-1.6 1.8 1.6 3.6 1.6 1.8-1.6 3.6-1.6 1.8 1.6 3.6 1.6"/><path d="M6.5 14.2l3.4-3.6 2.7 1.9 3-3.4 3.4 2.3"/><circle cx="16.6" cy="5.4" r="1.7"/>',
  walk: '<circle cx="13.2" cy="4.6" r="2.1"/><path d="M11.4 21.5l1.6-6.3-2.7-3 1-4.5 3.4 2.4 2.8 1"/><path d="M8.7 12.4l-1.9 3.3"/>',
  yoga: '<circle cx="12" cy="4.6" r="2.1"/><path d="M12 7.4v5.4M12 12.8l-4.4 5.6M12 12.8l4.4 5.6M6.8 9.6h10.4"/>',
  hiit: '<path d="M12.6 2.8L5.4 12.9h5.3L9.4 21.2l7.9-10.7h-5.5z"/>',
  scale: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M12 8.5v3.2l2.4 1.6"/>',
  heart: '<path d="M12 20.2S4.5 15.5 4.5 10.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7.5 2.3c0 5.2-7.5 9.9-7.5 9.9z"/>',
  bolt: '<path d="M13 2.5L4.8 13.4h6L10 21.5l8.7-11.4h-6.2z"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1"/>',
  eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5.5-2 7-2 7h16s-2-1.5-2-7z"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>',
  ruler: '<rect x="2.5" y="8" width="19" height="8" rx="2.5"/><path d="M7 8v3M11 8v4.5M15 8v3M19 8v4.5"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2M12 7.8h.01"/>',
  inbox: '<path d="M3.5 13h4l1.6 2.6h5.8L16.5 13h4"/><path d="M4.7 5.6l-1.2 7.4v4a2.5 2.5 0 0 0 2.5 2.5h12a2.5 2.5 0 0 0 2.5-2.5v-4l-1.2-7.4A2.5 2.5 0 0 0 16.7 4H7.3a2.5 2.5 0 0 0-2.6 1.6z"/>',
};

/** build an <svg> element for an icon name */
export function icon(name, attrs = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", attrs.strokeWidth || 1.6);
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  if (attrs.class) svg.setAttribute("class", attrs.class);
  svg.innerHTML = P[name] || P.info;
  return svg;
}

export function iconHTML(name, attrs = {}) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${
    attrs.strokeWidth || 1.6
  }" stroke-linecap="round" stroke-linejoin="round" class="${attrs.class || ""}">${
    P[name] || P.info
  }</svg>`;
}

export const BRAND_MARK = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18.5L9.4 6.5l3.5 6 2.2-3.4L21 18.5z"/><path d="M7.4 14.6h9.2"/></svg>`;

export const hasIcon = (name) => !!P[name];
