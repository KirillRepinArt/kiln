/* Kiln · pictures: the real files and the live previews — loading, the small cache, drawing them on a canvas,
   the cross-fade between two, the missing-file card */
/* ---------- images: real files and live previews, cached ---------- */
const imgs = new Map(),
  IMAX = 16; /* the pictures used last (the cache used to keep every picture you'd seen, decoded) */
function img(url) {
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
  while (imgs.size > IMAX) imgs.delete(imgs.keys().next().value);
  return e;
}
function __imgsN() {
  return imgs.size;
}
function urlFor(j) {
  return j.file ? `/files/${encodeURIComponent(j.file)}?j=${j.id}` : null;
}
function drawTo(cv, im, natural) {
  const dpr = devicePixelRatio || 1,
    iw = im.naturalWidth,
    ih = im.naturalHeight;
  if (natural) {
    if (cv.width !== iw || cv.height !== ih) {
      cv.width = iw;
      cv.height = ih;
    }
    const c = cv.getContext("2d");
    c.drawImage(im, 0, 0);
    return;
  }
  // the canvas takes its box's shape; the image keeps its own (a preview of another shape never gets stretched)
  const fd = cv.id === "cv" && $("frame").dataset,
    cw = (fd && +fd.tw) || cv.clientWidth || 300,
    ch = (fd && +fd.th) || cv.clientHeight || Math.round((cw * ih) / iw);
  const W = Math.max(64, Math.round(cw * dpr)),
    H = Math.max(64, Math.round(ch * dpr));
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const c = cv.getContext("2d");
  c.imageSmoothingQuality = "high";
  c.clearRect(0, 0, W, H);
  const k = cv.id === "cv" ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
  c.drawImage(im, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
}
/* a canvas only ever shows the image it was last asked for: while that one loads it is blank (never the previous
    picture or a cancelled job's preview stretched to the new shape), a load that lands after you moved on is dropped,
    and a file that's gone says so */
/* switching pictures: the one on show is copied to an overlay (#cvx) at its own size and fades out once the next is
    drawn — never an empty frame in between (Photos / Lightroom). The neighbours are decoded ahead (preload) */
function xfadeFrom(cv, id) {
  const x = $("cvx");
  if (!x || x.dataset.wait || cv.id !== "cv" || cv.width < 2 || !cv.dataset.shown || cv.dataset.shown === String(id))
    return; /* already taken (xfadeSnap, before the box changed) */
  x.width = cv.width;
  x.height = cv.height;
  x.getContext("2d").drawImage(cv, 0, 0);
  x.style.width = cv.style.width;
  x.style.height = cv.style.height;
  x.style.transition = "none";
  x.style.opacity = "1";
  x.dataset.wait = "1";
}
function xfadeGo(cv, id) {
  if (cv.id !== "cv") return;
  cv.dataset.shown = id;
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
  }
}
/* any other change of what's on show (leaving the Gallery, ✕, the render taking over): the picture fades out the same
    way — over whatever comes next (a render's first preview), or at once if nothing does (a clean screen) */
function xfadeSnap() {
  const cv = $("cv"),
    x = $("cvx");
  if (!x || cv.width < 2) return;
  x.width = cv.width;
  x.height = cv.height;
  x.getContext("2d").drawImage(cv, 0, 0);
  x.style.width = cv.style.width;
  x.style.height = cv.style.height;
  x.style.transition = "none";
  x.style.opacity = "1";
  x.dataset.wait = "1";
  clearTimeout(x._t);
  x._t = setTimeout(xfadeEnd, 260);
}
function xfadeEnd() {
  const x = $("cvx");
  if (!x || !x.dataset.wait || x.dataset.morph) return;
  x.dataset.wait = "";
  void x.offsetWidth;
  x.style.transition = "";
  x.style.opacity = "0";
}
function preload(j) {
  const u = urlFor(j);
  if (!u || j.missing) return;
  const e = img(u);
  try {
    e.i.decode().catch(() => {});
  } catch (_) {}
}
function paint(cv, j, progress) {
  const u = urlFor(j);
  if (!u) return;
  xfadeFrom(cv, j.id);
  if (j.missing) {
    cv.dataset.want = j.id;
    if (cv.id === "cv") missing(cv, j);
    return;
  }
  const e = img(u),
    nat = cv.id === "vcv";
  cv.dataset.want = j.id;
  if (e.i.complete && e.i.naturalWidth) {
    drawTo(cv, e.i, nat);
    xfadeGo(cv, j.id);
    return;
  }
  if (cv.id === "cv") {
    cv.width = 1;
    cv.height = 1;
  }
  e.p.then(im => {
    if (cv.dataset.want != String(j.id)) return;
    if (im) {
      drawTo(cv, im, nat);
      xfadeGo(cv, j.id);
    } else {
      imgs.delete(u);
      missing(cv, j);
      xfadeGo(cv, j.id);
    }
  });
}
function missing(cv, j) {
  const dpr = devicePixelRatio || 1,
    fd = cv.id === "cv" && $("frame").dataset,
    W = Math.max(64, Math.round(((fd && +fd.tw) || cv.clientWidth || 300) * dpr)),
    H = Math.max(
      64,
      Math.round(((fd && +fd.th) || cv.clientHeight || 300) * dpr),
    ); /* the box's target size (it may be mid-glide) */
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#0b0b0e";
  c.fillRect(0, 0, W, H);
} /* the words and the ways back are on the card (#missCard) */
/* the missing-file card: what can bring it back, best first */
const inBin = {};
function missUI(d) {
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
const shownMissing = () => {
  const d = shownDone();
  return d && d.missing ? d : null;
};
