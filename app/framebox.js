// @ts-check
/* Kiln · the picture frame's box has ONE owner — ARCHITECTURE › the picture frame's box. The layout says where the
   frame belongs (frameGoal); a crop-and-reveal makes it travel on the one driver (frameTravel); this module alone writes
   its left / top / width / height, and every write places what depends on it in the same frame — the glass plate (and
   through it the tab bar) and what sits round the frame (around.js) */
import { placeAround } from "./around.js";
import { $ } from "./dom.js";
import { bez } from "./layoutmath.js";
import { plateSync } from "./plate.js";
import { promptFollow, stageRect } from "./layout.js";
import { bend, moving, rearrange, stop, travel } from "./rearrange.js";
import { S } from "./state.js";

/** @typedef {{ l: number, t: number, w: number, h: number }} Box in the stage's coordinates */

/** @type {Box | null} */
let cur = null; // where the frame is
/** @type {Box | null} */
let goal = null; // where the layout wants it
let held = false; // its view is leaving in a switch: it stays where it was (frameHold)
export const layE = bez(0.05, 0.7, 0.1, 1); // --lay-e: the layout's curve

/* ---------- a picture change: the motion is decided HERE (ownership map G11) ----------
   What's on show changing is declared by its owners (picstate.js pv; a switch, tabs.js tabGo) with where the picture
   was; the next goal decides once (morph.js): another picture in a box of another shape or size crops and reveals, the
   same picture at another size (a layout switch: `scale`) scales with the frame, the same box doesn't move */
/** @typedef {Box & { x: number, y: number, scale?: boolean }} WasBox the old box, and its top-left on screen before anything
 * moved; scale: the same picture at another size (a layout switch) — it scales with the frame, no crop-and-reveal */
/** @type {(o: WasBox) => boolean} the crop-and-reveal (morph.js registers it): false when it didn't start */
let morphWith = () => false;
/** @param {(o: WasBox) => boolean} fn */
export function setPictureMorph(fn) {
  morphWith = fn;
}
/** @type {WasBox | null} */
let change = null;
/** the picture on show is changing (declared once per change, in the same task as its layout) @param {WasBox} o */
export function pictureChange(o) {
  change = o;
  queueMicrotask(() => {
    change = null; // unused by the end of this task: no new box came (another view, the same box)
  });
}
/** where the frame is now (null before the first layout) */
export const frameBox = () => cur;
/** where the layout wants it (a glide or a crop-and-reveal may still be on the way) */
export const frameTarget = () => goal;

/** @param {Box} b */
function write(b) {
  const s = $("frame").style,
    px = (/** @type {number} */ v) => v + "px";
  if (!cur || b.l !== cur.l) s.left = px(b.l);
  if (!cur || b.t !== cur.t) s.top = px(b.t);
  if (!cur || b.w !== cur.w) s.width = px(b.w);
  if (!cur || b.h !== cur.h) s.height = px(b.h);
  cur = b;
  plateSync(); // the plate rides the frame, the tab bar the plate
  placeAround(); // the status row, Show prompt, the edit buttons, the edge strips
  promptFollow(true); // the prompt column, a pair gap from the picture (side by side), on this write
}
/* no glide while the layout jumps on purpose: a switch (captured where it ends), an edge or a window being dragged
   (the box follows the pointer), reduced motion — rearrange.js asks it for every box */
export function snaps() {
  const b = document.body.classList;
  return (
    b.contains("laysnap") ||
    b.contains("laydrag") ||
    b.contains("liveresize") ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
/** the layout's glide time (--lay-t), in ms */
export function layT() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--lay-t").trim();
  return v.endsWith("ms") ? parseFloat(v) : (parseFloat(v) || 0.42) * 1000;
}
const same = (/** @type {Box} */ a, /** @type {Box} */ b) => a.l === b.l && a.t === b.t && a.w === b.w && a.h === b.h;

/** the layout: where the frame belongs. It moves there on the rearrangement (a new goal mid-way bends the path), or
 * jumps (snaps()). While a crop-and-reveal drives it, the goal is where it lands @param {Box} b */
export function frameGoal(b) {
  if (change && !held) {
    const o = change;
    change = null;
    /* another box — or the same box at another place on screen (a layout switch, Left ↔ Right) */
    const st = stageRect(),
      elsewhere = Math.abs(st.left + b.l - o.x) > 0.5 || Math.abs(st.top + b.t - o.y) > 0.5;
    if (cur && (!same(cur, b) || elsewhere) && S.view === "gen") {
      goal = b;
      if (morphWith(o)) return; // reduced motion: it doesn't start — the jump below
    }
  }
  if (held) {
    goal = b; // where it goes once its view has left (frameHold)
    return;
  }
  if (goal && same(goal, b) && (moving("frame") || (cur && same(cur, b)))) return;
  goal = b;
  if (!cur) {
    write(b);
    return;
  }
  /* travelling (a crop-and-reveal): its path bends to the new goal on the same plan and clock (the layout settling
     mid-switch) */
  if (bend("frame", b)) {
    const f = $("frame");
    if (f.classList.contains("morph")) {
      f.style.setProperty("--nw", b.w + "px");
      f.style.setProperty("--nh", b.h + "px");
    }
    return;
  }
  /* on the rearrangement's plan and clock, with what else moves — in the area's px, which never move
     (DD-2026-11-08-1) */
  rearrange("frame", cur, b, write);
}
/** a crop-and-reveal (morph.js): the frame TRAVELS from `from` to `to` (the stage's px) on the one driver
 * (rearrange.js travel — one plan and clock with whatever else moves) — its first box at once, before anything is
 * painted elsewhere @param {Box} from
 * @param {Box} to */
export function frameTravel(from, to) {
  goal = to;
  travel("frame", from, to, write);
  write(from);
}
/** a tab switch leaving the picture's view: the frame (and what sits round it) stays where it was on screen while the
 * view fades — the layout has already moved on to the new tab's. null: let go, to the layout's goal (the view is
 * hidden by then) @param {Box | null} b */
export function frameHold(b) {
  if (b) {
    change = null; // its view is leaving: no crop-and-reveal there
    held = true;
    stop("frame");
    write(b);
    return;
  }
  if (!held) return;
  held = false;
  if (goal) write(goal);
}
