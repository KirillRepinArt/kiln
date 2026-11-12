// @ts-check
/* Kiln · tooltips */
import { hit, qa } from "./dom.js";
import { ms } from "./tokens.js";

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initTooltips() {
  /* ======================= tooltips: one consistent style, short delay ======================= */
  (function () {
    const tip = document.createElement("div");
    tip.id = "tip";
    document.body.appendChild(tip);
    let t = /** @type {number | undefined} */ (/** @type {unknown} */ (null)),
      cur = /** @type {HTMLElement | null} */ (null);
    function hide() {
      clearTimeout(t);
      tip.classList.remove("show");
      cur = null;
    }
    let mx = 0,
      my = 0;
    document.addEventListener(
      "mousemove",
      e => {
        mx = e.clientX;
        my = e.clientY;
      },
      { passive: true },
    );
    document.addEventListener("mouseover", e => {
      const el = hit(e, "[data-tip]");
      if (el === cur) return;
      hide();
      if (!el) return;
      const text = el.dataset.tip;
      if (!text) return;
      cur = el;
      t = setTimeout(() => {
        if (cur !== el || (document.querySelector(".pop.show") && !el.closest(".pop"))) return;
        tip.textContent = text;
        tip.classList.add("show");
        const r = el.getBoundingClientRect(),
          w = tip.offsetWidth,
          h = tip.offsetHeight;
        let x = r.left + r.width / 2 - w / 2,
          y = r.bottom + 8;
        if (y + h > innerHeight - 6) y = r.top - h - 8;
        if (y < 6) {
          y = Math.max(6, Math.min(innerHeight - h - 6, my + 18));
          x = mx - w / 2;
        } // taller than the window: follow the pointer instead
        x = Math.max(6, Math.min(innerWidth - w - 6, x));
        tip.style.transform = `translate(${x}px,${y}px)`;
      }, ms("--delay-tip"));
    });
    document.addEventListener("mousedown", hide);
    document.addEventListener("wheel", hide, { passive: true });
    /* every tip set by rule, as its element appears (not on hover: an icon-only control's tip is its name, and a name
       has to be there before anyone points at it). A tip the code sets on the element itself wins. */
    const TIP_RULES = /** @type {[string, string][]} */ ([
      ["#pMP", "Image size (megapixels)"],
      ["#pAR", "Aspect ratio"],
      ["#pST", "Sampling steps — scroll to nudge"],
      ["#pSD", "Seed — random each job, or fixed"],
      ["#pN", "How many images to queue — scroll to nudge"],
      ["#play", "Add to queue (Ctrl+Enter)"],
      ["#prog", "Click to see this image's prompt · the preview shows the last finished step"],
      ["#stopBtn", "Stop this job"],
      ["#csize", "Thumbnail size"],
      ["#lsearch", "Search LoRAs by name"],
      ["#gear", "Settings"],
      ["#vclose", "Close (Esc)"],
      ['.tab[data-v="gen"]', "The image being made, and the last result"],
      ['.tab[data-v="gallery"]', "Your finished pictures — ← → to browse"],
      ['.tab[data-v="queue"]', "Running, waiting and finished jobs"],
      ['.tab[data-v="loras"]', "Your LoRA library"],
      ['.tab[data-v="png"]', "Read settings from any Forge PNG"],
      [".chip .cn", "Open in the LoRA library · drag to reorder"],
      [".chip .cx", "Remove"],
      [".star", "Favourite"],
      ["[data-tg]", "On / off"],
      [".card .img", "Click to switch on/off"],
      [".fchips button", "Filter"],
      [".qi .handle", "Drag to reorder"],
      [".qi .body", "Peek at this prompt — change anything in it to make it yours"],
    ]);
    const CONTROL = "button,a[href],input,select,textarea,[role]";
    /** one element's tip and name: a title becomes its tip (one attribute, one tooltip style); an icon-only control is
     *  named by its tip — it follows when the tip changes; a symbol (★, ⋮⋮) isn't a name (ARCHITECTURE › a control's name)
     *  @param {HTMLElement} el */
    function named(el) {
      const ti = el.getAttribute("title");
      if (ti != null) {
        if (!el.dataset.tip) el.dataset.tip = ti;
        el.removeAttribute("title");
      }
      const tip = el.dataset.tip;
      if (!tip || !el.matches(CONTROL)) return;
      const words = /[\p{L}\p{N}]/u.test(el.textContent || ""),
        label = el.getAttribute("aria-label");
      if (!words && label !== tip) el.setAttribute("aria-label", tip);
      else if (words && label === tip) el.removeAttribute("aria-label"); // its words are its name now
    }
    /** @param {Element} root */
    function apply(root) {
      if (!(root instanceof HTMLElement)) return;
      for (const [sel, tip] of TIP_RULES) {
        if (root.matches(sel) && !root.dataset.tip) root.dataset.tip = tip;
        for (const el of qa(sel, root)) if (!el.dataset.tip) el.dataset.tip = tip;
      }
      named(root);
      for (const el of qa("[data-tip],[title]", root)) named(el);
    }
    apply(document.body);
    new MutationObserver(ms => {
      for (const m of ms)
        if (m.type === "attributes") named(/** @type {HTMLElement} */ (m.target));
        else {
          for (const n of m.addedNodes) if (n instanceof Element) apply(n);
          const c = m.target instanceof HTMLElement && m.target.closest("[data-tip]");
          if (c) named(/** @type {HTMLElement} */ (c)); // its content changed: words may have come or gone
        }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["title", "data-tip"],
    });
  })();
}
