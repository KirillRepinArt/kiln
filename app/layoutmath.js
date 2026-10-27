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
 * The prompt and the picture area as one centred pair: their widths and the margins round them.
 * Too narrow a window: both give way in proportion, each down to its minimum.
 * @param {object} m what was measured
 * @param {number} m.W the room the pair has (the window less its padding)
 * @param {boolean} m.gen Generating (the area hugs the picture) or another tab (a panel)
 * @param {boolean} m.drag an edge is being dragged (the area doesn't hug the picture then)
 * @param {number} m.minR the picture area's least width
 * @param {number} [m.hug] Generating, not dragging: the width that hugs the picture (picture + its button column)
 * @param {{pw: number, rw: number, iw: number | null}} L your widths: prompt, panel, the picture's cap (null = none)
 * @returns {import("./types.js").Geometry}
 */
export function pageGeometry(m, L) {
  const { W, gen, drag, minR } = m;
  let pw = Math.max(PWMIN, Math.min(L.pw, CARDMAX));
  const want = gen ? (drag ? L.iw || W : Math.min(L.iw || 1e9, m.hug ?? 9999)) : L.rw;
  let rw = Math.max(minR, want);
  const room = W - pairGap() - 2 * MMIN;
  if (pw + rw > room) {
    const k = Math.max(0, room) / (pw + rw);
    pw = Math.max(PWMIN, pw * k);
    rw = Math.max(minR, Math.min(rw * k, W - pairGap() - pw));
  }
  const margin = Math.max(0, (W - pairGap() - pw - rw) / 2);
  return { pw, rw, mL: margin, mR: margin, W, minR, off: 0, gen };
}

/**
 * Vertical: the picture area's column — no wider than a 16:9 picture at the height it has (plus its button column each
 * side), never narrower than the tab bar or the prompt box, never wider than the window.
 * @param {number} full the window's room
 * @param {number} minR the tab bar's least width
 * @param {number} promptW the prompt box's width
 * @param {number} picH the picture's height
 * @param {number} tb the button column's width at that height
 */
export function stackColumnW(full, minR, promptW, picH, tb) {
  return Math.round(Math.min(full, Math.max(minR, promptW, (picH * 16) / 9 + 2 * tb)));
}

/**
 * Where the picture goes in its area: picture + button column as one group, centred; the column on the side away
 * from the prompt. Vertical: the picture itself on the centre line (its column hangs in the margin).
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
  const top = heldTop != null ? heldTop : Math.max(0, (areaH - h - row) / 2);
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
 * Vertical: the prompt's slot height — yours (sch) or ~42 % of the window (at most 250 px), always 200 px to 70 % of it.
 * @param {number | undefined} sch
 * @param {number} innerH the window's height
 */
export function promptSlotH(sch, innerH) {
  return Math.max(200, Math.min(sch || Math.min(250, Math.round(innerH * 0.42)), Math.round(innerH * 0.7)));
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
 * The card in the usual mode: your height (pph) or its text's, within the room. Frozen (you're working in it): the top
 * stays put and only the bottom grows — a card resting at the bottom grows upward instead.
 * @param {object} c
 * @param {number} c.colH the column's height
 * @param {number} c.CH the chip row (with its gap)
 * @param {number} c.pph the height you set (0 = the text's)
 * @param {number} c.naturalH the height the text wants
 * @param {string} c.pos where it rests: "top" | "mid" | "bot"
 * @param {boolean} c.frozen
 * @param {number | null} c.prevTop the top it had
 * @param {number | null} c.prevBottom the bottom it had (box + chips)
 * @param {CardAnchors} c.a
 */
export function cardPlacement({ colH, CH, pph, naturalH, pos, frozen, prevTop, prevBottom, a }) {
  const room = colH - CH;
  let H = pph ? Math.min(Math.max(240, pph), room) : Math.min(naturalH, room);
  let top,
    bottom = prevBottom;
  if (frozen && prevTop != null) {
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
