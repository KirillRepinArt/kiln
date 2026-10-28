// @ts-check
/* Kiln · the picture's crop-and-reveal when its shape changes: each axis moves once, on its own step */
import { $ } from "./dom.js";
import { shapeBox, shapeSteps } from "./layoutmath.js";
import { overlayGone } from "./pictures.js";
import { frameDrive } from "./framebox.js";
import { stageRect } from "./layout.js";

/* a picture of another shape: the one choreography (layoutmath.js shapeSteps) — crop, swap, reveal; only the frame
   moves, both pictures at their own final size, centred. Nothing is ever empty: the box is inside the old picture
   until the swap and inside the new one after it */
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
  const { A, S, T, q } = shapeSteps(o, n0),
    px = (/** @type {number} */ v) => v + "px";
  f.style.setProperty("--ow", px(o.w));
  f.style.setProperty("--oh", px(o.h));
  f.style.setProperty("--nw", px(n0.w));
  f.style.setProperty("--nh", px(n0.h));
  f.classList.add("morph");
  const t0 = performance.now();
  /* the new picture comes in at the swap: until then the box shows the old one (cropped) — with no old picture (an
     empty frame) the new one showed cropped through the crop, "a zoomed picture first". Browsing never showed it: the
     old picture covered it */
  /* on the frame's clock (t0): started on the next frame instead, the picture came in a frame early for its box — 15 to
     26 px of bare glass above and below it, where the crop is steepest */
  $("cv").animate(
    [{ opacity: 0 }, { opacity: 0, offset: A / T }, { opacity: 1, offset: (A + S) / T }, { opacity: 1 }],
    { duration: T, fill: "backwards" }, // held at its first keyframe until t0
  ).startTime = t0;
  /* the glow is its picture's: with no old picture on show it comes in with the new one — the same keyframes, the same
     clock (copied from the picture's opacity every frame by the effects loop, it ran a frame ahead) */
  const fg = document.getElementById("fglow");
  if (fg && !(x && /** @type {HTMLCanvasElement} */ (x).width > 1))
    fg.animate([{ opacity: 0 }, { opacity: 0, offset: A / T }, { opacity: 1, offset: (A + S) / T }, { opacity: 1 }], {
      duration: T,
      fill: "backwards",
    }).startTime = t0;
  /* the old picture (on its own canvas) fades out across the swap */
  if (x) {
    x.dataset.morph = "1";
    x.getAnimations().forEach(q => q.cancel());
    const xa = x.animate(
      [
        { opacity: 1 },
        { opacity: 1, offset: A / T },
        { opacity: 0, offset: (A + S) / T, easing: "ease-in-out" },
        { opacity: 0 },
      ],
      { duration: T, fill: "both" },
    );
    xa.startTime = t0;
    xa.onfinish = () => {
      x.style.opacity = "0";
      delete x.dataset.morph;
      x.getAnimations().forEach(q => q.cancel());
      overlayGone();
    };
  }
  const st0 = stageRect(),
    /* the old box on screen, measured before the change: right after a tab switch the layout jumps instead of gliding,
       and the old box placed in the NEW area showed the old picture 261 px off for the first frames (2026-10-27) */
    O = { l: o.x ?? st0.left + o.l, t: o.y ?? st0.top + o.t, w: o.w, h: o.h };
  /* the frame's owner (framebox.js) asks for the box every frame and writes it — the plate and what sits round the
     frame follow from there; a new crop-and-reveal replaces this one */
  frameDrive(now => {
    const e = now - t0,
      st = stageRect(),
      n = T0();
    f.style.setProperty("--nw", px(n.w));
    f.style.setProperty("--nh", px(n.h));
    const aL = areaLeftAtEnd(),
      sL = aL == null ? st.left : aL + (st.left - $("right").getBoundingClientRect().left), // the area's left, at the end
      /* each axis moves its CENTRE and its SIZE on one clock (the area hugs the picture and glides with it: edge by edge,
         one side rode the area's glide and the other the crop — lopsided, the user, 2026-10-27) */
      b = shapeBox(O, { l: sL + n.l, t: st.top + n.t, w: n.w, h: n.h }, q(e));
    if (e < T) return { l: b.l - st.left, t: b.t - st.top, w: b.w, h: b.h };
    f.classList.remove("morph");
    return null; // landed: the owner puts the frame at its goal
  });
}
