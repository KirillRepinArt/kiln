// @ts-check
/* Kiln · the glass plate (v0.7.2): one glass object under the right column's contents — the panel's shape in Queue /
   LoRAs / PNG Info, the picture frame's shape in Generating. A tab switch changes its shape — the glass stays live,
   only the contents cross-fade. (Snapshot switches couldn't carry glass: a View Transition's snapshot is a flat picture
   that can't blur what's behind it, so the glass went clear for every switch — the user chose the plate, 2026-10-27.)
   The plate is empty, so changing its size costs the blur, no layout of contents. PNG Info's drop line is the plate's
   too: inset on it, it changes shape with it and fades as a switch leaves (it slid inside the contents' snapshot) */
import { placeAround } from "./around.js";
import { $ } from "./dom.js";
import { frameHold } from "./framebox.js";
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
// the running switch's own animations (a new switch replaces them)

/** @typedef {{ old: HTMLElement, oldRect: DOMRect, neu: HTMLElement }} Views a switch between two views: the one
 * leaving (where it was on screen) and the one coming */
/** @type {(() => void) | null} */
let leaveDone = null; // ends the running switch's leaving view (a new switch ends it at once)
/** @param {{ l: number, t: number, w: number, h: number }} at where the plate was on screen (plateBefore)
 * @param {Views | null} views the two views when the switch changes view; null: the same view (Generating ↔ the
 * Gallery — the frame moves by itself, as when browsing, and the plate follows it)
 * @returns {{ t0: number, T: number }} the switch's start time (performance.now()'s clock) and its length */
export function switchGlide(at, views) {
  pending = false;
  for (const a of switchAnims) a.cancel();
  switchAnims = [];
  if (leaveDone) leaveDone();
  if (barAnim) barAnim.cancel();
  barAnim = null;
  if (!views) {
    put(target()); // the plate rides the frame from here (framebox.js → plateSync)
    plateFollow(700);
    return { t0: performance.now(), T: 600 };
  }
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
  /* the two views, live (no snapshots: glass, the picture's arrows and buttons stay real — a View Transition's
     pictures of them blinked, 2026-10-28). The leaving one stays where it was on screen at its size (its contents
     don't reflow), the coming one where it belongs; both inside the plate as it glides (1 px in, so its rim shows),
     crossing at the swap */
  const { old, oldRect, neu } = views,
    rp = $("rpanel").getBoundingClientRect(),
    rpanel = $("rpanel"),
    os = old.style;
  old.classList.add("leaving");
  os.left = oldRect.left - rp.left - rpanel.clientLeft + "px";
  os.top = oldRect.top - rp.top - rpanel.clientTop + "px";
  os.width = oldRect.width + "px";
  os.height = oldRect.height + "px";
  os.right = os.bottom = "auto";
  h.classList.add("switching");
  const nr = neu.getBoundingClientRect(),
    /** the plate's box (on screen) as an inset of a view's box, 1 px inside */
    /** the plate's box b (on screen) as a clip of the box v */
    inset = (/** @type {DOMRect} */ v, /** @type {{ l: number, t: number, w: number, h: number }} */ b) =>
      `inset(${[b.t - v.top, v.right - (b.l + b.w), v.bottom - (b.t + b.h), b.l - v.left]
        .map(x => Math.max(0, x).toFixed(1) + "px")
        .join(" ")} round var(--r-panel))`,
    swap = { delay: steps.A, duration: steps.S, fill: /** @type {FillMode} */ ("both") },
    /* the picture's view: the picture is what the plate crops (the frame); what sits round it outside the plate — the
       edit buttons, the status row, Show prompt, the arrows — fades on its own, quickly: out at the start, in as the
       plate lands (clipped, they were cut off at the first frame) */
    pic = (/** @type {HTMLElement} */ v) => v.id === "v-gen",
    around = () => [$("gtools"), $("prog"), $("showP")],
    /* the picture's arrows: shown by hover alone (browse.js); a switch only takes them out with their view — faded
       in by the switch too, they showed where they last were (the screen's edge) while hover hadn't shown them */
    navs = () => [.../** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".gnav"))],
    Q = Math.min(150, T) / T;
  /* the views ride the plate: each keeps its place relative to the plate's centre every keyframe — the leaving one as
     it was at the start, the coming one as it will be at the end (the rule of the picture's crop-and-reveal). Pinned
     on screen, the leaving list stayed behind like a still while the plate moved off it ("a snapshot", the user,
     2026-10-28). The clip is the plate's box in the moved one */
  const centre = (/** @type {{ l: number, t: number, w: number, h: number }} */ b) => [b.l + b.w / 2, b.t + b.h / 2],
    fr = $("frame").getBoundingClientRect(), // measured before anything rides
    rides = /** @type {[HTMLElement, DOMRect, number[]][]} */ ([
      [old, oldRect, centre(boxes[0])],
      [neu, nr, centre(boxes[boxes.length - 1])],
    ]);
  for (const [v, r, anchor] of rides) {
    const sh = boxes.map(b => {
        const c = centre(b);
        return [c[0] - anchor[0], c[1] - anchor[1]];
      }),
      box = pic(v) ? fr : r, // what the plate crops: the picture in its view, else the whole view
      moved = (/** @type {number} */ i) => new DOMRect(box.left + sh[i][0], box.top + sh[i][1], box.width, box.height);
    go(
      v.animate(
        sh.map(([dx, dy], i) => ({ offset: samples[i].offset, transform: `translate(${dx}px, ${dy}px)` })),
        timing,
      ),
    );
    const c = boxes.map((b, i) => ({ offset: samples[i].offset, clipPath: inset(moved(i), b) }));
    go((pic(v) ? $("frame") : v).animate(c, timing));
  }
  /* only out, from what they are now: shown by hover (the edit buttons, the arrows) or by state (the status row,
     Show prompt), a switch never shows them — faded in by it, or out from fully shown, they blinked (the user,
     2026-10-28: "the only reason for them to be shown is hovering the picture") */
  /* everything that leaves fades out across the crop, easing in, gone by the swap — the edit buttons and arrows like
     PNG Info's drop line (in 150 ms they read as disintegrating, the user, 2026-10-28) */
  const leave = { duration: Math.max(1, steps.A + steps.S), easing: "ease-in", fill: /** @type {FillMode} */ ("both") };
  if (pic(old))
    for (const el of [...around(), ...navs()]) {
      const now = getComputedStyle(el).opacity;
      if (+now > 0.01) go(el.animate([{ opacity: now }, { opacity: 0 }], leave));
    }
  /* coming in, what state shows (the status row, Show prompt) fades in as the plate lands; the edit buttons wait for
     hover */
  if (pic(neu))
    for (const el of [$("prog"), $("showP")]) {
      const now = getComputedStyle(el).opacity;
      if (+now > 0.01) go(el.animate([{ opacity: 0 }, { opacity: 0, offset: 1 - Q }, { opacity: now }], timing));
    }
  /* a picture is cropped, then crosses at the swap; a panel's contents (a list, a form) fade across the crop from the
     first frame, linearly — held whole (or nearly, on an ease-in) while the plate cut into them, Queue → Generating
     read as a frozen snapshot (the user, 2026-10-28). Material's fade-through: the outgoing content goes at once */
  const out = go(old.animate([{ opacity: 1 }, { opacity: 0 }], pic(old) ? swap : { ...leave, easing: "linear" }));
  /* the picture's glow lives outside its view (a fixed layer): it comes and goes with the picture, at the swap */
  const fg = document.getElementById("fglow");
  if (fg && pic(neu) !== pic(old))
    go(fg.animate(pic(neu) ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], swap));
  go(neu.animate([{ opacity: 0 }, { opacity: 1 }], swap));
  /* the leaving view goes when the switch ends (or a new switch begins): hidden, back in its place */
  const end = () => {
    if (leaveDone !== end) return;
    leaveDone = null;
    old.classList.remove("leaving");
    for (const p of ["left", "top", "width", "height", "right", "bottom"]) os.removeProperty(p);
    h.classList.remove("switching");
    frameHold(null); // the picture's frame (if its view left) to where the layout wants it
    /* the switch's own animations end with it: kept (filling), they piled up holding the views' last looks */
    for (const a of switchAnims) a.cancel();
    switchAnims = [];
  };
  leaveDone = end;
  const last = go(old.animate([], { duration: T })); // the switch's length, no effect of its own
  last.onfinish = last.oncancel = out.oncancel = end;
  return { t0, T };
}
