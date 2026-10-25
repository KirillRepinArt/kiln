/* Kiln · progress: real steps, a smooth glide in between, the live preview, the frame loop */
import { $ } from "./dom.js";
import { S, SEC_PER_STEP, SIZES, draft, jobs } from "./state.js";
import { browseStatus, current, sizeFrame } from "./stage.js";
import { PV, browsed, doneById, onShow, picMode, pv, shownDone } from "./picstate.js";
import { justDone, peekJob, setJustDone } from "./queue.js";
import { fmt } from "./boot.js";
import { api } from "./live.js";
import { drawTo, missUI, paint, xfadeEnd } from "./pictures.js";
import { forgeOk, forgeStarting } from "./sync.js";
import { capTxt } from "./actions.js";

/* ---------- progress: real steps, smooth glide in between, live preview ---------- */
let lastPrev = 0,
  prevLoading = false;
/* countdown from the history-based total; if the first step came late compared with history, stretch it */
function remaining(j) {
  if (!j.est || !j.started) return null;
  const el = (Date.now() - j.started) / 1000;
  let f = 1;
  if (j.t_first && j.est_first) {
    const at = (j.t_first - j.started) / 1000;
    f = Math.max(0.75, Math.min(2.5, at / j.est_first));
  }
  const r = j.est * f - el;
  return r > 2 ? r : null;
} // overdue: fall back to step timing
/* before the first step: a word in Kiln's spirit, with the real state small beside it */
const WORDS = ["Stoking the kiln", "Kindling", "Warming up", "Simmering", "Firing up", "Tempering", "Gathering embers"];
function setTxt(h) {
  const el = $("ptxt");
  if (el.innerHTML !== h) el.innerHTML = h;
}
export let nextEst = null,
  neKey = "";
/* a job finished: the estimate shown for the next one is worked out again */
export function forgetNextEstimate() {
  neKey = "";
}
function refreshEst() {
  const [w, h] = SIZES[S.mp][S.ar],
    k = `${w}x${h}x${S.steps}`;
  if (k === neKey) return;
  neKey = k;
  api("/api/estimate", { spec: { w, h, steps: S.steps } })
    .then(r => {
      if (neKey === k) nextEst = r.est;
    })
    .catch(() => {});
}
export function frame() {
  const j = current();
  const prog = $("prog");
  if (j) {
    prog.classList.add("show", "run");
    const per = Math.max(1, SEC_PER_STEP[j.mp] || 60) * 1000;
    if (j._lastStep !== j.step) {
      j._lastStep = j.step;
      j._ss = Date.now();
    }
    const part = j.steps ? Math.min((Date.now() - (j._ss || Date.now())) / per, 0.95) : 0;
    const p = j.steps ? Math.min(1, (j.step + part) / j.steps) : 0;
    prog.classList.toggle("stopping", !!j.stopping);
    if (!j.stopping) $("fill").style.width = (p * 100).toFixed(2) + "%";
    const rm = remaining(j),
      left = rm != null ? rm : j.eta && j.eta > 0 ? j.eta : Math.max(0, ((j.steps - j.step - part) * per) / 1000);
    const started = j.step || j.preview_rev;
    prog.classList.remove("cap");
    /* browsing a finished picture while this job renders: the row is about the picture you're looking at (its caption);
      the job becomes a chip at the row's end — a live thumbnail (soft until the last step, like the cover; a lock with
      privacy on) and its step and time left; the ring on Start shows its progress (effects.js) */
    const bg = S.view === "gen" && !!browsed(),
      pre = "";
    prog.classList.toggle("bgjob", bg);
    if (bg) {
      const im = $("pthImg"),
        key = j.id + ":" + (j.preview_rev || 0);
      if (im.dataset.k !== key) {
        im.dataset.k = key;
        if (j.preview_rev) im.src = `/api/preview/${j.id}?r=${j.preview_rev}`;
        else im.removeAttribute("src");
      }
      $("pth").classList.toggle("soft", j.step < j.steps - 1);
      $("pchipT").textContent = j.stopping
        ? "stopping"
        : started
          ? `${Math.min(j.step + 1, j.steps)}/${j.steps}${rm != null || j.eta ? ` · ${fmt(left)}` : ""}`
          : "starting";
      capTxt(browsed());
    } else if (j.stopping) {
      const r = (per - (Date.now() - (j._ss || Date.now()))) / 1000;
      setTxt("Stopping after this step");
      $("peta").textContent = r > 3 ? `stops in ~${fmt(r)}` : "any moment now";
    } /* Forge only stops between steps; the next job starts right after */
    else {
      const other =
        S.view === "gen" &&
        picMode() === "live" &&
        !peekJob &&
        j.kind !== "upscale" &&
        (draft || "").trim() !== (j.raw || j.prompt || "").trim()
          ? ` <span class="sub">· #${j.id} · another prompt</span>`
          : "";
      setTxt(
        pre +
          (j.kind === "upscale"
            ? "Upscaling…"
            : started
              ? `Step ${Math.min(j.step + 1, j.steps)}/${j.steps}` + other
              : `${WORDS[j.id % WORDS.length]}… <span class="sub">· ${j.warm ? "starting" : "loading model"}</span>`),
      );
      $("peta").textContent = j.kind === "upscale" ? "" : started || rm != null ? `~${fmt(left)} left` : "";
    }
    if (j.preview_rev && PV.still && PV.still.kind === "result" && PV.browse == null) pv("preview");
    if (S.view === "gen" && picMode() === "live") {
      const f = $("frame");
      f.classList.add("has");
      $("idle").style.display = "none";
      if (+$("cv").dataset.j !== j.id) {
        $("cv").dataset.j = j.id;
        $("cv").dataset.d = "";
        $("cv").dataset.want = "";
        lastPrev = 0;
        const c = $("cv");
        c.width = 1;
        c.height = 1;
        sizeFrame();
      }
      if (j.preview_rev && j.preview_rev !== lastPrev && !prevLoading) {
        prevLoading = true;
        const r = j.preview_rev;
        const i = new Image();
        const jid = j.id;
        i.onload = () => {
          if (+$("cv").dataset.j === jid && picMode() === "live") {
            drawTo($("cv"), i, false);
            xfadeEnd();
          }
          lastPrev = r;
          prevLoading = false;
        };
        i.onerror = () => {
          prevLoading = false;
          lastPrev = r;
        };
        i.src = `/api/preview/${j.id}?r=${r}`;
      }
    }
    const mini = document.querySelector(`.qi[data-id="${j.id}"] .mini i`);
    if (mini) mini.style.width = p * 100 + "%";
    const lp = document.querySelector(`img[data-lp="${j.id}"]`);
    if (lp && j.preview_rev && lp.dataset.r != j.preview_rev) {
      lp.dataset.r = j.preview_rev;
      lp.src = `/api/preview/${j.id}?r=${j.preview_rev}`;
    } /* Q6: the render, small, in its queue row */
  } else if (!window._dp) {
    prog.classList.add("show");
    prog.classList.remove("run", "stopping", "bgjob");
    $("fill").style.width = "0%";
    prog.classList.toggle("cap", S.view === "gen" && !!shownDone());
    if (!forgeOk) {
      $("ptxt").textContent = forgeStarting ? "Starting Forge…" : "Forge not running";
      $("peta").textContent = forgeStarting ? "jobs start when it's ready" : "queue waits for it";
    } else if (window.qPaused && jobs.some(x => x.status === "pending")) {
      $("ptxt").textContent = "Queue paused";
      $("peta").textContent = `${jobs.filter(x => x.status === "pending").length} waiting`;
    } else if (S.view === "gen" && PV.news != null && picMode() === "still" && doneById(PV.news)) {
      $("ptxt").textContent = `#${PV.news} finished`;
      $("peta").textContent = "click to see it";
    } /* behind your reference (Q1) */
    else if (S.view === "gen" && shownDone()) capTxt(shownDone());
    else {
      refreshEst();
      $("ptxt").textContent = "Ready";
      $("peta").textContent = `~${fmt(nextEst ?? S.steps * (SEC_PER_STEP[S.mp] || 60))} per image`;
    }
    /* the empty frame says what's next: the shape and size, and how long it takes (or why nothing starts) */
    {
      const [w, h] = SIZES[S.mp][S.ar],
        T = !forgeOk ? (forgeStarting ? "Starting Forge…" : "Forge isn't running") : `Next: ${S.ar} · ${w}×${h}`,
        Ss = !forgeOk
          ? forgeStarting
            ? "jobs start when it's ready"
            : "the queue waits for it"
          : `Estimated time: ~${fmt(nextEst ?? S.steps * (SEC_PER_STEP[S.mp] || 60))}`;
      if ($("idleT").textContent !== T) $("idleT").textContent = T;
      if ($("idleS").textContent !== Ss) $("idleS").textContent = Ss;
    }
    prog.classList.toggle("paused", !!window.qPaused && jobs.some(x => x.status === "pending"));
  }
  if (picMode() !== "live") {
    const d = onShow();
    if (d && S.view === "gen") {
      if ($("cv").dataset.d != d.id || $("cv").dataset.m !== String(!!d.missing)) {
        $("cv").dataset.d = d.id;
        $("cv").dataset.m = String(!!d.missing);
        $("cv").dataset.j = "";
        sizeFrame();
        if (justDone === d.id) {
          const f = $("frame");
          f.classList.remove("reveal");
          void f.offsetWidth;
          f.classList.add("reveal");
          setTimeout(() => f.classList.remove("reveal"), 1200);
          setJustDone(null);
        }
        paint($("cv"), d, 1);
      }
      $("frame").classList.add("has");
      $("idle").style.display = "none";
    } else if (!d) {
      $("frame").classList.remove("has");
      $("idle").style.display = "";
      const c = $("cv");
      if (c.width > 1) {
        c.width = 1;
        c.height = 1;
        c.dataset.d = "";
        c.dataset.j = "";
      }
    }
  }
  missUI(onShow());
  browseStatus();
  requestAnimationFrame(frame);
} /* the frame loop: progress, the live preview, the picture on show */

export function jobProgress(j) {
  const per = Math.max(1, SEC_PER_STEP[j.mp] || 60) * 1000;
  const part = j.steps && j._ss ? Math.min((Date.now() - j._ss) / per, 0.95) : 0;
  const p = j.steps ? Math.min(1, (j.step + part) / j.steps) : 0;
  const started = j.step || j.preview_rev,
    rm = remaining(j);
  return {
    p,
    left:
      rm != null
        ? rm
        : started
          ? j.eta && j.eta > 0
            ? j.eta
            : Math.max(0, ((j.steps - j.step - part) * per) / 1000)
          : null,
  };
}
