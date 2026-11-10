// @ts-check
/* Kiln · which panes show their outline: ONE owner. The outline round a pane shows what a gesture changes: the
   picture's or the panel's (its plate: #plate.hint) and the prompt box's (#left.hint). The outline is part of the pane
   (CSS draws it: layout.css), so it moves with the pane in the same frame. Each handle declares the panes it resizes
   (RESIZES); a gesture holds its panes here, and an outline shows while ANY holder wants it (one gesture letting go
   never turns off another's) */
import { $ } from "./dom.js";

/** @typedef {"pic" | "box"} Pane */
/** what each handle resizes: its outline set (Apple HIG split view: a divider changes both panes) @type {Record<string, Pane[]>} */
export const RESIZES = {
  dv: ["pic", "box"], // the divider side by side (pi / ri)
  shared: ["pic", "box"], // Vertical's shared edge, from either pane's band (B19b)
  po: ["box"], // the prompt's outer edge
  vedge: ["box"], // the prompt box's bottom edge (side by side)
  sedge: ["box"], // the prompt box's sides (Vertical)
  ro: ["pic"], // the image area's outer edge
  hedge: ["pic"], // the picture's own edges
  vpedge: ["pic"], // a panel's side edges (Vertical)
  phedge: ["pic"], // a panel's top / bottom edges
};
/** every resize handle (the edges you drag): pressing one is resizing, never working IN the prompt (layout.js's
 * pressCard hold) nor gripping it (cardlayout.js) — one list (the divider sits inside the prompt's column) */
export const HANDLES = ".pedge,.sedge,.vedge,.hedge,.vpedge,.phedge";
/** @type {Map<string, Pane[]>} who holds which panes */
const holds = new Map();
/** `who` (a gesture: "edge", "move") wants these panes outlined — [] lets go @param {string} who @param {Pane[]} panes */
export function outlines(who, panes) {
  if (panes.length) holds.set(who, panes);
  else holds.delete(who);
  const want = (/** @type {Pane} */ p) => [...holds.values()].some(v => v.includes(p));
  $("plate").classList.toggle("hint", want("pic"));
  $("left").classList.toggle("hint", want("box"));
}
