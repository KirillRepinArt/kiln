// @ts-check
/* Kiln · pictures: the real files and the live previews — loading, the small cache, drawing them on a canvas,
   the cross-fade between two, the missing-file card */
import { $ } from "./dom.js";
import { api } from "./live.js";
import { shownDone } from "./picstate.js";
import { S } from "./state.js";

/* ---------- images: real files and live previews, cached ---------- */
export const imgs =
    /** @type {Map<string | null, { i: HTMLImageElement, p: Promise<HTMLImageElement | null> }>} the decoded pictures, by URL (null: no file — never found) */ (
      new Map()
    ),
  IMAX = 16; /* the pictures used last (the cache used to keep every picture you'd seen, decoded) */
/** a picture, decoding (from the cache when it's there) @param {string} url */
export function img(url) {
  let e = imgs.get(url);
  if (e) {
    imgs.delete(url);
    imgs.set(url, e);
    return e;
  }
  const i = new Image();
  i.decoding = "async";
  e = {
    i,
    p: new Promise(r => {
      i.onload = () => r(i);
      i.onerror = () => r(null);
    }),
  };
  i.src = url;
  imgs.set(url, e);
  while (imgs.size > IMAX) imgs.delete(/** @type {string} */ (imgs.keys().next().value)); // the oldest
  return e;
}
export function __imgsN() {
  return imgs.size;
}
/** @param {import("./types.js").Job} j @returns {string | null} */
export function urlFor(j) {
  return j.file ? `/files/${encodeURIComponent(j.file)}?j=${j.id}` : null;
}
/* what the frame's canvas shows has ONE writer (2026-10-28): what draws it says what it drew — a finished picture's id,
   or "render:<job>" for a preview. The render's previews didn't, so the canvas kept the last finished picture's id:
   an arrow from a running render to that picture skipped copying the screen, and the crop-and-reveal cropped a stale
   copy instead (the "zoomed picture first", the user's note) */
/** @param {HTMLCanvasElement} cv @param {HTMLImageElement} im @param {boolean} natural at the picture's own size (the viewer)
 * @param {number | string} [what] what it is (the frame's canvas): a finished picture's id, or "render:<job>" */
export function drawTo(cv, im, natural, what) {
  const dpr = devicePixelRatio || 1,
    iw = im.naturalWidth,
    ih = im.naturalHeight;
  if (natural) {
    if (cv.width !== iw || cv.height !== ih) {
      cv.width = iw;
      cv.height = ih;
    }
    const c = /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d"));
    c.drawImage(im, 0, 0);
    return;
  }
  // the canvas takes its box's shape; the image keeps its own (a preview of another shape never gets stretched)
  const fd = cv.id === "cv" && $("frame").dataset,
    cw = (fd && +(/** @type {string} */ (fd.tw))) || cv.clientWidth || 300,
    ch = (fd && +(/** @type {string} */ (fd.th))) || cv.clientHeight || Math.round((cw * ih) / iw);
  const W = Math.max(64, Math.round(cw * dpr)),
    H = Math.max(64, Math.round(ch * dpr));
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const c = /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d"));
  c.imageSmoothingQuality = "high";
  c.clearRect(0, 0, W, H);
  const k = cv.id === "cv" ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
  c.drawImage(im, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  if (cv.id === "cv" && what != null) cv.dataset.shown = String(what);
}
/* a canvas only ever shows the image it was last asked for: while that one loads it is blank (never the previous
    picture or a cancelled job's preview stretched to the new shape), a load that lands after you moved on is dropped,
    and a file that's gone says so */
/* ---------- the old picture leaving has ONE owner (2026-10-31, ownership map V2) ----------
   Switching pictures: the one on show is copied to an overlay (#cvx) at its own size and fades out over the next —
   never an empty frame in between (Photos / Lightroom). This module alone writes the overlay's opacity: one state —
   idle → held (a copy of what was on screen) → fading → idle — and a fade is ONE animation, the cross-fade's by
   default or on the caller's own keyframes and clock (the crop-and-reveal, morph.js). The cross-fade (a CSS
   transition here) and the crop-and-reveal (an animation of its own there) used to fade it each their own way, kept
   apart by two flags (data-wait, data-morph) — the tracer's V2. The neighbours are decoded ahead (preload) */
/** @type {"idle" | "held" | "fading"} */
let ov = "idle";
/** what the overlay holds: the picture it copied (the canvas's data-shown) @type {string | undefined} */
let ovOf;
/** @type {Animation | null} */
let ovFade = null;
let ovTimer = 0;
const XFADE = { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }; // --t-200 · --e-standard
/** the overlay holds a picture, or is fading it out */
export const overlayShows = () => ov !== "idle";
/** hold a copy of what is on screen over the frame's canvas — unless that same picture is already held or leaving
 * @param {HTMLCanvasElement} cv the frame's canvas */
function overlayHold(cv) {
  const x = /** @type {HTMLCanvasElement} */ ($("cvx"));
  if (!x || cv.width < 2 || (ov !== "idle" && ovOf === cv.dataset.shown)) return;
  if (ovFade) ovFade.cancel();
  ovFade = null;
  clearTimeout(ovTimer);
  x.width = cv.width;
  x.height = cv.height;
  const c = /** @type {CanvasRenderingContext2D} */ (x.getContext("2d"));
  c.drawImage(cv, 0, 0);
  /* what was on screen, not the bare canvas: a render shows under its veil and embers — cropped without them, the
     render's preview read as another picture, zoomed (the user, 2026-10-28) */
  for (const id of ["veil", "embers"]) {
    const e = /** @type {HTMLCanvasElement | null} */ (document.getElementById(id));
    if (e && e.width > 1 && +getComputedStyle(e).opacity > 0.01 && getComputedStyle(e).display !== "none")
      c.drawImage(e, 0, 0, x.width, x.height);
  }
  x.style.width = cv.style.width;
  x.style.height = cv.style.height;
  x.style.opacity = "1";
  ov = "held";
  ovOf = cv.dataset.shown;
}
/** let the held picture go: it fades out — the cross-fade, now, or on a motion's own keyframes and clock (the
 * crop-and-reveal fades it at its swap); once faded the overlay is emptied, so a later fade shows nothing old
 * @param {{ keyframes: Keyframe[], duration: number, startTime: number }} [fade] */
export function overlayRelease(fade) {
  if (ov !== "held") return;
  clearTimeout(ovTimer);
  const x = /** @type {HTMLCanvasElement} */ ($("cvx")),
    a = x.animate(fade ? fade.keyframes : [{ opacity: 1 }, { opacity: 0 }], {
      ...(fade ? { duration: fade.duration } : XFADE),
      fill: "forwards",
    });
  if (fade) a.startTime = fade.startTime;
  ov = "fading";
  ovFade = a;
  a.onfinish = () => {
    if (ovFade !== a) return;
    ovFade = null;
    ov = "idle";
    x.style.opacity = "";
    a.cancel();
    x.width = 1;
    x.height = 1;
  };
}
/** a new picture is being drawn on the frame's canvas: the one on show is held over it
 * @param {HTMLCanvasElement} cv @param {number} id */
function xfadeFrom(cv, id) {
  if (cv.id !== "cv" || !cv.dataset.shown || cv.dataset.shown === String(id)) return;
  overlayHold(cv);
}
/** …and it's drawn: the held one fades out (if a crop-and-reveal took it, it is already fading on that clock)
 * @param {HTMLCanvasElement} cv */
function xfadeGo(cv) {
  if (cv.id !== "cv") return;
  cv.dataset.cw = cv.style.width;
  cv.dataset.ch = cv.style.height;
  overlayRelease();
}
/* any other change of what's on show (leaving the Gallery, ✕, the render taking over): the picture fades out the same
    way — over whatever comes next (a render's first preview), or soon if nothing does (a clean screen) */
export function xfadeSnap() {
  overlayHold(/** @type {HTMLCanvasElement} */ ($("cv")));
  clearTimeout(ovTimer);
  ovTimer = setTimeout(() => overlayRelease(), 260);
}
/* a render's preview landed over it: the held picture goes now */
export function xfadeEnd() {
  overlayRelease();
}
/** @param {import("./types.js").Job} j */
export function preload(j) {
  const u = urlFor(j);
  if (!u || j.missing) return;
  const e = img(u);
  try {
    e.i.decode().catch(() => {});
  } catch (_) {}
}
/** a finished picture onto a canvas (the frame's, the viewer's) @param {HTMLCanvasElement} cv @param {import("./types.js").Job} j */
export function paint(cv, j) {
  const u = urlFor(j);
  if (!u) return;
  xfadeFrom(cv, j.id);
  if (j.missing) {
    cv.dataset.want = /** @type {any} */ (j.id);
    if (cv.id === "cv") missing(cv, j.id);
    return;
  }
  const e = img(u),
    nat = cv.id === "vcv";
  cv.dataset.want = /** @type {any} */ (j.id);
  if (e.i.complete && e.i.naturalWidth) {
    drawTo(cv, e.i, nat, j.id);
    xfadeGo(cv);
    return;
  }
  if (cv.id === "cv") {
    cv.width = 1;
    cv.height = 1;
  }
  e.p.then(im => {
    if (cv.dataset.want != String(j.id)) return;
    if (im) {
      drawTo(cv, im, nat, j.id);
      xfadeGo(cv);
    } else {
      imgs.delete(u);
      missing(cv, j.id);
      xfadeGo(cv);
    }
  });
}
/** the missing-file card's dark ground, at the box's size @param {HTMLCanvasElement} cv @param {number} [id] the
 * picture that's missing */
export function missing(cv, id) {
  const dpr = devicePixelRatio || 1,
    fd = cv.id === "cv" && $("frame").dataset,
    W = Math.max(64, Math.round(((fd && +(/** @type {string} */ (fd.tw))) || cv.clientWidth || 300) * dpr)),
    H = Math.max(
      64,
      Math.round(((fd && +(/** @type {string} */ (fd.th))) || cv.clientHeight || 300) * dpr),
    ); /* the box's target size (it may be mid-glide) */
  cv.width = W;
  cv.height = H;
  const c = /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d"));
  c.fillStyle = "#0b0b0e";
  c.fillRect(0, 0, W, H);
  if (id != null) cv.dataset.shown = String(id);
} /* the words and the ways back are on the card (#missCard) */
/* the missing-file card: what can bring it back, best first */
/** a missing file in the Recycle Bin, by job id: true found, false not there, null still looking */
/** @type {Record<number, boolean | null>} */
export const inBin = {};
/** @param {import("./types.js").Job | null | undefined} d */
export function missUI(d) {
  const on = !!(d && d.missing && S.view === "gen");
  $("frame").classList.toggle("missing", on);
  if (!on) return;
  $("missFile").textContent = d.file;
  if (inBin[d.id] === undefined) {
    inBin[d.id] = null;
    api(`/api/jobs/${d.id}/recycled`, {})
      .then(r => (inBin[d.id] = !!r.found))
      .catch(() => {});
  }
  const held = imgs.get(urlFor(d)),
    copy = !!(held && held.i.complete && held.i.naturalWidth);
  $("mRestore").style.display = inBin[d.id] ? "" : "none";
  $("mSave").style.display = copy && !inBin[d.id] ? "" : "none";
  $("missHint").textContent = inBin[d.id]
    ? "It's in the Recycle Bin — Restore puts the original file back."
    : copy
      ? "Kiln still has it from this session — Save back writes it to the output folder again."
      : "Render again makes it anew from the same prompt, seed and settings.";
}
export const shownMissing = () => {
  const d = shownDone();
  return d && d.missing ? d : null;
};
