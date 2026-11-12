// @ts-check
/* Kiln · settings, themes */
import { toast } from "./boot.js";
import { layoutLeft } from "./cardlayout.js";
import { $, hit, qa, target, targetField } from "./dom.js";
import { current } from "./jobs.js";
import { resetLayout, setDock, sizeFrame } from "./layout.js";
import { renderPills } from "./pills.js";
import { plateSync } from "./plate.js";
import { extraKey, harmonics, skinExtra, skinName } from "./skins.js";
import { S, save } from "./state.js";
import { goView, moveThumb } from "./tabs.js";

/* ======================= settings / themes ======================= */
/* a skin's colours live in its token file (app/styles/themes/): switching sets data-skin on <html>, then the harmonic
   colours are worked out from the theme colour the stylesheet now gives */
export function applyTheme() {
  const root = document.documentElement;
  root.dataset.skin = skinName(S.theme);
  const hm = harmonics(getComputedStyle(root).getPropertyValue("--a1").trim());
  window.HARM = hm;
  for (const k in hm) root.style.setProperty("--" + k, /** @type {Record<string, string>} */ (hm)[k]);
  window._themeV = (window._themeV || 0) + 1;
  applyFont();
  showExtra();
}
/* the theme's signature effect, if it has one: its switch in Settings (named after it, its value this theme's own) */
function showExtra() {
  const x = skinExtra(),
    sel = /** @type {HTMLSelectElement | null} */ (document.getElementById("sExtra")),
    lb = document.getElementById("lExtra");
  if (!sel || !lb) return;
  sel.hidden = lb.hidden = !x;
  if (!x) return;
  lb.textContent = x.name;
  sel.value = /** @type {Record<string, any>} */ (S.set || {})[extraKey(skinName(S.theme))] === "on" ? "on" : "off";
}
/* "Theme font" (the default until you pick one) follows the skin: Emerald = IBM Plex Mono, its name in Courier Prime */
export function applyFont() {
  S.set = S.set || {};
  if (!S.set.fontPicked) S.set.font = "theme";
  const cs = getComputedStyle(document.documentElement),
    skinFont = cs.getPropertyValue("--skin-font").trim(),
    skinTitle = cs.getPropertyValue("--skin-title").trim(),
    th = S.set.font === "theme",
    f = th ? skinFont || "Geist" : S.set.font,
    rs = document.documentElement.style;
  rs.setProperty("--font", `"${f}"`);
  if (th && skinTitle) rs.setProperty("--font-title", `"${skinTitle}"`);
  else rs.removeProperty("--font-title");
  const sel = /** @type {HTMLSelectElement | null} */ (document.getElementById("sFont"));
  if (sel) sel.value = S.set.font;
  requestAnimationFrame(() => moveThumb(true));
}
/* Steps live in Settings → Model; the pill on the prompt box is a switch (set once with a turbo LoRA and never
   changed, it only took room). Off by default */
export function applyStepsPill() {
  $("pST").hidden = (S.set || {}).stepsPill !== "on";
  layoutLeft();
}
export function applyGlass() {
  document.body.classList.toggle("glass", (S.set || {}).glass === "on");
}

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
/** a Settings row is a <label> and then its control (or a box holding it): the label names that control — for the rows in
 *  index.html and those added later (live.js: the upscaler's) */
export function labelRows() {
  let n = 0;
  for (const lb of qa(".fg > label")) {
    const next = lb.nextElementSibling,
      c = /** @type {HTMLElement | null} */ (
        next && (next.matches("input,select,textarea") ? next : next.querySelector("input,select,textarea"))
      );
    if (!c) continue;
    c.id ||= "set-" + (c.dataset.set || ++n);
    /** @type {HTMLLabelElement} */ (lb).htmlFor = c.id;
  }
}
export function initSettings() {
  labelRows();
  $("sExtra").onchange = e => {
    S.set = S.set || {};
    /** @type {Record<string, any>} */ (S.set)[extraKey(skinName(S.theme))] = targetField(e).value;
    save();
  };
  S.theme = skinName(S.theme); // a saved skin from before the cleanup → the nearest one
  /** @type {HTMLSelectElement} */ ($("sTheme")).value = S.theme;
  $("sTheme").onchange = e => {
    S.theme = targetField(e).value;
    applyTheme();
    save();
    window._cpv = Date.now() + 6000;
    if (!current()) {
      const p = $("prog");
      window._dp = 1;
      p.classList.add("show");
      sizeFrame();
      $("fill").style.width = "62%";
      $("ptxt").textContent = "Theme preview";
      $("peta").textContent = "";
      clearTimeout(window._dpt);
      window._dpt = setTimeout(() => {
        window._dp = 0;
      }, 2500);
    }
  };
  $("rLayout").onclick = () => {
    resetLayout();
    goView("gen");
    $("modal").classList.remove("show");
    toast("Layout reset", "", null, $("layBtn")); // under the Layout button (M1)
  };
  /* the Layout button by the gear: a small menu (docking joins it in Phase 2a step 2) */
  (function () {
    const b = $("layBtn"),
      m = $("layMenu");
    b.onclick = e => {
      e.stopPropagation();
      m.classList.toggle("show");
    };
    document.addEventListener("click", e => {
      if (!hit(e, "#layMenu")) m.classList.remove("show");
    });
    m.addEventListener("click", e => {
      const a = hit(e, "[data-lay]");
      if (!a) return;
      m.classList.remove("show");
      if (a.dataset.lay === "reset") {
        resetLayout();
        toast("Sizes reset — the default widths, centred", "", null, $("layBtn"));
      } else setDock(/** @type {"left" | "right" | "below"} */ (a.dataset.lay)); // index.html's data-lay
    });
    window.layMenuUI = () =>
      /** @type {NodeListOf<HTMLElement>} */ (m.querySelectorAll("[data-lay]")).forEach(o =>
        o.classList.toggle("on", o.dataset.lay === (S.dock || "left")),
      );
    window.layMenuUI();
    b.addEventListener("click", window.layMenuUI);
  })();
  $("rAll").onclick = () => {
    if (!confirm("Reset everything? Prompt, name, settings, favourites, thumbnails and layout go back to defaults."))
      return;
    try {
      localStorage.clear();
    } catch (e) {}
    location.reload();
  };
  S.set = S.set || {};
  /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll("[data-set]")).forEach(el => {
    const k = /** @type {string} */ (el.dataset.set);
    if (/** @type {Record<string, any>} */ (S.set)[k] != null) el.value = /** @type {Record<string, any>} */ (S.set)[k];
    else /** @type {Record<string, any>} */ (S.set)[k] = el.value;
    el.addEventListener("change", () => {
      /** @type {Record<string, any>} */ (S.set)[k] = el.value;
      save();
      if (k === "font") {
        /** @type {Record<string, any>} */ (S.set).fontPicked = 1;
        save();
        applyFont();
      }
      if (k === "glass") applyGlass();
      if (k === "stepsPill") applyStepsPill();
    });
  });
  applyStepsPill();
  /* what changes after start-up without a writer telling the plate: the fonts (the tab bar's width) — the standard hook
     (it had a 1.5 s frame loop, plate.js plateFollow) */
  document.fonts.ready.then(plateSync);
  const sSteps = /** @type {HTMLInputElement} */ ($("sSteps"));
  sSteps.value = String(S.steps);
  sSteps.onchange = () => {
    S.steps = Math.max(1, Math.min(150, Math.round(+sSteps.value) || S.steps));
    sSteps.value = String(S.steps);
    save();
    renderPills();
  };
  $("updBtn").onclick = () => toast("The update check needs the Kiln server (kiln.bat)");
  $("keysBtn").onclick = () => /** @type {() => void} */ (window.openKeys)();
  $("gear").onclick = () => {
    sSteps.value = String(S.steps); // the pill, a reused job may have changed them
    $("modal").classList.add("show");
  };
  $("mClose").onclick = () => $("modal").classList.remove("show");
  $("modal").onclick = e => {
    if (target(e).id === "modal") $("modal").classList.remove("show");
  };
}
