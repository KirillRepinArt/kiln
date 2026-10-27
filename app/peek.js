// @ts-check
/* Kiln · the prompt peek: a job's prompt shown in the box (a finished picture's, a waiting job's). Modeless (2026-10-27,
   the user): change anything — type, a pill, a LoRA — and the job becomes your draft (Undo brings yours back); ✕ at the
   end of its file name closes it. Also saving a waiting job's name, Start as Vary while a prompt is shown */
import { renameFile, renameJob } from "./actions.js";
import { esc, renderAll, toast } from "./boot.js";
import { layoutLeft } from "./cardlayout.js";
import { renderChips } from "./chips.js";
import { $, field, q } from "./dom.js";
import { PV, pv } from "./picstate.js";
import { renderPills } from "./pills.js";
import { draft, nameUI, peekJob, setDraft, setPeekJob, slugify } from "./prompt.js";
import { LORAS, P, S, save } from "./state.js";
import { SPACE } from "./tokens.js";

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
  $("left").classList.add("peeking");
  $("left").classList.toggle("peekfix", j.kind === "upscale"); // an upscale's settings aren't yours to change
  renderChips();
  renderPills();
  updPrompt();
  layoutLeft();
  fnLayout();
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
  $("pnSave").classList.remove("show");
  $("left").classList.remove("peeking", "peekfix");
  q(".plbl").classList.remove("donename", "fnon");
  renderChips();
  renderPills();
  updPrompt();
  layoutLeft();
  fnLayout();
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
/* The name line while a job's prompt is shown reads like a file's tab: its title as it is, then (a finished picture) its
   number and .png, greyed, then ✕ — the way out of this prompt. Both sit outside the title, so the title never moves,
   and they're there for as long as the prompt is shown: nothing to hunt for. Hovering the title adds its job # on the
   left. Editing the title renames the file (the series and the next number) */
/** a 2D context for measuring the title's text (made once) @type {CanvasRenderingContext2D | undefined} */
let measureCtx;
/** the title's text width, as drawn (the field is wider: a minimum width and its edit padding) */
function titleInset() {
  const n = field("pname"),
    c =
      measureCtx ||
      (measureCtx = /** @type {CanvasRenderingContext2D} */ (document.createElement("canvas").getContext("2d"))),
    cs = getComputedStyle(n);
  c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  /* centred text: half the spare width each side; text cut short (a narrow box): only the field's own padding */
  return Math.max(
    parseFloat(cs.paddingRight) || 0,
    (n.offsetWidth - c.measureText(n.value || n.placeholder).width) / 2,
  );
}
/** hover: the job's # beside the title @param {boolean} on */
export function fnShow(on) {
  const j = peekJob;
  if (!j || document.activeElement === field("pname")) on = false;
  if (on && j) {
    $("fnPre").textContent = `#${j.id}`;
    $("fnPre").style.marginRight = SPACE.tight - titleInset() + "px";
  }
  q(".plbl").classList.toggle("fnon", on);
}
/* the file name and ✕ after the title, up against its text. A narrow box: they keep a part gap from the size buttons
   (box controls, not this prompt's) — giving way in order: ".png" (every file is one), then the number, then the title
   shortens; ✕ always stays */
export function fnLayout() {
  const j = peekJob,
    n = field("pname"),
    l = q(".plbl"),
    suf = $("fnSuf"),
    end = $("fnEnd");
  n.style.maxWidth = "";
  n.style.minWidth = "";
  l.classList.remove("noext", "nosuf");
  if (!j) return;
  const file = j.status === "done" && j.file ? j.file : "",
    m = file.match(/^(.*?)(-\d{3,}(?:_x[\d.]+)?)(\.png)$/i),
    named = m && (j.name || "").trim() && slugify(j.name) === m[1],
    stem = file.replace(/\.png$/i, ""),
    ext = file.slice(stem.length);
  suf.innerHTML = file
    ? `<span class="fnnum">${esc(named && m ? m[2] : ` · ${stem}`)}</span><span class="fnext">${esc(ext)}</span>`
    : "";
  const place = () => {
    const shown = !!file && !l.classList.contains("nosuf");
    end.style.marginLeft = (shown ? 0 : SPACE.tight) - titleInset() + "px";
  };
  place();
  const limit = $("hmodes").getBoundingClientRect().left - SPACE.part,
    over = () => end.getBoundingClientRect().right - limit;
  for (const step of file ? ["noext", "nosuf"] : []) {
    if (over() <= 0) break;
    l.classList.add(step);
    place();
  }
  /* the title gives way at both ends (it's centred). A few rounds: once it's shorter than its text, the field's own
     spare width (which the file name used to hug into) is gone too */
  for (let i = 0, o = over(); o > 0.5 && i < 4; i++, o = over()) {
    n.style.minWidth = "0";
    n.style.maxWidth = Math.max(48, n.offsetWidth - 2 * o) + "px";
    place();
  }
}
/** your draft becomes this job — its prompt, series, settings and LoRAs, with a random seed (Undo puts yours back)
 * @param {boolean} [focus] into the editor (typing); a pill or a chip changed: stay where you are */
export function reuse(focus = true) {
  const j = peekJob;
  if (!j) return;
  const prev = {
    draft,
    S: { mp: S.mp, ar: S.ar, steps: S.steps, seedMode: S.seedMode, seed: S.seed, pname: S.pname },
    loras: LORAS.map(l => ({ on: l.on, w: l.w })),
  };
  setDraft(j.raw || j.prompt);
  if ((j.name || "").trim()) S.pname = j.name.trim(); // its series too: the next image joins it
  Object.assign(S, { mp: j.mp, ar: j.ar, steps: j.steps, seedMode: "random" });
  LORAS.forEach(l => {
    const i = j.loras.findIndex(x => x.name === l.name);
    l.on = i >= 0;
    if (i >= 0) {
      l.w = j.loras[i].w;
      l.onAt = Date.now() + i;
    }
  });
  pv("reuse");
  peekHide();
  save();
  renderAll();
  if (focus) P.focus(); /* the picture stays as your reference while you edit — until Start or ✕ */
  toast(`#${j.id} is now your draft — its prompt, settings and LoRAs`, "Undo", () => {
    setDraft(prev.draft);
    P.value = draft;
    Object.assign(S, prev.S);
    field("pname").value = S.pname || "";
    LORAS.forEach((l, i) => Object.assign(l, prev.loras[i]));
    save();
    renderAll();
    updPrompt();
  });
}
/** a change to a shown job's settings (a pill, a LoRA chip) makes it your draft first — like typing into it. False:
 * nothing to change (an upscale's settings aren't yours) */
export function editFirst() {
  if (!peekJob) return true;
  if (peekJob.kind === "upscale") return false;
  reuse(false);
  return true;
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
      ? "An upscale can't be varied — ✕ by its name for your draft"
      : !P.value.trim()
        ? "Write a prompt first"
        : "Add to queue (Ctrl+Enter)";
}
/* start-up wiring: the name line, Save name, ✕, the prompt's keys while a job's prompt is shown (called from main.js,
   right after initQueue) */
export function initPeek() {
  (function () {
    const l = q(".plbl"),
      n = field("pname");
    l.addEventListener("mouseenter", () => fnShow(true));
    l.addEventListener("mouseleave", () => fnShow(false));
    n.addEventListener("focus", () => fnShow(false));
    n.addEventListener("input", () => peekJob && fnLayout()); // renaming: the file name and ✕ follow the title
    new ResizeObserver(() => peekJob && fnLayout()).observe($("ltitle"));
    document.fonts && document.fonts.ready.then(() => peekJob && fnLayout());
  })();
  $("pnSave").onclick = e => {
    e.stopPropagation();
    saveJobName();
  };
  $("pkX").onclick = e => {
    e.stopPropagation(); // not the card's move gesture
    closePromptPeek();
  };
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
      reuse();
  });
}
