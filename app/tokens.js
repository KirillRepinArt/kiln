// @ts-check
/* Kiln · the design tokens the scripts need, read from app/styles/tokens.css — the CSS holds the only copy of each
   value: change a gap there and the layout maths follows. The numbers here are the same values, for the unit tests
   (they run without a page); initTokens() replaces them with the stylesheet's at start-up. */

/** The spacing hierarchy, in px: between areas, an area and its parts, things attached to a box. */
export const SPACE = { area: 20, part: 12, tight: 8 };

/** The grid column between the prompt and the picture area: the area gap (the panels' edge sits on it; in
 * Generating the picture's stage covers the panel's transparent border, so the picture does too). */
export const pairGap = () => SPACE.area;

export function initTokens() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of /** @type {(keyof typeof SPACE)[]} */ (Object.keys(SPACE))) {
    const v = parseFloat(cs.getPropertyValue(`--gap-${k}`));
    if (v >= 0) SPACE[k] = v;
  }
}
