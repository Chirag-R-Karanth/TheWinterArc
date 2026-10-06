/* ==========================================================================
   SIDEBAR — persistent dark navigation rail
   ========================================================================== */

import { h } from "../utils/dom.js";
import { icon, BRAND_MARK } from "./icons.js";
import { subscribe, actions } from "../state/store.js";

export const NAV = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "recovery", label: "Recovery", icon: "recovery" },
  { id: "sleep", label: "Sleep", icon: "sleep" },
  { id: "nutrition", label: "Nutrition", icon: "nutrition" },
  { id: "body", label: "Body", icon: "body" },
  { id: "mind", label: "Mind", icon: "mind" },
  { id: "trends", label: "Trends", icon: "trends" },
];

export function mountSidebar(host) {
  const nav = h("nav", { class: "nav" });

  const items = NAV.map((item) =>
    h("a", {
      class: "nav__item",
      href: `#/${item.id}`,
      dataset: { page: item.id },
      title: item.label,
    }, [icon(item.icon), h("span", { text: item.label })])
  );
  items.forEach((i) => nav.appendChild(i));

  nav.appendChild(h("div", { class: "nav__divider" }));
  nav.appendChild(h("div", { class: "nav__footer" }, [
    h("a", {
      class: "nav__item",
      href: "#/settings",
      dataset: { page: "settings" },
      title: "Settings",
    }, [icon("settings"), h("span", { text: "Settings" })]),
  ]));

  host.appendChild(
    h("div", { class: "brand" }, [
      h("span", { class: "brand__mark", html: BRAND_MARK }),
      h("span", { class: "brand__name", html: "Winter<span>Arc</span>" }),
    ])
  );
  host.appendChild(nav);

  const sync = (page) => {
    host.querySelectorAll(".nav__item").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.page === page);
    });
  };

  host.addEventListener("click", (e) => {
    const a = e.target.closest(".nav__item");
    if (a) actions.setPage(a.dataset.page);
  });

  sync(window.__wa_initial || "overview");
  const unsub = subscribe((state) => sync(state.page));
  return unsub;
}
