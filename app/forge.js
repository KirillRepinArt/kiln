// @ts-check
/* Kiln · what comes from Forge: models, LoRAs, upscalers, the Settings facts; LoRA thumbnails kept by the server */
import { esc, toast } from "./boot.js";
import { renderChips } from "./chips.js";
import { $ } from "./dom.js";
import { current } from "./jobs.js";
import { api } from "./live.js";
import { renderLoras } from "./loras.js";
import { img, urlFor } from "./pictures.js";
import { LORAS, S, parseName, save } from "./state.js";
import { forgeOk } from "./sync.js";

/* ---------- LoRA thumbnails stored by the server ---------- */
/** a picture's face LoRAs get it as their thumbnail @param {import("./types.js").Job | null | undefined} j */
export async function setThumbs(j) {
  if (!j) return;
  const faces = /** @type {import("./types.js").Lora[]} */ (
    j.loras.map(x => LORAS.find(l => l.name === x.name)).filter(l => l && l.folder === "people")
  );
  if (!faces.length) {
    toast("This image used no face LoRA");
    return;
  }
  const im = await img(/** @type {string} */ (urlFor(j))).p; // a finished picture: it has a file
  if (!im) return;
  const t = document.createElement("canvas");
  t.width = t.height = 256;
  const s = Math.min(im.naturalWidth, im.naturalHeight);
  /** @type {CanvasRenderingContext2D} */ (t.getContext("2d")).drawImage(
    im,
    (im.naturalWidth - s) / 2,
    (im.naturalHeight - s) * 0.22,
    s,
    s,
    0,
    0,
    256,
    256,
  );
  const data = t.toDataURL("image/jpeg", 0.85);
  for (const l of faces) {
    const r = await api("/api/thumb", { name: l.name, data });
    l.thumb = r.url + "?t=" + Date.now();
  }
  save();
  renderLoras();
  toast(`Thumbnail set for ${faces.map(l => l.display).join(", ")}`);
}

/* ---------- models, LoRAs and settings from Forge ---------- */
/** what Forge offers (null: not loaded yet, or Forge not reachable) */
export let models = /** @type {import("./types.js").Models | null} */ (null);
/** @param {string} m */
export function forgeMsg(m) {
  if (!current()) {
    $("ptxt").textContent = m;
    $("peta").textContent = "";
  }
}
/** @param {boolean} refresh ask Forge to rescan its LoRA folder first */
export async function loadModels(refresh) {
  try {
    const r = await fetch("/api/models" + (refresh ? "?refresh" : ""));
    if (!r.ok) throw 0;
    models = /** @type {import("./types.js").Models} */ (await r.json());
  } catch (e) {
    models = null;
    return false;
  }
  /** @type {Record<string, any>} what's saved for each LoRA (your name, weight, star …) */
  let saved = {};
  try {
    (JSON.parse(localStorage.getItem("kiln_state") || "{}").loras || []).forEach(
      (/** @type {any} */ x) => (saved[x.name] = x),
    );
  } catch (e) {}
  const keep = Object.fromEntries(LORAS.map(l => [l.name, l]));
  LORAS.length = 0;
  for (const m of models.loras) {
    const p = parseName(m.name, m.category),
      sv = saved[m.name] || {},
      k = keep[m.name] || {};
    LORAS.push({
      name: m.name,
      folder: m.category,
      display: sv.display || p.display,
      tags: p.tags,
      w: k.w ?? sv.w ?? (m.category === "people" ? 0.7 : 0.5),
      on: k.on ?? !!sv.on,
      onAt: k.onAt ?? sv.onAt ?? 0,
      recipe: false,
      note: m.folder
        ? m.folder + (m.internal && m.internal !== m.name ? " · " + m.internal : "")
        : m.internal && m.internal !== m.name
          ? m.internal
          : "",
      fav: !!sv.fav,
      used: sv.used || 0,
      thumb: m.thumb || null,
    });
  }
  /** a Settings menu filled from Forge's list @param {string} key @param {{ v: string, t: string }[]} opts @param {string} label */
  const sel = (key, opts, label) => {
    const el = /** @type {HTMLSelectElement | null} */ (document.querySelector(`[data-set="${key}"]`));
    if (!el) return;
    const cur = (S.set || {})[key] || "";
    el.innerHTML =
      `<option value="">${label}</option>` + opts.map(o => `<option value="${esc(o.v)}">${esc(o.t)}</option>`).join("");
    el.value = opts.some(o => o.v === cur) ? cur : "";
    /** @type {Record<string, any>} */ (S.set)[key] = el.value;
  };
  const curCk = (models.current.sd_model_checkpoint || "").replace(/\s*\[[0-9a-f]+\]$/, "");
  sel(
    "ckpt",
    models.checkpoints.map(c => ({
      v: c,
      t: c.replace(/\s*\[[0-9a-f]+\]$/, ""),
    })),
    `Keep Forge's current (${curCk || "none"})`,
  );
  const vae = models.modules.filter(m => /vae|\bae\b/i.test(m.name)),
    te = models.modules.filter(m => !/vae|\bae\b/i.test(m.name));
  sel(
    "vae",
    vae.map(m => ({ v: m.file, t: m.name })),
    "Keep Forge's current",
  );
  sel(
    "te",
    te.map(m => ({ v: m.file, t: m.name })),
    "Keep Forge's current",
  );
  renderLoras();
  renderChips();
  return true;
}
// settings: read-only server facts + upscaler choice
export const fg = /** @type {HTMLElement} */ (document.querySelector(".mcard .fg"));
export const fu = /** @type {HTMLInputElement} */ (fg.querySelector('[data-set="forge"]'));
export const up = document.createElement("select");
export const upl = document.createElement("label");
export const us = document.createElement("select");
export const usl = document.createElement("label");
export const fx = $("fghAp");
export const refreshUp = () => {
  if (!models) return;
  up.innerHTML = models.upscalers.map(u => `<option>${esc(u)}</option>`).join("");
  if (/** @type {Record<string, any>} */ (S.set).upscaler)
    up.value = /** @type {Record<string, any>} */ (S.set).upscaler;
  us.value = /** @type {Record<string, any>} */ (S.set).upscale || "2";
};
export const rb = document.createElement("button");
/* the LoRA tab rescans the folder: with its button, and on its own when the tab opens (at most once a minute, never
    while a job runs — Forge is busy then); a quiet note only when something changed */
let lscanT = 0;
/** @param {boolean} manual you pressed the button (else: the tab opened) */
export async function rescanLoras(manual) {
  if (!manual && (current() || Date.now() - lscanT < 60000 || !forgeOk)) return;
  lscanT = Date.now();
  const b = $("lRefresh");
  b.classList.add("spin");
  const before = new Set(LORAS.map(l => l.name)),
    ok = await loadModels(true);
  b.classList.remove("spin");
  if (!ok) {
    if (manual) toast("Forge isn't reachable — LoRAs not rescanned");
    return;
  }
  const added = LORAS.filter(l => !before.has(l.name)).length,
    gone = [...before].filter(n => !LORAS.some(l => l.name === n)).length;
  if (added || gone)
    toast([added && `${added} new LoRA${added > 1 ? "s" : ""}`, gone && `${gone} gone`].filter(Boolean).join(" · "));
  else if (manual) toast("LoRAs are up to date");
}
