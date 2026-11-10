// @ts-check
/* Kiln · THE leaving copy (R2 — ARCHITECTURE › every leaving copy; DD-2026-11-10-11). What is leaving is shown by a
   COPY of what was on screen, while the real thing is at its end state from the first frame — so everything that
   measures it measures the truth (UIKit's snapshotView(afterScreenUpdates: false), Android's ViewGroupOverlay). One way
   to make the copy, place it, fade it and be rid of it: a copy lives exactly as long as its leaving. A copy of the
   elements, not a picture: the glass's blur stays live (decision 0014). Named exception: the picture's own copy (#cvx),
   inside the frame so the crop-and-reveal clips it with the picture (pictures.js) */
import { fade } from "./fade.js";
import { HANDLES } from "./outlines.js";

/** @typedef {{ el: HTMLElement, release: (timing: KeyframeAnimationOptions, o?: { from?: number, span?: [number, number] }) => Animation[], drop: () => void }} Copy */

/** a copy of `parts` as they are on screen now, at their places and sizes, in a layer of its own over the page (inert,
 * hidden from assistive tech, taking no pointer). Each clone says what it stands for (data-copy-of: the part's id — the
 * ownership tracer reads a part and its copy as one thing). What cloning leaves out is put back: scroll offsets and typed
 * values; ids go (one of each in the page) and so do the edges' handles (a gesture's, never seen)
 * @param {Element[]} parts @param {{ cls?: string }} [o] `cls`: classes for the layer (the parts' own rules: .lcol)
 * @returns {Copy} */
export function leaveCopy(parts, o = {}) {
  const layer = document.createElement("div");
  layer.className = "standin" + (o.cls ? " " + o.cls : "");
  layer.inert = true;
  layer.setAttribute("aria-hidden", "true");
  /** @type {[Element, Element][]} */
  const pairs = [];
  for (const part of parts) {
    const r = part.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const c = /** @type {HTMLElement} */ (part.cloneNode(true));
    Object.assign(c.style, {
      position: "absolute",
      left: r.left + "px",
      top: r.top + "px",
      width: r.width + "px",
      height: r.height + "px",
      right: "auto",
      bottom: "auto",
      margin: "0",
      transform: "none",
      transition: "none",
      boxSizing: "border-box",
      visibility: "visible", // as it was seen — a state class that hides the real one now (body.norow) never hides its copy
    });
    if (part.id) c.dataset.copyOf = part.id;
    c.querySelectorAll(HANDLES).forEach(h => h.remove());
    const cs = c.querySelectorAll("*");
    pairs.push([part, c]);
    [...part.querySelectorAll("*")].filter(e => !e.closest(HANDLES)).forEach((e, i) => pairs.push([e, cs[i]]));
    layer.append(c);
  }
  document.body.append(layer);
  for (const [orig, c] of pairs) {
    c.removeAttribute("id");
    if (orig.scrollTop || orig.scrollLeft) {
      c.scrollTop = orig.scrollTop;
      c.scrollLeft = orig.scrollLeft;
    }
    if (orig instanceof HTMLInputElement || orig instanceof HTMLTextAreaElement || orig instanceof HTMLSelectElement)
      /** @type {HTMLInputElement} */ (c).value = orig.value;
  }
  let gone = false;
  const drop = () => {
    if (gone) return;
    gone = true;
    layer.remove();
  };
  return {
    el: layer,
    /* it fades out (fade.js: by its parts — it holds glass — from what it shows) and is gone when its fade is over or
       cancelled: a copy lives exactly as long as its leaving */
    release(timing, f = {}) {
      const anims = fade(layer, 0, timing, { glass: true, from: f.from ?? 1, span: f.span });
      if (!anims.length) drop();
      else
        Promise.all(anims.map(a => a.finished)).then(
          () => drop(),
          () => drop(),
        );
      return anims;
    },
    drop,
  };
}
