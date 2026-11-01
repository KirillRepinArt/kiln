// @ts-check
/* Kiln · the edges you drag: the prompt box's height, Vertical's slot line and side edges, the panels' widths, the
   picture's top / bottom edges — and the edit buttons beside the picture showing on hover. The sizes they set are in
   S.lay (layout.js does the maths and applies them).
   Every edge is ONE gesture (gesture() below, 2026-11-01): press → move → end, and it ends however the drag ends — the
   button up, a cancel, the pointer's capture lost (a reload, another window taking it), a move without the button —
   once. Each edge used to end itself on its own subset of those; a lost capture left the resize cursor stuck. */
import { toast } from "./boot.js";
import { applyPH, card, layoutLeft, lyUnfreeze, stackW, updHm } from "./cardlayout.js";
import { RESIZES, outlines } from "./outlines.js";
import { $, q, qa } from "./dom.js";
import {
  lay,
  layDrag,
  layGeo,
  layRelease,
  pageId,
  paneLimits,
  paneSize,
  picFull,
  setPaneSize,
  sizeFrame,
  within,
} from "./layout.js";
import { PIC_OVER, RUBBER, rubber } from "./layoutmath.js";
import { S, save } from "./state.js";
import { moveThumb } from "./tabs.js";
import { SPACE, pairGap } from "./tokens.js";

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
  /* Vertical: the divider between the picture and the prompt. On a picture page it is the picture's bottom edge (the
     user, 2026-11-01): the picture's top holds, its bottom follows the pointer, and the box stays glued under it —
     dragging down grows the picture and pushes the box down into the spare room; letting go the picture keeps its size.
     The box's height is never kept: it hugs its text. On a panel (no height of its own yet: E1) the box grows while it's
     held (card.slotHold) and goes back to its text on release. */
  (function () {
    const g = $("hsplit");
    let y0 = 0,
      h0 = 0;
    /** the picture's drag: its height and top then, the room it has @type {{ h0: number, t0: number, full: number } | null} */
    let pic = null;
    gesture(g, () => RESIZES.hsplit, {
      cls: ["vresizing", "laydrag"],
      down: e => {
        y0 = e.clientY;
        h0 = $("left").getBoundingClientRect().height;
        const f = $("frame");
        pic = S.view === "gen" ? { h0: f.offsetHeight, t0: f.offsetTop, full: picFull() } : null;
      },
      move: e => {
        const dy = e.clientY - y0;
        if (pic) {
          const lo = paneLimits(pageId(), "h").lo,
            nh = rubber(pic.h0 + dy, lo, pic.full, PIC_OVER); // past a limit: with resistance
          lay.vh = nh;
          lay.vtop = pic.t0;
          setPaneSize(pageId(), "h", Math.max(lo, Math.min(pic.full, pic.h0 + dy)));
          sizeFrame();
          return;
        }
        /* between the box's least height and 70 % of the window (layoutmath.js promptSlotH) */
        card.slotHold = within(Math.round(h0 - dy), paneLimits("box", "h", { o: "vert" }));
        layoutLeft();
      },
      end: () => {
        if (pic) {
          const nh = lay.vh,
            full = pic.full;
          pic = null;
          lay.vh = null;
          lay.vtop = null;
          if (nh && nh >= full * 0.995) setPaneSize(pageId(), "h", null); // the whole room: no cap
        } else {
          card.slotHold = 0;
          layoutLeft(); // the box back to its text
        }
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
      /** the drag: which edge, where the pointer started, the geometry then, the picture (a picture page)
       * @type {{ e: "dv" | "po" | "ro", x0: number, g0: import("./types.js").Geometry, pic: { ar: number, full: number, w0: number } | null } | null} */
      let d = null;
      gesture(h, () => RESIZES[/** @type {string} */ (h.dataset.e)], {
        cls: ["resizing", "laydrag"],
        down: ev => {
          if (q(".app.stacked")) return false;
          ev.stopPropagation(); /* not the card's move gesture */
          const g0 = Object.assign({}, lay.last || layGeo(), { gen: S.view === "gen" });
          /** @type {{ ar: number, full: number, w0: number } | null} */
          let pic = null;
          /* a picture page: the PICTURE is the page's pane (v0.7c, the fit-page rule) — measured where it is, so the
             area shrinks to it and nothing moves at the press; its edges drag the picture, its ratio moves its height */
          const f = $("frame"),
            fr = f.getBoundingClientRect();
          if (g0.gen && fr.width > 0 && fr.height > 0) {
            const R = !!q(".app.pright"),
              aw = Math.max(g0.minR, fr.width), // its area: the picture, never narrower than the tab bar
              x = fr.left - (aw - fr.width) / 2 - SPACE.area; // in the pair's room (the window less its area gap)
            g0.rw = aw;
            g0.mL = R ? x : x - pairGap() - g0.pw;
            g0.mR = g0.W - g0.mL - g0.pw - pairGap() - g0.rw;
            pic = { ar: fr.width / fr.height, full: picFull(), w0: fr.width };
          }
          d = { e: /** @type {"dv" | "po" | "ro"} */ (h.dataset.e), x0: ev.clientX, g0, pic };
          lay.drag = true;
        },
        move: ev => {
          if (!d) return;
          layDrag(d.e, d.g0, ev.clientX - d.x0, d.e === "po" ? null : d.pic);
          lay.frameHold = true;
          sizeFrame();
          lay.frameHold = false;
          moveThumb(true);
        },
        end: () => {
          d = null;
          lay.vh = null; // the picture back to its kept size: it settles with the pair
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
          /* past its least or its room: with resistance (the rubber band); what's kept is the limit */
          const lo = paneLimits(pageId(), "h").lo,
            nh = rubber(want, lo, d.full, PIC_OVER);
          lay.vh = nh;
          lay.vtop = side ? d.t0 + (d.h0 - nh) / 2 : d.e === "b" ? d.t0 : d.t0 + (d.h0 - nh);
          if (!side && !q(".app.stacked")) setPaneSize(pageId(), "w", null, "side"); // the height decides; the width follows
          setPaneSize(pageId(), "h", Math.max(lo, Math.min(d.full, want)));
          sizeFrame();
        },
        end: () => {
          const full = d ? d.full : 0,
            nh = lay.vh;
          d = null;
          lay.vh = null;
          lay.vtop = null;
          if (nh && nh >= full * 0.995) setPaneSize(pageId(), "h", null); // the whole room: no cap (it settles there)
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
  /* Vertical: a panel's side edges (Queue, LoRAs, PNG Info — v0.7c). The panel widens or narrows about its centre
     (Vertical is centred, like the picture's side edges there): the edge follows the pointer, the width changes by
     twice the move. Each page keeps its own width in Vertical; past a limit (the tab bar, the window) with resistance,
     what's kept is the limit. Double-click: its default (a 1:1 plate at the room's height). */
  (function () {
    const rt = $("right");
    for (const side of ["l", "r"]) {
      const h = document.createElement("div");
      h.className = "vpedge " + side;
      h.dataset.tip = "Drag to resize the panel · double-click for its default width";
      rt.appendChild(h);
      /** @type {{ x0: number, w0: number, lo: number, hi: number } | null} */
      let d = null;
      gesture(h, () => RESIZES.vpedge, {
        cls: ["resizing", "laydrag"],
        down: ev => {
          if (!q(".app.stacked") || S.view === "gen") return false;
          ev.stopPropagation();
          d = {
            x0: ev.clientX,
            w0: rt.getBoundingClientRect().width,
            ...paneLimits(pageId(), "w", { o: "vert" }), // the tab bar .. the window (the Queue, PNG Info: their own)
          };
        },
        move: ev => {
          if (!d) return;
          const want = d.w0 + 2 * (side === "r" ? 1 : -1) * (ev.clientX - d.x0);
          lay.vw = rubber(want, d.lo, d.hi, RUBBER);
          setPaneSize(pageId(), "w", Math.max(d.lo, Math.min(d.hi, want)), "vert");
          sizeFrame();
        },
        end: () => {
          d = null;
          lay.vw = null; // the kept width: it settles there
          save();
          sizeFrame();
        },
      });
      h.addEventListener("dblclick", () => {
        setPaneSize(pageId(), "w", null, "vert");
        save();
        sizeFrame();
      });
    }
  })();
  /* a panel's top and bottom edges (Queue, LoRAs, PNG Info — v0.7c): its height. Like the picture's: the edge follows
     the pointer and the other side holds; past a limit (its least, its room) with resistance; on release it settles
     to its place (centred side by side, at the top in Vertical) and keeps the height. Double-click: the whole room. */
  (function () {
    const rt = $("right"),
      rp = $("rpanel");
    for (const side of ["t", "b"]) {
      const h = document.createElement("div");
      h.className = "phedge " + side;
      h.dataset.tip = "Drag to resize the panel · double-click for its full height";
      rt.appendChild(h);
      /** @type {{ y0: number, h0: number, t0: number, room: number } | null} */
      let d = null;
      gesture(h, () => RESIZES.phedge, {
        cls: ["vresizing", "laydrag"],
        down: ev => {
          if (S.view === "gen") return false;
          ev.stopPropagation();
          d = {
            y0: ev.clientY,
            h0: rp.offsetHeight,
            t0: parseFloat(rp.style.marginTop) || 0,
            room: lay.proom || rp.offsetHeight,
          };
        },
        move: ev => {
          if (!d) return;
          const dy = ev.clientY - d.y0,
            top = side === "t",
            want = top ? d.h0 - dy : d.h0 + dy,
            hi = top ? d.h0 + d.t0 : d.room - d.t0, // up to the room's top (its bottom pinned) or its bottom
            lo = paneLimits(pageId(), "h", { roomH: d.room }).lo,
            nh = rubber(want, lo, hi, RUBBER);
          lay.ph = nh;
          lay.ptop = top ? d.t0 + d.h0 - nh : d.t0; // the other side holds
          setPaneSize(pageId(), "h", Math.max(lo, Math.min(hi, want)));
          sizeFrame();
        },
        end: () => {
          const room = d ? d.room : 0;
          d = null;
          lay.ph = null;
          lay.ptop = null; // it settles to its place, with the height kept
          if ((paneSizeH() ?? 0) >= room - 1) setPaneSize(pageId(), "h", null); // the whole room: no height of its own
          save();
          sizeFrame();
        },
      });
      h.addEventListener("dblclick", () => {
        setPaneSize(pageId(), "h", null);
        save();
        sizeFrame();
      });
    }
    const paneSizeH = () => paneSize().h;
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
    const L = $("left");
    for (const side of ["l", "r"]) {
      const h = document.createElement("div");
      h.className = "sedge " + side;
      h.dataset.tip = "Drag to resize the prompt box · double-click for its default width";
      L.appendChild(h);
      /** a Vertical side edge being dragged: where the pointer started, the box's width then, its limits. The box
       * widens or narrows about its centre (Vertical is centred: the picture's and the panels' sides work the same),
       * the edge under the pointer; layoutLeft writes the width (card.swHold while held) — one writer
       * @type {{ x0: number, w0: number, lo: number, hi: number } | null} */
      let d = null;
      gesture(h, () => RESIZES.sedge, {
        cls: ["resizing", "laydrag"],
        down: ev => {
          if (!q(".app.stacked")) return false;
          ev.stopPropagation();
          d = { x0: ev.clientX, w0: stackW(), ...paneLimits("box", "w", { o: "vert" }) };
        },
        move: ev => {
          if (!d) return;
          const want = d.w0 + 2 * (side === "r" ? 1 : -1) * (ev.clientX - d.x0);
          S.vfit = false;
          card.swHold = rubber(want, d.lo, d.hi, RUBBER); // past a limit: with resistance
          setPaneSize("box", "w", Math.max(d.lo, Math.min(d.hi, want)), "vert"); // what's kept is the limit
          layoutLeft();
        },
        end: () => {
          d = null;
          card.swHold = 0; // the kept width: it settles there
          save();
          updHm();
          layoutLeft();
        },
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
