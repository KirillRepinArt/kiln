// @ts-check
/* Kiln · pictures: the real files and the live previews — loading, the small cache, drawing them on a canvas,
   the cross-fade between two, the missing-file card */
import { $ } from "./dom.js";
import { api } from "./live.js";
import { fade as fadeTo, setOpacity } from "./fade.js";
import { fades, shapeSteps } from "./layoutmath.js";
import { shownDone } from "./picstate.js";
import { S } from "./state.js";
import { easing } from "./tokens.js";

/* ---------- images: real files and live previews, cached ---------- */
export const imgs =
    /** @type {Map<string | null, { i: HTMLImageElement, p: Promise<HTMLImageElement | null> }>} the decoded pictures, by URL (null: no file — never found) */ (
      new Map()
    ),
  IMAX = 16; /* the pictures used last */
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
/** how many times each canvas has been drawn: what's derived from a picture (the ambient glow) redraws only when it
 * changed @type {WeakMap<HTMLCanvasElement, number>} */
export const drawn = new WeakMap();
/** a canvas's pixels changed (drawn, cleared): every change to a picture canvas goes through here or drawTo
 * @param {HTMLCanvasElement} cv */
export function drew(cv) {
  drawn.set(cv, (drawn.get(cv) || 0) + 1);
}
/** @param {import("./types.js").Job} j @returns {string | null} */
export function urlFor(j) {
  return j.file ? `/files/${encodeURIComponent(j.file)}?j=${j.id}` : null;
}
/* what draws the frame's canvas says what it drew — a finished picture's id, or "render:<job>" for a preview (an
   untagged preview kept the last picture's id, and the crop-and-reveal cropped a stale copy) */
/** @param {HTMLCanvasElement} cv @param {HTMLImageElement} im @param {boolean} natural at the picture's own size (the viewer)
 * @param {number | string} [what] what it is (the frame's canvas): a finished picture's id, or "render:<job>" */
export function drawTo(cv, im, natural, what) {
  drew(cv);
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
/* ---------- the old picture leaving: ONE owner (ownership map V2) ----------
   Switching pictures: the one on show is copied to an overlay (#cvx) at its own size and fades out over the next —
   never an empty frame in between (Photos / Lightroom). This module alone writes the overlay's opacity: one state —
   idle → held (a copy of what was on screen) → fading → idle — and a fade is ONE animation, the cross-fade's by
   default or on the caller's timing and clock (the crop-and-reveal, morph.js). The neighbours are decoded ahead
   (preload) */
/** @type {"idle" | "held" | "fading"} */
let ov = "idle";
/** what the overlay holds: the picture it copied (the canvas's data-shown) @type {string | undefined} */
let ovOf;
/** @type {Animation | null} */
let ovFade = null;
let ovTimer = 0;
/* a picture changing in place (nothing changes shape): the one fade's cross-fade (layoutmath.js fades) — the old one
   (its copy) fades off the new one under it; with nothing over it, the new one fades in itself */
/** read when used: the tokens may be tuned live */
const SAME = () => fades(shapeSteps({ w: 1, h: 1 }, { w: 1, h: 1 }, "browse"));
/** @type {Animation | null} the frame's picture coming in */
let cvIn = null;
let arriving = false; // the picture being drawn comes into an empty frame: nothing to cross-fade from
/* ---------- the empty frame's text is the frame's third layer (F2) ----------
   "Next: 3:4 · … / Estimated time" stands in for a picture: it shows while the frame is empty and fades by the same fade
   as the pictures — out as one comes in, in as one leaves (on that picture's own timing and clock) */
let idleOn = true;
/** @param {boolean} on @param {{ delay: number, duration: number, startTime?: number | null }} fade */
function idleFade(on, fade) {
  if (on === idleOn) return;
  idleOn = on;
  const el = $("idle"),
    /* from what is on screen (fade.js fade): a turn-back mid-fade carries on */
    [a] = fadeTo(
      el,
      on ? 1 : 0,
      { delay: fade.delay, duration: fade.duration, easing: easing("--ease-content"), fill: "both" },
      { from: on ? 0 : 1, end: on ? "" : "0" }, // then it rests there (fade.js leaves it)
    );
  if (fade.startTime != null) a.startTime = fade.startTime;
}
/** the frame has a picture now (the status loop): the text goes — with the picture's own fade if one is coming in
 * (pictureIn), else the one fade now (a render starting) */
export function frameFilled() {
  idleFade(false, SAME().out);
}
/** the frame is empty now (the status loop): the text comes back — as the picture leaving fades off (the overlay's
 * clock), else the one fade now */
export function frameEmptied() {
  const t = ovFade && ovFade.effect ? ovFade.effect.getTiming() : null;
  idleFade(
    true,
    t && ovFade
      ? {
          delay: Number(t.delay) || 0,
          duration: Number(t.duration) || 0,
          startTime: /** @type {number} */ (ovFade.startTime),
        }
      : SAME().in,
  );
}
/** the frame's picture comes in — the other half of the same owner (the overlay is what leaves): one fade, the
 * cross-fade's by default, or on a motion's timing and clock (the crop-and-reveal) (F1)
 * @param {{ delay: number, duration: number, startTime?: number }} [fade] */
export function pictureIn(fade = SAME().in) {
  const cv = /** @type {HTMLCanvasElement} */ ($("cv"));
  /* new content comes from unseen; a fade-in already running carries on from its value (fade.js fade) */
  const [a] = fadeTo(
    cv,
    1,
    { delay: fade.delay, duration: fade.duration, easing: easing("--ease-content"), fill: "backwards" }, // held unseen until its delay
    { from: 0 },
  );
  if (fade.startTime != null) a.startTime = fade.startTime;
  idleFade(false, fade); // the empty frame's text goes as the picture comes (F2)
  cvIn = a;
  a.onfinish = a.oncancel = () => {
    if (cvIn === a) cvIn = null;
  };
}
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
     render's preview read as another picture, zoomed */
  for (const id of ["veil", "embers"]) {
    const e = /** @type {HTMLCanvasElement | null} */ (document.getElementById(id));
    if (e && e.width > 1 && +getComputedStyle(e).opacity > 0.01 && getComputedStyle(e).display !== "none")
      c.drawImage(e, 0, 0, x.width, x.height);
  }
  x.style.width = cv.style.width;
  x.style.height = cv.style.height;
  setOpacity(x, "1"); // shown at once over the canvas (fade.js: the one writer of its opacity)
  ov = "held";
  ovOf = cv.dataset.shown;
}
/** let the held picture go: it fades out — the one fade's cross-fade, now, or on a motion's timing and clock (the
 * crop-and-reveal fades it ending at its swap); once faded the overlay is emptied, so a later fade shows nothing old
 * @param {{ delay: number, duration: number, startTime?: number }} [fade] */
export function overlayRelease(fade = SAME().out) {
  if (ov !== "held") return;
  clearTimeout(ovTimer);
  const x = /** @type {HTMLCanvasElement} */ ($("cvx")),
    [a] = fadeTo(
      x,
      0,
      { delay: fade.delay, duration: fade.duration, easing: easing("--ease-content"), fill: "both" },
      { from: 1, end: "" }, // the held copy: shown; once gone, back to its CSS (emptied below)
    );
  if (fade.startTime != null) a.startTime = fade.startTime;
  ov = "fading";
  ovFade = a;
  a.onfinish = () => {
    if (ovFade !== a) return;
    ovFade = null;
    ov = "idle";
    x.width = 1;
    x.height = 1;
  };
}
/** a new picture is being drawn on the frame's canvas: the one on show is held over it
 * @param {HTMLCanvasElement} cv @param {number} id */
function xfadeFrom(cv, id) {
  if (cv.id !== "cv") return;
  arriving = cv.width < 2 || !cv.dataset.shown; // the frame shows nothing now (✕ empties the canvas, not its tag)
  if (!cv.dataset.shown || cv.dataset.shown === String(id)) return;
  overlayHold(cv);
}
/** …and it's drawn: the held one fades out (if a crop-and-reveal took it, it is already fading on that clock)
 * @param {HTMLCanvasElement} cv */
function xfadeGo(cv) {
  if (cv.id !== "cv") return;
  cv.dataset.cw = cv.style.width;
  cv.dataset.ch = cv.style.height;
  /* the old picture over it fades out — or, coming into an empty frame, it fades in itself (unless a crop-and-reveal
     is bringing it in on its own timing) */
  if (ov === "held") overlayRelease();
  else if (arriving && !cvIn) pictureIn();
  arriving = false;
}
/* any other change of what's on show (leaving the Gallery, ✕, the render taking over): the picture fades out the same
    way — over what comes next when something does (it waits a moment for a render's first preview to be under it), at
    once when nothing does (an empty frame). "At once" is the end of this step: a crop-and-reveal starting in the same
    click hands over its own timing first */
/** @param {boolean} coming a render's picture is coming in under it */
export function xfadeSnap(coming) {
  overlayHold(/** @type {HTMLCanvasElement} */ ($("cv")));
  clearTimeout(ovTimer);
  ovTimer = setTimeout(() => overlayRelease(), coming ? 260 : 0);
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
    drew(cv);
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
  drew(cv);
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

/* ---------- THE frame's picture: ARCHITECTURE › what the frame's canvas shows (DD-2026-11-10-11) ----------
   One entry for a render's pictures, a finished picture, nothing — so its rules hold for every picture. progress.js
   fetches the previews (polling is its job) and hands them over here */
const frameCv = () => /** @type {HTMLCanvasElement} */ ($("cv"));
/** the render whose pictures the frame is showing, before its first one has landed @type {number | null} */
let renderFirst = null;
/** a render takes the frame (its job id): the canvas is emptied and tagged for it — false if it already has it
 * @param {number} jobId */
export function frameRender(jobId) {
  const c = frameCv();
  if (+(/** @type {string} */ (c.dataset.j)) === jobId) return false;
  c.dataset.j = String(jobId);
  c.dataset.d = "";
  c.dataset.want = "";
  c.width = 1;
  c.height = 1;
  drew(c);
  renderFirst = jobId;
  return true;
}
/** a render's picture (a preview) on the frame — only while that render still has it; over a held picture that one
 * fades off it, into an empty frame its first picture fades in (as any picture there: xfadeGo)
 * @param {number} jobId @param {HTMLImageElement} im */
export function frameRenderPicture(jobId, im) {
  const c = frameCv();
  if (+(/** @type {string} */ (c.dataset.j)) !== jobId) return;
  const first = renderFirst === jobId;
  renderFirst = null;
  drawTo(c, im, false, "render:" + jobId);
  if (overlayShows()) xfadeEnd();
  else if (first) pictureIn();
}
/** a finished picture on the frame — if it isn't on it already (its id and whether its file is gone); `before` runs
 * once it's claimed and before it's painted (the frame laid out for it first) — false if it was there
 * @param {import("./types.js").Job} j @param {() => void} [before] */
export function frameDone(j, before) {
  const c = frameCv();
  if (c.dataset.d == String(j.id) && c.dataset.m === String(!!j.missing)) return false;
  c.dataset.d = String(j.id);
  c.dataset.m = String(!!j.missing);
  c.dataset.j = "";
  if (before) before();
  paint(c, j);
  return true;
}
/** nothing on the frame: the canvas emptied and untagged */
export function frameEmpty() {
  const c = frameCv();
  if (c.width > 1) {
    c.width = 1;
    c.height = 1;
    drew(c);
  }
  c.dataset.d = "";
  c.dataset.j = "";
}
/** forget what the frame shows (its next picture is drawn again, whatever it is) */
export function frameForget() {
  const c = frameCv();
  c.dataset.d = "";
  c.dataset.j = "";
}
