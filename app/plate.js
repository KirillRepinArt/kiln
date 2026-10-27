// @ts-check
/* Kiln · the glass plate (v0.7.2): one glass object under the right column's contents — the panel's shape in Queue /
   LoRAs / PNG Info, the picture frame's shape in Generating. A tab switch changes its shape — the glass stays live,
   only the contents cross-fade. (Snapshot switches couldn't carry glass: a View Transition's snapshot is a flat picture
   that can't blur what's behind it, so the glass went clear for every switch — the user chose the plate, 2026-10-27.)
   The plate is empty, so changing its size costs the blur, no layout of contents. PNG Info's drop line is the plate's
   too: inset on it, it changes shape with it and fades as a switch leaves (it slid inside the contents' snapshot) */
import { placeAround } from "./around.js";
import { $ } from "./dom.js";
import { SPACE } from "./tokens.js";

/** @typedef {{ l: number, t: number, w: number, h: number, panel: boolean }} Box in #right's coordinates */

/** where the plate belongs now: the panel when there is one, else the picture frame @returns {Box} */
function target() {
  const rp = $("rpanel"),
    panel = rp.classList.contains("paneled"),
    r = (panel ? rp : $("frame")).getBoundingClientRect(),
    o = $("right").getBoundingClientRect(),
    M = panel ? 0 : SPACE.mat; // the picture sits a mat inside its plate
  return { l: r.left - o.left - M, t: r.top - o.top - M, w: r.width + 2 * M, h: r.height + 2 * M, panel };
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
    rim = $("rim");
  for (const s of [p.style, rim.style]) {
    s.left = b.l + "px";
    s.top = b.t + "px";
    s.width = b.w + "px";
    s.height = b.h + "px";
  } /* the rim: the plate's ring, on top of what the plate holds — the same line on every plate, over a picture too, and
       never part of a switch's fading contents (the Gallery's picture drew a line of its own that faded in with it) */
  p.classList.toggle("panel", b.panel);
  rim.classList.toggle("panel", b.panel);
  const d = dropLine();
  p.classList.toggle("drop", !!d && d.on);
  p.classList.toggle("over", !!d && d.over);
  placeBar();
}

/* ---------- the tab bar has ONE owner: it follows the plate (2026-10-28) ----------
   It sits a part gap above the plate's top edge — the picture frame in Generating, the panel elsewhere — centred on the
   plate as far as the area allows (it never pokes out). It has no motion of its own: the plate glides on a switch and
   rides the frame on a ratio change, and the bar is placed from where the plate is, every frame anything moves. Four
   writers used to move it (the layout, a switch's slide, the crop-and-reveal, CSS glides); when two overlapped it
   ended mid-way or over the picture (137 px over the panel after a switch during a ratio change) */
let barX = 0,
  barY = 0; // the offset last set
/** the bar's offset that puts it a part gap above a plate box (screen px), centred on it within the area
 * @param {HTMLElement} tb @param {{ left: number, right: number, top: number }} pr */
function barFor(tb, pr) {
  const r = tb.getBoundingClientRect(),
    kids = tb.children,
    half = (kids[kids.length - 1].getBoundingClientRect().right - kids[0].getBoundingClientRect().left) / 2,
    left = r.left - barX, // where the bar is laid out, without the offset
    right = r.right - barX,
    bottom = r.bottom - barY,
    // how far it may shift and stay inside the area — none when the area is narrower than the bar's contents
    room = Math.max(0, (right - left) / 2 - half),
    x = Math.max(-room, Math.min(room, (pr.left + pr.right) / 2 - (left + right) / 2));
  return { x: Math.round(x), y: Math.round(Math.max(0, pr.top - SPACE.part - bottom)) };
}
/** @param {HTMLElement} tb @param {number} x @param {number} y */
function setBar(tb, x, y) {
  barX = x;
  barY = y;
  tb.style.transform = x || y ? `translate(${x}px, ${y}px)` : "";
}
export function placeBar() {
  const tb = /** @type {HTMLElement | null} */ (document.querySelector(".tabs"));
  if (!tb || !tb.children.length || barAnim) return; // during a switch it moves with the plate (plateMorph)
  const pr = $("plate").getBoundingClientRect();
  if (!pr.width) return;
  const { x, y } = barFor(tb, pr);
  if (x !== barX || y !== barY) setBar(tb, x, y);
}
/** @type {Animation | null} */
let barAnim = null;
/** @type {DOMRect | null} */
let barBefore = null; // where the tab buttons (#seg) were on screen when a switch began

/* at rest the plate follows its element; only while something moves (a resize, a glide, a crop-and-reveal) does it
   look every frame — the loop runs until `ms` after the last call */
/** @type {Animation | null} */
let morph = null;
/** @type {Animation | null} */
let rimMorph = null; // the rim on the plate's glide
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
  placeAround();
}
/* the loop also carries what sits round the frame (around.js): it runs whenever the frame may be moving */
function tick() {
  raf = 0;
  placeAround();
  if (!morph && !pending) put(target());
  else if (morph) placeBar(); // the plate is gliding (a switch): the bar follows it
  if (performance.now() < until) raf = requestAnimationFrame(tick);
}

/* a tab switch: the plate's box ON SCREEN before it (call before the switch changes anything) — the column the plate
   sits in may move with the switch */
let pending = false; // a switch has begun and hasn't shown yet: the plate holds its old shape (and its drop line)
export function plateBefore() {
  pending = true;
  barBefore = $("seg").getBoundingClientRect();
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
  if (rimMorph) rimMorph.cancel();
  put(to);
  plateFollow(700); // every frame of the glide: the bar follows the plate
  const keys = [
      { left: px(from.l), top: px(from.t), width: px(from.w), height: px(from.h) },
      { left: px(to.l), top: px(to.t), width: px(to.w), height: px(to.h) },
    ],
    timing = { duration: 650, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)" };
  morph = p.animate(keys, timing);
  rimMorph = $("rim").animate(keys, timing); // the plate's ring: the same glide, started together (in lockstep)
  morph.onfinish = morph.oncancel = () => {
    morph = null;
    if (rimMorph) rimMorph.cancel();
    rimMorph = null;
    plateFollow(300);
  };
  /* the bar on the same glide: from where it was on screen to its place over the plate's new shape — one animation
     for both, in lockstep (placed by script a frame behind the plate, it lagged and overshot, 2026-10-28) */
  const tb = /** @type {HTMLElement} */ (document.querySelector(".tabs"));
  if (barAnim) barAnim.cancel();
  barAnim = null;
  const goal = barFor(tb, { left: o.left + to.l, right: o.left + to.l + to.w, top: o.top + to.t });
  setBar(tb, goal.x, goal.y);
  /* the glide starts where the tab buttons WERE on screen: measured on the buttons themselves, before and now (at the
     goal) — the bar's box changes width on a switch, so working it out from the box was off by up to 57 px */
  const now = $("seg").getBoundingClientRect(),
    fx = barBefore ? Math.round(goal.x + barBefore.left - now.left) : goal.x,
    fy = barBefore ? Math.round(goal.y + barBefore.top - now.top) : goal.y;
  if (fx !== goal.x || fy !== goal.y) {
    const a = tb.animate(
      [{ transform: `translate(${fx}px, ${fy}px)` }, { transform: `translate(${goal.x}px, ${goal.y}px)` }],
      { duration: 650, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)" },
    );
    barAnim = a;
    a.onfinish = a.oncancel = () => {
      if (barAnim === a) barAnim = null;
      placeBar();
    };
  }
}
