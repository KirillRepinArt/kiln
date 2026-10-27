// @ts-check
/* Kiln · the live glass plate (v0.7.2, a prototype behind Settings → Effects → Tab switch: Live plate).
   One glass object under the right column's contents: the panel's shape in Queue / LoRAs / PNG Info, the picture
   frame's shape in Generating. A tab switch changes its shape — the glass stays live, only the contents cross-fade.
   (Snapshot switches can't carry glass: a View Transition's snapshot is a flat picture that can't blur what's behind
   it, so the glass went clear for the switch.) The plate is empty, so changing its size costs the blur, no layout of
   contents. Every switch in either mode records its frame times, shown under the setting, for the A/B */
import { $ } from "./dom.js";
import { S } from "./state.js";

/** @typedef {{ l: number, t: number, w: number, h: number, panel: boolean }} Box in #right's coordinates */

export const isLive = () => (S.set || {}).switchMode === "live";

/* the switch mode on the page: body.liveplate turns the panel's and the empty frame's own glass off (glass.css) */
export function applySwitchMode() {
  document.body.classList.toggle("liveplate", isLive());
  plateFollow(600);
}

/** where the plate belongs now: the panel when there is one, else the picture frame @returns {Box} */
function target() {
  const rp = $("rpanel"),
    panel = rp.classList.contains("paneled"),
    r = (panel ? rp : $("frame")).getBoundingClientRect(),
    o = $("right").getBoundingClientRect();
  return { l: r.left - o.left, t: r.top - o.top, w: r.width, h: r.height, panel };
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
}

/* at rest the plate follows its element; only while something moves (a resize, a glide, a crop-and-reveal) does it
   look every frame — the loop runs until `ms` after the last call */
/** @type {Animation | null} */
let morph = null;
let until = 0,
  raf = 0;
/** @param {number} [ms] */
export function plateFollow(ms = 700) {
  if (!isLive()) return;
  until = Math.max(until, performance.now() + ms);
  if (!raf) raf = requestAnimationFrame(tick);
}
/* right now, in step with whoever just moved the frame (a crop-and-reveal calls it each frame after placing the box:
   the follow loop runs before it in the frame, so on its own it drew where the frame was a frame ago) */
export function plateSync() {
  if (isLive() && !morph) put(target());
}
function tick() {
  raf = 0;
  if (!morph) put(target());
  if (performance.now() < until) raf = requestAnimationFrame(tick);
}

/* a tab switch: the plate's box ON SCREEN before it (call before the switch changes anything) — the column the plate
   sits in may move with the switch */
export function plateBefore() {
  const p = $("plate").getBoundingClientRect();
  return { l: p.left, t: p.top, w: p.width, h: p.height };
}
/* …and after the switch's layout is in place: from where it was to where it belongs, on the layout's curve and the
   prompt column's pace */
/** @param {{ l: number, t: number, w: number, h: number }} at where it was on screen (plateBefore) */
export function plateMorph(at) {
  if (!isLive()) return;
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

/* the A/B: frame times of the last switch (rAF gaps over its 0.7 s) */
/** @type {{ mode: string, frames: number, avg: number, worst: number, slow: number } | null} */
export let lastSwitch = null;
export function measureSwitch() {
  const mode = isLive() ? "Live plate" : "Snapshot",
    gaps = /** @type {number[]} */ ([]),
    t0 = performance.now();
  let prev = t0;
  const f = (/** @type {number} */ now) => {
    gaps.push(now - prev);
    prev = now;
    if (now - t0 < 700) requestAnimationFrame(f);
    else {
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      lastSwitch = {
        mode,
        frames: gaps.length,
        avg: Math.round(avg * 10) / 10,
        worst: Math.round(Math.max(...gaps)),
        slow: gaps.filter(g => g > 25).length,
      };
      const el = document.getElementById("swStats");
      if (el) el.textContent = switchStatsText();
    }
  };
  requestAnimationFrame(f);
}
export function switchStatsText() {
  const s = lastSwitch;
  return s
    ? `Last switch (${s.mode}): ${s.frames} frames · avg ${s.avg} ms · worst ${s.worst} ms · ${s.slow} over 25 ms`
    : "Switch tabs to measure";
}
