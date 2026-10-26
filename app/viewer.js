// @ts-check
/* Kiln · full-size viewer, clicking the image */
import { deleteJob, openInApp } from "./actions.js";
import { updNav } from "./browse.js";
import { $, hit, target } from "./dom.js";
import { lay, rowMode, sizeFrame } from "./layout.js";
import { onShow, picMode, pv, pvSync } from "./picstate.js";
import { paint } from "./pictures.js";
import { SIZES } from "./presets.js";
import { S } from "./state.js";
import { tabSync } from "./tabs.js";

/* ======================= full-size viewer ======================= */
/** the full-size viewer: the picture on show, its zoom and pan, its fitted size
 * @type {{ job: import("./types.js").Job | null, s: number, tx: number, ty: number, fit: number, w: number, h: number }} */
export const V = { job: null, s: 1, tx: 0, ty: 0, fit: 1, w: 0, h: 0 };
/** @param {import("./types.js").Job | null | undefined} j */
export function openViewer(j) {
  if (!j || j.status !== "done") return;
  V.job = j;
  const [w, h] = SIZES[j.mp][j.ar];
  V.w = w;
  V.h = h;
  const cv = $("vcv");
  paint(cv, j);
  cv.style.width = w + "px";
  cv.style.height = h + "px";
  $("viewer").classList.add("show");
  vFit();
}
function vFit() {
  V.fit = Math.min(innerWidth / V.w, innerHeight / V.h) * 0.94;
  vSet(V.fit, (innerWidth - V.w * V.fit) / 2, (innerHeight - V.h * V.fit) / 2);
}
function vClamp() {
  const sw = V.w * V.s,
    sh = V.h * V.s;
  V.tx = sw <= innerWidth ? (innerWidth - sw) / 2 : Math.min(0, Math.max(innerWidth - sw, V.tx));
  V.ty = sh <= innerHeight ? (innerHeight - sh) / 2 : Math.min(0, Math.max(innerHeight - sh, V.ty));
}
/** the zoom and the pan @param {number} s @param {number} tx @param {number} ty */
function vSet(s, tx, ty) {
  V.s = s;
  V.tx = tx;
  V.ty = ty;
  vClamp();
  $("vcv").style.transform = `translate(${V.tx}px,${V.ty}px) scale(${V.s})`;
  $("vzoom").textContent = Math.round(V.s * 100) + "%";
  $("viewer").classList.toggle("zoomed", V.s > V.fit + 0.001);
}
/** zoom to ns, keeping the point (cx, cy) where it is @param {number} ns @param {number} cx @param {number} cy */
function vZoomAt(ns, cx, cy) {
  ns = Math.max(V.fit, Math.min(4, ns));
  vSet(ns, cx - (cx - V.tx) * (ns / V.s), cy - (cy - V.ty) * (ns / V.s));
}
export function closeViewer() {
  $("viewer").classList.remove("show");
  V.job = null;
}
// browsing: back to the live view; otherwise: clear the finished image (same as changing size or ratio does)
/* ✕ closes the image: idle -> the empty Ready screen (← brings it back); while generating -> back to the render */
export function closeShown() {
  pv("close");
}

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initViewer() {
  (function () {
    const el = $("viewer");
    let down = /** @type {{ x: number, y: number, tx: number, ty: number, img: boolean } | null} */ (null),
      moved = false,
      clickT = /** @type {number | undefined} */ (/** @type {unknown} */ (null));
    el.addEventListener(
      "wheel",
      e => {
        e.preventDefault();
        vZoomAt(V.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
      },
      { passive: false },
    );
    el.addEventListener("pointerdown", e => {
      if (hit(e, ".vclose,.nav")) return;
      down = { x: e.clientX, y: e.clientY, tx: V.tx, ty: V.ty, img: target(e).id === "vcv" };
      moved = false;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", e => {
      if (!down) return;
      const dx = e.clientX - down.x,
        dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (moved && V.s > V.fit + 0.001) {
        el.classList.add("panning");
        vSet(V.s, down.tx + dx, down.ty + dy);
      }
    });
    el.addEventListener("pointerup", e => {
      el.classList.remove("panning");
      const wasDown = down;
      down = null;
      if (!wasDown || moved) return;
      if (!wasDown.img) {
        closeViewer();
        return;
      }
      clearTimeout(clickT);
      const x = e.clientX,
        y = e.clientY;
      clickT = setTimeout(() => {
        if (V.s > V.fit + 0.001) vFit();
        else vZoomAt(1, x, y);
      }, 230);
    });
    el.addEventListener("dblclick", () => {
      clearTimeout(clickT);
      if (V.job) openInApp(V.job);
    });
    $("vclose").onclick = closeViewer;
  })();
  /* click the finished image (Generating view and queue overlay) */
  (function () {
    let t = /** @type {number | undefined} */ (/** @type {unknown} */ (null));
    /** @param {HTMLElement} el @param {() => import("./types.js").Job | null | undefined} getJob */
    function bind(el, getJob) {
      el.addEventListener("click", (/** @type {Event} */ e) => {
        if (hit(e, ".side,.nav,.bclose,.cbtn,.miss") || el.classList.contains("held")) return;
        if (picMode() === "live" && S.view === "gen") {
          pv("peekRender");
          return;
        }
        /* the render: its prompt in the box (✕ / Esc: your draft) */
        const j = getJob();
        if (!j || j.status !== "done" || j.missing) return;
        clearTimeout(t);
        t = setTimeout(() => openViewer(j), 230);
      });
      el.addEventListener("dblclick", (/** @type {Event} */ e) => {
        if (hit(e, ".side,.nav,.bclose,.cbtn,.miss") || el.classList.contains("held")) return;
        const j = getJob();
        if (!j || j.status !== "done" || j.missing) return;
        clearTimeout(t);
        openInApp(j);
      });
    }
    bind($("frame"), () => onShow());
  })();
  setInterval(() => {
    tabSync();
    if (typeof rowMode === "function" && lay.row && rowMode() !== lay.row) sizeFrame();
    pvSync();
    updNav();
  }, 300);
  $("bclose").onclick = e => {
    e.stopPropagation();
    closeShown();
  };
  document.addEventListener("keydown", e => {
    if (e.key !== "Delete" || e.ctrlKey || e.altKey) return;
    const a = /** @type {HTMLElement | null} */ (document.activeElement);
    if (
      (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) ||
      $("modal").classList.contains("show")
    )
      return;
    const j = $("viewer").classList.contains("show") ? V.job : S.view === "gen" ? onShow() : null;
    if (j && j.status === "done" && !$("frame").classList.contains("held")) {
      e.preventDefault();
      deleteJob(j);
    }
  });
}
