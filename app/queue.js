// @ts-check
/** @typedef {import("./types.js").Job} Job */
import {
  deleteMany,
  makeQThumb,
  removeJob,
  removeMany,
  removeMissing,
  saveOrder,
  setPaused,
  stopJob,
} from "./actions.js";
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
  const item = (j, k) => `<div class="qi${j.missing ? " missing" : ""}" data-id="${j.id}">
   ${k === "pend" ? '<span class="handle" title="Drag to reorder">⋮⋮</span>' : ""}${k === "done" ? `<span class="qck" data-ck="${j.id}" data-tip="Select (Ctrl-click · Shift-click a range)"></span>` : ""}
   <div class="th">${j.missing ? "gone" : j.status === "done" ? `<span data-tth="${j.id}"></span>` : j.status === "cancelled" ? "stopped" : k === "run" ? `<svg class="hg" viewBox="0 0 24 24" fill="none"><g class="hgg"><path d="M7 3.5h10M7 20.5h10" stroke="currentColor" stroke-width="1.6"/><path d="M8 3.5c0 4 1.6 6 4 8.5-2.4 2.5-4 4.5-4 8.5M16 3.5c0 4-1.6 6-4 8.5 2.4 2.5 4 4.5 4 8.5" stroke="currentColor" stroke-width="1.4"/><path class="st" d="M9.2 6.5h5.6c-.4 2-1.3 3.4-2.8 4.9-1.5-1.5-2.4-2.9-2.8-4.9z" fill="currentColor"/><path class="sb" d="M12 14.2c1.8 1.9 2.7 3.6 3 6H9c.3-2.4 1.2-4.1 3-6z" fill="currentColor"/></g></svg><img class="lp" data-lp="${j.id}" alt="">` : "#" + j.id}</div>
   <div class="body"><div class="p">${j.file ? `<b style="font-weight:600">${esc(j.file)}</b> · ` : ""}${esc((j.prompt || "").slice(0, 240))}</div>
   <div class="meta">${j.picks && j.picks.length ? `<span style="color:#e6e6ea">${esc(j.picks.join(" · "))}</span> · ` : ""}${j.mp} MP · ${j.ar} · ${j.steps} ${j.steps === 1 ? "step" : "steps"} · <span class="seedc" data-seed="${j.seed}" data-tip="Click to copy the seed">seed ${j.seed}</span>${k === "pend" ? ` · ~${fmt(jEst(j))}` : ""}${j.missing ? ' · <span class="gone">file deleted</span>' : ""}</div>
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
    fitBar(h);
  }
  shownSig = queueSig();
}
/* the selection bar stays on one line (2026-10-27, the user: in a narrow panel it broke onto two, the rows below
   jumping): words give way in order — the series name shortens (CSS), then "of N", "from list", "Select" */
const CUTS = ["c1", "c2", "c3"];
/** @param {HTMLElement} h */
function fitBar(h) {
  h.classList.remove(...CUTS);
  if (!h.classList.contains("qbar")) return;
  for (const c of CUTS) {
    if (h.scrollWidth <= h.clientWidth) return;
    h.classList.add(c);
  }
}
let barSeen = 0; // the panel's width last fitted to
new ResizeObserver(([e]) => {
  const w = Math.round(e.contentRect.width),
    h = document.getElementById("qfin");
  if (w !== barSeen && h) fitBar(h);
  barSeen = w;
}).observe($("qwrap"));
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
  return `<span class="qn"><b>${QS.size}</b><span class="qcut1"> of ${done.length}</span> selected</span>${series}${sel.length < done.length ? '<button id="qsAll"><span class="qcut3">Select a</span><span class="qcut3a">A</span>ll</button>' : ""}<span class="qgap"></span>
  <button id="qsRemove" data-tip="Take them off the list — the files stay">Remove<span class="qcut2"> from list</span></button><button id="qsDel" class="qdel" data-tip="To the Recycle Bin, with Undo (Del)">Delete</button><button id="qsX" class="qx" data-tip="Clear the selection (Esc)">${IC.x}</button>`;
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
/* reorder = pick up the plate (2026-10-27, agreed with the user): the real row lifts (a touch larger, a deeper shadow)
   and follows the pointer up and down — one copy, never a ghost of it; where it would land, its footprint (the dashed line
   on a row's edge) travels through the list as the other rows slide aside on the glide curve. Letting go settles it into
   the plate; Esc puts it back where it was. The same drag language as moving the prompt box. The list is never rebuilt
   while you hold a row (the poll waits: dragId) */
/** the waiting job being held @type {number | null} */
export let dragId = null;

/** the waiting rows, not the one held @returns {HTMLElement[]} */
const pendRows = () => qa("#qsPend .qi:not(.lifted)");
/** the rows slide to their new places when the list changes under them (FLIP, by layout position: never mid-glide)
 * @param {() => void} change */
function slideRows(change) {
  const rows = pendRows(),
    before = new Map(rows.map(r => [r, r.offsetTop]));
  change();
  for (const r of rows) {
    const d = /** @type {number} */ (before.get(r)) - r.offsetTop;
    if (Math.abs(d) < 1) continue;
    r.style.transition = "none";
    r.style.transform = `translateY(${d}px)`;
    requestAnimationFrame(() => {
      r.style.transition = "transform var(--lay-t) var(--lay-e)";
      r.style.transform = "";
    });
  }
}
function initReorder() {
  const W = $("qwrap");
  /** the row pressed / held: the press, where on the row it was grabbed, the footprint, what it sat before, the pointer
   * @type {{ row: HTMLElement, pid: number, x0: number, y0: number, moved: boolean, grab: number,
   *   slot: HTMLElement | null, home: Element | null, y: number, raf: number } | null} */
  let d = null,
    noClick = false;
  /** the footprint's place for a pointer at y: before the first row whose middle is below it @param {number} y */
  const placeSlot = y => {
    const m = /** @type {NonNullable<typeof d>} */ (d),
      slot = /** @type {HTMLElement} */ (m.slot),
      top = W.getBoundingClientRect().top - W.scrollTop,
      rows = pendRows(),
      next = rows.find(r => top + r.offsetTop + r.offsetHeight / 2 > y) || null,
      tail = rows[rows.length - 1];
    if (next ? slot.nextElementSibling === next : !tail || slot.previousElementSibling === tail) return;
    slideRows(() => (next ? next.before(slot) : tail.after(slot)));
  };
  /* near the list's top or bottom edge the list scrolls under the held row */
  const edgeScroll = () => {
    const m = d;
    if (!m || !m.moved) return;
    const r = W.getBoundingClientRect(),
      v = m.y < r.top + 48 ? -(r.top + 48 - m.y) / 4 : m.y > r.bottom - 48 ? (m.y - (r.bottom - 48)) / 4 : 0;
    if (v) {
      W.scrollTop += v;
      placeSlot(m.y);
    }
    m.raf = requestAnimationFrame(edgeScroll);
  };
  function lift() {
    const m = /** @type {NonNullable<typeof d>} */ (d),
      row = m.row,
      r = row.getBoundingClientRect();
    m.moved = true;
    m.grab = m.y0 - r.top; // where it was pressed: the row stays under that point of the pointer
    dragId = Number(row.dataset.id);
    const slot = document.createElement("div");
    slot.className = "qslot";
    slot.style.height = r.height + "px";
    row.before(slot);
    m.slot = slot;
    m.home = row.nextElementSibling; // where it was: Esc puts the plate back before this
    Object.assign(row.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", transition: "none" });
    row.classList.add("lifted");
    document.body.classList.add("qdragging");
    try {
      W.setPointerCapture(m.pid);
    } catch (_) {}
    m.raf = requestAnimationFrame(edgeScroll);
  }
  /* let go (or Esc): the row glides into its footprint, then takes its place in the list */
  /** @param {boolean} keep where it was dropped (false: back home) */
  function settle(keep) {
    const m = d;
    d = null;
    if (!m || !m.slot) return;
    cancelAnimationFrame(m.raf);
    const slot = m.slot,
      row = m.row;
    if (!keep) {
      const home = m.home;
      slideRows(() => (home && home.parentElement ? home.before(slot) : slot.parentElement?.append(slot)));
    }
    const s = slot.getBoundingClientRect();
    row.style.transition = "top var(--lay-t) var(--lay-e), transform var(--lay-t) var(--lay-e)";
    row.style.top = s.top + "px";
    row.classList.remove("lifted");
    row.classList.add("settling");
    document.body.classList.remove("qdragging");
    let done = false;
    const land = () => {
      if (done) return;
      done = true;
      slot.replaceWith(row);
      row.classList.remove("settling");
      for (const k of ["left", "top", "width", "transition", "transform"]) row.style.removeProperty(k);
      dragId = null;
      const ids = qa("#qsPend .qi").map(x => Number(x.dataset.id)),
        was = jobs.filter(j => j.status === "pending").map(j => j.id);
      if (ids.join() === was.join()) return;
      orderPending(/** @type {Job[]} */ (ids.map(id => jobs.find(j => j.id === id)).filter(Boolean)));
      saveOrder(ids);
      renderQueue();
    };
    row.addEventListener("transitionend", e => e.propertyName === "top" && land());
    setTimeout(land, 700); // a hidden window pauses transitions: it lands anyway
  }
  W.addEventListener("pointerdown", e => {
    if (e.button !== 0 || d) return;
    const row = hit(e, "#qsPend .qi");
    if (!row || hit(e, "button,input,.seedc")) return;
    d = {
      row,
      pid: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      moved: false,
      grab: 0,
      slot: null,
      home: null,
      y: e.clientY,
      raf: 0,
    };
  });
  W.addEventListener("pointermove", e => {
    const m = d;
    if (!m || e.pointerId !== m.pid) return;
    if (!(e.buttons & 1)) {
      if (m.moved) settle(true);
      else d = null;
      return;
    }
    m.y = e.clientY;
    if (!m.moved) {
      if (Math.hypot(e.clientX - m.x0, e.clientY - m.y0) < 6) return;
      lift();
    }
    m.row.style.top = e.clientY - m.grab + "px";
    placeSlot(e.clientY);
  });
  W.addEventListener("pointerup", e => {
    const m = d;
    if (!m || e.pointerId !== m.pid) return;
    if (!m.moved) {
      d = null;
      return;
    }
    noClick = true; // the click that follows a drag isn't a click on the row
    settle(true);
  });
  W.addEventListener("pointercancel", () => {
    if (d && d.moved) settle(false);
    else d = null;
  });
  W.addEventListener(
    "click",
    e => {
      if (!noClick) return;
      noClick = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    true,
  );
  document.addEventListener(
    "keydown",
    e => {
      if (e.key !== "Escape" || !d || !d.moved) return;
      e.stopImmediatePropagation();
      settle(false);
    },
    true,
  );
}

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
      if (j) makeQThumb(j, /** @type {HTMLImageElement} */ (im)); // the error came from an <img>
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
  initReorder();
}
