// @ts-check
/* Kiln · prompt card placement: centring, freeze while working, drag top/middle/bottom */
import { $, q } from "./dom.js";
import { lay, minRight, setDock, sizeFrame, vAlign } from "./layout.js";
import { PWMIN, cardAnchorTop, cardHeightMode, cardPlacement, promptSlotH } from "./layoutmath.js";
import { P, S, save } from "./state.js";
import { moveThumb } from "./tabs.js";

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
  cy: null,
  imgTop: null,
  imgBottom: null,
  drag: false,
};
/** the picture's lines the card lines up with (layoutmath's CardAnchors) */
const anchors = () => ({ it: card.imgTop, ib: card.imgBottom, cy: card.cy });
/* the card's held layout let go: frozen while you work, its top and centre forgotten (also from other files) */
export function lyReset() {
  card.frozen = false;
  card.top = null;
  card.cy = null;
}
export function lyUnfreeze() {
  card.frozen = false;
}
const EDMIN = 108; /* the editor's least height (styles/prompt.css .cm-editor min-height: its header row + a few lines) */
function cardNaturalH() {
  const L = $("left"),
    w = q(".pwrapT", L);
  const sc = L.querySelector(".cm-scroller");
  const edH = (sc ? sc.scrollHeight : P.scrollHeight) + 16;
  return Math.max(170, L.offsetHeight - w.offsetHeight + Math.max(EDMIN, edH));
}
export function applyMode() {
  const a = q(".app"),
    was = a.classList.contains("stacked");
  // switch to narrow below 980 px (or a tall window); back to wide only above 1020 px, so dragging near the edge doesn't flicker
  const narrow =
    was && a.dataset.narrow === "1"
      ? innerWidth < 1020 || innerWidth / innerHeight < 1.2 || innerWidth - 54 < 400 + minRight()
      : innerWidth < 980 || innerWidth / innerHeight < 1.15 || innerWidth - 54 < 360 + minRight();
  a.dataset.narrow = narrow ? "1" : "";
  const st =
    narrow ||
    S.dock === "below"; /* Layout → Vertical stacks on any window; a horizontal dock comes back when there's room */
  a.classList.toggle("pright", S.dock === "right" && !st);
  $("ltitle").dataset.tip = st ? "" : "Drag to move the prompt box: top · middle · bottom";
  if (a.classList.contains("stacked") !== st) {
    a.classList.toggle("stacked", st);
    // switching layouts: place the image first, then the card, without the glide (it would start from stale positions)
    const L = $("left"),
      T = $("ltitle");
    L.classList.add("nodur");
    T.classList.add("nodur");
    lyReset();
    sizeFrame();
    layoutLeft();
    moveThumb(true);
    requestAnimationFrame(() => {
      sizeFrame();
      layoutLeft();
      requestAnimationFrame(() => {
        L.classList.remove("nodur");
        T.classList.remove("nodur");
      });
    });
  }
  updHm();
}
/* Vertical: the prompt box's width — yours (S.lay.sw, set with its side edges), or the picture's (Fit width), never
   narrower than the box's minimum or wider than the window */
export function stackW() {
  const max = innerWidth - 36,
    pic = typeof lay !== "undefined" && lay.target && lay.target.w;
  const w = S.vfit && pic ? pic : (S.lay && S.lay.sw) || 760;
  return Math.round(Math.max(Math.min(PWMIN, max), Math.min(max, w)));
}
function cardMinH() {
  const L = $("left");
  return L.offsetHeight - q(".pwrapT", L).offsetHeight + EDMIN;
}
export function chipsH() {
  const c = $("chips");
  return c.childElementCount ? c.offsetHeight + 10 : 0;
} // the row always shows ("LoRA +") // the chip row under the box, and its gap
export function layoutLeft() {
  if (card.drag) return;
  const L = $("left"),
    col = $("lcol"),
    CH = chipsH();
  const TS = $("peekbar").classList.contains("show") ? 104 : 64;
  /* the Reuse bar takes the row above the box; the name moves up */
  col.style.setProperty("--ts", TS + "px");
  const stk = !!document.querySelector(".app.stacked"),
    hm = !stk && (S.hmode === "full" || S.hmode === "match") ? S.hmode : "";
  /* Vertical has no height modes: they took the picture's room */
  L.classList.toggle("hm", !!hm);
  $("ltitle").classList.toggle("hm", !!hm);
  if (stk) {
    let H;
    card.top = 0;
    /* the prompt's SLOT is fixed: set with the line above the name, or ~4 lines + the pills by default. The box fits its
     text inside it (top-aligned) and the picture's size never depends on what the prompt says — browsing prompts of
     different lengths used to resize and move the picture on every step (2026-10-19) */
    const slot = promptSlotH(S.sch, innerHeight);
    if (lay.vbDrag)
      return; /* its bottom edge is being dragged: the box follows the pointer, the layout settles on release */
    H =
      slot; /* the box fills its slot (2026-10-24): what you see is the room it takes — no dead space under a short prompt */
    col.style.setProperty("--sw", stackW() + "px");
    const lch = slot + TS + 2 + CH + "px",
      chg = col.style.getPropertyValue("--lch") !== lch;
    col.style.setProperty("--lch", lch);
    col.style.setProperty("--ltop", TS + "px");
    requestAnimationFrame(vAlign);
    col.style.setProperty("--lh", H + "px");
    col.style.setProperty("--chtop", TS + H + 10 + "px");
    if (chg) requestAnimationFrame(sizeFrame);
    return;
  }
  const colH = col.clientHeight - TS;
  if (colH <= 0) return;
  const f = $("frame").getBoundingClientRect(),
    c = col.getBoundingClientRect();
  const T =
    typeof lay !== "undefined" &&
    lay.target; /* the picture's target (it may be mid-glide): the prompt moves with it, not after it */
  if (S.view === "gen" && f.height > 0) {
    if (T) {
      card.cy = T.top + T.h / 2 - c.top - TS;
      card.imgTop = T.top - c.top - TS;
      card.imgBottom = T.bottom - c.top - TS;
    } else {
      card.cy = f.top + f.height / 2 - c.top - TS;
      card.imgTop = f.top - c.top - TS;
      const pb = $("prog").getBoundingClientRect();
      card.imgBottom = (pb.height ? pb.bottom : f.bottom) - c.top - TS;
    }
  }
  if (card.cy == null) card.cy = colH / 2;
  if (hm) {
    const { top, H } = cardHeightMode(hm, colH, CH, cardMinH(), { ...anchors(), cy: card.cy });
    card.top = top;
    card.bottom = top + H + CH;
    col.style.setProperty("--ltop", top + TS + "px");
    col.style.setProperty("--lh", H + "px");
    col.style.setProperty("--chtop", top + TS + H + 10 + "px");
    return;
  }
  // the box and its chip row are placed as one group (the text's height is measured only when it's used)
  const { top, H, bottom } = cardPlacement({
    colH,
    CH,
    pph: S.pph,
    naturalH: S.pph ? 0 : cardNaturalH(),
    pos: S.pos || "mid",
    frozen: card.frozen,
    prevTop: card.top,
    prevBottom: card.bottom,
    a: anchors(),
  });
  card.bottom = bottom;
  card.top = top;
  col.style.setProperty("--ltop", top + TS + "px");
  col.style.setProperty("--lh", H + "px");
  col.style.setProperty("--chtop", top + TS + H + 10 + "px");
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
    S.pph = 0;
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
    fit = stk ? !!S.vfit : m === "match";
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
  $("hmFull").dataset.tip = m === "full" ? "Back to normal height" : "Full height";
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
  /* a narrow box: the Reuse bar and the size buttons in one centred row (side by side they collided) */
  new ResizeObserver(() => {
    const T = $("ltitle");
    T.classList.toggle("tnarrow", T.clientWidth < 560);
  }).observe($("ltitle"));
  $("hmodes").addEventListener("click", e => {
    const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest("[data-hm]"));
    if (!b) return;
    if (b.dataset.hm === "match" && document.querySelector(".app.stacked")) S.vfit = !S.vfit;
    else S.hmode = S.hmode === b.dataset.hm ? "" : /** @type {"full" | "match"} */ (b.dataset.hm);
    save();
    updHm();
    card.frozen = false;
    layoutLeft();
  });
  updHm();
  (function () {
    const L = $("left"),
      T = $("ltitle"),
      col = $("lcol");
    /** the card being pressed / dragged: where it started, whether it moved, where it would go
     * @type {{ x0: number, y0: number, t0: number, moved: boolean, stk: boolean, zone?: "left" | "right" | "below" | null, t?: number } | null} */
    let d = null;
    const NO = "input,textarea,button,a,select,.chip,.pwrapT,.vedge,.pedge,.pop,.cwi";
    const ghosts = ["top", "mid", "bot"].map(p => {
      const g = document.createElement("div");
      g.className = "ghost";
      g.dataset.p = p;
      col.appendChild(g);
      return g;
    });
    const geo = () => {
      const TS = parseFloat(col.style.getPropertyValue("--ts")) || 64;
      return { TS, colH: col.clientHeight - TS, H: L.offsetHeight };
    };
    /** the resting place nearest to a top t @param {number} t @param {number} H @param {number} colH
     * @returns {"top" | "mid" | "bot"} */
    const nearest = (t, H, colH) =>
      /** @type {const} */ (["top", "mid", "bot"])
        .map(p => /** @type {const} */ ([p, Math.abs(cardAnchorTop(p, H, colH, anchors()) - t)]))
        .sort((a, b) => a[1] - b[1])[0][0];
    /* dock zones: drag the prompt far to the other side, or to the bottom, and drop it there */
    const zones = ["left", "right", "below"].map(z => {
      const g = document.createElement("div");
      g.className = "dockzone dz-" + z;
      g.dataset.z = z;
      g.innerHTML = `<span>${{ left: "Prompt on the left", right: "Prompt on the right", below: "Prompt below the picture" }[z]}</span>`;
      document.body.appendChild(g);
      return g;
    });
    const dockOf = () => S.dock || "left";
    /* "below" needs the pointer well past the lowest place the card can go (yMax): moving the card to its bottom position
    never docks it by accident — the card stops, the pointer goes on, the zone lights up */
    /** @param {number} x @param {number} y @param {number} yMax */
    function zoneAt(x, y, yMax) {
      const W = innerWidth,
        Hh = innerHeight,
        cur = document.querySelector(".app.stacked") ? "below" : dockOf();
      /** @type {"left" | "right" | "below" | null} */
      let z = null;
      if (y > Math.max(Hh * 0.75, yMax + 80) && cur !== "below") z = "below";
      else if (x < W * 0.3 && cur !== "left") z = "left";
      else if (x > W * 0.7 && cur !== "right") z = "right";
      return z;
    }
    /** @param {PointerEvent} e */
    function down(e) {
      if (S.hmode || e.button !== 0 || /** @type {HTMLElement} */ (e.target).closest(NO)) return;
      e.preventDefault();
      d = {
        x0: e.clientX,
        y0: e.clientY,
        t0: card.top || 0,
        moved: false,
        stk: !!document.querySelector(".app.stacked"),
      };
      try {
        /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
      } catch (_) {}
      hint(true);
    }
    /* the press shows what moves: an outline round the whole block (title, box, LoRAs), like the resize outline */
    const ch = $("cardhint");
    let hraf = 0;
    /** @param {boolean} on */
    function hint(on) {
      cancelAnimationFrame(hraf);
      if (!on) {
        ch.classList.remove("show");
        return;
      }
      (function tick() {
        const rs = [$("ltitle"), L, $("chips")].map(x => x.getBoundingClientRect()).filter(r => r.width && r.height),
          O = 12;
        const l = Math.min(...rs.map(r => r.left)),
          t = Math.min(...rs.map(r => r.top)),
          r = Math.max(...rs.map(r => r.right)),
          b = Math.max(...rs.map(r => r.bottom));
        Object.assign(ch.style, {
          left: l - O + "px",
          top: t - O + "px",
          width: r - l + 2 * O + "px",
          height: b - t + 2 * O + "px",
        });
        ch.classList.add("show");
        hraf = requestAnimationFrame(tick);
      })();
    }
    /** @param {PointerEvent} e */
    function move(e) {
      const m = d;
      if (!m) return;
      if (!(e.buttons & 1)) {
        up();
        return;
      }
      const dx = e.clientX - m.x0,
        dy = e.clientY - m.y0;
      if (!m.moved && Math.hypot(dx, dy) < 6) return;
      const { TS, colH, H } = geo();
      if (!m.moved) {
        m.moved = true;
        card.drag = true;
        L.classList.add("nodur");
        T.classList.add("nodur");
        document.body.classList.add("cardmove");
        zones.forEach(z => z.classList.toggle("show", z.dataset.z !== (m.stk ? "below" : dockOf())));
        if (!m.stk)
          ghosts.forEach(g => {
            g.style.top = cardAnchorTop(/** @type {string} */ (g.dataset.p), H, colH, anchors()) + TS + "px";
            g.style.height = H + "px";
            g.classList.add("show");
          });
      }
      m.zone = zoneAt(e.clientX, e.clientY, m.stk ? 0 : m.y0 + (colH - H - chipsH() - m.t0));
      zones.forEach(z => z.classList.toggle("near", z.dataset.z === m.zone));
      if (m.stk) return;
      const t = Math.max(0, Math.min(colH - H - chipsH(), m.t0 + dy));
      col.style.setProperty("--ltop", t + TS + "px");
      col.style.setProperty("--chtop", t + TS + H + 10 + "px");
      m.t = t;
      const n = nearest(t, H, colH);
      ghosts.forEach(g => g.classList.toggle("near", !m.zone && g.dataset.p === n));
    }
    function up() {
      if (!d) return;
      const was = d;
      d = null;
      hint(false);
      if (!was.moved) return;
      card.drag = false;
      L.classList.remove("nodur");
      T.classList.remove("nodur");
      document.body.classList.remove("cardmove");
      ghosts.forEach(g => g.classList.remove("show", "near"));
      zones.forEach(z => z.classList.remove("show", "near"));
      if (was.zone) {
        setDock(was.zone);
        return;
      }
      if (was.stk) return;
      const { colH, H } = geo();
      S.pos = nearest(/** @type {number} */ (was.t), H, colH); // set by every move once it moved
      save();
      const fz = card.frozen;
      card.frozen = false;
      layoutLeft();
      card.frozen = fz;
    }
    for (const el of [L, T]) {
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    }
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
