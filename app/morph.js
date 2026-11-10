// @ts-check
/* Kiln · the picture's crop-and-reveal when its shape changes: each axis moves once, on its own step */
import { $ } from "./dom.js";
import { fade } from "./fade.js";
import { MORPH, shapeSteps } from "./layoutmath.js";
import { overlayRelease, overlayShows, pictureIn } from "./pictures.js";
import { frameTravel, setPictureMorph } from "./framebox.js";
import { flush } from "./rearrange.js";
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
/** @param {{ w: number, h: number, l: number, t: number, x?: number, y?: number, scale?: boolean }} o where the picture was: its old box
 * in its panel, and (x, y) its top-left on screen, measured before the switch moved anything; scale: the same picture at
 * another size (a layout switch) */
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
  if (o.scale) {
    /* the same picture at another size (a layout switch): the frame travels on the driver and the picture fills it
       every frame — it scales with its pane (its ratio is fixed: exact); no copy, no swap, no fades. A crop-and-reveal
       still running lets go of its own sizes */
    morphs++;
    f.classList.remove("morph");
    const st = stageRect();
    frameTravel({ l: (o.x ?? st.left + o.l) - st.left, t: (o.y ?? st.top + o.t) - st.top, w: o.w, h: o.h }, n0);
    return true;
  }
  const px = (/** @type {number} */ v) => v + "px";
  f.style.setProperty("--ow", px(o.w));
  f.style.setProperty("--oh", px(o.h));
  f.style.setProperty("--nw", px(n0.w));
  f.style.setProperty("--nh", px(n0.h));
  f.classList.add("morph");
  const st0 = stageRect(),
    /* the old box on screen, measured before the change: right after a tab switch the layout jumps instead of gliding,
       and the old box placed in the NEW area showed the old picture 261 px off for the first frames (2026-10-27) */
    from = { l: (o.x ?? st0.left + o.l) - st0.left, t: (o.y ?? st0.top + o.t) - st0.top, w: o.w, h: o.h };
  /* the frame TRAVELS on the one driver (T2c-3b-2): each axis its centre and size on one clock (edge by edge, one side
     rode the area's glide and the other the crop — lopsided, the user, 2026-10-27), one plan with whatever else moves; a
     re-layout mid-way bends its path (framebox.js frameGoal → bend). Its own frame loop (frameDrive) is gone */
  frameTravel(from, n0);
  const fl = flush(),
    plan = fl ? fl.plan : shapeSteps(o, n0),
    A = plan.A,
    T = plan.T,
    t0 = fl ? fl.t0 : performance.now();
  /* the pictures change at the swap by the ONE fade's length (layoutmath.js MORPH.fade), on the driver's clock (t0), by
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
      for (const a of fade(fg, 1, { delay: A, duration: F, easing: "linear", fill: "backwards" }, { from: 0 }))
        a.startTime = t0;
  }
  /* landed, but the old picture may still be fading off the new one (the fade outlasts a short reveal): both pictures
     keep their own sizes until then (the frame holds at its goal: the driver landed it) — let go, the old copy stretched
     to the frame. A newer crop-and-reveal takes the frame over (its own end) */
  const me = ++morphs,
    end = f.animate([], { duration: Math.max(1, T, A + F) });
  end.startTime = t0;
  end.onfinish = () => {
    if (me === morphs) f.classList.remove("morph");
  };
  return true;
}
let morphs = 0; // crop-and-reveals started so far: only the latest lets the frame go
/* start-up wiring: the frame's owner calls it when a picture change gives the frame a new box (framebox.js
   pictureChange; called from main.js, in order) */
export function initMorph() {
  setPictureMorph(frameMorph);
}
