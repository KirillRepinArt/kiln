// @ts-check
/* Kiln · the tab bar: which view is on, the selected tab's sliding pill, switching tabs */
import { $ } from "./dom.js";
import { lay, sizeFrame, slideCol } from "./layout.js";
import { renderLoras } from "./loras.js";
import { PV, browsed, pv } from "./picstate.js";
import { frameBox, frameHold, frameTarget } from "./framebox.js";
import { frameMorph } from "./morph.js";
import { plateBefore, plateFollow, switchGlide } from "./plate.js";
import { placeNavs } from "./browse.js";
import { QS, queueChanged, renderQueue, renderQueueInner, setQsAnchor } from "./queue.js";
import { S } from "./state.js";

/* ======================= tabs ======================= */
/** @param {boolean} [instant] no glide (start-up, a font change) */
export function moveThumb(instant) {
  const t = /** @type {HTMLElement | null} */ (document.querySelector(".tab.on")),
    th = $("thumb");
  if (!t) return;
  if (instant) th.style.transition = "none";
  th.style.left = t.offsetLeft + "px";
  th.style.width = t.offsetWidth + "px";
  if (instant) {
    void th.offsetWidth;
    th.style.transition = "";
  }
}
/** @param {import("./types.js").Settings["view"]} v */
export function showView(v) {
  const was = S.view;
  if (was !== v) {
    // temporary state belongs to the visit: an open preview, a browse, a search, a scroll position
    if (was === "queue") {
      $("qwrap").scrollTop = 0;
      if (typeof QS !== "undefined") {
        QS.clear();
        setQsAnchor(null);
      }
    } // the prompt box (and its peek) is left as it is
    if (was === "loras") {
      /** @type {HTMLInputElement} */ ($("lsearch")).value = "";
      /** @type {HTMLElement} */ ($("lsearch").parentElement).classList.remove("has");
      $("lscroll").scrollTop = 0;
    }
  }
  S.view = v;
  $("rpanel").classList.toggle("paneled", v !== "gen");
  tabSync(true);
  document.querySelectorAll(".view").forEach(x => x.classList.toggle("on", x.id === "v-" + v));
  if (v === "queue") {
    if (was === "queue") renderQueue();
    else if (queueChanged()) renderQueueInner();
  }
  /* opening it: no slide to measure for, nothing to rebuild if nothing changed */
  if (v === "loras") renderLoras();
  sizeFrame();
  plateFollow(800);
}
/* Gallery isn't a page of its own (yet): it's the name for browsing finished pictures in the picture view — the
   state ← and the arrows already put you in. Clicking it opens the last finished picture; Generating = the live view */
/** @param {boolean} [force] */
export function tabSync(force) {
  const v = S.view === "gen" && browsed() ? "gallery" : S.view;
  if (!force && /** @type {any} */ (tabSync).v === v) return; // the tab last lit, kept on the function
  /** @type {any} */ (tabSync).v = v;
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".tab")).forEach(t =>
    t.classList.toggle("on", t.dataset.v === v),
  );
  moveThumb();
}
/* a tab switch is navigation, not a layout edit: the new tab is laid out at once and the switch moves everything from
   where it was, live (2026-10-28: no View Transition — its pictures of the page couldn't hold glass, changed what
   painted over what, and took the pointer away: a run of blinks). Generating ↔ the Gallery is one view with another
   picture: the frame crops and reveals by itself, as when browsing. Between views both stay on the page for the switch
   (plate.js switchGlide) */
/** @param {() => void} fn */
export function tabGo(fn) {
  const from = plateBefore(),
    lc0 = $("lcol").getBoundingClientRect(),
    v0 = /** @type {HTMLElement | null} */ (document.querySelector(".rpanel > .view.on")),
    r0 = v0 ? v0.getBoundingClientRect() : null,
    f0 = frameBox(),
    fr0 = $("frame").getBoundingClientRect(),
    b = document.body,
    row0 = !b.classList.contains("norow"),
    me = ++tabGos;
  b.classList.add("laysnap"); // the layout lands at once: the switch alone moves things
  document.documentElement.classList.add("tabswitch"); // a tab switch (not a layout switch): the tab pill still slides
  lay.frameDefer = true;
  try {
    fn();
  } finally {
    lay.frameDefer = false;
    if (lay.framePending) {
      lay.framePending = false;
      sizeFrame();
    }
  }
  const v1 = /** @type {HTMLElement | null} */ (document.querySelector(".rpanel > .view.on"));
  let sw;
  if (v0 && v1 && r0 && v0 !== v1) {
    if (v0.id === "v-gen" && f0) frameHold(f0); // the picture stays where it was while its view leaves
    sw = switchGlide(from, { old: v0, oldRect: r0, neu: v1 });
  } else {
    const g = frameTarget();
    sw = switchGlide(from, null);
    /* the same view: a picture of another shape crops and reveals, as when browsing (morph.js) */
    if (f0 && g && Math.abs(g.w / g.h - f0.w / f0.h) > 0.02) frameMorph({ ...f0, x: fr0.left, y: fr0.top });
    /* the status row under the picture (the render's progress) comes and goes with a short fade, like the rest of
       what sits round the picture — its room is kept either way, only its look changes (it vanished at the click) */
    const row1 = !b.classList.contains("norow");
    if (row0 !== row1)
      $("prog").animate(
        [
          { opacity: row0 ? 1 : 0, visibility: "visible" },
          { opacity: row0 ? 0 : 1, visibility: "visible" },
        ],
        { duration: 150 },
      );
  }
  placeNavs();
  slideCol(lc0, sw.t0); // the column slides from where it was, as the real thing (FLIP)
  /* once it has landed: one more layout, still without glides (measured mid-switch, the prompt column's Vertical shift
     rested a pixel off), then the layout's glides come back */
  setTimeout(() => {
    if (me !== tabGos) return;
    sizeFrame();
    b.classList.remove("laysnap");
    document.documentElement.classList.remove("tabswitch");
  }, sw.T + 300);
}
let tabGos = 0; // tab switches started so far

/* start-up wiring: the tab bar's clicks; the pill's place once the fonts have loaded (called from main.js, in order) */
export function initTabs() {
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".tab")).forEach(
    t =>
      (t.onclick = () =>
        tabGo(() => {
          const v = /** @type {import("./types.js").Settings["view"]} */ (t.dataset.v); // index.html's data-v
          PV.from = null;
          if (v === "gallery") {
            if (S.view !== "gen") showView("gen");
            if (!browsed()) pv("gallery");
            tabSync();
            return;
          }
          if (v === "gen") pv("generating"); /* the live view: the render, or the clean frame */
          showView(v);
        })),
  );
  document.fonts && document.fonts.ready.then(() => moveThumb(true));
}
