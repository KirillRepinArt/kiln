// @ts-check
/* Kiln · the picture's crop-and-reveal when its shape changes: each axis moves once, on its own step */
import { $ } from "./dom.js";
import { MORPH, shapeBox, shapeSteps } from "./layoutmath.js";
import { overlayRelease, overlayShows, pictureIn } from "./pictures.js";
import { frameDrive, setPictureMorph } from "./framebox.js";
import { stageRect } from "./layout.js";

/* a picture of another shape: the one choreography (layoutmath.js shapeSteps) — crop, swap, reveal; only the frame
   moves, both pictures at their own final size, centred. Nothing is ever empty: the box is inside the old picture
   until the swap and inside the new one after it */
/* the area the picture sits in doesn't move when its shape changes (2026-10-31, G6): the old guess of where its gliding
   grid would end (areaLeftAtEnd) is gone — the morph aims at the stage where it is */
/* the crop and the reveal run on the SCREEN: the panel the frame sits in may be gliding (the pair re-centring), and a
   morph written in the panel's coordinates drifted with it — lopsided. Each frame the box is placed on screen and the
   panel's current offset taken off. The target is read from the frame's data (sizeFrame keeps it there while a morph
   runs, so a re-layout mid-way just updates where it lands) */
/** @param {{ w: number, h: number, l: number, t: number, x?: number, y?: number }} o where the picture was: its old box
 * in its panel, and (x, y) its top-left on screen, measured before the switch moved anything */
export function frameMorph(o) {
  const f = $("frame");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  /** the target box sizeFrame keeps on the frame (data-tw/th/tl/tt) */
  const T0 = () => ({
      w: +(/** @type {string} */ (f.dataset.tw)),
      h: +(/** @type {string} */ (f.dataset.th)),
      l: +(/** @type {string} */ (f.dataset.tl)),
      t: +(/** @type {string} */ (f.dataset.tt)),
    }),
    n0 = T0();
  if (!(n0.w > 0 && n0.h > 0 && o.w > 0 && o.h > 0)) return false;
  const { A, T, q } = shapeSteps(o, n0),
    px = (/** @type {number} */ v) => v + "px";
  f.style.setProperty("--ow", px(o.w));
  f.style.setProperty("--oh", px(o.h));
  f.style.setProperty("--nw", px(n0.w));
  f.style.setProperty("--nh", px(n0.h));
  f.classList.add("morph");
  const t0 = performance.now();
  /* the pictures change at the swap by the ONE fade's length (layoutmath.js MORPH.fade), on the frame's clock (t0), by
     their owner (pictures.js). They STACK — the old one (its copy) over the new — so it's a cross-fade: the new one is
     laid under the old at the swap and the old fades off it; nothing ever shows less picture (fading one out and the
     other in, like two views, dipped the frame to ~36 % picture mid-change — the tracer, 2026-10-31). With no old
     picture (an empty frame) the new one fades in itself from the swap; either way it's held unseen until then, so it
     never shows cropped through the crop ("a zoomed picture first"). It used to swap them in its own 80 ms: a cut (F1) */
  const F = MORPH.fade,
    fg = document.getElementById("fglow");
  if (overlayShows()) {
    pictureIn({ delay: A, duration: 0, startTime: t0 }); // under the old one: seen as the old one fades off it
    overlayRelease({ delay: A, duration: F, startTime: t0 });
  } else {
    pictureIn({ delay: A, duration: F, startTime: t0 });
    /* the glow is its picture's: with no old picture on show it comes in with the new one — the same fade, the same
       clock (copied from the picture's opacity every frame by the effects loop, it ran a frame ahead) */
    if (fg)
      fg.animate([{ opacity: 0 }, { opacity: 1 }], {
        delay: A,
        duration: F,
        easing: "linear",
        fill: "backwards",
      }).startTime = t0;
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
    /* each axis moves its CENTRE and its SIZE on one clock (edge by edge, one side rode the area's glide and the other
       the crop — lopsided, the user, 2026-10-27) */
    const b = shapeBox(O, { l: st.left + n.l, t: st.top + n.t, w: n.w, h: n.h }, q(e));
    if (e < T) return { l: b.l - st.left, t: b.t - st.top, w: b.w, h: b.h };
    /* landed, but the old picture may still be fading off the new one (the fade outlasts a short reveal): the box holds
       at its goal and both pictures keep their own sizes until then — let go, the old copy stretched to the frame */
    if (e < A + MORPH.fade) return { l: n.l, t: n.t, w: n.w, h: n.h };
    f.classList.remove("morph");
    return null; // landed: the owner puts the frame at its goal
  });
  return true;
}
/* start-up wiring: the frame's owner calls it when a picture change gives the frame a new box (framebox.js
   pictureChange; called from main.js, in order) */
export function initMorph() {
  setPictureMorph(frameMorph);
}
