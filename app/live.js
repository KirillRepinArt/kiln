// @ts-check
/* ======================= the app's connection to its server =======================
   Everything that talks to Kiln's server: the queue, pictures, previews, LoRAs and models. Without the server (opened
   as a file, or server.py stopped) a note says so, and the page reloads by itself once the server answers. */
import { act, dn, dnHide, dnHideIn, dnId, dnT, removeJob, setPaused } from "./actions.js";
import { esc, toast } from "./boot.js";
import { $, hit, target } from "./dom.js";
import { fg, fu, fx, loadModels, models, rb, refreshUp, rescanLoras, up, upl, us, usl } from "./forge.js";
import { doneById, replaceJobs } from "./jobs.js";
import { PV, pv, shownDone } from "./picstate.js";
import { imgs, inBin, shownMissing, urlFor } from "./pictures.js";
import { frame } from "./progress.js";
import { S, save } from "./state.js";
import { poll } from "./sync.js";
import { showView, tabGo } from "./tabs.js";

/** @type {any} the server's first answer (server/web.py get_state) */
export let st;
/** a request to Kiln's server: GET, or POST with b as JSON; resolves to the answer @param {string} p @param {object} [b]
 * @returns {Promise<any>} */
export const api = (p, b) =>
  fetch(
    p,
    b === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) },
  ).then(r => r.json());
/* the rest of the connection: pictures.js, sync.js, actions.js, forge.js, progress.js (same bundle, in that order) */

/* the connection starts: the first answer from the server (or the note that it isn't there), then the wiring and
   the first poll — called from main.js */
export async function startLive() {
  try {
    if (!location.protocol.startsWith("http")) throw 0;
    st = await (await fetch("/api/state")).json();
  } catch (e) {
    $("offline").classList.add("show");
    if (location.protocol.startsWith("http"))
      setInterval(
        () =>
          fetch("/api/state").then(
            () => location.reload(),
            () => {},
          ),
        3000,
      );
    return;
  }
  window.LIVE = true;
  document.documentElement.classList.add("live");
  $("mRestore").onclick = async () => {
    const d = shownMissing();
    if (!d) return;
    const r = await api(`/api/jobs/${d.id}/restore`, {});
    toast(r.error || "Restored from the Recycle Bin");
    delete inBin[d.id];
    poll();
  };
  $("mSave").onclick = async () => {
    const d = shownMissing();
    if (!d) return;
    const e = imgs.get(urlFor(d));
    if (!e || !e.i.naturalWidth) return toast("Kiln no longer has a copy");
    const c = document.createElement("canvas");
    c.width = e.i.naturalWidth;
    c.height = e.i.naturalHeight;
    /** @type {CanvasRenderingContext2D} */ (c.getContext("2d")).drawImage(e.i, 0, 0);
    const r = await api(`/api/jobs/${d.id}/saveback`, { data: c.toDataURL("image/png") });
    toast(r.error || `Saved back as ${d.file}`);
    imgs.delete(urlFor(d));
    poll();
  };
  $("mAgain").onclick = async () => {
    const d = shownMissing();
    if (!d) return;
    const sp = Object.assign({}, d.spec, { seed: d.seed, as_file: d.file });
    await api("/api/jobs", { jobs: [sp] });
    await api(`/api/jobs/${d.id}/remove`, {});
    toast(`Rendering it again — same seed, saved as ${d.file}`);
    poll();
  };
  $("mRemove").onclick = () => {
    const d = shownMissing();
    if (d) removeJob(d);
  };
  $("qwrap").addEventListener(
    "click",
    e => {
      if (target(e).id === "clearDone") {
        e.stopImmediatePropagation();
        /* the files stay in the output folder; the list comes back with Undo (kept in memory while Kiln runs) */
        api("/api/clear", {}).then(r => {
          poll();
          const n = /** @type {{ cleared?: number }} */ (r).cleared || 0;
          if (n)
            toast(
              `${n} cleared from the list — the files stay in the output folder`,
              "Undo",
              () => api("/api/unclear", {}).then(poll),
              "queue",
            );
        });
      }
    },
    true,
  );
  dn.addEventListener("mouseenter", () => clearTimeout(dnT));
  dn.addEventListener("mouseleave", () => {
    dnHideIn(2500);
  });
  dn.onclick = () => {
    const j = doneById(dnId);
    dnHide();
    if (!j) return;
    tabGo(() => {
      PV.from = S.view !== "gen" ? S.view : null;
      showView("gen");
      pv("browse", j);
    });
  };
  $("resumeBtn").onclick = e => {
    e.stopPropagation();
    setPaused(false);
  };
  for (const [el, get] of /** @type {[HTMLElement, () => import("./types.js").Job | null][]} */ ([
    [$("sideGen"), () => shownDone()],
  ])) {
    el.addEventListener(
      "click",
      e => {
        const b = hit(e, "button");
        if (!b || b.dataset.a === "thumb") return;
        e.stopImmediatePropagation();
        act(b.dataset.a, get());
      },
      true,
    );
  }
  /** @type {HTMLInputElement} */ (fg.querySelector('[data-set="outdir"]')).value = st.out_dir;
  /** @type {HTMLInputElement} */ (fg.querySelector('[data-set="outdir"]')).readOnly = true;
  fu.readOnly = true;
  fu.title = "Set in config.local.json";
  up.dataset.set = "upscaler";
  upl.textContent = "Upscaler";
  us.dataset.set = "upscale";
  us.innerHTML = '<option value="2">×2</option><option value="1.5">×1.5</option><option value="4">×4</option>';
  usl.textContent = "Upscale by";
  for (const el of [upl, up, usl, us]) fg.insertBefore(el, fx); /* at the end of Output, above Appearance */
  for (const el of [up, us]) {
    el.addEventListener("change", () => {
      /** @type {Record<string, any>} */ (S.set)[/** @type {string} */ (el.dataset.set)] = el.value;
      save();
    });
  }
  rb.className = "iconbtn";
  rb.title = "Refresh models & LoRAs from Forge";
  rb.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/></svg>';
  rb.onclick = async () => {
    rb.classList.add("spin");
    await loadModels(true);
    refreshUp();
    rb.classList.remove("spin");
    toast("Models and LoRAs refreshed");
  };
  /** @type {Element} */ (document.querySelector(".mcard .mact")).prepend(rb);
  /* About: the version, and a manual update check — the only time Kiln goes online, and only when you ask */
  $("aboutV").textContent = "Kiln " + (st.version || "");
  $("updBtn").onclick = async () => {
    const b = /** @type {HTMLButtonElement} */ ($("updBtn")),
      o = $("updRes");
    b.disabled = true;
    o.textContent = "Checking GitHub…";
    /** @type {any} the server's answer */
    let r;
    try {
      r = await api("/api/update-check", {});
    } catch (e) {
      r = { error: "Kiln server not reachable" };
    }
    b.disabled = false;
    o.innerHTML = r.error
      ? esc(r.error)
      : r.newer
        ? `<b>${esc(r.latest)} is available</b> (you have v${esc(r.current)}). To update: in the Kiln folder run <code>git pull</code> — or download the ZIP from <a href="${esc(r.url)}" target="_blank" rel="noopener">GitHub</a> — then close Kiln and run kiln.bat again.`
        : `You have the latest version (v${esc(r.current)}).`;
  };
  $("lRefresh").onclick = () => rescanLoras(true);
  /** @type {Element} */ (document.querySelector('.tab[data-v="loras"]')).addEventListener("click", () =>
    rescanLoras(false),
  );
  requestAnimationFrame(frame);
  /* ---------- go ---------- */
  addEventListener("pagehide", () => navigator.sendBeacon("/api/bye"));
  /* back from the background (where Edge slows timers to ~1 a minute): check in at once */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") fetch("/api/state").catch(() => {});
  });
  replaceJobs([]);
  await loadModels(false);
  refreshUp();
  if (!models)
    toast(
      st.forge.starting
        ? "Starting Forge — jobs start when it's ready"
        : "Forge isn't running — Kiln picks it up as soon as it starts",
    );
  poll();
}
