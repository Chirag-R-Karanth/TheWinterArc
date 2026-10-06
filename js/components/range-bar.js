/* ==========================================================================
   RANGE BAR — period switch + date navigator, bound to the store
   ========================================================================== */

import { h } from "../utils/dom.js";
import { periodSwitch, dateControl } from "./controls.js";
import { actions } from "../state/store.js";
import { iso, today } from "../utils/dates.js";

export function rangeBar(state) {
  const atToday = state.rangeEnd >= iso(today());
  return h("div", { class: "page-head__actions" }, [
    periodSwitch({ value: state.period, onChange: actions.setPeriod }),
    dateControl({
      endISO: state.rangeEnd,
      period: state.period,
      onShift: actions.shiftRange,
      canNext: !atToday,
    }),
  ]);
}