// @ts-check
/* Kiln · the glass plate (v0.7.2): one glass object under the right column's contents — the panel's shape in Queue /
   LoRAs / PNG Info, the picture frame's shape in Generating. A tab switch changes its shape — the glass stays live,
   only the contents cross-fade. (Snapshot switches couldn't carry glass: a View Transition's snapshot is a flat picture
   that can't blur what's behind it, so the glass went clear for every switch — the user chose the plate, 2026-10-27.)
   The plate is empty, so changing its size costs the blur, no layout of contents. PNG Info's drop line is the plate's
   too: inset on it, it changes shape with it and fades as a switch leaves (it slid inside the contents' snapshot) */
import { $ } from "./dom.js";

/** @typedef {{ l: number, t: number, w: number, h: number, panel: boolean }} Box in #right's coordinates */

/** where the plate belongs now: the panel when there is one, else the picture frame @returns {Box} */
function target() {
  const rp = $("rpanel"),
    panel = rp.classList.contains("paneled"),
    r = (panel ? rp : $("frame")).getBoundingClientRect(),
    o = $("right").getBoundingClientRect();
  return { l: r.left - o.left, t: r.top - o.top, w: r.width, h: r.height, panel };
}
/* PNG Info's drop line: while it's empty, or a file is dragged over it */
function dropLine() {
  const w = /** @type {HTMLElement | null} */ (document.querySelector("#v-png.on .pwrap"));
  return w
    ? {
        on: !w.classList.contains("loaded") || w.classList.contains("dragging"),
        over: w.classList.contains("dragging"),
      }
    : null;
}
/** @param {Box} b */
function put(b) {
  const p = $("plate"),
    s = p.style;
  s.left = b.l + "px";
  s.top = b.t + "px";
  s.width = b.w + "px";
  s.height = b.h + "px";
  p.classList.toggle("panel", b.panel);
  const d = dropLine();
  p.classList.toggle("drop", !!d && d.on);
  p.classList.toggle("over", !!d && d.over);
}

/* at rest the plate follows its element; only while something moves (a resize, a glide, a crop-and-reveal) does it
   look every frame — the loop runs until `ms` after the last call */
/** @type {Animation | null} */
let morph = null;
let until = 0,
  raf = 0;
/** @param {number} [ms] */
export function plateFollow(ms = 700) {
  until = Math.max(until, performance.now() + ms);
  if (!raf) raf = requestAnimationFrame(tick);
}
/* right now, in step with whoever just moved the frame (a crop-and-reveal calls it each frame after placing the box:
   the follow loop runs before it in the frame, so on its own it drew where the frame was a frame ago) */
export function plateSync() {
  if (!morph && !pending) put(target());
}
function tick() {
  raf = 0;
  if (!morph && !pending) put(target());
  if (performance.now() < until) raf = requestAnimationFrame(tick);
}

/* a tab switch: the plate's box ON SCREEN before it (call before the switch changes anything) — the column the plate
   sits in may move with the switch */
let pending = false; // a switch has begun and hasn't shown yet: the plate holds its old shape (and its drop line)
export function plateBefore() {
  pending = true;
  const p = $("plate").getBoundingClientRect();
  return { l: p.left, t: p.top, w: p.width, h: p.height };
}
/* …and after the switch's layout is in place: from where it was to where it belongs, on the layout's curve and the
   prompt column's pace */
/** @param {{ l: number, t: number, w: number, h: number }} at where it was on screen (plateBefore) */
export function plateMorph(at) {
  pending = false;
  const o = $("right").getBoundingClientRect(),
    from = { l: at.l - o.left, t: at.t - o.top, w: at.w, h: at.h },
    to = target(),
    px = (/** @type {number} */ v) => v + "px",
    p = $("plate");
  if (morph) morph.cancel();
  put(to);
  morph = p.animate(
    [
      { left: px(from.l), top: px(from.t), width: px(from.w), height: px(from.h) },
      { left: px(to.l), top: px(to.t), width: px(to.w), height: px(to.h) },
    ],
    { duration: 650, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)" },
  );
  morph.onfinish = morph.oncancel = () => {
    morph = null;
    plateFollow(300);
  };
}
