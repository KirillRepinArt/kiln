// @ts-check
/* Kiln · which panes show their outline has ONE owner (2026-11-01). The outline round a pane shows what a gesture
   changes: the picture's (layout.js draws it round the picture or the panel: #right.edgehint) and the prompt box's
   (cardlayout.js draws it: #cardhint). Each handle declares the panes it resizes (RESIZES); a gesture holds its panes
   here, and an outline shows while ANY holder wants it. Before, each handle toggled the outlines itself — side by side
   the divider outlined only the picture while Vertical's outlined both, and moving the box and the divider each
   turned the box's outline off under the other */
import { $ } from "./dom.js";

/** @typedef {"pic" | "box"} Pane */
/** what each handle resizes: its outline set (Apple HIG split view: a divider changes both panes) @type {Record<string, Pane[]>} */
export const RESIZES = {
  dv: ["pic", "box"], // the divider side by side (pi / ri)
  hsplit: ["pic", "box"], // the divider in Vertical
  po: ["box"], // the prompt's outer edge
  vedge: ["box"], // the prompt box's bottom edge (side by side)
  sedge: ["box"], // the prompt box's sides (Vertical)
  ro: ["pic"], // the image area's outer edge
  hedge: ["pic"], // the picture's own edges
};
/** every resize handle (the edges you drag): pressing one is resizing, never working IN the prompt (layout.js's
 * pressCard hold) nor gripping it (cardlayout.js) — one list (2026-11-01: the divider sits inside the prompt's column, and
 * its press held the prompt still while the picture's room changed: the prompt overlapped the picture) */
export const HANDLES = ".pedge,.sedge,.vedge,.hsplit,.hedge";
/** @type {Map<string, Pane[]>} who holds which panes */
const holds = new Map();
/** the prompt box's outline drawer (cardlayout.js registers it: it follows the box every frame) @type {(on: boolean) => void} */
let drawBox = () => {};
/** @param {(on: boolean) => void} fn */
export function setBoxDraw(fn) {
  drawBox = fn;
}
let boxOn = false;
/** `who` (a gesture: "edge", "move") wants these panes outlined — [] lets go @param {string} who @param {Pane[]} panes */
export function outlines(who, panes) {
  if (panes.length) holds.set(who, panes);
  else holds.delete(who);
  const want = (/** @type {Pane} */ p) => [...holds.values()].some(v => v.includes(p));
  $("right").classList.toggle("edgehint", want("pic"));
  if (want("box") !== boxOn) {
    boxOn = want("box");
    drawBox(boxOn);
  }
}
