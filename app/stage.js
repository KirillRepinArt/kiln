/* Kiln · the picture area's wiring at start-up (tabs, edges, keys, arrows); the code it wires lives in tabs.js,
   layout.js, browse.js, morph.js */
import { addJobs, stopJob } from "./actions.js";
import { syncH } from "./boot.js";
import { genNav, navFn, updNav, vNav } from "./browse.js";
import { applyMode } from "./cardlayout.js";
import { applyPH, closePops } from "./composer.js";
import { $ } from "./dom.js";
import { askNotify } from "./effects.js";
import { current } from "./jobs.js";
import { lay, sizeFrame } from "./layout.js";
import { PV, browsed, doneById, picMode, pv } from "./picstate.js";
import { loadJob } from "./queue.js";
import { S } from "./state.js";
import { moveThumb, showView, tabGo, tabSync } from "./tabs.js";
import { closeViewer } from "./viewer.js";

/* the caption itself: live.js */

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
let lrT = null; // the window-resize class's timer
export function initStage() {
  document.querySelectorAll(".tab").forEach(
    t =>
      (t.onclick = () =>
        tabGo(() => {
          const v = t.dataset.v;
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
  /* the picture's arrows live on a fixed layer: while they show they follow the picture's side edges every frame (it
   glides), but while you're clicking through with them they hold their place on SCREEN (Photos / Lightroom: navigation
   never runs away from the pointer); ~1 s after the last click they glide to the new picture's edges */
  (function () {
    const [pv, nx] = document.querySelectorAll(".gnav");
    /* the arrow you clicked stays exactly where it is for as long as your pointer is on it (click as fast as you like);
    move off it and it slides to the picture's edge. The other one follows the picture at once. Keys don't hold anything */
    for (const el of [pv, nx])
      el.addEventListener("pointerleave", () => {
        if (lay.navHold === el) {
          lay.navHold = null;
          el.classList.add("glide");
          clearTimeout(el._t);
          el._t = setTimeout(() => el.classList.remove("glide"), 460);
        }
      });
    function tick() {
      if (document.body.classList.contains("navs")) {
        const r = $("frame").getBoundingClientRect(),
          y = Math.round(r.top + r.height / 2 - 20) + "px";
        for (const [el, x] of [
          [pv, Math.round(r.left + 10) + "px"],
          [nx, Math.round(r.right - 50) + "px"],
        ])
          if (el !== lay.navHold && (el.style.left !== x || el.style.top !== y)) {
            el.style.left = x;
            el.style.top = y;
          }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
  /* the resize outline: drawn on the page's bottom layer (fixed, under every panel, so nothing clips it), 12 px round
   the picture, following it every frame while an edge is hovered or held */
  (function () {
    const fh = $("fithint"),
      rt = $("right");
    let on = false;
    let offAt = 0;
    function tick() {
      const want = rt.classList.contains("edgehint") && S.view === "gen";
      if (want) offAt = 0;
      else if (!offAt) {
        offAt = performance.now();
        fh.classList.remove("show");
      }
      if (!want && performance.now() - offAt > 800) {
        on = false;
        return;
      } /* it fades out late and slowly (CSS): keep it on the picture meanwhile */
      const r = $("frame").getBoundingClientRect(),
        O = 12;
      fh.style.left = r.left - O + "px";
      fh.style.top = r.top - O + "px";
      fh.style.width = r.width + 2 * O + "px";
      fh.style.height = r.height + 2 * O + "px";
      if (want) fh.classList.add("show");
      requestAnimationFrame(tick);
    }
    new MutationObserver(() => {
      if (!on && rt.classList.contains("edgehint")) {
        on = true;
        tick();
      }
    }).observe(rt, { attributes: true, attributeFilter: ["class"] });
  })();
  /* the holds: over the picture, over the prompt (card, its name row, its LoRA chips) */
  {
    let t = null;
    const on = () => {
        clearTimeout(t);
        lay.overImg = true;
      },
      off = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          lay.overImg = false;
          sizeFrame();
        }, 120);
      };
    for (const el of [$("frame"), ...document.querySelectorAll(".gnav")]) {
      el.addEventListener("pointerenter", on);
      el.addEventListener("pointerleave", off);
    }
  }
  $("lcol").addEventListener("pointerdown", () => {
    lay.pressCard = true;
  });
  /* letting go anywhere (a menu choice, a click, an edge) lets the layout catch up at once */
  addEventListener("pointerup", () => {
    lay.pressCard = false;
    setTimeout(sizeFrame, 0);
  });
  addEventListener("click", () => setTimeout(sizeFrame, 0));
  window.addEventListener("resize", () => {
    document.body.classList.add("liveresize");
    clearTimeout(lrT);
    lrT = setTimeout(() => document.body.classList.remove("liveresize"), 150);
    applyMode();
    applyPH();
    sizeFrame();
    syncH();
    moveThumb(true);
  });
  document.fonts && document.fonts.ready.then(() => moveThumb(true));
  document.addEventListener(
    "click",
    e => {
      const b = e.target.closest(".nav");
      if (!b) return;
      e.stopPropagation();
      if (b.classList.contains("gnav")) lay.navHold = b;
      navFn(b)(+b.dataset.nav);
      updNav();
    },
    true,
  );
  document.addEventListener("keydown", e => {
    if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    if ($("modal").classList.contains("show")) return;
    const f = $("viewer").classList.contains("show") ? vNav : S.view === "gen" ? genNav : null;
    if (f && f(e.key === "ArrowLeft" ? -1 : 1)) {
      e.preventDefault();
      updNav();
    }
  });
  $("play").onclick = () => {
    askNotify();
    addJobs();
  };
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addJobs();
    }
    if (e.key === "Escape") {
      if ($("viewer").classList.contains("show")) {
        closeViewer();
        return;
      }
      if ($("modal").classList.contains("show")) {
        $("modal").classList.remove("show");
        return;
      }
      if ((PV.browse != null || PV.still) && !(e.target.closest && e.target.closest(".pwrapT"))) {
        pv("close");
        return;
      } // Esc outside the editor = the picture's ✕
      closePops();
    }
  });
  $("stopBtn").onclick = () => stopJob(current());
  $("prog").addEventListener("click", e => {
    if (e.target.closest(".stop,.resume")) return;
    const m = picMode();
    if (m === "browse") {
      if (PV.promptClosed) {
        PV.promptClosed = false;
        loadJob(browsed());
      }
      return;
    }
    if (m === "still") {
      if (current()) pv("toRender");
      else if (PV.news != null) pv("browse", doneById(PV.news));
      return;
    }
  });
}
