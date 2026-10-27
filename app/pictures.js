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
/* switching pictures: the one on show is copied to an overlay (#cvx) at its own size and fades out once the next is
    drawn — never an empty frame in between (Photos / Lightroom). The neighbours are decoded ahead (preload) */
/** @param {HTMLCanvasElement} cv @param {number} id */
function xfadeFrom(cv, id) {
  const x = /** @type {HTMLCanvasElement & { _t?: number }} */ ($("cvx"));
  if (!x || x.dataset.wait || cv.id !== "cv" || cv.width < 2 || !cv.dataset.shown || cv.dataset.shown === String(id))
    return; /* already taken (xfadeSnap, before the box changed) */
  x.width = cv.width;
  x.height = cv.height;
  /** @type {CanvasRenderingContext2D} */ (x.getContext("2d")).drawImage(cv, 0, 0);
  x.style.width = cv.style.width;
  x.style.height = cv.style.height;
  x.style.transition = "none";
  x.style.opacity = "1";
  x.dataset.wait = "1";
}
/** @param {HTMLCanvasElement} cv */
function xfadeGo(cv) {
  if (cv.id !== "cv") return;
  cv.dataset.cw = cv.style.width;
  cv.dataset.ch = cv.style.height;
  const x = $("cvx");
  if (x && x.dataset.morph) {
    x.dataset.wait = "";
    return;
  } /* a crop-and-reveal is running: it fades the old picture at its seam */
  if (x && x.dataset.wait) {
    x.dataset.wait = "";
    void x.offsetWidth;
    x.style.transition = "";
    x.style.opacity = "0";
    overlayGone();
  }
}
/* the overlay is a copy of what WAS on screen, for one fade: once it has faded out it is emptied, so a later fade or
   crop-and-reveal that took no copy shows nothing rather than an old picture */
export function overlayGone() {
  const x = /** @type {HTMLCanvasElement} */ ($("cvx")),
    clear = () => {
      if (x.dataset.wait || x.dataset.morph || getComputedStyle(x).opacity !== "0") return; // in use again
      x.width = 1;
      x.height = 1;
    };
  if (
    getComputedStyle(x)
      .transitionDuration.split(",")
      .every(d => parseFloat(d) === 0)
  )
    clear();
  else x.addEventListener("transitionend", clear, { once: true });
}
/* any other change of what's on show (leaving the Gallery, ✕, the render taking over): the picture fades out the same
    way — over whatever comes next (a render's first preview), or at once if nothing does (a clean screen) */
export function xfadeSnap() {
  const cv = /** @type {HTMLCanvasElement} */ ($("cv")),
    x = /** @type {HTMLCanvasElement & { _t?: number }} */ ($("cvx"));
  if (!x || cv.width < 2) return;
  x.width = cv.width;
  x.height = cv.height;
  /** @type {CanvasRenderingContext2D} */ (x.getContext("2d")).drawImage(cv, 0, 0);
  x.style.width = cv.style.width;
  x.style.height = cv.style.height;
  x.style.transition = "none";
  x.style.opacity = "1";
  x.dataset.wait = "1";
  clearTimeout(x._t);
  x._t = setTimeout(xfadeEnd, 260);
}
export function xfadeEnd() {
  const x = $("cvx");
  if (!x || !x.dataset.wait || x.dataset.morph) return;
  x.dataset.wait = "";
  void x.offsetWidth;
  x.style.transition = "";
  x.style.opacity = "0";
  overlayGone();
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
