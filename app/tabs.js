// @ts-check
/* Kiln · the tab bar: which view is on, the selected tab's sliding pill, switching tabs */
import { $ } from "./dom.js";
import { boxStart, fadeCol, lay, sizeFrame, slideCol, snapHold } from "./layout.js";
import { renderLoras } from "./loras.js";
import { PV, browsed, pv } from "./picstate.js";
import { frameBox, frameHold, pictureChange } from "./framebox.js";
import { plateBefore, plateFollow, switchGlide } from "./plate.js";
import { placeNavs } from "./browse.js";
import { QS, queueChanged, renderQueue, renderQueueInner, setQsAnchor } from "./queue.js";
import { S } from "./state.js";
import { layoutLeft } from "./cardlayout.js";

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
/** @param {() => void} fn the switch itself @param {boolean} [layout] a layout switch (Left / Right / Vertical, T2b):
 * the same view rides the plate to its new place, the prompt box fades through — the tab switch's system, not a View
 * Transition (docs/decisions/0014) */
export function tabGo(fn, layout = false) {
  const from = plateBefore(),
    lc0 = $("lcol").getBoundingClientRect(),
    box0 = $("left").getBoundingClientRect(), // the box itself (its place in the column changes in a layout switch)
    start0 = layout ? boxStart() : null, // its start values: it fades out as it was (a layout switch)
    v0 = /** @type {HTMLElement | null} */ (document.querySelector(".rpanel > .view.on")),
    r0 = v0 ? v0.getBoundingClientRect() : null,
    f0 = frameBox(),
    fr0 = $("frame").getBoundingClientRect(),
    me = ++tabGos;
  snapHold("tab", 10000); // the layout lands at once: the switch alone moves things (let go at its end, below)
  if (!layout) document.documentElement.classList.add("tabswitch"); // a tab switch: the tab pill still slides
  /* a switch within Generating's view changes the frame's box: the frame's owner crops and reveals it (G11) — a switch
     to another view gives it up (frameHold) */
  /* the picture's view: a box of another shape or size crops and reveals — in a layout switch too (T2b: the same picture
     at another size never pops; its old copy crosses to it) */
  if (S.view === "gen" && f0) pictureChange({ ...f0, x: fr0.left, y: fr0.top });
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
  /* a layout switch: the layout settled before anything is measured — the box placed (layoutLeft), then the layout
     again: in Vertical the page's room ends above the box's name, so a room measured before the box moved was stale
     (the switch aimed the plate at 401 px and jumped to 641 at its end; the box's offset pointed 300 px off) */
  if (layout)
    for (let i = 0; i < 3; i++) {
      /* to its fixed point: in Vertical the box's place feeds the page's room and the room the box (two rounds do it;
         a third only confirms) — one round left a 13 px nudge a frame into the switch */
      const was = $("lcol").style.cssText + $("frame").style.cssText + $("rpanel").style.cssText;
      layoutLeft();
      sizeFrame();
      if ($("lcol").style.cssText + $("frame").style.cssText + $("rpanel").style.cssText === was) break;
    }
  const v1 = /** @type {HTMLElement | null} */ (document.querySelector(".rpanel > .view.on"));
  let sw;
  if (layout && v0 && v1 && r0 && v0 === v1)
    sw =
      v0.id === "v-gen"
        ? switchGlide(from, null, true) // the picture: the frame's own crop-and-reveal, the plate riding it
        : switchGlide(from, { old: v0, oldRect: r0, neu: v1 }, true); // a panel: its contents ride the plate
  else if (v0 && v1 && r0 && v0 !== v1) {
    if (v0.id === "v-gen" && f0) frameHold(f0); // the picture stays where it was while its view leaves
    sw = switchGlide(from, { old: v0, oldRect: r0, neu: v1 });
  } else {
    sw = switchGlide(from, null);
    /* the same view: a box of another shape or size crops and reveals (declared above; framebox.js decides) — the
       render and the Gallery keep different room (their insets). The status row's fade is the layout's (rowFade) */
  }
  placeNavs();
  if (layout)
    fadeCol(box0, /** @type {Record<string, string>} */ (start0), sw); // out as it was, in where it lands (Q-T1)
  else slideCol(lc0, sw.t0); // the column slides from where it was, as the real thing (FLIP)
  /* once it has landed: one more layout, still without glides (measured mid-switch, the prompt column's Vertical shift
     rested a pixel off), then the layout's glides come back */
  setTimeout(() => {
    if (me !== tabGos) return; // a newer tab switch holds it now
    sizeFrame();
    snapHold("tab", 0);
    document.documentElement.classList.remove("tabswitch");
  }, sw.T + 300);
}
let tabGos = 0; // tab switches started so far
/** go to a page — THE way a page switch happens (2026-11-02, the user: the Add LoRA button jumped "all over the place"):
 * a tab, the Add LoRA button and a LoRA chip, a Queue row, PNG Info's load, Reset layout, ✕ back to where you came
 * from — all on the tab switch's one motion (tabGo). `then` runs on the new page, inside the switch.
 * @param {import("./types.js").Settings["view"]} v @param {() => void} [then] */
export function goView(v, then) {
  tabGo(() => {
    showView(v);
    if (then) then();
  });
}

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
