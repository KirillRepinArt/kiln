// @ts-check
/* Kiln · fading what holds GLASS (v0.7c T2c, DEVLOG DD-2026-11-08-8). An element whose opacity is below 1 becomes a
   "backdrop root" (CSS Filter Effects 2): the glass inside it can only blur what is inside it — nothing — so it shows as
   a flat tint, and its blur snaps back the frame the fade reaches 1 (the user, 2026-11-08: "a light flicker when the box
   reappears"; measured: the box's glass 16.3 → 13.8 in its last frame). The platforms' rule: never fade glass through
   an ancestor (UIKit's UIVisualEffectView: no alpha below 1 on the view or its superviews — animate the effect itself).
   So a group is faded by its parts: a glass layer by its own opacity (on itself, or on its ::before), a part with no
   glass in it as a whole, and nothing that holds glass. Which parts are glass is read from their computed styles —
   glass.css stays the one home of the look. */

/** @typedef {{ el: Element, pseudo?: "::before", o: number }} FadePart a part to fade, and its own opacity at rest */

/* every fade made here is named, so a reader (the ownership tracer, a test) can tell a fade by parts from another
   owner's animation */
export const FADE_ID = "glassFade";
/** @param {Element} e @param {string | null} [p] */
const glassy = (e, p = null) => {
  const c = getComputedStyle(e, p);
  /* a pseudo-element counts only when it's drawn: a hidden one still reports its backdrop-filter (Start keeps its glass on
     itself while it has something to queue, its ::before hidden) */
  if (p && (c.display === "none" || c.content === "none")) return false;
  return c.backdropFilter !== "none" && c.backdropFilter !== "";
};

/** the parts of `root` to fade one by one (none of them holds glass under a fade). The root is the caller's: never
 * skipped, its keyframes as given (o 1) — it may be at 0 or hidden right now because it is about to fade in. Its
 * descendants carry their own resting opacity (a hidden one at 0, or not displayed, is skipped: nothing to fade)
 * @param {Element} root @returns {FadePart[]} */
export function fadeParts(root) {
  /** @type {FadePart[]} */
  const out = [];
  /** @param {Element} e @param {boolean} top */
  const walk = (e, top) => {
    /* its opacity has an owner of its own (data-fade-owner, in the markup: the picture's layers are pictures.js's) — it
       fades its layers with their view itself (pictures.js pictureWithView); writing them here was a second writer
       (the tracer, 2026-11-08) */
    if (!top && e instanceof HTMLElement && e.dataset.fadeOwner) return;
    const c = getComputedStyle(e);
    if (c.display === "none" || (!top && +c.opacity === 0)) return; // not seen: nothing to fade
    const o = top ? 1 : +c.opacity,
      holds = [...e.querySelectorAll("*")].some(x => glassy(x) || glassy(x, "::before"));
    if (glassy(e) || (!holds && !glassy(e, "::before"))) {
      out.push({ el: e, o }); // glass on itself, or no glass in it: fades as a whole
      return;
    }
    if (glassy(e, "::before")) out.push({ el: e, pseudo: "::before", o: +getComputedStyle(e, "::before").opacity });
    for (const k of e.children) walk(k, false);
  };
  walk(root, true);
  return out;
}

/** fade `root` by its parts: each part's opacity runs through `keys` (the root's, as given), a descendant's scaled by
 * its own opacity at rest
 * @param {Element} root @param {{ offset: number, opacity: number }[]} keys @param {KeyframeAnimationOptions} timing
 * @returns {Animation[]} */
export function glassFade(root, keys, timing) {
  return fadeParts(root).map(p => {
    const a = p.el.animate(
      keys.map(k => ({ offset: k.offset, opacity: k.opacity * p.o })),
      p.pseudo ? { ...timing, pseudoElement: p.pseudo } : timing,
    );
    a.id = FADE_ID;
    /** @type {Animation & { fadeRoot?: Element }} */ (a).fadeRoot = root; // the group it fades (the tracer reads it)
    return a;
  });
}
