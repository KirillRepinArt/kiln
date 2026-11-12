// @ts-check
/* Kiln · the ONE driver: ARCHITECTURE › a rearrangement on the same page (ux-review/17-t2-motion.md). Every box that
   moves goes from where it IS to where the layout puts it on ONE plan (layoutmath.js shapePlan) and ONE clock; each
   owner keeps its property and its write and only hands its move here. Asked in the same task, the moves share a plan;
   a new goal mid-way bends the path (retarget). What follows the boxes (the plate, what sits round the picture, the
   glued prompt box) is placed after each frame's writes, in the same frame. A switch's own motion goes through here too:
   travel() for what travels, follow() for what rides it */
import { fade } from "./fade.js";
import { MORPH, fades, shapeBox, shapePlan } from "./layoutmath.js";
import { snaps } from "./framebox.js";
import { plateSync } from "./plate.js";
import { promptFollow } from "./layout.js";
import { easing, ms } from "./tokens.js";

/** @typedef {{ l: number, t: number, w: number, h: number }} Box */
/** @typedef {(b: Box) => void} Write */
/** @typedef {{ from: Box, to: Box, cur: Box, write: Write, off?: boolean, with?: string, travel?: boolean }} Move off:
 * taken over by another motion; with: a dependent's source — it moves on its source's progress (the box anchored to the
 * picture); travel: a switch's or a crop-and-reveal's own move (travel(): not held by laysnap, bent by bend()) */

/** @type {Map<string, { from: Box, to: Box, write: Write, with?: string, travel?: boolean }>} asked for in this task */
const asked = new Map();
/** @type {Map<HTMLElement, boolean>} contents that don't travel, fading in (true) or out in this task */
const fading = new Map();
/** what to call when a queued fade is over (rearrangeFade's `done`) @type {Map<HTMLElement, () => void>} */
const fadeDone = new Map();
/** @type {{ t0: number, T: number, q: (i: number, e: number) => [number, number], moves: [string, Move][] } | null} */
let run = null;
/** what follows the travellers, placed after their writes every frame of the run (the views riding the plate in a
 * switch): each called once more as the run lands, then let go @type {Set<() => void>} */
const followers = new Set();
let raf = 0,
  queued = false;
/** the kind of the change being made in this task: its plans take that kind's steps (layoutmath.js morphSteps) — declared
 * by the change's owner (as), back to a same-page rearrangement when the task ends
 * @type {import("./layoutmath.js").ChangeKind} */
let kind = "rearrange",
  kindT = 0;
/** the change this task makes is of this kind: every plan started or re-planned in this task takes its steps — the
 * change's owner says it before asking for its moves (picstate.js: another picture; tabs.js tabGo: a tab or a layout
 * switch) @param {import("./layoutmath.js").ChangeKind} k */
export function as(k) {
  kind = k;
  clearTimeout(kindT);
  kindT = setTimeout(() => (kind = "rearrange"), 0); // the task's end
}
/** the kind of the change being made now (a plan made outside the driver takes the same steps) */
export const kindNow = () => kind;

/** `key`'s box moves from `from` (where it is now) to `to` in the coming rearrangement; written at once when the layout
 * jumps on purpose (snaps: a switch, a drag, a live resize, reduced motion) @param {string} key @param {Box} from
 * @param {Box} to @param {Write} write @param {string} [source] a dependent: it moves on this box's progress when that
 * moves too (the prompt box anchored to the picture keeps its anchor every frame; on the plan's own curve for a box
 * that only moves, it fell behind a picture that grows) */
export function rearrange(key, from, to, write, source) {
  if (snaps() || same(from, to)) {
    stop(key);
    write(to);
    return;
  }
  if (retarget(key, to, write)) return;
  asked.set(key, { from, to, write, with: source });
  if (!queued) {
    queued = true;
    queueMicrotask(start);
  }
}
/** a switch's own move: `key` travels from `from` to `to` on the driver, while the layout itself lands at once
 * (laysnap) — so not subject to snaps(), only to reduced motion. A new plan for it (a new switch starts from where the
 * box is: the caller measures `from` on screen), never a retarget @param {string} key @param {Box} from @param {Box} to
 * @param {Write} write */
export function travel(key, from, to, write) {
  stop(key);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || same(from, to)) {
    write(to);
    return;
  }
  asked.set(key, { from, to, write, travel: true });
  if (!queued) {
    queued = true;
    queueMicrotask(start);
  }
}
/** a travelling box's goal changed (the layout settling mid-switch, a re-layout during a crop-and-reveal): its path
 * bends to the new goal on the same plan and clock (retarget) — never a jump, whatever holds the layout at once.
 * false: not travelling (the caller's usual way) @param {string} key @param {Box} to */
export function bend(key, to) {
  const a = asked.get(key);
  if (a && a.travel) {
    a.to = to;
    return true;
  }
  const m = run ? run.moves.find(([k, mv]) => k === key && !mv.off)?.[1] : null;
  return !!m && !!m.travel && retarget(key, to, m.write);
}
/** plan what was asked in this task NOW (not at the task's end): a switch times its fades on the plan's clock, in the
 * same task @returns {{ t0: number, plan: ReturnType<typeof shapePlan> } | null} */
export function flush() {
  if (!queued) return run ? { t0: run.t0, plan: /** @type {any} */ (run).plan } : null;
  start();
  return run ? { t0: run.t0, plan: /** @type {any} */ (run).plan } : null;
}
/** while the run moves: `fn` places what follows the travellers, every frame after their writes (and once as it lands)
 * @param {() => void} fn @returns {() => void} let go of it (its switch ended, or a newer one took over) */
export function follow(fn) {
  followers.add(fn);
  fn();
  return () => followers.delete(fn);
}
/** a run is moving things now (what follows it is placed in its frames) */
export const driving = () => !!run;
/** how far `key`'s move has come on each axis, 0 → 1 ([1, 1]: not moving) @param {string} key @returns {[number, number]} */
export function progressXY(key) {
  if (!run) return [1, 1];
  const i = run.moves.findIndex(([k, m]) => k === key && !m.off);
  if (i < 0) return [1, 1];
  return run.q(i, Math.min(run.T, performance.now() - run.t0));
}
/** how far `key`'s move has come, its axes averaged (1: not moving) @param {string} key */
export function progress(key) {
  const q = progressXY(key);
  return (q[0] + q[1]) / 2;
}
/** a new goal for a box ALREADY MOVING bends its remaining path, on the same plan and clock: from where it is at this
 * moment's progress to the new goal (the start is solved so the plan's curve passes through both — no jump). Nothing
 * else restarts (a new plan per ask: a box whose goal changes every few frames — the prompt's height as its text
 * rewraps — kept the picture from ever landing; UIKit's beginFromCurrentState). false: not moving, or an axis that has
 * finished would have to move again — the ask starts a new plan from where everything is
 * @param {string} key @param {Box} to @param {Write} write */
function retarget(key, to, write) {
  if (!run) return false;
  const i = run.moves.findIndex(([k, m]) => k === key && !m.off);
  if (i < 0) return false;
  const m = run.moves[i][1],
    index = new Map(run.moves.map(([k], j) => [k, j])),
    src = m.with != null ? index.get(m.with) : undefined,
    e = performance.now() - run.t0;
  if (e >= run.T) return false;
  const q = run.q(src ?? i, e),
    at = shapeBox(m.from, m.to, q),
    from = { ...m.from };
  for (const [k, ax] of /** @type {const} */ ([
    ["l", 0],
    ["w", 0],
    ["t", 1],
    ["h", 1],
  ])) {
    if (Math.abs(to[k] - m.to[k]) < 0.5) continue;
    if (q[ax] >= 0.999) return false;
    from[k] = (at[k] - to[k] * q[ax]) / (1 - q[ax]); // the plan's line through where it is now and the new goal
  }
  m.from = from;
  m.to = to;
  m.write = write;
  return true;
}
/** `el` (contents that don't travel: the status row) comes or goes in the coming rearrangement — on its plan's fades
 * (layoutmath.js fades: what leaves ends at the swap, what comes starts at it), from its start time @param {HTMLElement} el
 * @param {boolean} on @param {() => void} [done] when its fade is over or cancelled (a leaving copy: leave.js drop) */
export function rearrangeFade(el, on, done) {
  if (snaps()) {
    fadeNow(el, on, 0, ms("--dur-jump"), performance.now(), done); // the layout jumps on purpose: a short fade, no plan
    return;
  }
  fading.set(el, on);
  if (done) fadeDone.set(el, done);
  if (!queued) {
    queued = true;
    queueMicrotask(start);
  }
}
/** a content fade on the driver's clock @param {HTMLElement} el @param {boolean} on @param {number} delay
 * @param {number} length its ms @param {number} t0 @param {() => void} [done] */
function fadeNow(el, on, delay, length, t0, done) {
  const timing = {
    delay,
    duration: length,
    easing: easing("--ease-content"),
    fill: /** @type {FillMode} */ ("backwards"),
  }; // its first keyframe holds until its start
  /* by its parts (fade.js): the status row holds glass (DD-2026-11-08-8); shown throughout the fade on the row itself
     (visibility is no backdrop root). From what is on screen: a second fade carries on from the first's value; fresh, it
     comes from hidden or leaves from shown */
  const anims = fade(el, on ? 1 : 0, timing, { glass: true, from: on ? 0 : 1 });
  for (const a of anims) a.startTime = t0;
  if (done)
    Promise.all(anims.map(a => a.finished)).then(
      () => done(),
      () => done(),
    );
  el.animate([{ visibility: "visible" }, { visibility: "visible" }], timing).startTime = t0;
}
/** `key` stops moving (another motion takes it over: a crop-and-reveal, a switch's hold) @param {string} key */
export function stop(key) {
  asked.delete(key);
  for (const [k, m] of run ? run.moves : []) if (k === key) m.off = true; // (its place in the plan stays: one index per box)
}
/** `key`'s box is moving now (its goal is what the last ask said) @param {string} key */
export const moving = key => asked.has(key) || (!!run && run.moves.some(([k, m]) => k === key && !m.off));
/** a switch's own move is on (travel(): a crop-and-reveal's frame, a switch's plate) — what it carries is at its end
 * state from the first frame (DD-4) */
export const travelling = () =>
  [...asked.values()].some(a => a.travel) || (!!run && run.moves.some(([, m]) => m.travel && !m.off));
/** where `key` is going, while it moves @param {string} key */
export const movingTo = key => asked.get(key)?.to ?? run?.moves.find(([k, m]) => k === key && !m.off)?.[1].to ?? null;

const same = (/** @type {Box} */ a, /** @type {Box} */ b) =>
  Math.abs(a.l - b.l) < 0.5 && Math.abs(a.t - b.t) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;

/* one plan for everything asked in this task, and for what was still moving: from where it is now */
function start() {
  if (!queued) return;
  queued = false;
  /** @type {Map<string, Move>} */
  const all = new Map();
  if (run) for (const [k, m] of run.moves) if (!asked.has(k) && !m.off) all.set(k, { ...m, from: m.cur });
  for (const [k, a] of asked) all.set(k, { ...a, cur: a.from });
  asked.clear();
  const moves = [...all].filter(([, m]) => !same(m.from, m.to)),
    plan = shapePlan(
      moves.map(([, m]) => ({ o: m.from, n: m.to })),
      kind,
    ), // nothing moving: a plain cross-fade's
    t0 = performance.now(),
    f = fades(plan);
  for (const [el, on] of fading) fadeNow(el, on, on ? f.in.delay : f.out.delay, MORPH.fade, t0, fadeDone.get(el));
  fading.clear();
  fadeDone.clear();
  if (!moves.length) {
    run = null;
    for (const fn of followers) fn();
    followers.clear();
    landed();
    return;
  }
  run = /** @type {any} */ ({ t0, T: plan.T, q: plan.q, moves, plan });
  if (!raf) raf = requestAnimationFrame(tick);
}
/** @param {number} now */
function tick(now) {
  raf = 0;
  if (!run) return;
  const e = now - run.t0,
    end = e >= run.T;
  const index = new Map(run.moves.map(([k], i) => [k, i]));
  run.moves.forEach(([, m], i) => {
    if (m.off) return;
    const src = m.with != null ? index.get(m.with) : undefined, // a dependent: its source's progress
      b = end ? m.to : shapeBox(m.from, m.to, run ? run.q(src ?? i, e) : [1, 1]);
    m.cur = b;
    m.write(b);
  });
  plateSync(); // the plate rides the frame or the panel, the tab bar the plate
  promptFollow(true); // the prompt box, glued one gap from the plate
  if (end) run = null; // (before the followers' last call: they see the run has landed)
  for (const fn of followers) fn(); // what rides the travellers (a switch's views, the box's relation change)
  if (end) {
    followers.clear();
    landed();
  } else raf = requestAnimationFrame(tick);
}
/* ---------- the driver says when it has landed: a motion's end is the motion's, never a timer's guess (T4) ---------- */
/** who waits for the driver to have nothing moving @type {(() => void)[]} */
let idlers = [];
function landed() {
  if (run || queued) return;
  const w = idlers;
  idlers = [];
  for (const fn of w) fn();
}
/** resolves once nothing is moving on the driver (at once if nothing is, or is asked to) @returns {Promise<void>} */
export function whenIdle() {
  return run || queued ? new Promise(r => idlers.push(r)) : Promise.resolve();
}
