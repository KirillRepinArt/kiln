// @ts-check
/* Kiln · PNG Info tab */
import { esc, renderAll, toast } from "./boot.js";
import { $, targetField } from "./dom.js";
import { SIZES } from "./presets.js";
import { setDraft } from "./prompt.js";
import { LORAS, P, S, save } from "./state.js";
import { showView } from "./tabs.js";

/* ======================= PNG info (real) ======================= */
/** what a PNG's generation settings say (parseParams), and its series name (nameFrom)
 * @typedef {{ prompt: string, steps: number | null, seed: number | null, size: string | null,
 *   loras: { name: string, w: number }[], cfg: string | null, sampler: string | null, schedule: string | null,
 *   name?: string }} PngParams */
/** the PNG on show's settings (null: none loaded) */
export let parsed = /** @type {PngParams | null} */ (null);
export const drop = $("drop");
let kname = /** @type {string | null} the name Kiln wrote into the file (kiln_name) */ (null);
/* the series name: Kiln writes it into its PNGs (kiln_name); older Kiln files give it back from the file name (slug-NNN.png) */
/** @param {File} f */
export function nameFrom(f) {
  if (kname) return kname;
  const m = (f.name || "").match(/^(.+?)-\d{3,}(?:_x[\d.]+)?\.png$/i);
  return m && !/^kiln-\d{8}-\d{6}$|^\d+$/.test(m[1]) ? m[1].replace(/-/g, " ") : "";
}
/** @param {File} f */
export async function readPng(f) {
  kname = null;
  try {
    const u = URL.createObjectURL(f);
    const el = /** @type {HTMLImageElement} */ ($("pimgEl"));
    if (el.dataset.u) URL.revokeObjectURL(el.dataset.u);
    el.dataset.u = u;
    el.src = u;
    $("pimg").classList.add("show");
    $("pClear").style.display = "";
  } catch (e) {}
  const b = new Uint8Array(await f.arrayBuffer());
  const dv = new DataView(b.buffer);
  let o = 8,
    txt = null;
  const dec = new TextDecoder("latin1"),
    u8 = new TextDecoder("utf-8");
  if (b[1] !== 0x50) {
    $("pout").textContent = "Not a PNG file.";
    return;
  }
  while (o < b.length) {
    const len = dv.getUint32(o),
      type = dec.decode(b.slice(o + 4, o + 8)),
      d = b.slice(o + 8, o + 8 + len);
    if (type === "tEXt") {
      const z = d.indexOf(0);
      if (dec.decode(d.slice(0, z)) === "parameters") txt = u8.decode(d.slice(z + 1));
    }
    if (type === "iTXt") {
      const z = d.indexOf(0),
        k = dec.decode(d.slice(0, z));
      if (k === "parameters" || k === "kiln_name") {
        let p = z + 3;
        p = d.indexOf(0, p) + 1;
        p = d.indexOf(0, p) + 1;
        const v = u8.decode(d.slice(p));
        if (k === "parameters") txt = v;
        else kname = v;
      }
    }
    if (type === "IEND") break;
    o += 12 + len;
  }
  if (!txt) {
    $("pout").textContent = "No generation settings found in this PNG.";
    /** @type {HTMLButtonElement} */ ($("pSend")).disabled = true;
    return;
  }
  $("pout").dataset.raw = txt;
  parsed = parseParams(txt);
  parsed.name = nameFrom(f);
  renderPngInfo(txt);
  /** @type {HTMLButtonElement} */ ($("pSend")).disabled = false;
  $("pRaw").style.display = "";
}

/* ---------- PNG Info: prompt rendered like the editor + settings table ---------- */
/** a prompt line, drawn like the editor draws it @param {string} t */
function piLine(t) {
  const e = esc(t)
    .replace(/&lt;lora:([^&]*?)&gt;/g, '<span class="cm-lora">&lt;lora:$1&gt;</span>')
    .replace(/\{([^{}]*\|[^{}]*)\}/g, '<span class="cm-variant">{$1}</span>');
  if (/^\s*\/\//.test(t)) return `<div class="ln cmt">${e}</div>`;
  const m = t.match(/^(\s*)(\d+[.)]|[-*•])\s+/);
  if (m) return `<div class="ln list"><span class="cm-marker">${esc(m[2])}</span>${e.slice(esc(m[0]).length)}</div>`;
  if (/^\s*[^\s:][^:]{0,28}:\s*$/.test(t)) return `<div class="ln lbl">${e}</div>`;
  return `<div class="ln">${e || "&nbsp;"}</div>`;
}
/** the settings line → [name, value] pairs @param {string} line */
function piParams(line) {
  /** @type {string[][]} */
  const out = [];
  const re = /\s*([^:,]+?):\s*("(?:[^"\\]|\\.)*"|[^,]*)(?:,|$)/g;
  let m;
  while ((m = re.exec(line)) && m[0]) {
    out.push([m[1].trim(), m[2].trim().replace(/^"|"$/g, "")]);
  }
  return out;
}
/** @param {string} t the PNG's parameters text */
function renderPngInfo(t) {
  const o = $("pout");
  o.classList.remove("raw");
  const i = t.search(/\n(Negative prompt:|Steps:)/);
  const prompt = i >= 0 ? t.slice(0, i) : t;
  const rest = i >= 0 ? t.slice(i + 1) : "";
  const negM = rest.match(/^Negative prompt:\s*([\s\S]*?)(?=\nSteps:|$)/);
  const pline = (rest.match(/(^|\n)(Steps:[^\n]*)/) || [])[2] || "";
  let h = `<div class="pi-h">Prompt</div><div class="pi-p">${prompt.split("\n").map(piLine).join("")}</div>`;
  if (negM && negM[1].trim())
    h += `<div class="pi-h">Negative prompt</div><div class="pi-p pi-neg">${esc(negM[1].trim())}</div>`;
  const kv = piParams(pline);
  if (kv.length)
    h += `<div class="pi-h">Settings</div><dl class="pi-grid">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
  o.innerHTML = h;
  $("pRaw").textContent = "Show raw text";
}

/** @param {string} t @returns {PngParams} */
function parseParams(t) {
  const i = t.search(/\n(Negative prompt:|Steps:)/);
  const prompt = (i >= 0 ? t.slice(0, i) : t).trim();
  const g = (/** @type {string} */ k) => {
    const m = t.match(new RegExp(k + ":\\s*([^,\\n]+)"));
    return m ? m[1].trim() : null;
  };
  const loras = [...prompt.matchAll(/<lora:([^:>]+):([-\d.]+)>/g)].map(m => ({ name: m[1], w: +m[2] }));
  return {
    prompt: prompt.replace(/<lora:[^>]+>/g, "").trim(),
    steps: +(/** @type {any} */ (g("Steps"))) || null, // missing: +null = 0 → null
    seed: +(/** @type {any} */ (g("Seed"))) || null,
    size: g("Size"),
    loras,
    cfg: g("CFG scale"),
    sampler: g("Sampler"),
    schedule: g("Schedule type"),
  };
}
/* Keep seed: off = a new random seed, for variations; on = the image's own seed */
export function keepSeedUI() {
  $("pKeepSw").classList.toggle("on", !!S.keepSeed);
}

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initPnginfo() {
  drop.onclick = () => $("file").click();
  $("file").onchange = e =>
    /** @type {FileList} */ (targetField(e).files)[0] && readPng(/** @type {FileList} */ (targetField(e).files)[0]);
  ["dragenter", "dragover"].forEach(t =>
    drop.addEventListener(t, e => {
      e.preventDefault();
      drop.classList.add("over");
    }),
  );
  ["dragleave", "drop"].forEach(t =>
    drop.addEventListener(t, e => {
      e.preventDefault();
      drop.classList.remove("over");
    }),
  );
  drop.addEventListener("drop", e => {
    const f = /** @type {DataTransfer} */ (e.dataTransfer).files[0];
    if (f) readPng(f);
  });
  $("pClear").onclick = () => {
    const el = /** @type {HTMLImageElement} */ ($("pimgEl"));
    if (el.dataset.u) URL.revokeObjectURL(el.dataset.u);
    el.removeAttribute("src");
    el.dataset.u = "";
    $("pimg").classList.remove("show");
    const o = $("pout");
    o.classList.remove("raw");
    o.textContent = "";
    o.dataset.raw = "";
    parsed = null;
    /** @type {HTMLButtonElement} */ ($("pSend")).disabled = true;
    $("pRaw").style.display = "none";
    $("pClear").style.display = "none";
    /** @type {HTMLInputElement} */ ($("file")).value = "";
  };
  $("pRaw").onclick = () => {
    const o = $("pout");
    if (o.classList.contains("raw")) {
      renderPngInfo(/** @type {string} */ (o.dataset.raw));
    } else {
      o.classList.add("raw");
      o.textContent = /** @type {string} */ (o.dataset.raw);
      $("pRaw").textContent = "Show formatted";
    }
  };
  $("pKeep").onclick = e => {
    e.preventDefault();
    S.keepSeed = !S.keepSeed;
    save();
    keepSeedUI();
  };
  keepSeedUI();
  $("pSend").onclick = () => {
    if (!parsed) return;
    P.value = parsed.prompt;
    setDraft(parsed.prompt);
    if (parsed.steps) S.steps = parsed.steps;
    if (parsed.seed && S.keepSeed) {
      S.seed = parsed.seed;
      S.seedMode = "fixed";
    } else S.seedMode = "random";
    S.set = S.set || {};
    /** a Settings field: the PNG's value (a menu gets it added if it hasn't it) @param {string} k @param {string} v */
    const setF = (k, v) => {
      const el = /** @type {HTMLSelectElement | null} */ (document.querySelector(`[data-set="${k}"]`));
      if (!el || v == null) return;
      if (el.tagName === "SELECT" && ![...el.options].some(o => o.value === v)) {
        const o = document.createElement("option");
        o.textContent = o.value = v;
        el.appendChild(o);
      }
      el.value = v;
      /** @type {Record<string, any>} */ (S.set)[k] = v;
    };
    if (parsed.cfg) setF("cfg", parsed.cfg);
    if (parsed.sampler) setF("sampler", parsed.sampler + (parsed.schedule ? " · " + parsed.schedule : ""));
    if (parsed.size) {
      const [w, h] = parsed.size.split("x").map(Number);
      let best = null;
      for (const m in SIZES)
        for (const r in SIZES[m]) {
          const [a, b] = SIZES[m][r];
          const d = Math.abs(a - w) + Math.abs(b - h);
          if (!best || d < best.d) best = { m, r, d };
        }
      if (best) {
        S.mp = best.m;
        S.ar = best.r;
      }
    }
    parsed.loras.forEach(pl => {
      const l = LORAS.find(l => l.name.toLowerCase() === pl.name.toLowerCase());
      if (l) {
        l.on = true;
        l.w = pl.w;
      }
    });
    if (parsed.name) {
      S.pname = parsed.name;
      /** @type {HTMLInputElement} */ ($("pname")).value = S.pname;
    }
    save();
    showView("gen");
    renderAll();
    toast(
      `Loaded into the prompt${parsed.name ? ` as “${parsed.name}”` : ""} — ${S.keepSeed ? "its seed" : "new random seed"}`,
    );
  };
}
