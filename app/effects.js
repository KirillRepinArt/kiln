/* Kiln · starfield, ambient glow + title/favicon, notifications, veil + embers */
/* app background, set by the skin: starfield (three parallax layers, gentle twinkle, a rare shooting star),
   northern lights over a dimmer starfield, or sparse cold code. Redrawn at ~30 fps. */
(function () {
  const cv = $("stars"),
    c = cv.getContext("2d");
  const R = Math.random;
  let W = 0,
    H = 0,
    stars = [],
    shoot = null,
    last = 0,
    lastDraw = 0,
    was = "",
    bcols = null,
    bcT = 0;
  const aur = makeAurora(),
    night = makeNightSky(),
    code = makeCodeBg();
  let lastIn = performance.now(),
    dimV = 1,
    holes = [],
    holeT = 0;
  const HOLES = "#ltitle .phead,#ltitle .peekbar.show,#prog .meta,#idle>div";
  ["pointermove", "keydown", "wheel"].forEach(ev =>
    addEventListener(ev, () => (lastIn = performance.now()), { passive: true }),
  );
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function init() {
    const b = cv.getBoundingClientRect();
    if (!b.width) return;
    const d = devicePixelRatio || 1;
    W = cv.width = Math.round(b.width * d);
    H = cv.height = Math.round(b.height * d);
    const n = Math.round((b.width * b.height) / 3400);
    stars = [];
    for (let i = 0; i < n; i++) {
      const l = R() < 0.6 ? 0 : R() < 0.75 ? 1 : 2;
      stars.push({ x: R() * W, y: R() * H, l, r: (0.5 + l * 0.45 + R() * 0.4) * d, p: R() * 6.28, s: 0.6 + R() * 1.6 });
    }
  }
  function draw(t) {
    const idle = ((S.set || {}).stars || "on") !== "off";
    cv.classList.toggle("on", idle);
    if (idle) {
      if (!W || Math.abs(cv.getBoundingClientRect().width * (devicePixelRatio || 1) - W) > 2) init();
      const bg = skin().bg;
      if (bg !== was) {
        was = bg;
        c.clearRect(0, 0, W, H);
      }
      if (t - lastDraw < (current() ? 49 : 31)) {
        last = t;
        requestAnimationFrame(draw);
        return;
      }
      /* ~30 fps, ~20 while a job runs: the GPU is Forge's then */
      const dt = Math.min(66, t - lastDraw);
      lastDraw = t;
      if (!bcols || bcT !== window._themeV) {
        bcols = themeCols();
        bcT = window._themeV;
      }
      c.clearRect(0, 0, W, H);
      const d = devicePixelRatio || 1;
      if (bg === "code") {
        const run = !!current(),
          f = $("frame").getBoundingClientRect(),
          cb = cv.getBoundingClientRect();
        dimV += ((!run && t - lastIn > 120000 ? 0.45 : 1) - dimV) * Math.min(1, dt / 1500); // idle for 2 min: dims
        if (t - holeT > 500) {
          holeT = t;
          holes = [...document.querySelectorAll(HOLES)]
            .map(el => el.getBoundingClientRect())
            .filter(r => r.width && r.height)
            .map(r => ({ x: (r.left - cb.left) * d, y: (r.top - cb.top) * d, w: r.width * d, h: r.height * d }));
        }
        code.draw(c, W, H, t, dt, d, bcols, {
          run,
          fx: (f.left + f.width / 2 - cb.left) * d,
          dim: dimV,
          wave: window._bgWave || 0,
          reduce,
          holes,
        });
        last = t;
        requestAnimationFrame(draw);
        return;
      }
      const dim = bg === "aurora" ? 0.55 : 1;
      if (bg !== "aurora")
        for (const st of stars) {
          const v = [0.002, 0.0045, 0.009][st.l] * (reduce ? 0 : 1);
          st.x += v * dt;
          st.y += v * dt * 0.62;
          if (st.x > W + 4) st.x -= W + 8;
          if (st.y > H + 4) st.y -= H + 8;
          const tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin((t / 1000) * st.s + st.p);
          c.globalAlpha = (0.25 + st.l * 0.25) * tw * 0.62 * dim;
          c.fillStyle = st.l === 2 ? "#fff" : "#cfd6ff";
          c.beginPath();
          c.arc(st.x, st.y, st.r, 0, 6.283);
          c.fill();
        }
      if (bg === "aurora") {
        const wv = window._bgWave ? (t - window._bgWave) / 2800 : 9,
          fl =
            wv >= 0 && wv < 1
              ? Math.pow(Math.sin(Math.PI * Math.pow(wv, 0.7)), 2)
              : 0; /* an image landed: the sky swells, slowly */
        night.draw(c, W, H, t, d, bcols, {
          reduce,
          landscape: (S.set || {}).landscape === "on",
          aur: {
            scale: 6,
            layout: "sky",
            auto: !reduce,
            alpha: 0.46 * (1 + 0.8 * fl),
            blend: "lighter",
            boost: fl * 0.6,
          },
        });
      }
      if (!reduce && bg === "stars") {
        if (!shoot && R() < dt / 9000)
          shoot = { x: W * R() * 0.7, y: H * R() * 0.4, vx: 0.5 + R() * 0.4, vy: 0.3 + R() * 0.15, life: 0 };
        if (shoot) {
          shoot.life += dt;
          const k = shoot.life / 900,
            len = 120 * (devicePixelRatio || 1);
          const x = shoot.x + shoot.vx * shoot.life,
            y = shoot.y + shoot.vy * shoot.life;
          const g = c.createLinearGradient(x, y, x - shoot.vx * len, y - shoot.vy * len);
          g.addColorStop(0, "rgba(255,255,255,.8)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          c.globalAlpha = Math.max(0, 1 - k);
          c.strokeStyle = g;
          c.lineWidth = 1.4 * (devicePixelRatio || 1);
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x - shoot.vx * len, y - shoot.vy * len);
          c.stroke();
          if (k >= 1) shoot = null;
        }
      }
      c.globalAlpha = 1;
    } else if (W && !cv.classList.contains("on") && getComputedStyle(cv).opacity < 0.02) c.clearRect(0, 0, W, H);
    last = t;
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

/* ambient glow + window title + favicon progress ring (throttled) */
const amb = $("amb"),
  ambC = amb.getContext("2d"),
  favC = document.createElement("canvas");
favC.width = favC.height = 64;

/* the Generating ring's knockout: the word's own glyphs, stroked ~1.25 px wider, cut out of the ring's holder — done
   once per font, size and screen scale, not per frame */
function ringKnockout() {
  const w = document.querySelector('.tab[data-v="gen"] .trw'),
    tl = w && w.closest(".tl");
  if (!w || !document.body.classList.contains("jobrun")) return;
  const r = w.getBoundingClientRect();
  if (!r.width) return;
  const gt = w.parentElement.lastChild,
    rg = document.createRange();
  rg.selectNodeContents(gt);
  const gr = rg.getBoundingClientRect();
  const cs = getComputedStyle(tl),
    dpr = devicePixelRatio || 1,
    font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
    key = [font, cs.letterSpacing, dpr, Math.round((gr.left - r.left) * 10), Math.round((gr.top - r.top) * 10)].join(
      "|",
    );
  if (w.dataset.ko === key) return;
  w.dataset.ko = key;
  const c = document.createElement("canvas");
  c.width = Math.ceil(r.width * dpr);
  c.height = Math.ceil(r.height * dpr);
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  g.fillStyle = "#000";
  g.fillRect(0, 0, r.width, r.height);
  g.globalCompositeOperation = "destination-out";
  g.font = font;
  try {
    g.letterSpacing = cs.letterSpacing;
  } catch (e) {}
  const m = g.measureText("G"),
    y = gr.top - r.top + m.fontBoundingBoxAscent,
    x = gr.left - r.left;
  g.lineWidth = 4;
  g.lineJoin = "round";
  g.strokeText(tl.textContent, x, y);
  g.fillText(tl.textContent, x, y);
  w.style.setProperty("--ko", `url(${c.toDataURL()})`);
}
document.fonts &&
  document.fonts.ready.then(() => {
    const w = document.querySelector(".trw");
    if (w) delete w.dataset.ko;
  });
function status() {
  const j = current();
  ringKnockout();
  if (window._jobsReady) {
    const d = lastDone(),
      v = d && !(PV.still && PV.still.id === d.id) ? d.id : null;
    if ((S.clearedId ?? null) !== v) {
      S.clearedId = v;
      save();
    }
  } // remember: closed on a clean screen
  $("frame").classList.toggle("running", picMode() === "live");
  const pend = jobs.filter(x => x.status === "pending").length;
  const gm = (S.set || {}).glow || "gen";
  const src =
    S.view === "gen" &&
    gm !== "off" &&
    !(j && skin().cover === "camera") &&
    !$("frame").classList.contains("held") &&
    (j || (gm === "always" && shownDone()))
      ? $("cv")
      : null; /* Aurora has its frame glow instead */
  if (src && src.width) {
    ambC.imageSmoothingQuality = "high";
    ambC.drawImage(src, 0, 0, 12, 12);
    amb.classList.add("on");
  } else amb.classList.remove("on");
  let p = null;
  {
    const gt = document.querySelector('.tab[data-v="gen"]');
    if (document.body.classList.contains("jobrun") !== !!j) {
      document.body.classList.toggle("jobrun", !!j);
      requestAnimationFrame(() => moveThumb(true));
    } /* the ring widens the tab: the highlight follows */
    if (gt) {
      if (j) {
        const q = jobProgress(j);
        document.documentElement.style.setProperty("--p", Math.max(0.02, Math.min(1, q.p || 0)));
        gt.dataset.tip = `Rendering #${j.id} · step ${Math.min(j.step + 1, j.steps)}/${j.steps}${q.left != null ? ` · ~${fmt(q.left)} left` : ""}`;
      } else gt.dataset.tip = "The image being made";
    }
  }
  {
    const pl = $("play");
    pl.classList.toggle("gen", !!j);
    pl.classList.toggle("running", false);
    /* the ring: only where the progress bar is out of sight */
    pl.classList.toggle("stopping", !!(j && j.stopping));
    if (j) {
      const q = jobProgress(j),
        v = Math.max(0.02, Math.min(1, q.p || 0)),
        was = +pl.dataset.pj || 0;
      if (was !== j.id) {
        const rg = pl.querySelector(".pring");
        pl.dataset.pj = j.id;
        rg.style.transition = "none";
        pl.style.setProperty("--p", v);
        void rg.offsetWidth;
        rg.style.transition = "";
      } /* a new job starts from empty, not by sweeping back */
      else pl.style.setProperty("--p", v);
    }
  }
  if (j) {
    const q = jobProgress(j);
    p = q.p;
    document.title = `${Math.min(j.step + 1, j.steps)}/${j.steps}${q.left != null ? ` · ~${fmt(q.left)}` : ""}${pend ? ` · +${pend}` : ""} — Kiln`;
  } else document.title = pend ? `${window.qPaused ? "Paused · " : ""}${pend} queued — Kiln` : "Kiln";
  const c = favC.getContext("2d");
  c.clearRect(0, 0, 64, 64);
  const cs = getComputedStyle(document.documentElement);
  const g = c.createLinearGradient(0, 0, 64, 64);
  g.addColorStop(0, cs.getPropertyValue("--a1").trim() || "#FF8A00");
  g.addColorStop(1, cs.getPropertyValue("--a3").trim() || "#3FE0F0");
  c.lineWidth = 9;
  c.lineCap = "round";
  c.strokeStyle = "#2f2f34";
  c.beginPath();
  c.arc(32, 32, 24, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = g;
  c.beginPath();
  c.arc(32, 32, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p == null ? 1 : Math.max(0.02, p)));
  c.stroke();
  if (p == null) {
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(27, 21);
    c.lineTo(43, 32);
    c.lineTo(27, 43);
    c.closePath();
    c.fill();
  }
  $("fav").href = favC.toDataURL("image/png");
}
setInterval(status, 400);
let notifAsked = false;
function askNotify() {
  if (notifAsked || !("Notification" in window)) return;
  notifAsked = true;
  try {
    if (Notification.permission === "default") Notification.requestPermission();
  } catch (e) {}
}
/* notifications are neutral: never the prompt, the name or a picture (they end up in the Windows notification centre) */
let doneRun = 0;
function onJobDone(j) {
  if (window.emberBurst && PV.still && PV.still.id === j.id) emberBurst();
  /* the finish plays on the result you see, never over another picture */
  doneRun++;
  if (jobs.some(x => x.status === "pending")) return;
  const n = doneRun;
  doneRun = 0;
  if (((S.set || {}).notify || "on") === "off") return;
  try {
    if (Notification.permission === "granted")
      new Notification("Kiln", {
        body: n > 1 ? `Queue finished · ${n} images` : "Your image is ready",
        silent: (S.set || {}).notify === "silent",
      });
  } catch (e) {}
}

/* ======================= effects =======================
   VEIL while a job runs: the young preview is mostly hidden under flowing diagonal light and drifting sparkles,
   and emerges as progress grows (hover the image to peek through). EMBERS: a short burst when a job finishes. */
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vc = $("veil"),
    v = vc.getContext("2d"),
    ec = $("embers"),
    e = ec.getContext("2d");
  let W = 0,
    H = 0,
    last = 0,
    str = 0,
    hover = false,
    sparks = [],
    embers = [],
    burst = 0,
    burstMax = 2400,
    embersHalf = false,
    cols = ["#FF8A00", "#FF5E8A", "#3FE0F0"],
    colT = 0;
  const aur = makeAurora(),
    crt = makeCRT(),
    cam = makeCamera();
  let crtJob = null,
    sweepT = 0,
    nstr = 0,
    fadeT = 0,
    fadeFrom = 0,
    fgA = 0,
    finishAt = -1e9,
    haloT = 0,
    fadeDur = 0,
    finStr = 0;
  const fg = $("fglow"),
    fgc = fg.getContext("2d"),
    halo = makeHalo();
  const dith = document.createElement("canvas");
  dith.width = dith.height = 64;
  {
    const g = dith.getContext("2d"),
      d = g.createImageData(64, 64);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
  }
  const HOLD = 0.7,
    FADE = 5000; /* Aurora: the night layer holds at 70 % from mid-job, then fades slowly after the finish */
  const smooth = (a, b, x) => {
    const q = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return q * q * (3 - 2 * q);
  };
  for (const el of [$("frame"), ...document.querySelectorAll(".gnav")]) {
    el.addEventListener("pointerenter", () => (hover = true));
    el.addEventListener("pointerleave", () => (hover = false));
  }
  function sprite(color, size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    r.addColorStop(0, color);
    r.addColorStop(0.18, color + "cc");
    r.addColorStop(0.45, color + "33");
    r.addColorStop(1, color + "00");
    g.fillStyle = r;
    g.fillRect(0, 0, size, size);
    return c;
  }
  let spr = {};
  function sprites() {
    const cs = getComputedStyle(document.documentElement);
    cols = ["--a1", "--a2", "--a3"].map((k, i) => cs.getPropertyValue(k).trim() || cols[i]);
    const hex = c => {
      if (/^#[0-9a-f]{6}$/i.test(c)) return c;
      const d = document.createElement("canvas").getContext("2d");
      d.fillStyle = c;
      return d.fillStyle;
    };
    spr = {
      a1: sprite(hex(cols[0]), 64),
      a2: sprite(hex(cols[1]), 64),
      a3: sprite(hex(cols[2]), 64),
      w: sprite("#ffffff", 64),
      comp: sprite(hex((window.HARM || {}).comp || cols[2]), 64),
    };
  }
  sprites();
  window.emberBurst = function () {
    if (reduce || ((S.set || {}).embers || "on") === "off" || $("frame").classList.contains("held")) return;
    if (skin().cover === "crt") {
      sweepT = performance.now();
      window._bgWave = sweepT;
      return;
    }
    if (skin().cover === "camera") {
      const n = performance.now();
      cam.finish(n);
      fadeT = n + 1400;
      fadeDur = 500;
      finishAt = n;
      finStr = str;
      setTimeout(() => {
        if (S.view === "gen") {
          burst = burstMax = 1500;
          embersHalf = true;
        }
      }, 1400); /* the release throws stars over the photo: a 1.5 s window (the late ones cut), fading ~60 % of the way up */
      setTimeout(() => {
        try {
          $("frame").animate([{ scale: "1" }, { scale: "1.012", offset: 0.3 }, { scale: "1" }], {
            duration: 560,
            easing: "cubic-bezier(.2,.9,.25,1)",
          });
        } catch (e) {}
      }, 1400);
      /* the release lands: the box swells a hair and settles */
      fadeFrom = nstr;
      window._bgWave = n + 700;
      return;
    } /* the crescendo (skins.js): 1.4 s of build, then the night clears in ~0.5 s under the flash (which lasts ~0.9 s): no dip. The sky behind
   the app answers ~0.7 s later (its swell peaks around the release) */
    burst = burstMax = 2400;
    embersHalf = false;
  };
  /* F8: replay the theme's finish over the image on show — to tune it without waiting for a job (Aurora: the cover first) */
  addEventListener("keydown", e => {
    if (e.key !== "F8" || current() || S.view !== "gen" || !$("frame").classList.contains("has")) return;
    e.preventDefault();
    if (skin().cover === "camera") {
      window._cpv = Date.now() + 1600;
      setTimeout(() => window.emberBurst && emberBurst(), 1500);
    } else window.emberBurst && emberBurst();
  });
  /* Privacy: the eye (top right of the image) and F9. On: the picture is covered outright, running or finished (no
    transparency, no hover peek, no fading with the steps, no starlight/code drawn from it, no finish, no ambient glow,
    no viewer) and the prompt, name and LoRA chips are hidden. It stays on until pressed again, across jobs and
    restarts. Off: the cover follows Settings → Cover. The Queue tab isn't touched (decided 2026-10-18). */
  const CV = { held: false, t0: 0, pr: 0.55 };
  const HALO_CUT = "#left,.ltitle .peekbar.show,.seg,#layBtn,#gear,#lcol>.chips .chip";
  const cbtn = $("cbtn");
  if (S.set && S.set.privacy != null) {
    if (S.privacy == null) S.privacy = S.set.privacy === "on";
    delete S.set.privacy;
    save();
  } /* the old Privacy hold setting */
  const EYE =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    SHUT =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M3 10.5c2.2 2.6 5.2 4 9 4s6.8-1.4 9-4"/><path d="M6.2 13.6 4.6 16M12 14.6V17.4M17.8 13.6l1.6 2.4"/></svg>';
  function coverUI() {
    const p = !!S.privacy;
    cbtn.innerHTML = p ? SHUT : EYE;
    cbtn.dataset.tip = p
      ? "Privacy on — press to show (F9)"
      : "Privacy (F9): cover the picture fully and hide the prompt";
    cbtn.classList.toggle("lit", p);
    document.body.classList.toggle("private", p);
  }
  function toggleCover() {
    S.privacy = !S.privacy;
    save();
    coverUI();
  }
  window.toggleCover = toggleCover;
  window.coverHeld = () => CV.held;
  cbtn.onclick = e => {
    e.stopPropagation();
    toggleCover();
  };
  coverUI();
  addEventListener(
    "keydown",
    e => {
      if (e.key !== "F9" || e.repeat) return;
      e.preventDefault();
      toggleCover();
    },
    true,
  ); /* works while typing in the prompt */
  function haloFrame(t, dt, cover0, force) {
    /* Aurora's halo: the image box glows (skins.js makeHalo). On while a job runs, fading out with the night layer after
     the finish. A step's meteor makes it respond, the finish a little more — always with a soft rise (~0.4 s) and fall,
     never a jump. ~20 fps: it moves slowly. */
    {
      const gm = (S.set || {}).glow || "gen",
        run = !!current(),
        on =
          cover0 === "camera" &&
          gm !== "off" &&
          S.view === "gen" &&
          nstr > 0 &&
          !$("modal").classList.contains(
            "show",
          ); /* only round the live render: round a still picture it was just a light left on (2026-10-19) */
      /* it's a kiln: while a job runs the fire shows wherever you are — round the render, the picture you browse, or the
      Queue / LoRAs / PNG Info panel; after the finish it fades with the night layer as before */
      fgA += ((on ? Math.min(1, nstr / HOLD) : 0) - fgA) * Math.min(1, dt / 400);
      if (S.view !== "gen") fgA = 0; /* another tab: gone at once */
      const fr = $("frame");
      if (fgA > 0.01) {
        if (force || t - haloT >= (t - finishAt < 2200 ? 14 : 48)) {
          haloT = t; /* full frame rate while the finish runs */
          const gi = cam.glowInfo(),
            env = (ms, dec) =>
              ms < 0 ? 0 : ms < 400 ? (x => x * x * (3 - 2 * x))(ms / 400) : Math.exp(-(ms - 400) / dec),
            boost =
              0.3 * env(t - gi.met, 1300) +
              (f =>
                f < 0
                  ? 0
                  : f < 1
                    ? 0.8 * f * f * f
                    : f < 1.15
                      ? 0.8 + 0.6 * (x => x * x * (3 - 2 * x))((f - 1) / 0.15)
                      : 1.4 * Math.exp(-(f - 1.15) * 2.2))(
                (t - finishAt) / 1400,
              ); /* builds with the crescendo, exhales at the release */
          const a = fr.getBoundingClientRect(),
            dp = devicePixelRatio || 1,
            R = 95,
            /* the bloom's reach (css px): 130 read too wide on screen */
            cw = Math.round((a.width + 2 * R) * dp),
            ch = Math.round((a.height + 2 * R) * dp);
          if (fg.width !== cw || fg.height !== ch) {
            fg.width = cw;
            fg.height = ch;
          }
          const fs = fg.style;
          fs.left = a.left - R + "px";
          fs.top = a.top - R + "px";
          fs.width = a.width + 2 * R + "px";
          fs.height = a.height + 2 * R + "px";
          fs.opacity = "1";
          fs.display = "";
          const X = R * dp,
            Y = R * dp,
            FW = a.width * dp,
            FH = a.height * dp,
            rad = (parseFloat(getComputedStyle(fr).borderTopLeftRadius) || 24) * dp,
            hc = cols.map(toHex);
          const k = fgA * (reduce ? 0.75 + 0.25 * Math.sin(t / 1800) : 1); // reduced motion: a still glow that gently breathes
          fgc.clearRect(0, 0, cw, ch);
          halo.draw(fgc, X, Y, FW, FH, reduce ? 0 : t / 1000, hc, {
            reach: R * dp,
            radius: rad,
            alpha: 0.32 * k,
            boost,
          }); /* ambient: low opacity, the hot edge is the key light */
          halo.edge(fgc, X, Y, FW, FH, hc, { radius: rad, alpha: k, boost, narrow: 3 * dp, wide: 20 * dp });
          fgc.globalCompositeOperation = "source-atop";
          fgc.globalAlpha = 0.05;
          fgc.fillStyle = fgc.createPattern(dith, "repeat");
          fgc.fillRect(0, 0, cw, ch); // a whisper of grain: no banding on near-black
          fgc.globalCompositeOperation = "destination-out";
          fgc.globalAlpha = 1;
          fgc.beginPath();
          fgc.roundRect(X + dp, Y + dp, FW - 2 * dp, FH - 2 * dp, Math.max(0, rad - dp));
          fgc.fill(); // nothing behind the image itself
          /* nothing under the glass panels either (the prompt box, the tab bar, the LoRA chips): a glass panel blurs what's
        behind it and Chromium repeats its edge pixels inward, so the pulsing glow showed as a flickering band inside the
        box (2026-10-19). Soft holes, already dark at the panel's edge: the light fades out in the gap before it. */
          if (document.body.classList.contains("glass")) {
            const F = 10;
            fgc.filter = `blur(${(F * dp) / 2}px)`;
            for (const el of document.querySelectorAll(HALO_CUT)) {
              const r = el.getBoundingClientRect();
              if (
                !r.width ||
                r.right < a.left - R ||
                r.left > a.right + R ||
                r.bottom < a.top - R ||
                r.top > a.bottom + R
              )
                continue;
              const er = (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) + F;
              fgc.beginPath();
              fgc.roundRect(
                (r.left - a.left + R - F) * dp,
                (r.top - a.top + R - F) * dp,
                (r.width + 2 * F) * dp,
                (r.height + 2 * F) * dp,
                er * dp,
              );
              fgc.fill();
            }
            fgc.filter = "none";
          }
          fgc.globalCompositeOperation = "source-over";
          fr.classList.add("halo");
        }
      } else if (fg.style.opacity !== "0" || fg.style.display !== "none") {
        fg.style.opacity = "0";
        fg.style.display = "none";
        fr.classList.remove("halo");
      } /* gone, not just transparent: a blended layer left in the page still costs Edge a separate compositing surface */
    }
  }
  /* a layout switch captures the new layout at once: the halo has to be there already (stage.js layMorph) */
  window.haloNow = () => haloFrame(performance.now(), 0, skin().cover, true);
  function draw(t) {
    const dt = Math.min(50, t - last || 16),
      dtr = Math.min(1000, t - last || 16);
    last = t;
    /* dtr: real time, so the cover's fades keep their speed when the page runs slow (the GPU busy loading a model) */
    if (colT !== window._themeV) {
      sprites();
      colT = window._themeV;
    }
    const b = vc.getBoundingClientRect(),
      d = devicePixelRatio || 1;
    const nw = Math.round(b.width * d),
      nh = Math.round(b.height * d);
    if (nw !== W || nh !== H) {
      W = vc.width = ec.width = nw;
      H = vc.height = ec.height = nh;
    }
    const j = current();
    const mode = (S.set || {}).veil || "full";
    const cover0 = skin().cover;
    const fr0 = $("frame");
    const held = fr0.classList.contains("has") && S.view === "gen" && !!S.privacy;
    if (held !== CV.held) {
      CV.held = held;
      fr0.classList.toggle("held", held);
      if (held && !j) CV.t0 = Date.now() - 20000;
    }
    const fast = (S.set || {}).fastcover === "skip" && j && j.est > 0 && j.est < 10; // Settings → Cover: no cover on quick jobs
    if (cover0 === "crt" || cover0 === "camera") {
      const k =
        j && picMode() === "live"
          ? j.id
          : Date.now() < (window._cpv || 0)
            ? "pv" + window._cpv
            : held
              ? (crtJob ?? "held")
              : null; // held after the finish: the same exposure goes on
      if (k !== crtJob) {
        crtJob = k;
        if (k != null) {
          if (cover0 === "crt") crt.powerOn(t);
          else cam.reset();
        }
      }
    } // a new job: the screen powers on / a new exposure starts
    let target = 0,
      tN = null;
    if (j && picMode() === "live" && S.view === "gen" && mode !== "off" && !reduce && !fast) {
      const pr = Math.max(0, Math.min(1, jobProgress(j).p || 0));
      // full while step 1 renders, most of it gone during step 2, a little left on step 3, clear for the last step
      const K =
        cover0 === "crt" || cover0 === "camera"
          ? [
              [0, 1],
              [0.25, 1],
              [0.5, 0.85],
              [0.75, 0.45],
              [0.92, 0],
            ]
          : [
              [0, 1],
              [0.25, 1],
              [0.5, 0.4],
              [0.75, 0.12],
              [0.92, 0],
            ];
      /* the CRT stays longer: the code forms the image on steps 2–3 */
      let k0 = 0;
      for (let i = 1; i < K.length; i++)
        if (pr <= K[i][0]) {
          const [a, va] = K[i - 1],
            [b, vb] = K[i];
          k0 = va + ((vb - va) * (pr - a)) / (b - a);
          break;
        }
      target = k0 * (mode === "light" ? 0.55 : 1);
      if (cover0 === "camera")
        tN = (pr >= 0.5 ? Math.max(k0, HOLD) : k0) * (mode === "light" ? 0.55 : 1) * (hover ? 0.12 : 1);
      if (hover) target *= 0.12;
    } else if (
      !j &&
      Date.now() < (window._cpv || 0) &&
      S.view === "gen" &&
      mode !== "off" &&
      !reduce &&
      $("frame").classList.contains("has")
    )
      target = hover ? 0.1 : 0.8; // theme picked: preview the cover on the shown image
    if (cover0 === "camera") {
      const r = t - finishAt;
      if (r < 1400) target = Math.max(target, finStr);
      else if (r < 1900) target = Math.max(target, finStr * (0.5 + 0.5 * Math.cos((Math.PI * (r - 1400)) / 500)));
    } // the image's blur holds through the crescendo and lifts with the night
    if (held) {
      target = 1;
      tN = 1;
    } // held: full, no fading with the steps, no hover peek
    str += (target - str) * Math.min(1, dtr / 260);
    if (str < 0.002 || (shownClean() && !held && !(Date.now() < (window._cpv || 0)))) str = 0; // a finished image you browse to shows clean at once
    if (tN == null) tN = target;
    if (j && picMode() === "live") fadeT = 0;
    else if (fadeT) {
      const p = Math.max(0, (t - fadeT) / (fadeDur || FADE));
      if (p >= 1) {
        fadeT = 0;
        fadeDur = 0;
      } else tN = fadeFrom * (0.5 + 0.5 * Math.cos(Math.PI * p)) * (hover ? 0.12 : 1);
    } // after the finish: a slow fade, slow at first
    nstr += (tN - nstr) * Math.min(1, dtr / 260);
    if (nstr < 0.002 || (shownClean() && !held && !(Date.now() < (window._cpv || 0)))) nstr = 0;
    document
      .getElementById("frame")
      .style.setProperty(
        "--vf",
        str
          ? `blur(${(24 * str).toFixed(1)}px) brightness(${(1 - 0.45 * str).toFixed(3)}) saturate(${(1 - 0.4 * str).toFixed(3)})`
          : "none",
      );
    v.clearRect(0, 0, W, H);
    if ((cover0 === "camera" ? nstr : str) > 0 && W) {
      const T = t / 1000;
      const cover = skin().cover;
      v.globalCompositeOperation = "source-over";
      v.fillStyle =
        cover === "crt"
          ? `rgba(0,9,4,${0.88 * str})`
          : cover === "camera"
            ? `rgba(2,5,9,${0.8 * nstr})`
            : `rgba(8,8,12,${0.3 * str})`;
      v.fillRect(0, 0, W, H);
      if (cover === "crt") {
        const pr = j ? Math.max(0, Math.min(1, jobProgress(j).p || 0)) : 0.55;
        crt.draw(v, W, H, t, dt, d, cols.map(toHex), {
          str,
          resolve: held ? 0 : smooth(0.18, 0.6, pr),
          src: held ? null : $("cv"),
        });
        sparks.length = 0;
      } else if (cover === "camera") {
        if (j && j.started) CV.t0 = j.started;
        if (j) CV.pr = Math.max(0, Math.min(1, jobProgress(j).p || 0));
        const age =
          (j && j.started) || held
            ? (Date.now() - CV.t0) / 1000
            : Math.max(0, (Date.now() - (window._cpv || Date.now()) + 6000) / 1000);
        cam.draw(v, W, H, t, d, cols.map(toHex), {
          str: nstr,
          age,
          prog: j ? CV.pr : held ? Math.max(CV.pr, 0.55) : 0.55,
          step: j ? j.step : null,
          src: held ? null : $("cv"),
          noImg: held,
        });
      }
      v.globalCompositeOperation = "lighter";
      if (cover === "bands")
        for (let k = 0; k < 3; k++) {
          const span = W + H,
            off = ((T * (38 + k * 17) * d + (k * span) / 3) % (span * 1.4)) - span * 0.2;
          const g = v.createLinearGradient(off, 0, off + H * 0.9, H * 0.9);
          const a = (0.1 - 0.025 * k) * str;
          const col = k === 1 ? cols[2] : cols[k === 0 ? 0 : 1];
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(0.45, "rgba(0,0,0,0)");
          g.addColorStop(0.5, col);
          g.addColorStop(0.55, "rgba(0,0,0,0)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          v.globalAlpha = a * 2.2;
          v.fillStyle = g;
          v.fillRect(0, 0, W, H);
        }
      const want = cover === "crt" || cover === "camera" ? 0 : Math.round((230 * str * (W * H)) / (700 * 900 * d * d));
      while (sparks.length < want)
        sparks.push({
          x: Math.random() * (W + 40 * d) - 20 * d,
          y: Math.random() * (H + 40 * d) - 20 * d,
          s: (0.5 + Math.random() * 1.3) * d,
          v: (0.012 + Math.random() * 0.03) * d,
          ph: Math.random() * 6.28,
          tw: 0.6 + Math.random() * 1.8,
          c: Math.random() < 0.07 ? "comp" : Math.random() < 0.5 ? "w" : Math.random() < 0.5 ? "a3" : "a1",
        });
      if (sparks.length > want) sparks.length = want;
      for (const p of sparks) {
        p.x += p.v * dt;
        p.y += p.v * dt * 0.62;
        const m = 20 * d;
        if (p.x > W + m) p.x -= W + 2 * m;
        if (p.y > H + m) p.y -= H + 2 * m; // wrap around: density stays even however long the render
        const tw = Math.max(0, Math.sin(T * p.tw * 3 + p.ph));
        const a = tw * tw * str * 0.9;
        if (a < 0.01) continue;
        v.globalAlpha = a * 0.55;
        const r = p.s * 7;
        v.drawImage(spr[p.c], p.x - r, p.y - r, r * 2, r * 2);
        v.globalAlpha = a;
        v.strokeStyle = "#ffffff";
        v.lineWidth = 0.7 * d;
        const L = p.s * 4 * tw;
        v.beginPath();
        v.moveTo(p.x - L, p.y);
        v.lineTo(p.x + L, p.y);
        v.moveTo(p.x, p.y - L);
        v.lineTo(p.x, p.y + L);
        v.stroke();
      }
      v.globalAlpha = 1;
      v.globalCompositeOperation = "source-over";
    } else sparks.length = 0;
    haloFrame(t, dt, cover0);
    e.clearRect(0, 0, W, H);
    if (W && S.view === "gen" && skin().cover === "camera") cam.drawFlash(e, W, H, t, cols.map(toHex));
    if (sweepT && W) {
      const p = (t - sweepT) / 900;
      if (p >= 1 || p < 0) sweepT = 0;
      else if (S.view === "gen") crt.sweep(e, W, H, p, d, cols.map(toHex));
    }
    if (burst > 0 && W && S.view === "gen") {
      const k = burst / burstMax;
      /* full rate at the start, tapering to 0 over the window */
      let n = dt * 0.09 * k * (W / 600);
      while (n-- > 0 || Math.random() < n) {
        const mx = 2200 + Math.random() * 2400;
        embers.push({
          x: Math.random() * W,
          y: H + 6 * d,
          vx: (Math.random() - 0.5) * 0.03 * d,
          vy: (-H * (0.75 + Math.random() * 0.6)) / mx,
          life: 0,
          max: embersHalf ? mx * 0.6 : mx,
          r: (1 + Math.random() * 2) * d,
          c: Math.random() < 0.05 ? "comp" : Math.random() < 0.65 ? "a1" : "a2",
          ph: Math.random() * 6.28,
        });
      }
    }
    burst = Math.max(0, burst - dt);
    if (embers.length) {
      e.globalCompositeOperation = "lighter";
      const hardStars = skin().cover === "camera";
      embers = embers.filter(p => {
        p.life += dt;
        if (p.life > p.max) return false;
        p.x += (p.vx + Math.sin(p.life / 420 + p.ph) * 0.015 * d) * dt;
        p.y += p.vy * dt;
        const q = p.life / p.max;
        const a =
          Math.min(1, q * 6) *
          (hardStars ? Math.pow(1 - q, 1.8) : 1 - q) *
          (0.75 + 0.25 * Math.sin(p.life / 90 + p.ph));
        const r = p.r * 5 * (1 - q * 0.4);
        if (hardStars) {
          if (p.g == null) {
            p.g = Math.random() < 0.14;
            p.sc = Math.random() < 0.25 ? mixHex("#eef3ff", toHex(cols[1]), 0.45) : "#eef3ff";
          } // Aurora: crisp stars, like its sky — a few with a small glint
          const s = Math.max(1, p.r * (p.g ? 1.15 : 0.75)),
            tw = a * (0.6 + 0.4 * Math.sin(p.life / 140 + p.ph * 3));
          e.globalAlpha = tw;
          e.fillStyle = p.sc;
          e.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.ceil(s), Math.ceil(s));
          if (p.g) {
            const L = s * 3.2;
            e.globalAlpha = tw * 0.55;
            e.strokeStyle = p.sc;
            e.lineWidth = Math.max(0.6, d * 0.6);
            e.beginPath();
            e.moveTo(p.x - L, p.y);
            e.lineTo(p.x + L, p.y);
            e.moveTo(p.x, p.y - L);
            e.lineTo(p.x, p.y + L);
            e.stroke();
          }
          return true;
        }
        e.globalAlpha = a * 0.7;
        e.drawImage(spr[p.c], p.x - r, p.y - r, r * 2, r * 2);
        e.globalAlpha = a;
        e.drawImage(spr.w, p.x - r * 0.25, p.y - r * 0.25, r * 0.5, r * 0.5);
        return true;
      });
      e.globalCompositeOperation = "source-over";
      e.globalAlpha = 1;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
