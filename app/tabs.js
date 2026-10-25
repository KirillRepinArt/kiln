/* Kiln · the tab bar: which view is on, the selected tab's sliding pill, switching tabs */
import { $ } from "./dom.js";
import { lay, layMorph, sizeFrame } from "./layout.js";
import { renderLoras } from "./loras.js";
import { browsed } from "./picstate.js";
import { QS, queueSig, renderQueue, renderQueueInner, setQsAnchor } from "./queue.js";
import { S } from "./state.js";

/* ======================= tabs ======================= */
export function moveThumb(instant) {
  const t = document.querySelector(".tab.on"),
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
      $("lsearch").value = "";
      $("lsearch").parentElement.classList.remove("has");
      $("lscroll").scrollTop = 0;
    }
  }
  S.view = v;
  $("rpanel").classList.toggle("paneled", v !== "gen");
  tabSync(true);
  document.querySelectorAll(".view").forEach(x => x.classList.toggle("on", x.id === "v-" + v));
  if (v === "queue") {
    if (was === "queue") renderQueue();
    else if (renderQueueInner.sig !== queueSig()) renderQueueInner();
  }
  /* opening it: no slide to measure for, nothing to rebuild if nothing changed */
  if (v === "loras") renderLoras();
  sizeFrame();
}
/* Gallery isn't a page of its own (yet): it's the name for browsing finished pictures in the picture view — the
   state ← and the arrows already put you in. Clicking it opens the last finished picture; Generating = the live view */
export function tabSync(force) {
  const v = S.view === "gen" && browsed() ? "gallery" : S.view;
  if (!force && tabSync.v === v) return;
  tabSync.v = v;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.v === v));
  moveThumb();
}
/* a tab switch is navigation, not a layout edit: the new tab is laid out at once (no glide — on a GPU busy with Forge,
   0.4 s of glass re-blurring the sky per frame was the lag, 2026-10-19), and the layout is measured once per click */
export function tabGo(fn) {
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
  };
  document.documentElement.classList.add("tabmorph");
  layMorph(run);
  setTimeout(() => document.documentElement.classList.remove("tabmorph"), 900);
}
