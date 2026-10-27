// @ts-check
/* Kiln · the picture's crop-and-reveal when its shape changes: each edge moves once, on its own timeline */
import { $ } from "./dom.js";

/* a picture of another shape: CROP, then REVEAL (2026-10-19, the user's design; per edge since 2026-10-27). Both
   pictures sit at their own final size: only the frame moves. 1) every edge that moves IN crops the old picture (it is
   never squeezed); 2) at the overlap of the two pictures the new one takes over (a short cross-fade); 3) every edge that
   moves OUT reveals more of the new one. An edge that stays where it is never moves — switching between two
   full-height pictures, only the sides do (it used to close in on a box 12 % smaller than needed, so the height dipped
   on every switch, the user's note). A step with nothing to do takes no time. Nothing is ever empty: the box is inside
   the old picture until the swap and inside the new one after it */
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
/* the crop and the reveal run on the SCREEN: the panel the frame sits in may be gliding (the pair re-centring), and a
   morph written in the panel's coordinates drifted with it — lopsided. Each frame the box is placed on screen and the
   panel's current offset taken off. The target is read from the frame's data (sizeFrame keeps it there while a morph
   runs, so a re-layout mid-way just updates where it lands) */
/** @param {{ w: number, h: number, l: number, t: number }} o where the picture was (its old box, in its panel) */
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
  /* the four edges, old and new (in the panel; both pictures move with it alike): which way does each go? */
  const edges = (/** @type {{ w: number, h: number, l: number, t: number }} */ b) => [b.l, b.t, b.l + b.w, b.t + b.h],
    E0 = edges(o),
    E1 = edges(n0),
    dirIn = [E1[0] > E0[0], E1[1] > E0[1], E1[2] < E0[2], E1[3] < E0[3]], // moves in = crops the old picture
    moves = E0.map((v, i) => Math.abs(E1[i] - v) > 0.5),
    crop = moves.some((m, i) => m && dirIn[i]),
    reveal = moves.some((m, i) => m && !dirIn[i]);
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
  /* the old box on screen, where the morph started (the panel may glide under it from here on) */
  const st0 = $("stage").getBoundingClientRect(),
    O = [E0[0] + st0.left, E0[1] + st0.top, E0[2] + st0.left, E0[3] + st0.top];
  (function step(now) {
    const e = now - t0,
      st = $("stage").getBoundingClientRect(),
      n = T0();
    f.style.setProperty("--nw", px(n.w));
    f.style.setProperty("--nh", px(n.h));
    const N = [n.l + st.left, n.t + st.top, n.l + n.w + st.left, n.t + n.h + st.top],
      pA = A ? eA(Math.min(1, e / A)) : 1,
      pB = B ? eB(Math.min(1, Math.max(0, e - A - S) / B)) : 1,
      /* each edge on its own step: in = during the crop, out = during the reveal */
      Bx = O.map((v, i) => v + (N[i] - v) * (dirIn[i] ? pA : pB));
    if (e < T) {
      f.style.left = px(Bx[0] - st.left);
      f.style.top = px(Bx[1] - st.top);
      f.style.width = px(Bx[2] - Bx[0]);
      f.style.height = px(Bx[3] - Bx[1]);
      /** @type {any} */ (frameMorph).raf = requestAnimationFrame(step);
    } else {
      f.classList.remove("morph");
      f.style.left = px(n.l);
      f.style.top = px(n.t);
      f.style.width = px(n.w);
      f.style.height = px(n.h);
    }
  })(t0);
}
