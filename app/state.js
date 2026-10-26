// @ts-check
/* Kiln · data, state, icons, image hover buttons */
import { $, hit } from "./dom.js";
import { setThumbs } from "./forge.js";
import { shownDone } from "./picstate.js";
import { draft, setDraft } from "./prompt.js";

/* LoRA names → what the list shows: people LoRAs named krea2_<name>_v<N>… become "Name" + their version tags */
/** @param {string} file @param {string} folder */
export function parseName(file, folder) {
  const m = file.match(/^krea2_([a-z0-9]+)_v(\d+)(?:_(large|small))?(?:_(onetrainer|aitoolkit|kohya))?$/i);
  if (folder === "people" && m) {
    const n = m[1];
    return { display: n[0].toUpperCase() + n.slice(1), tags: [`v${m[2]}`, m[3], m[4]].filter(Boolean).join(" · ") };
  }
  return {
    display: file
      .replace(/^krea2_?/, "")
      .replace(/_krea2$/, "")
      .replace(/_lora_comfyui$/, "")
      .replace(/_rank_\d+/, "")
      .replace(/_/g, " "),
    tags: "",
  };
}
/** @type {import("./types.js").Lora[]} */
export const LORAS = []; /* filled from Forge's LoRA list (live.js loadModels) — never saved before that arrives */

/* ======================= state ======================= */
/** @type {import("./types.js").Settings} */
export const S = {
  pname: "",
  pph: 0,
  lw: 0,
  mp: "1.5",
  ar: "3:4",
  steps: 4,
  seedMode: "random",
  seed: 123456789,
  n: 1,
  view: "gen",
  theme: "starscape",
  oneFace: true,
  lfilter: "all",
}; /* settings of the removed demo mode */
/* LoRA entries are merged, never replaced: a LoRA this page doesn't know right now (none at start-up, before
   Forge's list arrives; a LoRA moved away for a while) keeps its saved name, weight and star. Replacing the list once
   wiped every renamed LoRA (2026-10-18). */
/* a test hook: one test stands in for a window closing mid-job, when nothing may be saved any more */
let savesBlocked = false;
export function blockSaves() {
  savesBlocked = true;
}
export function save() {
  if (savesBlocked) return;
  try {
    /** @type {any[]} what's saved (LoRAs this page doesn't know right now are kept) */
    let old = [];
    try {
      old = JSON.parse(localStorage.getItem("kiln_state") || "{}").loras || [];
    } catch (e) {}
    const cur = LORAS.map(({ name, on, onAt, w, fav, used, display, thumb }) => ({
        name,
        on,
        onAt,
        w,
        fav,
        used,
        display,
        thumb,
      })),
      have = new Set(cur.map(l => l.name));
    localStorage.setItem(
      "kiln_state",
      JSON.stringify({ S, draft, loras: cur.concat(old.filter(l => l && !have.has(l.name))) }),
    );
  } catch (e) {}
}
/** the prompt's text area (CodeMirror sits over it; it keeps the text in step) */
export const P = /** @type {HTMLTextAreaElement} */ ($("prompt"));

/* ======================= icons ======================= */
export const IC = {
  i2i: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="3" y="5" width="8" height="8" rx="1.5"/><rect x="13" y="11" width="8" height="8" rx="1.5"/><path d="M11 9h3a2 2 0 0 1 2 2"/><path d="M14.5 7.5L16 9l-1.5 1.5"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  folder:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  thumb:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="12" cy="9" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/><rect x="2.5" y="2.5" width="19" height="19" rx="4"/></svg>',
  x: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5M10 11v5.5M14 11v5.5"/></svg>',
  dice: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="#fff"/><circle cx="15" cy="15" r="1.2" fill="#fff"/><circle cx="15" cy="9" r="1.2" fill="#fff"/><circle cx="9" cy="15" r="1.2" fill="#fff"/></svg>',
};
/** @param {HTMLElement} el @param {() => import("./types.js").Job | null | undefined} getJob */
function sideButtons(el, getJob) {
  el.innerHTML = `<button data-tip="Send to img2img" data-a="i2i">${IC.i2i}</button>
  <button data-tip="Upscale" data-a="up">${IC.up}</button>
  <button data-tip="Open in default app" data-a="open">${IC.open}</button>
  <button data-tip="Show in folder" data-a="folder">${IC.folder}</button>
  <button data-tip="Use as LoRA thumbnail" data-a="thumb">${IC.thumb}</button>
  <button data-tip="Delete (Del) — to the Recycle Bin" data-a="del">${IC.trash}</button>`;
  el.onclick = e => {
    const b = hit(e, "button");
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.a === "thumb") setThumbs(getJob());
  };
} /* the other buttons: live.js */

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initState() {
  try {
    const sv = JSON.parse(localStorage.getItem("kiln_state") || "{}");
    Object.assign(S, sv.S || {});
    setDraft(sv.draft || "");
    delete (/** @type {any} */ (S).demo); // settings of the removed demo mode
    delete (/** @type {any} */ (S).ncount);
  } catch (e) {}
  P.value = draft || "";
  sideButtons($("sideGen"), () => shownDone());
}
