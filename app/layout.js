// @ts-check
/** @typedef {import("./types.js").Geometry} Geometry @typedef {import("./types.js").LayoutPrefs} LayoutPrefs */
import { SWITCH, plateFollow } from "./plate.js";
import { placeAround } from "./around.js";
import { frameGoal, layT } from "./framebox.js";
import { syncH } from "./boot.js";
import { applyMode, applyPH, layoutLeft, lyReset, stackW, updHm } from "./cardlayout.js";
import { $ } from "./dom.js";
import { current, jobs } from "./jobs.js";
import {
  CARDMAX,
  LISTMIN,
  PWMIN,
  bez,
  fitInBox,
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
/* your sizes, as the layout keeps them — it makes them (from the defaults) the first time it lays out, at start-up,
   so anything you can drag finds them there */
export function prefs() {
  return /** @type {LayoutPrefs} */ (S.lay);
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
  target: null,
  frameDefer: false,
  framePending: false,
  frameHold: false,
  row: null,
  rowView: null,
  ins: "",
  colW: 0,
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
/* the picture's largest height: the room less the status row while the page keeps it (insets) */
export function picFull() {
  return roomH() - (insets().row ? rowRoom() : 0);
}
/* the picture's height: picFull, capped in Generating by S.lay.ih (a share of it, set with the image area's top /
   bottom edges; null = no cap). While such an edge is held, lay.vh is the live height */
function picH() {
  const full = picFull();
  if (lay.vh) return Math.min(full, lay.vh);
  const ih = S.lay && (document.querySelector(".app.stacked") ? S.lay.vih : S.lay.ih);
  return S.view === "gen" && ih ? Math.max(200, Math.min(full, ih * full)) : full;
} /* Vertical keeps its own limit (vih) */
/* the clearance the edit buttons need beyond the window's own margin (they hang outside the plate, never room in the
   area — kept whether they show or not, so nothing moves when they come) */
function toolsClear(/** @type {number} */ h) {
  return Math.max(0, tbW(h) - SPACE.area);
}
function hugW() {
  const j = onShow() || current(),
    ar = j ? j.ar : S.ar,
    [a, b] = ar.split(":").map(Number),
    h = picH();
  return h > 0 ? (h * a) / b : 9999;
}
export function layGeo() {
  const W = layW();
  const gen = S.view === "gen",
    L = S.lay || (S.lay = Object.assign(layDef(), S.lw ? { pw: S.lw } : {})),
    /* never narrower than the tab bar: it sits on the plate's centre line (plate.js placeBar), and the plate is centred
       in the area on every page (2026-10-31; the bar used to be clamped into the area, off the plate's centre) */
    minR = minRight();
  // the picture's hug width is measured only when it's used (Generating, no edge held)
  return pageGeometry(
    {
      W,
      gen,
      drag: lay.drag,
      minR,
      hug: gen && !lay.drag ? hugW() : undefined,
      clear: gen ? toolsClear(picH()) : 0,
    },
    L,
  );
}
/** @param {Geometry} g */
function layApply(g) {
  const app = /** @type {HTMLElement} */ (document.querySelector(".app")),
    st = app.style,
    px = (/** @type {number} */ v) => Math.round(v * 10) / 10 + "px";
  const mL = Math.max(0, g.mL + (g.off || 0)),
    mR = Math.max(0, g.W - pairGap() - g.pw - g.rw - mL);
  st.setProperty("--mL", px(mL));
  st.setProperty("--pw", px(g.pw));
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
    g.rw = Math.max(g.minR, Math.min(g.rw, g.W - pairGap() - g.pw)); /* the prompt keeps its place and its width */
    g.mL = g.mR = Math.max(0, (g.W - pairGap() - g.pw - g.rw) / 2);
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
    const W2 = g.W - pairGap() - g.pw - g.rw;
    g.off = g0.mL - (pw - g0.pw) - W2 / 2;
  }
  if (edge === "ro") {
    const rw = Math.max(g0.minR, Math.min(g0.rw + g0.mR, g0.rw + dx));
    g.rw = rw;
    const W2 = g.W - pairGap() - g.pw - g.rw;
    g.off = g0.mL - W2 / 2;
  }
  g.mL = g.mR = Math.max(0, (g.W - pairGap() - g.pw - g.rw) / 2);
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
    const W2 = g.W - pairGap() - g.pw - g.rw;
    g.off = g0.mL - W2 / 2;
  }
  if (edge === "ro") {
    const rw = Math.max(g0.minR, Math.min(g0.rw + g0.mL, g0.rw + dx));
    g.rw = rw;
    const W2 = g.W - pairGap() - g.pw - g.rw;
    g.off = g0.mL - (rw - g0.rw) - W2 / 2;
  } /* dx arrives mirrored: leftwards grows it */
  g.mL = g.mR = Math.max(0, (g.W - pairGap() - g.pw - g.rw) / 2);
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
  const b = document.body,
    h = document.documentElement,
    me = ++morphs;
  let ended = false;
  const end = () => {
    if (ended || me !== morphs) return; // a newer switch cut this one short: the classes are its now
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
      const hh = picH();
      lay.colW = stackColumnW(app.clientWidth - 2 * SPACE.area, minRight(), stackW(), hh, toolsClear(hh));
      rt.style.width = lay.colW + "px";
    } else {
      if (rt.style.width) rt.style.width = "";
      lay.colW = 0;
    }
  }
  /* the target geometry, not a measurement: the grid may be mid-glide */
  const st = stageRect(),
    SW = stk ? (lay.colW ? lay.colW - 2 : st.width) : /** @type {Geometry} */ (lay.last).rw; // wide: layApply above has set it
  const f = $("frame"); /* Vertical: the column's target width (it may be mid-glide), less the panel's 1 px borders */
  const PH = picH(),
    TB = tbW(PH), // the edit buttons' column: it hangs outside the plate (no room in the area — toolsClear)
    R = ins.row ? rowRoom() : 0,
    M = SPACE.mat, // the picture's mat: the plate is the picture and M round it
    { w, h } = fitInBox(ar, SW - 2 * M, PH - 2 * M),
    W = w + 2 * M, // the plate
    H = h + 2 * M;
  /* the picture's canvas is drawn at the box's FINAL size and centred in it: the box may glide to a new shape (its
    edges clip the picture, like a container transform) without the canvas being stretched on the way */
  /* a held top / bottom edge (lay.vtop): the other edge stays put. The plate is centred in its area on every page; the
    button column hangs on the side away from the prompt (Vertical: on the right) */
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
  /* the area's outer handle sits on the picture's outer edge in Generating (the edge you see), not past the button column */
  {
    const ro = /** @type {HTMLElement} */ (document.querySelector(".pedge.ro"));
    if (ro) {
      const on = !stk && S.view === "gen",
        d = tbLeft ? left : SW - (left + W);
      ro.style.right = on && !tbLeft ? d - 6 + "px" : "";
      ro.style.left = on && tbLeft ? d - 6 + "px" : "";
    }
  }
  /* while an edge is held or hovered: an outline round the picture itself, an even 5 px out (the edges you drag are
    the picture's own; the box it may fill showed as a frame floating off the picture) */

  /* Vertical: the picture block sits between two equal gaps — roomH() ends one even gap above the prompt's name */
  vAlign();
  /* the tab bar: as wide as the area; WHERE it sits is the plate's business (plate.js placeBar — one owner) */
  const tb = /** @type {HTMLElement} */ (document.querySelector(".tabs"));
  if (tb) tb.style.width = stk ? "" : SW + "px";
  /* the status row, Show prompt, the edit buttons and the edge strips: placed from where the frame is now, and every
     frame it moves (around.js — one owner: the frame) */
  placeAround();
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
  $("hsplit").style.top = pn - colTop - 10 + "px";
}
/* ---------- the prompt column's place has ONE owner (2026-10-28) ----------
   Its transform = what is left of a tab switch's slide, written here only (Vertical's upward shift is gone,
   2026-10-31). Two writers used to set it: vAlign's inline style, and a switch's own animation that froze the shift it
   started with for 650 ms (a re-shift meanwhile showed only at the end, as a jump) */
const colEase = bez(SWITCH.curve[0], SWITCH.curve[1], SWITCH.curve[2], SWITCH.curve[3]); // the switch's glide (plate.js)
let slX = 0, // the slide: how far from its place it started, and when
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
  const k = slideLeft(performance.now()),
    x = Math.round(slX * k),
    y = Math.round(slY * k),
    t = x || y ? `translate(${x}px, ${y}px)` : "",
    col = $("lcol");
  colX = x;
  colY = y;
  if (col.style.transform !== t) col.style.transform = t;
  if (k > 0) colRaf = requestAnimationFrame(colApply);
  else slT0 = 0;
}
/** a tab switch moved the column's place: it slides there from where it was on screen (measured before the switch —
 * mid-slide too, so a fast second switch carries on from there). Its place is worked out here, from the layout:
 * measured through the running slide's offset @param {DOMRect} was */
export function slideCol(was, t0 = performance.now()) {
  const r = $("lcol").getBoundingClientRect();
  slX = Math.round(was.left - (r.left - colX));
  slY = Math.round(was.top - (r.top - colY));
  slT0 = slX || slY ? t0 : 0;
  cancelAnimationFrame(colRaf);
  colApply();
}
// live resize: everything follows the window edge directly; animations return ~150 ms after the last resize event

/** @type {number | undefined} */
let lrT; // the window-resize class's timer

/* start-up wiring: the holds (pointer over the picture, a press in the prompt), the edges' outline, window resize (called from main.js, in order) */
export function initLayout() {
  /* the resize outline: drawn on the page's bottom layer (fixed, under every panel, so nothing clips it), one outline
   gap round what the edge sizes — the picture in Generating, the panel in Queue / LoRAs / PNG Info — following it
   every frame while an edge is hovered or held */
  (function () {
    const fh = $("fithint"),
      rt = $("right");
    let on = false;
    let offAt = 0;
    function tick() {
      const paneled = !!document.querySelector(".rpanel.paneled"),
        want = rt.classList.contains("edgehint") && (S.view === "gen" || paneled);
      if (want) offAt = 0;
      else if (!offAt) {
        offAt = performance.now();
        fh.classList.remove("show");
      }
      if (!want && performance.now() - offAt > 800) {
        on = false;
        return;
      } /* it fades out late and slowly (CSS): keep it on the picture meanwhile */
      const r = (paneled ? $("rpanel") : $("plate")).getBoundingClientRect(), // the plate: the edge you see
        O = SPACE.outline;
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
