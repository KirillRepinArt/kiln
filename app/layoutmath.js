// @ts-check
/* Kiln · the layout's maths: plain numbers in, plain numbers out — nothing here reads or touches the page, so every
   rule can be unit-tested (tools/tests/unit/layoutmath.test.mjs). layout.js measures the page, asks these, applies. */
import { SPACE, pairGap } from "./tokens.js";

export const MMIN = 24, // the least margin each side of the pair
  PWMIN = 360, // the prompt's least width
  CARDMAX = 900, // wide window: the prompt card never gets wider than this (text stops at ~76ch anyway)
  LISTMIN = 660; // the default width of the Queue / LoRAs / PNG Info panel

/**
 * A box of shape `ar` ("3:4") as large as fits in bw × bh.
 * @param {string} ar
 * @param {number} bw
 * @param {number} bh
 */
export function fitInBox(ar, bw, bh) {
  const [a, b] = ar.split(":").map(Number);
  let w = bw,
    h = (bw * b) / a;
  if (h > bh) {
    h = bh;
    w = (bh * a) / b;
  }
  return { w, h };
}

/* ---------- every page's plate: the content area minus insets (2026-10-31, the user's design) ----------
   One table decides what each page keeps room for, and what may show round its plate. The status row is an inset: room
   only while something is being made (or the queue is paused / a result waits behind your reference). The edit
   buttons are NOT room: they hang outside the plate, anchored to it, into a clearance the layout always keeps in the
   margin — so a page looks the same with them or without (the user: "the edit button area should be ignored for the
   layout"); `tools` only says whether they may show. Never hover. Everything else is the plate: full height by default.
   (Industry: iOS safe-area insets, Android WindowInsets for the row; anchored, out-of-flow controls for the buttons.) */

/** @typedef {"generating" | "gallery" | "panel"} Page */
/** what each page's plate holds: a picture fitted inside it, or a panel filling it */
export const PAGES = /** @type {const} */ ({
  generating: { fit: true },
  gallery: { fit: true },
  panel: { fit: false },
});
/**
 * What a page keeps room for right now (row) and whether its edit buttons may show (tools — never room).
 * @param {Page} page
 * @param {object} s
 * @param {boolean} s.running a job is being made
 * @param {boolean} s.waiting jobs are waiting
 * @param {boolean} s.paused the queue is paused
 * @param {boolean} s.ready the image generator is up (waiting jobs are about to start)
 * @param {boolean} s.news a result landed behind the reference you hold ("#N finished")
 * @param {boolean} s.shown a finished picture is on show
 * @returns {{ row: boolean, tools: boolean }}
 */
export function pageInsets(page, s) {
  if (page === "panel") return { row: false, tools: false };
  if (page === "gallery") return { row: false, tools: true };
  /* Generating: the row while the queue works — between two of its jobs too (a box changing between every job read as a
     twitch; "if there's a queue, nothing changes", the user). The buttons only when the row is gone: a result shown
     between two renders has none (the Gallery has them) */
  const row = s.running || (s.waiting && (s.paused || s.ready)) || s.news;
  return { row, tools: !row && s.shown };
}

/**
 * The edit buttons' column beside the picture: 40 px buttons, 6 px apart and from the picture, in as many columns as
 * the picture's height needs (none is ever cut off).
 * @param {number} h the picture's height
 * @param {number} n how many buttons
 */
export function toolColumnW(h, n) {
  const t = SPACE.tight,
    per = Math.max(1, Math.floor((Math.max(h, 40) + t) / (40 + t))),
    cols = Math.ceil(n / per);
  return t + cols * (40 + t);
}

/**
 * The prompt and the picture area as one centred pair: their widths and the margins round them, the same on both
 * sides. A picture page keeps the plate on a FIXED centre line (2026-10-31, the user: "expand or contract
 * symmetrically"): the prompt keeps its width and the picture's area takes at most what is left with even margins —
 * a wide picture is fitted to that (the textbook image stage: the panels keep their widths, the picture fits the rest,
 * centred; it never pushes them). Only a window too narrow even for that makes both give way, in proportion, each down
 * to its minimum.
 * One rule for the room (v0.7c, 2026-11-02, the user: "there's clearly some space in the app … a waste"): the group
 * may reach the room's ends (the window less its area gap each side); the prompt has no cap of its own (it was 900 px)
 * and no least margin (24 px). A picture page keeps the edit buttons' clearance on BOTH sides at rest: the plate's
 * centre line stays fixed while you browse shapes (the user, 2026-10-31); a drag may take the prompt's side of it
 * (layout.js layDrag). Placed by layoutmath.js arrange — the same group maths every layout uses. (Until the fit-page
 * rule, E: the picture page is an AREA the prompt hugs the picture inside; then the plate itself is the pane.)
 * @param {object} m what was measured
 * @param {number} m.W the room the pair has (the window less its area gap each side)
 * @param {boolean} m.gen Generating / the Gallery (a picture fitted into the area) or a panel
 * @param {number} m.minR the picture area's least width (the tab bar sits on its plate)
 * @param {number} [m.clear] the edit buttons' clearance beside the picture, on its outer side
 * @param {boolean} [m.promptRight] the prompt is on the right (the page's outer side is then the left)
 * @param {{pw: number, rw: number, iw: number | null}} L your widths: prompt, panel, the picture's cap (null = none)
 * @returns {import("./types.js").Geometry}
 */
export function pageGeometry(m, L) {
  const { W, gen, minR } = m,
    clear = Math.max(0, m.clear || 0),
    R = !!m.promptRight,
    box = { size: Math.max(PWMIN, L.pw), lo: Math.min(PWMIN, W), hi: W },
    /* a picture page takes the room the prompt leaves, up to your cap: the plate's centre line stays put */
    page = gen ? { size: null, lo: minR, hi: L.iw ? Math.max(minR, L.iw) : W } : { size: L.rw, lo: minR, hi: W },
    a = arrange({
      panes: R ? [page, box] : [box, page],
      gap: pairGap(),
      start: clear,
      length: W - 2 * clear,
      margin: 0,
      anchor: "center",
    }),
    [p, b] = R ? a.panes : [a.panes[1], a.panes[0]];
  return { pw: b.size, rw: p.size, mL: a.start, mR: W - a.end, W, minR, off: 0, gen, clear };
}

/**
 * Vertical: the picture area's column. Generating / the Gallery (gen): the window's width less a clearance each side —
 * the picture takes the room's height and its width follows its ratio (2026-11-01, the user: "21:9 should look exactly
 * like 16:9, only expanded further to the sides"; it was capped at a 16:9 picture's width, so wider ratios came out
 * short). The panels: no wider than a 16:9 picture at the height it has. Never narrower than the tab bar or the prompt
 * box, never wider than the window less a clearance each side (the edit buttons hang into it, outside the column).
 * @param {number} full the window's room
 * @param {number} minR the tab bar's least width
 * @param {number} promptW the prompt box's width
 * @param {number} picH the picture's height
 * @param {number} clear the clearance each side, beyond the window's own margin
 * @param {boolean} [gen] Generating / the Gallery: the whole width
 */
export function stackColumnW(full, minR, promptW, picH, clear, gen = false) {
  const most = full - 2 * clear;
  return Math.round(gen ? most : Math.min(most, Math.max(minR, promptW, (picH * 16) / 9)));
}

/**
 * Where the picture goes in its area: picture + button column as one group, centred; the column on the side away
 * from the prompt. Vertical: the picture itself on the centre line (its column hangs in the margin). No column or row
 * in the page's insets right now: pass 0 for it.
 * @param {object} a
 * @param {number} a.areaW the area's width
 * @param {number} a.areaH the area's height
 * @param {number} a.w the picture's width
 * @param {number} a.h the picture's height
 * @param {number} a.tb the button column's width
 * @param {number} a.row the room kept for the row under the picture (the status bar)
 * @param {number | null | undefined} a.heldTop a top / bottom edge held: the top stays put
 * @param {boolean} a.stacked Vertical
 * @param {boolean} a.toolsLeft the button column on the left (prompt on the right)
 */
export function framePlacement({ areaW, areaH, w, h, tb, row, heldTop, stacked, toolsLeft }) {
  /* Vertical: at the top of its room — the prompt follows it up, the spare height goes to the window's bottom (the user,
     2026-11-01: no hole between the picture and the prompt) */
  const top = heldTop != null ? heldTop : stacked ? 0 : Math.max(0, (areaH - h - row) / 2);
  const g0 = Math.max(0, Math.floor((areaW - w - tb) / 2));
  const left = stacked ? Math.floor((areaW - w) / 2) : toolsLeft ? g0 + tb : g0;
  return { top, left, toolsX: toolsLeft ? left - tb : left + w };
}

/**
 * Saved layouts from older versions → today's format (3: px). Format 2 kept widths as shares of the window: they become
 * px for the window they're opened in. Older ones had no version (already px). Returns what to save — the same object
 * when nothing changes.
 * @param {any} L the saved layout (S.lay), or nothing
 * @param {number} W the window's room now
 */
export function upgradeLayoutPrefs(L, W) {
  if (L && L.v === 2) return { pw: L.pw * W, rw: L.rw * W, iw: L.iw ? L.iw * W : null, ih: L.ih, v: 3 };
  if (L && !L.v) L.v = 3;
  return L;
}

/* ---------- the prompt card (wide window) ---------- */

/**
 * The picture's lines the card lines up with, in the card column's coordinates (null = not known yet).
 * @typedef {{ it: number | null, ib: number | null, cy: number | null }} CardAnchors  it: the picture's top, ib: the
 *   status line under it, cy: the picture's vertical centre
 */

/**
 * Vertical: the prompt box's height. Automatic (2026-10-31, the user's choice — the composer pattern): as tall as YOUR
 * draft's text, from the box's least height (its controls and ~2 lines) up to ~40 % of the window, then the text
 * scrolls. Or yours (sch, 2026-11-01): the height you dragged the divider to — the one boundary between the picture and
 * the prompt — kept until you double-click it back to automatic (the box's bottom edge side by side works the same).
 * Never above 70 % of the window. The picture gets the rest.
 * @param {number} natural the height your draft's text needs
 * @param {number | undefined} sch the height you set (0 / undefined: automatic)
 * @param {number} innerH the window's height
 * @param {number} least the box's least height
 */
export function promptSlotH(natural, sch, innerH, least) {
  const most = Math.round(innerH * 0.7),
    h = sch ? sch : Math.min(natural, Math.round(innerH * 0.4));
  return Math.round(Math.max(least, Math.min(h, most)));
}

/**
 * Where a card of height H rests: "top" level with the picture's top, "bot" level with its status line, "mid" centred
 * on the picture — always inside the column.
 * @param {string} pos "top" | "mid" | "bot"
 * @param {number} H the card's height (box + chip row)
 * @param {number} colH the column's height
 * @param {CardAnchors} a
 */
export function cardAnchorTop(pos, H, colH, a) {
  const t = pos === "top" ? (a.it ?? 0) : pos === "bot" ? (a.ib ?? colH) - H : (a.cy ?? colH / 2) - H / 2;
  return Math.max(0, Math.min(colH - H, t));
}

/**
 * The height modes: "full" = the whole column; "match" = from the picture's top to its status line. Too short for the
 * box's least height: that height, centred on the picture.
 * @param {"full" | "match"} mode
 * @param {number} colH the column's height
 * @param {number} CH the chip row under the box (with its gap)
 * @param {number} minH the box's least height
 * @param {CardAnchors & { cy: number }} a
 */
export function cardHeightMode(mode, colH, CH, minH, a) {
  let top, H;
  if (mode === "full") {
    top = 0;
    H = colH;
  } else {
    top = Math.max(0, a.it ?? 0);
    H = Math.min(colH - top, (a.ib ?? colH) - top);
  }
  H = Math.max(0, H - CH);
  if (H < minH) {
    H = Math.min(colH - CH, minH);
    top = Math.max(0, Math.min(colH - H - CH, a.cy - (H + CH) / 2));
  }
  return { top, H };
}

/**
 * The card in the usual mode: its text's height, within the room — never a height of its own (2026-11-02, DEVLOG
 * DD-2026-11-02-12: an edge sets a pane's size within [least, largest]; the box's least = largest = its text, so its
 * height edges give a little and snap back). While one is held, `held` is the height shown (the rubber band) and
 * `heldPin` the side that holds. Frozen (you're working in it): the top stays put and only the bottom grows — a card
 * resting at the bottom grows upward instead.
 * @param {object} c
 * @param {number} c.colH the column's height
 * @param {number} c.CH the chip row (with its gap)
 * @param {number} [c.held] a height edge held: the height shown (0 / none: the text's)
 * @param {"top" | "bottom"} [c.heldPin] and the side that holds meanwhile
 * @param {number} c.naturalH the height the text wants
 * @param {string} c.pos where it rests: "top" | "mid" | "bot"
 * @param {boolean} c.frozen
 * @param {number | null} c.prevTop the top it had
 * @param {number | null} c.prevBottom the bottom it had (box + chips)
 * @param {CardAnchors} c.a
 */
export function cardPlacement({ colH, CH, held = 0, heldPin = "top", naturalH, pos, frozen, prevTop, prevBottom, a }) {
  const room = colH - CH;
  let H = held ? Math.min(held, room) : Math.min(naturalH, room);
  let top,
    bottom = prevBottom;
  if (held && prevTop != null && prevBottom != null) {
    top = heldPin === "bottom" ? Math.max(0, prevBottom - H - CH) : prevTop; // the other side holds
  } else if (frozen && prevTop != null) {
    if (pos === "bot" && prevBottom != null) {
      top = Math.max(0, prevBottom - H - CH);
      H = Math.min(H, room - top);
    } else {
      top = prevTop;
      H = Math.min(H, room - top);
    }
  } else {
    top = cardAnchorTop(pos, H + CH, colH, a);
    bottom = top + H + CH;
  }
  return { top, H, bottom };
}

/* cubic-bezier easing as a function (for motion run frame by frame: the crop-and-reveal, the prompt column's slide) */
/** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @returns {(x: number) => number} */
export function bez(x1, y1, x2, y2) {
  /** @typedef {(a: number, b: number) => number} AB @typedef {(t: number, a: number, b: number) => number} TAB */
  const A = /** @type {AB} */ ((a, b) => 1 - 3 * b + 3 * a),
    B = /** @type {AB} */ ((a, b) => 3 * b - 6 * a),
    C = (/** @type {number} */ a) => 3 * a,
    f = /** @type {TAB} */ ((t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t),
    d = /** @type {TAB} */ ((t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a));
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

/* ---------- a box changing shape: the ONE choreography (2026-10-28) ----------
   CROP, then REVEAL (the user's design, 2026-10-19; per axis since 2026-10-27). An axis that shrinks moves first (the
   old contents cropped, never squeezed), the new contents take over at the overlap (a short cross-fade), an axis that
   grows moves last (more of the new revealed). An axis that keeps its size doesn't move; a step with nothing to do takes
   no time; each axis moves its centre with its size, so both sides go in or out alike. Browsing pictures (morph.js) and
   a tab switch (plate.js switchGlide) both move by it: with a rule of their own, a switch from an empty 1:1 frame to a
   16:9 picture showed a band of bare glass above and below the picture as it came in ("washed edges", the user) */
export const MORPH = {
  a: 180, // the crop (accelerating into the swap)
  s: 80, // the cross-fade at the overlap (a crop or a reveal around it carries the change)
  alone: 200, // the cross-fade when nothing changes shape: on its own, 80 ms read as a cut (Queue ↔ PNG Info, the user)
  b: 280, // the reveal (decelerating out of it)
  one: 320, // only a crop, or only a reveal: one move, eased at both ends
  fade: 200, // a view's contents fading out or in, in EVERY switch: one speed (the user, 2026-10-31 — the Queue ↔ PNG Info one)
};
/* Material's emphasized curves: into the swap accelerating, out of it decelerating — with the swap between, it reads as
   one move; a lone crop or reveal is eased at both ends */
const eIn = bez(0.3, 0, 0.8, 0.15),
  eOut = bez(0.05, 0.7, 0.1, 1),
  eBoth = bez(0.2, 0, 0, 1);
/**
 * The steps of a shape change from size o to size n: the crop (0 → A), the swap (A → A + S), the reveal (→ T), and per
 * axis how far along it is at e ms (0 → 1).
 * @param {{ w: number, h: number }} o @param {{ w: number, h: number }} n
 */
export function shapeSteps(o, n) {
  const shrink = [n.w < o.w - 0.5, n.h < o.h - 0.5],
    grow = [n.w > o.w + 0.5, n.h > o.h + 0.5],
    crop = shrink[0] || shrink[1],
    reveal = grow[0] || grow[1],
    A = crop ? (reveal ? MORPH.a : MORPH.one) : 0,
    S = crop || reveal ? MORPH.s : MORPH.alone,
    B = reveal ? (crop ? MORPH.b : MORPH.one) : 0,
    T = A + S + B,
    eA = reveal ? eIn : eBoth,
    eB = crop ? eOut : eBoth;
  /** per axis [x, y], how far along at e ms @param {number} e @returns {[number, number]} */
  const q = e => {
    const pA = A ? eA(Math.min(1, e / A)) : 1,
      pB = B ? eB(Math.min(1, Math.max(0, e - A - S) / B)) : 1,
      pAll = eBoth(Math.min(1, e / T)),
      at = (/** @type {number} */ i) => (shrink[i] ? pA : grow[i] ? pB : pAll);
    return [at(0), at(1)];
  };
  return { A, S, B, T, q };
}
/**
 * ONE fade for contents, everywhere (2026-10-31, the user: "one fade speed everywhere") — a view's contents in a tab
 * switch (plate.js), the frame's pictures when they change (pictures.js, the crop-and-reveal's in morph.js): what
 * leaves fades in the MORPH.fade ms that end at the swap (from the first frame if the swap comes sooner), what comes in
 * the MORPH.fade ms that start at it, linearly. Nothing changes shape: the swap is at the start — a cross-fade.
 * @param {{ A: number, S: number, T: number }} st a shape change's steps (shapeSteps)
 * @returns {{ out: { delay: number, duration: number }, in: { delay: number, duration: number }, T: number }} T: the
 *   whole change, its fades included
 */
export function fades(st) {
  const F = MORPH.fade;
  return {
    out: { delay: Math.max(0, st.A + st.S - F), duration: F },
    in: { delay: st.A, duration: F },
    T: Math.max(st.T, st.A + F),
  };
}

/**
 * The box at a point of a shape change: each axis moves its centre and its size by its own progress.
 * @param {{ l: number, t: number, w: number, h: number }} o @param {{ l: number, t: number, w: number, h: number }} n
 * @param {[number, number]} q
 */
export function shapeBox(o, n, q) {
  const ax = (
    /** @type {number} */ s0,
    /** @type {number} */ z0,
    /** @type {number} */ s1,
    /** @type {number} */ z1,
    /** @type {number} */ k,
  ) => {
    const c = s0 + z0 / 2 + (s1 + z1 / 2 - (s0 + z0 / 2)) * k,
      z = z0 + (z1 - z0) * k;
    return [c - z / 2, z];
  };
  const [l, w] = ax(o.l, o.w, n.l, n.w, q[0]),
    [t, h] = ax(o.t, o.h, n.t, n.h, q[1]);
  return { l, t, w, h };
}

/* ---------- v0.7c · the layout model (docs/decisions/0013-layout-tree.md) ----------
   Three owners: SIZES (yours, per pane × page × orientation, set by edges), the GROUP (panes stick together with one
   gap) and PLACEMENT (one resting anchor per layout). A drag adds a PIN (the grabbed pane's opposite side holds
   still); a release drops it and the group settles. Past a limit a size moves on with resistance (rubber). Plain
   numbers in, plain numbers out: nothing here reads the page. */

/** the panes a layout holds besides the prompt box @typedef {"generating" | "gallery" | "queue" | "loras" | "png"} PageId */
/** @typedef {"side" | "vert"} Orient side by side (Left and Right are mirrors and share one) or Vertical */
/** a size; null = the default (for a picture page: no cap) @typedef {{ w: number | null, h: number | null }} PaneSize */
/** @typedef {{ v: 4, side: { box: PaneSize, pages: Record<PageId, PaneSize> }, vert: { box: PaneSize, pages: Record<PageId, PaneSize> } }} LayoutV4 */

export const PAGE_IDS = /** @type {const} */ (["generating", "gallery", "queue", "loras", "png"]);
/** a picture page fits its picture inside its size (a cap); a panel fills its size @param {string} id */
export const isFitPage = id => id === "generating" || id === "gallery";
export const BOXHMIN = 240, // the prompt box's least height side by side (you set it with its edges)
  PICHMIN = 200, // a picture's least height
  PANELHMIN = 240, // a panel's least height
  QUEUEMAX = 900, // the Queue's widest: past it, lines get too long to read
  SLOTMAX = 0.7; // Vertical: the prompt box's tallest, a share of the window

/** how far a size may stretch past its limit (the rubber band's d): one area gap, the same for every edge — enough to
 * feel the limit answer back (2026-11-02, the user: 160 px "way too big": it ran under the tab bar and off the window) */
export const RUBBER = 20;
/** how far a picture may grow past its room while held: one part gap — never more than the gap between it and the tab
 * bar, the prompt's name or the window's edge, so the overshoot never covers another part */
export const PIC_OVER = 12;
/**
 * Past a limit a size moves on with resistance and springs back on release (Apple's rubber band):
 * over → d · (1 − 1 / (over · 0.55 / d + 1)), always less than over, never past d.
 * @param {number} x the size the pointer asks for
 * @param {number} lo @param {number} hi the limits (lo = hi: a fixed size that still answers back)
 * @param {number} d how far it can stretch at most (the pane's size at grab is a good one)
 */
export function rubber(x, lo, hi, d) {
  const f = (/** @type {number} */ over) => (d > 0 ? d * (1 - 1 / ((over * 0.55) / d + 1)) : 0);
  if (x < lo) return lo - f(lo - x);
  if (x > hi) return hi + f(x - hi);
  return x;
}

/**
 * A pane's size when you haven't set one. Panels: a 2:3 plate side by side, 1:1 in Vertical, at the room's height.
 * Picture pages: no cap (the room). The box: 680 wide side by side; its height automatic (grows with your draft).
 * @param {"box" | PageId} pane @param {Orient} orient @param {{ w: number, h: number }} room
 * @returns {PaneSize}
 */
export function paneDefault(pane, orient, room) {
  if (pane === "box") return { w: orient === "side" ? 680 : null, h: null };
  if (isFitPage(pane)) return { w: null, h: null };
  return { w: Math.round(orient === "side" ? (room.h * 2) / 3 : room.h), h: room.h };
}

/**
 * Every pane's least and largest size, in ONE place (they were literals scattered over five edge gestures).
 * @param {"box" | PageId} pane
 * @param {"w" | "h"} axis
 * @param {object} c
 * @param {Orient} c.orient
 * @param {number} c.roomW the room the layout has (the window less its edge)
 * @param {number} c.roomH
 * @param {number} c.minR the tab bar's width: a page is never narrower (the bar sits on its plate)
 * @param {number} [c.least] the prompt box's least height (its controls and ~2 lines)
 * @param {number} [c.winH] the window's height (Vertical: the box's tallest is a share of it)
 * @returns {{ lo: number, hi: number }}
 */
export function limits(pane, axis, c) {
  const W = c.roomW,
    H = c.roomH;
  const r = (/** @type {number} */ lo, /** @type {number} */ hi) => ({ lo: Math.min(lo, hi), hi });
  if (pane === "box") {
    if (axis === "w") return r(PWMIN, W); // no cap of its own (it was 900 px side by side): the room's ends
    return c.orient === "side" ? r(BOXHMIN, H) : r(c.least ?? BOXHMIN, Math.round((c.winH ?? H) * SLOTMAX));
  }
  if (axis === "h") return r(isFitPage(pane) ? PICHMIN : PANELHMIN, H);
  if (pane === "queue") return r(c.minR, Math.min(QUEUEMAX, W));
  if (pane === "png") {
    const fixed = Math.max(c.minR, paneDefault(pane, c.orient, { w: W, h: H }).w ?? c.minR);
    return r(fixed, fixed); // a fixed width: its edges still answer back (rubber)
  }
  return r(c.minR, W);
}

/**
 * The group along one axis: panes side by side (or stacked) with one gap between neighbours, placed at the layout's
 * resting anchor, or held by a pin while an edge is dragged.
 * - A pane with size null takes the room left (one at most: a picture page with no cap).
 * - Too little room: the margins go first, then every pane shrinks in proportion, none below its least.
 * - anchor "center": the group in the middle of the room; "start": `margin` from its start (Vertical, under the bar).
 * - pin {i, side, at}: pane i's start / end side sits at `at` (a drag keeps the side it doesn't grab still).
 * @param {object} a
 * @param {{ size: number | null, lo: number, hi: number }[]} a.panes
 * @param {number} a.gap between neighbours
 * @param {number} a.start @param {number} a.length the room along this axis
 * @param {number} a.margin the least room kept at each end
 * @param {"center" | "start"} a.anchor
 * @param {{ i: number, side: "start" | "end", at: number } | null} [a.pin]
 * @returns {{ panes: { start: number, size: number }[], start: number, end: number }}
 */
export function arrange(a) {
  const n = a.panes.length,
    avail = a.length - 2 * a.margin - a.gap * Math.max(0, n - 1),
    clamp = (/** @type {number} */ x, /** @type {{ lo: number, hi: number }} */ p) => Math.max(p.lo, Math.min(p.hi, x));
  const sizes = a.panes.map(p => (p.size == null ? 0 : clamp(p.size, p)));
  const fill = a.panes.findIndex(p => p.size == null);
  if (fill >= 0) {
    const rest = sizes.reduce((s, x, i) => (i === fill ? s : s + x), 0);
    sizes[fill] = clamp(avail - rest, a.panes[fill]);
  }
  /* too little room: shrink in proportion, none below its least (those at their least drop out of the next round) */
  for (let round = 0; round < n; round++) {
    const total = sizes.reduce((s, x) => s + x, 0);
    if (total <= avail + 1e-9) break;
    const free = sizes.map((x, i) => x > a.panes[i].lo + 1e-9),
      flex = sizes.reduce((s, x, i) => (free[i] ? s + x : s), 0);
    if (flex <= 0) break; // everything at its least: it overflows, centred
    const k = Math.max(0, avail - (total - flex)) / flex;
    sizes.forEach((x, i) => {
      if (free[i]) sizes[i] = Math.max(a.panes[i].lo, x * k);
    });
  }
  const total = sizes.reduce((s, x) => s + x, 0) + a.gap * Math.max(0, n - 1),
    offs = sizes.map((_, i) => sizes.slice(0, i).reduce((s, x) => s + x + a.gap, 0));
  let start = a.anchor === "center" ? a.start + (a.length - total) / 2 : a.start + a.margin;
  if (a.pin) start = a.pin.at - (offs[a.pin.i] + (a.pin.side === "end" ? sizes[a.pin.i] : 0));
  return { panes: sizes.map((size, i) => ({ start: start + offs[i], size })), start, end: start + total };
}

/**
 * How far the group's end (or start) may still move toward the room's edge: what a pane at that end may grow by
 * while its other side is pinned (a drag must not push the group out of the window).
 * @param {{ start: number, end: number }} arr an arrangement (arrange)
 * @param {"start" | "end"} side the group's side that moves
 * @param {number} roomStart @param {number} roomEnd
 */
export function growRoom(arr, side, roomStart, roomEnd) {
  return Math.max(0, side === "end" ? roomEnd - arr.end : arr.start - roomStart);
}

/**
 * The divider between two neighbours: one grows exactly as much as the other shrinks. Returns the change for the
 * first pane (the second gets minus it), within both panes' limits, with resistance past them.
 * @param {number} d the pointer's move @param {number} a the first pane's size at grab
 * @param {number} b the second's @param {{ lo: number, hi: number }} la @param {{ lo: number, hi: number }} lb
 */
export function trade(d, a, b, la, lb) {
  const hi = Math.min(la.hi - a, b - lb.lo),
    lo = Math.min(hi, Math.max(la.lo - a, b - lb.hi));
  return rubber(d, lo, hi, RUBBER);
}

/**
 * Saved layouts of v3 (one width per role, heights elsewhere) → v4 (a size per pane × page × orientation). Once, at
 * start-up. v3's picture height caps were shares of the room; v4 keeps px (a size you set means that size).
 * @param {any} L the saved layout (S.lay, v3) @param {object} o
 * The prompt box's height is never kept (2026-11-01, the user: it hugs its text unless an expand button is on), so the
 * old pph / sch don't carry over: box.h stays null.
 * @param {number} o.roomH the picture's room height now (side by side) @param {number} o.vroomH the same in Vertical
 * @returns {LayoutV4}
 */
export function layoutPrefsV4(L, o) {
  if (L && L.v === 4) return L;
  const l = L || {},
    none = () => ({ w: null, h: null }),
    pages = (/** @type {Partial<Record<PageId, PaneSize>>} */ s) =>
      /** @type {Record<PageId, PaneSize>} */ (Object.fromEntries(PAGE_IDS.map(id => [id, s[id] || none()]))),
    px = (/** @type {number | null | undefined} */ share, /** @type {number} */ room) =>
      share ? Math.round(share * room) : null,
    pic = () => ({ w: l.iw ?? null, h: px(l.ih, o.roomH) }),
    vpic = () => ({ w: null, h: px(l.vih, o.vroomH) }),
    panel = () => ({ w: l.rw ?? null, h: null });
  return {
    v: 4,
    side: {
      box: { w: l.pw ?? null, h: null },
      pages: pages({ generating: pic(), gallery: pic(), queue: panel(), loras: panel() }),
    },
    vert: { box: { w: l.sw ?? null, h: null }, pages: pages({ generating: vpic(), gallery: vpic() }) },
  };
}
