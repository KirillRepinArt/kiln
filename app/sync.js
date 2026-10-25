/* Kiln · the server's job list → the page's: polling, what changed, a finished job's moment */
import { forgetNextEstimate } from "./progress.js";
import { $ } from "./dom.js";
import { S, SEC_PER_STEP, jobs, save, setJobs } from "./state.js";
import { current, lastDone } from "./stage.js";
import { PV, pv, pvPrune } from "./picstate.js";
import { onJobDone } from "./effects.js";
import { dragId, peekJob, setPeekJob } from "./queue.js";
import { renderAll, toast } from "./boot.js";
import { doneNote, makeQThumb } from "./actions.js";
import { forgeMsg, loadModels, models, refreshUp } from "./forge.js";

/* ---------- server job -> UI job ---------- */
function toUI(s) {
  const sp = s.spec || {};
  return Object.assign({}, sp, {
    id: s.id,
    kind: s.kind,
    status: s.status,
    file: s.file || null,
    seed: s.seed_used ?? sp.seed,
    est: s.est,
    est_first: s.est_first,
    t_first: s.t_first && s.t_first * 1000,
    step: s.step || 0,
    steps: s.steps || sp.steps || 0,
    progress: s.progress || 0,
    eta: s.eta,
    preview_rev: s.preview_rev || 0,
    error: s.error,
    started: s.started && s.started * 1000,
    finished: s.finished && s.finished * 1000,
    loras: sp.loras || [],
    mp: sp.mp || "1.0",
    ar: sp.ar || "1:1",
    spec: sp,
    warm: !!s.warm,
    stopping: !!s.stopping,
    missing: !!s.missing,
    created: s.created && s.created * 1000,
  });
}
export let sig = "",
  forgeOk = true,
  forgeStarting = false,
  firstPoll = true,
  loadingM = false;
export const seen = new Set();
let since = "";
/* the next poll asks for the whole list (after something that changed it on the server) */
export function fullNextPoll() {
  sig = "";
}
export async function poll() {
  let s;
  try {
    s = await (await fetch("/api/state" + (since ? "?since=" + since : ""))).json();
  } catch (e) {
    forgeMsg("Kiln server not reachable");
    return;
  }
  forgeOk = s.forge.ok;
  forgeStarting = !!s.forge.starting;
  if (window.qPaused !== !!s.paused) {
    window.qPaused = !!s.paused;
    sig = "";
  }
  if (forgeOk && !models && !loadingM) {
    loadingM = true;
    loadModels(false).then(ok => {
      loadingM = false;
      if (ok) {
        refreshUp();
        toast("Forge is ready — models and LoRAs loaded");
      }
    });
  }
  for (const b in s.stats.sec_per_step || {}) SEC_PER_STEP[b] = Math.max(1, s.stats.sec_per_step[b]);
  if ((typeof dragId !== "undefined" && dragId != null) || window._rp) {
    setTimeout(poll, 700);
    return;
  } // dragging, or the new order not saved yet: keep the local order
  if (s.same) {
    const r = s.run,
      cur = current(); /* nothing changed but the running job's progress */
    if (r && cur && cur.id === r.id) {
      const u = toUI(r);
      u._ss = cur._ss;
      u._lastStep = cur._lastStep;
      Object.assign(cur, u);
    } else if (r || cur) {
      since = "";
      setTimeout(poll, 0);
      return;
    } /* out of step: the full list next */
    const n = jobs.filter(j => j.status === "pending" || j.status === "running").length;
    $("badge").textContent = n;
    $("badge").classList.toggle("show", n > 0);
    $("tabN").textContent = n || "";
    setTimeout(poll, current() ? 700 : 1800);
    return;
  }
  since = s.sig || "";
  const prev = new Map(jobs.map(j => [j.id, j]));
  setJobs(
    s.jobs.map(x => {
      const u = toUI(x),
        o = prev.get(u.id);
      if (o && o.status === "running" && u.status === "running") {
        u._ss = o._ss;
        u._lastStep = o._lastStep;
      }
      return u;
    }),
  );
  for (const j of jobs) {
    const jk = j.id + ":" + (j.created || 0); /* the server can hand an id out again after its job left the list */
    if (j.status === "done" && !seen.has(jk)) {
      seen.add(jk);
      forgetNextEstimate();
      if (!firstPoll) {
        pv("done", j);
        onJobDone(j);
        if (S.view !== "gen" || PV.browse != null) doneNote(j);
        setTimeout(() => makeQThumb(j), 1500);
      }
    }
    if (j.status === "error" && !seen.has("e" + jk)) {
      seen.add("e" + jk);
      if (!firstPoll) toast(`Job #${j.id} failed: ${j.error || "error"}`);
    }
  }
  if (firstPoll) {
    const d = lastDone();
    window._jobsReady = true;
    if (d && S.clearedId !== d.id) PV.still = { id: d.id, kind: "result" }; // the last result, unless you had closed it
    if (S.seenDone != null) {
      const n = jobs.filter(x => x.status === "done" && x.id > S.seenDone).length;
      if (n) setTimeout(() => toast(`${n} image${n > 1 ? "s" : ""} finished while Kiln was closed`), 1200);
    }
  }
  {
    const m = Math.max(0, ...jobs.filter(x => x.status === "done").map(x => x.id));
    if (m !== S.seenDone) {
      S.seenDone = m;
      save();
    }
  }
  firstPoll = false;
  if (peekJob) setPeekJob(jobs.find(j => j.id === peekJob.id) || peekJob);
  pvPrune();
  const ns = jobs.map(j => `${j.id}:${j.status}:${j.file}:${j.missing ? 1 : 0}:${j.name || ""}`).join("|");
  if (ns !== sig) {
    sig = ns;
    renderAll();
  } else {
    const n = jobs.filter(j => j.status === "pending" || j.status === "running").length;
    $("badge").textContent = n;
    $("badge").classList.toggle("show", n > 0);
    $("tabN").textContent = n || "";
  }
  setTimeout(poll, current() ? 700 : 1800);
}
