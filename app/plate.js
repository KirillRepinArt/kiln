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
/** @type {DOMRect | null} */
let viewBefore = null; // the panel's contents' box when the switch began (their snapshot glides from it)
let pending = false; // a switch has begun and hasn't shown yet: the plate holds its old shape (and its drop line)
export function plateBefore() {
  pending = true;
  const vw = document.querySelector(".rpanel > .view.on");
  viewBefore = vw ? vw.getBoundingClientRect() : null;
  barBefore = $("seg").getBoundingClientRect();
  const p = $("plate").getBoundingClientRect();
  return { l: p.left, t: p.top, w: p.width, h: p.height };
}
/* ---------- a tab switch's motion has ONE owner (2026-10-28) ----------
   Everything that moves in a switch is started here, from one geometry (the plate's box where it was on screen → where
   it belongs) and on ONE clock (one start time, the plate's curve): the plate and its rim, the tab bar, the switch's own
   layers (the View Transition's groups — the contents, a picture that travels, its glow, the picture's arrows — timed
   from here, not from CSS), the contents' clip to the plate, and the prompt column's slide (layout.js slideCol, given
   the start time). Five things used to time themselves — CSS keyframes, the browser's groups, three scripts — each from
   its own numbers and clock: the clip ran ~20 px off the plate, the rim's line crossed the picture, the plate sat empty
   ~200 ms waiting for the contents. The CSS keeps the look (fades, corners), not the motion */
export const SWITCH = { ms: 650, curve: [0.05, 0.7, 0.1, 1] }; // the plate's glide: --t-650, --lay-e
const switchEase = `cubic-bezier(${SWITCH.curve.join(", ")})`;
/** @type {Animation[]} */
let switchAnims = []; // the running switch's own animations (a new switch replaces them)

/** the contents' clip: the plate's box (on screen) as an inset of the snapshot's box v, 1 px inside the plate so its
 * rim (its ring, in the page under the switch's layers) always shows
 * @param {DOMRect} v @param {{ l: number, t: number, w: number, h: number }} b */
function clipIn(v, b) {
  const R = 1,
    ins = [b.t - v.top, v.right - (b.l + b.w), v.bottom - (b.t + b.h), b.l - v.left].map(
      x => Math.max(0, Math.round(x)) + R + "px",
    );
  return `inset(${ins.join(" ")} round calc(var(--r-panel) - ${R}px))`;
}
/** @param {{ l: number, t: number, w: number, h: number }} at where the plate was on screen (plateBefore)
 * @returns {number} the switch's start time (the document timeline's ms — performance.now()'s clock) */
export function switchGlide(at) {
  pending = false;
  const h = document.documentElement,
    o = $("right").getBoundingClientRect(),
    to = target(),
    from = { l: at.l - o.left, t: at.t - o.top, w: at.w, h: at.h },
    toS = { l: o.left + to.l, t: o.top + to.t, w: to.w, h: to.h }, // on screen
    t0 = Number(document.timeline.currentTime ?? performance.now()),
    timing = { duration: SWITCH.ms, easing: switchEase },
    px = (/** @type {number} */ v) => v + "px",
    /** one clock: every animation of the switch starts at t0 */
    go = (/** @type {Animation} */ a) => {
      a.startTime = t0;
      switchAnims.push(a);
      return a;
    };
  for (const a of switchAnims) a.cancel();
  switchAnims = [];
  if (barAnim) barAnim.cancel();
  barAnim = null;
  put(to);
  plateFollow(SWITCH.ms + 50); // every frame of the glide: the bar's resting place follows the plate
  /* the plate's look changing with it (a panel's glass and ring coming in) and the selected tab's pill: their own CSS
     transitions, put on the switch's clock (they began a frame later) */
  for (const el of [$("plate"), $("rim"), $("thumb")]) {
    void getComputedStyle(el).boxShadow; // starts the transitions the change above set off
    for (const a of el.getAnimations()) if (a instanceof CSSTransition) a.startTime = t0;
  }
  /* the plate and its rim: one set of keyframes */
  const keys = [
    { left: px(from.l), top: px(from.t), width: px(from.w), height: px(from.h) },
    { left: px(to.l), top: px(to.t), width: px(to.w), height: px(to.h) },
  ];
  const m = go($("plate").animate(keys, timing));
  morph = m;
  go($("rim").animate(keys, timing));
  m.onfinish = m.oncancel = () => {
    if (morph === m) morph = null;
    plateFollow(300);
  };
  /* the tab bar: from where its buttons were on screen to its place over the plate's new shape (the bar's box changes
     width on a switch: worked out from the box it was off by up to 57 px) */
  const tb = /** @type {HTMLElement} */ (document.querySelector(".tabs")),
    goal = barFor(tb, { left: toS.l, right: toS.l + toS.w, top: toS.t });
  setBar(tb, goal.x, goal.y);
  const now = $("seg").getBoundingClientRect(),
    fx = barBefore ? Math.round(goal.x + barBefore.left - now.left) : goal.x,
    fy = barBefore ? Math.round(goal.y + barBefore.top - now.top) : goal.y;
  if (fx !== goal.x || fy !== goal.y) {
    const a = go(
      tb.animate(
        [{ transform: `translate(${fx}px, ${fy}px)` }, { transform: `translate(${goal.x}px, ${goal.y}px)` }],
        timing,
      ),
    );
    barAnim = a;
    a.onfinish = a.oncancel = () => {
      if (barAnim === a) barAnim = null;
      placeBar();
    };
  }
  /* the switch's own layers (a View Transition, when there is one): its groups glide on the plate's curve and clock;
     their fades keep their own lengths, on the same clock */
  const vt = document.getAnimations().filter(a => {
    const p = /** @type {KeyframeEffect | null} */ (a.effect)?.pseudoElement || "";
    return p.startsWith("::view-transition");
  });
  if (vt.length) {
    for (const a of vt) {
      const p = /** @type {KeyframeEffect} */ (a.effect).pseudoElement || "";
      if (p.startsWith("::view-transition-group(")) {
        /* the plate's curve exactly: a CSS animation eases per keyframe ("ease" by default), and the curve set on top
           of that ran the layers off the plate by up to 78 px — so the keyframes go linear and the effect takes it */
        const e = /** @type {KeyframeEffect} */ (a.effect);
        e.setKeyframes(
          e.getKeyframes().map(f => ({
            ...Object.fromEntries(Object.entries(f).filter(([k]) => k !== "computedOffset" && k !== "composite")),
            easing: "linear",
          })),
        );
        e.updateTiming(timing);
      }
      a.startTime = t0;
    }
    /* the contents live INSIDE the plate: both snapshots clipped to it as it glides — measured in the snapshot's box,
       which glides from the old panel's box to the new one on this same curve and clock (where the plate was in the
       OLD box, where it's going in the new) */
    const view = document.querySelector(".rpanel > .view.on");
    if (view) {
      const v1 = view.getBoundingClientRect(),
        v0 = viewBefore || v1,
        clip = [{ clipPath: clipIn(v0, at) }, { clipPath: clipIn(v1, toS) }];
      for (const side of ["old", "new"])
        go(h.animate(clip, { ...timing, fill: "both", pseudoElement: `::view-transition-${side}(kiln-panel)` }));
    }
  }
  return t0;
}
