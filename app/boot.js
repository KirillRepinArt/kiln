// @ts-check
/* Kiln · helpers and start-up */
import { applyMode, applyPH } from "./cardlayout.js";
import { renderChips } from "./chips.js";
import { $, targetField } from "./dom.js";
import { jobs, unseenFails } from "./jobs.js";
import { renderLoras } from "./loras.js";
import { saveJobName, updPrompt } from "./peek.js";
import { renderPills } from "./pills.js";
import { nameUI, peekJob } from "./prompt.js";
import { renderQueue } from "./queue.js";
import { applyFont, applyGlass, applyTheme } from "./settings.js";
import { P, S, save } from "./state.js";
import { moveThumb, showView } from "./tabs.js";

/* ======================= misc ======================= */
/** seconds → "m:ss" ("1h 5m" past an hour) @param {number} s */
export function fmt(s) {
  s = Math.round(s);
  const m = Math.floor(s / 60),
    r = s % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(r).padStart(2, "0")}`;
}
/** text made safe to put in HTML @param {unknown} s */
export function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    c => /** @type {Record<string, string>} */ ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}
/** ONE placer for messages — ARCHITECTURE › where a message shows. It writes their left / top and nothing else (each
 * message centres itself on that point in its own CSS). With an anchor (a tab, the Layout button): centred under it,
 * 10 px below. Without one, side by side: centred on the prompt box, at the window's top or bottom, whichever is farther
 * from it; in Vertical the window's top-right corner (a named exception, the user's choice) @param {HTMLElement} el
 * @param {Element | null} [anchor] */
export function placeMessage(el, anchor) {
  const s = el.style,
    EDGE = 24;
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    s.left = Math.round(r.left + r.width / 2) + "px";
    s.top = Math.round(r.bottom + 10) + "px";
    return;
  }
  if (document.querySelector(".app.stacked")) {
    s.left = Math.round(innerWidth - EDGE - el.offsetWidth / 2) + "px";
    s.top = EDGE + "px";
    return;
  }
  const L = $("left").getBoundingClientRect(),
    T = $("ltitle").getBoundingClientRect(),
    C = $("chips").getBoundingClientRect(),
    low = Math.max(L.bottom, C.height ? C.bottom : 0);
  s.left = Math.round(L.left + L.width / 2) + "px";
  s.top = (T.top >= innerHeight - low ? EDGE : Math.round(innerHeight - EDGE - el.offsetHeight)) + "px";
}
/** @type {number | undefined} */
let tt;
/** a message; with btn + fn, a button (Undo …); at = under that tab (its data-v) or that element
 * @param {string} m @param {string} [btn] @param {(() => void) | null} [fn] @param {string | Element} [at] */
export function toast(m, btn, fn, at) {
  const b = $("toastBtn");
  $("toastMsg").textContent = m;
  b.textContent = btn || ""; // before it's placed: its width counts
  placeMessage($("toast"), typeof at === "string" ? document.querySelector(`.tab[data-v="${at}"]`) : at);
  b.onclick = () => {
    fn && fn();
    $("toast").classList.remove("show");
  };
  $("toast").classList.add("show");
  clearTimeout(tt);
  tt = setTimeout(() => $("toast").classList.remove("show"), btn ? 5000 : 2200);
}
/** Start's badge and the Queue tab's numbers — their one writer: the jobs waiting, and the failures you haven't seen
 * yet (on the Queue page you see them: the count clears) */
export function renderCounts() {
  const n = jobs.filter(j => j.status === "pending" || j.status === "running").length;
  let f = unseenFails(S.failSeenAt || 0);
  if (f && S.view === "queue") {
    S.failSeenAt = Date.now();
    save();
    f = 0;
  }
  $("badge").textContent = /** @type {any} */ (n); // the number, as text
  $("badge").classList.toggle("show", n > 0);
  $("tabN").textContent = /** @type {any} */ (n || "");
  $("tabF").textContent = f ? `${f} failed` : "";
}
export function renderAll() {
  renderCounts();
  requestAnimationFrame(() => moveThumb(true));
  renderPills();
  renderChips();
  if (S.view === "queue") renderQueue();
  if (S.view === "loras") renderLoras();
}

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initBoot() {
  /** @type {HTMLInputElement} */ ($("pname")).value = S.pname || "";
  $("pname").addEventListener("input", e => {
    if (peekJob) {
      $("pnSave").classList.toggle("show", targetField(e).value.trim() !== (peekJob.name || "").trim());
      return;
    } /* a waiting job's name: saved with its button */
    S.pname = targetField(e).value;
    save();
    nameUI();
  });
  $("pnx").onclick = () => {
    /** @type {HTMLInputElement} */ ($("pname")).value = "";
    S.pname = "";
    save();
    nameUI();
    $("pname").focus();
  };
  $("pname").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (peekJob && $("pnSave").classList.contains("show")) {
        saveJobName();
        return;
      }
      P.focus();
    }
  });
  if (matchMedia("(prefers-reduced-motion: reduce)").matches)
    document.querySelector("#playFlow animateTransform")?.remove();
  applyMode();
  applyFont();
  applyGlass();
  applyPH();
  updPrompt();
  applyTheme();
  S.view = "gen";
  showView("gen");
  renderAll();
}
