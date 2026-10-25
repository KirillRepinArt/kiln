// @ts-check
/* Kiln · the page's elements by id. Its own file, importing nothing: modules that use $ while they load can never
   meet it unready (a module in an import circle may run before its partners) */
/* typed as always found: the ids are fixed in index.html (code that may run before its element exists checks itself) */
/** @param {string} id @returns {HTMLElement} */
export const $ = id => /** @type {HTMLElement} */ (document.getElementById(id));
