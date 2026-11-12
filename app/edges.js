// @ts-check
/* Kiln · the edges you drag: every pane's edges in both layouts (the box's, the shared edge, the picture's, a
   panel's) — and the edit buttons beside the picture showing on hover. The sizes they set are yours (layout.js
   setPaneSize); every edge goes through the layout pass (passEdge) and is ONE gesture (gesture.js, via edgeDrag) */
import { card, layoutLeft, lyUnfreeze, updHm } from "./cardlayout.js";
import { DRAG_START, gesture as drag } from "./gesture.js";
import { RESIZES, outlines } from "./outlines.js";
import { $, q, qa } from "./dom.js";
import { passDouble, passDragEnd, passDragMove, passDragStart, setPaneSize, sideBoxH } from "./layout.js";
import { RUBBER, rubber } from "./layoutmath.js";
import { S, save } from "./state.js";
import { moveThumb } from "./tabs.js";
import { ms } from "./tokens.js";

/**
 * One edge's drag — the edge's part of the one gesture (gesture.js: press → move → end, ending once however it ends):
 * while hovered or held the handle outlines the panes it resizes (outlines.js), and it holds its body classes.
 * `down` may decline the press (return false); `end` runs exactly once per accepted press.
 * @param {HTMLElement} h the handle
 * @param {() => import("./outlines.js").Pane[]} panes what it resizes
 * @param {object} fn
 * @param {(e: PointerEvent) => boolean | void} fn.down the press (false: not a drag)
 * @param {(e: PointerEvent) => void} fn.move a move with the button held
 * @param {() => void} fn.end the drag is over
 * @param {string[]} fn.cls the body classes the drag holds
 */
function edgeDrag(h, panes, { down, move, end, cls }) {
  drag(h, {
    accept: e => down(e) !== false,
    threshold: DRAG_START.edge,
    prevent: true,
    cls, // held while it drags, let go by the gesture's end (gesture.js — their one writer)
    start: () => {
      h.classList.add("drag");
      outlines("edge", panes());
    },
    move: (_, e) => move(e),
    end: () => {
      h.classList.remove("drag");
      outlines("edge", h.matches(":hover") ? panes() : []);
      end();
    },
  });
  h.addEventListener("pointerenter", () => outlines("edge", panes()));
  h.addEventListener("pointerleave", () => {
    if (!h.classList.contains("drag")) outlines("edge", []);
  });
}

/**
 * A drag through the layout pass: ONE way for every edge of both layouts (layout.js passDragStart / passDragMove /
 * passDragEnd — ARCHITECTURE › the single layout pass).
 * @param {HTMLElement} h the handle @param {() => import("./outlines.js").Pane[]} panes what it resizes
 * @param {string[]} cls the body classes the drag holds
 * @param {() => string | null} idOf the pass's handle id for a press now (null: not an edge of this layout or page)
 * @param {"x" | "y"} axis the pointer's axis @param {() => void} [after] also after each move and the release
 */
function passEdge(h, panes, cls, idOf, axis, after) {
  let held = false;
  const at = (/** @type {PointerEvent} */ e) => (axis === "y" ? e.clientY : e.clientX);
  edgeDrag(h, panes, {
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
  /* the prompt box's height edges: the size within [least, largest] (its least, the room), the rubber band past
     either. Side by side: the bottom (#vedge) and the top, held in card.hHold (the pass's one placement rule reads it:
     the other side holds); let go, your height (Custom: 16-layout-pass.md rule 3). In Vertical the bottom sets the
     box's height through the layout pass; its top is the edge it shares with the page, wired below */
  (function () {
    const L = $("left"),
      top = document.createElement("div");
    top.className = "vedge t";
    top.dataset.tip = "Drag to set the prompt box's height · double-click: back to its text's";
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
        h0 = 0,
        want = 0,
        lim = { lo: 0, hi: 0 };
      edgeDrag(g, () => RESIZES.vedge, {
        cls: ["vresizing"],
        down: e => {
          if (stacked()) return false; // Vertical: its bottom through the pass (above), its top is the shared edge
          y0 = e.clientY;
          h0 = want = L.getBoundingClientRect().height;
          lim = sideBoxH();
        },
        move: e => {
          /* resting in the middle the far side mirrors (layoutmath.js cardPlacement): the grabbed edge at the pointer */
          want = h0 + (up ? -1 : 1) * (e.clientY - y0) * ((S.pos || "mid") === "mid" ? 2 : 1);
          card.hHold = rubber(want, lim.lo, lim.hi, RUBBER);
          card.hPin = up ? "bottom" : "top";
          layoutLeft();
        },
        end: () => {
          card.hHold = 0;
          /* your height, within its limits (Custom): the mode lets go, as a box edge does in Vertical; the box settles to
             its anchor on the rearrangement */
          if (Math.abs(want - h0) > 1) {
            setPaneSize("box", "h", Math.round(Math.max(lim.lo, Math.min(lim.hi, want))), "side");
            S.hmode = "";
            save();
            updHm();
          }
          lyUnfreeze();
          layoutLeft();
        },
      });
      /* its double-click: back to its text's height — ONE owner (layout.js passDouble) */
      g.addEventListener("dblclick", () => {
        if (!stacked()) passDouble(up ? "box.top" : "box.bottom");
      });
    }
  })();
  /* Vertical: the edge the page (picture or panel) and the prompt box share has a band on each pane — the page's bottom
     (below) and the box's top (here) — both the ONE shared edge, as side by side's divider (B19b). It pushes into the
     empty room first, then trades (through the pass); both sizes become yours. Past a limit the rubber band.
     Double-click: both back to their defaults */
  passEdge(
    /** @type {HTMLElement} */ (q("#left > .vedge.t")),
    () => RESIZES.shared,
    ["vresizing", "laydrag"],
    () => (stacked() ? "shared" : null),
    "y",
  );
  /* side by side: po = the prompt's outer edge, dv = the divider between the prompt and the page (a strip on each side
   of the gap, both the same boundary), ro = the page's outer edge. Double-click: that pane back to its default width
   (the divider: both) */
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
      /** held: through the layout pass */
      let held = false;
      edgeDrag(h, () => RESIZES[/** @type {string} */ (h.dataset.e)], {
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
      }); /* one owner, layout.js passDouble (DD-2026-11-03-5) */
    }
  })();
  /* the picture's own edges (Generating, the Gallery): its size, a scale of its largest — through the layout pass in both
     layouts. Side by side its top and bottom (a centred axis: the other mirrors); in Vertical its top (the anchored
     side: its bottom holds while held, the release settles) and its sides (about its centre) — its bottom there is the
     shared edge. Double-click: its largest */
  qa(".hedge").forEach(h => {
    const e = /** @type {string} */ (h.dataset.e),
      y = e === "t" || e === "b";
    passEdge(
      h,
      () => (h.dataset.e === "b" && stacked() ? RESIZES.shared : RESIZES.hedge), // Vertical: its bottom is the shared edge
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
  /* Vertical: a panel's side edges (Queue, LoRAs, PNG Info): it widens or narrows about its centre, through the layout
     pass. Each page keeps its own width in Vertical; past a limit (the tab bar, the window) the rubber band.
     Double-click: its default (a 1:1 plate at the room's height) */
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
  /* a panel's top and bottom edges (Queue, LoRAs, PNG Info): its height, through the layout pass in both layouts (side
     by side a centred axis; Vertical: its top is the anchored side, its bottom the shared edge). Past a limit the rubber
     band; the release settles it to its place and keeps the height. Double-click: the whole room */
  {
    const rt = $("right");
    for (const side of ["t", "b"]) {
      const h = document.createElement("div");
      h.className = "phedge " + side;
      h.dataset.tip = "Drag to resize the panel · double-click for its full height";
      rt.appendChild(h);
      passEdge(
        h,
        () => (side === "b" && stacked() ? RESIZES.shared : RESIZES.phedge), // Vertical: its bottom is the shared edge
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
        }, ms("--delay-tools-hide"));
      };
    for (const el of [$("frame"), $("gtools"), ...qa(".gnav"), $("cbtn"), $("bclose")]) {
      el.addEventListener("pointerenter", on);
      el.addEventListener("pointerleave", off);
    }
  })();
  /* Vertical: the prompt box's side edges — its width, about its centre, through the layout pass. Dragging one lets go
     of a width mode (passDragStart). Double-click: its default width */
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
