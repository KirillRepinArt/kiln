// @ts-check
/* Kiln · the layout's maths: plain numbers in, plain numbers out — nothing here reads or touches the page, so every
   rule can be unit-tested (tools/tests/unit/layoutmath.test.mjs). layout.js measures the page, asks these, applies. */

export const GAP = 18, // between the prompt and the picture area
  MMIN = 24, // the least margin each side of the pair
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
  const per = Math.max(1, Math.floor((Math.max(h, 40) + 6) / 46)),
    cols = Math.ceil(n / per);
  return 6 + cols * 46;
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
  const room = W - GAP - 2 * MMIN;
  if (pw + rw > room) {
    const k = Math.max(0, room) / (pw + rw);
    pw = Math.max(PWMIN, pw * k);
    rw = Math.max(minR, Math.min(rw * k, W - GAP - pw));
  }
  const margin = Math.max(0, (W - GAP - pw - rw) / 2);
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
