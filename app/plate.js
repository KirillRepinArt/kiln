// @ts-check
/* Kiln · the glass plate (v0.7.2): one glass object under the right column's contents — the panel's shape in Queue /
   LoRAs / PNG Info, the picture frame's shape in Generating. A tab switch changes its shape — the glass stays live,
   only the contents cross-fade. (Snapshot switches couldn't carry glass: a View Transition's snapshot is a flat picture
   that can't blur what's behind it, so the glass went clear for every switch — the user chose the plate, 2026-10-27.)
   The plate is empty, so changing its size costs the blur, no layout of contents. PNG Info's drop line is the plate's
   too: inset on it, it changes shape with it and fades as a switch leaves (it slid inside the contents' snapshot) */
import { placeAround } from "./around.js";
import { $ } from "./dom.js";
import { shapeBox, shapeSteps } from "./layoutmath.js";
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
let pending = false; // a switch has begun and hasn't shown yet: the plate holds its old shape (and its drop line)
export function plateBefore() {
  pending = true;
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
export const SWITCH = { ms: 650, curve: [0.05, 0.7, 0.1, 1] }; // the prompt column's slide (layout.js): --t-650, --lay-e
/** @type {Animation[]} */
let switchAnims = [];
/* the switch's layers that cross at the swap: the contents, a picture and its glow, the picture's arrows */
const SWAPS = new Set(["kiln-panel", "kiln-pic", "kiln-glow", "kiln-navl", "kiln-navr"]); // the running switch's own animations (a new switch replaces them)

/** @param {{ l: number, t: number, w: number, h: number }} at where the plate was on screen (plateBefore)
 * @returns {number} the switch's start time (the document timeline's ms — performance.now()'s clock) */
export function switchGlide(at) {
  pending = false;
  const h = document.documentElement,
    o = $("right").getBoundingClientRect(),
    to = target(),
    toS = { l: o.left + to.l, t: o.top + to.t, w: to.w, h: to.h }, // on screen
    steps = shapeSteps(at, toS), // the one choreography: crop, swap, reveal (layoutmath.js)
    T = Math.max(1, steps.T),
    /* keyframes every 8 ms, and exactly on the steps' ends: between two samples the box goes in a straight line, and
       the crop is steepest just before the swap — sampled past it, the plate was still 9 px taller than the picture
       as it came in */
    at8 = Array.from({ length: Math.ceil(T / 8) + 1 }, (_, i) => Math.min(T, i * 8)),
    /** @type {{ offset: number, q: [number, number] }[]} */
    samples = [...new Set([...at8, steps.A, steps.A + steps.S, T])]
      .filter(e => e >= 0 && e <= T)
      .sort((x, y) => x - y)
      .map(e => ({ offset: e / T, q: steps.q(e) })),
    /* the clock starts NOW, and everything holds its first keyframe until then (fill: backwards): read as the current
       frame's start, the first frame shown was already ~30 ms in — the prompt column's first step 34 px */
    t0 = performance.now(),
    /** @type {{ duration: number, easing: string, fill: FillMode }} */
    timing = { duration: T, easing: "linear", fill: "backwards" }, // the keyframes carry the curves
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
  const dropWas = $("plate").classList.contains("drop");
  put(to);
  /* PNG Info's drop line leaving with its panel: it fades across the crop, to the swap (its own 150 ms fade at the
     start read as vanishing, the user, 2026-10-28); coming in, its own fade is the one the user liked */
  if (dropWas && !$("plate").classList.contains("drop"))
    go(
      $("plate").animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: Math.max(steps.A + steps.S, 1),
        easing: "ease-in",
        fill: "backwards",
        pseudoElement: "::after",
      }),
    );
  plateFollow(T + 50); // every frame of the glide: the bar's resting place follows the plate
  /* the plate's look changing with it (a panel's glass and ring coming in) and the selected tab's pill: their own CSS
     transitions, put on the switch's clock (they began a frame later) */
  for (const el of [$("plate"), $("rim"), $("thumb")]) {
    void getComputedStyle(el).boxShadow; // starts the transitions the change above set off
    for (const a of el.getAnimations()) if (a instanceof CSSTransition) a.startTime = t0;
  }
  /* the plate and its rim: one set of keyframes, on screen → in the right column */
  const boxes = samples.map(s => shapeBox(at, toS, s.q)),
    keys = boxes.map((b, i) => ({
      offset: samples[i].offset,
      left: px(b.l - o.left),
      top: px(b.t - o.top),
      width: px(b.w),
      height: px(b.h),
    }));
  const m = go($("plate").animate(keys, timing));
  morph = m;
  go($("rim").animate(keys, timing));
  m.onfinish = m.oncancel = () => {
    if (morph === m) morph = null;
    plateFollow(300);
  };
  /* the tab bar over the plate all the way, starting where its buttons were on screen (the bar's box changes width on
     a switch: worked out from the box it was off by up to 57 px) — that first gap closes as the plate moves */
  const tb = /** @type {HTMLElement} */ (document.querySelector(".tabs")),
    goal = barFor(tb, { left: toS.l, right: toS.l + toS.w, top: toS.t });
  setBar(tb, goal.x, goal.y);
  const now = $("seg").getBoundingClientRect(),
    fx = barBefore ? Math.round(goal.x + barBefore.left - now.left) : goal.x,
    fy = barBefore ? Math.round(goal.y + barBefore.top - now.top) : goal.y,
    over = boxes.map(b => barFor(tb, { left: b.l, right: b.l + b.w, top: b.t })),
    dx = fx - over[0].x,
    dy = fy - over[0].y,
    barKeys = over.map((g, i) => {
      const k = 1 - (samples[i].q[0] + samples[i].q[1]) / 2;
      return { offset: samples[i].offset, transform: `translate(${g.x + dx * k}px, ${g.y + dy * k}px)` };
    });
  if (barKeys.some(k => k.transform !== barKeys[barKeys.length - 1].transform)) {
    const a = go(tb.animate(barKeys, timing));
    barAnim = a;
    a.onfinish = a.oncancel = () => {
      if (barAnim === a) barAnim = null;
      placeBar();
    };
  }
  /* the switch's own layers (a View Transition, when there is one): every group re-keyed to the same choreography from
     its own first and last box; the contents' fades at the swap; the contents clipped to the plate — per keyframe, the
     plate's box in its layer's box, so it holds exactly (a group eases its own keyframes: on two curves the clip ran off
     the plate by up to 78 px) */
  /** @type {Record<string, { l: number, t: number, w: number, h: number }[]>} */
  const layer = {};
  for (const a of document.getAnimations()) {
    const e = /** @type {KeyframeEffect | null} */ (a.effect),
      p = (e && e.pseudoElement) || "";
    if (!e || !p.startsWith("::view-transition")) continue;
    const name = (p.match(/\(([^)]*)\)/) || ["", ""])[1];
    if (p.startsWith("::view-transition-group(")) {
      const kf = e.getKeyframes(),
        f0 = kf[0],
        f1 = kf[kf.length - 1];
      if (f0 && f1 && f0.transform && f0.width) {
        const m0 = new DOMMatrix(String(f0.transform)),
          m1 = new DOMMatrix(String(f1.transform)),
          g0 = { l: m0.e, t: m0.f, w: parseFloat(String(f0.width)), h: parseFloat(String(f0.height)) },
          g1 = { l: m1.e, t: m1.f, w: parseFloat(String(f1.width)), h: parseFloat(String(f1.height)) };
        layer[name] = samples.map(s => shapeBox(g0, g1, s.q));
        e.setKeyframes(
          layer[name].map((b, i) => ({
            offset: samples[i].offset,
            transform: `matrix(1, 0, 0, 1, ${b.l}, ${b.t})`,
            width: px(b.w),
            height: px(b.h),
          })),
        );
      }
      e.updateTiming(timing);
    } else if (SWAPS.has(name)) e.updateTiming({ delay: steps.A, duration: steps.S }); // the old contents until the swap, the new from it
    a.startTime = t0;
  }
  /* the contents inside the plate (1 px in, so its rim shows): the panel's contents, and a picture that fades where it
     was (it would hang outside the plate while it crops) */
  for (const [name, R] of /** @type {[string, number][]} */ ([
    ["kiln-panel", 1],
    ["kiln-pic", 0],
  ])) {
    let g = layer[name];
    if (!g) {
      /* a layer that doesn't move has no group animation (an old picture fading where it was): its box from the
         browser. Unclipped, the Gallery's picture stayed whole over the plate's crop and vanished at the swap — the
         switch to PNG Info looked like a snap (the user, 2026-10-28) */
      const c = getComputedStyle(h, `::view-transition-group(${name})`),
        w = parseFloat(c.width);
      if (!(w > 0)) continue;
      const mx = new DOMMatrix(c.transform === "none" ? undefined : c.transform),
        box = { l: mx.e, t: mx.f, w, h: parseFloat(c.height) };
      g = boxes.map(() => box);
    }
    const clip = boxes.map((b, i) => {
      const v = g[i],
        ins = [b.t - v.t, v.l + v.w - (b.l + b.w), v.t + v.h - (b.t + b.h), b.l - v.l].map(
          x => (Math.max(0, x) + R).toFixed(1) + "px",
        );
      return { offset: samples[i].offset, clipPath: `inset(${ins.join(" ")} round calc(var(--r-panel) - ${R}px))` };
    });
    for (const side of ["old", "new"])
      go(h.animate(clip, { ...timing, fill: "both", pseudoElement: `::view-transition-${side}(${name})` }));
  }
  return t0;
}
