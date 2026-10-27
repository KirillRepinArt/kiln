// @ts-check
/* Kiln · what sits around the picture frame follows the frame — one owner (2026-10-28). The status row (#prog), "Show
   prompt" (#showP), the edit buttons (#gtools) and the edge strips (#hedges) have no motion of their own: they are placed
   from where the frame IS, every frame anything moves (the plate's follow loop, a crop-and-reveal's steps, sizeFrame).
   They used to be placed at the frame's TARGET with CSS glides of their own (or none): on a crop-and-reveal the frame
   moved frame by frame and they jumped to the end or slid on another clock */
import { $ } from "./dom.js";
import { frameBox } from "./framebox.js";
import { SPACE } from "./tokens.js";

/** @param {CSSStyleDeclaration} s @param {string} p @param {number} v */
function set(s, p, v) {
  const x = v + "px";
  if (s.getPropertyValue(p) !== x) s.setProperty(p, x);
}
/* the frame's LAYOUT box, as it is this frame (its glide and a crop-and-reveal included), in the stage's coordinates —
   the stage fills Generating's view, so the status row's too. Not getBoundingClientRect: that includes transforms, and
   the "done" pulse (a 1.2 % scale) would shake everything round it */
export function placeAround() {
  const b = frameBox();
  if (!b) return; // not laid out yet
  const { l, t, w, h } = b;
  const gt = $("gtools"),
    he = $("hedges"),
    pr = $("prog"),
    sp = $("showP"),
    tb = parseFloat(gt.style.width) || 0, // the button column's width: the layout's (sizeFrame)
    below = t + h + SPACE.part;
  set(he.style, "left", l);
  set(he.style, "top", t);
  set(he.style, "width", w);
  set(he.style, "height", h);
  set(gt.style, "left", gt.classList.contains("lefty") ? l - tb : l + w);
  set(gt.style, "top", t);
  set(gt.style, "height", Math.max(40, h));
  set(pr.style, "left", l);
  set(pr.style, "width", w);
  set(pr.style, "top", below);
  set(pr.style, "--tw", w);
  set(sp.style, "left", l + w / 2);
  set(sp.style, "top", below);
}
