// @ts-check
/* Kiln · the page's elements by id. Its own file, importing nothing: modules that use $ while they load can never
   meet it unready (a module in an import circle may run before its partners) */
/* typed as always found: the ids are fixed in index.html (code that may run before its element exists checks itself) */
/** @param {string} id @returns {HTMLElement} */
export const $ = id => /** @type {HTMLElement} */ (document.getElementById(id));
/* the same for a selector: an element the page always has (inside `root`, the page by default) */
/** @param {string} sel @param {ParentNode} [root] @returns {HTMLElement} */
export const q = (sel, root = document) => /** @type {HTMLElement} */ (root.querySelector(sel));
/* the element an event happened on (click, key, pointer — Kiln listens on elements, so it is one) */
/** @param {Event} e @returns {HTMLElement} */
export const target = e => /** @type {HTMLElement} */ (e.target);
/* every match of a selector (inside `root`, the page by default), as a list of the page's elements */
/** @param {string} sel @param {ParentNode} [root] @returns {HTMLElement[]} */
export const qa = (sel, root = document) => /** @type {HTMLElement[]} */ ([...root.querySelectorAll(sel)]);
/* the element matching `sel` that an event hit — its target or the nearest one round it (null: none) */
/** @param {Event} e @param {string} sel @returns {HTMLElement | null} */
export const hit = (e, sel) => /** @type {HTMLElement | null} */ (target(e).closest(sel));
/* a form field by id — an <input>, <textarea> or <select> (index.html): its value, read-only state, placeholder … */
/** @param {string} id @returns {HTMLInputElement} */
export const field = id => /** @type {HTMLInputElement} */ (document.getElementById(id));
/* the form field an event happened on (an input / change event of a field) */
/** @param {Event} e @returns {HTMLInputElement} */
export const targetField = e => /** @type {HTMLInputElement} */ (e.target);
/** el's layout offset inside an ancestor (offsetLeft / offsetTop: layout, not transforms — a switch's glide or the
 * "done" pulse don't shift it; nor does el's own CSS transform), from `to`'s padding edge. offsetLeft counts from its
 * offset parent's PADDING edge, so each parent's border on the way is added (clientLeft / clientTop — a 1 px border put
 * the plate's switch goal 1 px off) @param {HTMLElement} el @param {HTMLElement | null} to null: the page
 * @returns {{ x: number, y: number }} */
export function offsetIn(el, to) {
  let x = 0,
    y = 0;
  for (
    let e = /** @type {HTMLElement | null} */ (el);
    e && e !== to;
    e = /** @type {HTMLElement | null} */ (e.offsetParent)
  ) {
    x += e.offsetLeft;
    y += e.offsetTop;
    const p = /** @type {HTMLElement | null} */ (e.offsetParent);
    if (p && p !== to) {
      x += p.clientLeft;
      y += p.clientTop;
    }
  }
  return { x, y };
}
/** the scale every CSS transform on el and its ancestors puts on it (a carried box's token, a scaled view) — 1, 1 when
 *  nothing scales it @param {Element} el @returns {{ x: number, y: number }} */
export function scaleOf(el) {
  let x = 1,
    y = 1;
  for (let e = /** @type {Element | null} */ (el); e; e = e.parentElement) {
    const t = getComputedStyle(e).transform;
    if (!t || t === "none") continue;
    const m = new DOMMatrixReadOnly(t);
    x *= Math.hypot(m.a, m.b);
    y *= Math.hypot(m.c, m.d);
  }
  return { x, y };
}
/** el's box as LAID OUT, in the window's px: where the layout put it (the offset chain — no transform moves it) and its
 *  size with every scale divided out (sub-pixel exact, unlike offsetWidth). The one way the layout measures — never
 *  getBoundingClientRect, which is the box as SEEN through a glue, a ride or a carry (ARCHITECTURE › layout inputs)
 *  @param {HTMLElement} el */
export function layoutRect(el) {
  const p = offsetIn(el, null),
    { width, height } = layoutSize(el);
  return { left: p.x, top: p.y, width, height, right: p.x + width, bottom: p.y + height };
}
/** el's border box as laid out: its computed size (exact, and no transform touches it); an inline box has none, so its
 *  seen size with every scale divided out (a scaled rect is rounded to the browser's layout units — divided, the error
 *  grows: the computed size first) @param {HTMLElement} el */
function layoutSize(el) {
  const cs = getComputedStyle(el),
    w = parseFloat(cs.width),
    h = parseFloat(cs.height);
  if (cs.display !== "inline" && Number.isFinite(w) && Number.isFinite(h)) {
    if (cs.boxSizing === "border-box") return { width: w, height: h };
    const n = (/** @type {string} */ k) => parseFloat(cs.getPropertyValue(k)) || 0;
    return {
      width: w + n("padding-left") + n("padding-right") + n("border-left-width") + n("border-right-width"),
      height: h + n("padding-top") + n("padding-bottom") + n("border-top-width") + n("border-bottom-width"),
    };
  }
  const r = el.getBoundingClientRect(), // an inline box: as seen, the scale divided out
    s = scaleOf(el);
  return { width: r.width / s.x, height: r.height / s.y };
}
