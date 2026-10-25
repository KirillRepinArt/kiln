/* Kiln · prompt card controls: pills, prompt, LoRA chips */
import { $ } from "./dom.js";
import { IC, LORAS, P, RATIOS, S, SEC_PER_STEP, SIZES, save, setDraft } from "./state.js";
import { chipsH, layoutLeft, lyUnfreeze, stackW, updHm } from "./cardlayout.js";
import { BAR, PWMIN, lay, layDef, layDrag, layGeo, layRelease, moveThumb, showView, sizeFrame } from "./stage.js";
import { pv } from "./picstate.js";
import { peekButtons, peekJob, updPrompt } from "./queue.js";
import { renderLoras } from "./loras.js";
import { esc, fmt, toast } from "./boot.js";

/* ======================= pills ======================= */
function slider(id, min, max, val, quick, hint) {
  return `<div class="row"><input type="range" id="${id}R" min="${min}" max="${max}" value="${val}" style="flex:1"><input type="number" id="${id}N" min="1" max="${max * 2}" value="${val}"></div>
  <div class="row" style="justify-content:space-between">${quick.map(q => `<button class="qb ${q === val ? "on" : ""}" data-q="${q}">${q}</button>`).join("")}</div><div class="hint" id="${id}H">${hint}</div>`;
}
function stepsHint() {
  return `~${fmt(S.steps * SEC_PER_STEP[S.mp])} per image at ${S.mp} MP`;
}
function countHint() {
  return S.n > 1
    ? `${S.n} jobs · ~${fmt(S.n * S.steps * SEC_PER_STEP[S.mp])} total · ${S.seedMode === "random" ? "random seeds" : "seeds count up"}`
    : "one image";
}
function idleText() {
  const [w, h] = SIZES[S.mp][S.ar];
  $("idleT").textContent = `Next: ${S.ar} · ${w}×${h}`;
  $("idleS").textContent = `Estimated time: ~${fmt(S.steps * SEC_PER_STEP[S.mp])}`;
} /* live.js keeps it current */
export function renderPills() {
  idleText();
  const pk = typeof peekJob !== "undefined" && peekJob; // peeking: the pills show that job's own settings
  const v = pk
    ? { mp: pk.mp, ar: pk.ar, steps: pk.steps, seed: pk.seed != null ? String(pk.seed) : "—", n: 1 }
    : { mp: S.mp, ar: S.ar, steps: S.steps, seed: S.seedMode === "random" ? "Random" : String(S.seed), n: S.n };
  $("pSD").dataset.tip = pk ? "Click to copy this seed" : "Seed — random each job, or fixed";
  $("vMP").textContent = v.mp + " MP";
  {
    const [pw, ph] = (SIZES[v.mp] || {})[v.ar] || [];
    $("pMP").dataset.tip = pw ? `${v.mp} MP · ${pw}×${ph} px at ${v.ar}` : "Image size (megapixels)";
  }
  $("vAR").innerHTML = v.ar + '<span class="w"> Ratio</span>';
  $("vST").innerHTML = v.steps + '<span class="w"> Steps</span>';
  $("vSD").textContent = v.seed;
  $("vN").textContent = "×" + v.n;
  $("popMP").innerHTML = ["0.5", "1.0", "1.5", "2.0"]
    .map(
      m =>
        `<div class="opt ${m === S.mp ? "on" : ""}" data-v="${m}">${m} MP <small>~${SEC_PER_STEP[m]}s/step</small></div>`,
    )
    .join("");
  $("popAR").innerHTML = `<div class="rgrid">${RATIOS.map(r => {
    const [a, b] = r.split(":").map(Number);
    const k = 34 / Math.max(a, b);
    const [w, h] = SIZES[S.mp][r];
    return `<div class="rt ${r === S.ar ? "on" : ""}" data-v="${r}"><div class="shape" style="width:${Math.round(a * k)}px;height:${Math.round(b * k)}px"></div><div class="t">${r}</div><div class="px">${w}×${h}</div></div>`;
  }).join("")}</div>`;
  if (!$("popST").classList.contains("show"))
    $("popST").innerHTML = slider("st", 1, 30, S.steps, [4, 6, 8, 12], stepsHint());
  if (!$("popN").classList.contains("show")) $("popN").innerHTML = slider("cn", 1, 50, S.n, [1, 4, 8, 16], countHint());
  $("popSD").innerHTML = `<div class="opt ${S.seedMode === "random" ? "on" : ""}" data-v="random">Random each job</div>
   <div class="row"><input type="number" id="seedIn" value="${S.seed}" style="width:140px"><button class="iconbtn" id="dice" title="New random seed">${IC.dice}</button><button class="iconbtn" id="seedCopy" title="Copy the seed">${IC.copy}</button></div>
   <div class="opt ${S.seedMode === "fixed" ? "on" : ""}" data-v="fixed">Fixed</div>`;
  sizeFrame();
}
export function closePops() {
  document.querySelectorAll(".pop.show").forEach(p => {
    p.classList.remove("show");
    p.parentElement.classList.remove("open");
  });
  renderPills();
}
function staleIf(ch) {
  if (ch) pv("shape");
}
const PILLS = [
  [
    "pMP",
    "popMP",
    v => {
      staleIf(S.mp !== v);
      S.mp = v;
    },
  ],
  [
    "pAR",
    "popAR",
    v => {
      staleIf(S.ar !== v);
      S.ar = v;
    },
  ],
  ["pST", "popST", v => (S.steps = +v)],
  ["pN", "popN", v => (S.n = +v)],
  ["pSD", "popSD", v => (S.seedMode = v)],
];
export function copySeed(s) {
  if (s == null || s === "") return;
  navigator.clipboard.writeText(String(s)).then(
    () => toast(`Seed ${s} copied`),
    () => toast("Couldn't copy the seed"),
  );
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, Math.round(v) || a));
}

/* ======================= prompt + chips ======================= */
export function applyPH() {
  delete S.ph;
  layoutLeft();
}
export function grow() {} // column widths now come from sizeFrame()
export function resetLayout() {
  S.lay = null;
  S.vfit = false;
  /* widths, the picture's limits (iw, ih) — all back to the defaults */
  delete S.lw;
  S.pph = 0;
  S.sch = 0;
  S.pos = "mid";
  S.hmode = "";
  updHm();
  applyPH();
  save();
  sizeFrame();
  moveThumb(true);
  layoutLeft();
}
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

/* what this file does at start-up: wiring its controls, first renders (called from main.js, in order) */
export function initComposer() {
  PILLS.forEach(([b, p, set]) => {
    $(b).addEventListener("click", e => {
      const pop = $(p);
      if (b === "pSD" && typeof peekJob !== "undefined" && peekJob) {
        copySeed(peekJob.seed);
        return;
      } // an old job: the seed pill copies its seed
      if (e.target.closest(".pop") && !e.target.closest(".opt,.rt,.qb")) return;
      const o = e.target.closest(".opt,.rt");
      if (o) {
        set(o.dataset.v);
        save();
        closePops();
        return;
      }
      const q = e.target.closest(".qb");
      if (q) {
        set(q.dataset.q);
        save();
        pop.classList.remove("show");
        renderPills();
        pop.classList.add("show");
        return;
      }
      const was = pop.classList.contains("show");
      closePops();
      if (!was) {
        pop.classList.add("show");
        $(b).classList.add("open");
      }
    });
  });
  document.addEventListener("click", e => {
    if (e.target.closest("#seedCopy")) {
      copySeed(S.seed);
      return;
    }
    if (e.target.closest("#dice")) {
      S.seed = Math.floor(Math.random() * 4294967295);
      S.seedMode = "fixed";
      save();
      renderPills();
      $("popSD").classList.add("show");
      return;
    }
    if (!e.target.isConnected || e.target.closest(".pill")) return;
    closePops();
  });
  document.addEventListener("input", e => {
    const id = e.target.id;
    if (id === "stR" || id === "stN") {
      S.steps = clamp(+e.target.value, 1, 60);
      $(id === "stR" ? "stN" : "stR").value = S.steps;
      $("vST").innerHTML = S.steps + '<span class="w"> Steps</span>';
      $("stH").textContent = stepsHint();
      save();
    }
    if (id === "cnR" || id === "cnN") {
      S.n = clamp(+e.target.value, 1, 100);
      $(id === "cnR" ? "cnN" : "cnR").value = S.n;
      $("vN").textContent = "×" + S.n;
      $("cnH").textContent = countHint();
      save();
    }
    if (id === "seedIn") {
      S.seed = +e.target.value || 0;
      S.seedMode = "fixed";
      $("vSD").textContent = "Fixed";
      save();
    }
  });
  [
    ["pST", d => (S.steps = clamp(S.steps + d, 1, 60))],
    ["pN", d => (S.n = clamp(S.n + d, 1, 100))],
  ].forEach(([id, f]) =>
    $(id).addEventListener(
      "wheel",
      e => {
        e.preventDefault();
        f(e.deltaY < 0 ? 1 : -1);
        save();
        renderPills();
      },
      { passive: false },
    ),
  );
  /* the prompt box's bottom edge. Side by side: its height. Vertical: its slot (as the line above the title) — the edge
   follows the pointer down into the room below, and on release the layout settles (the picture gives up that room),
   like every outer edge */
  (function () {
    const g = $("vedge");
    let y0 = 0,
      h0 = 0,
      stk = false,
      vH = 0;
    g.addEventListener("pointerdown", e => {
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      g.classList.add("drag");
      document.body.classList.add("vresizing");
      $("left").classList.add("nodur");
      y0 = e.clientY;
      h0 = $("left").getBoundingClientRect().height;
      stk = !!document.querySelector(".app.stacked");
      if (stk) {
        lay.vbDrag = true;
        vH = h0;
        $("lcol").classList.add("vbdrag");
      }
    });
    g.addEventListener("pointermove", e => {
      if (!g.classList.contains("drag")) return;
      if (!(e.buttons & 1)) {
        g.dispatchEvent(new PointerEvent("pointerup"));
        return;
      }
      if (stk) {
        const col = $("lcol"),
          TS = parseFloat(col.style.getPropertyValue("--ts")) || 64,
          room = innerHeight - 10 - $("left").getBoundingClientRect().top - chipsH();
        vH = Math.round(Math.max(200, Math.min(innerHeight * 0.7, room, h0 + e.clientY - y0)));
        col.style.setProperty("--lh", vH + "px");
        col.style.setProperty("--chtop", TS + vH + 10 + "px");
        return;
      }
      const max = $("left").parentElement.getBoundingClientRect().height - 36;
      S.pph = Math.max(240, Math.min(max, Math.round(h0 + e.clientY - y0)));
      applyPH();
    });
    g.addEventListener("pointerup", () => {
      if (!g.classList.contains("drag")) return;
      g.classList.remove("drag");
      document.body.classList.remove("vresizing");
      $("left").classList.remove("nodur");
      if (stk) {
        S.sch = vH;
        lay.vbDrag = false;
        $("lcol").classList.remove("vbdrag");
        save();
        layoutLeft();
        sizeFrame();
        return;
      }
      lyUnfreeze();
      layoutLeft();
      save();
    });
    g.addEventListener("dblclick", () => {
      if (document.querySelector(".app.stacked")) {
        S.sch = 0;
        save();
        layoutLeft();
        sizeFrame();
        toast("Prompt height back to auto");
        return;
      }
      S.pph = 0;
      applyPH();
      save();
      toast("Prompt height back to auto");
    });
  })();
  (function () {
    const g = $("hsplit");
    let y0 = 0,
      h0 = 0;
    g.addEventListener("pointerdown", e => {
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      g.classList.add("drag");
      document.body.classList.add("vresizing");
      y0 = e.clientY;
      h0 = $("left").getBoundingClientRect().height;
    });
    g.addEventListener("pointermove", e => {
      if (!g.classList.contains("drag")) return;
      if (!(e.buttons & 1)) {
        g.dispatchEvent(new PointerEvent("pointerup"));
        return;
      }
      S.sch = Math.max(200, Math.min(Math.round(innerHeight * 0.7), Math.round(h0 - (e.clientY - y0))));
      layoutLeft();
    });
    g.addEventListener("pointerup", () => {
      g.classList.remove("drag");
      document.body.classList.remove("vresizing");
      save();
    });
    g.addEventListener("dblclick", () => {
      S.sch = 0;
      save();
      layoutLeft();
      toast("Image / prompt split back to auto");
    });
  })();
  /* the panel edges (Phase 2a): po = the prompt's outer edge, dv = the divider between the prompt and the image area
   (a strip on each side of the gap, both the same boundary), ro = the image area's outer edge. Double-click: that
   panel back to its default width (the divider: both). */
  (function () {
    const mk = (parent, e, cls, tip) => {
      const h = document.createElement("div");
      h.className = "pedge " + cls;
      h.dataset.e = e;
      h.dataset.tip = tip;
      parent.appendChild(h);
      return h;
    };
    const P_TIP = "Drag to resize the prompt · double-click for its default width",
      R_TIP = "Drag to resize the image area · double-click for its default width",
      D_TIP = "Drag to share the width between the prompt and the image area · double-click for both defaults";
    const hs = [
      mk($("left"), "po", "po", P_TIP),
      mk($("left"), "dv", "pi", D_TIP),
      mk($("right"), "dv", "ri", D_TIP),
      mk($("right"), "ro", "ro", R_TIP),
    ];
    let d = null;
    for (const h of hs) {
      h.addEventListener("pointerdown", ev => {
        if (document.querySelector(".app.stacked") || ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        h.setPointerCapture(ev.pointerId); /* not the card's move gesture */
        d = { e: h.dataset.e, x0: ev.clientX, g0: Object.assign({}, lay.last || layGeo(), { gen: S.view === "gen" }) };
        lay.drag = true;
        h.classList.add("drag");
        document.body.classList.add("resizing", "laydrag");
        if (h.dataset.e !== "po") $("right").classList.add("edgehint");
      });
      h.addEventListener("pointermove", ev => {
        if (!d) return;
        if (!(ev.buttons & 1)) {
          up();
          return;
        }
        layDrag(d.e, d.g0, ev.clientX - d.x0);
        sizeFrame.hold = true;
        sizeFrame();
        sizeFrame.hold = false;
        moveThumb(true);
      });
      const up = () => {
        if (!d) return;
        d = null;
        h.classList.remove("drag");
        document.body.classList.remove("resizing", "laydrag");
        $("right").classList.remove("edgehint");
        save();
        layRelease();
        setTimeout(() => {
          sizeFrame();
          moveThumb(true);
        }, 480);
      }; /* after the glide */
      h.addEventListener("pointerup", up);
      h.addEventListener("pointercancel", up);
      h.addEventListener("dblclick", () => {
        const df = layDef();
        if (h.dataset.e !== "ro") S.lay.pw = df.pw;
        if (h.dataset.e !== "po") {
          if (S.view === "gen") S.lay.iw = null;
          else S.lay.rw = df.rw;
        }
        save();
        layRelease();
        moveThumb(true);
      }); /* defaults as shares of this window */
      h.addEventListener("pointerenter", () => {
        if (h.dataset.e !== "po") $("right").classList.add("edgehint");
      });
      h.addEventListener("pointerleave", () => {
        if (!d) $("right").classList.remove("edgehint");
      });
    }
  })();
  /* the image area's top and bottom edges (Generating, side by side): the largest height the picture may be. The edge
   follows the cursor and the other one holds still; on release it all glides into place (height → width → centring). */
  (function () {
    let d = null;
    document.querySelectorAll(".hedge").forEach(h => {
      h.addEventListener("pointerenter", () => $("right").classList.add("edgehint"));
      h.addEventListener("pointerleave", () => {
        if (!d) $("right").classList.remove("edgehint");
      });
      h.addEventListener("pointerdown", ev => {
        if (S.view !== "gen" || ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        h.setPointerCapture(ev.pointerId); /* Vertical too (its own limit) */
        const f = $("frame");
        d = {
          e: h.dataset.e,
          x0: ev.clientX,
          y0: ev.clientY,
          w0: f.offsetWidth,
          h0: f.offsetHeight,
          t0: f.offsetTop,
          full: $("stage").getBoundingClientRect().height - BAR,
        };
        document.body.classList.add("vresizing", "laydrag");
        $("right").classList.add("edgehint");
      });
      h.addEventListener("pointermove", ev => {
        if (!d) return;
        if (!(ev.buttons & 1)) {
          up();
          return;
        }
        const dy = ev.clientY - d.y0,
          dx = ev.clientX - d.x0,
          side = d.e === "l" || d.e === "r";
        /* a side edge (Vertical): the picture scales about its centre, its shape kept — the edge follows the cursor */
        const want = side ? ((d.w0 + 2 * (d.e === "r" ? dx : -dx)) * d.h0) / d.w0 : d.e === "b" ? d.h0 + dy : d.h0 - dy;
        const nh = Math.max(200, Math.min(d.full, want));
        lay.vh = nh;
        lay.vtop = side ? d.t0 + (d.h0 - nh) / 2 : d.e === "b" ? d.t0 : d.t0 + (d.h0 - nh);
        S.lay[document.querySelector(".app.stacked") ? "vih" : "ih"] = nh / d.full;
        sizeFrame();
      });
      const up = () => {
        if (!d) return;
        d = null;
        lay.vh = null;
        lay.vtop = null;
        if (S.lay.ih > 0.995) S.lay.ih = null;
        if (S.lay.vih > 0.995) S.lay.vih = null;
        document.body.classList.remove("vresizing", "laydrag");
        $("right").classList.remove("edgehint");
        save();
        sizeFrame();
      };
      h.addEventListener("pointerup", up);
      h.addEventListener("pointercancel", up);
      h.addEventListener("dblclick", () => {
        S.lay[document.querySelector(".app.stacked") ? "vih" : "ih"] = null;
        save();
        sizeFrame();
      });
    });
  })();
  /* the edit buttons appear while the pointer is over the picture or the column beside it (one zone, so you never chase
   them) and stay ~300 ms after it leaves, so a diagonal path doesn't lose them */
  (function () {
    let t = null;
    const on = () => {
        clearTimeout(t);
        $("stage").classList.add("tools");
        document.body.classList.add("navs");
      },
      off = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          $("stage").classList.remove("tools");
          document.body.classList.remove("navs");
        }, 300);
      };
    for (const el of [$("frame"), $("gtools"), ...document.querySelectorAll(".gnav")]) {
      el.addEventListener("pointerenter", on);
      el.addEventListener("pointerleave", off);
    }
  })();
  (function () {
    const L = $("left"),
      col = $("lcol");
    let d = null;
    for (const side of ["l", "r"]) {
      const h = document.createElement("div");
      h.className = "sedge " + side;
      h.dataset.tip = "Drag to resize the prompt box · double-click for its default width";
      L.appendChild(h);
      h.addEventListener("pointerdown", ev => {
        if (!document.querySelector(".app.stacked") || ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        h.setPointerCapture(ev.pointerId);
        d = { side, x0: ev.clientX, w0: stackW() };
        document.body.classList.add("resizing", "laydrag");
      });
      h.addEventListener("pointermove", ev => {
        if (!d) return;
        if (!(ev.buttons & 1)) {
          up();
          return;
        }
        const dx = ev.clientX - d.x0,
          max = innerWidth - 36;
        const w = Math.max(Math.min(PWMIN, max), Math.min(max, d.w0 + (side === "r" ? dx : -dx)));
        S.vfit = false;
        S.lay = S.lay || layDef();
        S.lay.sw = w;
        col.style.setProperty("--sw", w + "px");
        col.style.setProperty("--soff", ((side === "r" ? 1 : -1) * (w - d.w0)) / 2 + "px");
      }); /* the other edge stays put */
      const up = () => {
        if (!d) return;
        d = null;
        document.body.classList.remove("resizing", "laydrag");
        col.style.setProperty("--soff", "0px");
        save();
        updHm();
        layoutLeft();
      }; /* glides back to centre */
      h.addEventListener("pointerup", up);
      h.addEventListener("pointercancel", up);
      h.addEventListener("dblclick", () => {
        if (S.lay) S.lay.sw = null;
        S.vfit = false;
        save();
        updHm();
        layoutLeft();
      });
    }
  })();
  $("pclear").onclick = e => {
    e.stopPropagation();
    if (peekJob || !P.value) return;
    const was = P.value,
      put = v => {
        if (window.__cm) {
          const c = window.__cm;
          c.dispatch({ changes: { from: 0, to: c.state.doc.length, insert: v } });
          c.focus();
        } else {
          P.value = v;
          P.dispatchEvent(new Event("input"));
        }
      };
    put("");
    toast("Prompt cleared", "Undo", () => put(was));
  };
  P.addEventListener("input", () => {
    grow();
    requestAnimationFrame(layoutLeft);
    if (!peekJob) {
      setDraft(P.value);
      save();
    }
    updPrompt();
  });
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
