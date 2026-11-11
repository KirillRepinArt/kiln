// @ts-check
/* Kiln · the tab bar: which view is on, the selected tab's sliding pill, switching tabs */
import { $ } from "./dom.js";
import {
  dockNow,
  fadeCol,
  lay,
  liftCol,
  liftScale,
  liftToken,
  placeFor,
  promptFollow,
  sizeFrame,
  snapHold,
  standIn,
} from "./layout.js";
import { relationMotion } from "./layoutmath.js";
import { travel } from "./rearrange.js";
import { renderLoras } from "./loras.js";
import { PV, browsed, pv } from "./picstate.js";
import { frameBox, frameHold, pictureChange } from "./framebox.js";
import { plateBefore, switchGlide, switchLanded } from "./plate.js";
import { placeNavs } from "./browse.js";
import { QS, queueChanged, renderQueue, renderQueueInner, setQsAnchor } from "./queue.js";
import { S } from "./state.js";
import { renderCounts } from "./boot.js";
import { layoutLeft } from "./cardlayout.js";

/* ======================= tabs ======================= */
/** @param {boolean} [instant] no glide (start-up, a font change) */
export function moveThumb(instant) {
  const t = /** @type {HTMLElement | null} */ (document.querySelector(".tab.on")),
    th = $("thumb");
  if (!t) return;
  if (instant) th.style.transition = "none";
  th.style.left = t.offsetLeft + "px";
  th.style.width = t.offsetWidth + "px";
  if (instant) {
    void th.offsetWidth;
    th.style.transition = "";
  }
}
/** @param {import("./types.js").Settings["view"]} v */
export function showView(v) {
  const was = S.view;
  if (was !== v) {
    // temporary state belongs to the visit: an open preview, a browse, a search, a scroll position
    if (was === "queue") {
      $("qwrap").scrollTop = 0;
      if (typeof QS !== "undefined") {
        QS.clear();
        setQsAnchor(null);
      }
    } // the prompt box (and its peek) is left as it is
    if (was === "loras") {
      /** @type {HTMLInputElement} */ ($("lsearch")).value = "";
      /** @type {HTMLElement} */ ($("lsearch").parentElement).classList.remove("has");
      $("lscroll").scrollTop = 0;
    }
  }
  S.view = v;
  $("rpanel").classList.toggle("paneled", v !== "gen");
  tabSync(true);
  document.querySelectorAll(".view").forEach(x => x.classList.toggle("on", x.id === "v-" + v));
  if (v === "queue") {
    if (was === "queue") renderQueue();
    else if (queueChanged()) renderQueueInner();
    renderCounts(); // the failures counted on its tab are seen now
  }
  /* opening it: no slide to measure for, nothing to rebuild if nothing changed */
  if (v === "loras") renderLoras();
  sizeFrame(); // the plate follows the page's element in the same task (panelWrite / the frame's write → plateSync)
}
/* Gallery isn't a page of its own (yet): it's the name for browsing finished pictures in the picture view — the
   state ← and the arrows already put you in. Clicking it opens the last finished picture; Generating = the live view */
/** @param {boolean} [force] */
export function tabSync(force) {
  const v = S.view === "gen" && browsed() ? "gallery" : S.view;
  if (!force && /** @type {any} */ (tabSync).v === v) return; // the tab last lit, kept on the function
  /** @type {any} */ (tabSync).v = v;
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".tab")).forEach(t =>
    t.classList.toggle("on", t.dataset.v === v),
  );
  moveThumb();
}
/* a tab switch is navigation, not a layout edit: the new tab is laid out at once and the switch moves everything from
   where it was, live (no View Transition: decision 0014). Generating ↔ the Gallery is one view with another picture:
   the frame crops and reveals by itself, as when browsing. Between views both stay on the page for the switch
   (plate.js switchGlide) */
/** @param {() => void} fn the switch itself @param {boolean} [layout] a layout switch (Left / Right / Vertical) —
 * ARCHITECTURE › a layout switch @param {import("./layoutmath.js").RelationCause} [cause] what changed the box's
 * relation (a layout switch): your hand ("hand" — a drop) or the Layout menu / Reset ("menu") */
export function tabGo(fn, layout = false, cause = "menu") {
  /* a layout switch changes the box's relation to its partner — ARCHITECTURE › a pane's change of relation */
  const rel = layout ? relationMotion({ pane: "box", partner: "plate", cause }, 0).pattern : null,
    from = plateBefore(),
    /* a fade through: the box's stand-in, made before anything changes — it fades out as the box was, while the box
       itself is laid out where it lands from the first frame */
    stand = rel === "fade" ? standIn() : null,
    /* a travel: the box as it is seen now (lifted under your hand) — it goes on from here */
    seen0 = rel === "travel" ? $("left").getBoundingClientRect() : null,
    dock0 = /** @type {"left" | "right" | "below"} */ (S.dock || "left"), // the box's relation before
    v0 = /** @type {HTMLElement | null} */ (document.querySelector(".rpanel > .view.on")),
    r0 = v0 ? v0.getBoundingClientRect() : null,
    f0 = frameBox(),
    fr0 = $("frame").getBoundingClientRect(),
    shown = onScreen(), // before anything changes: a switch starts from what is shown (F4)
    me = ++tabGos;
  snapHold("tab", 10000); // the layout lands at once: the switch alone moves things (let go at its end, below)
  if (!layout) document.documentElement.classList.add("tabswitch"); // a tab switch: the tab pill still slides
  /* the picture's view: the frame's owner decides — a box of another shape or size crops and reveals; a layout switch
     keeps the SAME picture, which scales with its pane (DD-2026-11-10-2); a switch to another view gives it up
     (frameHold) */
  if (S.view === "gen" && f0) pictureChange({ ...f0, x: fr0.left, y: fr0.top, scale: layout });
  lay.frameDefer = true;
  try {
    fn();
  } finally {
    lay.frameDefer = false;
    if (lay.framePending) {
      lay.framePending = false;
      sizeFrame();
    }
  }
  /* a layout switch: the layout settled before anything is measured — to its fixed point: in Vertical the box's place
     feeds the page's room and the room the box (two rounds do it; a third only confirms) */
  if (layout)
    for (let i = 0; i < 3; i++) {
      const was = $("lcol").style.cssText + $("frame").style.cssText + $("rpanel").style.cssText;
      layoutLeft();
      sizeFrame();
      if ($("lcol").style.cssText + $("frame").style.cssText + $("rpanel").style.cssText === was) break;
    }
  /* a travel: laid out where it lands (the layout pass's resting place — placeFor), the box starts where it was seen and
     its lift runs down to nothing on the switch's own clock (travel: a switch's move, one plan with the plate's) */
  if (seen0) {
    const at = placeFor(dockNow(), S.pos || "mid"),
      o = { l: seen0.left - at.x, t: seen0.top - at.y, w: 0, h: 0 };
    liftCol(o.l, o.t);
    travel("lift", o, { l: 0, t: 0, w: 0, h: 0 }, b => liftCol(b.l, b.t));
    /* carried as a token (the drop map): it grows back to its size on the same clock (it scales about its top-left
       corner, so the travel measured from that corner holds) */
    const s0 = liftScale();
    if (s0 !== 1) travel("liftScale", { l: s0, t: 0, w: 0, h: 0 }, { l: 1, t: 0, w: 0, h: 0 }, b => liftToken(b.l));
  }
  const v1 = /** @type {HTMLElement | null} */ (document.querySelector(".rpanel > .view.on"));
  let sw;
  if (layout && v0 && v1 && r0 && v0 === v1)
    sw =
      v0.id === "v-gen"
        ? switchGlide(from, null, true) // the picture: the frame's own crop-and-reveal, the plate riding it
        : switchGlide(from, { old: v0, oldRect: r0, neu: v1, shown }, true); // a panel: its contents ride the plate
  else if (v0 && v1 && r0 && v0 !== v1) {
    if (v0.id === "v-gen" && f0) frameHold(f0); // the picture stays where it was while its view leaves
    sw = switchGlide(from, { old: v0, oldRect: r0, neu: v1, shown });
  } else {
    sw = switchGlide(from, null);
    /* the same view: a box of another shape or size crops and reveals (declared above; framebox.js decides) — the
       render and the Gallery keep different room (their insets). The status row's fade is the layout's (rowFade) */
  }
  placeNavs();
  /* the box: a layout switch by the menu fades through its change of relation; a tab switch keeps it — it rides the
     travelling plate (layout.js promptFollow, in the driver's frames) */
  if (stand) fadeCol(stand, sw, { plate: from, dock: dock0 });
  /* a travel: glued to where the plate lands from the first frame (fadeCol does it for a fade) — its lift is measured
     from there */ else if (seen0) promptFollow(true);
  /* once it HAS landed — its own end (plate.js switchLanded), not a timer (T4) — the layout's glides come back, THEN
     one more layout (measured mid-switch, a place can rest a pixel off): a correction now glides */
  switchLanded().then(() => {
    if (me !== tabGos) return; // a newer tab switch holds it now
    snapHold("tab", 0);
    document.documentElement.classList.remove("tabswitch");
    sizeFrame();
  });
}
let tabGos = 0; // tab switches started so far
/** each page's opacity and box on screen now — read before a switch changes anything (after, the classes already say
 * what's coming): mid-switch the leaving page is part faded, and a switch restarted from 1 and 0 cut it (F4)
 * @returns {Map<HTMLElement, { o: number, r: DOMRect }>} */
function onScreen() {
  const m = new Map();
  for (const v of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".rpanel > .view"))) {
    const s = getComputedStyle(v),
      o = s.visibility === "hidden" ? 0 : +s.opacity;
    if (o > 0.005) m.set(v, { o, r: v.getBoundingClientRect() });
  }
  return m;
}
/** go to a page — THE way a page switch happens (ARCHITECTURE › going to a page). `then` runs on the new page, inside
 * the switch.
 * @param {import("./types.js").Settings["view"]} v @param {() => void} [then] */
export function goView(v, then) {
  tabGo(() => {
    showView(v);
    if (then) then();
  });
}

/* start-up wiring: the tab bar's clicks; the pill's place once the fonts have loaded (called from main.js, in order) */
export function initTabs() {
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".tab")).forEach(
    t =>
      (t.onclick = () =>
        tabGo(() => {
          const v = /** @type {import("./types.js").Settings["view"]} */ (t.dataset.v); // index.html's data-v
          PV.from = null;
          if (v === "gallery") {
            if (S.view !== "gen") showView("gen");
            if (!browsed()) pv("gallery");
            tabSync();
            return;
          }
          if (v === "gen") pv("generating"); /* the live view: the render, or the clean frame */
          showView(v);
        })),
  );
  document.fonts && document.fonts.ready.then(() => moveThumb(true));
}
