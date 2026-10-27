// @ts-check
/* Kiln · stepping through finished pictures: the arrows, ← / →, and the status line while browsing */
import { $, hit } from "./dom.js";
import { doneList } from "./jobs.js";
import { lay } from "./layout.js";
import { frameBox, frameTarget } from "./framebox.js";
import { frameMorph } from "./morph.js";
import { PV, browsed, onShow, picMode, pv } from "./picstate.js";
import { S } from "./state.js";
import { tabGo } from "./tabs.js";
import { V, openViewer } from "./viewer.js";

/** a step through the pictures in Generating / the Gallery @param {number} dir -1 / 1 @param {boolean} [dry] only ask
 * whether there is one */
export function genNav(dir, dry) {
  const m = picMode(),
    cur = onShow(),
    L = doneList();
  let i = cur ? L.findIndex(x => x.id === cur.id) : L.length;
  if (i < 0) i = L.length;
  const n = i + dir; /* the render / the empty frame sit after the newest */
  if (n < 0) return false;
  if (n >= L.length && m !== "browse" && m !== "still")
    return false; /* past the newest: out of the Gallery, or off the finished picture — to the render / the empty frame */
  if (!dry && n < L.length && (m === "live" || m === "empty")) {
    /* from the render or the empty frame into the Gallery: a change of view, like its tab — the render fades where it
       is and the picture comes in as the plate lands. A crop-and-reveal is for stepping between finished pictures: run
       from the render it cropped the preview (without its veil) into the new shape — "a zoomed pic first", the user's
       note 2026-10-28. One rule: a picture travels only when it's the same picture */
    if (toGallery) return true; // a repeat (a held key) before the switch has applied: it would start from the old state
    toGallery = true;
    PV.dir = dir;
    tabGo(() => {
      toGallery = false;
      pv("browse", L[n]);
    });
    return true;
  }
  if (!dry) {
    const b = frameBox() || { l: 0, t: 0, w: 0, h: 0 },
      sr = $("frame").getBoundingClientRect(),
      o = {
        ...b,
        x: sr.left, // on screen, before anything moves (morph.js)
        y: sr.top,
      };
    PV.dir = dir;
    if (n >= L.length) pv("close", "arrow");
    else pv("browse", L[n]);
    const g = frameTarget();
    if (n < L.length && S.view === "gen" && g && Math.abs(g.w / g.h - o.w / o.h) > 0.02) frameMorph(o);
  }
  return true;
}
let toGallery = false; // an arrow's switch into the Gallery has begun and not applied yet
/** the same in the full-size viewer @param {number} dir -1 / 1 @param {boolean} [dry] */
export function vNav(dir, dry) {
  const L = doneList(),
    i = L.findIndex(x => x.id === (V.job && V.job.id)),
    t = L[i + dir];
  if (i < 0 || !t) return false;
  if (!dry) openViewer(t);
  return true;
}
/** @param {Element} el an arrow: the viewer's or the picture's */
export function navFn(el) {
  return el.closest("#viewer") ? vNav : genNav;
}
export function updNav() {
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".nav")).forEach(b =>
    b.classList.toggle("off", !navFn(b)(+(/** @type {string} */ (b.dataset.nav)), true)),
  );
} /* the render's prompt: click the render itself (the status line doubled it) */
/* the Gallery with the prompt closed (it stays closed as you browse): a pill under the picture brings it back */
export function browseStatus() {
  const on = S.view === "gen" && !!browsed() && PV.promptClosed;
  $("showP").classList.toggle("show", on);
}

/* start-up wiring: the on-picture arrows (held under the pointer while you click them), ← / → (called from main.js, in order) */
export function initBrowse() {
  /* the picture's arrows live on a fixed layer: while they show they follow the picture's side edges every frame (it
   glides), but while you're clicking through with them they hold their place on SCREEN (Photos / Lightroom: navigation
   never runs away from the pointer); ~1 s after the last click they glide to the new picture's edges */
  (function () {
    const [pv, nx] = /** @type {NodeListOf<HTMLElement & { _t?: number }>} */ (document.querySelectorAll(".gnav"));
    /* the arrow you clicked stays exactly where it is for as long as your pointer is on it (click as fast as you like);
    move off it and it slides to the picture's edge. The other one follows the picture at once. Keys don't hold anything */
    for (const el of [pv, nx])
      el.addEventListener("pointerleave", () => {
        if (lay.navHold === el) {
          lay.navHold = null;
          el.classList.add("glide");
          clearTimeout(el._t);
          el._t = setTimeout(() => el.classList.remove("glide"), 460);
        }
      });
    function tick() {
      if (document.body.classList.contains("navs")) {
        const r = $("frame").getBoundingClientRect(),
          y = Math.round(r.top + r.height / 2 - 20) + "px";
        for (const [el, x] of /** @type {[HTMLElement, string][]} */ ([
          [pv, Math.round(r.left + 10) + "px"],
          [nx, Math.round(r.right - 50) + "px"],
        ]))
          if (el !== lay.navHold && (el.style.left !== x || el.style.top !== y)) {
            el.style.left = x;
            el.style.top = y;
          }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
  document.addEventListener(
    "click",
    e => {
      const b = hit(e, ".nav");
      if (!b) return;
      e.stopPropagation();
      if (b.classList.contains("gnav")) lay.navHold = b;
      navFn(b)(+(/** @type {string} */ (b.dataset.nav)));
      updNav();
    },
    true,
  );
  document.addEventListener("keydown", e => {
    if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const a = /** @type {HTMLElement | null} */ (document.activeElement);
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    if ($("modal").classList.contains("show")) return;
    const f = $("viewer").classList.contains("show") ? vNav : S.view === "gen" ? genNav : null;
    if (f && f(e.key === "ArrowLeft" ? -1 : 1)) {
      e.preventDefault();
      updNav();
    }
  });
}

/** @param {import("./types.js").Job} j */
export function browseTo(j) {
  PV.promptClosed = false;
  pv("browse", j);
}
