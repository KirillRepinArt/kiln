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
  await k.ev(`(setDock("below"),1)`);
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

/* one clock for a shape change (2026-10-31, G6): the area the picture sits in doesn't move when its shape changes —
   the picture changes inside a still stage, and the prompt follows the picture, a pair gap from it, every frame (the
   area used to hug the picture and glide its grid on CSS's clock while the frame moved on its own: the plate's centre
   wobbled, the tab bar with it) */
export async function stageStaysPutPromptHugs(k, t) {
  for (const [c, ar] of [
    ["446688", "3:4"],
    ["aa7733", "16:9"],
    ["338844", "9:16"],
  ])
    await k.job(`[fill:${c}] p`, { ar, steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=3`, 40000);
  await k.mouse(2, 2);
  for (const dock of ["left", "right"]) {
    await k.ev(`(setDock("${dock}"),1)`);
    await k.sleep(1600);
    await k.ev(`(${tab("gallery")},1)`);
    await k.sleep(1500);
    for (const step of [-1, -1, 1]) {
      const w = k.ev(
        SAMPLE(
          1000,
          `(()=>{const s=$("stage").getBoundingClientRect(),p=$("plate").getBoundingClientRect(),l=$("left").getBoundingClientRect();
          return [Math.round(s.left*10)/10,Math.round(s.width*10)/10,Math.round(("${dock}"==="left"?p.left-l.right:l.left-p.right)*10)/10]})()`,
        ),
      );
      await k.ev(`(genNav(${step}),1)`);
      const s = await w,
        stage = new Set(s.map(x => `${x[0]},${x[1]}`)),
        gaps = s.map(x => x[2]);
      t.ok(stage.size === 1, `${dock}, step ${step}: the stage never moves`, [...stage].slice(0, 3));
      t.motion(
        Math.max(...gaps) - Math.min(...gaps) <= 1.5 && Math.abs(gaps[0] - 20) <= 1.5,
        `${dock}, step ${step}: the prompt a pair gap from the picture, every frame`,
        { min: Math.min(...gaps), max: Math.max(...gaps) },
      );
    }
  }
}
stageStaysPutPromptHugs.opts = { step: 0.05 };

/* every page's plate shares one top and bottom (2026-11-01, G10): in Vertical the picture's room ended an even gap above
   the prompt's name while a panel's box came from the column's CSS — the plate moved ~6 px on every switch between
   Generating and a panel. A height-limited plate is the same height on every page, in every layout */
export async function plateSharesItsEdges(k, t) {
  await k.mouse(2, 2);
  for (const dock of ["left", "right", "below"]) {
    await k.ev(`(setDock("${dock}"),${tab("gen")},closeShown(),S.ar="9:16",sizeFrame(),1)`); // tall: height-limited
    await k.sleep(1600);
    const edges = {};
    for (const v of ["gen", "queue", "png"]) {
      await k.ev(`(${tab(v)},1)`);
      await k.sleep(1400);
      const r = await k.rect("#plate");
      edges[v] = [Math.round(r.top), Math.round(r.bottom)];
    }
    const tops = new Set(Object.values(edges).map(e => e[0])),
      bottoms = new Set(Object.values(edges).map(e => e[1]));
    t.ok(
      tops.size === 1 && bottoms.size === 1,
      `${dock}: the plate's top and bottom are the same on every page`,
      edges,
    );
  }
}
plateSharesItsEdges.opts = { width: 1825, height: 1080, step: 0.05 };

/* the divider is the shared edge (2026-11-01): dragging it, the prompt stays a pair gap from the picture on every step —
   the hug held still while an edge was dragged (promptFollow), and with a picture narrower than its area (the Gallery,
   a portrait) the picture slid under the prompt (−55 px) or away from it (+145 px) until you let go */
export async function dividerKeepsTheGap(k, t) {
  await k.job("[fill:446688] p", { ar: "3:4", steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=1`, 30000);
  for (const dock of ["right", "left"]) {
    await k.ev(`(setDock("${dock}"),1)`);
    await k.mouse(2, 2);
    await k.sleep(1600);
    for (const [sel, dx] of [
      [".pedge.ri", -150],
      [".pedge.ri", 250],
      [".pedge.pi", -120],
      [".pedge.pi", 120],
    ]) {
      await k.ev(`(${tab("gallery")},genNav(-1),1)`);
      await k.sleep(1500);
      const e = await k.rect(sel),
        x = e.left + e.width / 2,
        y = e.top + Math.min(300, e.height / 2),
        d = dock === "right" ? dx : -dx,
        gap = () =>
          k.ev(`(()=>{const p=$("plate").getBoundingClientRect(),l=$("left").getBoundingClientRect();
            return Math.round("${dock}"==="right"?l.left-p.right:p.left-l.right)})()`);
      /* the picture's side at the divider (v0.7c: its outer side holds, the picture itself changes) */
      const side = dock === "right" ? "right" : "left",
        gaps = [await gap()],
        g0 = await k.ev(`$("frame").getBoundingClientRect().${side}`);
      await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await k.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button: "left",
        buttons: 1,
        clickCount: 1,
      });
      for (let i = 1; i <= 8; i++) {
        await k.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: x + (d * i) / 8,
          y,
          button: "left",
          buttons: 1,
        });
        await k.sleep(40);
        gaps.push(await gap());
      }
      const g1 = await k.ev(`$("frame").getBoundingClientRect().${side}`);
      await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + d, y, button: "left", clickCount: 1 });
      await k.sleep(1200);
      gaps.push(await gap());
      /* the picture opens at its biggest (C2a, 2026-11-03): taking room from the prompt it can't grow (height-bound), so
         that way it gives the rubber band only; giving room to the prompt, its side follows the drag */
      const grows = dx > 0; // the test mirrors the pointer for the Left layout (d): dx > 0 takes room from the prompt in both
      if (grows)
        t.ok(
          Math.abs(g1 - g0) <= 22,
          `${dock}, ${sel} ${dx}: at its biggest, the picture only gives (the rubber band)`,
          {
            g0,
            g1,
          },
        );
      else
        t.ok(Math.abs(g1 - g0) > 20, `${dock}, ${sel} ${dx}: the drag moves the picture's side at the divider`, {
          g0,
          g1,
        });
      t.ok(
        Math.max(...gaps) - Math.min(...gaps) <= 2,
        `${dock}, ${sel} ${dx}: the prompt a pair gap from the picture on every step`,
        gaps,
      );
      await k.ev(`(document.querySelector("${sel}").dispatchEvent(new MouseEvent("dblclick",{bubbles:true})),1)`);
    }
  }
}
dividerKeepsTheGap.opts = { width: 1825, height: 1080 };

/* Reset layout moves the pair on ONE clock (2026-11-01, G12): the prompt a pair gap from the picture on every frame.
   The columns glided on CSS's clock while the prompt's offset jumped to where they were going: it sat ~200 px over the
   picture for the first frames, then slid out ("teleports, then travels") */
export async function resetKeepsTheGap(k, t) {
  await k.job("[fill:446688] p", { ar: "3:4", steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=1`, 30000);
  const drag = async (sel, dx) => {
    const h = await k.rect(sel),
      x = h.left + h.width / 2,
      y = h.top + Math.min(100, h.height / 2);
    await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 8; i++)
      await k.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: x + (dx * i) / 8,
        y,
        button: "left",
        buttons: 1,
      });
    await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dx, y, button: "left", clickCount: 1 });
    await k.sleep(1200);
  };
  for (const dock of ["right", "left"])
    for (const where of ["Generating, empty, 21:9", "the Gallery, a portrait"]) {
      await k.ev(`(setDock("${dock}"),1)`);
      await k.sleep(1500);
      await k.ev(
        where.startsWith("Gen")
          ? `(${tab("gen")},closeShown(),S.ar="21:9",sizeFrame(),1)`
          : `(${tab("gallery")},genNav(-1),1)`,
      );
      await k.sleep(1500);
      const s = dock === "right" ? 1 : -1;
      await drag(".pedge.ri", -250 * s);
      await drag(".pedge.po", 150 * s);
      await k.mouse(2, 2);
      await k.sleep(1000);
      const w = k.ev(
        SAMPLE(
          900,
          `(()=>{const p=$("plate").getBoundingClientRect(),l=$("left").getBoundingClientRect();
            return Math.round("${dock}"==="right"?l.left-p.right:p.left-l.right)})()`,
        ),
      );
      await k.ev(`($("layBtn").click(),document.querySelector('[data-lay="reset"]').click(),1)`);
      const gaps = await w;
      t.motion(
        Math.max(...gaps) - Math.min(...gaps) <= 2,
        `${dock}, ${where}: Reset layout — the prompt a pair gap from the picture on every frame`,
        { min: Math.min(...gaps), max: Math.max(...gaps) },
      );
    }
}
resetKeepsTheGap.opts = { width: 2000, height: 1060, step: 0.05 };

/* every way out of the Gallery moves the picture the same way (2026-11-01, G11): to an empty frame of another shape
   the old picture keeps its own size while the frame crops it — it never zooms. The tab cropped and revealed; the arrow
   past the newest (and ✕, Esc) glided the frame with the old picture stretched over it ("the picture zooming") */
export async function galleryExitsAreOne(k, t) {
  await k.job("[fill:446688] p", { ar: "3:4", steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=1`, 30000);
  const exits = {
    "the arrow past the newest": `genNav(1)`,
    "the ✕": `$("bclose").click()`,
    "Esc": "ESC",
    "the Generating tab": tab("gen"),
  };
  for (const dock of ["right", "below"])
    for (const [how, go] of Object.entries(exits)) {
      await k.ev(`(setDock("${dock}"),${tab("gen")},closeShown(),S.ar="16:9",sizeFrame(),1)`);
      await k.mouse(2, 2);
      await k.sleep(1500);
      await k.ev(`(${tab("gallery")},1)`);
      await k.sleep(1500);
      const f0 = await k.rect("#frame"),
        w = k.ev(
          SAMPLE(
            1000,
            `(()=>{const c=$("cvx").getBoundingClientRect(),o=+getComputedStyle($("cvx")).opacity;return [Math.round(c.width),Math.round(c.height),o]})()`,
          ),
        );
      if (go === "ESC") {
        await k.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
        });
        await k.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
        });
      } else await k.ev(`(${go},1)`);
      const seen = (await w).filter(x => x[2] > 0.02),
        f1 = await k.rect("#frame"),
        ws = seen.map(x => x[0]),
        hs = seen.map(x => x[1]);
      t.ok(Math.abs(f1.width / f1.height - f0.width / f0.height) > 0.3, `${dock}, ${how}: the frame changes shape`, {
        f0: [f0.width, f0.height],
        f1: [f1.width, f1.height],
      });
      t.motion(
        seen.length > 0 && Math.max(...ws) - Math.min(...ws) <= 1 && Math.max(...hs) - Math.min(...hs) <= 1,
        `${dock}, ${how}: the old picture keeps its size while it shows (no zoom)`,
        { frames: seen.length, w: [Math.min(...ws), Math.max(...ws)], h: [Math.min(...hs), Math.max(...hs)] },
      );
    }
}
galleryExitsAreOne.opts = { width: 1825, height: 1080, step: 0.05 };
