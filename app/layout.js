// @ts-check
/** @typedef {import("./types.js").Geometry} Geometry @typedef {import("./types.js").LayoutPrefs} LayoutPrefs */
import { SWITCH, plateFollow } from "./plate.js";
import { placeAround } from "./around.js";
import { frameBox, frameGoal, layE, layT, snaps } from "./framebox.js";
import { syncH } from "./boot.js";
import { applyMode, applyPH, layoutLeft, lyReset, slotLeast, stackW, updHm } from "./cardlayout.js";
import { $ } from "./dom.js";
import { HANDLES } from "./outlines.js";
import { current, jobs } from "./jobs.js";
import {
  PICHMIN,
  limits,
  paneDefault,
  PIC_OVER,
  RUBBER,
  arrange,
  bez,
  rubber,
  trade,
  fitInBox,
  layoutPrefsV4,
  framePlacement,
  pageGeometry,
  pageInsets,
  stackColumnW,
  toolColumnW,
  upgradeLayoutPrefs,
} from "./layoutmath.js";
import { PV, onShow, picMode } from "./picstate.js";
import { S, save } from "./state.js";
import { forgeOk } from "./sync.js";
import { moveThumb } from "./tabs.js";
import { SPACE, pairGap } from "./tokens.js";

/* Kiln · the page layout: the prompt and the picture area side by side or stacked, their widths and heights,
   the edges you drag, docking, and the holds that keep things still while you work */
/* a quick fade-through; the picture morphs if it's on both sides */

/* the status block under the picture: the part gap + track 10 + 7 + status row 36 (a caption: 6 + row 36 + 4;
   nothing: 24) */
export const BAR = () => SPACE.part + 10 + 7 + 36;
/* the status row coming or going inside the picture's view: on the frame's clock — the same length and curve as the
   frame's glide into (or out of) the room, started with it. ONE place (tabs.js faded it on its own for a switch) */
/** @param {boolean} on */
function rowFade(on) {
  const b = document.body.classList,
    jump = b.contains("laysnap") || b.contains("liveresize") || b.contains("laydrag"),
    cs = getComputedStyle(document.documentElement),
    a = $("prog").animate(
      [
        { opacity: on ? 0 : 1, visibility: "visible" },
        { opacity: on ? 1 : 0, visibility: "visible" },
      ],
      {
        duration: jump ? 150 : layT(),
        easing: jump ? "linear" : cs.getPropertyValue("--lay-e").trim() || "ease",
        fill: "backwards", // its first keyframe holds until the clock's start (now): the row was hidden for a frame
      },
    );
  a.startTime = performance.now();
}
/* the page on show, for its insets (layoutmath.js PAGES) */
function page() {
  return S.view !== "gen" ? "panel" : picMode() === "browse" ? "gallery" : "generating";
}
/** what the page keeps room for right now — the ONE decider (layoutmath.js pageInsets): the layout reserves by it, the
 * status row and the edit buttons are shown by it */
export function insets() {
  const m = picMode();
  return pageInsets(page(), {
    running: !!current(),
    waiting: jobs.some(j => j.status === "pending"),
    paused: !!window.qPaused,
    ready: forgeOk,
    news: m === "still" && PV.news != null,
    shown: !!onShow(),
  });
}
/* what the row under the picture is: "bar" (the queue's progress, a paused queue, a result behind your reference) or
   "none" — the picture's caption went into the title, the job's progress onto the Generating tab */
export function rowMode() {
  return insets().row ? "bar" : "none";
}
/** the insets as a key: the layout runs again when it changes (sync.js after a poll, picstate.js after an event) */
export const insetsKey = () => {
  const i = insets();
  return `${i.row}:${i.tools}`;
};
/* Wide window = the prompt and the image area as one pair: their own widths (paneSize: the box's, the page's), a fixed 18 px gap,
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
   goes to the margins; shrinking takes the margins first (down to the room's ends), then both panels in proportion, and they come
   back when there's room (flex's "shrink, don't grow"). Shares of the window (v:2) shrank them far too early. */
const layW = () => innerWidth - 2 * SPACE.area; /* the window less its edge on each side */
/* the tab bar's width, as laid out now */
export function tabsW() {
  const k = /** @type {HTMLElement} */ (document.querySelector(".tabs")).children;
  return k.length ? Math.ceil(k[k.length - 1].getBoundingClientRect().right - k[0].getBoundingClientRect().left) : 0;
}
/* the picture area never gets narrower than the tab bar */
export function minRight() {
  return Math.max(420, tabsW() + 2);
}
/* ---------- your sizes have ONE owner (v0.7c, docs/decisions/0013) ----------
   A size per pane × page × orientation (S.lay v4, layoutmath.js layoutPrefsV4): the prompt box's width, each page's
   width and height — Queue, LoRAs and PNG Info each their own, Generating and the Gallery each their own picture cap.
   Every edge writes through setPaneSize, every reader asks paneSize; null = the default. Left and Right share "side"
   (mirrors). The box's height is never kept (it hugs its text). */
/** @typedef {import("./layoutmath.js").PageId} PageId @typedef {import("./layoutmath.js").Orient} Orient */
/** side by side or Vertical, as laid out now @returns {Orient} */
export const orient = () => (document.querySelector(".app.stacked") ? "vert" : "side");
/** the page on show, as a pane @returns {PageId} */
export const pageId = () =>
  S.view === "gen" ? (picMode() === "browse" ? "gallery" : "generating") : /** @type {PageId} */ (S.view);
/** the store, made (or brought up from an older version) the first time it's asked for */
function sizes() {
  if (!S.lay || S.lay.v !== 4) {
    const room = picFull(true);
    S.lay = layoutPrefsV4(upgradeLayoutPrefs(S.lay || (S.lw ? { pw: S.lw, v: 3 } : null), layW()), {
      roomH: room,
      vroomH: room,
    });
    delete S.lw;
  }
  return /** @type {import("./layoutmath.js").LayoutV4} */ (S.lay);
}
/** your size of a pane (null parts: the default) @param {"box" | PageId} [pane] @param {Orient} [o] */
export function paneSize(pane = pageId(), o = orient()) {
  const L = sizes()[o];
  return pane === "box" ? L.box : L.pages[pane] || (L.pages[pane] = { w: null, h: null });
}
/** set (or with null, forget) your size of a pane @param {"box" | PageId} pane @param {"w" | "h"} axis
 * @param {number | null} v @param {Orient} [o] */
export function setPaneSize(pane, axis, v, o = orient()) {
  paneSize(pane, o)[axis] = v == null ? null : Math.round(v);
}
/* saved layouts of older versions → today's (once, at start-up: main.js); the sizes' own format on first use */
export function migrateLayoutPrefs() {
  if (S.lay && S.lay.v !== 4) S.lay = upgradeLayoutPrefs(S.lay, layW());
  delete S.sch; // Vertical's kept prompt height (2026-11-01: the box hugs its text; the divider sizes the picture)
  delete S.pph; // a kept prompt height side by side (2026-11-02, DD-2026-11-02-12: the box's height is its text's)
  delete S.vfit; // Vertical's own fit flag (2026-11-02, DD-2026-11-02-16: one mode set, S.hmode, on the cross axis)
}
/* every pane's least / largest size and its default come from ONE place, layoutmath.js (limits, paneDefault): these
   two ask it with the page's context now (v0.7c 3b — the gestures had their own numbers) */
/** @param {"box" | PageId} pane @param {"w" | "h"} axis @param {{ o?: Orient, roomH?: number }} [c] */
export function paneLimits(pane, axis, c = {}) {
  return limits(pane, axis, {
    orient: c.o ?? orient(),
    roomW: layW(),
    roomH: c.roomH ?? picFull(true),
    minR: minRight(),
    least: slotLeast(),
    winH: innerHeight,
  });
}
/** @param {"box" | PageId} pane @param {Orient} [o] @param {number} [roomH] */
export function paneDef(pane, o = orient(), roomH = picFull(true)) {
  return paneDefault(pane, o, { w: layW(), h: roomH });
}
/** a size within its limits @param {number} v @param {{ lo: number, hi: number }} l */
export const within = (v, l) => Math.max(l.lo, Math.min(l.hi, v));
/** the defaults side by side: the prompt's width; a panel's (a 2:3 plate at the room's height, never narrower than the
 * tab bar — v0.7c, agreed 2026-11-01; it was 660 px whatever the window) */
export const layDef = () => ({
  pw: paneDef("box", "side").w ?? 680,
  rw: Math.max(minRight(), paneDef("queue", "side").w ?? 0),
});
/** @type {import("./types.js").LayoutState} */
export const lay = {
  overImg: false,
  pressCard: false,
  navHold: null,
  last: null,
  drag: false,
  vh: null,
  vtop: null,
  vw: null,
  ph: null,
  ptop: null,
  overB: 0,
  target: null,
  frameDefer: false,
  framePending: false,
  frameHold: false,
  row: null,
  rowView: null,
  ins: "",
  colW: 0,
  shown: null,
  vroom: 0,
  vrow: 0,
};
/* Vertical: the even gap — the picture's plate starts this far under the tab buttons, and the prompt's name starts this
   far under the plate (or under its status row) */
function evenGap() {
  const seg = /** @type {HTMLElement} */ (document.querySelector(".seg")),
    tbs = /** @type {HTMLElement} */ (document.querySelector(".tabs"));
  return SPACE.part + (tbs.getBoundingClientRect().bottom - seg.getBoundingClientRect().bottom);
}
/* Vertical: where the prompt's name starts (screen px) — worked out from where the column is laid out (without a
   switch's slide on it) and the name row's own height, not from where the title is mid-glide */
function nameTop() {
  const col = $("lcol"),
    colTop = col.getBoundingClientRect().top - colY,
    TS = parseFloat(col.style.getPropertyValue("--ts")) || 64,
    fromBottom = $("ltitle").getBoundingClientRect().bottom - $("pname").getBoundingClientRect().top;
  return { pn: colTop + 4 + (TS - 4 - SPACE.tight) - fromBottom, colTop };
}
/* the room the status row takes under the picture while the page keeps it (the part gap + the row) */
function rowRoom() {
  return document.querySelector(".app.stacked") ? SPACE.part + $("prog").offsetHeight : BAR();
}
/* the height the picture's block may take: the stage; Vertical — down to one even gap above the prompt's name (the
   prompt sits at the bottom, the picture takes everything above it: 2026-10-31, it used to be pulled up under the
   picture and left the window's bottom empty) */
function roomH() {
  const st = stageRect();
  if (!document.querySelector(".app.stacked")) return st.height;
  return nameTop().pn - evenGap() - st.top;
}
/** Vertical: the room the page (picture or panel) takes when its height is YOURS — set with an edge, held or kept —
 * or null when it simply fills what the box leaves (DEVLOG DD-2026-11-02-14: a size of yours beats a content size, a
 * content size beats an unset one). The box's height (its text) is squeezed by it, never below the box's least.
 * The picture's: its height, never more than its width allows (the column / its ratio), plus the status row's room. */
export function pageYoursH() {
  if (!document.querySelector(".app.stacked")) return null;
  if (S.view === "gen") {
    const cap = paneSize().h; // the KEPT size: a held overshoot (the rubber band) never squeezes the box
    if (!cap) return null;
    const f = $("frame"),
      ar = f.offsetWidth / Math.max(1, f.offsetHeight),
      h = lay.colW ? Math.min(cap, lay.colW / ar) : cap;
    return h + (insets().row ? rowRoom() : 0);
  }
  return paneSize().h ?? null;
}
/* the picture's largest height: the room less the status row while the page keeps it (insets) */
export function picFull(noRow = false) {
  return roomH() - (!noRow && insets().row ? rowRoom() : 0);
}
/* the picture's height: picFull, capped by your height for this page (Generating and the Gallery each their own, in
   each orientation; set with the picture's edges or Vertical's divider; null = no cap). While an edge is held, lay.vh
   is the live height */
function picH(noRow = false) {
  const full = picFull(noRow);
  if (lay.vh) return lay.vh; // held: the edge's size, past the room too (the rubber band; it settles on release)
  const cap = S.view === "gen" ? paneSize().h : null;
  return cap ? Math.max(PICHMIN, Math.min(full, cap)) : full;
}
/* the clearance the edit buttons need beyond the window's own margin (they hang outside the plate, never room in the
   area — kept whether they show or not, so nothing moves when they come) */
function toolsClear(/** @type {number} */ h) {
  return Math.max(0, tbW(h) - SPACE.area);
}
export function layGeo() {
  const W = layW();
  const gen = S.view === "gen",
    df = layDef(),
    page = paneSize(),
    /* a panel's width within its own limits (the Queue's readable width, PNG Info's fixed one) */
    rw = gen ? df.rw : within(page.w ?? df.rw, paneLimits(pageId(), "w", { o: "side" })),
    L = { pw: paneSize("box", "side").w ?? df.pw, rw, iw: gen ? page.w : null },
    /* never narrower than the tab bar: it sits on the plate's centre line (plate.js placeBar), and the plate is centred
       in the area on every page (2026-10-31; the bar used to be clamped into the area, off the plate's centre) */
    minR = minRight();
  /* Generating's area is the whole stage the prompt leaves (no hug: ownership map G6) — the picture is centred in it
     and the prompt follows the picture instead (promptFollow) */
  return pageGeometry(
    {
      W,
      gen,
      minR,
      clear: gen ? toolsClear(picH()) : 0,
      promptRight: /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright"),
    },
    L,
  );
}
/* ---------- the pair's columns move on the layout's clock, here (2026-11-01, ownership map G12) ----------
   They glided on CSS's clock (a transition on grid-template-columns) while the prompt's follow offset was worked out
   from where they were GOING and applied at once: on Reset layout the prompt sat ~200 px over the picture, then slid
   out. Now one glide writes them every frame on the frame's curve and time, and says where they are (lay.shown) to
   what follows them, in the same frame */
/** @typedef {{ mL: number, pw: number, rw: number, mR: number }} Cols */
/** @type {{ from: Cols, to: Cols, t0: number, ms: number } | null} */
let colsGlide = null;
let colsRaf = 0;
/** @param {Cols} c */
function colsWrite(c) {
  const st = /** @type {HTMLElement} */ (document.querySelector(".app")).style,
    px = (/** @type {number} */ v) => Math.round(v * 10) / 10 + "px";
  st.setProperty("--mL", px(c.mL));
  st.setProperty("--pw", px(c.pw));
  st.setProperty("--rw", px(c.rw));
  st.setProperty("--mR", px(c.mR));
  st.setProperty("--cw", px(c.pw));
  lay.shown = c;
}
function colsTick() {
  colsRaf = 0;
  if (!colsGlide) return;
  const G = colsGlide,
    p = Math.min(1, (performance.now() - G.t0) / G.ms),
    e = layE(p),
    at = (/** @type {keyof Cols} */ k) => G.from[k] + (G.to[k] - G.from[k]) * e;
  colsWrite(p >= 1 ? G.to : { mL: at("mL"), pw: at("pw"), rw: at("rw"), mR: at("mR") });
  if (p >= 1) colsGlide = null;
  else colsRaf = requestAnimationFrame(colsTick);
  promptFollow(true); // the prompt follows the picture where the columns are now
}
/** @param {Geometry} g */
function layApply(g) {
  const mL = Math.max(0, g.mL + (g.off || 0)),
    mR = Math.max(0, g.W - pairGap() - g.pw - g.rw - mL),
    to = { mL, pw: g.pw, rw: g.rw, mR };
  lay.last = Object.assign({}, g, { mL, mR, off: 0 });
  const was = colsGlide ? colsGlide.to : lay.shown,
    same = (/** @type {Cols | null} */ c) =>
      !!c && c.mL === to.mL && c.pw === to.pw && c.rw === to.rw && c.mR === to.mR;
  if (same(was)) return;
  if (!lay.shown || snaps() || document.querySelector(".app.stacked")) {
    colsGlide = null;
    cancelAnimationFrame(colsRaf);
    colsRaf = 0;
    colsWrite(to);
    return;
  } /* Vertical: the columns aren't used (one column) — written at once */
  colsGlide = { from: Object.assign({}, lay.shown), to, t0: performance.now(), ms: layT() };
  if (!colsRaf) colsRaf = requestAnimationFrame(colsTick);
}
/* what to apply now. Holds last only while you're doing something, and the layout adjusts the moment you finish:
   flipping with the arrows on the picture holds it (so "next" stays under the cursor) until ~1 s after the last flip;
   a menu open in the prompt box (ratio, size…) or a press in it holds the prompt in place until you let go. */
function layNow() {
  const g = layGeo();
  if (!lay.last || lay.drag) return g;
  /* (a top / bottom edge held used to freeze the area's width until release: the picture couldn't grow into room it
     had, then jumped — 2026-11-02, the user. Held, the layout computes from the held size like every other drag.) */
  if (lay.pressCard || document.querySelector("#left .pop.show")) {
    g.pw = lay.last.pw;
    g.rw = Math.max(g.minR, Math.min(g.rw, g.W - pairGap() - g.pw)); /* the prompt keeps its place and its width */
    g.mL = g.mR = Math.max(0, (g.W - pairGap() - g.pw - g.rw) / 2);
    g.off = lay.last.mL - g.mL;
    return g;
  }
  return g;
}
/* an edge drag, in px from where it started (v0.7c, docs/decisions/0013): ONE rule for every edge and both sides.
   dv = the divider: one panel grows exactly as much as the other shrinks, nothing outside the pair moves. po / ro = an
   outer edge: only that panel changes, its other side PINNED where it was (the pair's place comes from layoutmath.js
   arrange with the pin), so the edge stays under the cursor; it can go until the pair meets the room's end (the
   window less its area gap; the edit buttons' clearance beside the picture). layRelease() drops the pin: the pair
   settles back to its resting place. Your sizes are written through setPaneSize (the picture page: its width cap). */
/** @param {"dv" | "po" | "ro"} edge @param {Geometry} g0 the geometry when the drag began @param {number} dx px moved
 * @param {{ ar: number, full: number, w0: number } | null} [pic] a picture page: the picture IS the page's pane — its
 *   width at grab (w0), its height following its ratio, never taller than its room; its area is the picture, never
 *   narrower than the tab bar (a smaller picture sits centred in it); null: a panel */
export function layDrag(edge, g0, dx, pic = null) {
  const R = /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright"),
    gap = pairGap(),
    clear = g0.clear || 0,
    first = R ? "page" : "box", // the panel on the left
    /* the room between the pair and the band's ends at grab: where an outer edge can still go */
    freeL = g0.mL - (R ? clear : 0),
    freeR = g0.mR - (R ? 0 : clear),
    lb = paneLimits("box", "w", { o: "side" }),
    /* a picture can't be wider than its height allows: the room's height × its ratio */
    lp = pic
      ? { lo: PICHMIN * pic.ar, hi: Math.min(g0.W, pic.full * pic.ar) }
      : paneLimits(pageId(), "w", { o: "side" }),
    /* the page's own size at grab: a panel's width, or the picture's (its area may be wider: the tab bar) */
    p0 = pic ? pic.w0 : g0.rw,
    area = (/** @type {number} */ p) => (pic ? Math.max(g0.minR, p) : p),
    clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) =>
      Math.max(lo, Math.min(Math.max(lo, hi), v));
  /* what you see while held (past a limit: with resistance) and what's kept (the limit) */
  let pw = g0.pw,
    rw = p0,
    pwKeep = pw,
    rwKeep = rw;
  /** @type {{ i: number, side: "start" | "end", at: number }} */
  let pin = { i: 0, side: "start", at: g0.mL }; // the divider: the pair's outer sides don't move
  const w0 = first === "box" ? g0.pw : g0.rw; // the left panel's width at grab
  if (edge === "dv") {
    const d = first === "box" ? dx : -dx, // how much the prompt grows
      /* the divider never takes the picture under the tab bar's width (its area would stop, the prompt overlap) */
      lc = { lo: pic ? Math.max(lp.lo, g0.minR) : lp.lo, hi: lp.hi },
      la = { lo: lb.lo, hi: g0.pw + p0 - lc.lo },
      shown = trade(d, g0.pw, p0, la, lc),
      hi = Math.min(la.hi - g0.pw, p0 - lc.lo),
      kept = clamp(d, Math.min(hi, Math.max(la.lo - g0.pw, p0 - lc.hi)), hi);
    pw = g0.pw + shown;
    rw = p0 - shown;
    pwKeep = g0.pw + kept;
    rwKeep = p0 - kept;
  } else {
    const box = edge === "po",
      left = box === (first === "box"), // the dragged panel is the left one
      grow = left ? -dx : dx,
      size0 = box ? g0.pw : p0,
      lim = box ? lb : lp,
      hi = Math.min(lim.hi, size0 + (left ? freeL : freeR)),
      shown = rubber(size0 + grow, lim.lo, Math.max(lim.lo, hi), RUBBER),
      kept = clamp(size0 + grow, lim.lo, hi);
    if (box) [pw, pwKeep] = [shown, kept];
    else [rw, rwKeep] = [shown, kept];
    /* its other (inner) side stays where it was — a picture's own side, even when its area is wider (the tab bar):
       the area moves by half the difference so the picture, centred in it, keeps that side still */
    const slack = (/** @type {number} */ p) => (pic && !box ? (area(p) - p) / 2 : 0),
      shift = slack(p0) - slack(rw);
    pin = left ? { i: 0, side: "end", at: g0.mL + w0 - shift } : { i: 1, side: "start", at: g0.mL + w0 + gap + shift };
  }
  const sizes = first === "box" ? [pw, area(rw)] : [area(rw), pw],
    a = arrange({
      panes: sizes.map(s => ({ size: s, lo: s, hi: s })),
      gap,
      start: 0,
      length: g0.W,
      margin: 0,
      anchor: "center",
      pin,
    }),
    g = Object.assign({}, g0, { pw, rw: area(rw), mL: a.start, mR: g0.W - a.end, off: 0 });
  setPaneSize("box", "w", pwKeep, "side");
  if (edge !== "po") {
    /* the page's size: a panel its width; a picture its box (the width, and the height its ratio gives) */
    setPaneSize(pageId(), "w", area(rwKeep), "side");
    if (pic) {
      const hk = rwKeep / pic.ar;
      setPaneSize(pageId(), "h", hk >= pic.full - 1 ? null : hk, "side");
      lay.vh = Math.min(rw / pic.ar, pic.full + PIC_OVER); // held: as wide as the area; past its room only a little
    }
  }
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
/* ---------- "the layout lands at once" has ONE owner (2026-10-31, ownership map T1) ----------
   While a switch moves things itself, the layout's own glides are off (body.laysnap: it lands at once). Each motion
   holds it until its own end — a tab switch, a layout switch; a newer one of the same kind replaces its hold — and it
   lasts until the LAST hold ends. Each used to add and remove the class on its own timer: one ending turned the glides
   back on in the middle of the other */
/** @type {Record<string, number>} the end of each motion's hold (performance.now()'s clock) */
const snapUntil = {};
let snapTimer = 0;
/** hold the layout's glides off for `who` for `ms` from now (0: let go now) @param {string} who @param {number} ms */
export function snapHold(who, ms) {
  snapUntil[who] = performance.now() + ms;
  snapCheck();
}
function snapCheck() {
  clearTimeout(snapTimer);
  const left = Math.max(0, ...Object.values(snapUntil)) - performance.now();
  document.body.classList.toggle("laysnap", left > 0);
  if (left > 0) snapTimer = setTimeout(snapCheck, left + 1);
}
/* a layout switch as a View Transition: the old layout is a snapshot, the new one is applied with every glide off (so it
   is captured where it ends, not mid-way), then they cross-fade (CSS ::view-transition-*). Without the API: a plain switch */
let morphs = 0; // switches started so far: only the latest one ends the morph
/** @type {ViewTransition | null} */
let morphNow = null; // the switch running now
/* when the running switch starts to show (its snapshots taken): motion started inside the switch waits for it — the
   capture can take a few hundred ms, and a motion started before it was mostly over by its first frame */
let morphClicks = false;
/* a switch covers the page: Chrome sends every click during it to <html> (pointer-events can't change that), so quick
   clicks — a second tab right after the first — were lost (2026-10-27). Such a click cuts the switch short and goes to
   what is under the pointer once the real page is back */
/** @param {MouseEvent} e */
function clickThrough(e) {
  const vt = morphNow;
  if (!vt || e.target !== document.documentElement) return;
  e.stopPropagation();
  // found now, where the pointer is (the tab bar may still be gliding): the smallest control under it
  /** @type {HTMLElement | null} */
  let hit = null,
    area = Infinity;
  for (const c of /** @type {NodeListOf<HTMLElement>} */ (
    document.querySelectorAll("button, a, label, input, select, [role='button']")
  )) {
    const r = c.getBoundingClientRect();
    if (!r.width || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
    if (r.width * r.height < area) [hit, area] = [c, r.width * r.height];
  }
  if (!hit) return;
  vt.skipTransition();
  vt.finished.finally(() => hit.click());
}
/** @param {() => void} fn the switch itself */
export function layMorph(fn) {
  const h = document.documentElement,
    me = ++morphs;
  let ended = false;
  const end = () => {
    if (ended || me !== morphs) return; // a newer switch cut this one short: the classes are its now
    ended = true;
    h.classList.remove("laymorph");
    snapHold("layout", 300);
  }; /* glides stay off a moment longer: late re-measures (the editor's) must not glide after the switch */
  setTimeout(
    end,
    1500,
  ); /* whatever happens to the transition (skipped, a hidden window pausing frames), the glides come back */
  snapHold("layout", 1500); // until it ends (end() shortens it) — the safety timeout's length
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    fn();
    end();
    return;
  }
  h.classList.add("laymorph");
  try {
    const vt = document.startViewTransition(fn);
    morphNow = vt;
    vt.ready.catch(() => {}); // cut short by a click (skipTransition): not an error
    vt.finished.finally(() => {
      if (morphNow === vt) morphNow = null;
      end();
    });
    if (!morphClicks) {
      morphClicks = true;
      document.addEventListener("click", clickThrough, true);
    }
  } catch (e) {
    fn();
    end();
  }
}
/* the stage where the layout puts it — without a tab switch's ride (its view's transform is plate.js switchGlide's):
   measured mid-ride, the prompt column's Vertical shift jumped 24 px for a frame (2026-10-28) */
export function stageRect() {
  const st = $("stage"),
    r = st.getBoundingClientRect(),
    v = st.closest(".view"),
    t = v ? getComputedStyle(v).transform : "none";
  if (t === "none") return r;
  const m = new DOMMatrix(t);
  return new DOMRect(r.left - m.e, r.top - m.f, r.width, r.height);
}
export function sizeFrame() {
  if (lay.frameDefer) {
    lay.framePending = true;
    return;
  } /* inside one click: once, at the end (it measures the page) */
  const app = /** @type {HTMLElement} */ (document.querySelector(".app")),
    stk = app.classList.contains("stacked");
  const ins = insets();
  {
    /* the page's insets (layoutmath.js pageInsets) — room for the status row and the edit buttons only while the page
       keeps them; the same decider shows them (2026-10-31: the row's room used to be kept always, used or not) */
    const was = lay.row,
      wasView = lay.rowView;
    lay.row = ins.row ? "bar" : "none";
    lay.rowView = S.view;
    lay.ins = `${ins.row}:${ins.tools}`;
    document.body.classList.toggle("norow", !ins.row);
    document.body.classList.toggle("notools", !ins.tools);
    /* the row comes and goes on the layout's clock, as the box makes or gives back its room — inside the picture's view
       only: a switch between views fades it with everything else (plate.js switchGlide) */
    if (was && was !== lay.row && wasView === "gen" && S.view === "gen") rowFade(ins.row);
  }
  const j = onShow() || current();
  const ar = j ? j.ar : S.ar;
  if (!stk && !lay.frameHold) layApply(layNow());
  /* Vertical: the picture's area (and Queue / LoRAs / PNG Info) is a centred column no wider than a 16:9 picture at the
    height it has (plus its button column each side), never narrower than the tab bar or the prompt box — not edge to edge */
  {
    const rt = $("right");
    if (stk) {
      /* its width from the picture's height WITHOUT the status row's room: a render starting or ending doesn't
         change it (its width glided on CSS's clock while the frame moved on its own: G6) */
      const hh = picH(true),
        most = app.clientWidth - 2 * SPACE.area;
      /* a panel (Queue, LoRAs, PNG Info): its own width for this page in Vertical — set with its side edges; by
         default a 1:1 plate at the room's height — never narrower than the tab bar, never wider than the window */
      lay.colW =
        S.view === "gen"
          ? stackColumnW(most, minRight(), stackW(), hh, toolsClear(hh), true)
          : Math.round(
              lay.vw ??
                within(
                  paneSize().w ?? paneDef(pageId(), "vert", roomH()).w ?? roomH(),
                  paneLimits(pageId(), "w", { o: "vert", roomH: roomH() }),
                ),
            );
      rt.style.width = lay.colW + "px";
    } else {
      if (rt.style.width) rt.style.width = "";
      lay.colW = 0;
    }
    /* every page's plate shares one top and bottom (2026-11-01, G10): in Vertical the panels' box is the picture's
       room (roomH — down to an even gap above the prompt's name), not what the column's CSS leaves: they ended ~6–12 px
       apart and the plate moved on every switch. Side by side the room IS the panel's box: nothing to set */
    lay.vroom = stk ? Math.round(roomH()) : 0; // Vertical: the picture's room (promptFollow: the prompt follows it up)
    /* the panel's box (v0.7c: Queue, LoRAs and PNG Info have a height of their own, set with their top / bottom edges):
       its room is the picture's (every page's plate shares one top and bottom when it's the whole room); a shorter
       one rests centred side by side, at the top in Vertical (the layout's anchor); held, lay.ph / lay.ptop. ONE
       writer of its height and offset, and of where its edge handles go (--pt / --pb on the area). The tab bar rides
       on its plate (plate.js barFor), so the tabs come down with a shorter panel. */
    const rp = $("rpanel"),
      cur = parseFloat(rp.style.marginTop) || 0,
      room = stk ? lay.vroom : Math.round(rt.clientHeight - (rp.offsetTop - cur)),
      panel = S.view !== "gen",
      kept = panel ? paneSize().h : null,
      H = panel ? Math.round(lay.ph ?? (kept ? within(kept, paneLimits(pageId(), "h", { roomH: room })) : room)) : null,
      top = panel && H != null ? Math.round(lay.ptop ?? (stk ? 0 : (room - H) / 2)) : 0,
      h = H != null ? H + "px" : stk ? lay.vroom + "px" : "",
      mt = top ? top + "px" : "";
    if (rp.style.height !== h) rp.style.height = h;
    if (rp.style.marginTop !== mt) rp.style.marginTop = mt;
    const fx = H != null && !stk ? "none" : ""; // side by side it grows to the room (flex: 1) unless it has a height
    if (rp.style.flex !== fx) rp.style.flex = fx;
    rt.style.setProperty("--pt", rp.offsetTop + "px");
    rt.style.setProperty("--pb", rp.offsetTop + rp.offsetHeight + "px");
    lay.proom = room;
  }
  /* the target geometry, not a measurement: the grid may be mid-glide */
  const st = stageRect(),
    SW = stk ? (lay.colW ? lay.colW - 2 : st.width) : /** @type {Geometry} */ (lay.last).rw; // wide: layApply above has set it
  const f = $("frame"); /* Vertical: the column's target width (it may be mid-glide), less the panel's 1 px borders */
  const PH = picH(),
    TB = tbW(PH), // the edit buttons' column: it hangs outside the plate (no room in the area — toolsClear)
    R = ins.row ? rowRoom() : 0, // (lay.vrow: the prompt follows the row's room too, Vertical)
    M = SPACE.mat, // the picture's mat: the plate is the picture and M round it
    { w, h } = fitInBox(ar, SW - 2 * M, PH - 2 * M),
    W = w + 2 * M, // the plate
    H = h + 2 * M;
  /* the picture's canvas is drawn at the box's FINAL size and centred in it: the box may glide to a new shape (its
    edges clip the picture, like a container transform) without the canvas being stretched on the way */
  /* a held top / bottom edge (lay.vtop): the other edge stays put. The plate is centred in its area on every page; the
    button column hangs on the side away from the prompt (Vertical: on the right) */
  lay.vrow = stk ? R : 0;
  const tbLeft = !stk && /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright"),
    { top, left } = framePlacement({
      areaW: SW,
      areaH: roomH(),
      w: W,
      h: H,
      tb: 0,
      row: R,
      heldTop: lay.vtop,
      stacked: stk,
      toolsLeft: tbLeft,
    });
  Object.assign(f.dataset, { tw: w, th: h, tl: left + M, tt: top + M });
  /* where the frame belongs (the plate's place, less the mat); framebox.js moves it there (a glide, a jump, or where a
     crop-and-reveal lands) */
  frameGoal({ l: left + M, t: top + M, w, h });
  /* the edit buttons' column: its width and side are the layout's; WHERE it sits is the frame's (around.js) */
  const gt = $("gtools");
  gt.style.width = TB + "px";
  gt.classList.toggle("lefty", tbLeft);
  /* where the picture is going (not where it is mid-glide): the prompt's vertical anchors use this */
  lay.target = { top: st.top + top, h: H, bottom: st.top + top + H + (R ? R - 1 : 0), w: W }; // the plate: the edge you see
  /* the area's handles sit on the picture's edges in Generating (the edges you see): the outer one on its outer edge,
     the divider's on the edge by the prompt — the area is the whole stage, the picture centred in it */
  {
    const ro = /** @type {HTMLElement | null} */ (document.querySelector(".pedge.ro")),
      ri = /** @type {HTMLElement | null} */ (document.querySelector(".pedge.ri")),
      on = !stk && S.view === "gen",
      outer = tbLeft ? left : SW - (left + W),
      inner = tbLeft ? SW - (left + W) : left;
    if (ro) {
      ro.style.right = on && !tbLeft ? outer - 6 + "px" : "";
      ro.style.left = on && tbLeft ? outer - 6 + "px" : "";
    }
    if (ri) {
      ri.style.left = on && !tbLeft ? inner - SPACE.part + "px" : "";
      ri.style.right = on && tbLeft ? inner - SPACE.part + "px" : "";
    }
  }
  /* while an edge is held or hovered: an outline round the picture itself, an even 5 px out (the edges you drag are
    the picture's own; the box it may fill showed as a frame floating off the picture) */

  /* Vertical: the picture block sits between two equal gaps — roomH() ends one even gap above the prompt's name */
  vAlign();
  /* the tab bar: as wide as its buttons; where it sits is the plate's business (plate.js placeBar — one owner) */
  /* the status row, Show prompt, the edit buttons and the edge strips: placed from where the frame is now, and every
     frame it moves (around.js — one owner: the frame) */
  placeAround();
  promptFollow(); // its other input: the room (lay.vroom / lay.vrow) — the frame's writes call it on every box change
  requestAnimationFrame(layoutLeft);
  plateFollow(); // the live plate keeps to the frame / the panel through the glide
}
/* Vertical: the prompt-slot line, just above the title, clear of the picture's bottom edge. The prompt column itself
   stays where the page puts it — at the bottom; the picture's room ends one even gap above its name (roomH). It used
   to be shifted UP under the picture to make that gap (2026-10-31: the window's bottom stayed empty, and the shift's
   transform put the pill menus under the picture) */
export function vAlign() {
  if (!document.querySelector(".app.stacked")) return;
  const { pn, colTop } = nameTop();
  /* the ONE divider between the picture and the prompt (2026-11-01, L4): the whole gap from the picture's room down to
     just above the name — the picture's bottom-edge strip used to share it (and won nowhere, overlapped) */
  const A = evenGap(),
    hs = $("hsplit").style;
  hs.top = pn - A - colTop + "px";
  hs.height = Math.max(6, A - 2) + "px";
  /* the prompt's grip zone starts under the split line (cardlayout.js, prompt.css .pgrip) */
  $("lcol").style.setProperty("--gtop-v", pn - colTop - 2 + "px");
}
/* ---------- the prompt column's place has ONE owner (2026-10-28) ----------
   Its transform = its hug of the picture (below) + what is left of a tab switch's slide, written here only. Two
   writers used to set it: vAlign's inline style, and a switch's own animation that froze the shift it started with for
   650 ms (a re-shift meanwhile showed only at the end, as a jump) */
const colEase = bez(SWITCH.curve[0], SWITCH.curve[1], SWITCH.curve[2], SWITCH.curve[3]); // the switch's glide (plate.js)
let hugX = 0, // side by side in Generating: in by the picture's inset in its area (promptFollow)
  hugY = 0, // Vertical in Generating: up by the room the picture leaves under it (promptFollow)
  hugFrom = 0, // …catching up after a hold: from, to, since when (0: not catching up)
  hugTo = 0,
  hugFromY = 0,
  hugToY = 0,
  hugT0 = 0,
  slX = 0, // the slide: how far from its place it started, and when
  slY = 0,
  slT0 = 0,
  colX = 0, // the offset written last (taken off a measurement to find where the column is laid out)
  colY = 0,
  colRaf = 0;
/** how much of the slide is still to go, 1 → 0 @param {number} now */
function slideLeft(now) {
  return slT0 ? 1 - colEase(Math.min(1, Math.max(0, now - slT0) / SWITCH.ms)) : 0;
}
function colApply() {
  colRaf = 0;
  const now = performance.now();
  if (hugT0) {
    const p = Math.min(1, (now - hugT0) / layT());
    hugX = Math.round(hugFrom + (hugTo - hugFrom) * colEase(p));
    hugY = Math.round(hugFromY + (hugToY - hugFromY) * colEase(p));
    if (p >= 1) hugT0 = 0;
  }
  const k = slideLeft(now),
    x = hugX + Math.round(slX * k),
    y = hugY + Math.round(slY * k),
    t = x || y ? `translate(${x}px, ${y}px)` : "",
    col = $("lcol");
  colX = x;
  colY = y;
  if (col.style.transform !== t) col.style.transform = t;
  if (k > 0 || hugT0) colRaf = requestAnimationFrame(colApply);
  if (k <= 0) slT0 = 0;
}
/** a tab switch moved the column's place: it slides there from where it was on screen (measured before the switch —
 * mid-slide too, so a fast second switch carries on from there). Its place is worked out here, from the layout:
 * measured through the running slide's offset @param {DOMRect} was */
export function slideCol(was, t0 = performance.now()) {
  const r = $("lcol").getBoundingClientRect();
  slX = Math.round(was.left - (r.left - colX + hugX)); // from where it was to its place (its hug included)
  slY = Math.round(was.top - (r.top - colY + hugY));
  slT0 = slX || slY ? t0 : 0;
  cancelAnimationFrame(colRaf);
  colApply();
}
/* side by side in Generating the prompt sits a pair gap from the PICTURE: the area is the whole stage and the picture
   is centred in it (2026-10-31, ownership map G6 — the area used to hug the picture and glide its grid columns on CSS's
   clock while the frame moved on its own: two clocks, a wobble). The column moves in by the plate's inset, worked out
   from the frame's box every time the frame is written (framebox.js) — the frame's clock. It holds while an edge is
   dragged (the edge stays under the pointer) and while you work in the prompt — a press in it, one of its menus open:
   nothing moves under the cursor (the layout's rule; the hug ignored it at first, 2026-10-31). Letting go it catches
   up on the layout's glide — nothing else moves then; a moving frame takes it over frame by frame
   @param {boolean} [direct] the frame is being written now: follow it exactly (else: glide to where it belongs) */
export function promptFollow(direct = false) {
  /* an edge being dragged is NOT working in the prompt (the divider's handle sits in it): the prompt follows the
     picture through it — held, the picture slid under the prompt (2026-11-01) */
  if (!lay.drag && (lay.pressCard || document.querySelector("#left .pop.show"))) return;
  const b = frameBox(),
    app = /** @type {HTMLElement} */ (document.querySelector(".app")),
    stk = app.classList.contains("stacked"),
    on = !!b && S.view === "gen" && !stk && !!lay.last,
    R = app.classList.contains("pright");
  let x = 0,
    y = 0;
  /* Vertical: the picture sits at the top of its room; the prompt comes up by the room it leaves under it (and under
     its status row), so they touch — the spare height goes to the window's bottom (2026-11-01) */
  if (b && stk && S.view === "gen" && lay.vroom)
    /* glued under the picture's KEPT bottom: the rubber band is the grabbed edge's feedback only — nothing round it
       follows the overshoot (2026-11-02, the user: the prompt twitched) */
    y = -Math.round(Math.max(0, lay.vroom - (b.t + b.h - (lay.overB || 0) + SPACE.mat + lay.vrow)));
  if (on && b && lay.last) {
    const M = SPACE.mat,
      inset = R ? (lay.shown || lay.last).rw - (b.l + b.w + M) : b.l - M; // the area as it is on screen now (G12)
    x = Math.round(Math.max(0, inset)) * (R ? -1 : 1);
  }
  const b2 = document.body.classList;
  if (direct || b2.contains("laysnap") || b2.contains("liveresize") || b2.contains("laydrag")) {
    hugT0 = 0;
    if (x === hugX && y === hugY) return;
    hugX = x;
    hugY = y;
  } else {
    if (x === (hugT0 ? hugTo : hugX) && y === (hugT0 ? hugToY : hugY)) return;
    hugFrom = hugX;
    hugTo = x;
    hugFromY = hugY;
    hugToY = y;
    hugT0 = performance.now();
  }
  if (!colRaf) colApply();
}
// live resize: everything follows the window edge directly; animations return ~150 ms after the last resize event

/** @type {number | undefined} */
let lrT; // the window-resize class's timer

/* start-up wiring: the holds (pointer over the picture, a press in the prompt), the edges' outline, window resize (called from main.js, in order) */
export function initLayout() {
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
  $("lcol").addEventListener("pointerdown", e => {
    if (!(e.target instanceof Element && e.target.closest(HANDLES))) lay.pressCard = true; // a handle is resizing
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
  /* widths, the picture's limits (iw, ih) — all back to the defaults */
  delete S.lw;
  S.pos = "mid";
  S.hmode = "";
  updHm();
  applyPH();
  save();
  sizeFrame();
  moveThumb(true);
  layoutLeft();
}
