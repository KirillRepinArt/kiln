// @ts-check
/* Kiln · the design tokens the scripts need, read from app/styles/tokens.css — the CSS holds the only copy of each
   value: change a gap there and the layout maths follows. The numbers here are the same values, for the unit tests
   (they run without a page); initTokens() replaces them with the stylesheet's at start-up. */

/** The spacing hierarchy, in px: between areas, an area and its parts, things attached to a box; how far a
 * moving / resizing outline sits outside its plate; the picture's mat inside its plate. */
export const SPACE = { area: 20, part: 12, tight: 8, outline: 12, mat: 0 };
const NAMES = { area: "--gap-area", part: "--gap-part", tight: "--gap-tight", outline: "--outline-out", mat: "--mat" };

/** The grid column between the prompt and the picture area: the area gap (the panels' edge sits on it; in
 * Generating the picture's stage covers the panel's transparent border, so the picture does too). */
export const pairGap = () => SPACE.area;

export function initTokens() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of /** @type {(keyof typeof SPACE)[]} */ (Object.keys(SPACE))) {
    const v = parseFloat(cs.getPropertyValue(NAMES[k]));
    if (v >= 0) SPACE[k] = v;
  }
}

/** a number from tokens.css, read where it's used (the numbers' one home — v0.7d's first slice, the drop map): px or a
 * plain number, read now (a theme or a live stylesheet reload changes it) @param {string} name its custom property
 * @param {number} fallback its value without a page (unit tests) */
export function tok(name, fallback) {
  if (typeof document === "undefined") return fallback;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}
