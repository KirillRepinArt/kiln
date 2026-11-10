// @ts-check
/* Kiln · THE drag gesture (G1 — ARCHITECTURE › every drag; DD-2026-11-11-1). Every drag in the page is one gesture:
   press → (past its threshold) a drag → end, and it ends exactly once however it ends — the button up, a cancel, the
   pointer's capture lost (a reload, another window taking it), the button found up on a move, Esc where the drag allows
   it. A press that never passes the threshold is a TAP (its end says moved: false) and the click that follows it is the
   page's as usual; the click that follows a real drag is swallowed (it isn't a click on what was under it). The
   pointer is captured when the press becomes a drag (not on the press: a tap stays a click on what it pressed). Named
   exception: the LoRA chips' reorder is the browser's native drag-and-drop (its own drag image) */

/** how far the pointer goes before a press is a drag — one table: a lift (the box, a Queue row) waits longer than a
 * scrub (a LoRA weight) or a pan (the viewer); an edge starts at once */
export const DRAG_START = /** @type {const} */ ({ edge: 0, lift: 6, scrub: 3, pan: 4 });

/**
 * @template C
 * @typedef {object} GestureOptions
 * @property {(e: PointerEvent) => C | false | null | undefined} accept the press: its context, or not this drag's
 * @property {number} [threshold] px before it's a drag (DRAG_START)
 * @property {(c: C, e: PointerEvent) => void} [start] it became a drag (the pointer is captured now)
 * @property {(c: C, e: PointerEvent, dx: number, dy: number) => void} move a move while it's a drag
 * @property {(c: C, how: { moved: boolean, cancelled: boolean }) => void} [end] once per accepted press, however it
 *   ends (moved: false — a tap)
 * @property {string[]} [cls] the body classes it holds while it's a drag
 * @property {boolean} [escape] Esc cancels it (the drag puts back what it moved)
 * @property {boolean} [prevent] the press's default is prevented (no text selection under the drag)
 */

/**
 * @template C
 * @param {HTMLElement} el where the press is heard (a handle, or a container delegating to its parts through `accept`)
 * @param {GestureOptions<C>} o
 */
export function gesture(el, o) {
  const T = o.threshold ?? 0;
  /** the press now @type {{ c: C, pid: number, x0: number, y0: number, moved: boolean } | null} */
  let p = null;
  /** @param {boolean} cancelled */
  const finish = cancelled => {
    const m = p;
    if (!m) return;
    p = null;
    listen(false);
    try {
      if (el.hasPointerCapture(m.pid)) el.releasePointerCapture(m.pid);
    } catch (_) {}
    if (m.moved) {
      if (o.cls) document.body.classList.remove(...o.cls);
      swallowNextClick = true; // the click that follows a drag isn't a click on what was under it
      setTimeout(() => (swallowNextClick = false), 0);
    }
    if (o.end) o.end(m.c, { moved: m.moved, cancelled });
  };
  /** @param {PointerEvent} e */
  const begin = e => {
    const m = /** @type {NonNullable<typeof p>} */ (p);
    m.moved = true;
    try {
      el.setPointerCapture(m.pid);
    } catch (_) {}
    if (o.cls) document.body.classList.add(...o.cls);
    if (o.start) o.start(m.c, e);
  };
  /* while a press lasts its pointer is heard on the window (filtered to it): before it's a drag the pointer isn't
     captured — a container that lets the pointer through its empty parts (the prompt column) never hears the moves
     that should start it */
  /** @param {PointerEvent} e */
  const onMove = e => {
    const m = p;
    if (!m || e.pointerId !== m.pid) return;
    if (!(e.buttons & 1)) return finish(false); // the button came up where we didn't hear it
    const dx = e.clientX - m.x0,
      dy = e.clientY - m.y0;
    if (!m.moved) {
      if (Math.hypot(dx, dy) < T) return;
      begin(e);
    }
    o.move(m.c, e, dx, dy);
  };
  /** @param {PointerEvent} e */
  const onUp = e => {
    if (p && e.pointerId === p.pid) finish(false);
  };
  /** @param {PointerEvent} e */
  const onCancel = e => {
    if (p && e.pointerId === p.pid) finish(true);
  };
  const listen = (/** @type {boolean} */ on) => {
    const f = on ? addEventListener : removeEventListener;
    f("pointermove", /** @type {EventListener} */ (onMove), true);
    f("pointerup", /** @type {EventListener} */ (onUp), true);
    f("pointercancel", /** @type {EventListener} */ (onCancel), true);
  };
  el.addEventListener("pointerdown", e => {
    if (e.button !== 0 || p) return;
    const c = o.accept(e);
    if (c === false || c == null) return;
    if (o.prevent) e.preventDefault();
    p = { c, pid: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
    listen(true);
    if (T === 0) begin(e);
  });
  el.addEventListener("lostpointercapture", e => {
    if (p && p.moved && e.pointerId === p.pid) finish(false);
  });
  if (o.escape)
    document.addEventListener(
      "keydown",
      e => {
        if (e.key !== "Escape" || !p || !p.moved) return;
        e.stopImmediatePropagation(); // Esc is the drag's now (not the page's: a selection's clear, a dialog's close)
        e.preventDefault();
        finish(true);
      },
      true,
    );
}
/* the click a drag's release makes, swallowed once (capture phase, before anything hears it) */
let swallowNextClick = false;
addEventListener(
  "click",
  e => {
    if (!swallowNextClick) return;
    swallowNextClick = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  },
  true,
);
