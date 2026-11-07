// @ts-check
/* Kiln · ONE applier for a rearrangement (v0.7c C2b + T2a, 2026-11-07; ux-review/17-t2-motion.md). When the layout
   changes on the same page — a Reset, a double-click, a ratio change, the room changing — every box that moves (the
   picture's frame, a panel's box, the prompt's column) goes from where it IS to where the layout pass puts it on ONE
   plan (layoutmath.js shapePlan: what shrinks crops first, what grows reveals last) and ONE clock (one start time).
   Each owner still owns its property and its write; it only hands its move here. Asked in the same task, the moves
   share a plan; a new one mid-way starts from where everything is. Before: the frame glided on --lay-t's curve
   (framebox), the columns on a copy of it (colsGlide), a panel's box snapped (B16) — three clocks, two curves, one snap.
   What follows the boxes (the plate, what sits round the picture, the glued prompt box) is placed after the writes of
   each frame, in the same frame. A tab switch keeps its own owner (plate.js switchGlide) on the same steps. */
import { MORPH, fades, shapeBox, shapePlan } from "./layoutmath.js";
import { snaps } from "./framebox.js";
import { plateSync } from "./plate.js";
import { promptFollow } from "./layout.js";

/** @typedef {{ l: number, t: number, w: number, h: number }} Box */
/** @typedef {(b: Box) => void} Write */
/** @typedef {{ from: Box, to: Box, cur: Box, write: Write, off?: boolean }} Move off: taken over by another motion */

/** @type {Map<string, { from: Box, to: Box, write: Write }>} asked for in this task */
const asked = new Map();
/** @type {Map<HTMLElement, boolean>} contents that don't travel, fading in (true) or out in this task */
const fading = new Map();
/** @type {{ t0: number, T: number, q: (i: number, e: number) => [number, number], moves: [string, Move][] } | null} */
let run = null;
let raf = 0,
  queued = false;

/** `key`'s box moves from `from` (where it is now) to `to` in the coming rearrangement; written at once when the layout
 * jumps on purpose (snaps: a switch, a drag, a live resize, reduced motion) @param {string} key @param {Box} from
 * @param {Box} to @param {Write} write */
export function rearrange(key, from, to, write) {
  if (snaps() || same(from, to)) {
    stop(key);
    write(to);
    return;
  }
  asked.set(key, { from, to, write });
  if (!queued) {
    queued = true;
    queueMicrotask(start);
  }
}
/** `el` (contents that don't travel: the status row) comes or goes in the coming rearrangement — on its plan's fades
 * (layoutmath.js fades: what leaves ends at the swap, what comes starts at it), from its start time: the row used to fade
 * on --lay-t's own curve while the picture moved on the plan (insets › finishOnOneClock) @param {HTMLElement} el
 * @param {boolean} on */
export function rearrangeFade(el, on) {
  if (snaps()) {
    fadeNow(el, on, 0, 150, "linear", performance.now()); // the layout jumps on purpose: a short fade, no plan
    return;
  }
  fading.set(el, on);
  if (!queued) {
    queued = true;
    queueMicrotask(start);
  }
}
/** @param {HTMLElement} el @param {boolean} on @param {number} delay @param {number} ms @param {string} easing
 * @param {number} t0 */
function fadeNow(el, on, delay, ms, easing, t0) {
  const a = el.animate(
    [
      { opacity: on ? 0 : 1, visibility: "visible" },
      { opacity: on ? 1 : 0, visibility: "visible" },
    ],
    { delay, duration: ms, easing, fill: "backwards" }, // its first keyframe holds until its start
  );
  a.startTime = t0;
}
/** `key` stops moving (another motion takes it over: a crop-and-reveal, a switch's hold) @param {string} key */
export function stop(key) {
  asked.delete(key);
  for (const [k, m] of run ? run.moves : []) if (k === key) m.off = true; // (its place in the plan stays: one index per box)
}
/** `key`'s box is moving now (its goal is what the last ask said) @param {string} key */
export const moving = key => asked.has(key) || (!!run && run.moves.some(([k, m]) => k === key && !m.off));
/** where `key` is going, while it moves @param {string} key */
export const movingTo = key => asked.get(key)?.to ?? run?.moves.find(([k, m]) => k === key && !m.off)?.[1].to ?? null;

const same = (/** @type {Box} */ a, /** @type {Box} */ b) =>
  Math.abs(a.l - b.l) < 0.5 && Math.abs(a.t - b.t) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;

/* one plan for everything asked in this task, and for what was still moving: from where it is now */
function start() {
  queued = false;
  /** @type {Map<string, Move>} */
  const all = new Map();
  if (run) for (const [k, m] of run.moves) if (!asked.has(k) && !m.off) all.set(k, { ...m, from: m.cur });
  for (const [k, a] of asked) all.set(k, { ...a, cur: a.from });
  asked.clear();
  const moves = [...all].filter(([, m]) => !same(m.from, m.to)),
    plan = shapePlan(moves.map(([, m]) => ({ o: m.from, n: m.to }))), // nothing moving: a plain cross-fade's
    t0 = performance.now(),
    f = fades(plan);
  for (const [el, on] of fading) fadeNow(el, on, on ? f.in.delay : f.out.delay, MORPH.fade, "linear", t0);
  fading.clear();
  if (!moves.length) {
    run = null;
    return;
  }
  run = { t0, T: plan.T, q: plan.q, moves };
  if (!raf) raf = requestAnimationFrame(tick);
}
/** @param {number} now */
function tick(now) {
  raf = 0;
  if (!run) return;
  const e = now - run.t0,
    end = e >= run.T;
  run.moves.forEach(([, m], i) => {
    if (m.off) return;
    const b = end ? m.to : shapeBox(m.from, m.to, run ? run.q(i, e) : [1, 1]);
    m.cur = b;
    m.write(b);
  });
  plateSync(); // the plate rides the frame or the panel, the tab bar the plate
  promptFollow(true); // the prompt box, glued one gap from the plate (C2b)
  if (end) run = null;
  else raf = requestAnimationFrame(tick);
}
