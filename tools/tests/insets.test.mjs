/* every page's plate: the content area minus insets (2026-10-31, the user's design — layoutmath.js pageInsets). The
   rules, measured on the page (per frame where something moves, read after the frame's own writes):
   - the tab bar sits on the plate's centre line, in every tab and layout (it was clamped into the area, ~24 px off)
   - a page without insets uses the full height — Generating's idle picture as tall as the panels' plate (it was ~65 px
     shorter: the status row's room was kept always)
   - while the queue works nothing changes between its jobs
   - the last job's finish: the row's room goes and the picture grows on ONE clock, neither reversing
   - Vertical: the prompt's pill menus paint over the picture (they went under it) */

/* samples `expr` once a frame, after the frame's own writes, for `ms` */
const SAMPLE = (ms, expr) => `new Promise(res=>{const o=[],t0=performance.now();
  (function s(){requestAnimationFrame(()=>setTimeout(()=>{o.push(${expr});if(performance.now()-t0<${ms})s();else res(o)},0))})()})`;
/* the tab bar's contents' centre minus the plate's centre (px) */
const OFF = `(()=>{const p=$("plate").getBoundingClientRect(),k=document.querySelector(".tabs").children,
  a=k[0].getBoundingClientRect().left,b=k[k.length-1].getBoundingClientRect().right;return Math.round(((a+b)/2-(p.left+p.right)/2)*10)/10+0})()`; // +0: a -0 comes back from the page as no value
const tab = v => `document.querySelector('.tab[data-v="${v}"]').click()`;

export async function barOnTheCentreLine(k, t) {
  await k.job("[fill:446688] tall", { ar: "9:16", steps: 1 }); // narrower than the tab bar: the case the clamp broke
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.mouse(2, 2);
  for (const dock of ["left", "right", "below"]) {
    await k.ev(`(setDock("${dock}"),1)`);
    await k.sleep(1600);
    const places = [
      ["Generating, the result", `${tab("gen")}`],
      ["the Gallery, a tall picture", `(${tab("gallery")},genNav(-1))`],
      ["the Queue", tab("queue")],
      ["LoRAs", tab("loras")],
      ["PNG Info", tab("png")],
      ["Generating, empty", `(${tab("gen")},closeShown())`],
    ];
    for (const [what, go] of places) {
      await k.ev(`(${go},1)`);
      await k.sleep(1400);
      const d = await k.ev(OFF);
      t.ok(Math.abs(d) <= 0.6, `${dock}: ${what} — the tab bar on the plate's centre line`, { off: d });
    }
  }
  /* through a switch, every frame: it rides the plate (plate.js switchGlide), still on its centre line */
  await k.ev(`(setDock("left"),1)`);
  await k.sleep(1600);
  await k.ev(`(${tab("gallery")},genNav(-1),1)`);
  await k.sleep(1400);
  const watch = k.ev(SAMPLE(1100, OFF));
  await k.ev(`(${tab("queue")},1)`);
  const offs = await watch;
  t.motion(Math.max(...offs.map(Math.abs)) <= 1, "Gallery → Queue: on the centre line every frame", {
    worst: Math.max(...offs.map(Math.abs)),
  });
}
barOnTheCentreLine.opts = { step: 0.05 };

export async function fullHeightLikeThePanels(k, t) {
  await k.job("[fill:446688] tall", { ar: "9:16", steps: 1 }); // height-limited: it takes the plate's whole height
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.mouse(2, 2);
  await k.ev(`(${tab("queue")},1)`);
  await k.sleep(1400);
  const panel = await k.rect("#plate");
  await k.ev(`(${tab("gen")},1)`);
  await k.sleep(1400);
  const gen = await k.rect("#plate");
  t.near(gen.height, panel.height, 1, "Generating's finished picture: as tall as the panels' plate");
  t.near(gen.top, panel.top, 1, "…from the same top");
  await k.ev(`(${tab("gallery")},1)`);
  await k.sleep(1400);
  t.near((await k.rect("#plate")).height, panel.height, 1, "the Gallery's too");
  t.ok(await k.ev(`document.body.classList.contains("norow")`), "no room kept for the status row");
}
fullHeightLikeThePanels.opts = { step: 0.05 };

export async function nothingChangesBetweenQueuedJobs(k, t) {
  await k.mouse(2, 2);
  for (const c of ["446688", "aa7733", "338844"]) await k.job(`[fill:${c}] sq`, { ar: "1:1", steps: 2 });
  await k.until(`!!current()`, 20000);
  await k.sleep(400);
  /* from the first job until the last one runs: the plate's box every frame */
  const boxes = await k.ev(`new Promise(res=>{const o=[];
    (function s(){requestAnimationFrame(()=>setTimeout(()=>{const r=$("plate").getBoundingClientRect();
      o.push([r.left,r.top,r.width,r.height].map(Math.round).join(","));
      if(jobs.some(j=>j.status==="pending")||!current())s();else res(o)},0))})()})`);
  const kinds = [...new Set(boxes)];
  t.ok(boxes.length > 30, "sampled across the jobs", { frames: boxes.length });
  t.ok(kinds.length === 1, "the plate never changes while the queue works", kinds.slice(0, 4));
  t.ok(
    await k.ev(`!document.body.classList.contains("norow")&&document.body.classList.contains("notools")`),
    "the row's room kept, no buttons' column",
  );
}
nothingChangesBetweenQueuedJobs.opts = { step: 0.6 };

export async function finishOnOneClock(k, t) {
  await k.mouse(2, 2);
  await k.job("[fill:446688] tall", { ar: "3:4", steps: 4 }); // height-limited: it grows into the row's room
  await k.until(`!!current()`, 20000);
  await k.sleep(900); // the row's own coming in (the job's start) has settled
  const s = await k.ev(`new Promise(res=>{const o=[],f=$("frame"),p=$("prog");let end=0;
    (function s(){requestAnimationFrame(()=>setTimeout(()=>{const r=$("plate").getBoundingClientRect(),cs=getComputedStyle(p);
      o.push({h:r.height,op:cs.visibility==="hidden"?0:+cs.opacity,t:performance.now()});
      if(!end&&!current()&&jobs.some(j=>j.status==="done"))end=performance.now()+1200;
      if(!end||performance.now()<end)s();else res(o)},0))})()})`);
  const h0 = s[0].h,
    h1 = s.at(-1).h,
    grow = s.findIndex(x => x.h > h0 + 0.5),
    fade = s.findIndex(x => x.op < 0.99);
  t.ok(h1 > h0 + 30, "the finished picture grows into the row's room", { h0, h1 });
  t.ok(s.at(-1).op === 0, "the row is gone");
  t.ok(
    s.every((x, i) => i === 0 || x.h >= s[i - 1].h - 0.5),
    "the picture never shrinks on the way (no reversal)",
  );
  t.ok(
    s.every((x, i) => i === 0 || x.op <= s[i - 1].op + 0.01),
    "the row never comes back on the way (no blink)",
    s
      .map((x, i) => (i && x.op > s[i - 1].op + 0.01 ? `${i}: ${s[i - 1].op.toFixed(2)}→${x.op.toFixed(2)}` : ""))
      .filter(Boolean)
      .concat([`ops: ${s.map(x => x.op.toFixed(2)).join(" ")}`]),
  );
  t.motion(grow >= 0 && fade >= 0 && Math.abs(grow - fade) <= 1, "one clock: the box and the row start together", {
    grow,
    fade,
  });
  const dur = s.findIndex((x, i) => i > grow && x.h >= h1 - 0.5);
  t.motion(
    grow >= 0 && s[dur].t - s[grow].t < 600,
    "…and land within the layout's glide",
    grow >= 0 ? { ms: Math.round(s[dur].t - s[grow].t) } : {},
  );
}
finishOnOneClock.opts = { step: 0.6 };

export async function pillMenuOverThePicture(k, t) {
  await k.ev(`(setDock("below"),S.sch=200,1)`);
  await k.job("[fill:446688] sq", { ar: "1:1", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(`(layoutLeft(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const pill = await k.rect("#pAR");
  await k.click(pill.left + pill.width / 2, pill.top + pill.height / 2);
  await k.sleep(500);
  const pop = await k.rect("#popAR"),
    fr = await k.rect("#frame"),
    y = Math.max(pop.top, fr.top) + 6;
  t.ok(pop.top < fr.bottom - 10, "the Ratio menu reaches over the picture (the case to test)", { pop, fr });
  t.ok(
    await k.ev(`$("popAR").contains(document.elementFromPoint(${pop.left + pop.width / 2},${y}))`),
    "the menu paints over the picture, not under it",
  );
}
pillMenuOverThePicture.opts = { width: 1872, height: 1080, step: 0.05 };

/* the edit buttons take no room (2026-10-31, the user: "the Gallery moving compared to Generating … the edit button
   area should be ignored for the layout"): one shape = one plate, buttons or none */
export async function buttonsTakeNoRoom(k, t) {
  await k.job("[fill:446688] p", { ar: "3:4", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.mouse(2, 2);
  const box = async () => {
    await k.sleep(1400);
    const r = await k.rect("#plate");
    return [r.left, r.top, r.width, r.height].map(Math.round).join(",");
  };
  for (const dock of ["left", "right", "below"]) {
    await k.ev(`(setDock("${dock}"),S.ar="3:4",1)`);
    await k.sleep(1600);
    await k.ev(`(${tab("gen")},1)`);
    const result = await box();
    await k.ev(`(${tab("gallery")},1)`);
    const gallery = await box();
    await k.ev(`(${tab("gen")},closeShown(),1)`);
    const empty = await box();
    t.ok(result === gallery && gallery === empty, `${dock}: the same plate in Generating, the Gallery and empty`, {
      result,
      gallery,
      empty,
    });
  }
}
buttonsTakeNoRoom.opts = { step: 0.05 };

/* browsing between shapes: the plate grows and shrinks evenly about a fixed centre line (2026-10-31, the user: "it sort
   of expands to the right") — a wide picture in a tight window used to grow toward the prompt only */
export async function browsingIsSymmetric(k, t) {
  for (const [c, ar] of [
    ["446688", "3:4"],
    ["aa7733", "16:9"],
    ["338844", "9:16"],
    ["884488", "1:1"],
  ])
    await k.job(`[fill:${c}] p`, { ar, steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=4`, 40000);
  await k.mouse(2, 2);
  for (const dock of ["left", "right", "below"]) {
    await k.ev(`(setDock("${dock}"),1)`);
    await k.sleep(1600);
    await k.ev(`(${tab("gallery")},1)`);
    await k.sleep(1500);
    for (let i = 0; i < 3; i++) {
      const w = k.ev(SAMPLE(1000, `(()=>{const r=$("frame").getBoundingClientRect();return (r.left+r.right)/2})()`));
      await k.ev(`(genNav(${i < 2 ? -1 : 1}),1)`);
      const cx = await w,
        drift = Math.max(...cx) - Math.min(...cx);
      t.motion(drift <= 1.5, `${dock}, step ${i + 1}: the plate's centre stays put`, { drift: +drift.toFixed(1) });
    }
  }
}
browsingIsSymmetric.opts = { step: 0.05 };
