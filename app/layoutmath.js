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
 * @param {boolean} [s.prompt] Show prompt is on (the Gallery, the prompt closed — browse.js showPromptOn)
 * @returns {{ row: "bar" | "prompt" | false, tools: boolean }} row: the slot under the picture's occupant — the status
 *   row ("bar") or Show prompt ("prompt") — or none
 */
export function pageInsets(page, s) {
  if (page === "panel") return { row: false, tools: false };
  /* the slot under the picture has ONE occupant and the pass keeps its room (A1, 2026-11-11): the Gallery's is Show
     prompt while the prompt is closed — it had no room, and in Vertical it lay under the box's name row (V9) */
  if (page === "gallery") return { row: s.prompt ? "prompt" : false, tools: true };
  /* Generating: the row while the queue works — between two of its jobs too (a box changing between every job read as a
     twitch; "if there's a queue, nothing changes", the user). The buttons only when the row is gone: a result shown
     between two renders has none (the Gallery has them) */
  const row = !!(s.running || (s.waiting && (s.paused || s.ready)) || s.news);
  return { row: row ? "bar" : false, tools: !row && s.shown };
}

/** the edit buttons beside the picture (state.js sideButtons builds them; a unit test keeps the two counts the same) */
export const EDIT_TOOLS = 6;
/**
 * The edit buttons' column beside the picture: 40 px buttons, `tight` apart and from the picture — ONE column, always.
 * A picture is never shorter than the column (picLeastH), so the strip's width never depends on the picture's height:
 * when it wrapped into a second column on a short picture, the strip's room grew as the picture shrank, and a drag and
 * the rest disagreed by 48–76 px (DEVLOG DD-2026-11-07-2: a size may not depend on what depends on it — CSS's
 * min-content, Auto Layout's compression resistance).
 */
export function toolColumnW() {
  return SPACE.tight + 40 + SPACE.tight;
}
/** a picture's least height: its edit buttons' column (one column of EDIT_TOOLS) — the content's minimum, read from the
 * gap token each time (initTokens may change it) */
export function picLeastH() {
  return EDIT_TOOLS * 40 + (EDIT_TOOLS - 1) * SPACE.tight;
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
 * @param {number} [m.boxLo] the box's least width (its bottom row's need; PWMIN at the least)
 * @param {boolean} [m.promptRight] the prompt is on the right (the page's outer side is then the left)
 * @param {{pw: number, rw: number, iw: number | null}} L your widths: prompt, panel, the picture's cap (null = none)
 * @returns {import("./types.js").Geometry}
 */
export function pageGeometry(m, L) {
  const { W, gen, minR } = m,
    clear = Math.max(0, m.clear || 0),
    R = !!m.promptRight,
    lo = Math.max(PWMIN, m.boxLo ?? 0), // the box's least width: what its bottom row needs (cardlayout.js boxWLeast)
    box = { size: Math.max(lo, L.pw), lo: Math.min(lo, W), hi: W },
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
  let H = held ? held : Math.min(naturalH, room);
  let top,
    bottom = prevBottom;
  if (held && prevTop != null && prevBottom != null) {
    /* a height edge held (C6): the other side holds — until the grabbed side reaches the column's end; then it gives
       way, the box growing into the far side's empty room (the give-way order, DEVLOG DD-2026-11-03-1: from the middle a
       pull stopped at the column's end, the release re-centred it, and it took four pulls to reach the room); past the
       whole room the grabbed side shows the rubber band (`held` past it) */
    if (pos === "mid") {
      /* resting in the middle (a centred axis): it grows about its centre — the far side mirrors the grabbed one (DD-6,
         as every centred edge), each side giving way where the column ends; past the room, the give on both */
      const c = (prevTop + prevBottom) / 2,
        free = colH - H - CH;
      top = free >= 0 ? Math.max(0, Math.min(free, c - (H + CH) / 2)) : free / 2;
    } else
      top =
        heldPin === "bottom"
          ? Math.max(prevBottom, Math.min(colH, H + CH)) - H - CH
          : Math.min(prevTop, Math.max(0, colH - H - CH));
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
  out: 150, // a glued element leaving its old relation: gone early in the motion (Material fade-through's outgoing share)
  gone: 34, // ~2 frames fully gone while its relation changes: never seen jumping
};
/* Material's emphasized curves: into the swap accelerating, out of it decelerating — with the swap between, it reads as
   one move; a lone crop or reveal is eased at both ends */
const eIn = bez(0.3, 0, 0.8, 0.15),
  eOut = bez(0.05, 0.7, 0.1, 1),
  eBoth = bez(0.2, 0, 0, 1);
/** @typedef {{ w: number, h: number, l?: number, t?: number }} ShapeBox a box's size, and its place when it has one */
/**
 * ONE plan for boxes changing together — a rearrangement (v0.7c T2, ux-review/17-t2-motion.md): the crop (0 → A) if
 * ANY box shrinks on any axis, the swap (A → A + S), the reveal (→ T) if any grows — so what shrinks finishes before
 * anything grows, across the boxes (the box narrows, then the picture widens), on one clock. Per box and axis: a shrinking
 * axis moves in the crop, a growing one in the reveal, one that only moves its place over the whole plan. Nothing
 * changing size but something moving (a pure move): the switch's full length, eased at both ends — a fixed time per kind
 * of motion, not per pixel (iOS's springs, Material's emphasized ~500 ms; the user's pick, DEVLOG DD-2026-11-07-6).
 * @param {{ o: ShapeBox, n: ShapeBox }[]} pairs
 */
export function shapePlan(pairs) {
  const ch = pairs.map(({ o, n }) => {
      const placed = o.l != null && n.l != null && o.t != null && n.t != null,
        c = (/** @type {ShapeBox} */ b) => [(b.l ?? 0) + b.w / 2, (b.t ?? 0) + b.h / 2];
      return {
        shrink: [n.w < o.w - 0.5, n.h < o.h - 0.5],
        grow: [n.w > o.w + 0.5, n.h > o.h + 0.5],
        move: placed ? [Math.abs(c(n)[0] - c(o)[0]) > 0.5, Math.abs(c(n)[1] - c(o)[1]) > 0.5] : [false, false],
      };
    }),
    crop = ch.some(c => c.shrink[0] || c.shrink[1]),
    reveal = ch.some(c => c.grow[0] || c.grow[1]),
    travel = !crop && !reveal && ch.some(c => c.move[0] || c.move[1]),
    A = crop ? (reveal ? MORPH.a : MORPH.one) : 0,
    S = travel ? 0 : crop || reveal ? MORPH.s : MORPH.alone,
    B = reveal ? (crop ? MORPH.b : MORPH.one) : 0,
    T = travel ? MORPH.a + MORPH.s + MORPH.b : A + S + B,
    eA = reveal ? eIn : eBoth,
    eB = crop ? eOut : eBoth;
  /** box i's progress per axis [x, y] at e ms (0 → 1) @param {number} i @param {number} e @returns {[number, number]} */
  const q = (i, e) => {
    const pA = A ? eA(Math.min(1, e / A)) : 1,
      pB = B ? eB(Math.min(1, Math.max(0, e - A - S) / B)) : 1,
      pAll = eBoth(Math.min(1, e / T)),
      c = ch[i],
      at = (/** @type {number} */ k) => (c.shrink[k] ? pA : c.grow[k] ? pB : pAll);
    return [at(0), at(1)];
  };
  return { A, S, B, T, q };
}
/**
 * The steps of a shape change from box o to box n: the crop (0 → A), the swap (A → A + S), the reveal (→ T), and per
 * axis how far along it is at e ms (0 → 1) — the one-box plan (shapePlan).
 * @param {ShapeBox} o @param {ShapeBox} n
 */
export function shapeSteps(o, n) {
  const p = shapePlan([{ o, n }]);
  return { A: p.A, S: p.S, B: p.B, T: p.T, q: (/** @type {number} */ e) => p.q(0, e) };
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
  /* a pure move has no swap: what leaves fades as the move starts, what comes as it lands (a fade-through over the
     travel — the box in a layout switch, T2b) */
  if (st.T > 0 && !st.A && !st.S)
    return { out: { delay: 0, duration: F }, in: { delay: Math.max(0, st.T - F), duration: F }, T: st.T };
  return {
    out: { delay: Math.max(0, st.A + st.S - F), duration: F },
    in: { delay: st.A, duration: F },
    T: Math.max(st.T, st.A + F),
  };
}

/* ---------- the glue (v0.7c T2c, DEVLOG DD-2026-11-08-7) ----------
   The prompt box is ALWAYS glued to its partner pane's live plate, by a RELATION: which of the plate's edges it keeps
   its distance to, on each axis. A tab switch or a Reset keeps the relation (the box rides); a layout switch changes
   it, and the box fades through the change — out on the old relation, in on the new, glued all the while
   (ux-review/17-t2-motion.md, T2c). Plain numbers: nothing here reads the page. */
/** an axis's anchor: the plate's edge (or centre) the box keeps its distance to — "before" / "after": the box's far
 * edge to the plate's near one (beside it); "below": the box's top to the plate's bottom (under it)
 * @typedef {{ x: "before" | "after" | "centre", y: "top" | "centre" | "bottom" | "below" }} GlueAnchors */
/** @typedef {GlueAnchors & { dx: number, dy: number }} Relation the anchors and the box's distances to them */
/** @typedef {{ l: number, t: number, w: number, h: number }} GlueBox a box on screen (rearrange.js Box) */

/** the anchors of a layout: Left / Right beside the plate by the box's vertical place (top / middle / bottom),
 * Vertical under it, centred @param {"left" | "right" | "below"} dock @param {string} [pos] the box's place (S.pos)
 * @returns {GlueAnchors} */
export function glueAnchors(dock, pos) {
  if (dock === "below") return { x: "centre", y: "below" };
  return { x: dock === "right" ? "after" : "before", y: pos === "bot" ? "bottom" : pos === "mid" ? "centre" : "top" };
}
/** the box's relation to the plate as they are: its distances to the anchored edges (captured where it IS — at rest,
 * or where a layout puts it — so placing it again from the same plate puts it exactly there)
 * @param {GlueBox} box @param {GlueBox} plate @param {GlueAnchors} a @returns {Relation} */
export function relationOf(box, plate, a) {
  const dx =
      a.x === "before"
        ? plate.l - (box.l + box.w)
        : a.x === "after"
          ? box.l - (plate.l + plate.w)
          : box.l + box.w / 2 - (plate.l + plate.w / 2),
    dy =
      a.y === "top"
        ? box.t - plate.t
        : a.y === "bottom"
          ? plate.t + plate.h - (box.t + box.h)
          : a.y === "below"
            ? box.t - (plate.t + plate.h)
            : box.t + box.h / 2 - (plate.t + plate.h / 2);
  return { ...a, dx, dy };
}
/** where the box is, glued to the plate as it is now: its size is its own, its place the relation's
 * @param {GlueBox} plate @param {Relation} r @param {{ w: number, h: number }} size @returns {GlueBox} */
export function glued(plate, r, size) {
  const l =
      r.x === "before"
        ? plate.l - r.dx - size.w
        : r.x === "after"
          ? plate.l + plate.w + r.dx
          : plate.l + plate.w / 2 + r.dx - size.w / 2,
    t =
      r.y === "top"
        ? plate.t + r.dy
        : r.y === "bottom"
          ? plate.t + plate.h - r.dy - size.h
          : r.y === "below"
            ? plate.t + plate.h + r.dy
            : plate.t + plate.h / 2 + r.dy - size.h / 2;
  return { l, t, w: size.w, h: size.h };
}
/** a glued element changing its relation (a layout switch's prompt box): out on the old relation from the first frame,
 * gone ~2 frames while it changes, in on the new over the motion's last fade so it lands with its plate. A motion too
 * short for that is outlasted: `T` is the schedule's own length. Times in ms from the motion's start
 * @param {number} motion the motion's length (its plan's T) */
export function relationFade(motion) {
  const outEnd = MORPH.out,
    inStart = Math.max(outEnd + MORPH.gone, motion - MORPH.fade),
    inEnd = inStart + MORPH.fade;
  return { outEnd, turn: outEnd + MORPH.gone / 2, inStart, inEnd, T: Math.max(motion, inEnd) };
}

/* ---------- a pane's change of relation: ONE table (L1a, 2026-11-11 — ux-review/18-box-placement.md, "Panes are one kind")
   What a pane does when its relation to its partner changes, by the change and its cause: a pattern and its timing —
   data, not code per case (Material's motion system: the same element moving = a travel, unrelated contents = a fade
   through; SwiftUI's transitions as values). The box with the picture's plate is its first user; a second pane that
   moves (2b) plugs in by rows. The user's direction for the menu's switches (2026-11-10: out one way, in from the other —
   a shared axis) is a change of the menu row's data in the tuning pass, no code. ---------- */
/** @typedef {"hand" | "menu" | "switch"} RelationCause what changed it: carried by your hand, the Layout menu / Reset, a
 * tab switch */
/** @typedef {"travel" | "fade" | "ride"} RelationPattern travel: on from where it is to where it lands, one motion; fade:
 * out by the old relation, in by the new (a fade through); ride: the relation kept, it rides its partner */
/** @typedef {{ pane: string, partner: string, cause: RelationCause, change?: string, pattern: RelationPattern }} RelationRow
 * `*` matches any pane or partner; `change` (e.g. "side>vert"), when given, narrows a row */
export const RELATION_ROWS = /** @type {RelationRow[]} */ ([
  { pane: "*", partner: "*", cause: "hand", pattern: "travel" }, // the drop: no teleport (it faded out and in)
  { pane: "*", partner: "*", cause: "menu", pattern: "fade" }, // the Layout menu, Reset
  { pane: "*", partner: "*", cause: "switch", pattern: "ride" }, // a tab switch: the relation is kept
]);
/** a pane's change of relation: its pattern (the first row that matches) and its timing on a motion `motion` ms long
 * @param {{ pane: string, partner: string, cause: RelationCause, change?: string }} q @param {number} motion
 * @returns {{ pattern: RelationPattern, T: number, outEnd?: number, turn?: number, inStart?: number, inEnd?: number }} */
export function relationMotion(q, motion) {
  const row = RELATION_ROWS.find(
    r =>
      r.cause === q.cause &&
      (r.pane === "*" || r.pane === q.pane) &&
      (r.partner === "*" || r.partner === q.partner) &&
      (!r.change || r.change === q.change),
  );
  const pattern = row ? row.pattern : "fade";
  return pattern === "fade" ? { pattern, ...relationFade(motion) } : { pattern, T: motion };
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
/** a size; null = the default (for a picture page: no cap). s: a picture page's scale of its largest (v0.7c C2a; null =
 * the default) @typedef {{ w: number | null, h: number | null, s?: number | null }} PaneSize */
/** @typedef {{ v: 4, side: { box: PaneSize, pages: Record<PageId, PaneSize>, scaled?: 1 | 2 }, vert: { box: PaneSize, pages: Record<PageId, PaneSize> } }} LayoutV4 */

export const PAGE_IDS = /** @type {const} */ (["generating", "gallery", "queue", "loras", "png"]);
/** a picture page fits its picture inside its size (a cap); a panel fills its size @param {string} id */
export const isFitPage = id => id === "generating" || id === "gallery";
export const BOXHMIN = 240, // the prompt box's least height side by side (you set it with its edges)
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
 * @param {number} [c.boxWLo] the box's least width (its bottom row's need; PWMIN at the least)
 * @returns {{ lo: number, hi: number }}
 */
export function limits(pane, axis, c) {
  const W = c.roomW,
    H = c.roomH;
  const r = (/** @type {number} */ lo, /** @type {number} */ hi) => ({ lo: Math.min(lo, hi), hi });
  if (pane === "box") {
    if (axis === "w") return r(Math.max(PWMIN, c.boxWLo ?? 0), W); // its bottom row's need (boxWLeast); no cap of its own (it was 900 px side by side): the room's ends
    return c.orient === "side" ? r(BOXHMIN, H) : r(c.least ?? BOXHMIN, Math.round((c.winH ?? H) * SLOTMAX));
  }
  if (axis === "h") return r(isFitPage(pane) ? picLeastH() : PANELHMIN, H);
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

/* ======================= the single layout pass (v0.7c C, ux-review/16-layout-pass.md) =======================
   One pure function: the state in, every rectangle out (the page's pane, the picture, the prompt box, the tab bar,
   each edge's handle). The appliers only write what it returns; nothing measures the screen to place things.
   Three steps: the sizes at rest (rule 2), a drag's change to them (rule 3), the rectangles from the sizes (4–7).
   A drag is a constraint (DEVLOG DD-2026-11-03-6): the grabbed edge at the pointer, the rest by the layout's rules —
   on a centred axis the opposite side mirrors it; where the drag fights the anchor (Vertical: the picture's top) the
   opposite side holds and the release settles. */

/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
/**
 * @typedef {object} PassState
 * @property {number} W the window's width
 * @property {number} H the window's height
 * @property {"left" | "right" | "below"} dock
 * @property {{ kind: "pic", ratio: number, scale?: number, row?: number } | { kind: "panel", w: number, h: number,
 *   lo: { w: number, h: number }, hi: { w: number, h: number }, row?: number }} page the page's pane: a picture (its ratio and your
 *   scale of its largest, default 1) or a panel (your sizes and its limits)
 * @property {{ w: number, wLo: number, text: number, least: number, hi?: number, h?: number | null, title?: number, foot?: number, place?: BoxPlace,
 *   mode?: "" | "full" | "match" | "fit", anchor?: "top" | "mid" | "bot" }} box the prompt box: your width (and its
 *   least), its text's height (its least: ~2 lines; its largest in Vertical: hi), your height (h — Custom: a height you
 *   set by its edge, decision A, DEVLOG DD-2026-11-09-2; null: its mode decides), its mode, its anchor by the picture;
 *   in Vertical its name row over it (title: from the name's top to the box) and the LoRA row under it (foot)
 * @property {{ w: number, h: number }} bar the tab bar
 * @property {number} strip the edit buttons' strip beside the picture (part of the picture's pane: DEVLOG DD-2026-11-03-5)
 * @property {{ area: number, pair: number, bar: number }} gap the window's edge, between the panes, under the tab bar
 * @property {number} picLeast a picture's least height
 * @property {number} [roomH] the content's height, when the page keeps room of its own below it (the status row): it
 *   replaces the window's height less the tab bar's row and the edge gap
 * @property {{ edge: string, at: number } | null} [drag] an edge held (a handle's id, as in the output's handles) and
 *   where the pointer is on its axis
 */
/**
 * @typedef {object} PassOut
 * @property {Rect} page the page's pane (a picture with its buttons' strip, or a panel)
 * @property {Rect | null} pic the picture (picture pages)
 * @property {Rect} box the prompt box
 * @property {Rect} bar the tab bar
 * @property {Record<string, Rect>} handles each edge's handle: "box.left", "page.top", … and "shared"
 * @property {{ boxW: number, boxH?: number, scale?: number, w?: number, h?: number }} kept what a release keeps (the limits, never
 *   the rubber band's stretch)
 * @property {{ w: number, h: number }} largest the picture's largest at this layout (picture pages)
 * @property {{ it: number, ib: number, cy: number } | null} anchors side by side: the pane's lines the box anchors to (its column's px, under
 *   its name row: `place.colTop`) — the grip's resting places use them too
 * @property {number | null} squeezeW side by side, a picture page: the box's width a picture edge's double-click keeps
 *   (the picture at its largest, the box squeezed toward its least — DD-2026-11-03-5)
 * @property {number} roomT where the room starts (the window's px: under the tab bar's row) — the appliers place the
 *   page's pane from it
 * @property {number} pageHi the page's room: the most height its pane can take (Vertical: with the box at its least
 *   and the rows round it; side by side: the room's) — a panel's limits and default are read against it
 */

/** a handle's thickness (px): a strip centred on its pane's side */
export const HANDLE = 16;

const clampTo = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) =>
  Math.max(lo, Math.min(Math.max(lo, hi), v));

/**
 * @typedef {object} BoxPlace side by side, what the box's place rule (cardPlacement) reads besides the pane
 * @property {number} colTop where its column starts (the window's px, under its name row)
 * @property {number} colH the column's height
 * @property {number} chips its LoRA row (with its gap)
 * @property {number} below the room under the pane its "bottom" lines up with (the status row)
 * @property {number} [held] its height edge held: the height shown
 * @property {"top" | "bottom"} [heldPin] and the side that holds
 * @property {boolean} [frozen] you're working in it: its top holds
 * @property {number | null} [prevTop] its top last laid out (column px)
 * @property {number | null} [prevBottom] its bottom last laid out, LoRA row included
 */
/** the box's place inputs side by side, the room's by default @param {PassState} s @param {number} T @param {number} CH
 * @returns {BoxPlace} */
function sidePlace(s, T, CH) {
  return {
    colTop: T,
    colH: CH,
    chips: 0,
    below: 0,
    held: 0,
    heldPin: "top",
    frozen: false,
    prevTop: null,
    prevBottom: null,
    ...s.box.place,
  };
}
/** the room: the window less its edge gap, under the tab bar's row @param {PassState} s */
/** Vertical: what lies between the pane's bottom and the box's top — the page's status row (a picture's), the pair
 * gap, the box's name row — ONE definition, for the sizes and the places alike (C4b step 1b: the box sat one bare gap
 * under the picture, the name row on it) @param {PassState} s */
function vGap(s) {
  return (s.page.row ?? 0) + s.gap.pair + (s.box.title ?? 0);
}
/** Vertical: all the group takes besides the pane and the box — vGap above the box and its foot (the LoRA row) under it
 * @param {PassState} s */
const vAround = s => vGap(s) + (s.box.foot ?? 0);
/** the room: its sides and its height (the window's less the gaps and the bar) @param {PassState} s */
function roomOf(s) {
  const L = s.gap.area,
    R = s.W - s.gap.area,
    T = s.gap.area + s.bar.h + s.gap.bar,
    B = s.roomH != null ? T + s.roomH : s.H - s.gap.area;
  return { L, R, RW: R - L, T, B, CH: B - T };
}

/**
 * The sizes at rest (rule 2): the box's width and height, the page's (a picture's from its scale of its largest).
 * @param {PassState} s
 */
function restSizes(s) {
  const { RW, CH } = roomOf(s),
    { gap } = s,
    vert = s.dock === "below",
    page = s.page,
    mode = s.box.mode || "",
    largest = { w: 0, h: 0 };
  let bw = vert ? clampTo(s.box.w, s.box.wLo, RW) : clampTo(s.box.w, s.box.wLo, RW - gap.pair),
    /* the box's height is a spec (ux-review/16-layout-pass.md C4, rule 3): your height if you set one (Custom), else its
       text's — clamped to its least and its largest, and in Vertical to the free room under the pane (below) */
    want = s.box.h ?? s.box.text,
    bh = vert ? clampTo(want, s.box.least, s.box.hi ?? CH) : clampTo(want, s.box.least, CH),
    pw,
    ph,
    scale;
  if (page.kind === "pic") {
    if (!vert) {
      const leastW = s.picLeast * page.ratio;
      if (RW - bw - gap.pair - stripRoom(s) < leastW) bw = Math.max(s.box.wLo, RW - gap.pair - stripRoom(s) - leastW); // the box gives last
    }
    /* the largest: side by side, beside the box; in Vertical, with the box at its least. No scale kept = the default:
       the largest in both layouts — the picture first (C4 rule 2; the user, 2026-11-09: "in vertical, reset grows the
       prompt box and not the pic — we optimise for the biggest pic"); in Vertical the box then fits its text in what's
       left (it used to size the picture so the box kept its whole text: Reset grew the box) */
    const L = largestPic(s, bw, vert ? s.box.least : bh);
    largest.w = L.w;
    largest.h = L.h;
    const lo = Math.min(1, s.picLeast / Math.max(1, largest.h)),
      def = 1;
    scale = clampTo(page.scale ?? def, lo, 1);
    pw = largest.w * scale;
    ph = pw / page.ratio;
    if (vert) bh = clampTo(want, s.box.least, Math.min(s.box.hi ?? CH, CH - vAround(s) - ph)); // what's left
  } else {
    if (!vert && RW - bw - gap.pair < page.lo.w) bw = Math.max(s.box.wLo, RW - gap.pair - page.lo.w);
    pw = clampTo(page.w, page.lo.w, Math.min(page.hi.w, vert ? RW : RW - bw - gap.pair));
    /* Vertical: the panel's height is yours, the box takes what's left (down to its least) — as for a picture */
    ph = clampTo(page.h, page.lo.h, Math.min(page.hi.h, vert ? CH - vAround(s) - s.box.least : CH));
    if (vert) bh = clampTo(want, s.box.least, Math.min(s.box.hi ?? CH, CH - vAround(s) - ph));
  }
  return { bw, bh, pw, ph, scale, largest, mode };
}

/** side by side, the room a picture's buttons' strip reserves: its width on BOTH sides of the centred pair, so the pair
 * never moves in for it (B15, the user's (a), 2026-11-03). ONE definition — the largest, the drags' limits, the box's
 * give — they had one strip each, in six copies @param {PassState} s */
const stripRoom = s => (s.page.kind === "pic" ? 2 * s.strip : 0);
/**
 * A picture's largest: its ratio fitted into the room the box leaves (side by side: beside the box; Vertical: above
 * the box at the height given). Side by side it keeps the strip's room on both sides of the centred pair, so the pair
 * never has to move in for it: browsing, a picture's centre stays put (the user, 2026-10-31; B15, (a) the user's pick
 * 2026-11-03 — the widest picture a strip narrower rather than its centre shifting).
 * @param {PassState} s @param {number} bw the box's width @param {number} bh the box's height (Vertical)
 */
function largestPic(s, bw, bh) {
  const { RW, CH } = roomOf(s),
    r = s.page.kind === "pic" ? s.page.ratio : 1,
    w =
      s.dock === "below"
        ? Math.min(RW - 2 * s.strip, (CH - vAround(s) - bh) * r)
        : Math.min(RW - bw - s.gap.pair - stripRoom(s), CH * r); // the strip's room both sides: the pair stays centred (B15)
  return { w: Math.max(0, w), h: Math.max(0, w) / r };
}

/**
 * A drag (rule 3): the sizes with the grabbed edge at the pointer. Returns the sizes shown (with the rubber band past
 * a limit), the sizes kept, and where the group's anchor gives way to the drag (Vertical's top: the bottom holds).
 * @param {PassState} s @param {ReturnType<typeof restSizes>} z the sizes at rest
 */
function dragSizes(s, z) {
  const d = /** @type {{ edge: string, at: number }} */ (s.drag),
    { L, RW, T, CH } = roomOf(s),
    { gap, strip } = s,
    vert = s.dock === "below",
    pic = s.page.kind === "pic" ? s.page : null,
    ratio = pic ? pic.ratio : 1,
    out = {
      ...z,
      keptBw: z.bw,
      keptBh: z.bh,
      keptPw: z.pw,
      keptPh: z.ph,
      pageY: /** @type {number | null} */ (null),
      boxY: /** @type {number | null} */ (null),
      boxGive: 0,
    },
    pageLo = pic ? { w: s.picLeast * ratio, h: s.picLeast } : s.page.kind === "panel" ? s.page.lo : { w: 0, h: 0 },
    pageHi = s.page.kind === "panel" ? s.page.hi : { w: Infinity, h: Infinity },
    /** set the page's main size (a picture: its height by its ratio), shown with the rubber band past [lo, hi] */
    /* the rubber band on a picture's longer side, so neither side stretches more than its reach (a panel: its own) */
    stretch = (
      /** @type {"w" | "h"} */ axis,
      /** @type {number} */ v,
      /** @type {number} */ lo,
      /** @type {number} */ hi,
    ) => {
      if (!pic) return rubber(v, lo, Math.max(lo, hi), RUBBER);
      const toW = axis === "w" ? 1 : ratio, // this axis in widths
        wide = ratio >= 1,
        [k, l, u] = wide ? [v * toW, lo * toW, hi * toW] : [(v * toW) / ratio, (lo * toW) / ratio, (hi * toW) / ratio];
      const r = rubber(k, l, Math.max(l, u), RUBBER);
      return wide ? r / toW : (r * ratio) / toW;
    },
    setPageW = (/** @type {number} */ w, /** @type {number} */ hi) => {
      const lo = pageLo.w;
      out.keptPw = clampTo(w, lo, hi);
      out.pw = stretch("w", w, lo, hi);
      if (pic) {
        out.keptPh = out.keptPw / ratio;
        out.ph = out.pw / ratio;
      }
    },
    setPageH = (/** @type {number} */ h, /** @type {number} */ hi, lo = pageLo.h) => {
      out.keptPh = clampTo(h, lo, hi);
      out.ph = stretch("h", h, lo, hi);
      if (pic) {
        out.keptPw = out.keptPh * ratio;
        out.pw = out.ph * ratio;
      }
    };
  const [who, side] = d.edge.split(".");
  if (!vert) {
    const right = s.dock === "right",
      cx = L + RW / 2, // the group is centred: its middle stays (a drag of an outer edge mirrors on the far side)
      /* by its own outer edges: beside the box as it is — an outer edge takes no room from the other pane, only the
         shared edge trades (the user, DEVLOG DD-2026-11-07-1) */
      pageOwnHi = Math.min(pageHi.w, RW - gap.pair - z.bw - stripRoom(s), pic ? CH * ratio : Infinity),
      boxWHi = RW - gap.pair - pageLo.w - stripRoom(s);
    if (d.edge === "shared") {
      /* the shared edge, at the pointer (mid-gap): the pane it moves away from grows, up to its own largest, and the other
         is PUSHED at its own width — the group stays centred, so the grown pane's far side mirrors (DD-6) and both sides'
         empty room is used; once the pair fills the room, the pushed pane gives, down to its least; then the rubber band
         (one rule for every edge, the user, DEVLOG DD-2026-11-10-2: the dragged pane gets what it asks for — it traded
         inside the group's width at once, and the room beside the box was unreachable). Held, the layout is the rest
         layout of the sizes it keeps: letting go moves nothing */
      const sw = pic ? strip : 0,
        [lw0, rw0] = right ? [z.pw + sw, z.bw] : [z.bw, z.pw + sw],
        boxLim = { lo: s.box.wLo, hi: boxWHi },
        pageLim = { lo: pageLo.w + sw, hi: Math.min(pageHi.w, pic ? CH * ratio : Infinity) + sw },
        [lL, rL] = right ? [pageLim, boxLim] : [boxLim, pageLim],
        /* the pair's total, as seen, at most what fits at rest (centred, the picture's buttons' column kept in the
           margin: stripRoom) */
        avail = RW - stripRoom(s) + sw,
        toBP = (/** @type {number} */ l, /** @type {number} */ r) => (right ? [r, l - sw] : [l, r - sw]),
        /* where the edge sits at rest for these widths (the rectangles' own placement) */
        edgeAt = (/** @type {number} */ l, /** @type {number} */ r) => {
          const [bw, pw] = toBP(l, r);
          return groupX(s, bw, pw) + l + gap.pair / 2;
        },
        grows = d.at >= edgeAt(lw0, rw0) ? "l" : "r",
        [gL, pL, p0] = grows === "l" ? [lL, rL, rw0] : [rL, lL, lw0],
        place = (/** @type {number} */ g, /** @type {number} */ p) => (grows === "l" ? [g, p] : [p, g]),
        /* the grower's width that puts the edge at the pointer, the other at width p (the edge moves half as fast as a
           centred pane grows: two steps of Newton's on the placement itself, strip and all) */
        solve = (/** @type {number} */ p) => {
          let g = grows === "l" ? lw0 : rw0;
          for (let i = 0; i < 3; i++) {
            const [l, r] = place(g, p),
              e = edgeAt(l, r);
            g += (grows === "l" ? 2 : -2) * (d.at - e);
          }
          return g;
        };
      /* (A) pushed at its own width, both sides' room used; (B) the pair fills the room: the pushed pane gives */
      let want = solve(p0),
        p = p0;
      if (want + gap.pair + p0 > avail) {
        const [l, r] = place(avail - gap.pair - p0, p0),
          start = edgeAt(l, r) - l - gap.pair / 2; // the full pair's start: it depends on the total only
        want = grows === "l" ? d.at - gap.pair / 2 - start : start + avail - (d.at + gap.pair / 2);
        p = Math.max(pL.lo, Math.min(p0, avail - gap.pair - Math.min(want, gL.hi))); // pushed: never wider than it was
      }
      const hi = Math.max(gL.lo, Math.min(gL.hi, avail - gap.pair - pL.lo)),
        gK = clampTo(want, gL.lo, hi),
        gS = rubber(want, gL.lo, hi, RUBBER),
        pK = Math.max(pL.lo, Math.min(p, avail - gap.pair - gK)),
        [lK, rK] = place(gK, pK),
        [lS, rS] = place(gS, pK),
        [bwK, pwK] = toBP(lK, rK),
        [bwS, pwS] = toBP(lS, rS);
      out.keptBw = bwK;
      out.bw = bwS;
      out.keptPw = pwK;
      out.pw = pwS;
      if (pic) {
        out.keptPh = out.keptPw / ratio;
        out.ph = out.pw / ratio;
      }
    } else if (who === "box" && (side === "left" || side === "right")) {
      /* the box's outer edge: the group centred, the page's size held, the box's width with the edge at the pointer */
      const half = side === "left" ? cx - d.at : d.at - cx,
        bwWant = 2 * half - gap.pair - z.pw, // the pair you see is centred (its strip hangs into the margin)
        /* an outer edge grows into the room only: past its end there is nothing left to give way (the pointer is at
           the window's edge), so the rubber band */
        hi = Math.min(boxWHi, RW - gap.pair - z.pw - stripRoom(s));
      out.keptBw = clampTo(bwWant, s.box.wLo, hi);
      out.bw = rubber(bwWant, s.box.wLo, hi, RUBBER);
    } else if (who === "page" && (side === "left" || side === "right")) {
      /* the page's outer edge (on the picture's side, not its strip): the same, for the page */
      const half = side === "left" ? cx - d.at : d.at - cx,
        wWant = 2 * half - gap.pair - z.bw; // the pair you see is centred (its strip hangs into the margin)
      setPageW(wWant, pageOwnHi);
    } else if (who === "page" && (side === "top" || side === "bottom")) {
      /* the page's top / bottom: centred in the room's height, the opposite side mirrors */
      const cy = T + CH / 2,
        hWant = 2 * (side === "top" ? cy - d.at : d.at - cy),
        /* a picture's height is also bound by the width it may take beside the box as it is (an outer edge: DD-07-1) */
        hHi = Math.min(pageHi.h, CH, pic ? pageOwnHi / ratio : Infinity);
      setPageH(hWant, hHi);
    } else if (who === "box" && (side === "top" || side === "bottom")) {
      out.boxGive = boxGive(s, side, d.at); // the box's height is its text's: nothing to set, the edge only gives
    }
  } else {
    /* Vertical (C4c, ux-review/16-layout-pass.md C4 rule 4): the shared edge trades room between the page and the box
       inside the group's height at the press (the box's bottom holds); an outer edge takes no room from the other pane —
       it grows into the free room only, then the rubber band (DD-2026-11-07-1); the box's bottom sets its height (yours:
       Custom, decision A). The box sits under the page's KEPT bottom: a stretch is the grabbed edge's feedback only */
    const cx = L + RW / 2,
      g = vGap(s),
      foot = s.box.foot ?? 0,
      widest = pic ? (RW - 2 * strip) / ratio : Infinity, // the height the picture's width allows
      boxHi = s.box.hi ?? CH,
      groupB = T + z.ph + g + z.bh, // the box's bottom at the press
      /* by its own edges: beside the box as it is */
      ownHi = Math.min(pageHi.h, CH - vAround(s) - z.bh, widest);
    if (d.edge === "shared") {
      /* the edge at the pointer (mid-gap): the page's bottom. The box's bottom holds where it was at the press — except
         that the box at its own size pushes it down into the empty room under it; only past the room's bottom does it
         give, down to its least (the give-way order on every edge: the empty room is no one's, it goes first — the
         user, DEVLOG DD-2026-11-09-19; it traded at once, and a short page left the room unreachable). Up, the box takes
         the room (the trade) */
      const roomB = T + CH - foot, // the lowest the box's bottom goes
        hi = Math.min(pageHi.h, roomB - T - g - s.box.least, widest),
        lo = Math.max(pageLo.h, groupB - T - g - boxHi);
      setPageH(d.at - g / 2 - T, hi, Math.min(lo, hi));
      const top = T + out.keptPh + g;
      out.keptBh = Math.max(groupB, Math.min(roomB, top + z.bh)) - top;
      out.bh = out.keptBh;
      out.boxY = top;
    } else if (who === "page" && side === "top") {
      /* the anchored side: the drag wins over the anchor while held, the bottom holds; the release settles */
      const bottom = T + z.ph;
      setPageH(bottom - d.at, Math.min(ownHi, bottom - T)); // kept no higher than the anchor; shown: the rubber band
      /* past the anchor it stretches into the gap under the bar, never past it */
      if (bottom - out.ph < T - gap.bar) {
        out.ph = bottom - (T - gap.bar);
        if (pic) out.pw = out.ph * ratio;
      }
      out.pageY = bottom - out.ph;
      out.boxY = bottom + g; // the box holds with the bottom
    } else if (who === "page" && (side === "left" || side === "right")) {
      const wWant = 2 * (side === "left" ? cx - d.at : d.at - cx);
      setPageW(wWant, Math.min(pageHi.w, RW - (pic ? 2 * strip : 0), ownHi * (pic ? ratio : Infinity)));
      out.boxY = T + out.keptPh + g;
    } else if (who === "box" && (side === "left" || side === "right")) {
      const wWant = 2 * (side === "left" ? cx - d.at : d.at - cx);
      out.keptBw = clampTo(wWant, s.box.wLo, RW);
      out.bw = rubber(wWant, s.box.wLo, RW, RUBBER);
    } else if (who === "box" && side === "bottom") {
      /* its height, yours: into the free room under it (its LoRA row kept), then the rubber band */
      const top = T + z.ph + g,
        hi = Math.min(boxHi, T + CH - foot - top);
      out.keptBh = clampTo(d.at - top, s.box.least, hi);
      out.bh = rubber(d.at - top, s.box.least, Math.max(s.box.least, hi), RUBBER);
    }
  }
  return out;
}

/**
 * The box's height edges: its height is its text's, so they only give (the rubber band), measured from where the edge
 * rests. @param {PassState} s @param {string} side @param {number} at
 */
function boxGive(s, side, at) {
  const rest = layoutPass({ ...s, drag: null }).box,
    edge = side === "top" ? rest.y : rest.y + rest.h;
  return rubber(side === "top" ? edge - at : at - edge, 0, 0, RUBBER);
}

/**
 * Side by side, where the group (the box, the gap, the page's pane) starts: the pair you see — the box and the picture —
 * is centred; the buttons' strip hangs into the margin beside the picture and takes room only where there is none (a
 * picture at its widest): the group moves in by what's missing (DD-2026-11-03-7). ONE definition: the rectangles and a
 * drag's maths both use it (a drag that centred the group with its strip put the shared edge 26 px off its handle).
 * @param {PassState} s @param {number} bw the box's width @param {number} pw the picture's (a panel's) width
 */
function groupX(s, bw, pw) {
  const { L, RW } = roomOf(s),
    pic = s.page.kind === "pic",
    strip = pic ? s.strip : 0;
  if (!pic) return L + (RW - (bw + s.gap.pair + pw)) / 2;
  const seen = bw + s.gap.pair + pw,
    c0 = L + (RW - seen) / 2,
    short = Math.max(0, strip - (RW - seen) / 2);
  return s.dock === "right" ? c0 - strip + short : c0 - short;
}

/**
 * Every rectangle on the layout.
 * @param {PassState} s
 * @returns {PassOut}
 */
export function layoutPass(s) {
  const { L, R, RW, T, B, CH } = roomOf(s),
    { gap, bar, strip } = s,
    vert = s.dock === "below",
    pic = s.page.kind === "pic" ? s.page : null,
    rest = restSizes(s),
    z = s.drag
      ? dragSizes(s, rest)
      : {
          ...rest,
          keptBw: rest.bw,
          keptBh: rest.bh,
          keptPw: rest.pw,
          keptPh: rest.ph,
          pageY: null,
          boxY: null,
          boxGive: 0,
        },
    mode = rest.mode;
  /** @type {Rect} */ let page;
  /** @type {Rect} */ let box;
  /** @type {{ it: number, ib: number, cy: number } | null} the pane's lines the box anchors to, in its column's px
   * (side by side) */
  let anchors = null;
  /** @type {Rect | null} */ let pr = null;

  /* a picture stretched past its room by the rubber band: never past the gap to the next part (the bar above, the
     window's edge below), its width following its ratio */
  if (pic && !vert && z.ph > CH + 2 * Math.min(gap.bar, gap.area)) {
    z.ph = CH + 2 * Math.min(gap.bar, gap.area);
    z.pw = z.ph * pic.ratio;
  }
  if (!vert) {
    /* the pair you see — the box and the picture — is centred; the buttons' strip hangs into the margin beside the
       picture and takes room only where there is none (a picture at its widest): the group moves in by what's missing */
    const pageW = z.pw + (pic ? strip : 0),
      right = s.dock === "right",
      /* placed by what's kept (DD-7's strip rule acts on real sizes), the rubber band's stretch shared by both sides
         about that centre — the mirror (DD-6). Placed by the stretched sizes, the stretch went into the strip's room
         at a picture's widest: the grabbed edge stood still and the far side moved */
      x0 = groupX(s, z.keptBw, z.keptPw) - (z.bw + z.pw - z.keptBw - z.keptPw) / 2,
      px = right ? x0 : x0 + z.bw + gap.pair,
      py = z.pageY ?? T + (CH - z.ph) / 2;
    page = { x: px, y: py, w: pageW, h: z.ph };
    if (pic) pr = { x: right ? px + strip : px, y: py, w: z.pw, h: z.ph };
    /* the box's place beside its pane: ONE rule, the card's (cardPlacement; its modes: cardHeightMode) — anchored to
       the pane's lines (its top, its centre, its bottom with the status row under it), the box with its LoRA row as one
       group, held still while you work in it or hold its height edge (C2b's rest: the pass had a copy of its own, which
       knew none of that) */
    const pl = sidePlace(s, T, CH),
      over = pr || page;
    anchors = {
      it: over.y - pl.colTop,
      ib: over.y + over.h + pl.below - pl.colTop,
      cy: over.y + over.h / 2 - pl.colTop,
    };
    const r =
      mode === "full" || mode === "match"
        ? cardHeightMode(mode, pl.colH, pl.chips, s.box.least, anchors)
        : cardPlacement({
            colH: pl.colH,
            CH: pl.chips,
            held: pl.held,
            heldPin: pl.heldPin,
            /* its spec's height: yours if you set one (Custom: its top or bottom edge, C6), else its text's — never below
               its least (the card's text measure included it) */
            naturalH: Math.max(s.box.h ?? s.box.text, s.box.least),
            pos: s.box.anchor || "mid",
            frozen: !!pl.frozen,
            prevTop: pl.prevTop ?? null,
            prevBottom: pl.prevBottom ?? null,
            a: anchors,
          });
    box = { x: right ? x0 + pageW + gap.pair : x0, y: pl.colTop + r.top, w: z.bw, h: r.H };
  } else {
    const pageW = z.pw + (pic ? 2 * strip : 0),
      px = L + (RW - pageW) / 2,
      py = z.pageY ?? T;
    page = { x: px, y: py, w: pageW, h: z.ph };
    if (pic) pr = { x: px + strip, y: py, w: z.pw, h: z.ph };
    const bw = mode === "fit" && pr ? pr.w : mode === "full" ? RW : z.bw;
    /* the pane, its status row, the gap, the name row, the box — held: under the page's kept bottom (dragSizes) */
    box = { x: L + (RW - bw) / 2, y: z.boxY ?? py + z.ph + vGap(s), w: bw, h: z.bh };
  }
  /* the box's height edges give (its height is its text's) */
  if (z.boxGive) {
    /* never past the gap to the next part: the tab bar's row above, the window's edge below */
    if (s.drag?.edge === "box.top") {
      const g = Math.min(z.boxGive, box.y - (T - gap.bar));
      box = { ...box, y: box.y - g, h: box.h + g };
    } else box = { ...box, h: box.h + Math.min(z.boxGive, B + gap.area - (box.y + box.h)) };
  }

  /* what a release keeps: the box's width; a picture's scale of its largest at that width; a panel's sizes */
  const keptBw = vert ? clampTo(s.drag ? z.keptBw : s.box.w, s.box.wLo, RW) : z.keptBw,
    big = pic ? largestPic(s, keptBw, vert ? s.box.least : rest.bh) : { w: 0, h: 0 },
    /** @type {PassOut["kept"]} */
    kept = pic
      ? { boxW: keptBw, scale: clampTo(z.keptPw / Math.max(1, big.w), Math.min(1, s.picLeast / Math.max(1, big.h)), 1) }
      : { boxW: keptBw, w: z.keptPw, h: z.keptPh };
  if (vert) kept.boxH = z.keptBh; // Vertical: the box's height a release keeps (Custom: the shared edge, its bottom)

  /* the tab bar: its own row at the top, centred over the picture (or the panel), inside the window (Q1: A) */
  const over = pr || page,
    barR = { x: clampTo(over.x + over.w / 2 - bar.w / 2, L, R - bar.w), y: gap.area, w: bar.w, h: bar.h };

  /* the handles: a strip on each pane side, as long as that side; the shared edge = the two sides' overlap, mid-gap */
  const t = HANDLE / 2,
    of = (/** @type {Rect} */ r) => ({
      left: { x: r.x - t, y: r.y, w: HANDLE, h: r.h },
      right: { x: r.x + r.w - t, y: r.y, w: HANDLE, h: r.h },
      top: { x: r.x, y: r.y - t, w: r.w, h: HANDLE },
      bottom: { x: r.x, y: r.y + r.h - t, w: r.w, h: HANDLE },
    }),
    P = of(over),
    Bx = of(box),
    /** @type {Record<string, Rect>} */
    handles = {};
  if (!vert) {
    const right = s.dock === "right",
      outerP = right ? "left" : "right",
      outerB = right ? "right" : "left",
      lo = Math.max(over.y, box.y),
      hi = Math.min(over.y + over.h, box.y + box.h),
      mid = right ? (page.x + page.w + box.x) / 2 : (box.x + box.w + page.x) / 2;
    handles["page." + outerP] = P[outerP];
    handles["page.top"] = P.top;
    handles["page.bottom"] = P.bottom;
    handles["box." + outerB] = Bx[outerB];
    handles["box.top"] = Bx.top;
    handles["box.bottom"] = Bx.bottom;
    handles.shared = { x: mid - t, y: lo, w: HANDLE, h: Math.max(0, hi - lo) };
  } else {
    const lo = Math.max(over.x, box.x),
      hi = Math.min(over.x + over.w, box.x + box.w);
    handles["page.left"] = P.left;
    handles["page.right"] = P.right;
    handles["page.top"] = P.top;
    handles["box.left"] = Bx.left;
    handles["box.right"] = Bx.right;
    handles["box.bottom"] = Bx.bottom;
    handles.shared = { x: lo, y: page.y + page.h + vGap(s) / 2 - t, w: Math.max(0, hi - lo), h: HANDLE }; // mid-gap (dragSizes inverts it)
  }
  const pageHi = vert ? CH - vAround(s) - s.box.least : CH,
    /* a picture edge's double-click side by side (DD-2026-11-03-5): the picture as large as it can be, the box squeezed
       toward its least — to the width the picture at that size leaves it, never wider than it is */
    squeezeW =
      pic && !vert
        ? Math.max(s.box.wLo, Math.min(s.box.w, RW - gap.pair - stripRoom(s) - largestPic(s, s.box.wLo, 0).w))
        : null;
  return { page, pic: pr, box, bar: barR, handles, kept, largest: rest.largest, pageHi, roomT: T, anchors, squeezeW };
}
