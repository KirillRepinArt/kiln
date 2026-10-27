// @ts-check
/* Kiln · the tab bar: which view is on, the selected tab's sliding pill, switching tabs */
import { $, q } from "./dom.js";
import { lay, layMorph, sizeFrame } from "./layout.js";
import { renderLoras } from "./loras.js";
import { current } from "./jobs.js";
import { PV, browsed, picMode, pv } from "./picstate.js";
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
/** @param {() => void} fn @param {boolean} [toGen] it opens Generating or the Gallery (no panel there) */
export function tabGo(fn, toGen = false) {
  const seg = $("seg"),
    x0 = seg.getBoundingClientRect().left;
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
    flipTabs(x0);
    // no picture to show yet (a render before its first preview, the clean frame): the old picture fades where it is
    const live = S.view === "gen" && picMode() === "live",
      j = current();
    h.classList.toggle("picout", !$("frame").classList.contains("has") || (live && !!j && !j.preview_rev));
  };
  const h = document.documentElement,
    me = ++tabGos;
  h.classList.add("tabmorph");
  // leaving the panel: it fades out as a whole, its glass with it (motion.css)
  h.classList.toggle("tabout", toGen && $("rpanel").classList.contains("paneled"));
  layMorph(run);
  setTimeout(() => me === tabGos && h.classList.remove("tabmorph", "tabout", "picout"), 900); // a newer click keeps them for its switch
}
let tabGos = 0; // tab switches started so far

/* the tab bar through a tab switch (FLIP: measure, apply, invert, play): the column it sits in jumps to its new place (a
   switch lays out at once), while the bar's own offset over the picture glides — together it leapt sideways, then slid
   back (2026-10-26, the user's note). Now it's put back where it was on screen and glides from there straight to its
   new place, the selected pill sliding inside it */
/** @param {number} x0 where the bar's pill row was (screen px) */
function flipTabs(x0) {
  const tb = q(".tabs"),
    want = tb.style.transform;
  tb.style.setProperty("transition", "none", "important"); // over the switch's own glide rule (motion.css)
  const dx = Math.round(x0 - $("seg").getBoundingClientRect().left);
  if (Math.abs(dx) < 1) {
    tb.style.removeProperty("transition");
    return;
  }
  tb.style.transform = `translateX(${dx}px) ${want}`;
  void tb.offsetWidth;
  /* the same pace as the prompt column's slide in a switch (motion.css kiln-prompt): side by side, the faster one read
     as rushed (the user, 2026-10-27) */
  requestAnimationFrame(() => {
    tb.style.setProperty("transition", "transform var(--t-650) var(--lay-e)", "important");
    tb.style.transform = want;
    setTimeout(() => tb.style.removeProperty("transition"), 700);
  });
}

/* start-up wiring: the tab bar's clicks; the pill's place once the fonts have loaded (called from main.js, in order) */
export function initTabs() {
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".tab")).forEach(
    t =>
      (t.onclick = () =>
        tabGo(
          () => {
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
          },
          t.dataset.v === "gen" || t.dataset.v === "gallery",
        )),
  );
  document.fonts && document.fonts.ready.then(() => moveThumb(true));
}
