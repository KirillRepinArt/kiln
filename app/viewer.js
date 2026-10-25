/* Kiln · full-size viewer, clicking the image */
/* ======================= full-size viewer ======================= */
const V = { job: null, s: 1, tx: 0, ty: 0, fit: 1, w: 0, h: 0 };
function openViewer(j) {
  if (!j || j.status !== "done") return;
  V.job = j;
  const [w, h] = SIZES[j.mp][j.ar];
  V.w = w;
  V.h = h;
  const cv = $("vcv");
  paint(cv, j, 1);
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
function vSet(s, tx, ty) {
  V.s = s;
  V.tx = tx;
  V.ty = ty;
  vClamp();
  $("vcv").style.transform = `translate(${V.tx}px,${V.ty}px) scale(${V.s})`;
  $("vzoom").textContent = Math.round(V.s * 100) + "%";
  $("viewer").classList.toggle("zoomed", V.s > V.fit + 0.001);
}
function vZoomAt(ns, cx, cy) {
  ns = Math.max(V.fit, Math.min(4, ns));
  vSet(ns, cx - (cx - V.tx) * (ns / V.s), cy - (cy - V.ty) * (ns / V.s));
}
function closeViewer() {
  $("viewer").classList.remove("show");
  V.job = null;
}
// browsing: back to the live view; otherwise: clear the finished image (same as changing size or ratio does)
/* ✕ closes the image: idle -> the empty Ready screen (← brings it back); while generating -> back to the render */
function closeShown() {
  pv("close");
}

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
function initViewer() {
  (function () {
    const el = $("viewer");
    let down = null,
      moved = false,
      clickT = null;
    el.addEventListener(
      "wheel",
      e => {
        e.preventDefault();
        vZoomAt(V.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
      },
      { passive: false },
    );
    el.addEventListener("pointerdown", e => {
      if (e.target.closest(".vclose,.nav")) return;
      down = { x: e.clientX, y: e.clientY, tx: V.tx, ty: V.ty, img: e.target.id === "vcv" };
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
    el.addEventListener("dblclick", e => {
      clearTimeout(clickT);
      if (V.job) openInApp(V.job);
    });
    $("vclose").onclick = closeViewer;
  })();
  /* click the finished image (Generating view and queue overlay) */
  (function () {
    let t = null;
    function bind(el, getJob) {
      el.addEventListener("click", e => {
        if (e.target.closest(".side,.nav,.bclose,.cbtn,.miss") || el.classList.contains("held")) return;
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
      el.addEventListener("dblclick", e => {
        if (e.target.closest(".side,.nav,.bclose,.cbtn,.miss") || el.classList.contains("held")) return;
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
    if (typeof rowMode === "function" && sizeFrame.mode && rowMode() !== sizeFrame.mode) sizeFrame();
    pvSync();
    updNav();
  }, 300);
  $("bclose").onclick = e => {
    e.stopPropagation();
    closeShown();
  };
  document.addEventListener("keydown", e => {
    if (e.key !== "Delete" || e.ctrlKey || e.altKey) return;
    const a = document.activeElement;
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
