// @ts-check
/* Kiln · prompt card placement: centring, freeze while working, drag top/middle/bottom */
import { $, q } from "./dom.js";
import { HANDLES, outlines } from "./outlines.js";
import {
  dockNow,
  lay,
  liftCol,
  minRight,
  paneSize,
  placeFor,
  setDock,
  sideBoxPass,
  sizeFrame,
  vAlign,
  vPass,
} from "./layout.js";
import { PWMIN } from "./layoutmath.js";
import { peekJob } from "./prompt.js";
import { P, S, save } from "./state.js";
import { moveThumb } from "./tabs.js";
import { SPACE } from "./tokens.js";
import { boxSizing } from "./editor.js";
import { rearrange, stop, travelling } from "./rearrange.js";

/* ======================= prompt card layout =======================
   Centred on the image's vertical centre while there's room. While the editor is focused or the pointer is over
   the card it is FROZEN: it only grows downward (then scrolls), so nothing moves under the cursor. ~0.5 s after the
   pointer leaves (and the editor isn't focused) it glides back to centre and re-expands to use the space. */
/** @type {import("./types.js").CardState} */
export const card = {
  frozen: false,
  hover: false,
  thawTimer: undefined,
  top: null,
  bottom: null,
  drag: false,
  hHold: 0,
  hPin: "top",
};
/* the card's held layout let go: frozen while you work, its top and centre forgotten (also from other files) */
export function lyReset() {
  card.frozen = false;
  card.top = null;
}
export function lyUnfreeze() {
  card.frozen = false;
}
/* the box's least height has ONE owner: slotLeast() — two lines of text plus the box's controls, from the text's own
   metrics (2026-11-02, the user's screenshot: squeezed in Vertical, the editor kept a CSS min-height of 108 px of its
   own and drew under the pills; side by side the modes used a third number, EDMIN). The editor's CSS takes what the box
   gives it and scrolls */
/** @returns {number} */
export function cardNaturalH() {
  const L = $("left"),
    w = q(".pwrapT", L);
  const sc = L.querySelector(".cm-scroller");
  const edH = (sc ? sc.scrollHeight : P.scrollHeight) + 16;
  /* the least from the text's metrics (the editor); the plain textarea (no editor) has its own CSS least */
  return Math.max(sc ? slotLeast() : 170, L.offsetHeight - w.offsetHeight + edH);
}
/* Vertical: the height the box needs for the text in it — measured from the text itself (the editor's content and its
   paddings), never from the scroller, whose height is the box's: measured that way the box could grow but never shrink.
   `lines`: the height for that many lines instead (the box's least) */
/** @param {number} [lines] @returns {number} */
export function textBoxH(lines) {
  const L = $("left"),
    w = q(".pwrapT", L),
    sc = /** @type {HTMLElement | null} */ (L.querySelector(".cm-scroller")),
    ct = /** @type {HTMLElement | null} */ (L.querySelector(".cm-content"));
  if (!sc || !ct) return cardNaturalH(); // the plain textarea (no editor)
  const cs = getComputedStyle(ct),
    line = parseFloat(getComputedStyle(L.querySelector(".cm-line") || ct).lineHeight) || 24,
    body =
      lines == null
        ? ct.offsetHeight
        : (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + lines * line,
    edMargin = parseFloat(getComputedStyle(/** @type {HTMLElement} */ (sc.parentElement)).marginBottom) || 0;
  return Math.ceil(
    L.offsetHeight - w.offsetHeight + body + (parseFloat(getComputedStyle(sc).paddingBottom) || 0) + edMargin,
  );
}
/** the box's least height in Vertical: its controls and two lines */
/** @returns {number} */
export const slotLeast = () => textBoxH(2);
let draftH = 0; // the height your draft's text needs (kept while a job's prompt is shown: it never resizes the box)
/** Vertical: the box's text height — your draft's: a job's prompt shown in it never resizes it (it scrolls inside), so
 * browsing prompts of different lengths never moves anything (2026-10-19). The layout pass's input (C4b) */
export function boxDraftH() {
  if (!peekJob || !draftH) draftH = textBoxH();
  return draftH;
}
export function applyMode() {
  const a = q(".app"),
    was = a.classList.contains("stacked");
  // switch to narrow below 980 px (or a tall window); back to wide only above 1020 px, so dragging near the edge doesn't flicker
  const narrow =
    was && a.dataset.narrow === "1"
      ? innerWidth < 1020 || innerWidth / innerHeight < 1.2 || innerWidth - 3 * SPACE.area < 400 + minRight()
      : innerWidth < 980 || innerWidth / innerHeight < 1.15 || innerWidth - 3 * SPACE.area < 360 + minRight();
  a.dataset.narrow = narrow ? "1" : "";
  const st =
    narrow ||
    S.dock === "below"; /* Layout → Vertical stacks on any window; a horizontal dock comes back when there's room */
  a.classList.toggle("pright", S.dock === "right" && !st);
  $("ltitle").dataset.tip = st ? "" : "Drag to move the prompt box: top · middle · bottom";
  if (a.classList.contains("stacked") !== st) {
    a.classList.toggle("stacked", st);
    // switching layouts: place the image first, then the card
    lyReset();
    sizeFrame();
    layoutLeft();
    moveThumb(true);
    requestAnimationFrame(() => {
      sizeFrame();
      layoutLeft();
    });
  }
  updHm();
}
/* Vertical: the prompt box's width — yours (paneSize("box", "vert"), set with its side edges through the layout pass), or
   the picture's (Fit width), never narrower than the box's minimum or wider than the
   window. ONE writer of the box's width in Vertical: layoutLeft (--sw) asks this (2026-11-02, v0.7c 3b: the side edges
   wrote --sw and a held offset --soff themselves) */
export function stackW() {
  const max = innerWidth - 2 * SPACE.area,
    pic = typeof lay !== "undefined" && lay.target && lay.target.w;
  /* the modes act on the box's CROSS axis (DEVLOG DD-2026-11-02-16): in Vertical its width — Match: the picture's, Full:
     the window's (less its edge gaps); side by side its height (layoutLeft) */
  const m = S.hmode,
    w = m === "full" ? max : m === "match" && pic ? pic : paneSize("box", "vert").w || 760;
  return Math.round(Math.max(Math.min(PWMIN, max), Math.min(max, w)));
}
export function chipsH() {
  const c = $("chips");
  return c.childElementCount ? c.offsetHeight + SPACE.tight : 0;
} // the row always shows ("LoRA +") // the chip row under the box, and its gap
/** @param {boolean} [direct] the user's hand is the clock (typing): the box follows at once, as under a drag — a change
 * the system makes (a layout switch, a Reset) moves on the rearrangement's plan */
export function layoutLeft(direct = false) {
  if (card.drag) return;
  layDirect = direct;
  const L = $("left"),
    col = $("lcol"),
    CH = chipsH();
  const TS = 64; // the name row over the box (one height whatever it shows: the title never moves)
  col.style.setProperty("--ts", TS + "px");
  col.style.setProperty("--chh", $("chips").offsetHeight + "px"); // the LoRA row: the grip zone's bottom (.pgrip)
  const stk = !!document.querySelector(".app.stacked"),
    hm = !stk && (S.hmode === "full" || S.hmode === "match") ? S.hmode : "";
  /* Vertical has no height modes: they took the picture's room */
  L.classList.toggle("hm", !!hm);
  $("ltitle").classList.toggle("hm", !!hm);
  if (stk) {
    card.top = 0;
    /* the box is placed by the layout pass, under the page's pane (v0.7c C4b, ux-review/16-layout-pass.md C4): the pane
       first, the box its text's height in the free room under it, then it scrolls — its growth never takes the pane's
       room (it had a grid row of its own sized by its text, --lch, and the page took what was left: the user's
       overlap, 2026-11-09). The column is a layer over the whole room, as side by side: the box's top is the pass's,
       in the column's px (its layout box, without a transform). Its width and height too: held, an edge's (C4c) */
    const was = lay.passV,
      p = vPass(),
      colTop = /** @type {HTMLElement} */ (col.offsetParent).getBoundingClientRect().top + col.offsetTop;
    swAt(col, Math.round(p.box.w));
    requestAnimationFrame(vAlign);
    boxAt(col, Math.round(p.box.y - colTop), Math.round(p.box.h));
    /* the pane changed under it (a size of yours, Reset, a new limit): its owner lays the page out in this task — on the
       rearrangement's plan, one motion with the box riding its plate. (Not with the layout held at once: the old
       column's text-sized row needed that, and it snapped every Reset in Vertical — B16) */
    if (!was || Math.abs(was.page.h - p.page.h) > 0.5 || Math.abs(was.page.w - p.page.w) > 0.5) sizeFrame();
    return;
  }
  if (col.clientHeight - TS <= 0) return;
  /* side by side the box's place beside its pane is the layout pass's — ONE rule (cardPlacement, its modes
     cardHeightMode), called by the pass with the column and the moment's state (C2b's rest: the pass had a copy of its
     own, and this measured the picture's lines itself) */
  const p = sideBoxPass(),
    c0 = /** @type {HTMLElement} */ (col.offsetParent).getBoundingClientRect().top + col.offsetTop;
  card.top = p.box.y - c0 - TS;
  card.bottom = card.top + p.box.h + CH;
  boxAt(col, p.box.y - c0, p.box.h);
}
/** Vertical: the box's width (--sw) — ONE writer, this; a change the system makes (a double-click, Reset, a new limit)
 * moves it on the rearrangement's plan and clock with the page it sits under (T2c-3b-4: it was written at once, a 200 px
 * jump in one frame — C5's case table); your hand (a drag, typing) at once, and a switch (the plate travelling): the
 * box is at its end shape from the switch's first frame (a crop-and-reveal's frame or the plate travelling), its relation change carries it (DD-4's whole rule — late in a
 * switch a 1–2 px settle of --sw on the driver slid the centred box off its relation) @param {HTMLElement} col
 * @param {number} w */
function swAt(col, w) {
  const now = parseFloat(col.style.getPropertyValue("--sw")),
    write = (/** @type {{ w: number }} */ b) => col.style.setProperty("--sw", Math.round(b.w * 10) / 10 + "px");
  if (!now || card.drag || layDirect || travelling()) {
    stop("sw");
    write({ w });
  } else rearrange("sw", { l: 0, t: 0, w: now, h: 0 }, { l: 0, t: 0, w, h: 0 }, write);
}
/** where the box is in its column now (its top and height; its width is --cw) — null until it's first laid out
 * @type {{ l: number, t: number, w: number, h: number } | null} */
let boxNow = null;
/** the box's top and height — and the LoRA chips' row under it, which goes with it: ONE writer (--ltop / --lh /
 * --chtop; the name row and the grip follow --ltop). A change tells the editor at once (its scrollbar's thumb waits
 * for the box to settle, B21) @param {HTMLElement} col @param {{ l: number, t: number, w: number, h: number }} b */
function boxWrite(col, b) {
  const t = b.t + "px",
    h = b.h + "px",
    changed = col.style.getPropertyValue("--ltop") !== t || col.style.getPropertyValue("--lh") !== h;
  col.style.setProperty("--ltop", t);
  col.style.setProperty("--lh", h);
  col.style.setProperty("--chtop", b.t + b.h + SPACE.tight + "px");
  boxNow = b;
  if (changed) boxSizing();
}
/** whether the layout now being placed is the user's own direct change (layoutLeft's `direct`) */
let layDirect = false;
/** where the layout wants the box: side by side it moves there on the rearrangement's plan and clock, on the progress of
 * the picture it's anchored to (T2: it glided on CSS's --lay-t, a clock of its own, and fell behind); in Vertical, while
 * dragged, or the first time, at once @param {HTMLElement} col @param {number} top @param {number} H */
function boxAt(col, top, H) {
  const to = { l: 0, t: top, w: 0, h: H };
  /* at once: the first time, under a drag or typing (the hand is the clock — composers grow with the text; animated, the
     box lagged its text and the text overflowed mid-growth, DEVLOG DD-2026-11-09-2), and in Vertical (C4's) */
  if (!boxNow || card.drag || layDirect || document.querySelector(".app.stacked")) {
    stop("box");
    boxWrite(col, to);
  } else {
    /* the box is changing from the moment it's asked to (its move may wait for the plan's reveal): the editor's thumb
       waits from now — told at the first write, it showed for the frames before it (B21) */
    if (to.t !== boxNow.t || to.h !== boxNow.h) boxSizing();
    rearrange("box", boxNow, to, b => boxWrite(col, b), "frame");
  }
}
function freeze() {
  clearTimeout(card.thawTimer);
  card.frozen = true;
}
function thaw() {
  clearTimeout(card.thawTimer);
  card.thawTimer = setTimeout(() => {
    const ed = document.activeElement && $("left").contains(document.activeElement);
    if (card.hover || ed) return;
    card.frozen = false;
    layoutLeft();
  }, 500);
}
/* the size buttons by the name: side by side, Match = the picture's height; in Vertical, Fit = the picture's width */
const HM_H =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h14M5 20h14M12 8v8M9 11l3-3 3 3M9 13l3 3 3-3"/></svg>',
  HM_W =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5v14M20 5v14M8 12h8M11 9l-3 3 3 3M13 9l3 3-3 3"/></svg>';
export function updHm() {
  const stk = !!document.querySelector(".app.stacked"),
    m = S.hmode || "",
    fit = m === "match";
  $("hmodes").classList.toggle("on", fit || m === "full");
  const b = $("hmMatch");
  if (b.dataset.ic !== String(stk)) {
    b.dataset.ic = String(stk);
    b.innerHTML = stk ? HM_W : HM_H;
  }
  b.classList.toggle("on", fit);
  $("hmFull").classList.toggle("on", m === "full");
  b.dataset.tip = stk
    ? fit
      ? "Back to your width"
      : "Fit the box to the picture's width"
    : fit
      ? "Back to normal height"
      : "Match the image height";
  $("hmFull").dataset.tip = stk
    ? m === "full"
      ? "Back to your width"
      : "Full width"
    : m === "full"
      ? "Back to normal height"
      : "Full height";
}

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initCardlayout() {
  $("left").addEventListener("pointerenter", () => {
    card.hover = true;
    freeze();
  });
  $("left").addEventListener("pointerleave", () => {
    card.hover = false;
    thaw();
  });
  $("left").addEventListener("focusin", freeze);
  $("left").addEventListener("focusout", () => {
    if (!card.hover) thaw();
  });
  new ResizeObserver(() => layoutLeft()).observe($("lcol"));
  $("hmodes").addEventListener("click", e => {
    const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest("[data-hm]"));
    if (!b) return;
    S.hmode = S.hmode === b.dataset.hm ? "" : /** @type {"full" | "match"} */ (b.dataset.hm); // one mode, both layouts
    save();
    updHm();
    card.frozen = false;
    layoutLeft();
  });
  updHm();
  (function () {
    const L = $("left"),
      col = $("lcol");
    /* MOVING THE BOX IS ONE SYSTEM (L1 — the design agreed 2026-10-31, ux-review/13-ownership-map.md L1): one placement
       state {dock, pos} and one drag offering its seven places (left × top / middle / bottom, right × 3, below). The box
       itself follows the pointer (the column's one writer, layout.js liftCol); dashed LANES show where it could go,
       one glass FOOTPRINT where it will land — both from the layout pass for each place (layout.js placeFor), so what's
       shown is where it lands. Dropped in its own lane it moves to the spot; in another, the layout switch carries it.
       Esc: back where it was. (It was two systems: ghost outlines for top / middle / bottom, and glass dock zones with
       thresholds of their own — "below" needed the pointer 80 px past the lowest spot.) */
    const PLACES = /** @type {const} */ ([
      ["left", "top"],
      ["left", "mid"],
      ["left", "bot"],
      ["right", "top"],
      ["right", "mid"],
      ["right", "bot"],
      ["below", "mid"],
    ]);
    const HYST = 24; // a nearer place takes over only once it's this much nearer (no flicker between two)
    /** @typedef {{ dock: "left" | "right" | "below", pos: "top" | "mid" | "bot", r: import("./layoutmath.js").Rect }} Place */
    /** the press, then the lift: where the box was, its seven places, the one it would land on
     * @type {{ x0: number, y0: number, dx: number, dy: number, moved: boolean, r0: DOMRect, places: Place[], at: Place | null } | null} */
    let d = null;
    /* the grip is ONE zone (2026-11-01, L3): the box's name row, the box, its LoRA row — through one listener on the
       column; what keeps its pointer: text, controls, chips, menus, the edges you drag (their bands: B19) */
    const NO = "input,textarea,button,a,select,.chip,.pwrapT,.pop,.cwi," + HANDLES,
      GROUP = "#pgrip,#left,#ltitle,#chips";
    const lanes = /** @type {const} */ (["left", "right", "below"]).map(z => {
        const e = document.createElement("div");
        e.className = "lane";
        e.dataset.dock = z;
        document.body.appendChild(e);
        return e;
      }),
      foot = document.createElement("div");
    foot.className = "footprint";
    document.body.appendChild(foot);
    const put = (/** @type {HTMLElement} */ e, /** @type {import("./layoutmath.js").Rect} */ r) => {
      e.style.left = r.x + "px";
      e.style.top = r.y + "px";
      e.style.width = r.w + "px";
      e.style.height = r.h + "px";
    };
    /** @param {PointerEvent} e */
    function down(e) {
      const tg = /** @type {HTMLElement} */ (e.target);
      /* the grip works in every mode (2026-11-02, the user: in Full side by side the title didn't drag while the LoRA
         row did — two paths). A mode fixes the box's height; moving it is still yours */
      if (e.button !== 0 || !tg.closest(GROUP) || tg.closest(NO)) return;
      e.preventDefault();
      d = {
        x0: e.clientX,
        y0: e.clientY,
        dx: 0,
        dy: 0,
        moved: false,
        r0: L.getBoundingClientRect(),
        places: [],
        at: null,
      };
      try {
        /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
      } catch (_) {}
      outlines("move", ["box"]);
    }
    /* the press shows what moves: the box's own outline (outlines.js; drawn by the box: layout.css) */
    /** @param {PointerEvent} e */
    function move(e) {
      const m = d;
      if (!m) return;
      if (!(e.buttons & 1)) {
        up();
        return;
      }
      m.dx = e.clientX - m.x0;
      m.dy = e.clientY - m.y0;
      if (!m.moved && Math.hypot(m.dx, m.dy) < 6) return;
      if (!m.moved) {
        m.moved = true;
        card.drag = true;
        document.body.classList.add("cardmove");
        const now = dockNow(),
          pos = S.pos || "mid";
        m.places = PLACES.map(([dock, p]) => ({ dock, pos: p, r: placeFor(dock, p) }));
        m.at = m.places.find(p => p.dock === now && (now === "below" || p.pos === pos)) || m.places[0];
        /* each lane: the span of its places */
        for (const l of lanes) {
          const ps = m.places.filter(p => p.dock === l.dataset.dock),
            x = Math.min(...ps.map(p => p.r.x)),
            y = Math.min(...ps.map(p => p.r.y));
          put(l, {
            x,
            y,
            w: Math.max(...ps.map(p => p.r.x + p.r.w)) - x,
            h: Math.max(...ps.map(p => p.r.y + p.r.h)) - y,
          });
          l.classList.add("show");
        }
        foot.classList.add("show");
      }
      liftCol(m.dx, m.dy); // the box follows the pointer
      /* the place nearest the box's centre, with hysteresis */
      const cx = m.r0.left + m.r0.width / 2 + m.dx,
        cy = m.r0.top + m.r0.height / 2 + m.dy,
        dist = (/** @type {Place} */ p) => Math.hypot(p.r.x + p.r.w / 2 - cx, p.r.y + p.r.h / 2 - cy),
        best = m.places.reduce((a, b) => (dist(b) < dist(a) ? b : a));
      if (m.at && best !== m.at && dist(best) + HYST < dist(m.at)) m.at = best;
      if (!m.at) return;
      put(foot, m.at.r);
      foot.dataset.dock = m.at.dock;
      foot.dataset.pos = m.at.pos;
      for (const l of lanes) l.classList.toggle("near", l.dataset.dock === m.at.dock);
    }
    /** @param {boolean} [cancel] Esc: back where it was */
    function up(cancel = false) {
      if (!d) return;
      const m = d;
      d = null;
      outlines("move", []);
      if (!m.moved) return;
      document.body.classList.remove("cardmove");
      for (const l of lanes) l.classList.remove("show", "near");
      foot.classList.remove("show");
      /* the lift lets go on the driver: the box comes home from where it is (one plan and clock with what else moves) */
      const home = (/** @type {number} */ x, /** @type {number} */ y) =>
          rearrange("lift", { l: x, t: y, w: 0, h: 0 }, { l: 0, t: 0, w: 0, h: 0 }, b => liftCol(b.l, b.t)),
        at = m.at,
        now = dockNow();
      if (cancel || !at || (at.dock === now && (now === "below" || at.pos === (S.pos || "mid")))) {
        card.drag = false;
        home(m.dx, m.dy);
        return;
      }
      S.pos = at.pos;
      save();
      if (at.dock !== now) {
        /* another lane: the layout switch carries it — its leaving copy is taken where the lifted box is (standIn) */
        card.drag = false;
        setDock(at.dock);
        liftCol(0, 0);
        return;
      }
      /* its own lane, another spot: its rest moves there at once (still held), and the lift — from where it is to
         there — lets go on the driver */
      const fz = card.frozen;
      card.frozen = false;
      layoutLeft();
      card.frozen = fz;
      card.drag = false;
      const x = m.r0.left + m.dx - at.r.x,
        y = m.r0.top + m.dy - at.r.y;
      liftCol(x, y);
      home(x, y);
    }
    /* Esc while moving it: back where it was */
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && d && d.moved) up(true);
    });
    col.addEventListener("pointerdown", down);
    col.addEventListener("pointermove", move);
    col.addEventListener("pointerup", () => up());
    col.addEventListener("pointercancel", () => up(true));
    // the empty space under the text belongs to the editor: a click there puts the cursor at the end
    q(".pwrapT").addEventListener("mousedown", e => {
      if (!(/** @type {HTMLElement} */ (e.target).classList.contains("pwrapT"))) return;
      e.preventDefault();
      P.focus();
      if (window.__cm) {
        const v = window.__cm;
        v.dispatch({ selection: { anchor: v.state.doc.length } });
      }
    });
  })();
  // glass mode floats the controls row over the prompt: the text needs that much room to scroll clear of it
  new ResizeObserver(() => {
    $("left").style.setProperty("--ctrlh", q(".controls", $("left")).offsetHeight + "px");
    layoutLeft();
  }).observe(q("#left .controls"));
}

/* ======================= prompt + chips ======================= */
export function applyPH() {
  delete S.ph;
  layoutLeft();
}
