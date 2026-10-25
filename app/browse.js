/* Kiln · stepping through finished pictures: the arrows, ← / →, and the status line while browsing */
import { $ } from "./dom.js";
import { doneList } from "./jobs.js";
import { lay } from "./layout.js";
import { frameMorph } from "./morph.js";
import { PV, browsed, onShow, picMode, pv } from "./picstate.js";
import { S } from "./state.js";
import { V, openViewer } from "./viewer.js";

export function genNav(dir, dry) {
  const m = picMode(),
    cur = onShow(),
    L = doneList();
  let i = cur ? L.findIndex(x => x.id === cur.id) : L.length;
  if (i < 0) i = L.length;
  const n = i + dir; /* the render / the empty frame sit after the newest */
  if (n < 0) return false;
  if (n >= L.length && m !== "browse" && m !== "still")
    return false; /* past the newest: out of the Gallery, or off the finished picture — to the render / the empty frame */
  if (!dry) {
    const fs = $("frame").style,
      o = { w: parseFloat(fs.width), h: parseFloat(fs.height), l: parseFloat(fs.left), t: parseFloat(fs.top) };
    PV.dir = dir;
    if (n >= L.length) pv("close", "arrow");
    else pv("browse", L[n]);
    if (n < L.length && S.view === "gen" && Math.abs(parseFloat(fs.width) / parseFloat(fs.height) - o.w / o.h) > 0.02)
      frameMorph(o);
  }
  return true;
}
export function vNav(dir, dry) {
  const L = doneList(),
    i = L.findIndex(x => x.id === (V.job && V.job.id)),
    t = L[i + dir];
  if (i < 0 || !t) return false;
  if (!dry) openViewer(t);
  return true;
}
export function navFn(el) {
  return el.closest("#viewer") ? vNav : genNav;
}
export function updNav() {
  document.querySelectorAll(".nav").forEach(b => b.classList.toggle("off", !navFn(b)(+b.dataset.nav, true)));
} /* the render's prompt: click the render itself (the status line doubled it) */
export function browseStatus() {
  const b = browsed(),
    on = !!(b && PV.promptClosed);
  $("prog").classList.toggle("showp", on);
}

/* start-up wiring: the on-picture arrows (held under the pointer while you click them), ← / → (called from main.js, in order) */
export function initBrowse() {
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
}

export function browseTo(j) {
  PV.promptClosed = false;
  pv("browse", j);
}
