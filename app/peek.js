// @ts-check
/* Kiln · the prompt peek: a job's prompt shown in the box (a finished picture's, a waiting job's), the Reuse bar,
   saving a waiting job's name, Start as Vary while a prompt is shown */
import { renameFile, renameJob } from "./actions.js";
import { renderAll, toast } from "./boot.js";
import { layoutLeft } from "./cardlayout.js";
import { renderChips } from "./chips.js";
import { $, field, q } from "./dom.js";
import { PV, pv } from "./picstate.js";
import { renderPills } from "./pills.js";
import { keepSeedUI } from "./pnginfo.js";
import { draft, nameUI, peekJob, setDraft, setPeekJob, slugify } from "./prompt.js";
import { LORAS, P, S, save } from "./state.js";

/* the peek bar only offers what would change something: no "Reuse prompt" when the prompt is already your draft;
   "Use this seed" when only the seed differs; nothing but ✕ when it all matches */
/** @param {import("./types.js").Job} j */
function sameLoras(j) {
  const on = LORAS.filter(l => l.on),
    jl = j.loras || [];
  return (
    on.length === jl.length &&
    jl.every((/** @type {import("./types.js").LoraUse} */ x) => {
      const l = on.find(l => l.name === x.name);
      return l && Math.abs(l.w - x.w) < 1e-6;
    })
  );
}
/* the same buttons in the same places on every picture (2026-10-19): hiding the ones that "wouldn't change anything"
   was clever, but a bar whose buttons come and go can't be learned by the hand */
export function peekButtons() {
  const j = peekJob;
  if (!j) return;
  const pSame = (j.raw || j.prompt || "").trim() === (draft || "").trim();
  const sSame = j.mp === S.mp && j.ar === S.ar && +j.steps === +S.steps && sameLoras(j),
    seedSame = S.seedMode === "fixed" && +S.seed === +j.seed;
  $("pkPrompt").style.display = "";
  const all = $("pkAll");
  const lbl = (/** @type {string} */ lg, /** @type {string} */ sm) =>
    `<span class="lg">${lg}</span><span class="sm">${sm}</span>`; // the short form shows when the box is narrow
  all.style.display = "";
  all.dataset.m = "all";
  all.innerHTML = lbl("Reuse all", "All");
  $("pkSeed").style.display = "";
  $("peekLbl").textContent =
    `#${j.id}${j.status === "running" ? " · generating" : ""}${pSame && sSame && seedSame ? " · same as your draft" : ""}`;
}
/** show a job's prompt in the box @param {import("./types.js").Job} j */
export function loadJob(j) {
  setPeekJob(j);
  P.value = j.raw || j.prompt;
  P.readOnly = true;
  P.classList.add("peek");
  P.scrollTop = 0;
  const n = field("pname");
  delete n.dataset.title;
  n.value = j.name || "";
  n.placeholder = j.status === "pending" ? "Name this job" : "Unnamed";
  n.readOnly = !(j.status === "pending" || (j.status === "done" && j.file && !j.missing));
  $("pnSave").classList.remove("show");
  $("pnSave").textContent = j.status === "done" ? "Rename" : "Save name";
  q(".plbl").classList.toggle("donename", j.status === "done");
  fnShow(false);
  peekButtons();
  $("peekbar").classList.add("show");
  $("left").classList.add("peeking");
  renderChips();
  renderPills();
  updPrompt();
  layoutLeft();
}
/* Two ways out of a browse: the prompt's ✕ (or Esc in the editor) closes only the prompt — your draft comes back, the
   picture stays, and the arrows keep the prompt closed (PV.promptClosed) until the browse ends; the picture's ✕ (or
   Esc elsewhere) closes both (picstate.js). */
function closePromptPeek() {
  pv("promptClose");
  peekHide();
}
/* out of the Gallery if you're in it, and your draft back in the prompt box */
export function endPeek() {
  if (PV.browse != null) pv("close");
  else peekHide();
}
/* the prompt box shows your draft again */
export function peekHide() {
  if (!peekJob) return;
  setPeekJob(null);
  P.readOnly = false;
  P.classList.remove("peek");
  P.value = draft;
  const n = field("pname");
  n.value = S.pname || "";
  n.placeholder = "Add name";
  n.readOnly = false;
  $("peekbar").classList.remove("show");
  $("pnSave").classList.remove("show");
  $("left").classList.remove("peeking");
  q(".plbl").classList.remove("donename", "fnon");
  renderChips();
  renderPills();
  updPrompt();
  layoutLeft();
}
export function saveJobName() {
  const j = peekJob;
  if (!j) return;
  const v = field("pname").value.trim();
  if (j.status === "done") {
    $("pnSave").classList.remove("show");
    renameFile(j, v).then(ok => {
      if (!ok) field("pname").value = j.name || "";
    });
    field("pname").blur();
    return;
  }
  if (j.status !== "pending") return;
  renameJob(j, v);
  j.name = v;
  $("pnSave").classList.remove("show");
}
/* hovering a finished picture's title shows its file name in place: the title as it is on disk (lower case, dashes),
   its number and .png on either side, and the job's #. Editing it renames the file (the series and the next number) */
/** a 2D context for measuring the title's text (made once) @type {CanvasRenderingContext2D | undefined} */
let measureCtx;
/** @param {boolean} on */
export function fnShow(on) {
  const j = peekJob,
    n = field("pname"),
    l = q(".plbl");
  if (!j || j.status !== "done" || !j.file || document.activeElement === n || $("pnSave").classList.contains("show"))
    on = false;
  if (on && j && j.file) {
    const m = j.file.match(/^(.*?)(-\d{3,}(?:_x[\d.]+)?)(\.png)$/i),
      named = m && (j.name || "").trim() && slugify(j.name) === m[1];
    $("fnPre").textContent = `#${j.id}`;
    $("fnSuf").textContent = named ? m[2] + m[3] : ` · ${j.file}`;
    /* up against the title's TEXT (the field is wider: a minimum width and its edit padding) */
    const c =
        measureCtx ||
        (measureCtx = /** @type {CanvasRenderingContext2D} */ (document.createElement("canvas").getContext("2d"))),
      cs = getComputedStyle(n);
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const tw = c.measureText(n.value || n.placeholder).width,
      inset = Math.max(0, (n.offsetWidth - tw) / 2);
    $("fnPre").style.marginRight = 8 - inset + "px";
    $("fnSuf").style.marginLeft = -inset + "px";
  } /* the title stays exactly as it is; its number and .png appear beside it */
  l.classList.toggle("fnon", on);
}
/** your draft becomes this job's prompt (all: and its settings, LoRAs, series) @param {boolean} all @param {boolean} [seedToo] */
export function reuse(all, seedToo) {
  const j = peekJob;
  const fixed = !!(seedToo || S.keepSeed);
  if (!j) return;
  const prev = {
    draft,
    S: { mp: S.mp, ar: S.ar, steps: S.steps, seedMode: S.seedMode, seed: S.seed, pname: S.pname },
    loras: LORAS.map(l => ({ on: l.on, w: l.w })),
  };
  setDraft(j.raw || j.prompt);
  if ((j.name || "").trim()) S.pname = j.name.trim();
  /* reusing the working file, title included: the next image joins its series */
  if (all) {
    Object.assign(
      S,
      { mp: j.mp, ar: j.ar, steps: j.steps },
      fixed ? { seedMode: "fixed", seed: j.seed } : { seedMode: "random" },
    );
    LORAS.forEach(l => {
      const i = j.loras.findIndex(x => x.name === l.name);
      l.on = i >= 0;
      if (i >= 0) {
        l.w = j.loras[i].w;
        l.onAt = Date.now() + i;
      }
    });
  }
  pv("reuse");
  peekHide();
  save();
  renderAll();
  P.focus(); /* the picture stays as your reference while you edit — until Start or ✕ */
  toast(
    all
      ? `Reused #${j.id} — prompt, settings and LoRAs${fixed ? ", its seed" : ", new seed"}`
      : `Reused #${j.id}'s prompt`,
    "Undo",
    () => {
      setDraft(prev.draft);
      P.value = draft;
      Object.assign(S, prev.S);
      field("pname").value = S.pname || "";
      LORAS.forEach((l, i) => Object.assign(l, prev.loras[i]));
      save();
      renderAll();
      updPrompt();
    },
  );
}
export function updPrompt() {
  nameUI();
  const n = P.value.length;
  $("left").classList.toggle("hastext", !!n && !peekJob);
  $("pcount").textContent = n ? n.toLocaleString() + " chars" : "";
  $("play").removeAttribute("title");
  const vary = !!(peekJob && peekJob.kind !== "upscale");
  $("play").classList.toggle("off", vary ? false : !P.value.trim() || !!peekJob);
  $("play").classList.toggle("vary", vary);
  $("play").dataset.tip = vary
    ? `Vary: #${/** @type {import("./types.js").Job} */ (peekJob).id} again with a new seed — same prompt, settings and LoRAs; your draft stays (Ctrl+Enter)`
    : peekJob
      ? "Choose Reuse first"
      : !P.value.trim()
        ? "Write a prompt first"
        : "Add to queue (Ctrl+Enter)";
}
/* start-up wiring: the name line, Save name, the Reuse bar, the prompt's keys while a job's prompt is shown (called
   from main.js, right after initQueue) */
export function initPeek() {
  (function () {
    const l = q(".plbl"),
      n = field("pname");
    l.addEventListener("mouseenter", () => fnShow(true));
    l.addEventListener("mouseleave", () => fnShow(false));
    n.addEventListener("focus", () => fnShow(false));
  })();
  $("pnSave").onclick = e => {
    e.stopPropagation();
    saveJobName();
  };
  $("pkPrompt").onclick = () => reuse(false);
  $("pkAll").onclick = () => reuse(true, $("pkAll").dataset.m === "seed");
  $("pkSeed").onclick = e => {
    e.stopPropagation();
    S.keepSeed = !S.keepSeed;
    save();
    keepSeedUI();
  };
  $("pkX").onclick = () => closePromptPeek();
  P.addEventListener("keydown", e => {
    if (!peekJob) return;
    if (e.key === "Escape") {
      closePromptPeek();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (
      (e.key.length === 1 && !mod && !e.altKey) ||
      e.key === "Backspace" ||
      e.key === "Delete" ||
      (e.key === "Enter" && !mod) ||
      (mod && /^[vx]$/i.test(e.key))
    )
      reuse(false);
  });
}
