/* The ownership tracer (ux-review/13-ownership-audit.md, Part 2): a page-side script, run before Kiln loads, that
   records WHO writes the properties that make things move or show — position, size, transform, opacity, clip,
   visibility — on the elements it is told to watch, and samples where they are every frame.

   A writer is a MODULE (app/plate.js …): one owner per moving thing means one module per property. It is read from the
   call's stack. Recorded: inline style writes (el.style.x = …, setProperty), Element.animate (with its pseudo-element),
   and CSS transitions running on a watched property (the browser's clock: "css:transition"). Kiln's own code is not
   touched — the tracer wraps the browser's functions, in the test's page only.

   Used by trace.test.mjs: `TRACER` is injected with the harness's `inject` option; the test then calls
   __trace.watch(), runs its tour and reads __trace.take(). */

/* the page side, as a function: injected as its source (it runs in the page, not in Node) */
/* global window, requestAnimationFrame, CSSStyleDeclaration, Element, getComputedStyle, CSSTransition */
function tracer() {
  const T = {
    on: false,
    frame: 0,
    /** @type {Map<Element, string>} */
    names: new Map(),
    /** @type {WeakMap<CSSStyleDeclaration, Element>} */
    decl: new WeakMap(),
    /** @type {{ el: string, p: string, by: string, f: number }[]} */
    writes: [],
    /** @type {Record<string, number[][]>} per element: [frame, left, top, width, height, opacity] */
    samples: {},
  };
  window.__trace = T;
  const tick = () => {
    T.frame++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  /* the module that made the call: the first stack frame in app/ that isn't this file's wrapper */
  const by = () => {
    const lines = (new Error().stack || "").split("\n");
    for (const l of lines) {
      const m = l.match(/\/app\/([\w.-]+\.js)/);
      if (m) return m[1];
    }
    return "other";
  };
  const camel = (/** @type {string} */ p) =>
    p.startsWith("--") ? p : p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const WATCHED = new Set([
    "left",
    "top",
    "right",
    "bottom",
    "width",
    "height",
    "transform",
    "translate",
    "scale",
    "opacity",
    "clipPath",
    "visibility",
    "display",
    "inset",
    "gridTemplateColumns", // the layout's columns (.app): the area's place glides on them
  ]);
  const rec = (/** @type {Element} */ el, /** @type {string} */ p, /** @type {string} */ who) => {
    if (!T.on || !T.names.has(el)) return;
    const q = camel(p);
    if (!WATCHED.has(q)) return;
    T.writes.push({ el: /** @type {string} */ (T.names.get(el)), p: q, by: who, f: T.frame, kind: "style" });
  };
  const proto = CSSStyleDeclaration.prototype;
  /* el.style.left = … : its accessor lives on the style object's own prototype — CSSStyleProperties in newer Chrome,
     CSSStyleDeclaration before — so each is looked for along the chain and wrapped where it is (wrapped only on
     CSSStyleDeclaration, the tracer saw no inline writes at all) */
  const holder = (/** @type {string} */ p) => {
    // eslint-disable-next-line no-undef
    for (let o = window.CSSStyleProperties ? CSSStyleProperties.prototype : proto; o; o = Object.getPrototypeOf(o))
      if (Object.getOwnPropertyDescriptor(o, p)) return o;
    return null;
  };
  for (const p of WATCHED) {
    const o = holder(p),
      d = o && Object.getOwnPropertyDescriptor(o, p);
    if (!o || !d || !d.set) continue;
    const set = d.set;
    Object.defineProperty(o, p, {
      ...d,
      set(v) {
        const el = T.decl.get(this);
        if (el) rec(el, p, by());
        set.call(this, v);
      },
    });
  }
  const sp = proto.setProperty;
  proto.setProperty = function (p, v, pr) {
    const el = T.decl.get(this);
    if (el) rec(el, p, by());
    return sp.call(this, p, v, pr);
  };
  const an = Element.prototype.animate;
  Element.prototype.animate = function (kf, opt) {
    const a = an.call(this, kf, opt);
    if (T.on && T.names.has(this)) {
      const who = by(),
        pseudo = opt && typeof opt === "object" && opt.pseudoElement ? opt.pseudoElement : "",
        props = new Set();
      for (const k of Array.isArray(kf) ? kf : [kf])
        for (const x of Object.keys(k || {})) if (!["offset", "easing", "composite"].includes(x)) props.add(x);
      for (const p of props)
        if (WATCHED.has(camel(p)))
          T.writes.push({
            el: /** @type {string} */ (T.names.get(this)) + pseudo,
            p: camel(p),
            by: who,
            f: T.frame,
            kind: "animate",
          });
    }
    return a;
  };
  /** watch these elements: name → element. In Edge el.style.left is an OWN property of each style object, so the
   * accessors are put on each watched element's style object too (its writes go through the unwrapped setProperty) */
  T.watch = (/** @type {Record<string, Element | null>} */ els) => {
    for (const [n, el] of Object.entries(els))
      if (el) {
        T.names.set(el, n);
        const st = /** @type {HTMLElement} */ (el).style;
        T.decl.set(st, el);
        for (const p of WATCHED) {
          const d = Object.getOwnPropertyDescriptor(st, p);
          if (d && !d.configurable) continue;
          const kebab = p.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
          Object.defineProperty(st, p, {
            configurable: true,
            enumerable: true,
            get: () => st.getPropertyValue(kebab),
            set: v => {
              rec(el, p, by());
              sp.call(st, kebab, v == null ? "" : String(v));
            },
          });
        }
      }
  };
  /* every frame while on, after the frame's own writes: each watched element's box and opacity, and the CSS transitions
     running on a watched property (a writer on the browser's own clock) */
  const sample = () => {
    if (T.on) {
      for (const [el, n] of T.names) {
        const r = el.getBoundingClientRect(),
          cs = getComputedStyle(el),
          op = cs.visibility === "hidden" || cs.display === "none" ? 0 : +cs.opacity;
        (T.samples[n] ||= []).push([
          T.frame,
          r.left,
          r.top,
          r.width,
          r.height,
          op,
          Math.round(performance.now() - T.t0),
        ]);
        for (const a of el.getAnimations())
          if (a instanceof CSSTransition && a.playState === "running" && WATCHED.has(camel(a.transitionProperty)))
            T.writes.push({ el: n, p: camel(a.transitionProperty), by: "css:transition", f: T.frame, kind: "css" });
      }
    }
    requestAnimationFrame(() => setTimeout(sample, 0));
  };
  requestAnimationFrame(() => setTimeout(sample, 0));
  /** start recording a motion */
  T.start = () => {
    T.t0 = performance.now();
    T.writes = [];
    T.samples = {};
    T.on = true;
  };
  /** stop, and hand over what was recorded */
  T.take = () => {
    T.on = false;
    /** each watched element's watched ancestors, by name (what moves it besides its own writers) */
    const up = /** @type {Record<string, string[]>} */ ({});
    for (const [el, n] of T.names) up[n] = [...T.names].filter(([a]) => a !== el && a.contains(el)).map(([, m]) => m);
    return { writes: T.writes, samples: T.samples, up };
  };
}

export const TRACER = `(${tracer.toString()})();`;

/* ---------- reading what was recorded (the test's side) ---------- */

/**
 * The properties written by more than one module in one motion: "el.prop" → the modules. A CSS transition is not an
 * owner: it is the clock of the module that set the value (set the target, CSS glides) — see twoClocks.
 * @param {{ el: string, p: string, by: string }[]} writes
 */
export function secondWriters(writes) {
  /** @type {Map<string, Set<string>>} */
  const by = new Map();
  for (const w of writes) {
    if (w.by === "css:transition") continue;
    const k = `${w.el}.${w.p}`;
    if (!by.has(k)) by.set(k, new Set());
    /** @type {Set<string>} */ (by.get(k)).add(w.by);
  }
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const [k, s] of by) if (s.size > 1) out[k] = [...s].sort();
  return out;
}

/**
 * Reversals: a value that moves one way and then back (beyond a tolerance) within one motion — a blink. Per element:
 * left, top, width, height (px), opacity.
 * @param {Record<string, number[][]>} samples
 * @returns {{ el: string, what: string, from: number, peak: number, to: number }[]}
 */
export function reversals(samples) {
  const NAMES = ["left", "top", "width", "height", "opacity"],
    out = [];
  for (const [el, rows] of Object.entries(samples))
    for (let i = 0; i < NAMES.length; i++) {
      /* only while it can be seen: a hidden element repositioned is no blink */
      const tol = NAMES[i] === "opacity" ? 0.03 : 1.5,
        rs = NAMES[i] === "opacity" ? rows : rows.filter(r => r[5] > 0.01),
        v = rs.map(r => r[i + 1]);
      if (v.length < 2) continue;
      /* the turning points of the series, small jitter ignored */
      let dir = 0,
        start = v[0],
        ext = v[0],
        extAt = 0;
      for (let j = 0; j < v.length; j++) {
        const x = v[j],
          d = x - ext;
        if (dir === 0) {
          if (Math.abs(x - start) > tol) {
            dir = Math.sign(x - start);
            ext = x;
            extAt = j;
          }
        } else if (Math.sign(d) === dir) {
          ext = x;
          extAt = j;
        } else if (Math.abs(d) > tol) {
          /* when (ms from the motion's start): the turn, where it was seen again, the last sample */
          const when = `${rs[extAt][6]}→${rs[j][6]}ms of ${rs[rs.length - 1][6]}, ${rs.length} frames`;
          out.push({ el, what: NAMES[i], from: +start.toFixed(2), peak: +ext.toFixed(2), to: +x.toFixed(2), when });
          break;
        }
      }
    }
  return out;
}

const GEOMETRY = new Set([
  "left",
  "top",
  "right",
  "bottom",
  "width",
  "height",
  "transform",
  "translate",
  "inset",
  "gridTemplateColumns",
]);
/**
 * Two clocks in one motion (one motion = one clock): a property glided by a CSS transition AND animated by a script, or
 * an element moved frame by frame by a script while a CSS transition moves one of its watched ancestors' geometry
 * (the frame inside the gliding layout grid — map G6). "el~two clocks" → what met.
 * @param {{ el: string, p: string, by: string, kind: string }[]} writes @param {Record<string, string[]>} up
 */
export function twoClocks(writes, up) {
  /** @type {Record<string, string[]>} */
  const out = {};
  const css = writes.filter(w => w.kind === "css"),
    js = writes.filter(w => w.kind !== "css" && GEOMETRY.has(w.p));
  for (const c of css)
    if (writes.some(w => w.kind === "animate" && w.el === c.el && w.p === c.p))
      out[`${c.el}.${c.p}~two clocks`] = ["css:transition", "animate"];
  /* frame by frame (many writes of one element's geometry) inside an ancestor gliding on CSS */
  const perEl = new Map();
  for (const w of js) perEl.set(w.el, (perEl.get(w.el) || new Set()).add(w.by));
  for (const [el, mods] of perEl) {
    const n = js.filter(w => w.el === el).length;
    if (n < 6) continue; // a single jump isn't a motion of its own
    for (const a of up[el] || [])
      for (const c of css)
        if (c.el === a && GEOMETRY.has(c.p))
          out[`${el}~two clocks`] = [...new Set([...mods, `${a}.${c.p} css:transition`])].sort();
  }
  return out;
}
