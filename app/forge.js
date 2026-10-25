/* Kiln · what comes from Forge: models, LoRAs, upscalers, the Settings facts; LoRA thumbnails kept by the server */
/* ---------- LoRA thumbnails stored by the server ---------- */
async function setThumbs(j) {
  if (!j) return;
  const faces = j.loras.map(x => LORAS.find(l => l.name === x.name)).filter(l => l && l.folder === "people");
  if (!faces.length) {
    toast("This image used no face LoRA");
    return;
  }
  const im = await img(urlFor(j)).p;
  if (!im) return;
  const t = document.createElement("canvas");
  t.width = t.height = 256;
  const s = Math.min(im.naturalWidth, im.naturalHeight);
  t.getContext("2d").drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) * 0.22, s, s, 0, 0, 256, 256);
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
let models = null;
function forgeMsg(m) {
  if (!current()) {
    $("ptxt").textContent = m;
    $("peta").textContent = "";
  }
}
async function loadModels(refresh) {
  try {
    const r = await fetch("/api/models" + (refresh ? "?refresh" : ""));
    if (!r.ok) throw 0;
    models = await r.json();
  } catch (e) {
    models = null;
    return false;
  }
  let saved = {};
  try {
    (JSON.parse(localStorage.getItem("kiln_state") || "{}").loras || []).forEach(x => (saved[x.name] = x));
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
  const sel = (key, opts, label) => {
    const el = document.querySelector(`[data-set="${key}"]`);
    if (!el) return;
    const cur = (S.set || {})[key] || "";
    el.innerHTML =
      `<option value="">${label}</option>` + opts.map(o => `<option value="${esc(o.v)}">${esc(o.t)}</option>`).join("");
    el.value = opts.some(o => o.v === cur) ? cur : "";
    S.set[key] = el.value;
  };
  const curCk = (models.current.sd_model_checkpoint || "").replace(/\s*\[[0-9a-f]+\]$/, "");
  sel(
    "ckpt",
    models.checkpoints.map(c => ({ v: c, t: c.replace(/\s*\[[0-9a-f]+\]$/, "") })),
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
const fg = document.querySelector(".mcard .fg");
const fu = fg.querySelector('[data-set="forge"]');
const up = document.createElement("select");
const upl = document.createElement("label");
const us = document.createElement("select");
const usl = document.createElement("label");
const fx = $("fghAp");
const refreshUp = () => {
  if (!models) return;
  up.innerHTML = models.upscalers.map(u => `<option>${esc(u)}</option>`).join("");
  if (S.set.upscaler) up.value = S.set.upscaler;
  us.value = S.set.upscale || "2";
};
const rb = document.createElement("button");
/* the LoRA tab rescans the folder: with its button, and on its own when the tab opens (at most once a minute, never
    while a job runs — Forge is busy then); a quiet note only when something changed */
let lscanT = 0;
async function rescanLoras(manual) {
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
