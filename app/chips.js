/* Kiln · the LoRA chips under the prompt box: wrapping (+N), clicking, scrubbing a weight, dragging to reorder */
import { esc } from "./boot.js";
import { layoutLeft } from "./cardlayout.js";
import { $ } from "./dom.js";
import { renderLoras } from "./loras.js";
import { peekButtons, peekJob } from "./peek.js";
import { IC, LORAS, S, save } from "./state.js";
import { showView } from "./tabs.js";

let chipsOpen = false;
export function renderChips() {
  requestAnimationFrame(() => layoutLeft());
  const pk = typeof peekJob !== "undefined" && peekJob;
  $("chips").classList.toggle("peek", !!pk);
  if (pk) {
    $("chips").innerHTML = (pk.loras || [])
      .map(x => {
        const l = LORAS.find(l => l.name === x.name);
        return `<span class="chip ${l && l.folder === "people" ? "face" : ""}"><span class="cn">${esc(l ? l.display : x.name)}</span><span class="cw">${fmtW(x.w)}</span></span>`;
      })
      .join("");
    $("chips").insertAdjacentHTML(
      "afterbegin",
      `<span class="chiplbl">${(pk.loras || []).length === 1 ? "LoRA" : "LoRAs"}</span>`,
    );
    capChips();
    peekButtons();
    return;
  }
  $("chips").innerHTML = LORAS.filter(l => l.on)
    .sort((a, b) => (a.onAt || 0) - (b.onAt || 0))
    .map(
      l =>
        `<span class="chip ${l.folder === "people" ? "face" : ""}" data-n="${l.name}" draggable="true"><span class="cn">${esc(l.display)}</span><span class="cw" data-tip="Drag or scroll to change · click to type">${fmtW(l.w)}</span><button class="cx" title="Remove">${IC.x}</button></span>`,
    )
    .join("");
  $("chips").insertAdjacentHTML(
    "afterbegin",
    `<span class="chiplbl" data-tip="LoRAs used for the next image · drag to reorder">${LORAS.filter(l => l.on).length === 1 ? "LoRA" : "LoRAs"}</span>`,
  );
  $("chips").insertAdjacentHTML(
    "beforeend",
    '<button class="chip chipadd" data-tip="Add a LoRA — opens the library">+</button>',
  );
  capChips();
  if (typeof peekJob !== "undefined" && peekJob) peekButtons();
}
/* more than two rows of chips: hide the rest behind a "+N" chip that expands (and collapses again) */
function capChips() {
  const box = $("chips");
  box.querySelector(".chipmore")?.remove();
  const cs = [...box.querySelectorAll(".chip[data-n]")];
  cs.forEach(c => (c.hidden = false));
  const rows = [...new Set(cs.map(c => c.offsetTop))].sort((a, b) => a - b);
  if (rows.length <= 2) return;
  const more = document.createElement("button");
  more.className = "chip chipmore";
  box.append(more);
  if (chipsOpen) {
    more.textContent = "Show less";
    more.dataset.tip = "Back to two rows";
    return;
  }
  const lim = rows[1],
    hid = cs.filter(c => c.offsetTop > lim);
  hid.forEach(c => (c.hidden = true));
  more.textContent = "+" + hid.length;
  const vis = cs.filter(c => !c.hidden);
  while (more.offsetTop > lim && vis.length) {
    const c = vis.pop();
    c.hidden = true;
    hid.unshift(c);
    more.textContent = "+" + hid.length;
  }
  more.dataset.tip =
    "Show all · " +
    hid.map(c => c.querySelector(".cn").textContent + " " + c.querySelector(".cw").textContent).join(", ");
}
export function fmtW(w) {
  return (+w).toFixed(2).replace(/\.?0+$/, "");
}
/* start-up wiring: the chips — wrap, click, weight, reorder (called from main.js, in order) */
export function initChips() {
  (function () {
    let w = 0;
    new ResizeObserver(() => {
      const n = $("chips").clientWidth;
      if (n !== w) {
        w = n;
        capChips();
      }
    }).observe($("chips"));
  })();
  $("chips").onclick = e => {
    const c = e.target.closest(".chip");
    if (!c) return;
    if (c.classList.contains("chipadd")) {
      showView("loras");
      return;
    }
    if (c.classList.contains("chipmore")) {
      chipsOpen = !chipsOpen;
      renderChips();
      return;
    }
    if (peekJob) return;
    const l = LORAS.find(l => l.name === c.dataset.n);
    if (e.target.closest(".cx")) {
      l.on = false;
      save();
      renderChips();
      renderLoras();
      return;
    }
    S.lfilter = l.folder === "people" ? "people" : "all";
    showView("loras");
    const el = document.querySelector(`[data-ln="${l.name}"]`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }
  };
  /* chip weights: drag to scrub, wheel to nudge, click to type */
  (function () {
    const box = $("chips");
    let drag = null;
    const lor = el => LORAS.find(l => l.name === el.closest(".chip").dataset.n);
    const lim = l => (l.folder === "people" ? [0, 2] : [-3, 3]);
    function setW(l, w, el) {
      const [a, b] = lim(l);
      l.w = Math.round(Math.max(a, Math.min(b, w)) * 100) / 100;
      if (el) el.textContent = fmtW(l.w);
      save();
      if (S.view === "loras") renderLoras();
    }
    box.addEventListener("pointerdown", e => {
      const el = e.target.closest(".cw");
      if (!el) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      drag = { el, l: lor(el), x: e.clientX, w0: lor(el).w, moved: false };
    });
    box.addEventListener("pointermove", e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 3) drag.moved = true;
      if (drag.moved) setW(drag.l, drag.w0 + Math.round(dx / 4) * 0.01 * (e.shiftKey ? 1 : 5), drag.el);
    });
    box.addEventListener("pointerup", () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.moved) return;
      const inp = document.createElement("input");
      inp.className = "cwi";
      inp.value = fmtW(d.l.w);
      d.el.replaceWith(inp);
      inp.focus();
      inp.select();
      const done = ok => {
        if (ok) {
          const v = parseFloat(inp.value.replace(",", "."));
          if (!isNaN(v)) setW(d.l, v);
        }
        renderChips();
      };
      inp.addEventListener("keydown", k => {
        if (k.key === "Enter") done(true);
        if (k.key === "Escape") done(false);
        k.stopPropagation();
      });
      inp.addEventListener("blur", () => done(true));
    });
    box.addEventListener(
      "wheel",
      e => {
        const el = e.target.closest(".cw");
        if (!el) return;
        e.preventDefault();
        const l = lor(el);
        setW(l, l.w + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.01 : 0.05), el);
      },
      { passive: false },
    );
    box.addEventListener(
      "click",
      e => {
        if (e.target.closest(".cw,.cwi")) e.stopImmediatePropagation();
      },
      true,
    );
  })();
  /* drag a chip to reorder: it moves in place, the others slide aside; the order is kept (onAt), so it sticks */
  (function () {
    const box = $("chips");
    let dragEl = null,
      noDrag = false;
    box.addEventListener(
      "pointerdown",
      e => {
        noDrag = !!e.target.closest(".cw,.cx,.cwi");
      },
      true,
    ); // the weight and ✕ keep their own gestures
    box.addEventListener("dragstart", e => {
      const c = e.target.closest(".chip[data-n]");
      if (!c || noDrag || (typeof peekJob !== "undefined" && peekJob)) {
        e.preventDefault();
        return;
      }
      dragEl = c;
      c.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", c.dataset.n);
      } catch (_) {}
    });
    box.addEventListener("dragover", e => {
      if (!dragEl) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const q = e.target.closest(".chip[data-n]");
      if (!q || q === dragEl) return;
      const r = q.getBoundingClientRect(),
        after = e.clientX > r.left + r.width / 2;
      if (after ? q.nextElementSibling === dragEl : q.previousElementSibling === dragEl) return;
      const all = [...box.querySelectorAll(".chip[data-n]")],
        before = new Map(all.map(x => [x, x.getBoundingClientRect()]));
      if (after) q.after(dragEl);
      else q.before(dragEl);
      for (const x of all) {
        if (x === dragEl) continue;
        const b = before.get(x),
          n = x.getBoundingClientRect(),
          dx = b.left - n.left,
          dy = b.top - n.top;
        if (Math.abs(dx) + Math.abs(dy) < 1) continue;
        x.style.transition = "none";
        x.style.transform = `translate(${dx}px,${dy}px)`;
        requestAnimationFrame(() => {
          x.style.transition = "transform .2s var(--ease)";
          x.style.transform = "";
        });
      }
    });
    box.addEventListener("drop", e => {
      if (dragEl) e.preventDefault();
    });
    box.addEventListener("dragend", () => {
      if (!dragEl) return;
      dragEl.classList.remove("dragging");
      const t = Date.now();
      [...box.querySelectorAll(".chip[data-n]")].forEach((c, i) => {
        const l = LORAS.find(l => l.name === c.dataset.n);
        if (l) l.onAt = t + i;
      });
      dragEl = null;
      save();
      renderChips();
      if (S.view === "loras") renderLoras();
    });
  })();
}
