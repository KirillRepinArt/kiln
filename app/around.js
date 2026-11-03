// @ts-check
/* Kiln · what sits around the picture frame follows the frame — one owner (2026-10-28). The status row (#prog), "Show
   prompt" (#showP), the edit buttons (#gtools) and the edge strips (#hedges) have no motion of their own: they are placed
   from where the frame IS, every frame anything moves (the plate's follow loop, a crop-and-reveal's steps, sizeFrame).
   They used to be placed at the frame's TARGET with CSS glides of their own (or none): on a crop-and-reveal the frame
   moved frame by frame and they jumped to the end or slid on another clock */
import { $, offsetIn } from "./dom.js";
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
  if (!b) return placeSideEdges(null); // not laid out yet (a panel's handles need no frame)
  const M = SPACE.mat, // measured from the plate (the picture and its mat): the edge you see
    l = b.l - M,
    t = b.t - M,
    w = b.w + 2 * M,
    h = b.h + 2 * M;
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
  placeSideEdges({ l, t, w, h });
}

/* the page's side handles side by side (.pedge.ri by the prompt, .pedge.ro on the outer side): each a strip on its
   pane's side, as long as that side (B11; they ran the column's height, 64–406 px past the picture or a shortened panel).
   ONE writer of their rect: a picture's from the plate as it is this frame (they glide with it — they used to jump to
   the target); a panel's from its box, laid out by sizeFrame (its one owner, as for its top / bottom handles) */
/** @param {{ l: number, t: number, w: number, h: number } | null} plate the plate, the stage's coordinates */
function placeSideEdges(plate) {
  const app = /** @type {HTMLElement} */ (document.querySelector(".app")),
    rt = $("right"),
    rp = $("rpanel"),
    ri = /** @type {HTMLElement | null} */ (rt.querySelector(".pedge.ri")),
    ro = /** @type {HTMLElement | null} */ (rt.querySelector(".pedge.ro"));
  if (!ri || !ro) return;
  const put = (/** @type {HTMLElement} */ e, /** @type {Record<string, string>} */ v) => {
    for (const k of ["left", "right", "top", "height"])
      if (e.style.getPropertyValue(k) !== (v[k] ?? "")) e.style.setProperty(k, v[k] ?? "");
  };
  if (app.classList.contains("stacked")) return (put(ri, {}), put(ro, {})); // Vertical: hidden (its own: .hedge, .vpedge)
  if (rp.classList.contains("paneled")) {
    /* a panel: its box's top and height; across, the CSS places them on the area's sides (the panel is the area) */
    const o = offsetIn(rp, rt),
      v = { top: o.y + "px", height: rp.offsetHeight + "px" };
    return (put(ri, v), put(ro, v));
  }
  if (!plate) return;
  const { l, t, w, h } = plate;
  /* a picture: the plate in the area's coordinates; the outer strip 6 px past the outline,
     the inner one reaching the outline from the gap (as before) */
  const o = offsetIn($("stage"), rt),
    L = o.x + l,
    R = L + w,
    v = { top: o.y + t + "px", height: h + "px", right: "auto" },
    outerLeft = app.classList.contains("pright"); // Right: the picture's outer side is its left
  put(ro, { ...v, left: (outerLeft ? L - 6 : R + 6 - ro.offsetWidth) + "px" });
  put(ri, { ...v, left: (outerLeft ? R + SPACE.part - ri.offsetWidth : L - SPACE.part) + "px" });
}
