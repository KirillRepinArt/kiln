// @ts-check
/* Kiln · helpers and start-up */
import { applyMode, applyPH } from "./cardlayout.js";
import { renderChips } from "./chips.js";
import { $, targetField } from "./dom.js";
import { jobs } from "./jobs.js";
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
/** @param {string} [at] a tab (data-v): the message goes under it */
function toastPlace(at) {
  const el = $("toast").style;
  if (at) {
    const r = /** @type {Element} */ (document.querySelector(`.tab[data-v="${at}"]`)).getBoundingClientRect();
    Object.assign(el, {
      left: Math.round(r.left + r.width / 2) + "px",
      right: "auto",
      top: Math.round(r.bottom + 10) + "px",
      bottom: "auto",
      transform: "translateX(-50%)",
    });
    return;
  }
  if (document.querySelector(".app.stacked")) {
    Object.assign(el, { left: "auto", right: "24px", top: "24px", bottom: "auto", transform: "none" });
    return;
  }
  const L = $("left").getBoundingClientRect(),
    T = $("ltitle").getBoundingClientRect(),
    C = $("chips").getBoundingClientRect(),
    low = Math.max(L.bottom, C.height ? C.bottom : 0);
  Object.assign(el, { left: Math.round(L.left + L.width / 2) + "px", right: "auto", transform: "translateX(-50%)" });
  if (T.top - 18 >= innerHeight - low - 18) Object.assign(el, { top: "24px", bottom: "auto" });
  else Object.assign(el, { top: "auto", bottom: "24px" });
}
/** @type {number | undefined} */
let tt;
/** a message; with btn + fn, a button (Undo …); at = under that tab
 * @param {string} m @param {string} [btn] @param {(() => void) | null} [fn] @param {string} [at] */
export function toast(m, btn, fn, at) {
  $("toastMsg").textContent = m;
  toastPlace(at);
  const b = $("toastBtn");
  b.textContent = btn || "";
  b.onclick = () => {
    fn && fn();
    $("toast").classList.remove("show");
  };
  $("toast").classList.add("show");
  clearTimeout(tt);
  tt = setTimeout(() => $("toast").classList.remove("show"), btn ? 5000 : 2200);
}
export function syncH() {
  document.documentElement.style.setProperty("--rightH", $("right").getBoundingClientRect().height + "px");
}
export function renderAll() {
  const n = jobs.filter(j => j.status === "pending" || j.status === "running").length;
  $("badge").textContent = /** @type {any} */ (n); // the number, as text
  $("badge").classList.toggle("show", n > 0);
  $("tabN").textContent = /** @type {any} */ (n || "");
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
  $("left").classList.add("nodur");
  setTimeout(() => $("left").classList.remove("nodur"), 400);
  applyFont();
  applyGlass();
  applyPH();
  updPrompt();
  applyTheme();
  S.view = "gen";
  showView("gen");
  renderAll();
  syncH();
}
