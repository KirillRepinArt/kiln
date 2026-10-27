// @ts-check
/* Kiln · the picture's crop-and-reveal when its shape changes: each axis moves once, on its own step */
import { $ } from "./dom.js";

/* a picture of another shape: CROP, then REVEAL (2026-10-19, the user's design; per axis since 2026-10-27). Both
   pictures sit at their own final size, centred: only the frame moves. 1) an axis that shrinks crops the old picture
   (it is never squeezed); 2) at the overlap of the two pictures the new one takes over (a short cross-fade); 3) an axis
   that grows reveals more of the new one. An axis that keeps its size never changes it — switching between two
   full-height pictures, only the width moves (it used to close in on a box 12 % smaller than needed, so the height
   dipped on every switch, the user's note). Each axis moves its centre with its size, so both sides go in or out alike.
   A step with nothing to do takes no time. Nothing is ever empty: the box is inside the old picture until the swap and
   inside the new one after it */
const MORPH = {
  a: 180, // the crop (accelerating into the swap)
  s: 80, // the cross-fade at the overlap
  b: 280, // the reveal (decelerating out of it)
  one: 320, // only a crop, or only a reveal: one move, eased at both ends
};
/* cubic-bezier easing as a function (for the frame's own timeline below) */
/** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @returns {(x: number) => number} */
function bez(x1, y1, x2, y2) {
  /** @typedef {(a: number, b: number) => number} AB @typedef {(t: number, a: number, b: number) => number} TAB */
  const A = /** @type {AB} */ ((a, b) => 1 - 3 * b + 3 * a),
    B = /** @type {AB} */ ((a, b) => 3 * b - 6 * a),
    C = (/** @type {number} */ a) => 3 * a,
    f = /** @type {TAB} */ ((t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t),
    d = /** @type {TAB} */ ((t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a));
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const g = d(t, x1, x2);
      if (Math.abs(g) < 1e-6) break;
      t -= (f(t, x1, x2) - x) / g;
    }
    return f(t, y1, y2);
  };
}
/* Material's emphasized curves: into the swap accelerating, out of it decelerating — with the swap between, it reads as
   one move; a lone crop or reveal is eased at both ends */
const eIn = bez(0.3, 0, 0.8, 0.15),
  eOut = bez(0.05, 0.7, 0.1, 1),
  eBoth = bez(0.2, 0, 0, 1);
/* where the picture area's left edge will be once the layout's glide ends (screen px), or null to follow it live. The
   area hugs the picture, so a shape change also glides the grid's columns; a morph aimed at the area's CURRENT place
   chased a moving target and overshot it by ~15 px, then came back (2026-10-27). The grid's columns are known: the
   prompt column, the gap, the picture column (--pw / --rw, set by the layout) and the margins either side, which share
   what's left unless set in px */
function areaLeftAtEnd() {
  const app = /** @type {HTMLElement | null} */ (document.querySelector(".app"));
  if (!app || app.classList.contains("stacked")) return null;
  const cs = getComputedStyle(app),
    v = (/** @type {string} */ n) => cs.getPropertyValue(n).trim(),
    pxOf = (/** @type {string} */ x) => (x.endsWith("px") ? parseFloat(x) : null),
    pw = parseFloat(v("--pw")),
    rw = parseFloat(v("--rw")),
    gap = parseFloat(v("--gap-area")),
    padL = parseFloat(cs.paddingLeft),
    inner = app.clientWidth - padL - parseFloat(cs.paddingRight);
  if (!(pw > 0 && rw > 0 && gap >= 0)) return null;
  let mL = pxOf(v("--mL")),
    mR = pxOf(v("--mR"));
  const shares = (mL == null ? 1 : 0) + (mR == null ? 1 : 0),
    free = Math.max(0, inner - pw - gap - rw - (mL || 0) - (mR || 0));
  if (mL == null) mL = shares ? free / shares : 0;
  return app.getBoundingClientRect().left + padL + mL + (app.classList.contains("pright") ? 0 : pw + gap);
}
/* the crop and the reveal run on the SCREEN: the panel the frame sits in may be gliding (the pair re-centring), and a
   morph written in the panel's coordinates drifted with it — lopsided. Each frame the box is placed on screen and the
   panel's current offset taken off. The target is read from the frame's data (sizeFrame keeps it there while a morph
   runs, so a re-layout mid-way just updates where it lands) */
/** @param {{ w: number, h: number, l: number, t: number, x?: number, y?: number }} o where the picture was: its old box
 * in its panel, and (x, y) its top-left on screen, measured before the switch moved anything */
export function frameMorph(o) {
  const f = $("frame"),
    x = $("cvx");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  /** the target box sizeFrame keeps on the frame (data-tw/th/tl/tt) */
  const T0 = () => ({
      w: +(/** @type {string} */ (f.dataset.tw)),
      h: +(/** @type {string} */ (f.dataset.th)),
      l: +(/** @type {string} */ (f.dataset.tl)),
      t: +(/** @type {string} */ (f.dataset.tt)),
    }),
    n0 = T0();
  if (!(n0.w > 0 && n0.h > 0 && o.w > 0 && o.h > 0)) return;
  /* per axis, which way does the picture go? Shrinks = crops the old picture, grows = reveals the new one */
  const shrink = [n0.w < o.w - 0.5, n0.h < o.h - 0.5],
    grow = [n0.w > o.w + 0.5, n0.h > o.h + 0.5],
    crop = shrink[0] || shrink[1],
    reveal = grow[0] || grow[1];
  const A = crop ? (reveal ? MORPH.a : MORPH.one) : 0,
    S = MORPH.s,
    B = reveal ? (crop ? MORPH.b : MORPH.one) : 0,
    T = A + S + B,
    eA = reveal ? eIn : eBoth,
    eB = crop ? eOut : eBoth,
    px = (/** @type {number} */ v) => v + "px";
  cancelAnimationFrame(/** @type {any} */ (frameMorph).raf); // the running morph, kept on the function
  f.style.setProperty("--ow", px(o.w));
  f.style.setProperty("--oh", px(o.h));
  f.style.setProperty("--nw", px(n0.w));
  f.style.setProperty("--nh", px(n0.h));
  f.classList.add("morph");
  const t0 = performance.now();
  /* the old picture (on its own canvas) fades out across the swap */
  if (x) {
    x.dataset.morph = "1";
    x.getAnimations().forEach(q => q.cancel());
    x.animate(
      [
        { opacity: 1 },
        { opacity: 1, offset: A / T },
        { opacity: 0, offset: (A + S) / T, easing: "ease-in-out" },
        { opacity: 0 },
      ],
      { duration: T, fill: "forwards" },
    ).onfinish = () => {
      x.style.opacity = "0";
      delete x.dataset.morph;
      x.getAnimations().forEach(q => q.cancel());
    };
  }
  /* the tab bar sits on the picture's top edge: during the morph it rides that edge frame by frame (its own glide ran
     ahead and crossed over the picture, the user's note 2026-10-27) */
  const tb = /** @type {HTMLElement | null} */ (document.querySelector(".tabs"));
  if (tb) {
    tb.style.setProperty("transition", "none", "important");
    if (tb.style.transform) tb.style.transform = `translate(${tb.dataset.dx || 0}px,${Math.round(Math.max(0, o.t))}px)`;
  }
  const st0 = $("stage").getBoundingClientRect(),
    /* the old box on screen, as [centre, size] per axis */
    O = [
      /* measured on screen before the change: right after a tab switch the layout jumps instead of gliding, and the old
         box placed in the NEW area showed the old picture 261 px off for the first frames (2026-10-27) */
      [(o.x ?? st0.left + o.l) + o.w / 2, o.w],
      [(o.y ?? st0.top + o.t) + o.h / 2, o.h],
    ];
  (function step(now) {
    const e = now - t0,
      st = $("stage").getBoundingClientRect(),
      n = T0();
    f.style.setProperty("--nw", px(n.w));
    f.style.setProperty("--nh", px(n.h));
    const aL = areaLeftAtEnd(),
      sL = aL == null ? st.left : aL + (st.left - $("right").getBoundingClientRect().left), // the area's left, at the end
      N = [
        [sL + n.l + n.w / 2, n.w],
        [st.top + n.t + n.h / 2, n.h],
      ],
      pA = A ? eA(Math.min(1, e / A)) : 1,
      pB = B ? eB(Math.min(1, Math.max(0, e - A - S) / B)) : 1,
      pAll = eBoth(Math.min(1, e / T)),
      /* each axis moves its CENTRE and its SIZE on one clock — the crop if it shrinks, the reveal if it grows, the whole
         move if only its place changes (the area hugs the picture and glides with it). Edge by edge, one side rode the
         area's glide and the other the crop: lopsided (the user, 2026-10-27: "not symmetrical") */
      Bx = O.map(([c, z], i) => {
        const q = shrink[i] ? pA : grow[i] ? pB : pAll;
        return [c + (N[i][0] - c) * q, z + (N[i][1] - z) * q];
      }),
      L = Bx[0][0] - Bx[0][1] / 2,
      Tp = Bx[1][0] - Bx[1][1] / 2;
    if (e < T) {
      f.style.left = px(L - st.left);
      f.style.top = px(Tp - st.top);
      f.style.width = px(Bx[0][1]);
      f.style.height = px(Bx[1][1]);
      if (tb && tb.style.transform)
        tb.style.transform = `translate(${tb.dataset.dx || 0}px,${Math.round(Math.max(0, Tp - st.top))}px)`;
      /** @type {any} */ (frameMorph).raf = requestAnimationFrame(step);
    } else {
      f.classList.remove("morph");
      f.style.left = px(n.l);
      f.style.top = px(n.t);
      f.style.width = px(n.w);
      f.style.height = px(n.h);
      if (tb) {
        if (tb.style.transform)
          tb.style.transform = `translate(${tb.dataset.dx || 0}px,${Math.round(Math.max(0, n.t))}px)`;
        tb.style.removeProperty("transition");
      }
    }
  })(t0);
}
