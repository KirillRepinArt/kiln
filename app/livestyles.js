// @ts-check
/* Kiln · live style reload: save a file in app/styles/ and the page takes it in place — nothing reloads, your prompt,
   picture and scroll stay. The server's state answer carries a fingerprint of the style files (server/page.py
   styles_signature); when it changes, fresh copies of the stylesheets are loaded beside the old ones and the old ones
   go once they've arrived (no unstyled flash), then everything the scripts take from the tokens is read again. */
import { applyTheme } from "./settings.js";
import { initTokens } from "./tokens.js";

let stylesSeen = "";
let stylesSwapping = false;

/** @param {string | undefined} sig the server's fingerprint of app/styles/ */
export function checkStyles(sig) {
  if (!sig || stylesSwapping) return;
  if (!stylesSeen) {
    stylesSeen = sig; // the first answer: what this page loaded with
    return;
  }
  if (sig === stylesSeen) return;
  stylesSeen = sig;
  swapStyles(sig);
}

/** @param {string} v */
function swapStyles(v) {
  const old = /** @type {HTMLLinkElement[]} */ ([
    ...document.querySelectorAll('link[rel="stylesheet"][href*="app/styles/"]'),
  ]);
  if (!old.length) return;
  stylesSwapping = true;
  const fresh = old.map(l => {
    const n = /** @type {HTMLLinkElement} */ (l.cloneNode());
    n.href = l.href.split("?")[0] + "?v=" + encodeURIComponent(v);
    l.after(n);
    return new Promise(done => {
      n.onload = n.onerror = () => done(undefined);
    });
  });
  Promise.all(fresh).then(() => {
    old.forEach(l => l.remove());
    stylesSwapping = false;
    initTokens(); // the gaps the layout maths uses
    applyTheme(); // the harmonic colours and the skin's fonts
    dispatchEvent(new Event("resize")); // the layout, as after a window resize
    document.documentElement.dataset.stylesV = v; // for the test
  });
}
