// @ts-check
/* Kiln · stepping through finished pictures: the arrows, ← / →, and the status line while browsing */
import { $, hit } from "./dom.js";
import { doneList } from "./jobs.js";
import { lay } from "./layout.js";
import { moving, rearrange } from "./rearrange.js";
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
       is and the picture comes in as the plate lands. One rule: a picture crops and reveals only between finished
       pictures (from the render it cropped the preview into the new shape) */
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
    /* the picture changes: its owner (pv) declares it, the frame's owner picks the motion (G11) — out of the Gallery
       past the newest it's the same crop-and-reveal as its tab's */
    PV.dir = dir;
    if (n >= L.length) pv("close", "arrow");
    else pv("browse", L[n]);
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
}
/* the Gallery with the prompt closed (it stays closed as you browse): a pill under the picture brings it back */
export function browseStatus() {
  $("showP").classList.toggle("show", showPromptOn());
}
/** Show prompt is on: the Gallery with the prompt closed — ONE predicate for its being shown and for its room under the
 * picture (layout.js insets: the slot's occupant, A1) */
export const showPromptOn = () => S.view === "gen" && !!browsed() && PV.promptClosed;

/* start-up wiring: the on-picture arrows (held under the pointer while you click them), ← / → (called from main.js, in order) */
export function initBrowse() {
  /* the picture's arrows live on a fixed layer: they follow the picture's side edges (around.js placeAround places them
   with everything round the picture, in the frame the frame is written), but while you're clicking through with them
   they hold their place on SCREEN (Photos / Lightroom: navigation never runs away from the pointer) */
  (function () {
    /* the arrow you clicked stays exactly where it is for as long as your pointer is on it (click as fast as you like);
    move off it and it slides to the picture's edge. The other one follows the picture at once. Keys don't hold anything */
    /* …until the pointer really leaves it: a switch covers the page with its layers, which Chrome reports as the pointer
       leaving whatever it was over — so the hold ends on a real move off the arrow, never during a switch */
    /* let go: it catches up with the picture's edge on the driver (rearrange.js — one plan and clock with whatever else
       moves; a new goal meanwhile bends it) */
    /** @param {HTMLElement} el */
    const letGo = el => {
      lay.navHold = null;
      placeNavs(el);
    };
    document.addEventListener(
      "pointermove",
      e => {
        const el = /** @type {HTMLElement | null} */ (lay.navHold);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) letGo(el);
      },
      { passive: true },
    );
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

/* the picture's arrows on its side edges (the one you hold stays where it is): every frame, and at once for a switch's
   capture (tabs.js) */
/** @param {HTMLElement} [caught] the arrow just let go of: it catches up on the driver (the other is placed at once) */
export function placeNavs(caught) {
  /* always, shown or not: they come in where the picture is, never from where they last were */
  const [pv, nx] = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".gnav")),
    r = $("frame").getBoundingClientRect(),
    y = Math.round(r.top + r.height / 2 - 20);
  for (const [el, x, key] of /** @type {[HTMLElement, number, string][]} */ ([
    [pv, Math.round(r.left + 10), "navL"],
    [nx, Math.round(r.right - 50), "navR"],
  ])) {
    if (el === lay.navHold) continue;
    const write = (/** @type {{ l: number, t: number }} */ b) => {
        el.style.left = Math.round(b.l) + "px";
        el.style.top = Math.round(b.t) + "px";
      },
      to = { l: x, t: y, w: 0, h: 0 },
      placed = el.style.left !== "",
      at = { l: parseFloat(el.style.left), t: parseFloat(el.style.top), w: 0, h: 0 };
    if (placed && (el === caught || moving(key)))
      rearrange(key, at, to, write); // catching up (or bent to a new goal)
    else if (!placed || at.l !== x || at.t !== y) write(to);
  }
}

/** @param {import("./types.js").Job} j */
export function browseTo(j) {
  PV.promptClosed = false;
  pv("browse", j);
}
