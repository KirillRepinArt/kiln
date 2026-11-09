/* The ownership tour (ux-review/13-ownership-audit.md, Part 2): every kind of motion Kiln has, alone and combined, with
   the ownership tracer (trace.mjs) recording every writer of what moves or shows. It fails on:
   - a property of one element written by TWO MODULES within one motion (one owner per moving thing);
   - a reversal mid-motion — a value that goes one way and back (a blink);
   - a hover-only thing (the edit buttons, the picture's arrows) visible while the pointer is away.
   Today's known cases are in ALLOW, each with its ownership-map id — the baseline only shrinks: fixing one removes its
   line; a new second writer fails here before it reaches the screen. */
import { TRACER, reversals, secondWriters, twoClocks } from "./trace.mjs";

/** known second writers / reversals: "el.prop" (or "el~what" for a reversal) → the map's id and why it's there */
const ALLOW = /** @type {Record<string, string>} */ (
  {/* empty since T2c's acceptance (F3 resolved: a same-view switch mid-switch lets the running one carry on) */}
);

const WATCH = `__trace.watch({
  plate: $("plate"), rim: $("rim"), frame: $("frame"), cv: $("cv"), cvx: $("cvx"), fglow: $("fglow"),
  vGen: $("v-gen"), vQueue: $("v-queue"), vLoras: $("v-loras"), vPng: $("v-png"), rpanel: $("rpanel"),
  right: $("right"), app: document.querySelector(".app"), tabs: document.querySelector(".tabs"), thumb: $("thumb"),
  lcol: $("lcol"), left: $("left"), ltitle: $("ltitle"), chips: $("chips"),
  prog: $("prog"), showP: $("showP"), gtools: $("gtools"),
  navPrev: document.querySelector(".gnav.prev"), navNext: document.querySelector(".gnav.next"), toast: $("toast"),
  idle: $("idle"),
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
   * @param {string} label @param {(string | (() => Promise<void>))[] | string} steps (a function: a real input, e.g. a drag)
   * @param {number | string} until */
  const motion = async (label, steps, until = 1300) => {
    const many = Array.isArray(steps) && steps.length > 1;
    await k.ev(`(__trace.start(),1)`);
    for (const st of Array.isArray(steps) ? steps : [steps])
      if (typeof st === "function") await st();
      else if (/^\d+$/.test(st)) await k.sleep(+st);
      else await k.ev(`(${st},1)`);
    if (typeof until === "number") await k.sleep(until);
    else await k.until(until, 20000, 50);
    const r = await k.ev(`__trace.take()`);
    writes += r.writes.length;
    for (const [key, mods] of Object.entries(secondWriters(r.writes))) note(`${key} [${mods.join(" + ")}]`, label);
    for (const [key, what] of Object.entries(twoClocks(r.writes, r.up))) note(`${key} [${what.join(" + ")}]`, label);
    /* the frame's two pictures are ONE picture on screen — the old one's copy (cvx) over the new (cv), inside their view:
       what you see is (1 − (1 − cv)(1 − cvx)) × the view's opacity. Checked apart, the copy appearing over the same
       picture, or a change while a switch still holds the view unseen, read as blinks (2026-10-31) */
    const cvx = r.samples.cvx || [],
      view = r.samples.vGen || [];
    r.samples.picture = (r.samples.cv || []).map((/** @type {number[]} */ row, /** @type {number} */ i) => [
      ...row.slice(0, 5),
      (1 - (1 - row[5]) * (1 - (cvx[i] ? cvx[i][5] : 0))) * (view[i] ? view[i][5] : 1),
      row[6],
    ]);
    delete r.samples.cv;
    delete r.samples.cvx;
    /* the empty frame's text too is seen through its view (it snaps hidden once its view has faded out) */
    r.samples.idle = (r.samples.idle || []).map((/** @type {number[]} */ row, /** @type {number} */ i) => [
      ...row.slice(0, 5),
      row[5] * (view[i] ? view[i][5] : 1),
      row[6],
    ]);
    /* a CUT: something seen goes from shown to gone (or back) between two frames mid-motion — the frame's contents and
       what sits round it (2026-11-01, F2: the empty frame's text was hidden at once while the picture faded) */
    for (const el of ["picture", "idle", "prog", "showP", "vGen", "vQueue", "vLoras", "vPng"]) {
      const rows = r.samples[el] || [];
      for (let i = 1; i < rows.length; i++)
        if (Math.abs(rows[i][5] - rows[i - 1][5]) > 0.6) {
          note(`${el}~cut`, `${label} (${rows[i - 1][5].toFixed(2)}→${rows[i][5].toFixed(2)} at ${rows[i][6]}ms)`);
          break;
        }
    }
    if (!many)
      for (const x of reversals(r.samples))
        if (x.el !== "toast") note(`${x.el}~${x.what}`, `${label} (${x.from}→${x.peak}→${x.to}; ${x.when})`);
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
  /* every other way to a page goes on the same switch (goView, 2026-11-02: the Add LoRA button jumped) */
  await k.ev(`(${tab("gen")},1)`);
  await k.sleep(1300);
  await motion("the Add LoRA button → LoRAs", `document.querySelector(".chipadd").click()`);
  await k.ev(`(${tab("queue")},1)`);
  await k.sleep(1300);
  await motion("a finished Queue row → the Gallery", `document.querySelector(".qi.done, .qi")?.click()`);
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
  for (const d of ["right", "below", "left"]) {
    await motion(`layout → ${d}`, `setDock("${d}")`, 1700);
    /* Vertical: the prompt grows with your draft and the picture gives it the room — one motion (2026-10-31, L2) */
    if (d === "below") {
      const L = "String.fromCharCode(10)";
      await motion(
        "Vertical: a long draft grows the box",
        `(P.value=Array(30).fill("a line of prompt text").join(${L}),P.dispatchEvent(new Event("input")))`,
      );
      await motion("Vertical: …and a short one shrinks it", `(P.value="one line",P.dispatchEvent(new Event("input")))`);
    }
  }
  /* the edges (v0.7c): every kind of drag — a pin, a trade, the rubber band past a limit and its settle, a panel's
     sides and height, Vertical's divider and its about-the-centre sides. Several inputs each (a drag), so they're checked
     for second writers and two clocks (what follows your hand may rightly turn back with it) */
  const drag =
    (/** @type {string} */ sel, /** @type {number} */ dx, dy = 0) =>
    async () => {
      const h = await k.rect(sel),
        x = h.left + h.width / 2,
        y = h.top + Math.min(h.height / 2, 200);
      const m = (/** @type {string} */ type, /** @type {number} */ X, /** @type {number} */ Y, b = 1) =>
        k.send("Input.dispatchMouseEvent", { type, x: X, y: Y, button: "left", buttons: b, clickCount: 1 });
      await m("mouseMoved", x, y, 0);
      await m("mousePressed", x, y);
      for (let i = 1; i <= 8; i++) {
        await m("mouseMoved", x + (dx * i) / 8, y + (dy * i) / 8);
        await k.sleep(30);
      }
      await m("mouseReleased", x + dx, y + dy, 0);
      await m("mouseMoved", 4, 4, 0);
    };
  await k.ev(`(${tab("gallery")},1)`);
  await k.sleep(1300);
  /* within its limits: the far side mirrors (DD-2026-11-03-6), so 60 px of pull is 120 px of picture — a narrow 9:16
     at 280 px tall (its least since DD-2026-11-07-2) is near it; pulled past, the pointer runs on over the picture and
     its buttons rightly show */
  await motion("the picture's outer edge (the far side mirrors)", [drag(".pedge.ro", -60), "0"]);
  /* toward the prompt: the picture (made smaller by the step above) grows within its limits. Toward the picture it ran
     past the picture's least (since B15 (a) the widest picture is a strip narrower), the pointer went on over it, and
     on release its buttons showed — rightly, it was hovered; drags past a limit are the edges suite's */
  await motion("the divider: the prompt against the picture", [drag(".pedge.ri", -120), "0"]);
  await motion("the prompt's outer edge past the room (the rubber band, the settle)", [drag(".pedge.po", -400), "0"]);
  await motion("the picture's top edge past its room", [drag(".hedge.t", 0, -200), "0"]);
  await motion("the prompt box's bottom edge (its text: a little give, snaps back)", [drag("#vedge", 0, 150), "0"]);
  await k.ev(`(${tab("queue")},1)`);
  await k.sleep(1300);
  await motion("a panel's outer edge", [drag(".pedge.ro", 100), "0"]);
  await motion("a panel's bottom edge (its height; the tabs ride on it)", [drag(".phedge.b", 0, -150), "0"]);
  await motion("layout → below, for its edges", `setDock("below")`, 1700);
  await k.ev(`(${tab("gallery")},1)`);
  await k.sleep(1300);
  await motion("Vertical: the divider (the picture's bottom edge, the box glued)", [drag("#hsplit", 0, -120), "0"]);
  await motion("Vertical: the box's side (about its centre)", [drag(".sedge.r", 80), "0"]);
  /* C4c: every Vertical edge through the layout pass */
  await motion("Vertical: the box's bottom (its height, yours)", [drag("#vedge", 0, 60), "0"]);
  await motion("Vertical: the picture's side (about its centre)", [drag(".hedge.r", -60), "0"]);
  /* up, past the anchor (the rubber band, the settle) — down, the release leaves the pointer over the picture and its
     buttons rightly show (as the outer edge's step above) */
  await motion("Vertical: the picture's top past its room (its bottom holds, the settle)", [
    drag(".hedge.t", 0, -60),
    "0",
  ]);
  await k.ev(`(${tab("queue")},1)`);
  await k.sleep(1300);
  await motion("Vertical: a panel's side (about its centre)", [drag(".vpedge.r", 60), "0"]);
  await motion("Vertical: the shared edge with a panel (the trade)", [drag("#hsplit", 0, -80), "0"]);
  await k.ev(`(setDock("left"),1)`);
  await k.sleep(1500);
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
