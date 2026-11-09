// @ts-check
/* Kiln · the edges you drag: the prompt box's height, Vertical's slot line and side edges, the panels' widths, the
   picture's top / bottom edges — and the edit buttons beside the picture showing on hover. The sizes they set are in
   S.lay (layout.js does the maths and applies them).
   Every edge is ONE gesture (gesture() below, 2026-11-01): press → move → end, and it ends however the drag ends — the
   button up, a cancel, the pointer's capture lost (a reload, another window taking it), a move without the button —
   once. Each edge used to end itself on its own subset of those; a lost capture left the resize cursor stuck. */
import { card, layoutLeft, lyUnfreeze, updHm } from "./cardlayout.js";
import { RESIZES, outlines } from "./outlines.js";
import { $, q, qa } from "./dom.js";
import { passDouble, passDragEnd, passDragMove, passDragStart } from "./layout.js";
import { RUBBER, rubber } from "./layoutmath.js";
import { S } from "./state.js";
import { moveThumb } from "./tabs.js";

/** the body classes a drag holds while it lasts (the cursor, no transitions) — removed by the gesture's end, always */
const DRAG_CLASSES = ["resizing", "vresizing", "laydrag"];

/**
 * One drag gesture on a handle — the only place an edge's press, move and end are wired.
 * `down` may decline the press (return false); `end` runs exactly once per accepted press, however the drag ends.
 * While hovered or held, the handle outlines the panes it resizes (outlines.js).
 * @param {HTMLElement} h the handle
 * @param {() => import("./outlines.js").Pane[]} panes what it resizes
 * @param {object} fn
 * @param {(e: PointerEvent) => boolean | void} fn.down the press (false: not a drag)
 * @param {(e: PointerEvent) => void} fn.move a move with the button held
 * @param {() => void} fn.end the drag is over
 * @param {string[]} fn.cls the body classes the drag holds
 */
function gesture(h, panes, { down, move, end, cls }) {
  let on = false,
    pid = -1;
  const stop = () => {
    if (!on) return;
    on = false;
    try {
      if (h.hasPointerCapture(pid)) h.releasePointerCapture(pid);
    } catch (_) {}
    document.body.classList.remove(...DRAG_CLASSES);
    h.classList.remove("drag");
    outlines("edge", h.matches(":hover") ? panes() : []);
    end();
  };
  h.addEventListener("pointerdown", e => {
    if (e.button !== 0 || on) return;
    if (down(e) === false) return;
    e.preventDefault();
    on = true;
    pid = e.pointerId;
    try {
      h.setPointerCapture(pid);
    } catch (_) {}
    h.classList.add("drag");
    document.body.classList.add(...cls);
    outlines("edge", panes());
  });
  h.addEventListener("pointermove", e => {
    if (!on) return;
    if (!(e.buttons & 1)) return stop(); // the button came up where we didn't hear it
    move(e);
  });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) h.addEventListener(t, stop);
  h.addEventListener("pointerenter", () => outlines("edge", panes()));
  h.addEventListener("pointerleave", () => {
    if (!on) outlines("edge", []);
  });
}

/**
 * A drag through the layout pass (v0.7c C3 side by side; Vertical since C4c): ONE way for every edge of the layout — the
 * press freezes the sizes, the pointer is the drag's constraint, the pass gives every number, the release keeps its
 * `kept` (layout.js passDragStart / passDragMove / passDragEnd). Vertical's edges had maths and holds of their own
 * (lay.vh / vtop / overB / ph / ptop / vw, card.slotHold / swHold) until C4c.
 * @param {HTMLElement} h the handle @param {() => import("./outlines.js").Pane[]} panes what it resizes
 * @param {string[]} cls the body classes the drag holds
 * @param {() => string | null} idOf the pass's handle id for a press now (null: not an edge of this layout or page)
 * @param {"x" | "y"} axis the pointer's axis @param {() => void} [after] also after each move and the release
 */
function passEdge(h, panes, cls, idOf, axis, after) {
  let held = false;
  const at = (/** @type {PointerEvent} */ e) => (axis === "y" ? e.clientY : e.clientX);
  gesture(h, panes, {
    cls,
    down: e => {
      const id = idOf();
      if (!id) return false;
      e.stopPropagation(); // not the card's move gesture
      held = passDragStart(id, at(e));
      return held;
    },
    move: e => {
      if (!held) return;
      passDragMove(at(e));
      if (after) after();
    },
    end: () => {
      if (!held) return;
      held = false;
      passDragEnd();
      if (after) after();
    },
  });
  /* its double-click: the same edge, ONE owner (layout.js passDouble, DD-2026-11-03-5) */
  h.addEventListener("dblclick", () => {
    const id = idOf();
    if (id) passDouble(id);
  });
}
const stacked = () => !!q(".app.stacked");
/* start-up wiring: every edge you drag, and the edit buttons' hover (called from main.js, in order) */
export function initEdges() {
  /* the prompt box's height edges (2026-11-02, DEVLOG DD-2026-11-02-12): ordinary edges — the size within [least,
     largest], the rubber band past either — but the box's least and largest are both its text's height (up to its
     mode's largest), so they give a little and snap back: the box grows with what you type, never with a drag, and its
     height is never stored. Side by side: the bottom (#vedge) and the top, held in card.hHold (read by layoutLeft). In
     Vertical the bottom sets the box's height — yours (Custom, decision A: C4c), through the layout pass; its top is the
     edge it shares with the page (#hsplit), so no handle of its own there (B10) */
  (function () {
    const L = $("left"),
      top = document.createElement("div");
    top.className = "vedge t";
    top.dataset.tip = "The prompt box fits its text · the Match and Full buttons make it taller";
    L.appendChild(top);
    passEdge(
      $("vedge"),
      () => RESIZES.vedge,
      ["vresizing", "laydrag"],
      () => (stacked() ? "box.bottom" : null),
      "y",
    );
    for (const g of [$("vedge"), top]) {
      const up = g === top;
      let y0 = 0,
        h0 = 0;
      gesture(g, () => RESIZES.vedge, {
        cls: ["vresizing"],
        down: e => {
          if (stacked()) return false; // Vertical: its bottom through the pass (above), its top is the shared edge
          y0 = e.clientY;
          h0 = L.getBoundingClientRect().height; // its text's height: its least and its largest
        },
        move: e => {
          card.hHold = rubber(h0 + (up ? -1 : 1) * (e.clientY - y0), h0, h0, RUBBER);
          card.hPin = up ? "bottom" : "top";
          layoutLeft();
        },
        end: () => {
          card.hHold = 0; // back to its text: it settles
          lyUnfreeze();
          layoutLeft();
        },
      });
    }
  })();
  /* Vertical: the edge the page (picture or panel) and the prompt box share — ONE handle, the line in the gap above the
     prompt's name (#hsplit; the box's own top is not a second one: B10). It trades (C4 rule 4, through the pass): down,
     the page grows and the box gives, down to its least; up, the page shrinks and the box takes it — the group's bottom
     holds; both sizes become yours. Past a limit the rubber band. Double-click: both back to their defaults (the picture
     first) */
  passEdge(
    $("hsplit"),
    () => RESIZES.hsplit,
    ["vresizing", "laydrag"],
    () => (stacked() ? "shared" : null),
    "y",
  );
  /* the panel edges (Phase 2a): po = the prompt's outer edge, dv = the divider between the prompt and the image area
   (a strip on each side of the gap, both the same boundary), ro = the image area's outer edge. Double-click: that
   panel back to its default width (the divider: both). */
  (function () {
    /** an edge handle @param {HTMLElement} parent @param {string} e which edge @param {string} cls @param {string} tip */
    const mk = (parent, e, cls, tip) => {
      const h = document.createElement("div");
      h.className = "pedge " + cls;
      h.dataset.e = e;
      h.dataset.tip = tip;
      parent.appendChild(h);
      return h;
    };
    const P_TIP = "Drag to resize the prompt · double-click for its default width",
      R_TIP = "Drag to resize the image area · double-click for its default width",
      D_TIP = "Drag to share the width between the prompt and the image area · double-click for both defaults";
    const hs = [
      mk($("left"), "po", "po", P_TIP),
      mk($("left"), "dv", "pi", D_TIP),
      mk($("right"), "dv", "ri", D_TIP),
      mk($("right"), "ro", "ro", R_TIP),
    ];
    for (const h of hs) {
      /** held: through the layout pass (every page side by side: C3, C2a's rest) */
      let held = false;
      gesture(h, () => RESIZES[/** @type {string} */ (h.dataset.e)], {
        cls: ["resizing", "laydrag"],
        down: ev => {
          if (q(".app.stacked")) return false;
          ev.stopPropagation(); /* not the card's move gesture */
          const e = h.dataset.e,
            R = !!q(".app.pright"),
            /* the pass's name for this edge: the shared edge, the box's outer side, the page's outer side */
            id = e === "dv" ? "shared" : e === "po" ? (R ? "box.right" : "box.left") : R ? "page.left" : "page.right";
          held = passDragStart(id, ev.clientX);
          return held;
        },
        move: ev => {
          if (!held) return;
          passDragMove(ev.clientX);
          moveThumb(true);
        },
        end: () => {
          if (!held) return;
          held = false;
          passDragEnd();
          moveThumb(true);
        },
      });
      h.addEventListener("dblclick", () => {
        if (q(".app.stacked")) return;
        const e = h.dataset.e,
          R = !!q(".app.pright");
        passDouble(
          e === "dv" ? "shared" : e === "po" ? (R ? "box.right" : "box.left") : R ? "page.left" : "page.right",
        );
      }); /* DD-5, one owner: the box's default, the shared edge both, the page's outer edge its pane's (a picture: its
             largest, the box squeezed) */
    }
  })();
  /* the picture's own edges (Generating, the Gallery): its size, a scale of its largest — through the layout pass in both
     layouts (C3; Vertical: C4c). Side by side its top and bottom (a centred axis: the other mirrors); in Vertical its top
     (the anchored side: its bottom holds while held, the release settles) and its sides (about its centre) — its bottom
     there is the shared edge (#hsplit). Double-click: its largest */
  qa(".hedge").forEach(h => {
    const e = /** @type {string} */ (h.dataset.e),
      y = e === "t" || e === "b";
    passEdge(
      h,
      () => RESIZES.hedge,
      ["vresizing", "laydrag"],
      () =>
        S.view !== "gen"
          ? null
          : e === "t"
            ? "page.top"
            : e === "b"
              ? stacked()
                ? "shared"
                : "page.bottom"
              : stacked()
                ? e === "l"
                  ? "page.left"
                  : "page.right"
                : null,
      y ? "y" : "x",
    );
  });
  /* Vertical: a panel's side edges (Queue, LoRAs, PNG Info — v0.7c): it widens or narrows about its centre (Vertical is
     centred, like the picture's sides), through the layout pass (C4c). Each page keeps its own width in Vertical; past a
     limit (the tab bar, the window) the rubber band. Double-click: its default (a 1:1 plate at the room's height) */
  {
    const rt = $("right");
    for (const side of ["l", "r"]) {
      const h = document.createElement("div");
      h.className = "vpedge " + side;
      h.dataset.tip = "Drag to resize the panel · double-click for its default width";
      rt.appendChild(h);
      passEdge(
        h,
        () => RESIZES.vpedge,
        ["resizing", "laydrag"],
        () => (stacked() && S.view !== "gen" ? (side === "l" ? "page.left" : "page.right") : null),
        "x",
      );
    }
  }
  /* a panel's top and bottom edges (Queue, LoRAs, PNG Info — v0.7c): its height, through the layout pass in both layouts
     (side by side a centred axis; Vertical: its top is the anchored side, its bottom the shared edge — C4c). Past a limit
     the rubber band; the release settles it to its place and keeps the height. Double-click: the whole room */
  {
    const rt = $("right");
    for (const side of ["t", "b"]) {
      const h = document.createElement("div");
      h.className = "phedge " + side;
      h.dataset.tip = "Drag to resize the panel · double-click for its full height";
      rt.appendChild(h);
      passEdge(
        h,
        () => RESIZES.phedge,
        ["vresizing", "laydrag"],
        () => (S.view === "gen" ? null : side === "t" ? "page.top" : stacked() ? "shared" : "page.bottom"),
        "y",
      );
    }
  }
  /* the edit buttons appear while the pointer is over the picture or the column beside it (one zone, so you never chase
   them) and stay ~300 ms after it leaves, so a diagonal path doesn't lose them */
  (function () {
    /** @type {number | undefined} */
    let t;
    const on = () => {
        clearTimeout(t);
        $("stage").classList.add("tools");
        document.body.classList.add("navs");
      },
      off = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          $("stage").classList.remove("tools");
          document.body.classList.remove("navs");
        }, 300);
      };
    for (const el of [$("frame"), $("gtools"), ...qa(".gnav")]) {
      el.addEventListener("pointerenter", on);
      el.addEventListener("pointerleave", off);
    }
  })();
  /* Vertical: the prompt box's side edges — its width, about its centre (Vertical is centred), through the layout pass
     (C4c; it was card.swHold, written by layoutLeft). Dragging one lets go of a width mode (passDragStart).
     Double-click: its default width */
  {
    const L = $("left");
    for (const side of ["l", "r"]) {
      const h = document.createElement("div");
      h.className = "sedge " + side;
      h.dataset.tip = "Drag to resize the prompt box · double-click for its default width";
      L.appendChild(h);
      passEdge(
        h,
        () => RESIZES.sedge,
        ["resizing", "laydrag"],
        () => (stacked() ? (side === "l" ? "box.left" : "box.right") : null),
        "x",
        updHm,
      );
    }
  }
}
