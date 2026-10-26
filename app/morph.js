// @ts-check
/* Kiln · the picture's crop-and-reveal when its shape changes: one continuous move on its own timeline */
import { $ } from "./dom.js";

/* a picture of another shape: CROP, then REVEAL (2026-10-19, the user's design). 1) the frame closes in on the picture
   on show to the new picture's shape — the largest such box inside it, centred: the old picture is cropped, never
   squeezed, so nothing is ever empty; 2) at that box the new picture takes over (a short cross-fade: same shape now);
   3) the frame opens out to the new picture's size, revealing more of it. Both pictures sit at their own final size,
   centred: only the frame moves. ~180 ms accelerating + 80 ms seam + 280 ms decelerating (sequential motion) */
const MORPH = {
  a: 180,
  s: 80,
  b: 280,
  k: 0.88,
  T: 520,
}; /* k: the middle box is a little smaller than the largest that fits — the path curves inward (an iris closing a touch past what's needed); inside the old picture, so never a hole */
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
const eCrop = bez(
  0.2,
  0.6,
  0.3,
  1,
); /* eCrop: the box reaches the middle in ~¼ of the time (the user: the contraction ×2), then opens out slowly */
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
  const st0 = $("stage").getBoundingClientRect(),
    r = n0.w / n0.h;
  let aw = o.w,
    ah = o.w / r;
  if (ah > o.h) {
    ah = o.h;
    aw = o.h * r;
  }
  aw *= MORPH.k;
  ah *= MORPH.k;
  const O = { l: st0.left + o.l, t: st0.top + o.t, w: o.w, h: o.h },
    M = { l: O.l + (o.w - aw) / 2, t: O.t + (o.h - ah) / 2, w: aw, h: ah },
    T = MORPH.T,
    k1 = 0.12,
    k2 = 0.36,
    px = (/** @type {number} */ v) => v + "px";
  cancelAnimationFrame(/** @type {any} */ (frameMorph).raf); // the running morph, kept on the function
  f.style.setProperty("--ow", px(o.w));
  f.style.setProperty("--oh", px(o.h));
  f.style.setProperty("--nw", px(n0.w));
  f.style.setProperty("--nh", px(n0.h));
  f.classList.add("morph");
  const t0 = performance.now();
  if (x) {
    x.dataset.morph = "1";
    x.getAnimations().forEach(q => q.cancel());
    x.animate(
      [{ opacity: 1 }, { opacity: 1, offset: k1 }, { opacity: 0, offset: k2, easing: "ease-in-out" }, { opacity: 0 }],
      { duration: T, fill: "forwards" },
    ).onfinish = () => {
      x.style.opacity = "0";
      delete x.dataset.morph;
      x.getAnimations().forEach(q => q.cancel());
    };
  }
  /* ONE continuous move (2026-10-19): the box travels a curve from the old picture toward the middle box — a pull point,
    never a stop — and on to the new picture's place. A quadratic path in screen space; the time eased gently at both ends;
    the old picture fades out round the middle. The box stays inside the old picture early and inside the new one late,
    so no corner is ever empty */
  (function step(now) {
    const e = now - t0,
      st = $("stage").getBoundingClientRect(),
      n = T0();
    f.style.setProperty("--nw", px(n.w));
    f.style.setProperty("--nh", px(n.h));
    const u = eCrop(Math.min(1, e / T)),
      N = { l: st.left + n.l, t: st.top + n.t, w: n.w, h: n.h },
      q = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ c) =>
        (1 - u) * (1 - u) * a + 2 * u * (1 - u) * b + u * u * c;
    const B = { l: q(O.l, M.l, N.l), t: q(O.t, M.t, N.t), w: q(O.w, M.w, N.w), h: q(O.h, M.h, N.h) };
    if (e < T) {
      f.style.left = px(B.l - st.left);
      f.style.top = px(B.t - st.top);
      f.style.width = px(B.w);
      f.style.height = px(B.h);
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
