// @ts-check
/* Kiln · the pills under the prompt: size, ratio, steps, seed, count — their pop-ups, sliders and steppers */
import { esc, fmt, toast } from "./boot.js";
import { $, field, hit, qa, target, targetField } from "./dom.js";
import { sizeFrame } from "./layout.js";
import { pv } from "./picstate.js";
import { RATIOS, SEC_PER_STEP, SIZES } from "./presets.js";
import { editFirst } from "./peek.js";
import { peekJob } from "./prompt.js";
import { IC, S, save } from "./state.js";

/* ======================= pills ======================= */
/** a pop-up's slider row + number box + quick picks @param {string} id @param {number} min @param {number} max
 * @param {number} val @param {number[]} quick @param {string} hint */
function slider(id, min, max, val, quick, hint) {
  return `<div class="row"><input type="range" id="${id}R" min="${min}" max="${max}" value="${val}" style="flex:1"><input type="number" id="${id}N" min="1" max="${max * 2}" value="${val}"></div>
  <div class="row" style="justify-content:space-between">${quick.map(q => `<button class="qb ${q === val ? "on" : ""}" data-q="${q}">${q}</button>`).join("")}</div><div class="hint" id="${id}H">${hint}</div>`;
}
function stepsHint() {
  return `~${fmt(S.steps * SEC_PER_STEP[S.mp])} per image at ${S.mp} MP`;
}
function countHint() {
  return S.n > 1
    ? `${S.n} jobs · ~${fmt(S.n * S.steps * SEC_PER_STEP[S.mp])} total · ${S.seedMode === "random" ? "random seeds" : "seeds count up"}`
    : "one image";
}
function idleText() {
  const [w, h] = SIZES[S.mp][S.ar];
  $("idleT").textContent = `Next: ${S.ar} · ${w}×${h}`;
  $("idleS").textContent = `Estimated time: ~${fmt(S.steps * SEC_PER_STEP[S.mp])}`;
} /* live.js keeps it current */
/** the lock on the Seed pill and in its pop-up */
const LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
export function renderPills() {
  idleText();
  /* a shown job: the pills show its own settings; picking a value makes it your draft first (editFirst) */
  const pk = typeof peekJob !== "undefined" && peekJob;
  const v = pk
    ? { mp: pk.mp, ar: pk.ar, steps: pk.steps, seed: pk.seed ?? S.seed, locked: false, n: 1 }
    : { mp: S.mp, ar: S.ar, steps: S.steps, seed: S.seed, locked: S.seedMode === "fixed", n: S.n };
  $("pSD").dataset.tip = pk
    ? "This picture's seed — lock it to use it again"
    : v.locked
      ? "Seed: locked — every job uses it (×N counts up)"
      : "Seed: a random one for each job";
  $("vMP").textContent = v.mp + " MP";
  {
    const [pw, ph] = (SIZES[v.mp] || {})[v.ar] || [];
    $("pMP").dataset.tip = pw ? `${v.mp} MP · ${pw}×${ph} px at ${v.ar}` : "Image size (megapixels)";
  }
  $("vAR").innerHTML = v.ar + '<span class="w"> Ratio</span>';
  $("vST").innerHTML = v.steps + `<span class="w"> ${v.steps === 1 ? "Step" : "Steps"}</span>`;
  $("vSD").innerHTML = pk ? esc(String(v.seed)) : v.locked ? `${v.seed}<span class="lk">${LOCK}</span>` : "Random";
  $("vN").textContent = "×" + v.n;
  $("popMP").innerHTML = ["0.5", "1.0", "1.5", "2.0"]
    .map(
      m =>
        `<div class="opt ${m === v.mp ? "on" : ""}" data-v="${m}">${m} MP <small>~${SEC_PER_STEP[m]}s/step</small></div>`,
    )
    .join("");
  $("popAR").innerHTML = `<div class="rgrid">${RATIOS.map(r => {
    const [a, b] = r.split(":").map(Number);
    const k = 34 / Math.max(a, b);
    const [w, h] = SIZES[v.mp][r];
    return `<div class="rt ${r === v.ar ? "on" : ""}" data-v="${r}"><div class="shape" style="width:${Math.round(a * k)}px;height:${Math.round(b * k)}px"></div><div class="t">${r}</div><div class="px">${w}×${h}</div></div>`;
  }).join("")}</div>`;
  if (!$("popST").classList.contains("show"))
    $("popST").innerHTML = slider("st", 1, 30, v.steps, [4, 6, 8, 12], stepsHint());
  if (!$("popN").classList.contains("show")) $("popN").innerHTML = slider("cn", 1, 50, S.n, [1, 4, 8, 16], countHint());
  /* the seed, the die, the lock, copy (as in Forge's own seed field: the number with its buttons beside it). Unlocked: a
     random seed each job; locked: this one (×N counts up from it) */
  $("popSD").innerHTML =
    `<div class="row"><input type="number" id="seedIn" class="${v.locked ? "" : "unused"}" value="${v.seed}" style="width:140px" title="${v.locked ? "Every job uses this seed" : "Not in use — a random seed each job (lock it, type one or roll the die)"}"><button class="iconbtn" id="dice" title="A new random seed (locks it)">${IC.dice}</button><button class="iconbtn lockb${v.locked ? " on" : ""}" id="seedLock" title="${v.locked ? "Locked: every job uses this seed — click for a random one each job" : "Lock: use this seed for every job"}">${LOCK}</button><button class="iconbtn" id="seedCopy" title="Copy the seed">${IC.copy}</button></div>`;
  sizeFrame();
}
export function closePops() {
  qa(".pop.show").forEach(p => {
    p.classList.remove("show");
    /** @type {HTMLElement} */ (p.parentElement).classList.remove("open");
  });
  renderPills();
}
/** a size or shape changed: the picture area reshapes @param {boolean} ch */
function staleIf(ch) {
  if (ch) pv("shape");
}
/** the pills: button, its pop-up, what choosing a value does @type {[string, string, (v: string) => void][]} */
const PILLS = [
  [
    "pMP",
    "popMP",
    v => {
      staleIf(S.mp !== v);
      S.mp = v;
    },
  ],
  [
    "pAR",
    "popAR",
    v => {
      staleIf(S.ar !== v);
      S.ar = v;
    },
  ],
  ["pST", "popST", v => (S.steps = +v)],
  ["pN", "popN", v => (S.n = +v)],
  ["pSD", "popSD", () => {}], // its pop-up has buttons, not options (the document's click handler)
];
/** @param {number | string | null | undefined} s */
export function copySeed(s) {
  if (s == null || s === "") return;
  navigator.clipboard.writeText(String(s)).then(
    () => toast(`Seed ${s} copied`),
    () => toast("Couldn't copy the seed"),
  );
}
/** v rounded, kept within a … b (a when it isn't a number) @param {number} v @param {number} a @param {number} b */
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, Math.round(v) || a));
}
/* start-up wiring: the pills — pop-ups, sliders, steppers, the seed (called from main.js, in order) */
export function initPills() {
  PILLS.forEach(([b, p, set]) => {
    $(b).addEventListener("click", e => {
      const pop = $(p);
      if (hit(e, ".pop") && !hit(e, ".opt,.rt,.qb")) return;
      const o = hit(e, ".opt,.rt");
      if (o) {
        if (!editFirst()) return; // a shown job becomes your draft, then the choice applies to it
        set(/** @type {string} */ (o.dataset.v)); // every option carries its value
        save();
        closePops();
        return;
      }
      const q = hit(e, ".qb");
      if (q) {
        if (!editFirst()) return;
        set(/** @type {string} */ (q.dataset.q));
        save();
        pop.classList.remove("show");
        renderPills();
        pop.classList.add("show");
        return;
      }
      const was = pop.classList.contains("show");
      closePops();
      if (!was) {
        pop.classList.add("show");
        $(b).classList.add("open");
      }
    });
  });
  document.addEventListener("click", e => {
    if (hit(e, "#seedCopy")) {
      copySeed(peekJob ? peekJob.seed : S.seed);
      return;
    }
    if (hit(e, "#seedLock")) {
      const pk = peekJob;
      if (!editFirst()) return;
      if (pk) {
        S.seed = pk.seed; // locking a picture's seed: that picture's, for your draft
        S.seedMode = "fixed";
      } else S.seedMode = S.seedMode === "fixed" ? "random" : "fixed";
      save();
      renderPills();
      $("popSD").classList.add("show");
      $("pSD").classList.add("open");
      return;
    }
    if (hit(e, "#dice")) {
      if (!editFirst()) return;
      S.seed = Math.floor(Math.random() * 4294967295);
      S.seedMode = "fixed";
      save();
      renderPills();
      $("popSD").classList.add("show");
      $("pSD").classList.add("open");
      return;
    }
    if (!target(e).isConnected || hit(e, ".pill")) return;
    closePops();
  });
  document.addEventListener("input", e => {
    const id = target(e).id;
    const wasPeek = !!peekJob;
    if (["stR", "stN", "cnR", "cnN", "seedIn"].includes(id) && !editFirst()) return; // a shown job: yours first
    if (wasPeek && id === "seedIn") {
      const n = field("seedIn"); // the pop-up was drawn anew for your draft: typing goes on in the new field
      n.value = targetField(e).value;
      n.focus();
    }
    if (id === "stR" || id === "stN") {
      S.steps = clamp(+targetField(e).value, 1, 60);
      field(id === "stR" ? "stN" : "stR").value = String(S.steps);
      $("vST").innerHTML = S.steps + `<span class="w"> ${S.steps === 1 ? "Step" : "Steps"}</span>`;
      $("stH").textContent = stepsHint();
      save();
    }
    if (id === "cnR" || id === "cnN") {
      S.n = clamp(+targetField(e).value, 1, 100);
      field(id === "cnR" ? "cnN" : "cnR").value = String(S.n);
      $("vN").textContent = "×" + S.n;
      $("cnH").textContent = countHint();
      save();
    }
    if (id === "seedIn") {
      S.seed = +targetField(e).value || 0;
      S.seedMode = "fixed"; // a number you typed: locked
      $("vSD").innerHTML = `${S.seed}<span class="lk">${LOCK}</span>`;
      /** @type {HTMLElement} */ ($("seedLock")).classList.add("on");
      $("seedIn").classList.remove("unused");
      save();
    }
  });
  /** @type {[string, (d: number) => number][]} the steppers: the wheel over a pill nudges its value */
  ([
    ["pST", d => (S.steps = clamp(S.steps + d, 1, 60))],
    ["pN", d => (S.n = clamp(S.n + d, 1, 100))],
  ]).forEach(([id, f]) =>
    $(id).addEventListener(
      "wheel",
      e => {
        e.preventDefault();
        if (!editFirst()) return;
        f(e.deltaY < 0 ? 1 : -1);
        save();
        renderPills();
      },
      { passive: false },
    ),
  );
}
