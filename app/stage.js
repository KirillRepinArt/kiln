/* Kiln · tabs, image frame sizing, queue core, browsing */
import { $ } from "./dom.js";
import { S, SEC_PER_STEP, jobs, save } from "./state.js";
import { applyPH, closePops } from "./composer.js";
import { CARDMAX, applyMode, layoutLeft, lyReset, minRight, stackW, tabsW } from "./cardlayout.js";
import { PV, browsed, doneById, onShow, picMode, pv } from "./picstate.js";
import { askNotify } from "./effects.js";
import { QS, loadJob, queueSig, renderQueue, renderQueueInner, setQsAnchor } from "./queue.js";
import { V, closeViewer, openViewer } from "./viewer.js";
import { renderLoras } from "./loras.js";
import { syncH } from "./boot.js";
import { addJobs, stopJob } from "./actions.js";

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
    sizeFrame.defer = true;
    try {
      fn();
    } finally {
      sizeFrame.defer = false;
      if (sizeFrame.pending) {
        sizeFrame.pending = false;
        sizeFrame();
      }
    }
  };
  document.documentElement.classList.add("tabmorph");
  layMorph(run);
  setTimeout(() => document.documentElement.classList.remove("tabmorph"), 900);
} /* a quick fade-through; the picture morphs if it's on both sides */

function fitBox(el, ar, bw, bh) {
  const [a, b] = ar.split(":").map(Number);
  let w = bw,
    h = (bw * b) / a;
  if (h > bh) {
    h = bh;
    w = (bh * a) / b;
  }
  el.style.width = w + "px";
  el.style.height = h + "px";
}
export let BAR = 66; // the status block under the picture: 12 + track 10 + 7 + status row 36; a caption: 6 + row 36 + 4; nothing: 24
const inGallery = () => S.view === "gen" && !!browsed();
/* what the row under the picture is: "bar" (rendering, or a paused queue), "cap" (a finished picture's caption), "none" */
export function rowMode() {
  if (S.view !== "gen") return "bar";
  const m = picMode();
  if (m === "browse") return "none";
  if (current() || (window.qPaused && jobs.some(j => j.status === "pending")) || (m === "still" && PV.news != null))
    return "bar";
  return "none";
} /* the picture's caption went into the title (hover it) and the job's progress onto the Generating tab */
/* Wide window = the prompt and the image area as one pair: their own widths (S.lay.pw / S.lay.rw), a fixed 18 px gap,
   the pair centred in the window. A window resize only changes the margins around it. The image area is the same
   rectangle in every tab and for every image shape: Generating fits the picture into it, Queue / LoRAs / PNG Info
   fill it. Edges (composer.js): the divider between them trades width (the prompt stops at its minimum); an outer edge
   follows the cursor, and on release the pair glides back to centre — the same rule as resizing the window.
   (Design agreed 2026-10-18 after the first try left a growing gap in the middle.) */
export const LISTMIN = 660,
  GAP = 18,
  PWMIN = 360;
/* the edit buttons' column beside the picture: 40 px buttons, 6 px apart and from the picture. Room is kept for as many
   columns as the picture's height needs, so none is ever cut off (the panel clips anything outside the area) */
export function tbW(h) {
  const n = document.querySelectorAll("#sideGen button").length || 6,
    per = Math.max(1, Math.floor((Math.max(h, 40) + 6) / 46)),
    cols = Math.ceil(n / per);
  return 6 + cols * 46;
}
/* Two remembered widths for the right side: rw = the panel width of Queue / LoRAs / PNG Info (the same for every
   picture); iw = in Generating, the largest the picture may be (null = no cap). In Generating the image area HUGS the
   picture: as wide as the picture shown (or, idle, the next ratio) at the available height, capped by iw — so the prompt
   always sits 18 px from the actual picture. Changes glide (CSS transition on the grid). Nothing moves under the
   cursor: while the pointer is over the picture the whole layout holds (a new picture fits inside the held area); while
   it is over the prompt the prompt holds its place and only the picture side reshapes. Leaving lets it glide. */
/* widths are PREFERRED sizes in px (S.lay v:3): a window resize never grows a panel past what you chose — the extra
   goes to the margins; shrinking takes the margins first (down to MMIN), then both panels in proportion, and they come
   back when there's room (flex's "shrink, don't grow"). Shares of the window (v:2) shrank them far too early. */
const layW = () => innerWidth - 36,
  MMIN = 24;
export const layDef = () => ({ pw: 680, rw: Math.max(LISTMIN, tabsW() + 2), iw: null, v: 3 });
export const lay = { overImg: false, navAt: 0, pressCard: false, last: null, drag: false };
/* the picture's height: the stage minus the status row, capped in Generating by S.lay.ih (a share of that height,
   set with the image area's top / bottom edges; null = no cap). While such an edge is held, lay.vh is the live height */
function picH() {
  const full = $("stage").getBoundingClientRect().height - BAR;
  if (lay.vh) return Math.min(full, lay.vh);
  const ih = S.lay && (document.querySelector(".app.stacked") ? S.lay.vih : S.lay.ih);
  return S.view === "gen" && ih ? Math.max(200, Math.min(full, ih * full)) : full;
} /* Vertical keeps its own limit (vih) */
function hugW() {
  const j = onShow() || current(),
    ar = j ? j.ar : S.ar,
    [a, b] = ar.split(":").map(Number),
    h = picH();
  return h > 0 ? (h * a) / b + tbW(h) : 9999;
}
export function layGeo() {
  const W = layW();
  if (S.lay && S.lay.v === 2) {
    const o = S.lay;
    S.lay = { pw: o.pw * W, rw: o.rw * W, iw: o.iw ? o.iw * W : null, ih: o.ih, v: 3 };
  } /* shares → px, once */
  else if (S.lay && !S.lay.v) {
    S.lay.v = 3;
  }
  const gen = S.view === "gen",
    L = S.lay || (S.lay = Object.assign(layDef(), S.lw ? { pw: S.lw } : {})),
    minR = gen
      ? 420
      : minRight(); /* Generating: the tab bar may overhang a narrow picture (decided 2026-10-19); the other tabs' panel holds it */
  let pw = Math.max(PWMIN, Math.min(L.pw, CARDMAX));
  const want = gen ? (lay.drag ? L.iw || W : Math.min(L.iw || 1e9, hugW())) : L.rw;
  let rw = Math.max(minR, want);
  const room = W - GAP - 2 * MMIN; // too narrow: both give way in proportion
  if (pw + rw > room) {
    const k = Math.max(0, room) / (pw + rw);
    pw = Math.max(PWMIN, pw * k);
    rw = Math.max(minR, Math.min(rw * k, W - GAP - pw));
  }
  const m = Math.max(0, (W - GAP - pw - rw) / 2);
  return { pw, rw, mL: m, mR: m, W, minR, off: 0, gen };
}
function layApply(g) {
  const app = document.querySelector(".app"),
    st = app.style,
    px = v => Math.round(v * 10) / 10 + "px";
  const mL = Math.max(0, g.mL + (g.off || 0)),
    mR = Math.max(0, g.W - GAP - g.pw - g.rw - mL);
  st.setProperty("--mL", px(mL));
  st.setProperty("--pw", px(g.pw));
  st.setProperty("--gap", px(GAP));
  st.setProperty("--rw", px(g.rw));
  st.setProperty("--mR", px(mR));
  st.setProperty("--cw", px(g.pw));
  lay.last = Object.assign({}, g, { mL, mR, off: 0 });
}
/* what to apply now. Holds last only while you're doing something, and the layout adjusts the moment you finish:
   flipping with the arrows on the picture holds it (so "next" stays under the cursor) until ~1 s after the last flip;
   a menu open in the prompt box (ratio, size…) or a press in it holds the prompt in place until you let go. */
function layNow() {
  const g = layGeo();
  if (!lay.last || lay.drag) return g;
  if (lay.vh) return lay.last; // a top / bottom edge held: the width waits for the release
  if (lay.pressCard || document.querySelector("#left .pop.show")) {
    g.pw = lay.last.pw;
    g.rw = Math.max(g.minR, Math.min(g.rw, g.W - GAP - g.pw)); /* the prompt keeps its place and its width */
    g.mL = g.mR = Math.max(0, (g.W - GAP - g.pw - g.rw) / 2);
    g.off = lay.last.mL - g.mL;
    return g;
  }
  return g;
}
/* an edge drag, in px from where it started. dv = the divider (the prompt's inner edge and the image area's inner edge
   are the same boundary): one panel grows exactly as much as the other shrinks. po / ro = the outer edges: that panel
   changes and the pair is held still (off) so the edge stays under the cursor; layRelease() lets it re-centre.
   In Generating the right-side width written is the picture's cap (iw), elsewhere the panel width (rw). */
export function layDrag(edge, g0, dx) {
  const g = Object.assign({}, g0),
    W = layW(),
    R = document.querySelector(".app").classList.contains("pright");
  if (R) {
    dx = -dx;
    if (edge === "po" || edge === "ro") return layDragR(edge, g0, dx, W);
  } /* prompt on the right: everything mirrored */
  if (edge === "dv") {
    const pw = Math.max(PWMIN, Math.min(CARDMAX, g0.pw + g0.rw - g0.minR, g0.pw + dx));
    g.rw = g0.rw - (pw - g0.pw);
    g.pw = pw;
  }
  if (edge === "po") {
    const pw = Math.max(PWMIN, Math.min(CARDMAX, g0.pw + g0.mL, g0.pw - dx));
    g.pw = pw;
    const W2 = g.W - GAP - g.pw - g.rw;
    g.off = g0.mL - (pw - g0.pw) - W2 / 2;
  }
  if (edge === "ro") {
    const rw = Math.max(g0.minR, Math.min(g0.rw + g0.mR, g0.rw + dx));
    g.rw = rw;
    const W2 = g.W - GAP - g.pw - g.rw;
    g.off = g0.mL - W2 / 2;
  }
  g.mL = g.mR = Math.max(0, (g.W - GAP - g.pw - g.rw) / 2);
  S.lay.pw = g.pw;
  if (g0.gen) S.lay.iw = g.rw;
  else S.lay.rw = g.rw;
  layApply(g);
  return g;
}
/* prompt on the right: the left margin sits next to the image area's outer edge */
function layDragR(edge, g0, dx, W) {
  const g = Object.assign({}, g0);
  if (edge === "po") {
    const pw = Math.max(PWMIN, Math.min(CARDMAX, g0.pw + g0.mR, g0.pw - dx));
    g.pw = pw;
    const W2 = g.W - GAP - g.pw - g.rw;
    g.off = g0.mL - W2 / 2;
  }
  if (edge === "ro") {
    const rw = Math.max(g0.minR, Math.min(g0.rw + g0.mL, g0.rw + dx));
    g.rw = rw;
    const W2 = g.W - GAP - g.pw - g.rw;
    g.off = g0.mL - (rw - g0.rw) - W2 / 2;
  } /* dx arrives mirrored: leftwards grows it */
  g.mL = g.mR = Math.max(0, (g.W - GAP - g.pw - g.rw) / 2);
  S.lay.pw = g.pw;
  if (g0.gen) S.lay.iw = g.rw;
  else S.lay.rw = g.rw;
  layApply(g);
  return g;
}
export function layRelease() {
  lay.drag = false;
  sizeFrame();
}
/* the prompt's place: "left" / "right" beside the picture (horizontal) or "below" it (vertical). Switching is a
   fade-through (Material's pattern for elements whose paths would cross): the old layout fades out, the new one fades in
   where it belongs — sliding made the panels pass through each other. */
export function setDock(z) {
  if ((S.dock || "left") === z) return;
  layMorph(() => {
    S.dock = z;
    save();
    lyReset();
    applyMode();
    sizeFrame();
    layoutLeft();
    moveThumb(true);
    sizeFrame();
    layoutLeft();
    if (window.layMenuUI) window.layMenuUI();
    if (window.haloNow) window.haloNow();
  });
}
/* a layout switch as a View Transition: the old layout is a snapshot, the new one is applied with every glide off (so it
   is captured where it ends, not mid-way), then they cross-fade (CSS ::view-transition-*). Without the API: a plain switch */
function layMorph(fn) {
  const b = document.body,
    h = document.documentElement;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    h.classList.remove("laymorph");
    setTimeout(() => b.classList.remove("laysnap"), 300);
  }; /* glides stay off a moment longer: late re-measures (the editor's) must not glide after the switch */
  setTimeout(
    end,
    1500,
  ); /* whatever happens to the transition (skipped, a hidden window pausing frames), the glides come back */
  b.classList.add("laysnap");
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    fn();
    end();
    return;
  }
  h.classList.add("laymorph");
  try {
    document.startViewTransition(fn).finished.finally(end);
  } catch (e) {
    fn();
    end();
  }
}
export function sizeFrame() {
  if (sizeFrame.defer) {
    sizeFrame.pending = true;
    return;
  } /* inside one click: once, at the end (it measures the page) */
  const app = document.querySelector(".app"),
    stk = app.classList.contains("stacked");
  /* the Gallery has no progress bar: its caption sits centred just under the picture, and the picture gets that room */
  {
    const m = rowMode();
    BAR = 66;
    /* the same rect for the same shape in Generating and the Gallery (2026-10-19): the row's room is always kept, used or not */
    document.body.classList.toggle("gallery", m === "cap");
    document.body.classList.toggle("norow", m === "none");
    sizeFrame.mode = m;
  }
  const j = onShow() || current();
  const ar = j ? j.ar : S.ar;
  if (!stk && !sizeFrame.hold) layApply(layNow());
  /* Vertical: the picture's area (and Queue / LoRAs / PNG Info) is a centred column no wider than a 16:9 picture at the
    height it has (plus its button column each side), never narrower than the tab bar or the prompt box — not edge to edge */
  {
    const rt = $("right");
    if (stk) {
      const hh = picH(),
        full = app.clientWidth - 36;
      const cap = Math.max(minRight(), typeof stackW === "function" ? stackW() : 0, (hh * 16) / 9 + 2 * tbW(hh));
      rt.style.width = Math.round(Math.min(full, cap)) + "px";
      sizeFrame.colW = Math.round(Math.min(full, cap));
    } else {
      if (rt.style.width) rt.style.width = "";
      sizeFrame.colW = 0;
    }
  }
  /* the target geometry, not a measurement: the grid may be mid-glide */
  const st = $("stage").getBoundingClientRect(),
    SW = stk ? (sizeFrame.colW ? sizeFrame.colW - 2 : st.width) : lay.last.rw;
  const f = $("frame"); /* Vertical: the column's target width (it may be mid-glide), less the panel's 1 px borders */
  const PH = picH(),
    TB = tbW(PH),
    morph = f.classList.contains("morph"),
    ow = f.style.width,
    oh = f.style.height;
  fitBox(f, ar, SW - (stk ? 2 : 1) * TB, PH);
  const w = parseFloat(f.style.width),
    h = parseFloat(f.style.height);
  if (morph) {
    f.style.width = ow;
    f.style.height = oh;
  } /* a crop-and-reveal owns the box until it lands (frameMorph) */
  /* the picture's canvas is drawn at the box's FINAL size and centred in it: the box may glide to a new shape (its
    edges clip the picture, like a container transform) without the canvas being stretched on the way */
  /* Vertical keeps the column's room on both sides */
  let top = Math.max(0, (st.height - h - BAR) / 2);
  if (lay.vtop != null) top = lay.vtop; /* a held top / bottom edge: the other edge stays put */
  /* picture + toolbar as one group, centred in the area; the toolbar on the side away from the prompt */
  const tbLeft = !stk && document.querySelector(".app").classList.contains("pright"),
    g0 = Math.max(0, Math.floor((SW - w - TB) / 2)),
    left = stk
      ? Math.floor((SW - w) / 2)
      : tbLeft
        ? g0 + TB
        : g0; /* Vertical: the picture itself on the centre line (the prompt box and the tab bar are centred there too); its column hangs in the margin */
  if (!morph) {
    f.style.left = left + "px";
    f.style.top = top + "px";
  }
  Object.assign(f.dataset, { tw: w, th: h, tl: left, tt: top });
  const gt = $("gtools");
  if (gt) {
    gt.style.top = top + "px";
    gt.style.left = (tbLeft ? left - TB : left + w) + "px";
    gt.style.width = TB + "px";
    gt.style.height = Math.max(40, h) + "px";
    gt.classList.toggle("lefty", tbLeft);
  }
  /* where the picture is going (not where it is mid-glide): the prompt's vertical anchors use this */
  lay.target = { top: st.top + top, h, bottom: st.top + top + h + BAR - 1, w };
  /* the area's outer handle sits on the picture's outer edge in Generating (the edge you see), not past the button column */
  {
    const ro = document.querySelector(".pedge.ro");
    if (ro) {
      const on = !stk && S.view === "gen",
        d = tbLeft ? left : SW - (left + w);
      ro.style.right = on && !tbLeft ? d - 6 + "px" : "";
      ro.style.left = on && tbLeft ? d - 6 + "px" : "";
    }
  }
  /* while an edge is held or hovered: an outline round the picture itself, an even 5 px out (the edges you drag are
    the picture's own; the box it may fill showed as a frame floating off the picture) */

  /* Vertical: the picture block sits between two equal gaps — the title starts as far under it (or under its progress
    bar) as the picture starts under the tab bar. A shift, not a resize: shrinking the column would hand the picture more
    height and move the gap again */
  lay.vB = stk ? st.top + top + h + (sizeFrame.mode === "bar" ? 12 + $("prog").offsetHeight : 0) : null;
  vAlign();
  const he = $("hedges");
  if (he) {
    he.style.left = left + "px";
    he.style.width = w + "px";
    he.style.top = top + "px";
    he.style.height = h + "px";
  }
  /* tab bar: centred over the panel in Queue / LoRAs / PNG Info; in Generating it sits right on top of the picture and is
    centred on the picture itself, not on picture + button column — as far as the area allows (it never pokes out) */
  const tb = document.querySelector(".tabs");
  if (tb) {
    tb.style.width = stk ? "" : SW + "px";
    const gen = S.view === "gen";
    const room = Math.max(0, (SW - tabsW()) / 2),
      dx = gen && !stk ? Math.max(-room, Math.min(room, Math.round(left + w / 2 - SW / 2))) : 0;
    tb.style.transform = gen && (top > 0 || dx) ? `translate(${dx}px,${Math.round(Math.max(0, top))}px)` : "";
  }
  const sx = 0;
  const pr = $("prog");
  pr.style.left = left + sx + "px";
  pr.style.width = w + "px";
  pr.style.top = top + h + (BAR === 66 ? 12 : 6) + "px";
  pr.style.setProperty("--tw", w + "px");
  requestAnimationFrame(layoutLeft);
}
/* Vertical: the picture block sits between two equal gaps — the title starts as far under it (or under its progress
   bar) as the picture starts under the tab bar. A shift of the prompt column, not a resize (shrinking it would hand the
   picture more height and move the gap again). Worked out from TARGETS: the name row may be mid-glide (the Reuse bar
   row opening), so the title's place comes from the row's target height, not from where it is right now */
export function vAlign() {
  const col = $("lcol");
  if (!document.querySelector(".app.stacked") || lay.vB == null) {
    if (col.dataset.dy) {
      delete col.dataset.dy;
      col.style.transform = "";
    }
    return;
  }
  const seg = document.querySelector(".seg"),
    tbs = document.querySelector(".tabs"),
    T = $("ltitle"),
    A = 12 + (tbs.getBoundingClientRect().bottom - seg.getBoundingClientRect().bottom);
  const cur = parseFloat(col.dataset.dy || 0),
    colTop = col.getBoundingClientRect().top - cur,
    TS = parseFloat(col.style.getPropertyValue("--ts")) || 64;
  const fromBottom = T.getBoundingClientRect().bottom - $("pname").getBoundingClientRect().top,
    pn = colTop + 4 + (TS - 10) - fromBottom; /* the name row: top 4, height TS-10, its content at the bottom */
  const dy = Math.round(Math.min(0, lay.vB + A - pn));
  if (String(dy) !== col.dataset.dy) {
    col.dataset.dy = dy;
    col.style.transform = dy ? `translateY(${dy}px)` : "";
  }
  $("hsplit").style.top = pn - colTop - 10 + "px";
} /* the prompt-slot line: just above the title, clear of the picture's bottom edge */
// live resize: everything follows the window edge directly; animations return ~150 ms after the last resize event
let lrT = null;

/* ======================= queue ======================= */
export function current() {
  return jobs.find(j => j.status === "running");
}
export function jEst(j) {
  return j.est || j.steps * (SEC_PER_STEP[j.mp] || 60);
} // the server's history-based estimate when there is one
export function lastDone() {
  return [...jobs].reverse().find(j => j.status === "done");
}
/* ======================= browsing finished images =======================
   ← / → (or the arrows on the image) step through finished images: in the Generating view, the queue overlay and
   the full-size viewer. Browsing back holds that image even when a new one finishes; stepping past the newest
   returns to the live render. */
export function doneList() {
  return jobs.filter(j => j.status === "done");
}
/* a picture of another shape: CROP, then REVEAL (2026-10-19, the user's design). 1) the frame closes in on the picture
   on show to the new picture's shape — the largest such box inside it, centred: the old picture is cropped, never
   squeezed, so nothing is ever empty; 2) at that box the new picture takes over (a short cross-fade: same shape now);
   3) the frame opens out to the new picture's size, revealing more of it. Both pictures sit at their own final size,
   centred: only the frame moves. ~180 ms accelerating + 80 ms seam + 280 ms decelerating (sequential motion) */
const MORPH = {
  a: 180,
  s: 80,
  b: 280,
  k: 0.88,
  T: 520,
}; /* k: the middle box is a little smaller than the largest that fits — the path curves inward (an iris closing a touch past what's needed); inside the old picture, so never a hole */
/* cubic-bezier easing as a function (for the frame's own timeline below) */
function bez(x1, y1, x2, y2) {
  const A = (a, b) => 1 - 3 * b + 3 * a,
    B = (a, b) => 3 * b - 6 * a,
    C = a => 3 * a,
    f = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t,
    d = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const g = d(t, x1, x2);
      if (Math.abs(g) < 1e-6) break;
      t -= (f(t, x1, x2) - x) / g;
    }
    return f(t, y1, y2);
  };
}
const eIn = bez(0.4, 0, 1, 1),
  eOut = bez(0, 0, 0.2, 1),
  eMove = bez(0.45, 0, 0.25, 1),
  eCrop = bez(
    0.2,
    0.6,
    0.3,
    1,
  ); /* eCrop: the box reaches the middle in ~¼ of the time (the user: the contraction ×2), then opens out slowly */
/* the crop and the reveal run on the SCREEN: the panel the frame sits in may be gliding (the pair re-centring), and a
   morph written in the panel's coordinates drifted with it — lopsided. Each frame the box is placed on screen and the
   panel's current offset taken off. The target is read from the frame's data (sizeFrame keeps it there while a morph
   runs, so a re-layout mid-way just updates where it lands) */
function frameMorph(o) {
  const f = $("frame"),
    x = $("cvx");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const T0 = () => ({ w: +f.dataset.tw, h: +f.dataset.th, l: +f.dataset.tl, t: +f.dataset.tt }),
    n0 = T0();
  if (!(n0.w > 0 && n0.h > 0 && o.w > 0 && o.h > 0)) return;
  const st0 = $("stage").getBoundingClientRect(),
    r = n0.w / n0.h;
  let aw = o.w,
    ah = o.w / r;
  if (ah > o.h) {
    ah = o.h;
    aw = o.h * r;
  }
  aw *= MORPH.k;
  ah *= MORPH.k;
  const O = { l: st0.left + o.l, t: st0.top + o.t, w: o.w, h: o.h },
    M = { l: O.l + (o.w - aw) / 2, t: O.t + (o.h - ah) / 2, w: aw, h: ah },
    T = MORPH.T,
    k1 = 0.12,
    k2 = 0.36,
    px = v => v + "px";
  cancelAnimationFrame(frameMorph.raf);
  f.style.setProperty("--ow", px(o.w));
  f.style.setProperty("--oh", px(o.h));
  f.style.setProperty("--nw", px(n0.w));
  f.style.setProperty("--nh", px(n0.h));
  f.classList.add("morph");
  const L = (a, b, p) => ({
      l: a.l + (b.l - a.l) * p,
      t: a.t + (b.t - a.t) * p,
      w: a.w + (b.w - a.w) * p,
      h: a.h + (b.h - a.h) * p,
    }),
    t0 = performance.now();
  if (x) {
    x.dataset.morph = "1";
    x.getAnimations().forEach(q => q.cancel());
    x.animate(
      [{ opacity: 1 }, { opacity: 1, offset: k1 }, { opacity: 0, offset: k2, easing: "ease-in-out" }, { opacity: 0 }],
      { duration: T, fill: "forwards" },
    ).onfinish = () => {
      x.style.opacity = "0";
      delete x.dataset.morph;
      x.getAnimations().forEach(q => q.cancel());
    };
  }
  /* ONE continuous move (2026-10-19): the box travels a curve from the old picture toward the middle box — a pull point,
    never a stop — and on to the new picture's place. A quadratic path in screen space; the time eased gently at both ends;
    the old picture fades out round the middle. The box stays inside the old picture early and inside the new one late,
    so no corner is ever empty */
  (function step(now) {
    const e = now - t0,
      st = $("stage").getBoundingClientRect(),
      n = T0();
    f.style.setProperty("--nw", px(n.w));
    f.style.setProperty("--nh", px(n.h));
    const u = eCrop(Math.min(1, e / T)),
      N = { l: st.left + n.l, t: st.top + n.t, w: n.w, h: n.h },
      q = (a, b, c) => (1 - u) * (1 - u) * a + 2 * u * (1 - u) * b + u * u * c;
    const B = { l: q(O.l, M.l, N.l), t: q(O.t, M.t, N.t), w: q(O.w, M.w, N.w), h: q(O.h, M.h, N.h) };
    if (e < T) {
      f.style.left = px(B.l - st.left);
      f.style.top = px(B.t - st.top);
      f.style.width = px(B.w);
      f.style.height = px(B.h);
      frameMorph.raf = requestAnimationFrame(step);
    } else {
      f.classList.remove("morph");
      f.style.left = px(n.l);
      f.style.top = px(n.t);
      f.style.width = px(n.w);
      f.style.height = px(n.h);
    }
  })(t0);
}
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
  if (!dry) {
    const fs = $("frame").style,
      o = { w: parseFloat(fs.width), h: parseFloat(fs.height), l: parseFloat(fs.left), t: parseFloat(fs.top) };
    PV.dir = dir;
    if (n >= L.length) pv("close", "arrow");
    else pv("browse", L[n]);
    if (n < L.length && S.view === "gen" && Math.abs(parseFloat(fs.width) / parseFloat(fs.height) - o.w / o.h) > 0.02)
      frameMorph(o);
  }
  return true;
}
function vNav(dir, dry) {
  const L = doneList(),
    i = L.findIndex(x => x.id === (V.job && V.job.id)),
    t = L[i + dir];
  if (i < 0 || !t) return false;
  if (!dry) openViewer(t);
  return true;
}
function navFn(el) {
  return el.closest("#viewer") ? vNav : genNav;
}
export function updNav() {
  document.querySelectorAll(".nav").forEach(b => b.classList.toggle("off", !navFn(b)(+b.dataset.nav, true)));
}
export function stripComments(t) {
  return t
    .split("\n")
    .filter(l => !/^\s*\/\//.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function expandVariants(t) {
  const picks = [];
  const out = t.replace(/\{([^{}]*\|[^{}]*)\}/g, (m, body) => {
    const o = body.split("|").map(x => x.trim());
    const c = o[Math.floor(Math.random() * o.length)];
    picks.push(c);
    return c;
  });
  return { text: out, picks };
} /* the render's prompt: click the render itself (the status line doubled it) */
export function browseStatus() {
  const b = browsed(),
    on = !!(b && PV.promptClosed);
  $("prog").classList.toggle("showp", on);
} /* the caption itself: live.js */

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initStage() {
  document.querySelectorAll(".tab").forEach(
    t =>
      (t.onclick = () =>
        tabGo(() => {
          const v = t.dataset.v;
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
  /* the picture's arrows live on a fixed layer: while they show they follow the picture's side edges every frame (it
   glides), but while you're clicking through with them they hold their place on SCREEN (Photos / Lightroom: navigation
   never runs away from the pointer); ~1 s after the last click they glide to the new picture's edges */
  (function () {
    const [pv, nx] = document.querySelectorAll(".gnav");
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
        for (const [el, x] of [
          [pv, Math.round(r.left + 10) + "px"],
          [nx, Math.round(r.right - 50) + "px"],
        ])
          if (el !== lay.navHold && (el.style.left !== x || el.style.top !== y)) {
            el.style.left = x;
            el.style.top = y;
          }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
  /* the resize outline: drawn on the page's bottom layer (fixed, under every panel, so nothing clips it), 12 px round
   the picture, following it every frame while an edge is hovered or held */
  (function () {
    const fh = $("fithint"),
      rt = $("right");
    let on = false;
    let offAt = 0;
    function tick() {
      const want = rt.classList.contains("edgehint") && S.view === "gen";
      if (want) offAt = 0;
      else if (!offAt) {
        offAt = performance.now();
        fh.classList.remove("show");
      }
      if (!want && performance.now() - offAt > 800) {
        on = false;
        return;
      } /* it fades out late and slowly (CSS): keep it on the picture meanwhile */
      const r = $("frame").getBoundingClientRect(),
        O = 12;
      fh.style.left = r.left - O + "px";
      fh.style.top = r.top - O + "px";
      fh.style.width = r.width + 2 * O + "px";
      fh.style.height = r.height + 2 * O + "px";
      if (want) fh.classList.add("show");
      requestAnimationFrame(tick);
    }
    new MutationObserver(() => {
      if (!on && rt.classList.contains("edgehint")) {
        on = true;
        tick();
      }
    }).observe(rt, { attributes: true, attributeFilter: ["class"] });
  })();
  /* the holds: over the picture, over the prompt (card, its name row, its LoRA chips) */
  {
    let t = null;
    const on = () => {
        clearTimeout(t);
        lay.overImg = true;
      },
      off = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          lay.overImg = false;
          sizeFrame();
        }, 120);
      };
    for (const el of [$("frame"), ...document.querySelectorAll(".gnav")]) {
      el.addEventListener("pointerenter", on);
      el.addEventListener("pointerleave", off);
    }
  }
  $("lcol").addEventListener("pointerdown", () => {
    lay.pressCard = true;
  });
  /* letting go anywhere (a menu choice, a click, an edge) lets the layout catch up at once */
  addEventListener("pointerup", () => {
    lay.pressCard = false;
    setTimeout(sizeFrame, 0);
  });
  addEventListener("click", () => setTimeout(sizeFrame, 0));
  window.addEventListener("resize", () => {
    document.body.classList.add("liveresize");
    clearTimeout(lrT);
    lrT = setTimeout(() => document.body.classList.remove("liveresize"), 150);
    applyMode();
    applyPH();
    sizeFrame();
    syncH();
    moveThumb(true);
  });
  document.fonts && document.fonts.ready.then(() => moveThumb(true));
  document.addEventListener(
    "click",
    e => {
      const b = e.target.closest(".nav");
      if (!b) return;
      e.stopPropagation();
      if (b.classList.contains("gnav")) lay.navHold = b;
      navFn(b)(+b.dataset.nav);
      updNav();
    },
    true,
  );
  document.addEventListener("keydown", e => {
    if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    if ($("modal").classList.contains("show")) return;
    const f = $("viewer").classList.contains("show") ? vNav : S.view === "gen" ? genNav : null;
    if (f && f(e.key === "ArrowLeft" ? -1 : 1)) {
      e.preventDefault();
      updNav();
    }
  });
  $("play").onclick = () => {
    askNotify();
    addJobs();
  };
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addJobs();
    }
    if (e.key === "Escape") {
      if ($("viewer").classList.contains("show")) {
        closeViewer();
        return;
      }
      if ($("modal").classList.contains("show")) {
        $("modal").classList.remove("show");
        return;
      }
      if ((PV.browse != null || PV.still) && !(e.target.closest && e.target.closest(".pwrapT"))) {
        pv("close");
        return;
      } // Esc outside the editor = the picture's ✕
      closePops();
    }
  });
  $("stopBtn").onclick = () => stopJob(current());
  $("prog").addEventListener("click", e => {
    if (e.target.closest(".stop,.resume")) return;
    const m = picMode();
    if (m === "browse") {
      if (PV.promptClosed) {
        PV.promptClosed = false;
        loadJob(browsed());
      }
      return;
    }
    if (m === "still") {
      if (current()) pv("toRender");
      else if (PV.news != null) pv("browse", doneById(PV.news));
      return;
    }
  });
}
