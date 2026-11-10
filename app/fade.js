// @ts-check
/* Kiln · fading what holds GLASS (DD-2026-11-08-8). An element whose opacity is below 1 becomes a "backdrop root" (CSS
   Filter Effects 2): the glass inside it can only blur what is inside it — nothing — so it shows as a flat tint, and
   its blur snaps back the frame the fade reaches 1. The platforms' rule: never fade glass through an ancestor (UIKit's
   UIVisualEffectView: no alpha below 1 on the view or its superviews — animate the effect itself).
   So a group is faded by its parts: a glass layer by its own opacity (on itself, or on its ::before), a part with no
   glass in it as a whole, and nothing that holds glass. Which parts are glass is read from their computed styles —
   glass.css stays the one home of the look. For a SURFACE whose material must animate itself (the prompt box, the
   status row, the edit buttons): a small group that exists for the whole fade. Never a page: a page is content and
   fades as one layer (a list of parts is a snapshot — content drawn after the fade began escapes it, DD-2026-11-08-12) */

/** @typedef {{ el: Element, pseudo?: "::before", o: number }} FadePart a part to fade, and its own opacity at rest */

/* every fade made here is named, so a reader (the ownership tracer, a test) can tell a fade by parts from another
   owner's animation */
export const FADE_ID = "glassFade";
/** @param {Element} e @param {string | null} [p] */
const glassy = (e, p = null) => {
  const c = getComputedStyle(e, p);
  /* a pseudo-element counts only when it's drawn: a hidden one still reports its backdrop-filter (Start keeps its glass on
     itself while it has something to queue, its ::before hidden) */
  if (p && (c.display === "none" || c.content === "none")) return false;
  return c.backdropFilter !== "none" && c.backdropFilter !== "";
};

/** drawn now: laid out, and neither hidden nor fully transparent (a closed menu keeps its box, hidden by its visibility
 * and opacity) @param {Element} x */
const drawn = x => {
  if (!x.getClientRects().length) return false;
  const c = getComputedStyle(x);
  return c.visibility !== "hidden" && +c.opacity > 0;
};

/** the parts of `root` to fade one by one (none of them holds glass under a fade). The root is the caller's: never
 * skipped, its keyframes as given (o 1) — it may be at 0 or hidden right now because it is about to fade in. Its
 * descendants carry their own resting opacity (a hidden one at 0, or not displayed, is skipped: nothing to fade)
 * @param {Element} root @returns {FadePart[]} */
export function fadeParts(root) {
  /** @type {FadePart[]} */
  const out = [];
  /** @param {Element} e @param {boolean} top */
  const walk = (e, top) => {
    const c = getComputedStyle(e);
    if (c.display === "none" || (!top && +c.opacity === 0)) return; // not seen: nothing to fade
    const o = top ? 1 : +c.opacity,
      /* only glass that is drawn: a pill's closed menu is glass, and counted it made the walk step inside the pill — its
         fill (::before) was never faded */
      holds = [...e.querySelectorAll("*")].some(x => drawn(x) && (glassy(x) || glassy(x, "::before")));
    if (glassy(e) || (!holds && !glassy(e, "::before"))) {
      out.push({ el: e, o }); // glass on itself, or no glass in it: fades as a whole
      return;
    }
    if (glassy(e, "::before")) out.push({ el: e, pseudo: "::before", o: +getComputedStyle(e, "::before").opacity });
    for (const k of e.children) walk(k, false);
  };
  walk(root, true);
  return out;
}

/** fade `root` by its parts: each part's opacity runs through `keys` (the root's, as given), a descendant's scaled by
 * its own opacity at rest
 * @param {Element} root @param {{ offset: number, opacity: number }[]} keys @param {KeyframeAnimationOptions} timing
 * @returns {Animation[]} */
export function glassFade(root, keys, timing) {
  return fadeParts(root).map(p => {
    const a = p.el.animate(
      keys.map(k => ({ offset: k.offset, opacity: k.opacity * p.o })),
      p.pseudo ? { ...timing, pseudoElement: p.pseudo } : timing,
    );
    a.id = FADE_ID;
    /** @type {Animation & { fadeRoot?: Element }} */ (a).fadeRoot = root; // the group it fades (the tracer reads it)
    /** @type {Animation & { restO?: number }} */ (a).restO = p.o; // its own opacity at rest (fade() reads its value by it)
    return a;
  });
}

/* ---------- THE way to fade (R1 — ARCHITECTURE › every opacity fade; DD-2026-11-10-11) ----------
   Every fade starts from what is ON SCREEN: a fade that replaces a running one carries on from that one's value now
   (never restarted from 1 or 0: an interrupted switch cut its pages, F4); a fresh fade starts from the caller's `from`
   (new content not seen yet: 0) or the element's opacity now. It replaces the running fade it read (one fade per
   element and pseudo-element at a time) */
/** @typedef {{ anims: Animation[], read: () => number }} Running */
/** the fade running on each element (per pseudo-element) @type {WeakMap<Element, Map<string, Running>>} */
const running = new WeakMap();
/** what of `el` is seen now: its opacity (a running animation's value included), 0 when hidden
 * @param {Element} el @param {string | null} [pseudo] */
export function seenNow(el, pseudo = null) {
  const c = getComputedStyle(el, pseudo);
  return c.visibility === "hidden" || c.display === "none" ? 0 : +c.opacity;
}
/** a fade still in progress (waiting for its delay counts: it holds its start) @param {Animation} a */
const live = a => a.playState === "running" || a.playState === "paused" || a.pending;
/** set `el`'s opacity at once (a held copy shown, a reset) — replacing any fade of it: the same one writer
 * @param {HTMLElement} el @param {string} v the inline value ("" — its CSS) */
export function setOpacity(el, v) {
  const r = running.get(el)?.get("");
  if (r) for (const a of r.anims) a.cancel();
  el.style.opacity = v;
}
/** the value a running fade() of `el` shows now — else its opacity now @param {Element} el */
export function fadeValue(el) {
  const r = running.get(el)?.get("");
  return r && r.anims.some(live) ? r.read() : seenNow(el);
}
/** fade `el` to `to` over the part [a, b] of `timing`'s duration (before a: where it starts; after b: `to`)
 * @param {Element} el @param {number} to @param {KeyframeAnimationOptions} timing
 * @param {{ from?: number, span?: [number, number], glass?: boolean, pseudo?: "::before" | "::after", end?: string }} [o] `from`:
 *   where a FRESH fade starts (default: its opacity now); `glass`: by its parts (glassFade — it holds glass)
 * @returns {Animation[]} */
export function fade(el, to, timing, o = {}) {
  const pk = o.pseudo || "",
    m = running.get(el) || /** @type {Map<string, Running>} */ (new Map()),
    rec0 = m.get(pk),
    /* in progress — not finished (over: a fresh fade), not cancelled (its cancel event comes later: one its owner
       cancelled a moment ago is idle already) */
    was = rec0 && rec0.anims.some(live) ? rec0 : null,
    from = was ? was.read() : (o.from ?? seenNow(el, o.pseudo)); // read before it's replaced
  running.set(el, m);
  if (was) for (const a of was.anims) a.cancel();
  const [s, e] = o.span || [0, 1],
    keys = [{ offset: 0, opacity: from }];
  if (s > 0) keys.push({ offset: s, opacity: from });
  keys.push({ offset: e, opacity: to });
  if (e < 1) keys.push({ offset: 1, opacity: to });
  /** @type {Animation[]} */
  let anims;
  /** @type {() => number} */
  let read;
  if (o.glass) {
    anims = glassFade(el, keys, timing);
    read = () => {
      const a = /** @type {Animation & { restO?: number }} */ (anims[0]);
      if (!a || !a.effect) return to;
      const fx = /** @type {KeyframeEffect} */ (a.effect);
      return seenNow(/** @type {Element} */ (fx.target), fx.pseudoElement) / (a.restO || 1);
    };
  } else {
    anims = [el.animate(keys, o.pseudo ? { ...timing, pseudoElement: o.pseudo } : timing)];
    read = () => seenNow(el, o.pseudo);
  }
  const rec = { anims, read };
  m.set(pk, rec);
  /* `end`: once it has run, the value it leaves on the element itself (inline) — the fade retires (one writer: here) */
  if (o.end != null && !o.glass && !o.pseudo) {
    const a = anims[0],
      end = o.end,
      h = /** @type {HTMLElement} */ (el);
    a.addEventListener("finish", () => {
      if (m.get(pk) !== rec) return;
      h.style.opacity = end;
      a.cancel();
    });
  }
  for (const a of anims)
    a.addEventListener("cancel", () => {
      if (m.get(pk) === rec) m.delete(pk);
    });
  return anims;
}
