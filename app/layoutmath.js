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
