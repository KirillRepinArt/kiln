// @ts-check
/* Kiln · LoRA library tab */
import { esc } from "./boot.js";
import { fmtW, renderChips } from "./chips.js";
import { $, hit, target, targetField } from "./dom.js";
import { LORAS, S, save } from "./state.js";

/* ======================= LoRA library ======================= */
const FTIP = /** @type {Record<string, string>} */ ({
  people: "Faces: LoRAs in a people, faces, characters or persons folder",
  style: "Style: LoRAs in a style folder",
  utility: "Utility: LoRAs in any other folder — the folder names are set in config.local.json",
});
const FILTERS = [
  ["all", "All"],
  ["people", "Faces"],
  ["style", "Style"],
  ["utility", "Utility"],
  ["fav", "★ Favorites"],
  ["recent", "Recent"],
];
/** @param {string} n */
function initials(n) {
  return n.slice(0, 2).toUpperCase();
}
/** a colour from the name (a LoRA without a picture) @param {string} n */
function hue(n) {
  let h = 0;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
export function renderLoras() {
  const q = /** @type {HTMLInputElement} */ ($("lsearch")).value.toLowerCase().trim();
  $("fchips").innerHTML = FILTERS.map(
    ([k, t]) =>
      `<button class="${S.lfilter === k ? "on" : ""}" data-f="${k}"${FTIP[k] ? ` data-tip="${FTIP[k]}"` : ""}>${t}</button>`,
  ).join("");
  $("ofSw").classList.toggle("on", S.oneFace);
  let L = LORAS.filter(l => !q || l.display.toLowerCase().includes(q) || l.name.toLowerCase().includes(q));
  if (S.lfilter === "fav") L = L.filter(l => l.fav);
  else if (S.lfilter === "recent") L = L.filter(l => l.used).sort((a, b) => b.used - a.used);
  else if (S.lfilter !== "all") L = L.filter(l => l.folder === S.lfilter);
  $("warn").classList.toggle("show", LORAS.filter(l => l.on && l.folder === "people").length > 1);
  const on = LORAS.filter(l => l.on).sort((a, b) => (a.onAt || 0) - (b.onAt || 0));
  /** @param {import("./types.js").Lora} l @param {unknown} [act] truthy: the row in Active (top) */
  const row = (l, act) => {
    const [a, b] = l.folder === "people" ? [0, 2] : [-3, 3];
    return `<div class="li ${l.on ? "on" : ""}" data-ln="${l.name}"${act ? " data-act" : ""}>
   <div class="lth" data-tg data-tip="Click to switch on/off" style="background:${l.thumb ? "#000" : `linear-gradient(135deg,hsl(${hue(l.name)},35%,30%),hsl(${(hue(l.name) + 50) % 360},35%,18%))`}">${l.thumb ? `<img src="${l.thumb}" alt="">` : initials(l.display)}</div>
   <div class="lbody"><div class="l1"><div class="nm"><span data-rename title="Double-click to rename">${esc(l.display)}</span>${l.recipe ? '<span class="tag">recipe</span>' : ""}<small>${esc(l.tags || l.note || l.folder)}</small></div>
    <span class="sw ${l.on ? "on" : ""}" data-tg title="On/off"></span></div>
   <div class="l2"><input type="range" min="${a}" max="${b}" step="0.05" value="${l.w}"><input type="number" min="${a}" max="${b}" step="0.05" value="${l.w}">
    <button class="star ${l.fav ? "on" : ""}" data-star title="Favorite">★</button></div></div></div>`;
  };
  /** favourites first, then A–Z (Recent keeps its own order) @param {import("./types.js").Lora[]} g */
  const srt = g =>
    S.lfilter === "recent"
      ? g
      : g.sort((a, b) => /** @type {any} */ (b.fav) - /** @type {any} */ (a.fav) || a.display.localeCompare(b.display));
  const G = [
      ["people", "Faces"],
      ["style", "Style"],
      ["utility", "Utility"],
    ],
    known = G.map(g => g[0]);
  // Active on top as full, editable items — a mirror: they stay in their own section too, so nothing jumps when toggled
  let h =
    S.lfilter !== "all" || q
      ? ""
      : `<div class="lsec">Active · ${on.length}</div>` +
        (on.length ? on.map(l => row(l, 1)).join("") : '<div class="lnone">Nothing on — switch LoRAs on below</div>');
  if (S.lfilter === "recent") h = L.map(l => row(l)).join("");
  else {
    for (const [k, t] of G) {
      const g = L.filter(l => l.folder === k);
      if (g.length)
        h += `<div class="lsec">${t} · ${g.length}</div>${srt(g)
          .map(l => row(l))
          .join("")}`;
    }
    const o = L.filter(l => !known.includes(l.folder));
    if (o.length)
      h += `<div class="lsec">Other · ${o.length}</div>${srt(o)
        .map(l => row(l))
        .join("")}`;
  }
  $("lscroll").innerHTML = `<div class="lgrid">${h}${!L.length ? '<div class="empty">Nothing here</div>' : ""}</div>`;
}
/* switching a LoRA on adds it to Active at the top: keep the row you clicked where it was on screen (the list
   shifts above it, not under your pointer). The anchor is its own-section row, which survives the toggle */
/** @param {string} name @param {() => void} fn */
function keepPlace(name, fn) {
  const sc = $("lscroll"),
    q = () => sc.querySelector(`.li[data-ln="${CSS.escape(name)}"]:not([data-act])`),
    a = q(),
    t = a && a.getBoundingClientRect().top;
  fn();
  const b = q();
  if (a && b) sc.scrollTop += b.getBoundingClientRect().top - /** @type {number} */ (t);
}
/** @param {import("./types.js").Lora} l */
function toggleL(l) {
  if (!l.on && l.folder === "people" && S.oneFace)
    LORAS.forEach(o => {
      if (o.folder === "people") o.on = false;
    });
  l.on = !l.on;
  if (l.on) {
    l.used = Date.now();
    l.onAt = Date.now();
  }
  save();
  keepPlace(l.name, renderLoras);
  renderChips();
}
let clickT = /** @type {number | undefined} */ (/** @type {unknown} */ (null));

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initLoras() {
  $("lsearch").oninput = () => {
    /** @type {HTMLElement} */ ($("lsearch").parentElement).classList.toggle(
      "has",
      !!(/** @type {HTMLInputElement} */ ($("lsearch")).value),
    );
    renderLoras();
  };
  $("lsClear").onclick = () => {
    /** @type {HTMLInputElement} */ ($("lsearch")).value = "";
    /** @type {() => void} */ ($("lsearch").oninput)();
    $("lsearch").focus();
  };
  /** @type {HTMLInputElement} */ ($("csize")).value = /** @type {any} */ (S.th || 48);
  document.documentElement.style.setProperty("--th", (S.th || 48) + "px");
  $("csize").addEventListener("input", e => {
    S.th = +targetField(e).value;
    document.documentElement.style.setProperty("--th", S.th + "px");
    save();
  });
  $("fchips").onclick = e => {
    const b = hit(e, "[data-f]");
    if (!b) return;
    S.lfilter = /** @type {string} */ (b.dataset.f);
    save();
    renderLoras();
  };
  $("oneFace").onclick = e => {
    e.preventDefault();
    S.oneFace = !S.oneFace;
    save();
    renderLoras();
  };
  $("lscroll").addEventListener("click", e => {
    const el = hit(e, "[data-ln]");
    if (!el) return;
    const l = /** @type {import("./types.js").Lora} */ (LORAS.find(l => l.name === el.dataset.ln));
    if (hit(e, "[data-star]")) {
      l.fav = !l.fav;
      save();
      renderLoras();
      return;
    }
    if (hit(e, "input")) return;
    if (hit(e, "[data-rename]")) {
      clearTimeout(clickT);
      clickT = setTimeout(() => toggleL(l), 230);
      return;
    } // wait: may be a double-click rename
    if (el.classList.contains("card") || hit(e, "[data-tg]")) toggleL(l);
  });
  $("lscroll").addEventListener("dblclick", e => {
    const n = hit(e, "[data-rename]");
    if (!n) return;
    clearTimeout(clickT);
    e.preventDefault();
    const el = /** @type {HTMLElement} */ (hit(e, "[data-ln]"));
    const l = /** @type {import("./types.js").Lora} */ (LORAS.find(l => l.name === el.dataset.ln));
    const inp = document.createElement("input");
    inp.className = "nmedit";
    inp.value = l.display;
    n.replaceWith(inp);
    inp.focus();
    inp.select();
    inp.onclick = k => k.stopPropagation();
    const done = () => {
      l.display = inp.value.trim() || l.display;
      save();
      renderLoras();
      renderChips();
    };
    inp.onblur = done;
    inp.onkeydown = k => {
      if (k.key === "Enter") inp.blur();
      if (k.key === "Escape") {
        inp.value = l.display;
        inp.blur();
      }
    };
  });
  $("lscroll").addEventListener("input", e => {
    const el = hit(e, "[data-ln]");
    if (!el || target(e).classList.contains("nmedit")) return;
    const l = /** @type {import("./types.js").Lora} */ (LORAS.find(l => l.name === el.dataset.ln));
    l.w = +targetField(e).value;
    /** @type {NodeListOf<HTMLInputElement>} */ (
      document.querySelectorAll(
        `#lscroll [data-ln="${CSS.escape(l.name)}"] input[type=range],#lscroll [data-ln="${CSS.escape(l.name)}"] input[type=number]`,
      )
    ).forEach(i => {
      if (i !== e.target) i.value = /** @type {any} */ (l.w);
    });
    const s = el.querySelector(".st span");
    if (s) s.textContent = fmtW(l.w);
    save();
    renderChips();
  });
}
