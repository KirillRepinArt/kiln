/* Kiln · the pills under the prompt: size, ratio, steps, seed, count — their pop-ups, sliders and steppers */
import { fmt, toast } from "./boot.js";
import { $ } from "./dom.js";
import { sizeFrame } from "./layout.js";
import { peekJob } from "./peek.js";
import { pv } from "./picstate.js";
import { RATIOS, SEC_PER_STEP, SIZES } from "./presets.js";
import { IC, S, save } from "./state.js";

/* ======================= pills ======================= */
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
export function renderPills() {
  idleText();
  const pk = typeof peekJob !== "undefined" && peekJob; // peeking: the pills show that job's own settings
  const v = pk
    ? { mp: pk.mp, ar: pk.ar, steps: pk.steps, seed: pk.seed != null ? String(pk.seed) : "—", n: 1 }
    : { mp: S.mp, ar: S.ar, steps: S.steps, seed: S.seedMode === "random" ? "Random" : String(S.seed), n: S.n };
  $("pSD").dataset.tip = pk ? "Click to copy this seed" : "Seed — random each job, or fixed";
  $("vMP").textContent = v.mp + " MP";
  {
    const [pw, ph] = (SIZES[v.mp] || {})[v.ar] || [];
    $("pMP").dataset.tip = pw ? `${v.mp} MP · ${pw}×${ph} px at ${v.ar}` : "Image size (megapixels)";
  }
  $("vAR").innerHTML = v.ar + '<span class="w"> Ratio</span>';
  $("vST").innerHTML = v.steps + '<span class="w"> Steps</span>';
  $("vSD").textContent = v.seed;
  $("vN").textContent = "×" + v.n;
  $("popMP").innerHTML = ["0.5", "1.0", "1.5", "2.0"]
    .map(
      m =>
        `<div class="opt ${m === S.mp ? "on" : ""}" data-v="${m}">${m} MP <small>~${SEC_PER_STEP[m]}s/step</small></div>`,
    )
    .join("");
  $("popAR").innerHTML = `<div class="rgrid">${RATIOS.map(r => {
    const [a, b] = r.split(":").map(Number);
    const k = 34 / Math.max(a, b);
    const [w, h] = SIZES[S.mp][r];
    return `<div class="rt ${r === S.ar ? "on" : ""}" data-v="${r}"><div class="shape" style="width:${Math.round(a * k)}px;height:${Math.round(b * k)}px"></div><div class="t">${r}</div><div class="px">${w}×${h}</div></div>`;
  }).join("")}</div>`;
  if (!$("popST").classList.contains("show"))
    $("popST").innerHTML = slider("st", 1, 30, S.steps, [4, 6, 8, 12], stepsHint());
  if (!$("popN").classList.contains("show")) $("popN").innerHTML = slider("cn", 1, 50, S.n, [1, 4, 8, 16], countHint());
  $("popSD").innerHTML = `<div class="opt ${S.seedMode === "random" ? "on" : ""}" data-v="random">Random each job</div>
   <div class="row"><input type="number" id="seedIn" value="${S.seed}" style="width:140px"><button class="iconbtn" id="dice" title="New random seed">${IC.dice}</button><button class="iconbtn" id="seedCopy" title="Copy the seed">${IC.copy}</button></div>
   <div class="opt ${S.seedMode === "fixed" ? "on" : ""}" data-v="fixed">Fixed</div>`;
  sizeFrame();
}
export function closePops() {
  document.querySelectorAll(".pop.show").forEach(p => {
    p.classList.remove("show");
    p.parentElement.classList.remove("open");
  });
  renderPills();
}
function staleIf(ch) {
  if (ch) pv("shape");
}
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
  ["pSD", "popSD", v => (S.seedMode = v)],
];
export function copySeed(s) {
  if (s == null || s === "") return;
  navigator.clipboard.writeText(String(s)).then(
    () => toast(`Seed ${s} copied`),
    () => toast("Couldn't copy the seed"),
  );
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, Math.round(v) || a));
}
/* start-up wiring: the pills — pop-ups, sliders, steppers, the seed (called from main.js, in order) */
export function initPills() {
  PILLS.forEach(([b, p, set]) => {
    $(b).addEventListener("click", e => {
      const pop = $(p);
      if (b === "pSD" && typeof peekJob !== "undefined" && peekJob) {
        copySeed(peekJob.seed);
        return;
      } // an old job: the seed pill copies its seed
      if (e.target.closest(".pop") && !e.target.closest(".opt,.rt,.qb")) return;
      const o = e.target.closest(".opt,.rt");
      if (o) {
        set(o.dataset.v);
        save();
        closePops();
        return;
      }
      const q = e.target.closest(".qb");
      if (q) {
        set(q.dataset.q);
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
    if (e.target.closest("#seedCopy")) {
      copySeed(S.seed);
      return;
    }
    if (e.target.closest("#dice")) {
      S.seed = Math.floor(Math.random() * 4294967295);
      S.seedMode = "fixed";
      save();
      renderPills();
      $("popSD").classList.add("show");
      return;
    }
    if (!e.target.isConnected || e.target.closest(".pill")) return;
    closePops();
  });
  document.addEventListener("input", e => {
    const id = e.target.id;
    if (id === "stR" || id === "stN") {
      S.steps = clamp(+e.target.value, 1, 60);
      $(id === "stR" ? "stN" : "stR").value = S.steps;
      $("vST").innerHTML = S.steps + '<span class="w"> Steps</span>';
      $("stH").textContent = stepsHint();
      save();
    }
    if (id === "cnR" || id === "cnN") {
      S.n = clamp(+e.target.value, 1, 100);
      $(id === "cnR" ? "cnN" : "cnR").value = S.n;
      $("vN").textContent = "×" + S.n;
      $("cnH").textContent = countHint();
      save();
    }
    if (id === "seedIn") {
      S.seed = +e.target.value || 0;
      S.seedMode = "fixed";
      $("vSD").textContent = "Fixed";
      save();
    }
  });
  [
    ["pST", d => (S.steps = clamp(S.steps + d, 1, 60))],
    ["pN", d => (S.n = clamp(S.n + d, 1, 100))],
  ].forEach(([id, f]) =>
    $(id).addEventListener(
      "wheel",
      e => {
        e.preventDefault();
        f(e.deltaY < 0 ? 1 : -1);
        save();
        renderPills();
      },
      { passive: false },
    ),
  );
}
