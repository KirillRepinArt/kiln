/* The ownership tour (ux-review/13-ownership-audit.md, Part 2): every kind of motion Kiln has, alone and combined, with
   the ownership tracer (trace.mjs) recording every writer of what moves or shows. It fails on:
   - a property of one element written by TWO MODULES within one motion (one owner per moving thing);
   - a reversal mid-motion — a value that goes one way and back (a blink);
   - a hover-only thing (the edit buttons, the picture's arrows) visible while the pointer is away.
   Today's known cases are in ALLOW, each with its ownership-map id — the baseline only shrinks: fixing one removes its
   line; a new second writer fails here before it reaches the screen. */
import { TRACER, reversals, secondWriters, twoClocks } from "./trace.mjs";

/** known second writers / reversals: "el.prop" (or "el~what" for a reversal) → the map's id and why it's there */
const G6 = "G6 — the layout grid glides on a CSS clock while this moves frame by frame in script, inside it";
const ALLOW = /** @type {Record<string, string>} */ ({
  "cvx.opacity":
    "V2 — the old picture's fade: pictures.js (cross-fade) and morph.js (crop-and-reveal), kept apart by flags",
  "frame~two clocks": G6,
  "plate~two clocks": G6,
  "rim~two clocks": G6,
  "prog~two clocks": G6,
  "showP~two clocks": G6,
  "gtools~two clocks": G6,
  "tabs~two clocks": G6,
});

const WATCH = `__trace.watch({
  plate: $("plate"), rim: $("rim"), frame: $("frame"), cv: $("cv"), cvx: $("cvx"), fglow: $("fglow"),
  vGen: $("v-gen"), vQueue: $("v-queue"), vLoras: $("v-loras"), vPng: $("v-png"), rpanel: $("rpanel"),
  right: $("right"), app: document.querySelector(".app"), tabs: document.querySelector(".tabs"), thumb: $("thumb"),
  lcol: $("lcol"), left: $("left"), ltitle: $("ltitle"), chips: $("chips"),
  prog: $("prog"), showP: $("showP"), gtools: $("gtools"),
  navPrev: document.querySelector(".gnav.prev"), navNext: document.querySelector(".gnav.next"), toast: $("toast"),
})`;
const HOVER_ONLY = ["gtools", "navPrev", "navNext"];
const tab = v => `document.querySelector('.tab[data-v="${v}"]').click()`;

export async function ownershipTour(k, t) {
  for (const [c, ar] of [
    ["446688", "3:4"],
    ["aa7733", "16:9"],
    ["338844", "9:16"],
  ])
    await k.job(`[fill:${c}] p`, { ar, steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=3`, 40000);
  await k.mouse(2, 2);
  await k.ev(`(${WATCH},1)`);
  await k.sleep(800);
  /** every finding, by key: where it happened */
  const found = /** @type {Record<string, Set<string>>} */ ({});
  const note = (/** @type {string} */ key, /** @type {string} */ where) => (found[key] ||= new Set()).add(where);
  let writes = 0;
  /** one motion: record, act, wait (ms, or until a page condition), read. Several inputs in one motion (a click
   * mid-switch) are checked for second writers only: what follows your input may rightly turn back with it
   * @param {string} label @param {string[] | string} steps @param {number | string} until */
  const motion = async (label, steps, until = 1300) => {
    const many = Array.isArray(steps) && steps.length > 1;
    await k.ev(`(__trace.start(),1)`);
    for (const st of Array.isArray(steps) ? steps : [steps])
      if (/^\d+$/.test(st)) await k.sleep(+st);
      else await k.ev(`(${st},1)`);
    if (typeof until === "number") await k.sleep(until);
    else await k.until(until, 20000, 50);
    const r = await k.ev(`__trace.take()`);
    writes += r.writes.length;
    for (const [key, mods] of Object.entries(secondWriters(r.writes))) note(`${key} [${mods.join(" + ")}]`, label);
    for (const [key, what] of Object.entries(twoClocks(r.writes, r.up))) note(`${key} [${what.join(" + ")}]`, label);
    if (!many)
      for (const x of reversals(r.samples))
        if (x.el !== "toast") note(`${x.el}~${x.what}`, `${label} (${x.from}→${x.peak}→${x.to})`);
    for (const el of HOVER_ONLY) {
      const op = Math.max(0, ...(r.samples[el] || []).map((/** @type {number[]} */ s) => s[5]));
      if (op > 0.01) note(`${el}~shown without hover`, `${label} (${op.toFixed(2)})`);
    }
  };
  /* tab switches: every kind of pair */
  for (const [a, b] of [
    ["gen", "gallery"],
    ["gallery", "queue"],
    ["queue", "loras"],
    ["loras", "png"],
    ["png", "gen"],
    ["gen", "queue"],
    ["queue", "gallery"],
    ["gallery", "gen"],
  ]) {
    await k.ev(`(${tab(a)},1)`);
    await k.sleep(1300);
    await motion(`${a} → ${b}`, tab(b));
  }
  /* browsing between shapes, a fast double step */
  await k.ev(`(${tab("gallery")},1)`);
  await k.sleep(1300);
  await motion("browse ←", `genNav(-1)`);
  await motion("browse → →, fast", [`genNav(1)`, "120", `genNav(1)`]);
  /* combined: a switch during browsing, a click mid-switch */
  await motion("browse, then the Queue mid-crop", [`genNav(-1)`, "150", tab("queue")]);
  await motion("Queue → Gallery → Generating, fast", [tab("gallery"), "200", tab("gen")]);
  /* a ratio change on the empty frame */
  await k.ev(`(closeShown(),1)`);
  await k.sleep(1300);
  await motion("ratio 3:4 → 16:9", `(S.ar="16:9",renderPills(),sizeFrame())`);
  /* a render: it starts (the row's room comes), then the last one finishes (the room goes as the picture lands) —
     each its own motion */
  await k.ev(`(${tab("gen")},closeShown(),P.value="[fill:884422] r",draft=P.value,S.ar="3:4",S.steps=60,1)`); // 3 s at the test's step: its start and its finish are two motions
  await k.sleep(1300);
  await motion("a render starts", `addJobs()`, `!!current()&&!!current().preview_rev`);
  await k.sleep(1300);
  await k.until(`!current()||current().step>=current().steps-3`, 20000, 50);
  await motion("the last render finishes", "1", `!current()&&jobs.filter(j=>j.status==="done").length>=4`);
  await k.sleep(1300);
  await motion("…and settles", "1", 1);
  /* a delete in the Gallery: it moves on to a neighbour */
  await k.ev(`(${tab("gallery")},1)`);
  await k.sleep(1300);
  await motion("delete in the Gallery", `deleteJob(browsed())`);
  /* a window resize */
  await motion(
    "a window resize",
    `new Promise(r=>{let i=0;(function s(){window.dispatchEvent(new Event("resize"));if(++i<10)setTimeout(s,30);else r(1)})()})`,
  );
  /* the Aurora theme's glow round the picture: it comes and goes with its picture */
  await k.theme("aurora");
  await k.setting("glow", "always");
  await k.ev(`(${tab("gallery")},1)`);
  await k.sleep(1300);
  await motion("Aurora: Gallery → Queue (the glow leaves)", tab("queue"));
  await motion("Aurora: Queue → Gallery (the glow comes)", tab("gallery"));
  await motion("Aurora: browse (the glow with its picture)", `genNav(-1)`);
  /* the layout switch (Left / Right / Vertical) */
  for (const d of ["right", "below", "left"]) await motion(`layout → ${d}`, `setDock("${d}")`, 1700);
  const unknown = Object.keys(found).filter(key => !(key.replace(/ \[.*$/, "") in ALLOW));
  /* a second writer or two clocks fail everywhere; what is sampled frame by frame (a reversal, a hover-only thing shown)
     is judged on a real PC — CI's machines draw a few frames a second */
  for (const key of unknown)
    (key.includes("~") && !key.includes("two clocks") ? t.motion : t.ok).call(
      t,
      false,
      key,
      [...found[key]].slice(0, 4),
    );
  for (const key of Object.keys(found).filter(k2 => !unknown.includes(k2)))
    t.note(`baseline (${ALLOW[key.replace(/ \[.*$/, "")]}): ${key}`);
  /* a baseline line that no longer happens: fixed — take it out (the baseline only shrinks) */
  for (const key of Object.keys(ALLOW))
    if (!Object.keys(found).some(f => f.replace(/ \[.*$/, "") === key)) t.note(`fixed — remove from ALLOW: ${key}`);
  t.ok(writes > 200, "the tracer saw the motions' writes", { writes });
}
ownershipTour.opts = { step: 0.05, inject: TRACER, limitMin: 6 };
