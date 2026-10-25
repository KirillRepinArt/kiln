// @ts-check
/** @typedef {import("./types.js").Job} Job */
import { deleteMany, makeQThumb, removeJob, removeMany, removeMissing, setPaused, stopJob } from "./actions.js";
import { esc, fmt } from "./boot.js";
import { $, hit, qa, target } from "./dom.js";
import { jEst, jobs, orderPending } from "./jobs.js";
import { loadJob } from "./peek.js";
import { PV, pv } from "./picstate.js";
import { urlFor } from "./pictures.js";
import { copySeed } from "./pills.js";
import { IC, S } from "./state.js";
import { showView } from "./tabs.js";

/* Kiln · Queue tab, peek / reuse */
export function renderQueue() {
  /** @type {Record<string, number>} */
  const before = {},
    W = $("qwrap"),
    y0 = W.scrollTop - 200,
    y1 = W.scrollTop + W.clientHeight + 200,
    R =
      "#qsRun .qi,#qsPend .qi"; /* only waiting / running rows slide, only on screen — finished ones never reorder (they jiggled) */
  qa(R, W).forEach(q => {
    if (q.offsetTop > y0 && q.offsetTop < y1) before[String(q.dataset.id)] = q.getBoundingClientRect().top;
  });
  renderQueueInner();
  const had = Object.keys(before).length;
  qa(R, W).forEach(q => {
    if (!(q.offsetTop > y0 && q.offsetTop < y1)) return;
    const b = before[String(q.dataset.id)];
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
/** the selected finished rows (job ids) @type {Set<number>} */
export const QS = new Set();
/** the last row clicked while selecting (Shift-click selects from it) @type {number | null} */
export let qsAnchor = null;
export function renderQueueInner() {
  const run = jobs.filter(j => j.status === "running"),
    pend = jobs.filter(j => j.status === "pending"),
    done = jobs.filter(j => j.status === "done" || j.status === "cancelled").reverse();
  const left = pend.reduce((a, j) => a + jEst(j), 0);
  for (const id of [...QS]) if (!done.some(j => j.id === id)) QS.delete(id);
  $("qwrap").classList.toggle("selecting", QS.size > 0);
  /** one row's markup @param {Job} j @param {"run" | "pend" | "done"} k its section */
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
  /** a section's markup, set only when it changed @param {string} id @param {string} html */
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
    qa("[data-tth]", $("qwrap")).forEach(ph => {
      const id = Number(ph.dataset.tth);
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
  shownSig = queueSig();
}
/** @type {Record<string, string>} */
const QSEC = {}; /* the last markup of each section */
/* each finished row's thumbnail element, loaded once and moved into every rebuild of the list (a new element would load
   again: the files are never cached by the browser, so the list flashed empty on every visit) */
const QT = new Map();
/* what the list shows: unchanged → opening the tab rebuilds nothing */
/* what the Queue tab shows was built for this list state */
let shownSig = "";
/* the list changed since the Queue tab was built */
export function queueChanged() {
  return shownSig !== queueSig();
}
export function queueSig() {
  return (
    jobs.map(j => `${j.id}:${j.status}:${j.file || ""}:${j.missing ? 1 : 0}:${j.name || ""}:${j.est || ""}`).join("|") +
    "|" +
    [...QS].join(",") +
    "|" +
    !!window.qPaused
  );
}
/** @param {Job[]} done */
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
  qa(".qi", W).forEach(q => q.classList.toggle("sel", QS.has(Number(q.dataset.id))));
  const h = $("qfin");
  if (h) {
    h.classList.toggle("qbar", QS.size > 0);
    h.innerHTML = finHead(done);
  }
  shownSig = queueSig();
}
/** @param {Job[]} done */
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
/** @param {Job} j @param {boolean} range Shift: everything from the last one clicked */
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
/** the time of day, with the date when it isn't today @param {number} ms */
function clock(ms) {
  const d = new Date(ms),
    now = new Date(),
    t = CLK.t.format(d);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    ? t
    : CLK.d.format(d) + " " + t;
}
/** @param {number | null} id */
export function setQsAnchor(id) {
  qsAnchor = id;
}
/* drag to reorder: the dragged row itself moves in the list (no re-render while dragging — that swapped the element
   under the pointer and made the cursor flicker); it moves once the pointer crosses a row's middle, so rows don't
   ping-pong; the others slide out of the way */
/** the waiting job being dragged @type {number | null} */
export let dragId = null;
/** @type {HTMLElement | null} */
let dragEl = null;

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initQueue() {
  $("qwrap").addEventListener(
    "click",
    e => {
      if (hit(e, "#qsX")) {
        qsClear();
        return;
      }
      if (hit(e, "#qsAll")) {
        qsFinished().forEach(j => QS.add(j.id));
        qsUpdate();
        return;
      }
      if (hit(e, "#qsSeries")) {
        const n = jobs.find(j => QS.has(j.id)),
          nm = ((n && n.name) || "").trim();
        qsFinished().forEach(j => {
          if ((j.name || "").trim() === nm) QS.add(j.id);
        });
        qsUpdate();
        return;
      }
      if (hit(e, "#qsDel")) {
        qsDelete();
        return;
      }
      if (hit(e, "#qsRemove")) {
        const ids = [...QS];
        QS.clear();
        removeMany(ids);
        renderQueue();
        return;
      }
      const row = hit(e, ".qi");
      if (!row || hit(e, "[data-rm],[data-x],.seedc")) return;
      const j = jobs.find(x => x.id == Number(row.dataset.id));
      if (
        j &&
        (j.status === "done" || j.status === "cancelled") &&
        (hit(e, "[data-ck]") || e.ctrlKey || e.metaKey || e.shiftKey || QS.size)
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
      if (a instanceof HTMLElement && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
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
      const im = target(e);
      if (!im.matches || !im.matches("img.qt") || im.dataset.tried) return;
      im.dataset.tried = "1";
      const j = jobs.find(x => x.id === Number(im.dataset.qt || 0));
      if (j) makeQThumb(j, im);
    },
    true,
  );
  $("qwrap").addEventListener("click", e => {
    const sc = hit(e, ".seedc");
    if (sc) {
      e.stopPropagation();
      copySeed(sc.dataset.seed);
      return;
    }
    if (target(e).id === "pauseQ") {
      setPaused(!window.qPaused);
      return;
    }
    if (target(e).id === "rmMissing") {
      removeMissing();
      return;
    }
    const rm = hit(e, "[data-rm]");
    if (rm) {
      removeJob(jobs.find(j => j.id == Number(rm.dataset.rm)));
      return;
    }
    const x = hit(e, "[data-x]");
    if (x) {
      stopJob(jobs.find(j => j.id == Number(x.dataset.x)));
      return;
    }
    const q = hit(e, ".qi");
    if (!q) return;
    const j = /** @type {Job} */ (jobs.find(j => j.id == Number(q.dataset.id || 0))); // a row's job is in the list
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
  /* Q5: hover a finished thumbnail for a bigger look */
  (function () {
    const pop = document.createElement("div");
    pop.id = "qpop";
    document.body.appendChild(pop);
    /** @type {number | undefined} */
    let t;
    /** the thumbnail the pointer is on @type {HTMLElement | null} */
    let cur = null;
    const hide = () => {
      clearTimeout(t);
      cur = null;
      pop.classList.remove("show");
    };
    $("qwrap").addEventListener("mouseover", e => {
      const c = hit(e, ".qi .th canvas,.qi .th img.qt");
      if (c === cur) return;
      hide();
      if (!c) return;
      cur = c;
      const j = jobs.find(x => x.id == Number(c.dataset.th || c.dataset.qt));
      if (!j || !j.file) return;
      t = setTimeout(() => {
        if (cur !== c) return;
        const r = c.getBoundingClientRect(),
          [a, b] = (j.ar || "1:1").split(":").map(Number),
          w = a >= b ? 320 : Math.round((320 * a) / b),
          h = Math.round((w * b) / a);
        pop.innerHTML = `<img src="${urlFor(j)}" alt="">`;
        pop.style.width = w + "px";
        pop.style.height = h + "px";
        /* never over the row you're pointing at: above it, lined up with its thumbnail; below it if there's no room above */
        const row = /** @type {HTMLElement} */ (c.closest(".qi")).getBoundingClientRect(),
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
  $("qwrap").addEventListener("dragstart", e => {
    const q = hit(e, '.qi[draggable="true"]');
    if (!q) return;
    dragId = Number(q.dataset.id);
    dragEl = q;
    q.classList.add("drag");
    const dt = /** @type {DataTransfer} */ (e.dataTransfer); // a drag event always has one
    dt.effectAllowed = "move";
    try {
      dt.setData("text/plain", String(dragId));
    } catch (_) {}
  });
  $("qwrap").addEventListener("dragover", e => {
    if (!dragEl) return;
    e.preventDefault();
    /** @type {DataTransfer} */ (e.dataTransfer).dropEffect = "move";
    const q = hit(e, '.qi[draggable="true"]');
    if (!q || q === dragEl) return;
    const r = q.getBoundingClientRect(),
      after = e.clientY > r.top + r.height / 2;
    if (after ? q.nextElementSibling === dragEl : q.previousElementSibling === dragEl) return;
    const rows = qa('.qi[draggable="true"]', $("qwrap")),
      before = new Map(rows.map(x => [x, x.getBoundingClientRect().top]));
    if (after) q.after(dragEl);
    else q.before(dragEl);
    for (const x of rows) {
      if (x === dragEl) continue;
      const d = /** @type {number} */ (before.get(x)) - x.getBoundingClientRect().top;
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
    const ids = qa('.qi[draggable="true"]', $("qwrap")).map(x => Number(x.dataset.id));
    orderPending(/** @type {Job[]} */ (ids.map(id => jobs.find(j => j.id === id)).filter(Boolean))); // the new order, in place of the old
    dragEl.classList.remove("drag");
    dragId = null;
    dragEl = null;
    renderQueue();
  });
}
