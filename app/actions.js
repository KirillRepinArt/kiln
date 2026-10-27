// @ts-check
/* Kiln · queue actions sent to the server: add, Vary, stop, remove, delete (with Undo), rename, pause, reorder */
import { renderAll, toast } from "./boot.js";
import { $ } from "./dom.js";
import { models } from "./forge.js";
import { doneList, dropJobs, jobs } from "./jobs.js";
import { api } from "./live.js";
import { peekHide } from "./peek.js";
import { PV, pv, pvPrune } from "./picstate.js";
import { imgs, urlFor } from "./pictures.js";
import { SIZES } from "./presets.js";
import { peekJob, slugify } from "./prompt.js";
import { expandVariants, stripComments } from "./prompttext.js";
import { LORAS, P, S, save } from "./state.js";
import { forgeOk, fullNextPoll, poll } from "./sync.js";
import { V, closeViewer, openViewer } from "./viewer.js";

/* ---------- queue actions -> server ---------- */
/* Start in the Gallery = Vary: the picture on show again — its prompt, settings, LoRAs and series — with a new seed.
   Your draft isn't touched, and you stay where you are (Midjourney's Vary; Edit is for changing it first) */
/** @param {import("./types.js").Job} j */
export async function vary(j) {
  if (j.kind === "upscale") {
    toast("Variations come from generated pictures, not upscales");
    return;
  }
  const sp = Object.assign({}, j.spec);
  delete sp.as_file;
  sp.seed = Math.floor(Math.random() * 4294967295);
  const r = await api("/api/jobs", { jobs: [sp] }),
    id = r && r.ids && r.ids[0];
  toast(
    `Variation of #${j.id} queued — new seed`,
    id ? "Undo" : "",
    () => api(`/api/jobs/${id}/cancel`, {}).then(poll),
    "queue",
  );
  if (!forgeOk) setTimeout(() => toast("Queued — Forge isn't running yet, jobs start when it is"), 2300);
  poll();
}
export async function addJobs() {
  if (peekJob) {
    await vary(peekJob);
    return;
  } /* the box shows a job's prompt: ▶ makes another like it */
  const text = P.value.trim();
  if (!text) {
    toast("Write a prompt first");
    return;
  }
  const on = LORAS.filter(l => l.on);
  on.forEach(l => (l.used = Date.now()));
  const L = on.map(l => ({ name: l.name, w: +l.w }));
  const set = S.set || {},
    [sampler, scheduler] = (set.sampler || "Euler · Simple").split(" · ");
  const [w, h] = SIZES[S.mp][S.ar];
  const mods = [set.vae, set.te].filter(Boolean);
  const specs = [];
  for (let i = 0; i < S.n; i++) {
    const seed = S.seedMode === "random" ? Math.floor(Math.random() * 4294967295) : (S.seed + i) >>> 0;
    const ex = expandVariants(stripComments(text));
    specs.push({
      prompt: ex.text,
      raw: text,
      picks: ex.picks,
      name: S.pname.trim(),
      mp: S.mp,
      ar: S.ar,
      w,
      h,
      steps: S.steps,
      seed,
      loras: L,
      checkpoint: set.ckpt || undefined,
      modules: mods.length ? mods : undefined,
      shift: +(set.shift || 1.15),
      cfg: +(set.cfg || 1),
      sampler,
      scheduler,
    });
  }
  save();
  await api("/api/jobs", { jobs: specs });
  pv("start");
  /* a picture you held gives way to the render once it has a picture */
  toast(S.n > 1 ? `Added ${S.n} jobs to the queue` : "Added to queue", "", null, "queue");
  if (!forgeOk) setTimeout(() => toast("Queued — Forge isn't running yet, jobs start when it is"), 2300);
  poll();
}
/** @param {import("./types.js").Job | null | undefined} j */
export async function stopJob(j) {
  if (!j) return;
  if (j.status === "running") j.stopping = true;
  await api(`/api/jobs/${j.id}/cancel`, {});
  poll();
}
/** @param {import("./types.js").Job} j */
export function openInApp(j) {
  return api("/api/open", { id: j.id });
}
/** the queue thumbnails still to make: the job, and the <img> waiting for it
 * @type {[import("./types.js").Job, HTMLImageElement | undefined][]} */
const qtq = [];
let qtBusy = false;
/** @param {import("./types.js").Job | null | undefined} j @param {HTMLImageElement} [el] */
export function makeQThumb(j, el) {
  if (!j || j.missing || !j.file || j.status !== "done" || qtq.some(x => x[0].id === j.id)) return;
  qtq.push([j, el]);
  if (!qtBusy) qtNext();
}
async function qtNext() {
  const n = qtq.shift();
  if (!n) {
    qtBusy = false;
    return;
  }
  qtBusy = true;
  const [j, el] = n;
  try {
    const held = imgs.get(
      urlFor(j),
    ); /* a picture already decoded (the one just finished, the one on show): no second load */
    const im =
      held && held.i.complete && held.i.naturalWidth
        ? held.i
        : await new Promise(r => {
            const i = new Image();
            i.decoding = "async";
            i.onload = () => r(i);
            i.onerror = () => r(null);
            i.src = /** @type {string} */ (urlFor(j));
          }); /* not via the cache: hundreds of thumbnails mustn't push the pictures you browse out of it */
    if (im) {
      const Z = 120,
        c = document.createElement("canvas");
      c.width = c.height = Z;
      const s = Math.min(im.naturalWidth, im.naturalHeight);
      /** @type {CanvasRenderingContext2D} */ (c.getContext("2d")).drawImage(
        im,
        (im.naturalWidth - s) / 2,
        (im.naturalHeight - s) / 2,
        s,
        s,
        0,
        0,
        Z,
        Z,
      );
      const data = c.toDataURL("image/jpeg", 0.82);
      const t = el || /** @type {HTMLImageElement | null} */ (document.querySelector(`img.qt[data-qt="${j.id}"]`));
      if (t) t.src = data;
      await api("/api/qthumb", { id: j.id, data });
    }
  } catch (e) {}
  setTimeout(qtNext, 0);
}
/* several at once: one Undo for all (Delete), or off the list (cancelled rows, missing files) */
/** @param {Iterable<number>} ids */
export async function deleteMany(ids) {
  const L = /** @type {import("./types.js").Job[]} */ ([...ids].map(id => jobs.find(j => j.id === id)).filter(Boolean)),
    del = L.filter(j => j.status === "done" && j.file && !j.missing),
    rm = L.filter(j => !del.includes(j));
  await Promise.all(
    del.map(j => api(`/api/jobs/${j.id}/delete`, {})).concat(rm.map(j => api(`/api/jobs/${j.id}/remove`, {}))),
  );
  dropJobs(L.map(j => j.id));
  pvPrune();
  renderAll();
  const msg = [del.length && `${del.length} moved to the Recycle Bin`, rm.length && `${rm.length} taken off the list`]
    .filter(Boolean)
    .join(" · ");
  toast(msg, del.length ? "Undo" : "", async () => {
    await Promise.all(del.map(j => api(`/api/jobs/${j.id}/undelete`, {})));
    poll();
  });
  poll();
}
/** @param {Iterable<number>} ids */
export async function removeMany(ids) {
  await Promise.all([...ids].map(id => api(`/api/jobs/${id}/remove`, {})));
  dropJobs(ids);
  pvPrune();
  renderAll();
  poll();
}
/* a picture finished while you weren't watching Generating: a small card slides out under the Generating tab (where
    its ring was); click = the picture in the Gallery. ~6 s, held while you're on it; several in a row = one card */
export let dnT = /** @type {number | undefined} */ (/** @type {unknown} */ (null)),
  dnN = 0,
  dnId = /** @type {number | null} */ (null);
/* the finished note goes away after ms (restarted by each call) */
/** @param {number} ms */
export function dnHideIn(ms) {
  clearTimeout(dnT);
  dnT = setTimeout(dnHide, ms);
}
export const dn = $("donenote");
export function dnHide() {
  clearTimeout(dnT);
  dn.classList.remove("show");
  dnN = 0;
}
/** @param {import("./types.js").Job} j */
export function doneNote(j) {
  dnN = dn.classList.contains("show") ? dnN + 1 : 1;
  dnId = j.id;
  $("dnTxt").textContent = dnN > 1 ? `${dnN} finished · the last #${j.id}` : `#${j.id} finished`;
  const im = /** @type {HTMLImageElement} */ ($("dnImg"));
  if (S.privacy) im.removeAttribute("src");
  else im.src = /** @type {string} */ (urlFor(j));
  dn.classList.toggle("priv", !!S.privacy);
  const r = /** @type {Element} */ (document.querySelector('.tab[data-v="gen"]')).getBoundingClientRect();
  dn.style.left = Math.round(r.left + r.width / 2) + "px";
  dn.style.top = Math.round(r.bottom + 10) + "px";
  dn.classList.add("show");
  dnHideIn(6000);
}
/** @param {import("./types.js").Job | null | undefined} j */
export async function removeJob(j) {
  if (!j) return;
  await api(`/api/jobs/${j.id}/remove`, {});
  poll();
}
export async function removeMissing() {
  await api("/api/remove-missing", {});
  poll();
}
/** @param {boolean} p */
export async function setPaused(p) {
  await api("/api/pause", { paused: p });
  window.qPaused = p;
  fullNextPoll();
  poll();
  toast(p ? "Queue paused — the current image finishes, nothing new starts" : "Queue resumed");
}
/** @param {import("./types.js").Job} j @param {string} n the series name */
export async function renameFile(j, n) {
  let r;
  try {
    r = await api(`/api/jobs/${j.id}/rename`, { name: n });
  } catch (e) {
    r = { error: "Kiln server not reachable" };
  }
  if (r.error) {
    toast(`Couldn't rename: ${r.error}`);
    return false;
  }
  if (r.file === r.old) {
    return true;
  }
  const back = { name: j.name || "", as_file: r.old };
  toast(`Renamed to ${r.file}`, "Undo", async () => {
    await api(`/api/jobs/${j.id}/rename`, back);
    poll();
  });
  poll();
  return true;
}
/** @param {import("./types.js").Job} j @param {string} n */
export async function renameJob(j, n) {
  await api(`/api/jobs/${j.id}/name`, { name: n });
  toast(
    n ? `Name saved — it will be saved as ${slugify(n)}-NNN.png` : "Name cleared — it will be named by date and seed",
  );
  poll();
}
/* Q1: delete = to the Recycle Bin, with Undo (the server waits 12 s before it really goes) */
/** @param {import("./types.js").Job | null | undefined} j */
export async function deleteJob(j) {
  if (!j) return;
  const L = doneList(),
    i = L.findIndex(x => x.id === j.id),
    d = PV.dir || 1,
    nb =
      L[i + d] ||
      L[i - d] ||
      null; /* where to land: onward in the way you were stepping (the ones behind you, you kept), else back */
  const r = await api(`/api/jobs/${j.id}/delete`, {});
  if (r.error) {
    toast(r.error);
    return;
  }
  dropJobs([j.id]);
  if ($("viewer").classList.contains("show") && V.job && V.job.id === j.id) {
    if (nb) openViewer(nb);
    else closeViewer();
  }
  pv("deleted", { job: j, next: nb });
  if (peekJob && peekJob.id === j.id) peekHide();
  toast("Moved to the Recycle Bin", "Undo", async () => {
    await api(`/api/jobs/${j.id}/undelete`, {});
    poll();
  });
  poll();
} /* the running job's chip: back to the render */
/* browsing: the status row is the picture's caption — its number, file, shape and size (click: its prompt) */
/** @param {import("./types.js").Job | null | undefined} b */
export function capTxt(b) {
  if (!b) return;
  const sp = b.spec || {},
    w = sp.w || (SIZES[b.mp] || {})[b.ar]?.[0],
    h = sp.h || (SIZES[b.mp] || {})[b.ar]?.[1];
  const t = [`#${b.id}`, b.file, b.ar, w && h ? `${w}×${h}` : ""].filter(Boolean).join(" · ");
  if ($("ptxt").textContent !== t) $("ptxt").textContent = t;
  $("peta").textContent = "";
}
/** an edit button on a picture @param {string | undefined} a its data-a @param {import("./types.js").Job | null | undefined} j */
export function act(a, j) {
  if (!j) return;
  if (a === "open") return api("/api/open", { id: j.id });
  if (a === "folder") return api("/api/reveal", { id: j.id });
  if (a === "up") {
    const u = (S.set || {}).upscaler || (models && models.upscalers[0]);
    if (!u) return toast("No upscalers found in Forge");
    return api("/api/upscale", { id: j.id, upscaler: u, scale: +((S.set || {}).upscale || 2) }).then(() => {
      toast(`Upscale ×${(S.set || {}).upscale || 2} queued (${u})`, "", null, "queue");
      poll();
    });
  }
  if (a === "i2i") return toast("img2img is next on the roadmap");
  if (a === "del") return deleteJob(j);
}
