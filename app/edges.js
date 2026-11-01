// @ts-check
/* Kiln · the edges you drag: the prompt box's height, Vertical's slot line and side edges, the panels' widths, the
   picture's top / bottom edges — and the edit buttons beside the picture showing on hover. The sizes they set are in
   S.lay (layout.js does the maths and applies them).
   Every edge is ONE gesture (gesture() below, 2026-11-01): press → move → end, and it ends however the drag ends — the
   button up, a cancel, the pointer's capture lost (a reload, another window taking it), a move without the button —
   once. Each edge used to end itself on its own subset of those; a lost capture left the resize cursor stuck. */
import { toast } from "./boot.js";
import { applyPH, card, layoutLeft, lyUnfreeze, slotLeast, stackW, updHm } from "./cardlayout.js";
import { RESIZES, outlines } from "./outlines.js";
import { $, q, qa } from "./dom.js";
import { lay, layDrag, layGeo, layRelease, pageId, picFull, setPaneSize, sizeFrame } from "./layout.js";
import { PWMIN } from "./layoutmath.js";
import { S, save } from "./state.js";
import { moveThumb } from "./tabs.js";
import { SPACE } from "./tokens.js";

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

/* start-up wiring: every edge you drag, and the edit buttons' hover (called from main.js, in order) */
export function initEdges() {
  /* the prompt box's bottom edge, side by side: its height. (Vertical has none since 2026-10-31: the prompt sits at the
   window's bottom — its slot is set with the line above its name, like a docked composer's top edge) */
  (function () {
    const g = $("vedge");
    let y0 = 0,
      h0 = 0;
    gesture(g, () => RESIZES.vedge, {
      cls: ["vresizing"],
      down: e => {
        $("left").classList.add("nodur");
        y0 = e.clientY;
        h0 = $("left").getBoundingClientRect().height;
      },
      move: e => {
        const max =
          /** @type {HTMLElement} */ ($("left").parentElement).getBoundingClientRect().height - 2 * SPACE.area;
        S.pph = Math.max(240, Math.min(max, Math.round(h0 + e.clientY - y0)));
        applyPH();
      },
      end: () => {
        $("left").classList.remove("nodur");
        lyUnfreeze();
        layoutLeft();
        save();
      },
    });
    g.addEventListener("dblclick", () => {
      S.pph = 0;
      applyPH();
      save();
      toast("Prompt height back to auto");
    });
  })();
  /* Vertical: the divider between the picture and the prompt (it resizes both: Apple HIG split view). While it's held
     the box grows and the picture gives up the room; letting go the picture KEEPS its size and the box goes back to
     hugging its text, glued under the picture — the spare room at the window's bottom (the user, 2026-11-01: the box's
     height is never kept; a kept one left a tall empty box and a picture that couldn't grow back) */
  (function () {
    const g = $("hsplit");
    let y0 = 0,
      h0 = 0;
    gesture(g, () => RESIZES.hsplit, {
      cls: ["vresizing"],
      down: e => {
        y0 = e.clientY;
        h0 = $("left").getBoundingClientRect().height;
      },
      move: e => {
        /* between the box's least height and 70 % of the window (layoutmath.js promptSlotH) */
        card.slotHold = Math.max(
          slotLeast(),
          Math.min(Math.round(innerHeight * 0.7), Math.round(h0 - (e.clientY - y0))),
        );
        layoutLeft();
      },
      end: () => {
        const keep = S.view === "gen" ? +($("frame").dataset.th || 0) : 0; // the picture's height now
        card.slotHold = 0;
        layoutLeft(); // the box back to its text: the picture's room grows back
        if (keep) setPaneSize(pageId(), "h", keep >= picFull() * 0.995 ? null : keep); // the picture's cap: its size now
        save();
        sizeFrame();
      },
    });
    g.addEventListener("dblclick", () => {
      if (S.view === "gen") setPaneSize(pageId(), "h", null);
      save();
      sizeFrame();
      toast("The picture back to its full size");
    });
  })();
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
      /** the drag: which edge, where the pointer started, the geometry then @type {{ e: "dv" | "po" | "ro", x0: number, g0: import("./types.js").Geometry } | null} */
      let d = null;
      gesture(h, () => RESIZES[/** @type {string} */ (h.dataset.e)], {
        cls: ["resizing", "laydrag"],
        down: ev => {
          if (q(".app.stacked")) return false;
          ev.stopPropagation(); /* not the card's move gesture */
          d = {
            e: /** @type {"dv" | "po" | "ro"} */ (h.dataset.e),
            x0: ev.clientX,
            g0: Object.assign({}, lay.last || layGeo(), { gen: S.view === "gen" }),
          };
          lay.drag = true;
        },
        move: ev => {
          if (!d) return;
          layDrag(d.e, d.g0, ev.clientX - d.x0);
          lay.frameHold = true;
          sizeFrame();
          lay.frameHold = false;
          moveThumb(true);
        },
        end: () => {
          d = null;
          save();
          layRelease();
          setTimeout(() => {
            sizeFrame();
            moveThumb(true);
          }, 480); /* after the glide */
        },
      });
      h.addEventListener("dblclick", () => {
        if (h.dataset.e !== "ro") setPaneSize("box", "w", null, "side");
        if (h.dataset.e !== "po") setPaneSize(pageId(), "w", null, "side");
        save();
        layRelease();
        moveThumb(true);
      }); /* that pane (the divider: both) back to its default */
    }
  })();
  /* the image area's top and bottom edges (Generating, side by side): the largest height the picture may be. The edge
   follows the cursor and the other one holds still; on release it all glides into place (height → width → centring). */
  (function () {
    qa(".hedge").forEach(h => {
      /** the picture's edge being dragged: which, where it started, the picture's size and top then, the room it has
       * @type {{ e: string, x0: number, y0: number, w0: number, h0: number, t0: number, full: number } | null} */
      let d = null;
      gesture(h, () => RESIZES.hedge, {
        cls: ["vresizing", "laydrag"],
        down: ev => {
          if (S.view !== "gen") return false;
          ev.stopPropagation();
          const f = $("frame");
          d = {
            e: /** @type {string} */ (h.dataset.e),
            x0: ev.clientX,
            y0: ev.clientY,
            w0: f.offsetWidth,
            h0: f.offsetHeight,
            t0: f.offsetTop,
            full: picFull(), // the room the layout gives the picture now (its insets: layout.js)
          };
        },
        move: ev => {
          if (!d) return;
          const dy = ev.clientY - d.y0,
            dx = ev.clientX - d.x0,
            side = d.e === "l" || d.e === "r";
          /* a side edge (Vertical): the picture scales about its centre, its shape kept — the edge follows the cursor */
          const want = side
            ? ((d.w0 + 2 * (d.e === "r" ? dx : -dx)) * d.h0) / d.w0
            : d.e === "b"
              ? d.h0 + dy
              : d.h0 - dy;
          const nh = Math.max(200, Math.min(d.full, want));
          lay.vh = nh;
          lay.vtop = side ? d.t0 + (d.h0 - nh) / 2 : d.e === "b" ? d.t0 : d.t0 + (d.h0 - nh);
          setPaneSize(pageId(), "h", nh);
          sizeFrame();
        },
        end: () => {
          const full = d ? d.full : 0,
            nh = lay.vh;
          d = null;
          lay.vh = null;
          lay.vtop = null;
          if (nh && nh >= full * 0.995) setPaneSize(pageId(), "h", null); // the whole room: no cap
          save();
          sizeFrame();
        },
      });
      h.addEventListener("dblclick", () => {
        setPaneSize(pageId(), "h", null);
        save();
        sizeFrame();
      });
    });
  })();
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
  (function () {
    const L = $("left"),
      col = $("lcol");
    for (const side of ["l", "r"]) {
      const h = document.createElement("div");
      h.className = "sedge " + side;
      h.dataset.tip = "Drag to resize the prompt box · double-click for its default width";
      L.appendChild(h);
      /** a Vertical side edge being dragged: where the pointer started, the box's width then
       * @type {{ x0: number, w0: number } | null} */
      let d = null;
      gesture(h, () => RESIZES.sedge, {
        cls: ["resizing", "laydrag"],
        down: ev => {
          if (!q(".app.stacked")) return false;
          ev.stopPropagation();
          d = { x0: ev.clientX, w0: stackW() };
        },
        move: ev => {
          if (!d) return;
          const dx = ev.clientX - d.x0,
            max = innerWidth - 2 * SPACE.area;
          const w = Math.max(Math.min(PWMIN, max), Math.min(max, d.w0 + (side === "r" ? dx : -dx)));
          S.vfit = false;
          setPaneSize("box", "w", w, "vert");
          col.style.setProperty("--sw", w + "px");
          col.style.setProperty("--soff", ((side === "r" ? 1 : -1) * (w - d.w0)) / 2 + "px");
        } /* the other edge stays put */,
        end: () => {
          d = null;
          col.style.setProperty("--soff", "0px");
          save();
          updHm();
          layoutLeft();
        } /* glides back to centre */,
      });
      h.addEventListener("dblclick", () => {
        setPaneSize("box", "w", null, "vert");
        S.vfit = false;
        save();
        updHm();
        layoutLeft();
      });
    }
  })();
}
