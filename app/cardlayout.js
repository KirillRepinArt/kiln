// @ts-check
/* Kiln · the prompt box's layout: its least height and width, its place from the layout pass (one writer of its top,
   height and Vertical width), the hold while you work in it, and moving it (the drop map) */
import { $, q } from "./dom.js";
import { HANDLES, outlines } from "./outlines.js";
import {
  dockNow,
  lay,
  layDef,
  liftCol,
  liftToken,
  minRight,
  paneSize,
  placeFor,
  setDock,
  sideBoxPass,
  sizeFrame,
  vAlign,
  vPass,
} from "./layout.js";
import { PWMIN, dropAt, dropTiles } from "./layoutmath.js";
import { peekJob } from "./prompt.js";
import { P, S, save } from "./state.js";
import { moveThumb } from "./tabs.js";
import { SPACE, tok } from "./tokens.js";
import { boxSizing } from "./editor.js";
import { DRAG_START, gesture as drag } from "./gesture.js";
import { rearrange, stop, travelling } from "./rearrange.js";

/* ======================= prompt card layout =======================
   Side by side it rests at its anchor (S.pos: top / middle / bottom — layoutmath.js cardPlacement). While the editor
   is focused or the pointer is over it, it is FROZEN: its top holds (its bottom, resting at the bottom) and it grows
   away from it, then scrolls — nothing moves under the cursor. 0.5 s after the pointer leaves (and the editor isn't
   focused) it goes back to its anchor */
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
   metrics. The editor's CSS takes what the box gives it and scrolls */
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
/** the box's least width — ARCHITECTURE › the prompt box's least width: what its bottom row needs (Start and the
 * pills at their compact labels — the container queries' short forms — its insets and gaps), never under PWMIN */
export function boxWLeast() {
  const c = /** @type {HTMLElement | null} */ (document.querySelector("#left .controls")),
    play = $("play");
  if (!c || !play.offsetWidth) return PWMIN;
  /* exact widths: offsetWidth rounds each part down (2 px short over five pills) */
  const wOf = (/** @type {Element} */ e) => e.getBoundingClientRect().width,
    cs = getComputedStyle(c),
    pills = /** @type {HTMLElement[]} */ ([...c.querySelectorAll(".pills > .pill")]).filter(p => p.offsetWidth),
    pg = parseFloat(getComputedStyle(/** @type {Element} */ (c.querySelector(".pills"))).columnGap) || 0;
  /* the box's own frame around the row (its border, any inset) + the row's insets + Start + the gap to it */
  let need =
    wOf($("left")) -
    wOf(c) +
    parseFloat(cs.paddingLeft) +
    parseFloat(cs.paddingRight) +
    wOf(play) +
    (parseFloat(cs.columnGap) || 0);
  for (const p of pills) {
    let w = wOf(p);
    /* the parts the narrow box drops (controls.css's container queries), shown now: not counted */
    for (const x of /** @type {NodeListOf<HTMLElement>} */ (p.querySelectorAll(".w, .il")))
      if (x.offsetWidth) w -= wOf(x) + (parseFloat(getComputedStyle(x).marginRight) || 0);
    need += w;
  }
  need += pg * Math.max(0, pills.length - 1);
  return Math.max(PWMIN, Math.ceil(need));
}
let draftH = 0; // the height your draft's text needs (kept while a job's prompt is shown: it never resizes the box)
/** Vertical: the box's text height — your draft's: a job's prompt shown in it never resizes it (it scrolls inside), so
 * browsing prompts of different lengths never moves anything. The layout pass's input */
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
  $("ltitle").dataset.tip = "Drag to move the prompt box: drop it on a place on the map";
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
/* Vertical: the prompt box's width — yours (paneSize("box", "vert"), set with its side edges through the layout pass),
   or a mode's (Match: the picture's, Full: the window's), never narrower than the box's least or wider than the window.
   The layout pass asks it; its one writer is swAt (--sw), from the pass */
export function stackW() {
  const max = innerWidth - 2 * SPACE.area,
    pic = typeof lay !== "undefined" && lay.target && lay.target.w;
  /* the modes act on the box's CROSS axis (DEVLOG DD-2026-11-02-16): in Vertical its width — Match: the picture's, Full:
     the window's (less its edge gaps); side by side its height (layoutLeft) */
  const m = S.hmode,
    w = m === "full" ? max : m === "match" && pic ? pic : paneSize("box", "vert").w || 760;
  return Math.round(Math.max(Math.min(boxWLeast(), max), Math.min(max, w)));
}
export function chipsH() {
  const c = $("chips");
  return c.childElementCount ? c.offsetHeight + SPACE.tight : 0;
} // the chip row under the box, and its gap (the row always shows: "LoRA +")
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
    /* the box is placed by the layout pass, under the page's pane — ARCHITECTURE › the single layout pass: the pane
       first, the box its text's height in the free room under it, then it scrolls. Its top is the pass's, in the
       column's px (its layout box, without a transform); its width and height too — held, an edge's */
    const was = lay.passV,
      p = vPass(),
      colTop = /** @type {HTMLElement} */ (col.offsetParent).getBoundingClientRect().top + col.offsetTop;
    swAt(col, Math.round(p.box.w));
    requestAnimationFrame(vAlign);
    boxAt(col, Math.round(p.box.y - colTop), Math.round(p.box.h));
    /* the pane changed under it (a size of yours, Reset, a new limit): its owner lays the page out in this task — on the
       rearrangement's plan, one motion with the box riding its plate (B16) */
    if (!was || Math.abs(was.page.h - p.page.h) > 0.5 || Math.abs(was.page.w - p.page.w) > 0.5) sizeFrame();
    return;
  }
  if (col.clientHeight - TS <= 0) return;
  /* side by side the box's place beside its pane is the layout pass's — ONE rule (cardPlacement, its modes
     cardHeightMode), called by the pass with the column and the moment's state */
  const p = sideBoxPass(),
    c0 = /** @type {HTMLElement} */ (col.offsetParent).getBoundingClientRect().top + col.offsetTop;
  card.top = p.box.y - c0 - TS;
  card.bottom = card.top + p.box.h + CH;
  boxAt(col, p.box.y - c0, p.box.h);
}
/** Vertical: the box's width (--sw) — ONE writer, this. A change the system makes (a double-click, Reset, a new limit)
 * moves on the rearrangement's plan and clock with the page it sits under; your hand (a drag, typing) at once; in a
 * switch (the plate travelling) it is at its end shape from the first frame and its relation change carries it (DD-4:
 * a late settle of --sw slid the centred box off its relation) @param {HTMLElement} col @param {number} w */
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
/** where the layout wants the box: a change the system makes moves it on the rearrangement — ARCHITECTURE › a
 * rearrangement on the same page (side by side on the picture's progress; in Vertical its top rides its pane's plate,
 * only its height on the plan). At once: the first time, under your hand, and in Vertical during a switch (DD-4, as its
 * width) @param {HTMLElement} col @param {number} top @param {number} H */
function boxAt(col, top, H) {
  const to = { l: 0, t: top, w: 0, h: H },
    vert = !!document.querySelector(".app.stacked");
  /* at once: the first time, under a drag or typing (the hand is the clock: animated, the box lagged its text —
     DD-2026-11-09-2) */
  if (!boxNow || card.drag || layDirect || (vert && travelling())) {
    stop("box");
    boxWrite(col, to);
  } else {
    /* the box is changing from the moment it's asked to (its move may wait for the plan's reveal): the editor's thumb
       waits from now — told at the first write, it showed for the frames before it (B21) */
    if (to.t !== boxNow.t || to.h !== boxNow.h) boxSizing();
    /* Vertical: the top is the plate's to carry — it starts at its goal, the plan moves the height */
    rearrange("box", vert ? { ...boxNow, t: to.t } : boxNow, to, b => boxWrite(col, b), vert ? undefined : "frame");
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
    /* MOVING A PANE — the drop map: ARCHITECTURE › the prompt column's place (the model: ux-review/18-box-placement.md,
       sketch E). Carried, the box shrinks to a token under your hand and a map of where it can go shows behind it; the
       tile under the pointer is the target. Let go there: its own lane, another spot — it moves there; another lane — a
       layout switch by your hand, travelling on from where you let it go; nowhere, or Esc — home */
    /** @typedef {import("./layoutmath.js").DropTile} Tile @typedef {import("./layoutmath.js").DropLane} Lane */
    /** the lift: where the box was, the point of it you grabbed, how far it's been carried, its scale (the token), the
     * map, the target @typedef {{ dx: number, dy: number, r0: DOMRect, gx: number, gy: number, s: number, tiles: Tile[],
     * lanes: Lane[], at: Tile | null }} Lift */
    /* the grip is ONE zone: the box's name row, the box, its LoRA row — through one listener on the column; what keeps
       its pointer: text, controls, chips, menus, the edges you drag */
    const NO = "input,textarea,button,a,select,.chip,.pwrapT,.pop,.cwi," + HANDLES,
      GROUP = "#pgrip,#left,#ltitle,#chips",
      app = /** @type {HTMLElement} */ (document.querySelector(".app")),
      map = document.createElement("div");
    map.className = "dropmap";
    app.appendChild(map);
    const put = (/** @type {HTMLElement} */ e, /** @type {import("./layoutmath.js").Rect} */ r) => {
      e.style.left = r.x + "px";
      e.style.top = r.y + "px";
      e.style.width = r.w + "px";
      e.style.height = r.h + "px";
    };
    /** the lift as it's seen: carried by dx / dy, the grabbed point kept under the hand while the box is a token (it
     * scales about its top-left corner) @param {Lift} m */
    const seenLift = m => ({ x: m.dx + (1 - m.s) * m.gx, y: m.dy + (1 - m.s) * m.gy });
    /** let the lift go on the driver: from where it is seen to (0, 0), the token back to the box's size — one plan
     * @param {Lift} m @param {number} x @param {number} y */
    const home = (m, x, y) => {
      rearrange("lift", { l: x, t: y, w: 0, h: 0 }, { l: 0, t: 0, w: 0, h: 0 }, b => liftCol(b.l, b.t));
      rearrange("liftScale", { l: m.s, t: 0, w: 0, h: 0 }, { l: 1, t: 0, w: 0, h: 0 }, b => liftToken(b.l));
    };
    /* the press is the box's grip (GROUP less NO); past DRAG_START.lift it lifts — ONE gesture (gesture.js) */
    drag(col, {
      threshold: DRAG_START.lift,
      prevent: true,
      escape: true,
      cls: ["cardmove"],
      accept: e => {
        const tg = /** @type {HTMLElement} */ (e.target);
        /* the grip works in every mode: a mode fixes the box's height; moving it is still yours */
        if (!tg.closest(GROUP) || tg.closest(NO)) return false;
        outlines("move", ["box"]); // the press shows what moves: the box's own outline (outlines.js; drawn by the box)
        const r0 = L.getBoundingClientRect();
        return /** @type {Lift} */ ({
          dx: 0,
          dy: 0,
          r0,
          gx: e.clientX - r0.left,
          gy: e.clientY - r0.top,
          s: 1,
          tiles: [],
          lanes: [],
          at: null,
        });
      },
      start: m => {
        card.drag = true;
        const p = $("plate").getBoundingClientRect(),
          d = dropTiles(
            { x: p.left, y: p.top, w: p.width, h: p.height },
            { w: innerWidth, h: innerHeight },
            {
              paneW: paneSize("box", "side").w ?? layDef().pw, // the width it lands at beside its partner
              area: SPACE.area,
              part: SPACE.part,
              cover: tok("--drop-cover", 0.25),
              roomMin: tok("--drop-room-min", 160),
              hitMin: tok("--drop-hit-min", 96),
            },
          );
        m.tiles = d.tiles;
        m.lanes = d.lanes;
        const now = dockNow(),
          pos = S.pos || "mid";
        map.replaceChildren(
          ...d.tiles.map(t => {
            const e = document.createElement("div"),
              lane = d.lanes.find(l => l.dock === t.dock);
            e.className = "droptile";
            e.dataset.dock = t.dock;
            e.dataset.pos = t.pos;
            if (lane && lane.over) e.classList.add("over"); // over the picture: there was no room beside it
            if (t.dock === now && (now === "below" || t.pos === pos)) e.classList.add("here"); // where it is now
            put(e, t.r); // window px: the map is drawn in the space it's computed in (overlays.css .dropmap)
            return e;
          }),
        );
        map.classList.add("show");
        m.s = tok("--drop-token", 0.35);
        liftToken(m.s);
      },
      move: (m, e, dx, dy) => {
        m.dx = dx;
        m.dy = dy;
        const v = seenLift(m);
        liftCol(v.x, v.y); // the token follows the pointer
        m.at = dropAt(m.tiles, m.lanes, e.clientX, e.clientY);
        const at = m.at;
        for (const el of /** @type {HTMLElement[]} */ ([...map.children]))
          el.classList.toggle("hot", !!at && el.dataset.dock === at.dock && el.dataset.pos === at.pos);
      },
      end: (m, { moved, cancelled }) => {
        outlines("move", []);
        if (!moved) return;
        map.classList.remove("show");
        const at = cancelled ? null : m.at,
          now = dockNow(),
          v = seenLift(m);
        if (!at || (at.dock === now && (now === "below" || at.pos === (S.pos || "mid")))) {
          card.drag = false;
          home(m, v.x, v.y);
          return;
        }
        S.pos = at.pos;
        save();
        if (at.dock !== now) {
          /* another lane: the layout switch carries it — by your hand, so it travels on from where you let it go (its
             token growing back on the way: tabs.js tabGo) */
          card.drag = false;
          setDock(at.dock, "hand");
          return;
        }
        /* its own lane, another spot: its rest moves there at once, and the lift — from where it is seen to there —
           lets go on the driver */
        const land = placeFor(at.dock, at.pos),
          x = m.r0.left + v.x - land.x,
          y = m.r0.top + v.y - land.y,
          fz = card.frozen;
        card.frozen = false;
        layoutLeft();
        card.frozen = fz;
        card.drag = false;
        liftCol(x, y);
        home(m, x, y);
      },
    });
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
