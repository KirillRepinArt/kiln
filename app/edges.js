/* Kiln · the edges you drag: the prompt box's height, Vertical's slot line and side edges, the panels' widths, the
   picture's top / bottom edges — and the edit buttons beside the picture showing on hover. The sizes they set are in
   S.lay (layout.js does the maths and applies them) */
import { toast } from "./boot.js";
import { applyPH, chipsH, layoutLeft, lyUnfreeze, stackW, updHm } from "./cardlayout.js";
import { $ } from "./dom.js";
import { BAR, lay, layDef, layDrag, layGeo, layRelease, sizeFrame } from "./layout.js";
import { PWMIN } from "./layoutmath.js";
import { S, save } from "./state.js";
import { moveThumb } from "./tabs.js";

/* start-up wiring: every edge you drag, and the edit buttons' hover (called from main.js, in order) */
export function initEdges() {
  /* the prompt box's bottom edge. Side by side: its height. Vertical: its slot (as the line above the title) — the edge
   follows the pointer down into the room below, and on release the layout settles (the picture gives up that room),
   like every outer edge */
  (function () {
    const g = $("vedge");
    let y0 = 0,
      h0 = 0,
      stk = false,
      vH = 0;
    g.addEventListener("pointerdown", e => {
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      g.classList.add("drag");
      document.body.classList.add("vresizing");
      $("left").classList.add("nodur");
      y0 = e.clientY;
      h0 = $("left").getBoundingClientRect().height;
      stk = !!document.querySelector(".app.stacked");
      if (stk) {
        lay.vbDrag = true;
        vH = h0;
        $("lcol").classList.add("vbdrag");
      }
    });
    g.addEventListener("pointermove", e => {
      if (!g.classList.contains("drag")) return;
      if (!(e.buttons & 1)) {
        g.dispatchEvent(new PointerEvent("pointerup"));
        return;
      }
      if (stk) {
        const col = $("lcol"),
          TS = parseFloat(col.style.getPropertyValue("--ts")) || 64,
          room = innerHeight - 10 - $("left").getBoundingClientRect().top - chipsH();
        vH = Math.round(Math.max(200, Math.min(innerHeight * 0.7, room, h0 + e.clientY - y0)));
        col.style.setProperty("--lh", vH + "px");
        col.style.setProperty("--chtop", TS + vH + 10 + "px");
        return;
      }
      const max = $("left").parentElement.getBoundingClientRect().height - 36;
      S.pph = Math.max(240, Math.min(max, Math.round(h0 + e.clientY - y0)));
      applyPH();
    });
    g.addEventListener("pointerup", () => {
      if (!g.classList.contains("drag")) return;
      g.classList.remove("drag");
      document.body.classList.remove("vresizing");
      $("left").classList.remove("nodur");
      if (stk) {
        S.sch = vH;
        lay.vbDrag = false;
        $("lcol").classList.remove("vbdrag");
        save();
        layoutLeft();
        sizeFrame();
        return;
      }
      lyUnfreeze();
      layoutLeft();
      save();
    });
    g.addEventListener("dblclick", () => {
      if (document.querySelector(".app.stacked")) {
        S.sch = 0;
        save();
        layoutLeft();
        sizeFrame();
        toast("Prompt height back to auto");
        return;
      }
      S.pph = 0;
      applyPH();
      save();
      toast("Prompt height back to auto");
    });
  })();
  (function () {
    const g = $("hsplit");
    let y0 = 0,
      h0 = 0;
    g.addEventListener("pointerdown", e => {
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      g.classList.add("drag");
      document.body.classList.add("vresizing");
      y0 = e.clientY;
      h0 = $("left").getBoundingClientRect().height;
    });
    g.addEventListener("pointermove", e => {
      if (!g.classList.contains("drag")) return;
      if (!(e.buttons & 1)) {
        g.dispatchEvent(new PointerEvent("pointerup"));
        return;
      }
      S.sch = Math.max(200, Math.min(Math.round(innerHeight * 0.7), Math.round(h0 - (e.clientY - y0))));
      layoutLeft();
    });
    g.addEventListener("pointerup", () => {
      g.classList.remove("drag");
      document.body.classList.remove("vresizing");
      save();
    });
    g.addEventListener("dblclick", () => {
      S.sch = 0;
      save();
      layoutLeft();
      toast("Image / prompt split back to auto");
    });
  })();
  /* the panel edges (Phase 2a): po = the prompt's outer edge, dv = the divider between the prompt and the image area
   (a strip on each side of the gap, both the same boundary), ro = the image area's outer edge. Double-click: that
   panel back to its default width (the divider: both). */
  (function () {
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
    let d = null;
    for (const h of hs) {
      h.addEventListener("pointerdown", ev => {
        if (document.querySelector(".app.stacked") || ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        h.setPointerCapture(ev.pointerId); /* not the card's move gesture */
        d = { e: h.dataset.e, x0: ev.clientX, g0: Object.assign({}, lay.last || layGeo(), { gen: S.view === "gen" }) };
        lay.drag = true;
        h.classList.add("drag");
        document.body.classList.add("resizing", "laydrag");
        if (h.dataset.e !== "po") $("right").classList.add("edgehint");
      });
      h.addEventListener("pointermove", ev => {
        if (!d) return;
        if (!(ev.buttons & 1)) {
          up();
          return;
        }
        layDrag(d.e, d.g0, ev.clientX - d.x0);
        lay.frameHold = true;
        sizeFrame();
        lay.frameHold = false;
        moveThumb(true);
      });
      const up = () => {
        if (!d) return;
        d = null;
        h.classList.remove("drag");
        document.body.classList.remove("resizing", "laydrag");
        $("right").classList.remove("edgehint");
        save();
        layRelease();
        setTimeout(() => {
          sizeFrame();
          moveThumb(true);
        }, 480);
      }; /* after the glide */
      h.addEventListener("pointerup", up);
      h.addEventListener("pointercancel", up);
      h.addEventListener("dblclick", () => {
        const df = layDef();
        if (h.dataset.e !== "ro") S.lay.pw = df.pw;
        if (h.dataset.e !== "po") {
          if (S.view === "gen") S.lay.iw = null;
          else S.lay.rw = df.rw;
        }
        save();
        layRelease();
        moveThumb(true);
      }); /* defaults as shares of this window */
      h.addEventListener("pointerenter", () => {
        if (h.dataset.e !== "po") $("right").classList.add("edgehint");
      });
      h.addEventListener("pointerleave", () => {
        if (!d) $("right").classList.remove("edgehint");
      });
    }
  })();
  /* the image area's top and bottom edges (Generating, side by side): the largest height the picture may be. The edge
   follows the cursor and the other one holds still; on release it all glides into place (height → width → centring). */
  (function () {
    let d = null;
    document.querySelectorAll(".hedge").forEach(h => {
      h.addEventListener("pointerenter", () => $("right").classList.add("edgehint"));
      h.addEventListener("pointerleave", () => {
        if (!d) $("right").classList.remove("edgehint");
      });
      h.addEventListener("pointerdown", ev => {
        if (S.view !== "gen" || ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        h.setPointerCapture(ev.pointerId); /* Vertical too (its own limit) */
        const f = $("frame");
        d = {
          e: h.dataset.e,
          x0: ev.clientX,
          y0: ev.clientY,
          w0: f.offsetWidth,
          h0: f.offsetHeight,
          t0: f.offsetTop,
          full: $("stage").getBoundingClientRect().height - BAR,
        };
        document.body.classList.add("vresizing", "laydrag");
        $("right").classList.add("edgehint");
      });
      h.addEventListener("pointermove", ev => {
        if (!d) return;
        if (!(ev.buttons & 1)) {
          up();
          return;
        }
        const dy = ev.clientY - d.y0,
          dx = ev.clientX - d.x0,
          side = d.e === "l" || d.e === "r";
        /* a side edge (Vertical): the picture scales about its centre, its shape kept — the edge follows the cursor */
        const want = side ? ((d.w0 + 2 * (d.e === "r" ? dx : -dx)) * d.h0) / d.w0 : d.e === "b" ? d.h0 + dy : d.h0 - dy;
        const nh = Math.max(200, Math.min(d.full, want));
        lay.vh = nh;
        lay.vtop = side ? d.t0 + (d.h0 - nh) / 2 : d.e === "b" ? d.t0 : d.t0 + (d.h0 - nh);
        S.lay[document.querySelector(".app.stacked") ? "vih" : "ih"] = nh / d.full;
        sizeFrame();
      });
      const up = () => {
        if (!d) return;
        d = null;
        lay.vh = null;
        lay.vtop = null;
        if (S.lay.ih > 0.995) S.lay.ih = null;
        if (S.lay.vih > 0.995) S.lay.vih = null;
        document.body.classList.remove("vresizing", "laydrag");
        $("right").classList.remove("edgehint");
        save();
        sizeFrame();
      };
      h.addEventListener("pointerup", up);
      h.addEventListener("pointercancel", up);
      h.addEventListener("dblclick", () => {
        S.lay[document.querySelector(".app.stacked") ? "vih" : "ih"] = null;
        save();
        sizeFrame();
      });
    });
  })();
  /* the edit buttons appear while the pointer is over the picture or the column beside it (one zone, so you never chase
   them) and stay ~300 ms after it leaves, so a diagonal path doesn't lose them */
  (function () {
    let t = null;
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
    for (const el of [$("frame"), $("gtools"), ...document.querySelectorAll(".gnav")]) {
      el.addEventListener("pointerenter", on);
      el.addEventListener("pointerleave", off);
    }
  })();
  (function () {
    const L = $("left"),
      col = $("lcol");
    let d = null;
    for (const side of ["l", "r"]) {
      const h = document.createElement("div");
      h.className = "sedge " + side;
      h.dataset.tip = "Drag to resize the prompt box · double-click for its default width";
      L.appendChild(h);
      h.addEventListener("pointerdown", ev => {
        if (!document.querySelector(".app.stacked") || ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        h.setPointerCapture(ev.pointerId);
        d = { side, x0: ev.clientX, w0: stackW() };
        document.body.classList.add("resizing", "laydrag");
      });
      h.addEventListener("pointermove", ev => {
        if (!d) return;
        if (!(ev.buttons & 1)) {
          up();
          return;
        }
        const dx = ev.clientX - d.x0,
          max = innerWidth - 36;
        const w = Math.max(Math.min(PWMIN, max), Math.min(max, d.w0 + (side === "r" ? dx : -dx)));
        S.vfit = false;
        S.lay = S.lay || layDef();
        S.lay.sw = w;
        col.style.setProperty("--sw", w + "px");
        col.style.setProperty("--soff", ((side === "r" ? 1 : -1) * (w - d.w0)) / 2 + "px");
      }); /* the other edge stays put */
      const up = () => {
        if (!d) return;
        d = null;
        document.body.classList.remove("resizing", "laydrag");
        col.style.setProperty("--soff", "0px");
        save();
        updHm();
        layoutLeft();
      }; /* glides back to centre */
      h.addEventListener("pointerup", up);
      h.addEventListener("pointercancel", up);
      h.addEventListener("dblclick", () => {
        if (S.lay) S.lay.sw = null;
        S.vfit = false;
        save();
        updHm();
        layoutLeft();
      });
    }
  })();
}
