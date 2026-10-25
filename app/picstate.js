/* Kiln · what the picture area shows: one state, one place that changes it (ux-review/11-picture-states.md)
   Generating shows LIVE (the render under its cover), a STILL (a finished picture: the result that just landed, or a
   reference you brought there yourself) or EMPTY; the Gallery is BROWSE(k). Rules, in order:
   1. the Gallery tab opens on the picture you're looking at; the Generating tab is the live view (the render, or the
      clean frame when idle — revised 2026-10-24, the user's call); an arrow always changes the picture
   2. a result gives way to the render only once the render has a picture of its own (its first preview)
   3. a reference stays until you let it go (✕, Start, an arrow) — a running render never pushes it away
   4. ✕ on a picture = the clean area: the render if a job runs, else the empty frame (← brings the picture back)
   5. Generating's prompt box holds your draft; the Gallery's the picture's prompt (a peek). Nothing overwrites your
      draft but Reuse (with Undo)
   The prompt box's peek (peekJob, loadJob / peekHide in queue.js) is the second half: the Gallery's picture, or on
   demand the render's / a waiting job's prompt. */
import { toast } from "./boot.js";
import { updNav } from "./browse.js";
import { $ } from "./dom.js";
import { current, doneById, doneList, lastDone } from "./jobs.js";
import { sizeFrame } from "./layout.js";
import { loadJob, peekHide, peekJob } from "./peek.js";
import { preload, xfadeSnap } from "./pictures.js";
import { S } from "./state.js";
import { showView, tabSync } from "./tabs.js";

/** @type {import("./types.js").PictureView} */
export const PV = {
  browse: null,
  still: null,
  promptClosed: false,
  news: null,
  yielded: null,
  dir: 1,
  from: null,
}; /* from: the tab a picture was opened from — ✕ goes back there */ /* dir: the way you last stepped (← -1, → +1) */ /* still: {id, kind:"result"|"reference"}; news: a result that landed while you held a reference (Q1); yielded: the result that gave way to the render — it comes back if the render stops without a picture */
export function browsed() {
  return doneById(PV.browse);
}
function stillJob() {
  return PV.still ? doneById(PV.still.id) : null;
}
/* the finished picture on show (the Gallery's, or Generating's still) */
export function onShow() {
  return browsed() || stillJob();
}
export function shownDone() {
  return onShow();
}
export function picMode() {
  return browsed() ? "browse" : stillJob() ? "still" : current() ? "live" : "empty";
}
/* a picture that shows clean at once (no cover easing off it): one you browse to, or a reference */
export function shownClean() {
  return PV.browse != null || !!(PV.still && PV.still.kind === "reference");
}
/* after the job list changes: a picture that's gone (deleted, cleared from the list) lets go */
export function pvPrune() {
  if (!window._jobsReady) return;
  let ch = false;
  if (PV.browse != null && !browsed()) {
    PV.browse = null;
    PV.promptClosed = false;
    ch = true;
  }
  if (PV.still && !stillJob()) {
    PV.still = null;
    ch = true;
  }
  if (PV.news != null && !doneById(PV.news)) PV.news = null;
  if (PV.yielded != null && PV.browse == null && !PV.still && !current()) {
    const y = doneById(PV.yielded);
    PV.yielded = null;
    if (y) {
      PV.still = { id: y.id, kind: "result" };
      ch = true;
    }
  } /* stopped, failed: the picture before it, not an empty frame */
  if (ch) {
    if (typeof peekJob !== "undefined" && peekJob && peekJob.status === "done" && !doneById(peekJob.id)) peekHide();
    resetCv();
    sizeFrame();
  }
  pvSync();
}
function resetCv() {
  const c = $("cv");
  c.dataset.d = "";
  c.dataset.j = "";
}
/* the picture fades out over what comes next (live.js: a snapshot on #cvx) */
function snapOut() {
  if (S.view === "gen" && $("frame").classList.contains("has")) xfadeSnap();
}
/* into the Gallery at k: the prompt box peeks its prompt (unless you closed the prompt while browsing) */
function browseSet(j) {
  if (!j) return;
  if (PV.browse !== j.id) snapOut();
  PV.browse = j.id;
  PV.still = null;
  PV.news = null;
  resetCv();
  sizeFrame();
  if (!PV.promptClosed) loadJob(j);
  else if (peekJob) peekHide();
  {
    const L = doneList(),
      i = L.findIndex(x => x.id === j.id);
    for (const q of [L[i - 1], L[i + 1]]) if (q) preload(q); // the neighbours, decoded ahead
  }
  updNav();
}
/* out of the Gallery: the prompt box gets your draft back */
function browseEnd() {
  PV.browse = null;
  PV.promptClosed = false;
  if (peekJob) peekHide();
}
export function pv(ev, arg) {
  const run = current();
  switch (ev) {
    case "done" /* a job finished: Generating shows it — unless you're in the Gallery or hold a reference */:
      if (PV.browse != null) break;
      if (PV.still && PV.still.kind === "reference") {
        PV.news = arg.id;
        break;
      }
      PV.still = { id: arg.id, kind: "result" };
      PV.yielded = null;
      setJustDone(arg.id);
      break;
    case "preview" /* the render has a picture of its own: a result gives way to it (cross-fade) */:
      if (PV.browse == null && PV.still && PV.still.kind === "result") {
        snapOut();
        PV.yielded = PV.still.id;
        PV.still = null;
        resetCv();
      }
      break;
    case "close" /* ✕ on the picture, Esc outside the editor */:
      if (run) snapOut(); /* a fade only when the render replaces it — into the empty frame the picture just goes */
      if (PV.browse != null) browseEnd();
      PV.still = null;
      PV.news = null;
      PV.yielded = null;
      resetCv();
      {
        const back = PV.from;
        PV.from = null;
        if (back && arg !== "arrow" && back !== "gen") showView(back);
      }
      break;
    case "toRender" /* the status row while a picture stands in front of a running render (Q3) */:
      if (run && PV.still) {
        snapOut();
        PV.still = null;
        PV.news = null;
        resetCv();
      }
      break;
    case "start" /* Start: what you held gives way to the render once it has a picture (rule 2) */:
      if (PV.browse != null) {
        PV.still = { id: PV.browse, kind: "result" };
        browseEnd();
      } else if (PV.still) PV.still.kind = "result";
      PV.news = null;
      break;
    case "shape" /* size or ratio changed: a result clears (the empty frame previews the new shape); a reference stays (Q2) */:
      if (PV.browse == null && PV.still && PV.still.kind === "result" && !run) {
        PV.still = null;
        resetCv();
        $("frame").classList.remove("has");
      }
      break;
    case "gallery" /* the Gallery tab: the picture on show, else the newest (rule 1) */:
      {
        const k = onShow() || lastDone();
        if (!k) {
          toast("No finished pictures yet");
          break;
        }
        browseSet(k);
      }
      break;
    case "generating" /* the Generating tab: the live view — what's being made, or the clean frame (rule 1) */:
      if (PV.browse != null) {
        if (run) snapOut();
        browseEnd();
        PV.still = null;
        PV.news = null;
        PV.yielded = null;
        resetCv();
      } else if (run && PV.still) {
        snapOut();
        PV.still = null;
        PV.news = null;
        resetCv();
      }
      break;
    case "browse":
      browseSet(arg);
      break; /* a finished queue row, a neighbour after a delete */
    case "reuse" /* Reuse from the Gallery: Generating, with the picture as your reference */:
      if (PV.browse != null) {
        PV.still = { id: PV.browse, kind: "reference" };
        PV.browse = null;
        PV.promptClosed = false;
      }
      break;
    case "promptClose" /* the prompt's ✕ in the Gallery: your draft, the picture stays; the arrows keep it closed */:
      if (PV.browse != null) PV.promptClosed = true;
      break;
    case "peekRender" /* the render's prompt (a click on it, its queue row): Generating, live */:
      if (PV.browse != null) browseEnd();
      if (PV.still) {
        snapOut();
        PV.still = null;
        resetCv();
      }
      if (run) loadJob(run);
      break;
    case "deleted" /* the picture on show went to the Recycle Bin: the Gallery lands on a neighbour; a still clears */:
      {
        const j = arg.job,
          nb = arg.next;
        if (PV.browse === j.id) {
          if (nb) browseSet(nb);
          else browseEnd();
        }
        if (PV.still && PV.still.id === j.id) {
          PV.still = null;
          resetCv();
        }
        if (PV.news === j.id) PV.news = null;
      }
      break;
  }
  pvSync();
  tabSync();
  if (ev !== "done" && ev !== "preview") sizeFrame();
}
/* what the CSS and the rest of the page read: body[data-pic] / [data-still], and the frame's affordances */
export function pvSync() {
  const m = picMode(),
    b = document.body,
    f = $("frame"),
    s = PV.still ? PV.still.kind : "";
  if (b.dataset.pic !== m) b.dataset.pic = m;
  if (b.dataset.still !== s) b.dataset.still = s;
  f.classList.toggle("browsing", m === "browse");
  f.classList.toggle("clearable", m === "still");
  f.classList.toggle("clickable", m === "browse" || m === "still");
  $("bclose").dataset.tip =
    m === "browse"
      ? current()
        ? "Back to the render (Esc)"
        : "Close the image (Esc) — ← brings it back"
      : current()
        ? "Close — show the render (Esc)"
        : "Close the image (Esc) — ← brings it back";
}

export var justDone = null;
export function setJustDone(id) {
  justDone = id;
}
