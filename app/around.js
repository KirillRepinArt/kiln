// @ts-check
/* Kiln · what sits around the picture frame follows the frame — one owner (ARCHITECTURE › the picture frame's box).
   The status row (#prog), "Show prompt" (#showP), the edit buttons (#gtools) and the edge strips (#hedges) have no
   motion of their own: they are placed from where the frame IS, in the frame the frame is written (never at its target) */
import { $, offsetIn } from "./dom.js";
import { frameBox } from "./framebox.js";
import { placeNavs } from "./browse.js";
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
  placeNavs(); // the picture's arrows on its side edges (browse.js: the one you hold stays put)
  /* its controls on its top corners (the floating layer: the eye top right, ✕ top left — a part gap in) */
  const fr = $("frame").getBoundingClientRect(),
    eye = $("cbtn"),
    x = $("bclose");
  set(eye.style, "left", Math.round(fr.right - SPACE.part - 40));
  set(eye.style, "top", Math.round(fr.top + SPACE.part));
  set(x.style, "left", Math.round(fr.left + SPACE.part));
  set(x.style, "top", Math.round(fr.top + SPACE.part));
  const gt = $("gtools"),
    he = $("hedges"),
    pr = $("prog"),
    sp = $("showP"),
    tb = parseFloat(gt.style.width) || 0, // the button column's width: the layout's (sizeFrame)
    below = t + h + SPACE.part;
  /* the picture's edge strips: handles, in the floating layer over the page (#rpanel's own layer, above its controls —
     one home per strip): the stage's coordinates moved into #rpanel's */
  const so = offsetIn($("stage"), $("rpanel"));
  set(he.style, "left", l + so.x);
  set(he.style, "top", t + so.y);
  set(he.style, "width", w);
  set(he.style, "height", h);
  /* (the floating layer: the stage's coordinates on screen) */
  const st = $("stage").getBoundingClientRect();
  set(gt.style, "left", Math.round(st.left + (gt.classList.contains("lefty") ? l - tb : l + w)));
  set(gt.style, "top", Math.round(st.top + t));
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
   pane's side, as long as that side (B11). ONE writer of their rect: a picture's from the plate as it is this frame; a
   panel's from its box, laid out by sizeFrame (its one owner, as for its top / bottom handles) */
/** @param {{ l: number, t: number, w: number, h: number } | null} plate the plate, the stage's coordinates */
function placeSideEdges(plate) {
  const app = /** @type {HTMLElement} */ (document.querySelector(".app")),
    rt = $("right"),
    rp = $("rpanel"),
    ri = /** @type {HTMLElement | null} */ (rt.querySelector(".pedge.ri")),
    ro = /** @type {HTMLElement | null} */ (rt.querySelector(".pedge.ro"));
  if (!ri || !ro) return;
  const put = (/** @type {HTMLElement} */ e, /** @type {Record<string, string>} */ v) => {
    for (const k of ["left", "right", "top", "height", "width"])
      if (e.style.getPropertyValue(k) !== (v[k] ?? "")) e.style.setProperty(k, v[k] ?? "");
  };
  if (app.classList.contains("stacked")) {
    /* Vertical: hidden (its own: .hedge, .vpedge); a panel's top / bottom handles back on the column's width (CSS) */
    for (const e of [ri, ro, .../** @type {NodeListOf<HTMLElement>} */ (rt.querySelectorAll(".phedge"))]) put(e, {});
    return;
  }
  const outerLeft = app.classList.contains("pright"), // Right: the page's outer side is its left
    /* every pane's resize band, one rule (B19, layout.css): from --band-in inside the edge out to the outline; a side
       band runs between its pane's top and bottom bands (the corner is theirs — tokens.css --band-in) */
    B = SPACE.outline,
    IN = SPACE.bandIn;
  if (rp.classList.contains("paneled")) {
    /* a panel: its box (sizeFrame's — the pass's place), the same offsets the CSS gives them on the area's sides; its
       top / bottom handles span its width */
    const o = offsetIn(rp, rt),
      L = o.x,
      R = L + rp.offsetWidth,
      v = { top: o.y + IN + "px", height: rp.offsetHeight - 2 * IN + "px", right: "auto" };
    put(ro, { ...v, left: (outerLeft ? L - B : R - IN) + "px", width: B + IN + "px" });
    put(ri, { ...v, left: (outerLeft ? R - IN : L - B) + "px", width: B + IN + "px" });
    for (const e of /** @type {NodeListOf<HTMLElement>} */ (rt.querySelectorAll(".phedge")))
      put(e, { left: L + "px", right: "auto", width: rp.offsetWidth + "px" });
    return;
  }
  if (!plate) return;
  const { l, t, w, h } = plate;
  /* a picture: the plate in the area's coordinates — the same band */
  const o = offsetIn($("stage"), rt),
    L = o.x + l,
    R = L + w,
    v = { top: o.y + t + IN + "px", height: h - 2 * IN + "px", right: "auto" };
  put(ro, { ...v, left: (outerLeft ? L - B : R - IN) + "px", width: B + IN + "px" });
  put(ri, { ...v, left: (outerLeft ? R - IN : L - B) + "px", width: B + IN + "px" });
}
