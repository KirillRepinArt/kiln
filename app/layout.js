// @ts-check
/** @typedef {import("./types.js").Geometry} Geometry @typedef {import("./types.js").LayoutPrefs} LayoutPrefs */
import { glueRect, plateSync } from "./plate.js";
import { placeAround } from "./around.js";
import { driving, follow, moving, movingTo, rearrange, rearrangeFade, stop, travelling } from "./rearrange.js";
import { frameGoal } from "./framebox.js";
import { syncH } from "./boot.js";
import { showPromptOn } from "./browse.js";
import {
  applyMode,
  applyPH,
  boxDraftH,
  card,
  boxWLeast,
  cardNaturalH,
  chipsH,
  layoutLeft,
  lyReset,
  slotLeast,
  stackW,
  updHm,
} from "./cardlayout.js";
import { $, offsetIn } from "./dom.js";
import { fade, fadeValue } from "./fade.js";
import { leaveCopy } from "./leave.js";
import { HANDLES } from "./outlines.js";
import { current, jobs } from "./jobs.js";
import {
  glueAnchors,
  isFitPage,
  glued,
  relationFade,
  relationOf,
  layoutPass,
  limits,
  paneDefault,
  fitInBox,
  layoutPrefsV4,
  framePlacement,
  pageGeometry,
  pageInsets,
  picLeastH,
  toolColumnW,
  upgradeLayoutPrefs,
} from "./layoutmath.js";
import { PV, onShow, picMode } from "./picstate.js";
import { S, save } from "./state.js";
import { forgeOk } from "./sync.js";
import { moveThumb, tabGo } from "./tabs.js";
import { SPACE, pairGap } from "./tokens.js";

/* Kiln · the page layout: the panes' sizes (one owner), the layout pass's inputs and appliers, the edges' drags,
   docking, the prompt column's place, and the holds that keep things still while you work */

/* the status block under the picture: the part gap + track 10 + 7 + status row 36 */
export const BAR = () => SPACE.part + 10 + 7 + 36;
/* the status row coming or going inside the picture's view: it fades on the rearrangement's plan with the frame (one
   start time; it leaves first, then the picture grows into its room — the tab switch's order) */
/** @param {boolean} on */
function rowFade(on) {
  const p = $("prog");
  if (on) {
    rearrangeFade(p, true); // it comes as the picture has made its room
    return;
  }
  /* leaving: what it showed leaves as its copy (leave.js), on the plan; the row itself is at its end state at once
     (body.norow), its contents free to change — faded itself, they changed under the fade (G11) */
  const c = leaveCopy([p]);
  rearrangeFade(c.el, false, c.drop); // on the plan; the copy is gone when its fade is (an earlier one lives out its own)
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
    prompt: showPromptOn(),
  });
}
/* the slot under the picture's occupant: "bar" (the queue's progress, a paused queue, a result behind your
   reference), "prompt" (Show prompt) or "none" */
export function rowMode() {
  return insets().row || "none";
}
/** the insets as a key: the layout runs again when it changes (sync.js after a poll, picstate.js after an event) */
export const insetsKey = () => {
  const i = insets();
  return `${i.row}:${i.tools}`;
};
/* the edit buttons' column beside the picture: one column, always (layoutmath.js toolColumnW, picLeastH) */
export function tbW() {
  return toolColumnW();
}
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
/* ---------- your sizes: ARCHITECTURE › the layout model ----------
   Written only through setPaneSize, read through paneSize; null = the default; Left and Right share "side" */
/** @typedef {import("./layoutmath.js").PageId} PageId @typedef {import("./layoutmath.js").Orient} Orient */
/** which layout the pass computes: as laid out now — or, inside placeFor, the one asked about. The ONE place the
 * pass's inputs ask @type {{ dock: "left" | "right" | "below" } | null} */
let asked = null;
/** side by side or Vertical, as laid out now (or as asked: placeFor) @returns {Orient} */
export const orient = () =>
  asked ? (asked.dock === "below" ? "vert" : "side") : document.querySelector(".app.stacked") ? "vert" : "side";
/** where the prompt box is docked, as laid out now (or as asked: placeFor) @returns {"left" | "right" | "below"} */
export const dockNow = () =>
  asked
    ? asked.dock
    : document.querySelector(".app.stacked")
      ? "below"
      : /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright")
        ? "right"
        : "left";
/** where the box rests at {dock, pos}: the layout pass for that place, from the same inputs — nothing is laid out (the
 * drop map's landing, a travel's goal) @param {"left" | "right" | "below"} dock
 * @param {"top" | "mid" | "bot"} pos @returns {import("./layoutmath.js").Rect} */
export function placeFor(dock, pos) {
  const was = asked,
    p = S.pos;
  asked = { dock };
  S.pos = pos;
  try {
    return sidePass().out.box;
  } finally {
    asked = was;
    S.pos = p;
  }
}
/** the page on show, as a pane @returns {PageId} */
export const pageId = () =>
  S.view === "gen" ? (picMode() === "browse" ? "gallery" : "generating") : /** @type {PageId} */ (S.view);
/** the store, made (or brought up from an older version) the first time it's asked for */
function sizes() {
  if (!S.lay || S.lay.v !== 4) {
    /* a pre-v4 store, once: the room its old shares are read against (in Vertical the window less its edge gaps — the
       pass's real room reads these sizes) */
    const room = orient() === "vert" ? innerHeight - 2 * SPACE.area : picFull(true);
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
  /* a picture's width or height forgotten (a double-click, the whole room): its scale too — the size it stands for */
  if (v == null && axis !== "s" && pane !== "box" && "s" in P) P.s = null;
}
/* saved layouts of older versions → today's (once, at start-up: main.js); the sizes' own format on first use */
export function migrateLayoutPrefs() {
  if (S.lay && S.lay.v !== 4) S.lay = upgradeLayoutPrefs(S.lay, layW());
  delete S.sch; // old keys: Vertical's kept prompt height,
  delete S.pph; // a kept prompt height side by side (DD-2026-11-02-12),
  delete S.vfit; // Vertical's own fit flag (now S.hmode, DD-2026-11-02-16)
  /* side by side, a picture page's size is a scale of its largest (DD-2026-11-03-4): px caps, made on one picture's
     ratio, limited the next — dropped once, so every picture starts at its biggest */
  const L4 = S.lay && S.lay.v === 4 ? /** @type {import("./layoutmath.js").LayoutV4} */ (S.lay) : null;
  if (L4 && (L4.side.scaled ?? 0) < 2) {
    for (const id of /** @type {const} */ (["generating", "gallery"]))
      Object.assign(L4.side.pages[id], { w: null, h: null, s: null }); // 2: a second pass, for px caps an older drag left
    L4.side.scaled = 2;
  }
}
/* every pane's least / largest size and its default come from ONE place, layoutmath.js (limits, paneDefault): these
   two ask it with the page's context now */
/** @param {"box" | PageId} pane @param {"w" | "h"} axis @param {{ o?: Orient, roomH?: number }} [c] */
export function paneLimits(pane, axis, c = {}) {
  return limits(pane, axis, {
    orient: c.o ?? orient(),
    roomW: layW(),
    roomH: c.roomH ?? picFull(true),
    minR: minRight(),
    least: slotLeast(),
    boxWLo: boxWLeast(),
    winH: innerHeight,
  });
}
/** @param {"box" | PageId} pane @param {Orient} [o] @param {number} [roomH] the room's height (read for a panel only:
 * measured for the box or a picture page, it asked Vertical's layout pass from inside it) */
export function paneDef(pane, o = orient(), roomH) {
  return paneDefault(pane, o, { w: layW(), h: roomH ?? (pane === "box" || isFitPage(pane) ? 0 : picFull(true)) });
}
/** a size within its limits @param {number} v @param {{ lo: number, hi: number }} l */
export const within = (v, l) => Math.max(l.lo, Math.min(l.hi, v));
/** the defaults side by side: the prompt's width; a panel's (a 2:3 plate at the room's height, never narrower than the
 * tab bar) */
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
  target: null,
  frameDefer: false,
  framePending: false,
  frameHold: false,
  pass: null,
  pdrag: null,
  row: null,
  rowView: null,
  ins: "",
  shown: null,
  vroom: 0,
  /** @type {import("./layoutmath.js").PassOut | null} Vertical's pass, as last run (vPass) */
  passV: null,
  vrow: 0,
};
/* Vertical: the even gap — the picture's plate starts this far under the tab buttons, and the prompt's name starts this
   far under the plate (or under its status row) */
function evenGap() {
  const seg = /** @type {HTMLElement} */ (document.querySelector(".seg")),
    tbs = /** @type {HTMLElement} */ (document.querySelector(".tabs"));
  return SPACE.part + (tbs.getBoundingClientRect().bottom - seg.getBoundingClientRect().bottom);
}
/* Vertical: the box's name row, from the name's top to the box's (the column's title row less the room above the name) */
function nameRowH() {
  return SPACE.tight + $("ltitle").getBoundingClientRect().bottom - $("pname").getBoundingClientRect().top;
}
/* the room the slot under the picture takes while the page keeps it: the part gap + its occupant (the status row, or
   Show prompt — A1) */
function rowRoom() {
  if (insets().row === "prompt") return SPACE.part + $("showP").offsetHeight;
  return orient() === "vert" ? SPACE.part + $("prog").offsetHeight : BAR();
}
/* side by side, the room a page has: the column's (#right) under the panel box's top — ONE definition for the
   picture's room and a panel's (measured from the stage it was the panel's own height: a shortened Queue's, for a frame) */
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
/* the page's room: side by side the column's; Vertical, the most height the page's pane can take — the layout pass's
   (the box at its least under it; measured above the box, the box's growth came out of the page's room) */
function roomH() {
  if (orient() !== "vert") return sideRoom();
  return (asked ? sidePass().out : (lay.passV ?? vPass())).pageHi;
}
/* the picture's largest height: the room less the status row while the page keeps it (insets) */
export function picFull(noRow = false) {
  return roomH() - (!noRow && insets().row ? rowRoom() : 0);
}
/* the clearance the edit buttons need beyond the window's own margin (they hang outside the plate, never room in the
   area — kept whether they show or not, so nothing moves when they come) */
function toolsClear() {
  return Math.max(0, tbW() - SPACE.area);
}
/** @typedef {import("./layoutmath.js").Rect} Rect */
/** the single layout pass, both layouts — ARCHITECTURE › the single layout pass. Held (lay.pdrag): from the sizes at
 * its press and the pointer. A px cap an older version left on a picture page is read once as the scale it gives.
 * @returns {{ out: import("./layoutmath.js").PassOut, strip: number, roomTop: number }} */
function sidePass() {
  const vert = orient() === "vert",
    roomTop = sideRoomTop(),
    barH = /** @type {HTMLElement} */ (document.querySelector(".tabs")).offsetHeight,
    barGap = Math.max(0, roomTop - SPACE.area - barH),
    dr = lay.pdrag, // an edge held: the pass computes from the sizes at its press and the pointer
    pic = S.view === "gen",
    p = paneSize(),
    df = /** @type {{ pw: number, rw: number }} */ (vert ? { pw: 0, rw: 0 } : layDef()), // side by side's defaults (in Vertical they'd ask the pass's own room)
    room = /** @type {number} */ (vert ? 0 : pic ? picFull() : sideRoom()), // side by side (Vertical's is the pass's own: roomH would ask it)
    strip = pic ? tbW() : 0, // one column, never the picture's height's (picLeastH; DD-2026-11-07-2)
    /** @type {(page: import("./layoutmath.js").PassState["page"]) => import("./layoutmath.js").PassOut} */
    run = page =>
      layoutPass({
        W: innerWidth,
        H: innerHeight,
        dock: dockNow(),
        /* Vertical: a picture's status row lies under it, in the group's gap (rowRoom) */
        page: vert && page.kind === "pic" && insets().row ? { ...page, row: rowRoom() } : page,
        /* the box's spec (16-layout-pass.md, C4) — held, the sizes at the press */
        box: vert
          ? {
              w: dr ? dr.boxW : stackW(),
              wLo: boxWLeast(),
              text: boxDraftH(), // your draft's: a job's prompt shown never resizes it
              least: slotLeast(),
              hi: paneLimits("box", "h", { o: "vert", roomH: 0 }).hi, // its spec's largest (limits)
              h: dr ? (dr.bh ?? null) : (paneSize("box", "vert").h ?? null),
              title: nameRowH(), // the name row over the box, from the name's top
              foot: chipsH() + 2, // the LoRA row under it (and the column's 2 px, as --lch)
            }
          : {
              w: dr ? dr.boxW : (paneSize("box", "side").w ?? df.pw),
              wLo: boxWLeast(),
              text: cardNaturalH(),
              least: slotLeast(),
              h: paneSize("box", "side").h ?? null, // yours (Custom): its top or bottom edge
              mode: S.hmode === "full" || S.hmode === "match" ? S.hmode : "",
              anchor: /** @type {"top" | "mid" | "bot"} */ (S.pos || "mid"),
              place: boxPlace(),
            },
        /* the bar's row as it is on screen (the room's top): the pass's numbers are the window's, on both axes */
        bar: { w: tabsW(), h: barH },
        strip,
        /* Vertical: the gap between the pane and the box's name is the even gap (the one under the tab bar) */
        gap: { area: SPACE.area, pair: vert ? evenGap() : pairGap(), bar: barGap },
        picLeast: picLeastH(),
        /* Vertical: the whole room under the bar (none given) — never one measured from the current layout, which
           already took the box out of it (the picture shrank as the text grew) */
        roomH: vert ? undefined : room,
        drag: dr ? { edge: dr.edge, at: dr.at } : null,
      });
  if (!pic) {
    /* a panel: its width and height are yours (by default a 2:3 plate at the room's height side by side, 1:1 in
       Vertical), within its limits. Vertical's room is the pass's (pageHi: what the box at its least leaves; it
       doesn't depend on the panel) — held, the sizes at the press */
    const R = /** @type {number} */ (
        vert ? run({ kind: "panel", w: 0, h: 0, lo: { w: 0, h: 0 }, hi: { w: 0, h: 0 } }).pageHi : room
      ),
      o = vert ? "vert" : "side",
      lw = /** @type {{ lo: number, hi: number }} */ (paneLimits(pageId(), "w", { o, roomH: R })),
      lh = /** @type {{ lo: number, hi: number }} */ (paneLimits(pageId(), "h", { roomH: R }));
    return {
      out: run({
        kind: "panel",
        w: dr ? (dr.w ?? df.rw) : vert ? within(p.w ?? paneDef(pageId(), "vert", R).w ?? R, lw) : (p.w ?? df.rw),
        h: dr ? (dr.h ?? (vert ? R : room)) : (p.h ?? (vert ? R : room)), // Vertical: as tall as the pass allows
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
/** side by side, the box's column and the moment's state its place rule reads: the column's layout box
 * (without a transform) under its name row, the LoRA row, the status row under the pane, the card's holds
 * @returns {import("./layoutmath.js").BoxPlace} */
function boxPlace() {
  const col = $("lcol"),
    TS = parseFloat(col.style.getPropertyValue("--ts")) || 64,
    R = insets().row ? rowRoom() : 0;
  return {
    colTop: /** @type {HTMLElement} */ (col.offsetParent).getBoundingClientRect().top + col.offsetTop + TS,
    colH: col.clientHeight - TS,
    chips: chipsH(),
    below: R ? R - 1 : 0, // the status row: a box resting at the bottom lines up with it
    /* the holds of the box as it IS (an edge's height held, you working in it, where it was) — never of where it WOULD
       be: asked about a place (placeFor), the pass answers its resting place (held, a lane's three places answered
       "where it is now": G1) */
    ...(asked
      ? { held: 0, heldPin: "top", frozen: false, prevTop: null, prevBottom: null }
      : {
          held: card.hHold || 0,
          heldPin: card.hPin || "top",
          frozen: card.frozen,
          prevTop: card.top,
          prevBottom: card.bottom,
        }),
  };
}
/** side by side, the box's height limits for its top / bottom edge: its least, and the room — its column less the
 * LoRA row @returns {{ lo: number, hi: number }} */
export function sideBoxH() {
  const p = boxPlace();
  return { lo: slotLeast(), hi: Math.max(slotLeast(), p.colH - p.chips) };
}
/** side by side, the layout pass's rectangles now — the box's place (layoutLeft) @returns {import("./layoutmath.js").PassOut} */
export function sideBoxPass() {
  return sidePass().out;
}
/** Vertical: the layout pass's rectangles now — the page's pane on top, the box under it; kept in
 * lay.passV for the appliers (sizeFrame: the page; layoutLeft: the box) @returns {import("./layoutmath.js").PassOut} */
export function vPass() {
  return (lay.passV = sidePass().out);
}
export function layGeo() {
  const W = layW();
  const gen = S.view === "gen",
    df = layDef(),
    page = paneSize(),
    /* a panel's width within its own limits (the Queue's readable width, PNG Info's fixed one) */
    rw = gen ? df.rw : within(page.w ?? df.rw, paneLimits(pageId(), "w", { o: "side" })),
    L = { pw: paneSize("box", "side").w ?? df.pw, rw, iw: gen ? page.w : null },
    /* never narrower than the tab bar: it sits on the plate's centre line (plate.js placeBar) */
    minR = minRight();
  /* side by side: the pass's numbers in a STILL area (G6) — the columns don't hug the picture, so a ratio change moves
     nothing but the picture (on the frame's clock), and the box follows it on that clock (promptFollow) */
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
      anchors: out.anchors,
      squeezeW: out.squeezeW,
      roomTop,
    };
    /* every page: the area is the whole room and never moves — one coordinate space (ARCHITECTURE › the single layout
       pass) */
    return { pw: out.box.w, rw: W, mL: 0, mR: 0, W, minR, off: 0, gen, clear: 0 };
  }
  lay.pass = null;
  /* Vertical: the area is the whole stage — the pass places the panes in it (sizeFrame, layoutLeft) */
  return pageGeometry(
    {
      W,
      gen,
      minR,
      clear: gen ? toolsClear() : 0,
      boxLo: boxWLeast(),
      promptRight: /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright"),
    },
    L,
  );
}
/* ---------- the box's width side by side (--cw): on the rearrangement — ARCHITECTURE › a rearrangement on the same
   page; told (lay.shown) to what follows it in the same frame ---------- */
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
  /* on the rearrangement's plan and clock, with the frame or the panel: the box's width as a box on the x axis */
  const box = (/** @type {BoxW} */ c) => ({ l: 0, t: 0, w: c.pw, h: 0 });
  rearrange("boxw", box(lay.shown), box(to), b => boxWWrite({ pw: b.w }));
}
/* what to apply now: working in the prompt (a press in it, one of its menus open) the box keeps its width — its place
   holds too (promptFollow); an edge held computes from the held size like every drag; otherwise it adjusts at once */
function layNow() {
  const g = layGeo();
  if (!lay.last || lay.drag) return g;
  if (lay.pressCard || document.querySelector("#left .pop.show")) g.pw = lay.last.pw;
  return g;
}
/* ---------- an edge drag: through the layout pass, every edge of both layouts — ARCHITECTURE › the single layout
   pass. The press freezes the sizes, the pointer constrains, the release keeps the pass's `kept` ---------- */
/** @param {string} edge the pass's handle id ("box.left", "shared", "page.top", …) @param {number} pointer the pointer
 * on the edge's axis (window px) @returns {boolean} false: the layout has no such edge now (the caller does nothing) */
export function passDragStart(edge, pointer) {
  const vert = !!document.querySelector(".app.stacked"),
    P = vert ? (lay.passV ?? vPass()) : lay.pass,
    h = P && P.handles[edge];
  if (!P || !h) return false;
  /* the edge's axis: Vertical's shared edge is a horizontal line (the pane over the box) */
  const y = edge.endsWith(".top") || edge.endsWith(".bottom") || (vert && edge === "shared"),
    line = y ? h.y + h.h / 2 : h.x + h.w / 2;
  if (vert && edge.startsWith("box.")) S.hmode = ""; // its width or height yours again: the mode lets go (Figma's fixed size)
  lay.pdrag = {
    edge,
    at: line,
    off: line - pointer,
    boxW: vert ? P.kept.boxW : P.box.w,
    bh: vert ? P.box.h : undefined,
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
  const vert = !!document.querySelector(".app.stacked"),
    V = vert ? lay.passV : null, // Vertical's pass: its room and the box's height it keeps
    P = vert ? V : lay.pass,
    d = lay.pdrag,
    k = P && P.kept,
    o = vert ? "vert" : "side";
  lay.pdrag = null;
  lay.drag = false;
  if (d && k && P) {
    /* what the edge changed: an outer edge only its own pane (DD-2026-11-07-1), the shared edge both */
    if (vert) {
      /* Vertical: the box's width by its sides, its height (yours: Custom) by its bottom or the shared edge */
      if (d.edge === "box.left" || d.edge === "box.right") setPaneSize("box", "w", k.boxW, o);
      const bh = V && V.kept.boxH;
      /* (the shared edge: only if the box's height changed — pushed into the empty room at its own size, it stays its
         text's) */
      if (
        bh != null &&
        (d.edge === "box.bottom" || (d.edge === "shared" && (d.bh == null || Math.abs(bh - d.bh) > 0.5)))
      )
        setPaneSize("box", "h", bh, o);
    } else if (d.edge === "shared" || d.edge.startsWith("box.")) setPaneSize("box", "w", k.boxW, o);
    const page = d.edge === "shared" || d.edge.startsWith("page."),
      tall = d.edge === "page.top" || d.edge === "page.bottom";
    if (page && k.scale != null) {
      /* a picture: its scale of its largest */
      setPaneSize(pageId(), "w", null);
      setPaneSize(pageId(), "h", null); // (clears the scale: set after)
      setPaneSize(pageId(), "s", k.scale >= 0.999 ? null : k.scale);
    } else if (page && (tall || (vert && d.edge === "shared")) && k.h != null)
      setPaneSize(pageId(), "h", k.h >= (V ? V.pageHi : sideRoom()) - 1 ? null : k.h, o); // a panel's height (the whole room: none of its own)
    else if (page && k.w != null) setPaneSize(pageId(), "w", k.w, o); // a panel's width
    save();
  }
  sizeFrame();
}
/** a double-click on an edge (DD-2026-11-03-5) — ONE owner for every edge of both layouts, by the pass's handle id: a
 * picture edge → the picture at its largest (side by side the box squeezed toward its least: squeezeW); a box edge →
 * its default width (its top / bottom: its text's height); a panel edge → that panel's default on that axis; the
 * shared edge → both panes' defaults. Kept, and the layout moves there on the rearrangement's one plan, as Reset
 * @param {string} edge */
export function passDouble(edge) {
  const vert = !!document.querySelector(".app.stacked"),
    P = vert ? (lay.passV ?? vPass()) : lay.pass,
    o = vert ? "vert" : "side",
    [who, side] = edge.split("."),
    across = side === "left" || side === "right";
  if (!P) return;
  if (edge === "shared") {
    setPaneSize(pageId(), "w", null, o); // (a picture: its scale too)
    setPaneSize(pageId(), "h", null, o);
    setPaneSize("box", vert ? "h" : "w", null, o);
  } else if (who === "box") {
    if (across) {
      setPaneSize("box", "w", null, o);
      S.hmode = ""; // its width yours again: the mode lets go
    } else setPaneSize("box", "h", null, o); // its top or bottom: its text's height again (Fit)
  } else if (P.pic) {
    setPaneSize(pageId(), "w", null, o);
    setPaneSize(pageId(), "h", null, o); // its scale: its largest
    const sw = !vert && lay.pass ? lay.pass.squeezeW : null;
    if (sw != null) setPaneSize("box", "w", sw, o);
  } else setPaneSize(pageId(), across ? "w" : "h", null, o);
  save();
  updHm();
  layoutLeft();
  sizeFrame();
  moveThumb(true);
}
/** the prompt's place, by a layout switch (tabs.js tabGo); how the box moves comes from the cause — ARCHITECTURE › a
 * pane's change of relation @param {"left" | "right" | "below"} z @param {import("./layoutmath.js").RelationCause} [cause] */
export function setDock(z, cause = "menu") {
  if ((S.dock || "left") === z) return;
  tabGo(
    () => {
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
    },
    true,
    cause,
  ); // true: a layout switch
}
/* ---------- "the layout lands at once" (body.laysnap): ONE owner (ownership map T1) ----------
   Each motion holds it until its own end; it lasts until the LAST hold ends */
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
/* the stage where the layout puts it, without a tab switch's ride (its view's transform: plate.js switchGlide) */
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
  rt.style.setProperty("--pt", rp.offsetTop + "px"); // where its handles go: its top / bottom, its sides (Vertical)
  rt.style.setProperty("--pb", rp.offsetTop + rp.offsetHeight + "px");
  rt.style.setProperty("--pl", rp.offsetLeft + "px");
  rt.style.setProperty("--pr", rp.offsetLeft + rp.offsetWidth + "px");
}
/** the panel's box side by side, from the window's px @param {{ l: number, t: number, w: number, h: number }} b
 * @param {number} roomTop where its room starts in the window */
function panelWrite(b, roomTop) {
  panelAt = b;
  const r = (/** @type {number} */ v) => Math.round(v) + "px";
  panelStyle(r(b.h), b.t - roomTop ? r(b.t - roomTop) : "", r(b.w), r(b.l - areaX()));
  plateSync(); // the plate rides the panel, in the frame it's written (as framebox.js write does for the frame)
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
       keeps them; the same decider shows them */
    const was = lay.row,
      wasView = lay.rowView;
    lay.row = ins.row || "none";
    lay.rowView = S.view;
    lay.ins = `${ins.row}:${ins.tools}`;
    document.body.classList.toggle("norow", ins.row !== "bar"); // the status row shows only as the slot's occupant
    document.body.classList.toggle("notools", !ins.tools);
    /* the row comes and goes on the layout's clock, as the box makes or gives back its room — inside the picture's view
       only: a switch between views fades it with everything else (plate.js switchGlide) */
    if (was && was !== lay.row && (was === "bar" || lay.row === "bar") && wasView === "gen" && S.view === "gen")
      rowFade(lay.row === "bar");
  }
  const j = onShow() || current();
  const ar = j ? j.ar : S.ar;
  if (!stk && !lay.frameHold) layApply(layNow());
  /* Vertical: the layout pass's rectangles — the page's pane and its room; the box's are placed by layoutLeft from the
     same run */
  const pv = stk ? vPass() : null;
  /* the page area (#right) is the whole room in both layouts (one coordinate space, DD-2026-11-08-1): the page's pane
     is placed in it by the pass */
  {
    const rt = $("right");
    if (rt.style.width) rt.style.width = "";
    /* Vertical: the page's pane as the pass gives it — a panel's height, or the picture and its status row's room
       (the stage holds both); the box sits under it (layoutLeft). Side by side the room IS the panel's box */
    lay.vroom = pv ? Math.round(pv.page.h + (S.view === "gen" && ins.row ? rowRoom() : 0)) : 0;
    /* the panel's box — ARCHITECTURE › a panel's box: ONE writer of its height and offset, and of where its edge
       handles go (--pt / --pb) */
    const rp = $("rpanel"),
      room = stk ? lay.vroom : sideRoom(),
      panel = S.view !== "gen",
      kept = panel ? paneSize().h : null,
      /* the layout pass's, held or not, in both layouts */
      sp = !panel ? null : pv ? { page: pv.page, roomTop: pv.roomT } : lay.pass,
      H = panel
        ? Math.round(sp ? sp.page.h : kept ? within(kept, paneLimits(pageId(), "h", { roomH: room })) : room)
        : null,
      top = panel && H != null ? Math.round(sp ? sp.page.y - sp.roomTop : 0) : 0, // held too
      fx = H != null && !stk ? "none" : ""; // side by side it grows to the room (flex: 1) unless it has a height
    if (rp.style.flex !== fx) rp.style.flex = fx;
    lay.proom = room;
    if (sp) {
      /* a panel is the pass's box, in the window's px: it moves there on the rearrangement's plan and clock (B16) */
      const to = { l: sp.page.x, t: sp.page.y, w: sp.page.w, h: sp.page.h },
        roomTop = sp.roomTop;
      if (panelAt) rearrange("panel", panelAt, to, b => panelWrite(b, roomTop));
      else panelWrite(to, roomTop);
    } else {
      /* a picture page: the whole area (Vertical: the pane and its status row's room) */
      panelAt = null;
      panelStyle(H != null ? H + "px" : stk ? lay.vroom + "px" : "", top ? top + "px" : "", "", "");
    }
  }
  /* where the layout puts the stage, not where a switch's ride shows it */
  const st = stageRect(),
    SW = stk ? st.width : /** @type {Geometry} */ (lay.last).rw; // the whole room
  const f = $("frame");
  const pass = !stk && S.view === "gen" && lay.pass && lay.pass.pic ? lay.pass : null, // side by side: the pass's
    vpic = pv && pv.pic ? pv.pic : null, // Vertical: the pass's picture, held or not
    PH = pass && pass.pic ? pass.pic.h : vpic ? vpic.h : picFull(),
    TB = pass ? pass.strip : tbW(), // the edit buttons' column: side by side, part of the picture's pane
    R = ins.row ? rowRoom() : 0, // (lay.vrow: the prompt follows the row's room too, Vertical)
    M = SPACE.mat, // the picture's mat: the plate is the picture and M round it
    { w, h } =
      pass && pass.pic
        ? { w: pass.pic.w - 2 * M, h: pass.pic.h - 2 * M }
        : vpic
          ? { w: vpic.w - 2 * M, h: vpic.h - 2 * M }
          : fitInBox(ar, SW - 2 * M, PH - 2 * M),
    W = w + 2 * M, // the plate
    H = h + 2 * M;
  /* the picture's canvas is drawn at the box's FINAL size and centred in it: the box may glide to a new shape (its
    edges clip the picture, like a container transform) without the canvas being stretched on the way */
  /* the plate is centred in its area on every page; the button column hangs on the side away from the prompt (Vertical: on
    the right) */
  lay.vrow = stk ? R : 0;
  const tbLeft = !stk && /** @type {HTMLElement} */ (document.querySelector(".app")).classList.contains("pright"),
    { top: placedTop, left: placedLeft } = framePlacement({
      areaW: SW,
      areaH: stk ? lay.vroom : roomH(),
      w: W,
      h: H,
      tb: !stk && S.view === "gen" && lay.pass ? lay.pass.strip : 0, // the strip is in the area, held or not
      row: R,
      heldTop: pv ? pv.page.y - pv.roomT : null, // Vertical: the pass's place (a held top edge moves it down)
      stacked: stk,
      toolsLeft: tbLeft,
    });
  let left = placedLeft,
    top = placedTop;
  /* the picture's place is the pass's in both layouts — never a centring inside the geometry last applied, which may
     be held or stale (the picture slid onto the box) */
  const pp =
    pass && pass.pic ? { pic: pass.pic, roomTop: pass.roomTop } : vpic && pv ? { pic: vpic, roomTop: pv.roomT } : null;
  if (pp) {
    left = pp.pic.x - areaX(); // the area's px: the window's less the room's edge
    top = pp.pic.y - pp.roomTop; // held too: one source for the picture's place (B18)
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
  /* the page's side handles: around.js placeSideEdges (from the plate as it moves) */
  /* Vertical: the divider in the gap between the page and the prompt's name */
  vAlign();
  /* the tab bar: as wide as its buttons; where it sits is the plate's business (plate.js placeBar — one owner) */
  /* the status row, Show prompt, the edit buttons and the edge strips: placed from where the frame is now, and every
     frame it moves (around.js — one owner: the frame) */
  placeAround();
  promptFollow(); // side by side: one gap from the plate — the frame's writes call it on every box change
  layoutLeft(); // the box, in the same task as the picture it's anchored to: one rearrangement, one plan
  plateSync(); // the plate on its element as written now (a glide's frames place it from the driver)
}
/* Vertical: the ONE divider, just above the prompt's name — from the layout pass (the box's top less its name row) */
export function vAlign() {
  if (!document.querySelector(".app.stacked")) return;
  const p = lay.passV ?? vPass(),
    col = $("lcol"),
    colTop = /** @type {HTMLElement} */ (col.offsetParent).getBoundingClientRect().top + col.offsetTop,
    pn = p.box.y - nameRowH();
  col.style.setProperty("--gtop-v", pn - colTop - 2 + "px");
}
/* ---------- the prompt column's place: ONE writer, colApply — ARCHITECTURE › the prompt column's place ----------
   Its transform = the glue (hugX / hugY) + a relation change's ride + the lift, and the token's scale */
let hugX = 0, // side by side: one gap from the plate, on every page (promptFollow); catching up after a hold, the driver's ("hug")
  hugY = 0, // riding its pane's plate on the height axis while it moves (Vertical; side by side in a switch — promptFollow; 0 at rest): never glided, the plate is its clock
  colRaf = 0;
/** the box lifted by its grip: it follows the pointer; let go, the driver brings it home ("lift") */
let liftX = 0,
  liftY = 0;
/** the lift, as the column's one writer places it (cardlayout.js: the move gesture; the driver letting go)
 * @param {number} x @param {number} y */
export function liftCol(x, y) {
  liftX = x;
  liftY = y;
  colApply();
}
/* the box in the hand is a token (the drop map shows behind it): the column scaled about the BOX's top-left corner, so
   that corner stays exactly at its glue + lift whatever the scale (the travel measures from it) */
let liftS = 1;
/** the token's scale now (1: the box itself) */
export const liftScale = () => liftS;
/** @param {number} s the column's scale while it's carried (1 — the box at its size) */
export function liftToken(s) {
  liftS = s;
  colApply();
}
/** the box's catch-up after a hold, written by the driver (rearrange.js "hug") @param {{ l: number }} b */
const hugWrite = b => {
  hugX = b.l;
};
function colApply() {
  colRaf = 0;
  const now = performance.now();
  /* a relation change (a layout switch by the menu): the box rides the LIVE plate — its leaving copy by the old relation, the
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
      rx = g1.l - relation.b1.l;
      ry = g1.t - relation.b1.t;
    }
  }
  const x = hugX + rx + liftX,
    y = hugY + ry + liftY,
    col = $("lcol"),
    t = (x || y ? `translate(${x}px, ${y}px)` : "") + (liftS !== 1 ? ` scale(${liftS})` : ""),
    /* the token: about the box's top-left corner — its layout place (the column alone transforms the box: layout.css) */
    o = liftS !== 1 ? offsetIn($("left"), col) : null,
    org = o ? `${o.x}px ${o.y}px` : "";
  if (col.style.transform !== t) col.style.transform = t;
  if (col.style.transformOrigin !== org) col.style.transformOrigin = org;
  /* its own frames only for what the driver doesn't move: a relation change rides the driver's frames while it runs
     (after the plate's write — its own loop could read the plate a frame late), and its own after (the fade-in
     outlasting the travel) */
  if (relation && !driving()) colRaf = requestAnimationFrame(colApply);
}
/** the box's STAND-IN for a fade-through — ARCHITECTURE › a layout switch (DD-2026-11-08-5): a copy made before the
 * change; fadeCol fades it out (leave.js)
 * @returns {import("./leave.js").Copy} */
export function standIn() {
  return leaveCopy([$("ltitle"), $("left"), $("chips")], { cls: "lcol" }); // .lcol: the parts' own rules (chips.css)
}
/** @typedef {{ l: number, t: number, w: number, h: number }} Box4 */
/** a relation change running: since when, how long, the leaving copy and both relations with the box's rect on each
 * (the old one as it was, the new one where it lands) @type {{ t0: number, T: number, out: HTMLElement, b0: Box4,
 * r0: import("./layoutmath.js").Relation, b1: Box4, r1: import("./layoutmath.js").Relation } | null} */
let relation = null;
/** a layout switch by the menu: the box fades through its change of relation, glued to the live plate —
 * ARCHITECTURE › a layout switch (DD-2026-11-08-7); placed by colApply, on the switch's clock
 * @param {import("./leave.js").Copy} out the stand-in (standIn) @param {{ t0: number, T: number }} sw the switch
 * @param {{ plate: Box4, dock: "left" | "right" | "below" }} was the plate on screen and the dock before the change */
export function fadeCol(out, sw, was) {
  const seen = fadeValue($("lcol")); // the box as it shows now (mid fade-in, if a switch is interrupted) — its copy starts there
  for (const a of colFades) a.cancel();
  relation = null;
  promptFollow(true); // its place where it lands: glued to where the plate lands (the layout is settled: tabs.js tabGo)
  const rect = (/** @type {Element} */ e) => {
      const r = e.getBoundingClientRect();
      return { l: r.left, t: r.top, w: r.width, h: r.height };
    },
    ol = out.el.querySelector(".left"),
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
      out: out.el,
      b0,
      r0: relationOf(b0, was.plate, glueAnchors(was.dock, pos)),
      b1,
      r1: relationOf(b1, { l: g.left, t: g.top, w: g.width, h: g.height }, glueAnchors(S.dock || "left", pos)),
    };
  }
  /* faded by their parts, never through an ancestor: glass under a fade loses its blur (fade.js). The copy leaves on its
     own (leave.js): gone when its fade is — a later switch doesn't cut it */
  for (const a of out.release({ duration: f.T, fill: "forwards" }, { from: seen, span: [0, k(f.outEnd)] }))
    a.startTime = sw.t0;
  colFades = [
    ...fade(
      $("lcol"),
      1,
      { duration: f.T, fill: "backwards" },
      { glass: true, from: 0, span: [k(f.inStart), k(f.inEnd)] }, // the box itself: where it lands, unseen until its turn
    ),
  ];
  for (const a of colFades) a.startTime = sw.t0;
  cancelAnimationFrame(colRaf);
  if (driving())
    follow(colApply); // in the driver's frames, after the plate's write (and its first frame now)
  else colApply(); // its first frame: the copy where it was (the plate hasn't moved yet)
}
/** @type {Animation[]} */
let colFades = [];
/* the box's glue to its partner's plate — ARCHITECTURE › the single layout pass ("the box's place … has ONE rule").
   It holds while you work in the prompt and catches up on the driver when you let go
   @param {boolean} [direct] the plate is being written now: follow it exactly (else: catch up on the driver) */
export function promptFollow(direct = false) {
  /* an edge being dragged is NOT working in the prompt (the divider's handle sits in it): the box follows the plate */
  if (!lay.drag && (lay.pressCard || document.querySelector("#left .pop.show"))) return;
  const app = /** @type {HTMLElement} */ (document.querySelector(".app")),
    stk = app.classList.contains("stacked"),
    R = app.classList.contains("pright");
  let x = 0,
    y = 0;
  /* Vertical: the box's place is the pass's, under its pane — it rides that pane's plate as it is on screen this frame
     (in a glide, one clock with it); at rest the plate is where the pass put it, so nothing */
  if (stk && lay.passV) {
    const p = glueRect(),
      pg = lay.passV.page;
    if (p.height > 0) y = Math.round(p.bottom - (pg.y + pg.h));
  }
  if (!stk && lay.last) {
    /* side by side: one pair gap from the plate as it is this frame. The box's place in the column is its layout box,
       without ANY transform (getBoundingClientRect counted a running switch's offset, and the glue cancelled it) */
    const p = glueRect(), // the plate as it is — or, in a layout switch, where it lands (plate.js)
      col = $("lcol"),
      box = $("left"),
      left = app.getBoundingClientRect().left + col.offsetLeft + box.offsetLeft,
      w = lay.shown ? lay.shown.pw : box.offsetWidth; // its width from its owner (boxWWrite), as written this frame
    if (p.width > 0 && w > 0) x = Math.round(R ? p.right + pairGap() - left : p.left - pairGap() - (left + w));
    else x = hugX;
    /* a switch (the plate travelling on the driver): the box rides it on its height axis too — its anchor (top / middle
       / bottom) kept to the plate's live lines, by the relation it has where the plate lands (layoutmath.js relationOf
       / glued) */
    const goal = movingTo("plate");
    if (goal && p.height > 0 && w > 0) {
      const top = app.getBoundingClientRect().top + col.offsetTop + box.offsetTop,
        b = { l: left, t: top, w, h: box.offsetHeight },
        r = relationOf(b, goal, glueAnchors(R ? "right" : "left", S.pos || "mid"));
      y = glued({ l: p.left, t: p.top, w: p.width, h: p.height }, r, b).t - b.t;
    }
  }
  const b2 = document.body.classList,
    /* at once: under your hand, and in a switch — the box's place there is the switch's (the plate's travel, the
       relation change: DD-4, the end state from the first frame); a catch-up asked mid-switch re-planned the switch */
    snap = b2.contains("laysnap") || b2.contains("liveresize") || b2.contains("laydrag") || travelling() || !!relation,
    at = (/** @type {number} */ l) => ({ l, t: 0, w: 0, h: 0 }),
    still = x === hugX && y === hugY && !relation;
  hugY = y; // a glue, at once (a catch-up glide on it put the box 113 px off the plate's first frame of a ratio change)
  /* across: at once in the driver's frames and under your hand; after a hold, a catch-up on the driver ("hug") */
  if (moving("hug") && !snap) rearrange("hug", at(hugX), at(x), hugWrite);
  else if (direct || snap) {
    stop("hug");
    if (still) return;
    hugX = x;
  } else if (x !== hugX) rearrange("hug", at(hugX), at(x), hugWrite);
  if (relation) {
    /* riding the live plate: placed now, in the frame the plate moved (its own frame would read it a frame late) */
    cancelAnimationFrame(colRaf);
    colApply();
  } else if (!colRaf) colApply();
}
/** live resize (body.liveresize): everything follows the window edge at once; the glides come back 150 ms after the
 * last resize event @type {number | undefined} */
let lrT;

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
     BEFORE anything acts on the release (the capture phase): a drop's layout switch started while the press still held
     the box's glue, and the box jumped by the old glue */
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
export function resetLayout() {
  S.lay = null; // every size back to its default; the box's place and mode too
  delete S.lw; // an old key
  S.pos = "mid";
  S.hmode = "";
  updHm();
  applyPH();
  save();
  sizeFrame();
  moveThumb(true);
  layoutLeft();
}
