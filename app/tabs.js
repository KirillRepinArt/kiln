// @ts-check
/* Kiln · the tab bar: which view is on, the selected tab's sliding pill, switching tabs */
import { $ } from "./dom.js";
import { lay, layMorph, morphReady, sizeFrame } from "./layout.js";
import { renderLoras } from "./loras.js";
import { current } from "./jobs.js";
import { PV, browsed, onShow, picMode, pv } from "./picstate.js";
import { plateBefore, plateFollow, plateMorph } from "./plate.js";
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
/* a tab switch is navigation, not a layout edit: the new tab is laid out at once (no glide — on a GPU busy with Forge,
   0.4 s of glass re-blurring the sky per frame was the lag, 2026-10-19), and the layout is measured once per click */
/** @param {() => void} fn */
export function tabGo(fn) {
  const from = plateBefore(),
    lc0 = $("lcol").getBoundingClientRect(),
    pic0 = picKey();
  const run = () => {
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
    const lc1 = $("lcol").getBoundingClientRect();
    morphReady().then(() => {
      plateMorph(from);
      slideLcol(lc0, lc1);
    });
    /* the picture travels across a switch only when it's the SAME picture on both sides; otherwise (the Gallery's
       picture and the render, or no picture yet) the old one fades where it is and the new one fades in — it grew into
       the other's box, a zoom of the wrong picture (2026-10-27, the user) */
    const pic1 = picKey();
    h.classList.toggle("picout", !$("frame").classList.contains("has") || !pic0 || pic0 !== pic1);
  };
  const h = document.documentElement,
    me = ++tabGos;
  h.classList.add("tabmorph");
  layMorph(run);
  setTimeout(() => me === tabGos && h.classList.remove("tabmorph", "picout"), 900); // a newer click keeps them for its switch
}
let tabGos = 0; // tab switches started so far

/* which picture the picture area shows: a finished one (by id) or the render's preview — null when there's none */
function picKey() {
  if (S.view !== "gen") return null;
  const d = onShow();
  if (d) return "done:" + d.id;
  const j = current();
  return picMode() === "live" && j && j.preview_rev ? "render:" + j.id : null;
}

/* live plate: the prompt column slides from where it was as the real thing (FLIP), its glass live — a snapshot of it
   went clear like the panel's */
/** @param {DOMRect} r0 where the column was @param {DOMRect} r1 where the switch put it */
function slideLcol(r0, r1) {
  const lc = $("lcol"),
    dx = Math.round(r0.left - r1.left),
    dy = Math.round(r0.top - r1.top);
  if (!dx && !dy) return;
  const base = getComputedStyle(lc).transform,
    rest = base === "none" ? "" : base;
  lc.animate([{ transform: `translate(${dx}px, ${dy}px) ${rest}` }, { transform: rest || "none" }], {
    duration: 650,
    easing: "cubic-bezier(0.05, 0.7, 0.1, 1)",
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
