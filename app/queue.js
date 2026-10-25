/* Kiln · Queue tab, peek / reuse */
import {
  deleteMany,
  makeQThumb,
  removeJob,
  removeMany,
  removeMissing,
  renameFile,
  renameJob,
  setPaused,
  stopJob,
} from "./actions.js";
import { esc, fmt, nameUI, renderAll, slugify, toast } from "./boot.js";
import { layoutLeft } from "./cardlayout.js";
import { copySeed, renderChips, renderPills } from "./composer.js";
import { $ } from "./dom.js";
import { jEst } from "./jobs.js";
import { PV, pv } from "./picstate.js";
import { keepSeedUI } from "./pnginfo.js";
import { IC, LORAS, P, S, draft, jobs, save, setDraft, setJobs } from "./state.js";
import { showView } from "./tabs.js";

export function renderQueue() {
  const before = {},
    W = $("qwrap"),
    y0 = W.scrollTop - 200,
    y1 = W.scrollTop + W.clientHeight + 200,
    R =
      "#qsRun .qi,#qsPend .qi"; /* only waiting / running rows slide, only on screen — finished ones never reorder (they jiggled) */
  W.querySelectorAll(R).forEach(q => {
    if (q.offsetTop > y0 && q.offsetTop < y1) before[q.dataset.id] = q.getBoundingClientRect().top;
  });
  renderQueueInner();
  const had = Object.keys(before).length;
  W.querySelectorAll(R).forEach(q => {
    if (!(q.offsetTop > y0 && q.offsetTop < y1)) return;
    const b = before[q.dataset.id];
    if (b == null) {
      if (had) q.classList.add("new");
      return;
    }
    const d = b - q.getBoundingClientRect().top;
    if (Math.abs(d) < 1) return;
    q.style.transition = "none";
    q.style.transform = `translateY(${d}px)`;
    requestAnimationFrame(() => {
      q.style.transition = "transform .38s cubic-bezier(.4,0,.2,1)";
      q.style.transform = "";
    });
  });
}
/* selection (finished rows): the round box, Ctrl-click, Shift-click a range; once something is selected a plain click
   adds or removes (Google Photos / Lightroom); Ctrl+A all, Esc none, Del deletes them. A bar on top acts on them */
export const QS = new Set();
export let qsAnchor = null;
export function renderQueueInner() {
  const run = jobs.filter(j => j.status === "running"),
    pend = jobs.filter(j => j.status === "pending"),
    done = jobs.filter(j => j.status === "done" || j.status === "cancelled").reverse();
  const left = pend.reduce((a, j) => a + jEst(j), 0);
  for (const id of [...QS]) if (!done.some(j => j.id === id)) QS.delete(id);
  $("qwrap").classList.toggle("selecting", QS.size > 0);
  const item = (j, k) => `<div class="qi${j.missing ? " missing" : ""}" data-id="${j.id}" draggable="${k === "pend"}">
   ${k === "pend" ? '<span class="handle" title="Drag to reorder">⋮⋮</span>' : ""}${k === "done" ? `<span class="qck" data-ck="${j.id}" data-tip="Select (Ctrl-click · Shift-click a range)"></span>` : ""}
   <div class="th">${j.missing ? "gone" : j.status === "done" ? `<span data-tth="${j.id}"></span>` : j.status === "cancelled" ? "stopped" : k === "run" ? `<svg class="hg" viewBox="0 0 24 24" fill="none"><g class="hgg"><path d="M7 3.5h10M7 20.5h10" stroke="currentColor" stroke-width="1.6"/><path d="M8 3.5c0 4 1.6 6 4 8.5-2.4 2.5-4 4.5-4 8.5M16 3.5c0 4-1.6 6-4 8.5 2.4 2.5 4 4.5 4 8.5" stroke="currentColor" stroke-width="1.4"/><path class="st" d="M9.2 6.5h5.6c-.4 2-1.3 3.4-2.8 4.9-1.5-1.5-2.4-2.9-2.8-4.9z" fill="currentColor"/><path class="sb" d="M12 14.2c1.8 1.9 2.7 3.6 3 6H9c.3-2.4 1.2-4.1 3-6z" fill="currentColor"/></g></svg><img class="lp" data-lp="${j.id}" alt="">` : "#" + j.id}</div>
   <div class="body"><div class="p">${j.file ? `<b style="font-weight:600">${esc(j.file)}</b> · ` : ""}${esc((j.prompt || "").slice(0, 240))}</div>
   <div class="meta">${j.picks && j.picks.length ? `<span style="color:#e6e6ea">${esc(j.picks.join(" · "))}</span> · ` : ""}${j.mp} MP · ${j.ar} · ${j.steps} steps · <span class="seedc" data-seed="${j.seed}" data-tip="Click to copy the seed">seed ${j.seed}</span>${k === "pend" ? ` · ~${fmt(jEst(j))}` : ""}${j.missing ? ' · <span class="gone">file deleted</span>' : ""}</div>
   ${j.created || j.finished ? `<div class="meta times">${j.created ? `added ${clock(j.created)}` : ""}${j.finished && j.status === "done" ? ` · done ${clock(j.finished)}` : ""}${j.finished && j.started ? ` · took ${fmt((j.finished - j.started) / 1000)}` : ""}</div>` : ""}
   ${k === "run" ? '<div class="mini"><i></i></div>' : ""}</div>
   ${k !== "done" ? `<button class="x" data-x="${j.id}" title="${k === "run" ? "Stop" : "Remove"}">${IC.x}</button>` : `<button class="x" data-rm="${j.id}" title="${j.status === "done" && !j.missing ? "Remove from the list — the file stays" : "Remove from the list"}">${IC.x}</button>`}</div>`;
  const W = $("qwrap");
  if (!$("qsRun")) W.innerHTML = '<div id="qsRun"></div><div id="qsPend"></div><div id="qsFin"></div>';
  const put = (id, html) => {
    const el = $(id);
    if (QSEC[id] === html) return false;
    QSEC[id] = html;
    el.innerHTML = html;
    return true;
  }; /* a section is rebuilt only when what it shows changed (reordering the waiting jobs left the finished ones alone) */
  put("qsRun", run.length ? `<div class="qsec">Generating now</div>${run.map(j => item(j, "run")).join("")}` : "");
  put(
    "qsPend",
    `<div class="qsec"><span>Up next ${pend.length ? `· ${pend.length} · ~${fmt(left)}` : ""}${window.qPaused ? ' · <b class="paused">paused</b>' : ""}</span><button id="pauseQ" data-tip="${window.qPaused ? "Start the waiting jobs again" : "The current image finishes; nothing new starts until you resume"}">${window.qPaused ? "Resume" : "Pause after this"}</button></div>` +
      (pend.length ? pend.map(j => item(j, "pend")).join("") : '<div class="empty">Nothing queued</div>'),
  );
  put("qsFin", done.length ? `<div class="qsec qfin" id="qfin"></div>` + done.map(j => item(j, "done")).join("") : "");
  qsUpdate(); /* the selection (highlights, the header) is applied to whatever is there — never part of the rebuild */
  {
    const have = new Set(done.map(j => j.id));
    for (const id of QT.keys()) if (!have.has(id)) QT.delete(id);
    $("qwrap")
      .querySelectorAll("[data-tth]")
      .forEach(ph => {
        const id = +ph.dataset.tth;
        let im = QT.get(id);
        if (!im) {
          im = new Image();
          im.className = "qt";
          im.dataset.qt = id;
          im.alt = "";
          im.decoding = "async";
          im.loading = "lazy";
          im.onerror = () => {
            if (im.dataset.tried) return;
            im.dataset.tried = "1";
            const j = jobs.find(x => x.id === id);
            if (j) makeQThumb(j, im);
          };
          im.src = `/qthumbs/${id}.jpg`;
          QT.set(id, im);
        }
        ph.replaceWith(im);
      });
  }
  renderQueueInner.sig = queueSig();
}
const QSEC = {}; /* the last markup of each section */
/* each finished row's thumbnail element, loaded once and moved into every rebuild of the list (a new element would load
   again: the files are never cached by the browser, so the list flashed empty on every visit) */
const QT = new Map();
/* what the list shows: unchanged → opening the tab rebuilds nothing */
export function queueSig() {
  return (
    jobs.map(j => `${j.id}:${j.status}:${j.file || ""}:${j.missing ? 1 : 0}:${j.name || ""}:${j.est || ""}`).join("|") +
    "|" +
    [...QS].join(",") +
    "|" +
    !!window.qPaused
  );
}
function finHead(done) {
  if (QS.size) return qsBar(done);
  return `<span>Finished · ${done.length}</span><span>${done.some(j => j.missing) ? `<button id="rmMissing">Remove missing (${done.filter(j => j.missing).length})</button> ` : ""}<button id="clearDone">Clear list</button></span>`;
}
/* selecting changes nothing but the highlight and the header's contents (it rebuilt the whole list, and the header grew) */
export function qsUpdate() {
  const done = qsFinished(),
    W = $("qwrap");
  for (const id of [...QS]) if (!done.some(j => j.id === id)) QS.delete(id);
  W.classList.toggle("selecting", QS.size > 0);
  W.querySelectorAll(".qi").forEach(q => q.classList.toggle("sel", QS.has(+q.dataset.id)));
  const h = $("qfin");
  if (h) {
    h.classList.toggle("qbar", QS.size > 0);
    h.innerHTML = finHead(done);
  }
  renderQueueInner.sig = queueSig();
}
function qsBar(done) {
  if (!QS.size) return "";
  const sel = done.filter(j => QS.has(j.id)),
    names = [...new Set(sel.map(j => (j.name || "").trim()))];
  let series = "";
  if (names.length === 1 && names[0]) {
    const all = done.filter(j => (j.name || "").trim() === names[0]).length;
    if (all > sel.length)
      series = `<button id="qsSeries" data-tip="Select every “${esc(names[0])}” picture">All “${esc(names[0])}” · ${all}</button>`;
  }
  return `<span class="qn"><b>${QS.size}</b> of ${done.length} selected</span>${series}${sel.length < done.length ? '<button id="qsAll">Select all</button>' : ""}<span class="qgap"></span>
  <button id="qsRemove" data-tip="Take them off the list — the files stay">Remove from list</button><button id="qsDel" class="qdel" data-tip="To the Recycle Bin, with Undo (Del)">Delete</button><button id="qsX" class="qx" data-tip="Clear the selection (Esc)">${IC.x}</button>`;
}
function qsFinished() {
  return jobs.filter(j => j.status === "done" || j.status === "cancelled").reverse();
}
function qsClick(j, range) {
  const L = qsFinished();
  if (range && qsAnchor != null) {
    const a = L.findIndex(x => x.id === qsAnchor),
      b = L.findIndex(x => x.id === j.id);
    if (a >= 0 && b >= 0) {
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) QS.add(L[i].id);
      qsUpdate();
      return;
    }
  }
  if (QS.has(j.id)) QS.delete(j.id);
  else QS.add(j.id);
  qsAnchor = j.id;
  qsUpdate();
}
export function qsClear() {
  if (!QS.size) return false;
  QS.clear();
  qsAnchor = null;
  qsUpdate();
  return true;
}
export function qsDelete() {
  if (!QS.size) return;
  const ids = [...QS];
  QS.clear();
  qsAnchor = null;
  deleteMany(ids);
  renderQueue();
}
/* the formatters made once: creating them per row (hundreds) was most of the Queue tab's build time */
const CLK = {
  t: new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }),
  d: new Intl.DateTimeFormat([], { month: "short", day: "numeric" }),
};
function clock(ms) {
  const d = new Date(ms),
    now = new Date(),
    t = CLK.t.format(d);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    ? t
    : CLK.d.format(d) + " " + t;
}
export function browseTo(j) {
  PV.promptClosed = false;
  pv("browse", j);
}
export var justDone = null;
export let peekJob = null;
/* written from other files only through these */
export function setPeekJob(j) {
  peekJob = j;
}
export function setJustDone(id) {
  justDone = id;
}
export function setQsAnchor(id) {
  qsAnchor = id;
}
/* the peek bar only offers what would change something: no "Reuse prompt" when the prompt is already your draft;
   "Use this seed" when only the seed differs; nothing but ✕ when it all matches */
function sameLoras(j) {
  const on = LORAS.filter(l => l.on),
    jl = j.loras || [];
  return (
    on.length === jl.length &&
    jl.every(x => {
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
  const lbl = (lg, sm) => `<span class="lg">${lg}</span><span class="sm">${sm}</span>`; // the short form shows when the box is narrow
  all.style.display = "";
  all.dataset.m = "all";
  all.innerHTML = lbl("Reuse all", "All");
  $("pkSeed").style.display = "";
  $("peekLbl").textContent =
    `#${j.id}${j.status === "running" ? " · generating" : ""}${pSame && sSame && seedSame ? " · same as your draft" : ""}`;
}
export function loadJob(j) {
  peekJob = j;
  P.value = j.raw || j.prompt;
  P.readOnly = true;
  P.classList.add("peek");
  P.scrollTop = 0;
  const n = $("pname");
  delete n.dataset.title;
  n.value = j.name || "";
  n.placeholder = j.status === "pending" ? "Name this job" : "Unnamed";
  n.readOnly = !(j.status === "pending" || (j.status === "done" && j.file && !j.missing));
  $("pnSave").classList.remove("show");
  $("pnSave").textContent = j.status === "done" ? "Rename" : "Save name";
  document.querySelector(".plbl").classList.toggle("donename", j.status === "done");
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
  peekJob = null;
  P.readOnly = false;
  P.classList.remove("peek");
  P.value = draft;
  const n = $("pname");
  n.value = S.pname || "";
  n.placeholder = "Add name";
  n.readOnly = false;
  $("peekbar").classList.remove("show");
  $("pnSave").classList.remove("show");
  $("left").classList.remove("peeking");
  document.querySelector(".plbl").classList.remove("donename", "fnon");
  renderChips();
  renderPills();
  updPrompt();
  layoutLeft();
}
export function saveJobName() {
  const j = peekJob;
  if (!j) return;
  const v = $("pname").value.trim();
  if (j.status === "done") {
    $("pnSave").classList.remove("show");
    renameFile(j, v).then(ok => {
      if (!ok) $("pname").value = j.name || "";
    });
    $("pname").blur();
    return;
  }
  if (j.status !== "pending") return;
  renameJob(j, v);
  j.name = v;
  $("pnSave").classList.remove("show");
}
/* hovering a finished picture's title shows its file name in place: the title as it is on disk (lower case, dashes),
   its number and .png on either side, and the job's #. Editing it renames the file (the series and the next number) */
export function fnShow(on) {
  const j = peekJob,
    n = $("pname"),
    l = document.querySelector(".plbl");
  if (!j || j.status !== "done" || !j.file || document.activeElement === n || $("pnSave").classList.contains("show"))
    on = false;
  if (on) {
    const m = j.file.match(/^(.*?)(-\d{3,}(?:_x[\d.]+)?)(\.png)$/i),
      named = m && (j.name || "").trim() && slugify(j.name) === m[1];
    $("fnPre").textContent = `#${j.id}`;
    $("fnSuf").textContent = named ? m[2] + m[3] : ` · ${j.file}`;
    /* up against the title's TEXT (the field is wider: a minimum width and its edit padding) */
    const c = fnShow.c || (fnShow.c = document.createElement("canvas").getContext("2d")),
      cs = getComputedStyle(n);
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const tw = c.measureText(n.value || n.placeholder).width,
      inset = Math.max(0, (n.offsetWidth - tw) / 2);
    $("fnPre").style.marginRight = 8 - inset + "px";
    $("fnSuf").style.marginLeft = -inset + "px";
  } /* the title stays exactly as it is; its number and .png appear beside it */
  l.classList.toggle("fnon", on);
}
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
      $("pname").value = S.pname || "";
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
    ? `Vary: #${peekJob.id} again with a new seed — same prompt, settings and LoRAs; your draft stays (Ctrl+Enter)`
    : peekJob
      ? "Choose Reuse first"
      : !P.value.trim()
        ? "Write a prompt first"
        : "Add to queue (Ctrl+Enter)";
}
/* drag to reorder: the dragged row itself moves in the list (no re-render while dragging — that swapped the element
   under the pointer and made the cursor flicker); it moves once the pointer crosses a row's middle, so rows don't
   ping-pong; the others slide out of the way */
export let dragId = null,
  dragEl = null;

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initQueue() {
  $("qwrap").addEventListener(
    "click",
    e => {
      if (e.target.closest("#qsX")) {
        qsClear();
        return;
      }
      if (e.target.closest("#qsAll")) {
        qsFinished().forEach(j => QS.add(j.id));
        qsUpdate();
        return;
      }
      if (e.target.closest("#qsSeries")) {
        const n = jobs.find(j => QS.has(j.id)),
          nm = ((n && n.name) || "").trim();
        qsFinished().forEach(j => {
          if ((j.name || "").trim() === nm) QS.add(j.id);
        });
        qsUpdate();
        return;
      }
      if (e.target.closest("#qsDel")) {
        qsDelete();
        return;
      }
      if (e.target.closest("#qsRemove")) {
        const ids = [...QS];
        QS.clear();
        removeMany(ids);
        renderQueue();
        return;
      }
      const row = e.target.closest(".qi");
      if (!row || e.target.closest("[data-rm],[data-x],.seedc")) return;
      const j = jobs.find(x => x.id == +row.dataset.id);
      if (
        j &&
        (j.status === "done" || j.status === "cancelled") &&
        (e.target.closest("[data-ck]") || e.ctrlKey || e.metaKey || e.shiftKey || QS.size)
      ) {
        e.stopImmediatePropagation();
        qsClick(j, e.shiftKey);
        return;
      }
    },
    true,
  );
  document.addEventListener(
    "keydown",
    e => {
      if (S.view !== "queue" || $("modal").classList.contains("show")) return;
      const a = document.activeElement;
      if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        qsFinished().forEach(j => QS.add(j.id));
        qsUpdate();
        return;
      }
      if (e.key === "Escape" && qsClear()) {
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === "Delete" && QS.size) {
        e.preventDefault();
        e.stopImmediatePropagation();
        qsDelete();
      }
    },
    true,
  );
  /* a row's picture the server doesn't have yet: made once from the file (live.js), then it's a small file for good */
  $("qwrap").addEventListener(
    "error",
    e => {
      const im = e.target;
      if (!im.matches || !im.matches("img.qt") || im.dataset.tried) return;
      im.dataset.tried = "1";
      const j = jobs.find(x => x.id === +im.dataset.qt);
      if (j) makeQThumb(j, im);
    },
    true,
  );
  $("qwrap").addEventListener("click", e => {
    const sc = e.target.closest(".seedc");
    if (sc) {
      e.stopPropagation();
      copySeed(sc.dataset.seed);
      return;
    }
    if (e.target.id === "pauseQ") {
      setPaused(!window.qPaused);
      return;
    }
    if (e.target.id === "rmMissing") {
      removeMissing();
      return;
    }
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      removeJob(jobs.find(j => j.id == +rm.dataset.rm));
      return;
    }
    if (e.target.id === "clearDone") {
      setJobs(jobs.filter(j => j.status === "pending" || j.status === "running"));
      renderAll();
      return;
    }
    const x = e.target.closest("[data-x]");
    if (x) {
      stopJob(jobs.find(j => j.id == +x.dataset.x));
      return;
    }
    const q = e.target.closest(".qi");
    if (!q) return;
    const j = jobs.find(j => j.id == +q.dataset.id);
    if (j.status === "running") {
      showView("gen");
      pv("peekRender");
      return;
    }
    if (j.status === "done") {
      showView("gen");
      PV.from = "queue";
      pv("browse", j);
      return;
    } // finished: in the Gallery (✕ brings you back here)
    loadJob(j);
  });
  (function () {
    const l = document.querySelector(".plbl"),
      n = $("pname");
    l.addEventListener("mouseenter", () => fnShow(true));
    l.addEventListener("mouseleave", () => fnShow(false));
    n.addEventListener("focus", () => fnShow(false));
  })();
  $("pnSave").onclick = e => {
    e.stopPropagation();
    saveJobName();
  };
  /* Q5: hover a finished thumbnail for a bigger look */
  (function () {
    const pop = document.createElement("div");
    pop.id = "qpop";
    document.body.appendChild(pop);
    let t = null,
      cur = null;
    const hide = () => {
      clearTimeout(t);
      cur = null;
      pop.classList.remove("show");
    };
    $("qwrap").addEventListener("mouseover", e => {
      const c = e.target.closest(".qi .th canvas,.qi .th img.qt");
      if (c === cur) return;
      hide();
      if (!c || !window.fileUrl) return;
      cur = c;
      const j = jobs.find(x => x.id == +(c.dataset.th || c.dataset.qt));
      if (!j || !j.file) return;
      t = setTimeout(() => {
        if (cur !== c) return;
        const r = c.getBoundingClientRect(),
          [a, b] = (j.ar || "1:1").split(":").map(Number),
          w = a >= b ? 320 : Math.round((320 * a) / b),
          h = Math.round((w * b) / a);
        pop.innerHTML = `<img src="${window.fileUrl(j)}" alt="">`;
        pop.style.width = w + "px";
        pop.style.height = h + "px";
        /* never over the row you're pointing at: above it, lined up with its thumbnail; below it if there's no room above */
        const row = c.closest(".qi").getBoundingClientRect(),
          P = $("qwrap").getBoundingClientRect(),
          x = Math.max(P.left + 8, Math.min(P.right - w - 8, r.left));
        let y = row.top - 8 - h;
        if (y < P.top + 4) y = row.bottom + 8;
        if (y + h > innerHeight - 8) y = Math.max(8, row.top - 8 - h);
        pop.style.transform = `translate(${x}px,${y}px)`;
        pop.classList.add("show");
      }, 350);
    });
    $("qwrap").addEventListener("mouseleave", hide);
    $("qwrap").addEventListener("scroll", hide, { passive: true });
    $("qwrap").addEventListener("mousedown", hide);
  })();
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
  $("qwrap").addEventListener("dragstart", e => {
    const q = e.target.closest('.qi[draggable="true"]');
    if (!q) return;
    dragId = +q.dataset.id;
    dragEl = q;
    q.classList.add("drag");
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", String(dragId));
    } catch (_) {}
  });
  $("qwrap").addEventListener("dragover", e => {
    if (!dragEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const q = e.target.closest('.qi[draggable="true"]');
    if (!q || q === dragEl) return;
    const r = q.getBoundingClientRect(),
      after = e.clientY > r.top + r.height / 2;
    if (after ? q.nextElementSibling === dragEl : q.previousElementSibling === dragEl) return;
    const rows = [...$("qwrap").querySelectorAll('.qi[draggable="true"]')],
      before = new Map(rows.map(x => [x, x.getBoundingClientRect().top]));
    if (after) q.after(dragEl);
    else q.before(dragEl);
    for (const x of rows) {
      if (x === dragEl) continue;
      const d = before.get(x) - x.getBoundingClientRect().top;
      if (Math.abs(d) < 1) continue;
      x.style.transition = "none";
      x.style.transform = `translateY(${d}px)`;
      requestAnimationFrame(() => {
        x.style.transition = "transform .34s cubic-bezier(.4,0,.2,1)";
        x.style.transform = "";
      });
    }
  });
  $("qwrap").addEventListener("drop", e => {
    if (dragEl) e.preventDefault();
  });
  $("qwrap").addEventListener("dragend", () => {
    if (!dragEl) return;
    const ids = [...$("qwrap").querySelectorAll('.qi[draggable="true"]')].map(x => +x.dataset.id);
    const pend = ids.map(id => jobs.find(j => j.id === id)).filter(Boolean);
    let k = 0;
    setJobs(jobs.map(j => (j.status === "pending" && pend.includes(j) ? pend[k++] : j))); // the new order, in place of the old
    dragEl.classList.remove("drag");
    dragId = null;
    dragEl = null;
    renderQueue();
  });
}
