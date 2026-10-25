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
