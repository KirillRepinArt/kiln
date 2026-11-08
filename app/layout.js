// @ts-check
/** @typedef {import("./types.js").Geometry} Geometry @typedef {import("./types.js").LayoutPrefs} LayoutPrefs */
import { SWITCH, glueRect, plateFollow } from "./plate.js";
import { placeAround } from "./around.js";
import { movingTo, rearrange, rearrangeFade } from "./rearrange.js";
import { frameBox, frameGoal, layT } from "./framebox.js";
import { syncH } from "./boot.js";
import { applyMode, applyPH, layoutLeft, lyReset, slotLeast, stackW, updHm } from "./cardlayout.js";
import { $ } from "./dom.js";
import { glassFade } from "./fade.js";
import { HANDLES } from "./outlines.js";
import { current, jobs } from "./jobs.js";
import {
  glueAnchors,
  glued,
  relationFade,
  relationOf,
  PWMIN,
  layoutPass,
  limits,
  paneDefault,
  bez,
  fitInBox,
  layoutPrefsV4,
  framePlacement,
  pageGeometry,
  pageInsets,
  stackColumnW,
  picLeastH,
  toolColumnW,
  upgradeLayoutPrefs,
} from "./layoutmath.js";
import { PV, onShow, picMode } from "./picstate.js";
import { S, save } from "./state.js";
import { forgeOk } from "./sync.js";
import { moveThumb, tabGo } from "./tabs.js";
import { SPACE, pairGap } from "./tokens.js";

/* Kiln · the page layout: the prompt and the picture area side by side or stacked, their widths and heights,
   the edges you drag, docking, and the holds that keep things still while you work */
/* a quick fade-through; the picture morphs if it's on both sides */

/* the status block under the picture: the part gap + track 10 + 7 + status row 36 (a caption: 6 + row 36 + 4;
   nothing: 24) */
export const BAR = () => SPACE.part + 10 + 7 + 36;
/* the status row coming or going inside the picture's view: contents that don't travel, so it fades on the
   rearrangement's plan with the frame (rearrange.js: one start time; it leaves by the swap, the picture grows into its
   room after it — the tab switch's order). ONE place (tabs.js faded it on its own for a switch) */
/** @param {boolean} on */
function rowFade(on) {
  rearrangeFade($("prog"), on); // on the rearrangement's plan: it leaves before the picture grows into its room (T2a)
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
/* the edit buttons' column beside the picture: one column, always (layoutmath.js toolColumnW, picLeastH) */
export function tbW() {
  return toolColumnW();
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
/** set (or with null, forget) your size of a pane @param {"box" | PageId} pane @param {"w" | "h" | "s"} axis
 * @param {number | null} v @param {Orient} [o] */
export function setPaneSize(pane, axis, v, o = orient()) {
  const P = paneSize(pane, o);
  P[axis] = v == null ? null : axis === "s" ? v : Math.round(v); // a scale is a share, not px
  /* a picture's width or height forgotten (a double-click, the whole room): its scale too — the size it stands for
     (C2a; a reset left the scale and the picture stayed small, 2026-11-03) */
  if (v == null && axis !== "s" && pane !== "box" && "s" in P) P.s = null;
}
/* saved layouts of older versions → today's (once, at start-up: main.js); the sizes' own format on first use */
export function migrateLayoutPrefs() {
  if (S.lay && S.lay.v !== 4) S.lay = upgradeLayoutPrefs(S.lay, layW());
  delete S.sch; // Vertical's kept prompt height (2026-11-01: the box hugs its text; the divider sizes the picture)
  delete S.pph; // a kept prompt height side by side (2026-11-02, DD-2026-11-02-12: the box's height is its text's)
  delete S.vfit; // Vertical's own fit flag (2026-11-02, DD-2026-11-02-16: one mode set, S.hmode, on the cross axis)
  /* side by side, a picture page's size is a scale of its largest (v0.7c C2a, DEVLOG DD-2026-11-03-4): the px caps,
     made on one picture's ratio, limited the next — dropped once, so every picture starts at its biggest */
  const L4 = S.lay && S.lay.v === 4 ? /** @type {import("./layoutmath.js").LayoutV4} */ (S.lay) : null;
  if (L4 && (L4.side.scaled ?? 0) < 2) {
    for (const id of /** @type {const} */ (["generating", "gallery"]))
      Object.assign(L4.side.pages[id], { w: null, h: null, s: null }); // 2: again — px caps a drag left (fixed 2026-11-03)
    L4.side.scaled = 2;
  }
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
  pass: null,
  pdrag: null,
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
  /* the column's own place: its layout box, without ANY transform (its rect minus colY still counted a running
     switch's offset: a layout switch into Vertical laid the picture out 624 px narrow until the switch ended) */
  const col = $("lcol"),
    colTop = /** @type {HTMLElement} */ (col.offsetParent).getBoundingClientRect().top + col.offsetTop,
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
/* side by side, the room a page has: the column's (#right) under the panel box's top — the same on every page. ONE
   definition (the picture's room and a panel's): measured from the stage it was the panel box's height, which on the
   way from a shortened Queue still had the Queue's (cleared later in the same sizeFrame) — the picture was laid out at
   the Queue's height for the switch, then snapped to its size (the user, 2026-11-03) */
function sideRoom() {
  const rp = $("rpanel");
  return Math.round($("right").clientHeight - (rp.offsetTop - (parseFloat(rp.style.marginTop) || 0)));
}
/* side by side, where that room starts on screen (the window's px): the same box sideRoom measures, so a picture page
   and a panel share it — the layout pass's numbers are the window's on both axes */
function sideRoomTop() {
  const rt = $("right"),
    rp = $("rpanel");
  return rt.getBoundingClientRect().top + rt.clientTop + (rp.offsetTop - (parseFloat(rp.style.marginTop) || 0));
}
function roomH() {
  if (!document.querySelector(".app.stacked")) return sideRoom();
  const st = stageRect();
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
  return cap ? Math.max(picLeastH(), Math.min(full, cap)) : full;
}
/* the clearance the edit buttons need beyond the window's own margin (they hang outside the plate, never room in the
   area — kept whether they show or not, so nothing moves when they come) */
function toolsClear() {
  return Math.max(0, tbW() - SPACE.area);
}
/** @typedef {import("./layoutmath.js").Rect} Rect */
/** the single layout pass side by side (v0.7c C2a; panels too since C2a's rest, 2026-11-07;
 * ux-review/16-layout-pass.md): the numbers — a picture's size (a scale of its largest) and the edit buttons' strip
 * (on its outer side only, part of its pane), a panel's width and height, the box's width, where the pair sits — come
 * from it; the appliers (colsWrite, framebox, sizeFrame's panel box, plate) write them (C2b: one applier). While an
 * edge is held (lay.pdrag), from the sizes at its press and the pointer (C3). A px cap an older version left on a
 * picture page is read once as the scale it gives this picture. */
function sidePass() {
  const roomTop = sideRoomTop(),
    barH = /** @type {HTMLElement} */ (document.querySelector(".tabs")).offsetHeight,
    barGap = Math.max(0, roomTop - SPACE.area - barH),
    dr = lay.pdrag, // an edge held: the pass computes from the sizes at its press and the pointer (C3)
    pic = S.view === "gen",
    p = paneSize(),
    df = layDef(),
    room = pic ? picFull() : sideRoom(),
    strip = pic ? tbW() : 0, // one column, never the picture's height's (picLeastH; DD-2026-11-07-2)
    run = (/** @type {import("./layoutmath.js").PassState["page"]} */ page) =>
      layoutPass({
        W: innerWidth,
        H: innerHeight,
        dock: /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright")
          ? "right"
          : "left",
        page,
        box: { w: dr ? dr.boxW : (paneSize("box", "side").w ?? df.pw), wLo: PWMIN, text: 0, least: 0 },
        /* the bar's row as it is on screen (the room's top): the pass's numbers are the window's, on both axes */
        bar: { w: tabsW(), h: barH },
        strip,
        gap: { area: SPACE.area, pair: pairGap(), bar: barGap },
        picLeast: picLeastH(),
        roomH: room,
        drag: dr ? { edge: dr.edge, at: dr.at } : null,
      });
  if (!pic) {
    /* a panel: its width and height are yours (by default a 2:3 plate at the room's height), within its limits */
    const lw = paneLimits(pageId(), "w", { o: "side" }),
      lh = paneLimits(pageId(), "h", { roomH: room });
    return {
      out: run({
        kind: "panel",
        w: dr ? (dr.w ?? df.rw) : (p.w ?? df.rw),
        h: dr ? (dr.h ?? room) : (p.h ?? room),
        lo: { w: lw.lo, h: lh.lo },
        hi: { w: lw.hi, h: lh.hi },
      }),
      strip,
      roomTop,
    };
  }
  const j = onShow() || current(),
    [a, b] = (j ? j.ar : S.ar).split(":").map(Number),
    ratio = a / b;
  /** @type {number | undefined} */
  let scale = dr ? dr.scale : (p.s ?? undefined);
  if (!dr && (p.w || p.h)) {
    /* a px cap from an older version: the share of this picture's largest, kept as the scale — once */
    const big = run({ kind: "pic", ratio, scale: undefined }).largest;
    scale = Math.min(1, (p.w ?? Infinity) / big.w, (p.h ?? Infinity) / big.h);
    setPaneSize(pageId(), "w", null);
    setPaneSize(pageId(), "h", null); // (clears the scale: set after)
    setPaneSize(pageId(), "s", scale >= 0.999 ? null : scale);
    save();
  }
  return { out: run({ kind: "pic", ratio, scale }), strip, roomTop };
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
  /* a picture page side by side: the pass's numbers (C2a) in a STILL area (G6, 2026-10-31; kept 2026-11-03): the
     columns don't hug the picture — the box's column at the room's edge, the area the whole rest — so a ratio change
     moves nothing but the picture (on the frame's clock), and the box follows it on that clock to the pass's place
     (promptFollow). Hugging columns resized the area on CSS's clock while the picture moved on its own: the plate
     and the tab bar wobbled (the ownership tour's reversals, insets › stageStaysPutPromptHugs) */
  if (!document.querySelector(".app.stacked")) {
    const { out, strip, roomTop } = sidePass();
    lay.pass = {
      pic: out.pic,
      page: out.page,
      box: out.box,
      strip,
      largest: out.largest,
      kept: out.kept,
      handles: out.handles,
      roomTop,
    };
    /* every page: the area is the WHOLE ROOM and never moves (one coordinate space, DEVLOG DD-2026-11-08-1); the
       page's pane sits in it where the pass says (a picture: framebox; a panel: sizeFrame), and the box — a layer over
       the same room, its own width — is glued one gap from the pane's live plate (promptFollow). The area used to be
       the room less the box's column: it moved whenever the box's width changed, and every motion converted between
       the two (3–10 px drifts mid-motion, 2026-11-07) */
    return { pw: out.box.w, rw: W, mL: 0, mR: 0, W, minR, off: 0, gen, clear: 0 };
  }
  lay.pass = null;
  /* Generating's area is the whole stage the prompt leaves (no hug: ownership map G6) — the picture is centred in it
     and the prompt follows the picture instead (promptFollow) */
  return pageGeometry(
    {
      W,
      gen,
      minR,
      clear: gen ? toolsClear() : 0,
      promptRight: /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright"),
    },
    L,
  );
}
/* ---------- the box's width moves on the rearrangement's clock, here (G12; one coordinate space since 2026-11-08) ----------
   It glided on CSS's clock (a transition on the grid's columns) while the prompt's follow offset was worked out from
   where they were GOING. Now the rearrangement writes it every frame on the plan's curve and time (rearrange.js), and
   says what it is (lay.shown) to what follows it, in the same frame. It is the box's own width (--cw) — no grid column:
   nothing else moves with it */
/** @typedef {{ pw: number }} BoxW the box's width side by side, as written */
/** @param {BoxW} c */
function boxWWrite(c) {
  const st = /** @type {HTMLElement} */ (document.querySelector(".app")).style;
  st.setProperty("--cw", Math.round(c.pw * 10) / 10 + "px");
  lay.shown = c;
}
/** where the page area starts in the window (its px are the window's less this): the room's edge — the area is the
 * whole room and never moves (DD-2026-11-08-1), so nothing converts mid-motion */
export function areaX() {
  return SPACE.area;
}
/** @param {Geometry} g */
function layApply(g) {
  const to = { pw: g.pw };
  lay.last = Object.assign({}, g, { off: 0 });
  const going = movingTo("boxw"),
    was = going ? { pw: going.w } : lay.shown;
  if (was && was.pw === to.pw) return;
  if (!lay.shown || document.querySelector(".app.stacked")) return boxWWrite(to); // Vertical: --sw is its width
  /* on the rearrangement's plan and clock, with the frame or the panel (T2a): the box's width as a box on the x axis */
  const box = (/** @type {BoxW} */ c) => ({ l: 0, t: 0, w: c.pw, h: 0 });
  rearrange("boxw", box(lay.shown), box(to), b => boxWWrite({ pw: b.w }));
}
/* what to apply now. Holds last only while you're doing something, and the layout adjusts the moment you finish:
   flipping with the arrows on the picture holds it (so "next" stays under the cursor) until ~1 s after the last flip;
   a menu open in the prompt box (ratio, size…) or a press in it holds the prompt in place until you let go. */
function layNow() {
  const g = layGeo();
  if (!lay.last || lay.drag) return g;
  /* (a top / bottom edge held used to freeze the area's width until release: the picture couldn't grow into room it
     had, then jumped — 2026-11-02, the user. Held, the layout computes from the held size like every other drag.) */
  /* working in the prompt (a press in it, one of its menus open): the box keeps its width — its place holds too
     (promptFollow) */
  if (lay.pressCard || document.querySelector("#left .pop.show")) g.pw = lay.last.pw;
  return g;
}
/* ---------- an edge drag side by side goes through the layout pass (v0.7c C3; panels: C2a's rest) ----------
   ONE way for every edge of the pair (the box's outer edge, the shared edge, the page's outer, top and bottom edges —
   a picture or a panel): the press freezes the sizes at rest, the pointer is the drag's constraint, and the pass alone
   gives every number, held or not — the page's size and place, the box's width, what a release keeps. Before, each edge had
   its own maths (layDrag's pin and slack, the top / bottom's lay.vh) and the picture's place while held came from a
   centring in the area (B18: it slid 53 px toward the box). Release keeps the pass's `kept`: the box's width, the
   picture's scale of its largest — nothing glides back on a centred axis (DEVLOG DD-2026-11-03-6). */
/** @param {string} edge the pass's handle id ("box.left", "shared", "page.top", …) @param {number} pointer the pointer
 * on the edge's axis (window px) @returns {boolean} false: not a picture page side by side (the caller's own path) */
export function passDragStart(edge, pointer) {
  const P = lay.pass,
    h = P && P.handles[edge];
  if (!P || !h || document.querySelector(".app.stacked")) return false;
  const y = edge.endsWith(".top") || edge.endsWith(".bottom"),
    line = y ? h.y + h.h / 2 : h.x + h.w / 2;
  lay.pdrag = {
    edge,
    at: line,
    off: line - pointer,
    boxW: P.box.w,
    scale: P.kept.scale ?? 1,
    w: P.kept.w,
    h: P.kept.h,
  };
  lay.drag = true;
  return true;
}
/** @param {number} pointer the pointer on the edge's axis (window px) */
export function passDragMove(pointer) {
  if (!lay.pdrag) return;
  lay.pdrag.at = pointer + lay.pdrag.off;
  sizeFrame();
}
export function passDragEnd() {
  const d = lay.pdrag,
    k = lay.pass && lay.pass.kept;
  lay.pdrag = null;
  lay.drag = false;
  if (d && k) {
    /* what the edge changed: an outer edge only its own pane (DD-2026-11-07-1), the shared edge both */
    if (d.edge === "shared" || d.edge.startsWith("box.")) setPaneSize("box", "w", k.boxW, "side");
    const page = d.edge === "shared" || d.edge.startsWith("page."),
      tall = d.edge === "page.top" || d.edge === "page.bottom";
    if (page && k.scale != null) {
      /* a picture: its scale of its largest */
      setPaneSize(pageId(), "w", null);
      setPaneSize(pageId(), "h", null); // (clears the scale: set after)
      setPaneSize(pageId(), "s", k.scale >= 0.999 ? null : k.scale);
    } else if (page && tall && k.h != null)
      setPaneSize(pageId(), "h", k.h >= sideRoom() - 1 ? null : k.h); // a panel's height (the whole room: none of its own)
    else if (page && k.w != null) setPaneSize(pageId(), "w", k.w, "side"); // a panel's width
    save();
  }
  sizeFrame();
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
  tabGo(() => {
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
  }, true); // a layout switch: the tab switch's system (T2b; it was a View Transition)
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
/** a panel's box side by side, where it is now (the window's px); null: not a panel side by side
 * @type {{ l: number, t: number, w: number, h: number } | null} */
let panelAt = null;
/** @param {string} h @param {string} mt @param {string} w @param {string} ml */
function panelStyle(h, mt, w, ml) {
  const rp = $("rpanel"),
    rt = $("right");
  if (rp.style.height !== h) rp.style.height = h;
  if (rp.style.marginTop !== mt) rp.style.marginTop = mt;
  if (rp.style.width !== w) rp.style.width = w;
  if (rp.style.marginLeft !== ml) rp.style.marginLeft = ml;
  rt.style.setProperty("--pt", rp.offsetTop + "px"); // where its top / bottom handles go
  rt.style.setProperty("--pb", rp.offsetTop + rp.offsetHeight + "px");
}
/** the panel's box side by side, from the window's px @param {{ l: number, t: number, w: number, h: number }} b
 * @param {number} roomTop where its room starts in the window */
function panelWrite(b, roomTop) {
  panelAt = b;
  const r = (/** @type {number} */ v) => Math.round(v) + "px";
  panelStyle(r(b.h), b.t - roomTop ? r(b.t - roomTop) : "", r(b.w), r(b.l - areaX()));
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
          ? stackColumnW(most, minRight(), stackW(), hh, toolsClear(), true)
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
      room = stk ? lay.vroom : sideRoom(),
      panel = S.view !== "gen",
      kept = panel ? paneSize().h : null,
      sp = panel && !stk ? lay.pass : null, // side by side: the layout pass's (C2a's rest), held or not
      H = panel
        ? Math.round(
            sp ? sp.page.h : (lay.ph ?? (kept ? within(kept, paneLimits(pageId(), "h", { roomH: room })) : room)),
          )
        : null,
      top = panel && H != null ? Math.round(sp ? sp.page.y - sp.roomTop : (lay.ptop ?? 0)) : 0,
      fx = H != null && !stk ? "none" : ""; // side by side it grows to the room (flex: 1) unless it has a height
    if (rp.style.flex !== fx) rp.style.flex = fx;
    lay.proom = room;
    if (sp) {
      /* side by side a panel is the pass's box, in the window's px: it moves there on the rearrangement's plan and clock
         (B16: a double-click or a Reset snapped it) — the area's px are the window's less one constant (areaX) */
      const to = { l: sp.page.x, t: sp.page.y, w: sp.page.w, h: sp.page.h },
        roomTop = sp.roomTop;
      if (panelAt) rearrange("panel", panelAt, to, b => panelWrite(b, roomTop));
      else panelWrite(to, roomTop);
    } else {
      /* a picture page (the whole area) or Vertical: at once */
      panelAt = null;
      panelStyle(H != null ? H + "px" : stk ? lay.vroom + "px" : "", top ? top + "px" : "", "", "");
    }
  }
  /* the target geometry, not a measurement: the grid may be mid-glide */
  const st = stageRect(),
    SW = stk ? (lay.colW ? lay.colW - 2 : st.width) : /** @type {Geometry} */ (lay.last).rw; // wide: the whole room
  const f = $("frame"); /* Vertical: the column's target width (it may be mid-glide), less the panel's 1 px borders */
  const pass = !stk && S.view === "gen" && lay.pass && lay.pass.pic ? lay.pass : null, // side by side: the pass's
    PH = pass && pass.pic ? pass.pic.h : picH(),
    TB = pass ? pass.strip : tbW(), // the edit buttons' column: side by side, part of the picture's pane (C2a)
    R = ins.row ? rowRoom() : 0, // (lay.vrow: the prompt follows the row's room too, Vertical)
    M = SPACE.mat, // the picture's mat: the plate is the picture and M round it
    { w, h } =
      pass && pass.pic ? { w: pass.pic.w - 2 * M, h: pass.pic.h - 2 * M } : fitInBox(ar, SW - 2 * M, PH - 2 * M),
    W = w + 2 * M, // the plate
    H = h + 2 * M;
  /* the picture's canvas is drawn at the box's FINAL size and centred in it: the box may glide to a new shape (its
    edges clip the picture, like a container transform) without the canvas being stretched on the way */
  /* a held top / bottom edge (lay.vtop): the other edge stays put. The plate is centred in its area on every page; the
    button column hangs on the side away from the prompt (Vertical: on the right) */
  lay.vrow = stk ? R : 0;
  const tbLeft = !stk && /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright"),
    { top: placedTop, left: placedLeft } = framePlacement({
      areaW: SW,
      areaH: roomH(),
      w: W,
      h: H,
      tb: !stk && S.view === "gen" && lay.pass ? lay.pass.strip : 0, // the strip is in the area (C2a), held or not
      row: R,
      heldTop: lay.vtop,
      stacked: stk,
      toolsLeft: tbLeft,
    });
  let left = placedLeft,
    top = placedTop;
  /* side by side at rest the picture's place across its area is the pass's: its strip on the outer side (C2a) — not a
     centring inside the geometry last applied, which may be held or stale (the picture slid onto the box, 2026-11-03) */
  if (pass && pass.pic) {
    left = pass.pic.x - areaX(); // the area's px: the window's less the room's edge
    top = pass.pic.y - pass.roomTop; // held too: one source for the picture's place (B18: centred in the area while held)
  }
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
  /* the page's side handles: around.js placeSideEdges (from the plate as it moves; B11) */
  /* while an edge is held or hovered: an outline round the picture itself, an even 5 px out (the edges you drag are
    the picture's own; the box it may fill showed as a frame floating off the picture) */

  /* Vertical: the picture block sits between two equal gaps — roomH() ends one even gap above the prompt's name */
  vAlign();
  /* the tab bar: as wide as its buttons; where it sits is the plate's business (plate.js placeBar — one owner) */
  /* the status row, Show prompt, the edit buttons and the edge strips: placed from where the frame is now, and every
     frame it moves (around.js — one owner: the frame) */
  placeAround();
  promptFollow(); // its other input: the room (lay.vroom / lay.vrow) — the frame's writes call it on every box change
  layoutLeft(); // the box, in the same task as the picture it's anchored to: one rearrangement, one plan (T2)
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
let hugX = 0, // side by side: one gap from the plate, on every page (promptFollow)
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
  /* a relation change (a layout switch, T2c): the box rides the LIVE plate — its leaving copy by the old relation, the
     box itself by the new — on top of its place where it lands (its glue to where the plate lands) */
  let rx = 0,
    ry = 0;
  if (relation) {
    if (now - relation.t0 >= relation.T) relation = null;
    else {
      const p = $("plate").getBoundingClientRect(),
        live = { l: p.left, t: p.top, w: p.width, h: p.height },
        g0 = glued(live, relation.r0, relation.b0),
        g1 = glued(live, relation.r1, relation.b1),
        st = `translate(${Math.round(g0.l - relation.b0.l)}px, ${Math.round(g0.t - relation.b0.t)}px)`;
      if (relation.out.style.transform !== st) relation.out.style.transform = st;
      rx = Math.round(g1.l - relation.b1.l);
      ry = Math.round(g1.t - relation.b1.t);
    }
  }
  const k = slideLeft(now),
    x = hugX + Math.round(slX * k) + rx,
    y = hugY + Math.round(slY * k) + ry,
    t = x || y ? `translate(${x}px, ${y}px)` : "",
    col = $("lcol");
  colX = x;
  colY = y;
  if (col.style.transform !== t) col.style.transform = t;
  if (k > 0 || hugT0 || relation) colRaf = requestAnimationFrame(colApply);
  if (k <= 0) slT0 = 0;
}
/** the box's STAND-IN for a layout switch (DEVLOG DD-2026-11-08-5): a copy of what's on screen now — the name row, the
 * box, the LoRA chips — at their place and size, in a layer of its own over the page. The box itself is laid out where
 * it lands from the first frame, so everything that measures it measures the truth; what's seen leaving is the copy,
 * which nothing reads or writes. The platforms' rule for a leaving element: Android fades it in the ViewGroupOverlay
 * (out of the layout), UIKit fades a snapshotView(afterScreenUpdates: false). A copy of the elements, not a picture of
 * them: the glass's blur stays live (decision 0014). (Its old values held ON the box — DD-4 — had the layout measure
 * the old shape mid-switch: the page moved under the box while it was seen, the user 2026-11-08.) Made before the
 * change; fadeCol fades it out and removes it @returns {HTMLElement} */
export function standIn() {
  stand?.remove();
  const layer = document.createElement("div");
  layer.className = "lcol standin"; // .lcol: the parts' own rules (chips.css) hold for the copy too
  layer.inert = true;
  layer.setAttribute("aria-hidden", "true");
  /** @type {[Element, Element][]} */
  const pairs = [];
  for (const part of [$("ltitle"), $("left"), $("chips")]) {
    const r = part.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const c = /** @type {HTMLElement} */ (part.cloneNode(true));
    Object.assign(c.style, {
      position: "absolute",
      left: r.left + "px",
      top: r.top + "px",
      width: r.width + "px",
      height: r.height + "px",
      right: "auto",
      bottom: "auto",
      margin: "0",
      transform: "none",
      transition: "none",
      boxSizing: "border-box",
    });
    c.querySelectorAll(HANDLES).forEach(h => h.remove()); // what's seen only: the edges' handles are a gesture's, never seen
    const cs = c.querySelectorAll("*");
    pairs.push([part, c]);
    [...part.querySelectorAll("*")].filter(e => !e.closest(HANDLES)).forEach((e, i) => pairs.push([e, cs[i]]));
    layer.append(c);
  }
  document.body.append(layer);
  /* what cloning leaves out: ids (one of each in the page), scroll offsets and typed values */
  for (const [o, c] of pairs) {
    c.removeAttribute("id");
    if (o.scrollTop || o.scrollLeft) {
      c.scrollTop = o.scrollTop;
      c.scrollLeft = o.scrollLeft;
    }
    if (o instanceof HTMLInputElement || o instanceof HTMLTextAreaElement || o instanceof HTMLSelectElement)
      /** @type {HTMLInputElement} */ (c).value = o.value;
  }
  stand = layer;
  return layer;
}
/** @type {HTMLElement | null} the stand-in on screen now */
let stand = null;
/** @typedef {{ l: number, t: number, w: number, h: number }} Box4 */
/** a relation change running: since when, how long, the leaving copy and both relations with the box's rect on each
 * (the old one as it was, the new one where it lands) @type {{ t0: number, T: number, out: HTMLElement, b0: Box4,
 * r0: import("./layoutmath.js").Relation, b1: Box4, r1: import("./layoutmath.js").Relation } | null} */
let relation = null;
/** a layout switch (T2b, T2c-2): the prompt box stays GLUED to its partner's live plate and fades through its change
 * of RELATION (beside ↔ under; DEVLOG DD-2026-11-08-7 — the user: "box slides with it and fades first, then reappears
 * in the required position"): its stand-in rides the plate by the old relation and fades out early, gone ~2 frames,
 * then the box rides it by the new one and fades in as the plate lands (layoutmath.js relationFade — Material's
 * container transform). It sat still before, on the contents' fade (gone only at the swap): the picture moved into it.
 * Placed by the column's one writer (colApply); on the switch's clock (one start)
 * @param {HTMLElement} out the stand-in (standIn) @param {{ t0: number, T: number }} sw the switch
 * @param {{ plate: Box4, dock: "left" | "right" | "below" }} was the plate on screen and the dock before the change */
export function fadeCol(out, sw, was) {
  for (const a of colFades) a.cancel();
  relation = null;
  promptFollow(true); // its place where it lands: glued to where the plate lands (the layout is settled: tabs.js tabGo)
  const rect = (/** @type {Element} */ e) => {
      const r = e.getBoundingClientRect();
      return { l: r.left, t: r.top, w: r.width, h: r.height };
    },
    ol = out.querySelector(".left"),
    g = glueRect(),
    f = relationFade(sw.T),
    k = (/** @type {number} */ ms) => Math.min(1, Math.max(0, ms / f.T));
  if (ol) {
    const b0 = rect(ol),
      b1 = rect($("left")),
      pos = S.pos || "mid";
    relation = {
      t0: sw.t0,
      T: f.T,
      out,
      b0,
      r0: relationOf(b0, was.plate, glueAnchors(was.dock, pos)),
      b1,
      r1: relationOf(b1, { l: g.left, t: g.top, w: g.width, h: g.height }, glueAnchors(S.dock || "left", pos)),
    };
  }
  /* faded by their parts, never through an ancestor: glass under a fade loses its blur (fade.js — it popped back the
     frame the box reached full opacity) */
  const gone = glassFade(
    out,
    [
      { offset: 0, opacity: 1 },
      { offset: k(f.outEnd), opacity: 0 },
      { offset: 1, opacity: 0 },
    ],
    { duration: f.T, fill: "forwards" },
  );
  Promise.all(gone.map(a => a.finished)).then(
    () => out.remove(),
    () => out.remove(),
  );
  colFades = [
    ...gone,
    ...glassFade(
      $("lcol"),
      [
        { offset: 0, opacity: 0 },
        { offset: k(f.inStart), opacity: 0 },
        { offset: k(f.inEnd), opacity: 1 },
        { offset: 1, opacity: 1 },
      ],
      { duration: f.T, fill: "backwards" },
    ),
  ];
  for (const a of colFades) a.startTime = sw.t0;
  cancelAnimationFrame(colRaf);
  colApply(); // its first frame: the copy where it was (the plate hasn't moved yet)
}
/** @type {Animation[]} */
let colFades = [];
/** a tab switch moved the column's place: it slides there from where it was on screen (measured before the switch —
 * mid-slide too, so a fast second switch carries on from there). Its place is worked out here, from the layout:
 * measured through the running slide's offset @param {DOMRect} was */
export function slideCol(was, t0 = performance.now()) {
  const r = $("lcol").getBoundingClientRect();
  /* across: side by side the box rides the plate (promptFollow), so only Vertical's column slides */
  slX = document.querySelector(".app.stacked") ? Math.round(was.left - (r.left - colX + hugX)) : 0;
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
    R = app.classList.contains("pright");
  let x = 0,
    y = 0;
  /* Vertical: the picture sits at the top of its room; the prompt comes up by the room it leaves under it (and under
     its status row), so they touch — the spare height goes to the window's bottom (2026-11-01) */
  if (b && stk && S.view === "gen" && lay.vroom)
    /* glued under the picture's KEPT bottom: the rubber band is the grabbed edge's feedback only — nothing round it
       follows the overshoot (2026-11-02, the user: the prompt twitched) */
    y = -Math.round(Math.max(0, lay.vroom - (b.t + b.h - (lay.overB || 0) + SPACE.mat + lay.vrow)));
  if (!stk && lay.last) {
    /* side by side, EVERY page: the box is glued one pair gap from its neighbour pane's plate as it is on screen this
       frame — a picture's or a panel's, at rest, held, in a tab switch, in a resize (C2b, B23: the model's "panes stick
       to each other with one gap; positions inside it are derived"). Whatever moves the plate moves the box in the same
       frame: one clock. The box rests at the column's left edge (the column is the whole room, DD-2026-11-08-1): its
       place there is its layout box, without ANY transform (getBoundingClientRect counted a running switch's offset
       too, and the glue cancelled it); its width is --cw as written this frame */
    const p = glueRect(), // the plate as it is — or, in a layout switch, where it lands (plate.js)
      col = $("lcol"),
      box = $("left"),
      left = app.getBoundingClientRect().left + col.offsetLeft + box.offsetLeft,
      w = lay.shown ? lay.shown.pw : box.offsetWidth; // its width from its owner (boxWWrite), as written this frame
    if (p.width > 0 && w > 0) x = Math.round(R ? p.right + pairGap() - left : p.left - pairGap() - (left + w));
    else x = hugX;
  }
  const b2 = document.body.classList;
  if (direct || b2.contains("laysnap") || b2.contains("liveresize") || b2.contains("laydrag")) {
    hugT0 = 0;
    if (x === hugX && y === hugY && !relation) return;
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
  if (relation) {
    /* riding the live plate: placed now, in the frame the plate moved (its own frame would read it a frame late) */
    cancelAnimationFrame(colRaf);
    colApply();
  } else if (!colRaf) colApply();
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
  /* letting go anywhere (a menu choice, a click, an edge) lets the layout catch up at once — and it ends the press
     BEFORE anything acts on the release (the capture phase): a drag to a dock started its layout switch while the
     press still held the box's glue, and the box jumped by the old glue while it was seen (the user, 2026-11-08) */
  addEventListener(
    "pointerup",
    () => {
      lay.pressCard = false;
      setTimeout(sizeFrame, 0);
    },
    true,
  );
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
