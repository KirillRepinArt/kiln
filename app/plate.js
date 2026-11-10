// @ts-check
/* Kiln · the glass plate (v0.7.2): one glass object under the right column's contents — the panel's shape in Queue /
   LoRAs / PNG Info, the picture frame's shape in Generating. A tab switch changes its shape — the glass stays live,
   only the contents cross-fade. (Snapshot switches couldn't carry glass: a View Transition's snapshot is a flat picture
   that can't blur what's behind it, so the glass went clear for every switch — the user chose the plate, 2026-10-27.)
   The plate is empty, so changing its size costs the blur, no layout of contents. PNG Info's drop line is the plate's
   too: inset on it, it changes shape with it and fades as a switch leaves (it slid inside the contents' snapshot) */
import { placeAround } from "./around.js";
import { $, offsetIn } from "./dom.js";
import { frameBox, frameHold, frameTarget } from "./framebox.js";
import { fade, seenNow } from "./fade.js";
import { fades, shapeSteps } from "./layoutmath.js";
import { bend, flush, follow, moving, progress, progressXY, travel } from "./rearrange.js";
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
/* where a switch goes: a picture's plate where the frame's owner is taking it (its goal, set by the layout) — not the
   frame measured now: on a panel page the hidden frame is laid out in the panel's room, so a switch from a shortened
   Queue cropped to a 3:4 at the Queue's height, then snapped to the real size (the user, 2026-11-03). A panel: its box */
/** @returns {Box} */
function goalBox() {
  const g = frameTarget();
  if ($("rpanel").classList.contains("paneled") || !g) return target();
  const o = offsetIn($("stage"), $("right")),
    M = SPACE.mat;
  return { l: o.x + g.l - M, t: o.y + g.t - M, w: g.w + 2 * M, h: g.h + 2 * M, panel: false };
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
   It sits a part gap above the plate's top edge — the picture frame in Generating, the panel elsewhere — on the plate's
   centre line, always (2026-10-31: it used to be clamped into the area, which holds the edit buttons' column too — the
   bar sat ~24 px off the plate's centre). The layout keeps the room for it (layout.js layGeo: the area is never narrower
   than the bar beside the buttons' column). It has no motion of its own: the plate glides on a switch and
   rides the frame on a ratio change, and the bar is placed from where the plate is, every frame anything moves. Four
   writers used to move it (the layout, a switch's slide, the crop-and-reveal, CSS glides); when two overlapped it
   ended mid-way or over the picture (137 px over the panel after a switch during a ratio change) */
let barX = 0,
  barY = 0; // the offset last set
/** the bar's offset that puts it a part gap above a plate box (screen px), centred on it
 * @param {HTMLElement} tb @param {{ left: number, right: number, top: number }} pr */
function barFor(tb, pr) {
  const r = tb.getBoundingClientRect(),
    kids = tb.children,
    // where the bar's contents are laid out, without the offset (its box may be wider: the area's width)
    left = kids[0].getBoundingClientRect().left - barX,
    right = kids[kids.length - 1].getBoundingClientRect().right - barX,
    bottom = r.bottom - barY,
    /* centred over the plate, inside the window (Q1: A — the layout pass's bar rule): over a small picture at the
       window's side it ran off the window and the Layout button couldn't be pressed (ROADMAP v0.7c (p)) */
    x = Math.min(
      innerWidth - SPACE.area - right,
      Math.max(SPACE.area - left, (pr.left + pr.right) / 2 - (left + right) / 2),
    );
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
  if (!tb || !tb.children.length) return;
  const pr = $("plate").getBoundingClientRect();
  if (!pr.width) return;
  let { x, y } = barFor(tb, pr);
  /* a switch: the bar starts where its buttons were on screen (its box changes width with the tab: from its box it was
     off by up to 57 px) — that first gap closes as the plate travels, on the plate's progress (T2c-3b: it had keyframes
     of its own, sampled in advance) */
  if (barFlip) {
    const k = progress("plate");
    if (k >= 1) barFlip = null;
    else {
      x = Math.round(x + barFlip.dx * (1 - k));
      y = Math.round(y + barFlip.dy * (1 - k));
    }
  }
  if (x !== barX || y !== barY) setBar(tb, x, y);
}
/** a switch's opening offset of the bar (where its buttons were, less where the plate puts it) @type {{ dx: number, dy: number } | null} */
let barFlip = null;
/** @type {DOMRect | null} */
let barBefore = null; // where the tab buttons (#seg) were on screen when a switch began

/* the plate is derived from its element (the picture's frame, a panel's box): whoever writes that element tells it in
   the same frame — framebox.js write, layout.js panelWrite, the driver's frames (rearrange.js tick) — and what sits
   round it follows (around.js). While a switch moves it, it's the driver's (rearrange.js travel: moving("plate")).
   T2c-4: it had a loop of its own that looked every frame for 0.7–1.5 s after a change; measured over 30 actions it
   only ever corrected a 1 px error of its own goal (dom.js offsetIn missed the panel's border) */
const driven = () => moving("plate");
/* right now, in step with whoever just moved the element */
export function plateSync() {
  if (!driven() && !pending) put(target());
  placeAround();
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
   from here, not from CSS), the contents' clip to the plate, and the prompt box riding the plate (layout.js promptFollow, in
   the driver's frames). Five things used to time themselves — CSS keyframes, the browser's groups, three scripts — each from
   its own numbers and clock: the clip ran ~20 px off the plate, the rim's line crossed the picture, the plate sat empty
   ~200 ms waiting for the contents. The CSS keeps the look (fades, corners), not the motion */
/** @type {Animation[]} */
let switchAnims = [];
// the running switch's own animations (a new switch replaces them)

/** @typedef {{ old: HTMLElement, oldRect: DOMRect, neu: HTMLElement, shown?: Map<HTMLElement, { o: number, r: DOMRect }> }} Views
 * a switch between two views: the one leaving (where it was on screen) and the one coming — the SAME view for a layout
 * switch (Left / Right / Vertical, T2b): it rides the plate live, nothing of it fades. `shown`: every page's opacity
 * and box on screen before the switch (tabs.js onScreen) — its fades start there (F4) */
/* where the prompt box's partner is (layout.js promptFollow glues the box one gap from it): the plate as it is on screen
   — in a tab switch too, so the box rides it (B23) — except in a layout switch, where the box doesn't travel but fades
   through (DEVLOG DD-2026-11-07-6): there its partner is the plate where it lands. ONE answer, from the switch's owner */
/** @type {{ l: number, t: number, w: number, h: number } | null} */
let landing = null;
/** @returns {{ left: number, right: number, top: number, bottom: number, width: number, height: number }} */
export function glueRect() {
  if (!landing) return $("plate").getBoundingClientRect();
  const b = landing;
  return { left: b.l, right: b.l + b.w, top: b.t, bottom: b.t + b.h, width: b.w, height: b.h };
}
/** @type {(() => void) | null} */
let leaveDone = null; // ends the running switch's leaving view (a new switch ends it at once)
/** @param {{ l: number, t: number, w: number, h: number }} at where the plate was on screen (plateBefore)
 * @param {Views | null} views the two views when the switch changes view; null: the same view (Generating ↔ the
 * Gallery — the frame moves by itself, as when browsing, and the plate follows it)
 * @param {boolean} [layout] a layout switch (T2b): the prompt box's partner is where the plate lands (glueRect)
 * @returns {{ t0: number, T: number, fd: ReturnType<typeof fades> }} the switch's start time (performance.now()'s
 * clock), its length, and its fades (the prompt box fades through on them in a layout switch) */
export function switchGlide(at, views, layout = false) {
  pending = false;
  /* only the picture changes (Gallery ↔ Generating, one view): a switch still running carries on from where it is — its
     views' fades and its leaving view on their clock, the plate's travel bent to the new goal (F3: this cancelled them,
     the leaving list cut 0.97 → 0 and the coming view 0 → 1 in one frame) */
  const picOnly = !views && !layout,
    /* a page still on screen from a switch this one interrupts, neither leaving nor coming now (a third tab mid-switch):
       it leaves too, from where it is — cancelled with its switch, it vanished (F4) */
    stray = views?.shown
      ? [...views.shown].filter(([v]) => v !== views.old && v !== views.neu).map(([v, s]) => ({ v, ...s }))
      : [],
    heldPic = frameBox(); // the picture's frame where it is — held again if its page is a stray (end() lets it go)
  if (!picOnly) {
    for (const a of switchAnims) a.cancel();
    switchAnims = [];
    if (leaveDone) leaveDone();
    barFlip = null;
  }
  landing = null;
  if (!views) {
    if (picOnly && moving("plate")) {
      const o = $("right").getBoundingClientRect(),
        to = goalBox();
      bend("plate", { l: o.left + to.l, t: o.top + to.t, w: to.w, h: to.h });
    } else put(target()); // the plate rides the frame from here (framebox.js → plateSync)
    if (!layout) {
      return { t0: performance.now(), T: 600, fd: fades({ A: 0, S: 0, T: 0 }) };
    }
    /* a layout switch on a picture page: the frame crops and reveals itself (morph.js — the old picture at its old size
       crossing to the new at its own: the same picture changing size never pops), the plate rides it; this switch only
       says where the plate lands (the box's partner) and how long, on the frame's steps */
    const o = $("right").getBoundingClientRect(),
      to = goalBox(),
      toS = { l: o.left + to.l, t: o.top + to.t, w: to.w, h: to.h },
      st = shapeSteps(at, toS),
      t0 = performance.now(),
      done = () => {
        if (leaveDone !== done) return;
        leaveDone = null;
        landing = null;
      };
    landing = toS;
    leaveDone = done;
    const last = $("plate").animate([], { duration: Math.max(1, st.T) });
    last.startTime = t0;
    switchAnims.push(last);
    last.onfinish = last.oncancel = done;
    return { t0, T: st.T, fd: fades(st) };
  }
  const h = document.documentElement,
    o = $("right").getBoundingClientRect(),
    to = goalBox(),
    toS = { l: o.left + to.l, t: o.top + to.t, w: to.w, h: to.h }, // on screen
    same = views.old === views.neu; // a layout switch's panel: one view, riding the plate to where the layout puts it
  const dropWas = $("plate").classList.contains("drop");
  put(to); // its look for where it goes (a panel's glass, the drop line); its box is the driver's from here
  /* the plate TRAVELS on the one driver (rearrange.js, T2c-3b): from where it was on screen to where it belongs, on the
     plan's clock — written by its own write (put) every frame; what rides it follows its live box after (the views
     and their clip, the tab bar). It had keyframes of its own, sampled every 8 ms in advance (and the rim, the bar and
     the views each a set of their own) */
  /** the plate's box on screen as last written (what rides it reads it: no layout read per frame) */
  let live = { ...at };
  const writePlate = (/** @type {{ l: number, t: number, w: number, h: number }} */ b) => {
    live = b;
    put({ l: b.l - o.left, t: b.t - o.top, w: b.w, h: b.h, panel: to.panel });
  };
  travel("plate", at, toS, writePlate);
  writePlate(at); // its first box now, before anything is painted
  const fl = flush(),
    steps = fl ? fl.plan : shapeSteps(at, toS), // the one choreography: crop, swap, reveal (layoutmath.js)
    T = Math.max(1, steps.T),
    t0 = fl ? fl.t0 : performance.now(), // the driver's clock: every fade of the switch starts on it
    /** @type {{ duration: number, easing: string, fill: FillMode }} */
    timing = { duration: T, easing: "linear", fill: "backwards" },
    /** one clock: every animation of the switch starts at t0 */
    go = (/** @type {Animation} */ a) => {
      a.startTime = t0;
      switchAnims.push(a);
      return a;
    };
  /* PNG Info's drop line leaving with its panel: it fades across the crop, to the swap (its own 150 ms fade at the
     start read as vanishing, the user, 2026-10-28); coming in, its own fade is the one the user liked */
  if (dropWas && !$("plate").classList.contains("drop"))
    for (const a of fade(
      $("plate"),
      0,
      { duration: Math.max(steps.A + steps.S, 1), easing: "ease-in", fill: "backwards" },
      { pseudo: "::after", from: 1 },
    ))
      go(a);
  /* the plate's look changing with it (a panel's glass and ring coming in) and the selected tab's pill: their own CSS
     transitions, put on the switch's clock (they began a frame later) */
  for (const el of [$("plate"), $("rim"), $("thumb")]) {
    void getComputedStyle(el).boxShadow; // starts the transitions the change above set off
    for (const a of el.getAnimations()) if (a instanceof CSSTransition) a.startTime = t0;
  }
  /* the tab bar over the plate all the way (placeBar, its one writer), starting where its buttons were on screen */
  const tb = /** @type {HTMLElement} */ (document.querySelector(".tabs")),
    goal = barFor(tb, { left: toS.l, right: toS.l + toS.w, top: toS.t });
  setBar(tb, goal.x, goal.y);
  const now = $("seg").getBoundingClientRect(),
    fx = barBefore ? Math.round(goal.x + barBefore.left - now.left) : goal.x,
    fy = barBefore ? Math.round(goal.y + barBefore.top - now.top) : goal.y,
    start0 = barFor(tb, { left: at.l, right: at.l + at.w, top: at.t });
  barFlip = { dx: fx - start0.x, dy: fy - start0.y };
  placeBar();
  /* the two views, live (no snapshots: glass, the picture's arrows and buttons stay real — a View Transition's
     pictures of them blinked, 2026-10-28). The leaving one stays where it was on screen at its size (its contents
     don't reflow), the coming one where it belongs; both inside the plate as it glides (1 px in, so its rim shows),
     crossing at the swap */
  const { old, oldRect, neu } = views,
    rp = $("rpanel").getBoundingClientRect(),
    rpanel = $("rpanel");
  if (layout) landing = toS; // the box's partner: the plate where it lands (the box fades through, it doesn't ride)
  /** a leaving page stays where it was on screen at its size (its contents don't reflow) @param {HTMLElement} v
   * @param {DOMRect} r */
  const pin = (v, r) => {
    const s = v.style;
    v.classList.add("leaving");
    s.left = r.left - rp.left - rpanel.clientLeft + "px";
    s.top = r.top - rp.top - rpanel.clientTop + "px";
    s.width = r.width + "px";
    s.height = r.height + "px";
    s.right = s.bottom = "auto";
  };
  if (!same) pin(old, oldRect);
  for (const { v, r } of stray) {
    pin(v, r);
    if (v.id === "v-gen" && heldPic) frameHold(heldPic); // its picture stays where it is while it leaves
  }
  h.classList.add("switching");
  const nr = neu.getBoundingClientRect(),
    /** the plate's box (on screen) as an inset of a view's box, 1 px inside */
    /** the plate's box b (on screen) as a clip of the box v */
    inset = (/** @type {DOMRect} */ v, /** @type {{ l: number, t: number, w: number, h: number }} */ b) =>
      `inset(${[b.t - v.top, v.right - (b.l + b.w), v.bottom - (b.t + b.h), b.l - v.left]
        .map(x => Math.max(0, x).toFixed(1) + "px")
        .join(" ")} round var(--r-panel))`,
    /* the picture's view: the picture is what the plate crops (the frame); what sits round it outside the plate — the
       edit buttons, the status row, Show prompt, the arrows — fades on its own, quickly: out at the start, in as the
       plate lands (clipped, they were cut off at the first frame) */
    pic = (/** @type {HTMLElement} */ v) => v.id === "v-gen",
    around = () => [$("gtools"), $("prog"), $("showP"), $("cbtn"), $("bclose")],
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
    /* a layout switch's panel (one view): its contents RIDE their pane (DEVLOG DD-2026-11-08-2) — laid out at their
       final place and size, kept on the plate's centre and clipped by it: a pure move just travels, a size change crops
       and reveals them (the picture's rule, morph.js). Contents fade only when they are other contents (a tab switch) */
    rides = /** @type {[HTMLElement, DOMRect, number[]][]} */ (
      same
        ? [[neu, nr, centre(toS)]] // (its start: where it was on screen, oldRect — `lead` below)
        : [
            [old, oldRect, centre(at)],
            [neu, nr, centre(toS)],
            ...stray.map(s => /** @type {[HTMLElement, DOMRect, number[]]} */ ([s.v, s.r, centre(at)])),
          ]
    );
  /* every frame, after the plate's write: each view on the plate's live centre, clipped by its live box (T2c-3b: a
     follower of the plate, on the driver's frame — it was a set of keyframes per view, sampled in advance) */
  /* a layout switch's one view starts where it WAS on screen (its old place, oldRect) and lands where it belongs: its
     offset is the start's, times how far the plate's centre still has to go on that axis (the plan's progress where the
     centre doesn't move) — so it travels in step with its plate and never past. Centred on the old plate from the first
     frame, a resized Queue jumped ~71 px (2026-11-09: the tracer saw it once the views became the driver's writes); on
     the plan's progress number it drifted 7 px out and back (the plate's height and centre don't advance in exact
     proportion to it). A tab switch's views ride the plate's centre (they are where they are already) */
  const start = [oldRect.left - nr.left, oldRect.top - nr.top],
    left = (/** @type {number} */ i, /** @type {number[]} */ c, /** @type {number} */ q) => {
      const a0 = centre(at)[i],
        a1 = centre(toS)[i];
      return Math.abs(a1 - a0) < 0.5 ? 1 - q : Math.min(1, Math.max(0, (a1 - c[i]) / (a1 - a0)));
    },
    ride = () => {
      const q = progressXY("plate"),
        c = centre(live);
      for (const [v, r, anchor] of rides) {
        const dx = same ? start[0] * left(0, c, q[0]) : c[0] - anchor[0],
          dy = same ? start[1] * left(1, c, q[1]) : c[1] - anchor[1],
          box = pic(v) ? fr : r, // what the plate crops: the picture in its view, else the whole view
          moved = new DOMRect(box.left + dx, box.top + dy, box.width, box.height);
        v.style.transform = `translate(${dx}px, ${dy}px)`;
        (pic(v) ? $("frame") : v).style.clipPath = inset(moved, live);
      }
    };
  const letGo = follow(ride),
    unride = () => {
      letGo();
      for (const [v] of rides) {
        v.style.transform = "";
        (pic(v) ? $("frame") : v).style.clipPath = "";
      }
    };
  /* only out, from what they are now: shown by hover (the edit buttons, the arrows) or by state (the status row,
     Show prompt), a switch never shows them — faded in by it, or out from fully shown, they blinked (the user,
     2026-10-28: "the only reason for them to be shown is hovering the picture") */
  /* everything that leaves fades out across the crop, easing in, gone by the swap — the edit buttons and arrows like
     PNG Info's drop line (in 150 ms they read as disintegrating, the user, 2026-10-28) */
  const leave = { duration: Math.max(1, steps.A + steps.S), easing: "ease-in", fill: /** @type {FillMode} */ ("both") };
  if (pic(old))
    for (const el of [...around(), ...navs()]) {
      if (seenNow(el) > 0.01) for (const a of fade(el, 0, leave, { glass: true })) go(a); // from what is on screen
    }
  /* coming in, what state shows (the status row, Show prompt) fades in as the plate lands; the edit buttons wait for
     hover */
  if (pic(neu))
    for (const el of [$("prog"), $("showP")]) {
      const now = seenNow(el);
      if (now > 0.01) for (const a of fade(el, now, timing, { glass: true, from: 0, span: [1 - Q, 1] })) go(a);
    }
  /* ONE FADE SPEED for a view's contents, in every switch (2026-10-31, the user: "one fade speed everywhere"): they
     leave in the MORPH.fade ms that end at the swap (from the first frame, if the swap comes sooner) and come in the
     MORPH.fade ms that start at it, linearly — a panel, a picture and its glow alike. Where the shape doesn't change the
     swap is at the start and the two overlap: the cross-fade (Queue ↔ PNG Info, the speed the user liked); where it
     does, a fade-through (Material's pattern for unrelated contents). The plate's crop and reveal keep their own steps;
     the switch runs on until the fade-in ends, on the same clock. (A picture cut in the swap's 80 ms, and a decelerating
     fade-in of its own, read as two speeds) */
  const fd = fades(steps), // the one formula (layoutmath.js) — the frame's pictures fade by it too (pictures.js)
    TT = Math.max(T, fd.T), // the switch's length, its fade-in included
    goOut = { ...fd.out, easing: "linear", fill: /** @type {FillMode} */ ("both") },
    comeIn = { ...fd.in, easing: "linear", fill: /** @type {FillMode} */ ("both") };
  /* the view's contents: out and in, as ONE layer — one opacity on the view, one clock: a page is content, and content
     fades as one, with whatever it draws a frame later (DEVLOG DD-2026-11-08-12: faded by its parts, a page's list of
     parts was a snapshot — rows drawn after the switch began showed at once, the user: "plates of the queue items are
     there right away"). The same view (a layout switch) stays shown, it only rides. Glass inside a page loses its
     blur under this fade: the layering rule — content holds no material — is ux-review/17-t2-motion.md T2c */
  /* from what is on screen (F4): a page caught mid-switch carries on from its opacity there — never restarted from 1 / 0 */
  const shownO = (/** @type {HTMLElement} */ v, /** @type {number} */ d) =>
      views.shown ? (views.shown.get(v)?.o ?? 0) : d, // not in it: not on screen
    out = go(same ? old.animate([], goOut) : fade(old, 0, goOut, { from: shownO(old, 1) })[0]);
  for (const { v, o } of stray) for (const a of fade(v, 0, goOut, { from: o })) go(a);
  /* the picture's glow lives outside its view (a fixed layer): it comes and goes with the picture, on its fade (no glass
     in it, and at 0 between pictures: a plain fade — fade.js would skip what rests at 0) */
  const fg = document.getElementById("fglow");
  if (fg && pic(neu) !== pic(old))
    for (const a of fade(fg, pic(neu) ? 1 : 0, pic(neu) ? comeIn : goOut, { from: pic(neu) ? 0 : 1 })) go(a);
  if (!same) for (const a of fade(neu, 1, comeIn, { from: shownO(neu, 0) })) go(a);
  /* the leaving view goes when the switch ends (or a new switch begins): hidden, back in its place */
  const end = () => {
    if (leaveDone !== end) return;
    leaveDone = null;
    landing = null; // the box glued to the plate as it is again
    for (const v of same ? stray.map(s => s.v) : [old, ...stray.map(s => s.v)]) {
      v.classList.remove("leaving");
      for (const p of ["left", "top", "width", "height", "right", "bottom"]) v.style.removeProperty(p);
    }
    h.classList.remove("switching");
    unride(); // the views back in their places, unclipped
    frameHold(null); // the picture's frame (if its view left) to where the layout wants it
    /* the switch's own animations end with it: kept (filling), they piled up holding the views' last looks */
    for (const a of switchAnims) a.cancel();
    switchAnims = [];
  };
  leaveDone = end;
  const last = go(old.animate([], { duration: TT })); // the switch's length, no effect of its own
  last.onfinish = last.oncancel = out.oncancel = end;
  return { t0, T: TT, fd };
}
