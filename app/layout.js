// @ts-check
/** @typedef {import("./types.js").Geometry} Geometry @typedef {import("./types.js").LayoutPrefs} LayoutPrefs */
import { syncH } from "./boot.js";
import { applyMode, applyPH, layoutLeft, lyReset, stackW, updHm } from "./cardlayout.js";
import { $ } from "./dom.js";
import { current, jobs } from "./jobs.js";
import {
  CARDMAX,
  GAP,
  LISTMIN,
  PWMIN,
  fitInBox,
  framePlacement,
  pageGeometry,
  stackColumnW,
  toolColumnW,
  upgradeLayoutPrefs,
} from "./layoutmath.js";
import { PV, onShow, picMode } from "./picstate.js";
import { S, save } from "./state.js";
import { moveThumb } from "./tabs.js";

/* Kiln · the page layout: the prompt and the picture area side by side or stacked, their widths and heights,
   the edges you drag, docking, and the holds that keep things still while you work */
/* a quick fade-through; the picture morphs if it's on both sides */

/** @param {HTMLElement} el @param {string} ar @param {number} bw @param {number} bh */
function fitBox(el, ar, bw, bh) {
  const { w, h } = fitInBox(ar, bw, bh);
  el.style.width = w + "px";
  el.style.height = h + "px";
}
export const BAR = 66; // the status block under the picture: 12 + track 10 + 7 + status row 36; a caption: 6 + row 36 + 4; nothing: 24
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
/* the edit buttons' column beside the picture: 40 px buttons, 6 px apart and from the picture. Room is kept for as many
   columns as the picture's height needs, so none is ever cut off (the panel clips anything outside the area) */
/** @param {number} h the picture's height */
export function tbW(h) {
  return toolColumnW(h, document.querySelectorAll("#sideGen button").length || 6);
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
const layW = () => innerWidth - 36;
/* the tab bar's width, as laid out now */
export function tabsW() {
  const k = /** @type {HTMLElement} */ (document.querySelector(".tabs")).children;
  return k.length ? Math.ceil(k[k.length - 1].getBoundingClientRect().right - k[0].getBoundingClientRect().left) : 0;
}
/* the picture area never gets narrower than the tab bar */
export function minRight() {
  return Math.max(420, tabsW() + 2);
}
/* saved layouts of older versions → today's (once, at start-up: main.js) */
export function migrateLayoutPrefs() {
  S.lay = upgradeLayoutPrefs(S.lay, layW());
}
export const layDef = () => ({ pw: 680, rw: Math.max(LISTMIN, tabsW() + 2), iw: null, v: 3 });
/** @type {import("./types.js").LayoutState} */
export const lay = {
  overImg: false,
  pressCard: false,
  navHold: null,
  last: null,
  drag: false,
  vh: null,
  vtop: null,
  vbDrag: false,
  target: null,
  vB: null,
  frameDefer: false,
  framePending: false,
  frameHold: false,
  row: null,
  colW: 0,
};
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
  const gen = S.view === "gen",
    L = S.lay || (S.lay = Object.assign(layDef(), S.lw ? { pw: S.lw } : {})),
    minR = gen
      ? 420
      : minRight(); /* Generating: the tab bar may overhang a narrow picture (decided 2026-10-19); the other tabs' panel holds it */
  // the picture's hug width is measured only when it's used (Generating, no edge held)
  return pageGeometry({ W, gen, drag: lay.drag, minR, hug: gen && !lay.drag ? hugW() : undefined }, L);
}
/** @param {Geometry} g */
function layApply(g) {
  const app = /** @type {HTMLElement} */ (document.querySelector(".app")),
    st = app.style,
    px = (/** @type {number} */ v) => Math.round(v * 10) / 10 + "px";
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
/** @param {"dv" | "po" | "ro"} edge @param {Geometry} g0 the geometry when the drag began @param {number} dx px moved */
export function layDrag(edge, g0, dx) {
  const g = Object.assign({}, g0),
    R = /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright");
  if (R) {
    dx = -dx;
    if (edge === "po" || edge === "ro") return layDragR(edge, g0, dx);
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
  const L = /** @type {LayoutPrefs} */ (S.lay); // made by layGeo before any drag
  L.pw = g.pw;
  if (g0.gen) L.iw = g.rw;
  else L.rw = g.rw;
  layApply(g);
  return g;
}
/* prompt on the right: the left margin sits next to the image area's outer edge */
/** @param {"dv" | "po" | "ro"} edge @param {Geometry} g0 @param {number} dx */
function layDragR(edge, g0, dx) {
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
  const L = /** @type {LayoutPrefs} */ (S.lay); // made by layGeo before any drag
  L.pw = g.pw;
  if (g0.gen) L.iw = g.rw;
  else L.rw = g.rw;
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
/** @param {"left" | "right" | "below"} z */
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
/** @param {() => void} fn the switch itself */
export function layMorph(fn) {
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
  if (lay.frameDefer) {
    lay.framePending = true;
    return;
  } /* inside one click: once, at the end (it measures the page) */
  const app = /** @type {HTMLElement} */ (document.querySelector(".app")),
    stk = app.classList.contains("stacked");
  {
    const m = rowMode();
    /* the same rect for the same shape in Generating and the Gallery (2026-10-19): the row's room is always kept, used or not */
    document.body.classList.toggle("norow", m === "none");
    lay.row = m;
  }
  const j = onShow() || current();
  const ar = j ? j.ar : S.ar;
  if (!stk && !lay.frameHold) layApply(layNow());
  /* Vertical: the picture's area (and Queue / LoRAs / PNG Info) is a centred column no wider than a 16:9 picture at the
    height it has (plus its button column each side), never narrower than the tab bar or the prompt box — not edge to edge */
  {
    const rt = $("right");
    if (stk) {
      const hh = picH();
      lay.colW = stackColumnW(app.clientWidth - 36, minRight(), stackW(), hh, tbW(hh));
      rt.style.width = lay.colW + "px";
    } else {
      if (rt.style.width) rt.style.width = "";
      lay.colW = 0;
    }
  }
  /* the target geometry, not a measurement: the grid may be mid-glide */
  const st = $("stage").getBoundingClientRect(),
    SW = stk ? (lay.colW ? lay.colW - 2 : st.width) : /** @type {Geometry} */ (lay.last).rw; // wide: layApply above has set it
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
  /* a held top / bottom edge (lay.vtop): the other edge stays put. The button column goes on the side away from the
    prompt; Vertical: the picture itself on the centre line (the prompt box and the tab bar are centred there too) */
  const tbLeft = !stk && /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright"),
    { top, left, toolsX } = framePlacement({
      areaW: SW,
      areaH: st.height,
      w,
      h,
      tb: TB,
      row: BAR,
      heldTop: lay.vtop,
      stacked: stk,
      toolsLeft: tbLeft,
    });
  if (!morph) {
    f.style.left = left + "px";
    f.style.top = top + "px";
  }
  Object.assign(f.dataset, { tw: w, th: h, tl: left, tt: top });
  const gt = $("gtools");
  if (gt) {
    gt.style.top = top + "px";
    gt.style.left = toolsX + "px";
    gt.style.width = TB + "px";
    gt.style.height = Math.max(40, h) + "px";
    gt.classList.toggle("lefty", tbLeft);
  }
  /* where the picture is going (not where it is mid-glide): the prompt's vertical anchors use this */
  lay.target = { top: st.top + top, h, bottom: st.top + top + h + BAR - 1, w };
  /* the area's outer handle sits on the picture's outer edge in Generating (the edge you see), not past the button column */
  {
    const ro = /** @type {HTMLElement} */ (document.querySelector(".pedge.ro"));
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
  lay.vB = stk ? st.top + top + h + (lay.row === "bar" ? 12 + $("prog").offsetHeight : 0) : null;
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
  const tb = /** @type {HTMLElement} */ (document.querySelector(".tabs"));
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
  const seg = /** @type {HTMLElement} */ (document.querySelector(".seg")),
    tbs = /** @type {HTMLElement} */ (document.querySelector(".tabs")),
    T = $("ltitle"),
    A = 12 + (tbs.getBoundingClientRect().bottom - seg.getBoundingClientRect().bottom);
  const cur = parseFloat(col.dataset.dy || "0"),
    colTop = col.getBoundingClientRect().top - cur,
    TS = parseFloat(col.style.getPropertyValue("--ts")) || 64;
  const fromBottom = T.getBoundingClientRect().bottom - $("pname").getBoundingClientRect().top,
    pn = colTop + 4 + (TS - 10) - fromBottom; /* the name row: top 4, height TS-10, its content at the bottom */
  const dy = Math.round(Math.min(0, lay.vB + A - pn));
  if (String(dy) !== col.dataset.dy) {
    col.dataset.dy = String(dy);
    col.style.transform = dy ? `translateY(${dy}px)` : "";
  }
  $("hsplit").style.top = pn - colTop - 10 + "px";
} /* the prompt-slot line: just above the title, clear of the picture's bottom edge */
// live resize: everything follows the window edge directly; animations return ~150 ms after the last resize event

/** @type {number | undefined} */
let lrT; // the window-resize class's timer

/* start-up wiring: the holds (pointer over the picture, a press in the prompt), the edges' outline, window resize (called from main.js, in order) */
export function initLayout() {
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
    /** @type {number | undefined} */
    let t;
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
}
// column widths now come from sizeFrame()
export function resetLayout() {
  S.lay = null;
  S.vfit = false;
  /* widths, the picture's limits (iw, ih) — all back to the defaults */
  delete S.lw;
  S.pph = 0;
  S.sch = 0;
  S.pos = "mid";
  S.hmode = "";
  updHm();
  applyPH();
  save();
  sizeFrame();
  moveThumb(true);
  layoutLeft();
}
