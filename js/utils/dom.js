/* ==========================================================================
   DOM HELPERS — tiny hyperscript, no framework
   ========================================================================== */

export function h(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) applyAttrs(node, attrs);
  append(node, children);
  return node;
}

export function s(tag, attrs, children) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      node.setAttribute(k, v);
    }
  }
  if (children) {
    for (const c of [].concat(children)) {
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
  }
  return node;
}

function applyAttrs(node, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k === "style") node.style.cssText = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "value") node.value = v;
    else if (k === "checked") node.checked = !!v;
    else if (k === "disabled") node.disabled = !!v;
    else node.setAttribute(k, v);
  }
}

function append(node, children) {
  if (children === null || children === undefined || children === false) return;
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false || c === "") continue;
    node.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(root, event, sel, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(sel);
    if (target && root.contains(target)) handler(e, target);
  });
}
