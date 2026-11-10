// @ts-check
/* Kiln · what the picture area shows: one state, one place that changes it (ux-review/11-picture-states.md)
   Generating shows LIVE (the render under its cover), a STILL (a finished picture: the result that just landed, or a
   reference you brought there yourself) or EMPTY; the Gallery is BROWSE(k). Rules, in order:
   1. the Gallery tab opens on the picture you're looking at; the Generating tab is the live view (the render, or the
      clean frame when idle — revised 2026-10-24, the user's call); an arrow always changes the picture
   2. a result gives way to the render only once the render has a picture of its own (its first preview)
   3. a reference stays until you let it go (✕, Start, an arrow) — a running render never pushes it away
   4. ✕ on a picture = the clean area: the render if a job runs, else the empty frame (← brings the picture back)
   5. Generating's prompt box holds your draft; the Gallery's the picture's prompt (a peek). Nothing overwrites your
      draft but Edit (with Undo)
   The prompt box's peek (peekJob, loadJob / peekHide in queue.js) is the second half: the Gallery's picture, or on
   demand the render's / a waiting job's prompt. */
import { toast } from "./boot.js";
import { updNav } from "./browse.js";
import { $ } from "./dom.js";
import { current, doneById, doneList, lastDone } from "./jobs.js";
import { lay, sizeFrame } from "./layout.js";
import { frameBox, pictureChange } from "./framebox.js";
import { loadJob, peekHide } from "./peek.js";
import { preload, xfadeSnap } from "./pictures.js";
import { peekJob } from "./prompt.js";
import { S } from "./state.js";
import { goView, tabSync } from "./tabs.js";

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
/* — always, by the one fade, also when nothing comes after it (✕, the Generating tab with no render): it used to just
   go then, the one picture change that didn't fade (the user, 2026-10-31: "a fade would be more consistent") */
function snapOut() {
  if (S.view === "gen" && $("frame").classList.contains("has")) xfadeSnap(!!current());
}
/* into the Gallery at k: the prompt box peeks its prompt (unless you closed the prompt while browsing) */
/** @param {import("./types.js").Job | null | undefined} j */
function browseSet(j) {
  if (!j) return;
  if (PV.browse !== j.id) snapOut();
  PV.browse = j.id;
  PV.still = null;
  PV.news = null;
  resetCv();
  /* no layout here: pv lays out once at its end, after the picture change is declared (G11) — laid out here first,
     the frame glided before its owner knew the picture was changing (a shape change stopped cropping and revealing) */
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
/**
 * Something happened that may change what the picture area shows (the table: ux-review/11-picture-states.md).
 * @typedef {"done" | "preview" | "close" | "toRender" | "start" | "shape" | "gallery" | "generating" | "browse" |
 *   "reuse" | "promptClose" | "peekRender" | "deleted"} PictureEvent
 * @param {PictureEvent} ev
 * @param {any} [arg] what it carries: the job ("done", "browse"), "arrow" ("close"), { job, next } ("deleted")
 */
export function pv(ev, arg) {
  const run = current(),
    /* where the picture is before the change: if what's on show changes, the frame's owner picks the motion (G11). A
       tab switch declares its own (tabs.js tabGo); a render's own events don't lay out */
    b0 = ev !== "done" && ev !== "preview" && S.view === "gen" && !lay.frameDefer ? frameBox() : null,
    r0 = b0 ? $("frame").getBoundingClientRect() : null,
    was = onShow(),
    /* one layout per change, at its end (lay.frameDefer — the same as a tab switch's click): the prompt loading in the
       middle laid the frame out early, before the picture change was declared (G11) */
    outer = lay.frameDefer;
  lay.frameDefer = true;
  try {
    pvApply(ev, arg, run);
  } finally {
    lay.frameDefer = outer;
  }
  pvSync();
  tabSync();
  if (b0 && r0 && (onShow()?.id ?? null) !== (was?.id ?? null)) pictureChange({ ...b0, x: r0.left, y: r0.top });
  if (ev !== "done" && ev !== "preview") {
    lay.framePending = false;
    sizeFrame();
  } else if (!outer && lay.framePending) {
    lay.framePending = false;
    sizeFrame();
  }
}
/** the change itself (pv's table) @param {PictureEvent} ev @param {any} arg @param {any} run the running job */
function pvApply(ev, arg, run) {
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
      snapOut();
      if (PV.browse != null) browseEnd();
      PV.still = null;
      PV.news = null;
      PV.yielded = null;
      resetCv();
      {
        const back = PV.from;
        PV.from = null;
        if (back && arg !== "arrow" && back !== "gen") goView(back); // back where you came from: the switch's motion
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
    case "shape" /* size or ratio changed: the picture on show stays — you're often editing from it; the pill shows the
      new shape, the empty frame previews it once the picture goes (✕, an arrow, Start). Revised 2026-10-27, the user's
      call: a result clearing as you typed was a surprise every time */:
      break;
    case "gallery" /* the Gallery tab: the picture on show, else the newest (rule 1) */:
      {
        const k = onShow() || lastDone();
        if (!k) {
          toast("No finished pictures yet", "", null, "gallery");
          break;
        }
        browseSet(k);
      }
      break;
    case "generating" /* the Generating tab: the live view — what's being made, or the clean frame (rule 1) */:
      if (PV.browse != null) {
        snapOut();
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
    case "reuse" /* Edit from the Gallery: Generating, with the picture as your reference */:
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

/** @type {number | null} */
export var justDone = null;
/** @param {number | null} id */
export function setJustDone(id) {
  justDone = id;
}
