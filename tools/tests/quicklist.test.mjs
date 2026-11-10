// v0.5 quick list (notes of 2026-10-24): the Vertical title, privacy with no picture, clear buttons, toasts by the
// prompt, drags that always end, the press outline, Start while a job runs.
const done = (k, n = 1) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);
const hit = (k, sel) =>
  k.ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(sel)}),r=e.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e})()`,
  );

/* the Steps pill is off by default (Settings → Model); tests that open it switch it on, as a user would */
const stepsPillOn = k => k.setting("stepsPill", "on");

export async function verticalTitleClicks(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.sleep(900);
  await k.job("[fill:335577] one", { ar: "16:9", steps: 2, name: "Castle" });
  await done(k);
  await k.mouse(2, 2);
  await k.sleep(1200);
  /* 2026-10-31: the prompt column sits at the bottom (no upward shift) on a layer above the picture area (glass.css
     "the page's layers") — the title is safe by paint order, not only by the picture area letting the pointer through */
  t.ok(await k.ev(`!$("lcol").style.transform`), "Vertical: the prompt column isn't shifted");
  t.ok(await hit(k, "#pname"), "the title takes the pointer in Generating");
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1200);
  t.ok(await hit(k, "#pname"), "…and in the Gallery (rename)");
  await k.ev(
    `(document.head.insertAdjacentHTML("beforeend",'<style id="mut">.app.stacked .stage,.app.stacked #v-gen,.app.stacked>.right,.app.stacked .rpanel{pointer-events:auto!important}</style>'),1)`,
  );
  t.ok(await hit(k, "#pname"), "…even with the picture area taking the pointer (the layer order protects it)");
  await k.ev(`($("mut").remove(),1)`);
  /* under the picture: the one divider between it and the prompt (2026-11-01, L4) */
  const f = await k.rect("#frame");
  await k.mouse(f.left + f.width / 2, f.bottom + 4);
  await k.sleep(400);
  t.ok(
    await k.ev(`document.elementFromPoint(${f.left + f.width / 2},${f.bottom + 4}).matches(".hedge.b")`),
    "the boundary under the picture takes the pointer: the shared edge's band (B19b)",
  );
}
verticalTitleClicks.opts = { width: 1872, height: 1080, step: 0.05 };

export async function privacyWithNoPicture(k, t) {
  await k.sleep(1000); // the launch glide: measure the frame where it settles, not on its way
  const f = await k.rect("#frame");
  await k.mouse(f.left + f.width / 2, f.top + f.height / 2);
  t.ok(
    await k.until(
      `!$("frame").classList.contains("has")&&getComputedStyle($("cbtn")).display!=="none"&&+getComputedStyle($("cbtn")).opacity>.9`,
      2000,
    ),
    "the eye is on the empty frame (on hover)",
  );
  await k.ev(`($("cbtn").click(),1)`);
  await k.sleep(200);
  t.ok(
    await k.ev(
      `document.body.classList.contains("private")&&getComputedStyle(document.querySelector(".pwrapT .cm-editor")).visibility==="hidden"`,
    ),
    "it hides the prompt",
  );
}

export async function clearButtons(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1200);
  await k.ev(`(P.value="a prompt worth keeping",draft=P.value,updPrompt(),1)`);
  const l = await k.rect("#left");
  await k.mouse(l.left + 40, l.top + 40);
  await k.sleep(300);
  t.ok(+(await k.ev(`getComputedStyle($("pclear")).opacity`)) > 0.9, "the prompt's ✕ shows while it has text");
  await k.ev(`($("pclear").click(),1)`);
  await k.sleep(300);
  t.ok(await k.ev(`P.value===""&&draft===""`), "one click clears it");
  t.ok(await k.ev(`$("toastBtn").textContent==="Undo"`), "with Undo");
  await k.ev(`($("toastBtn").click(),1)`);
  await k.sleep(300);
  t.ok(await k.ev(`P.value==="a prompt worth keeping"&&draft===P.value`), "Undo brings it back");
  await k.ev(`(showView("loras"),$("lsearch").value="zzz",$("lsearch").oninput(),1)`);
  await k.sleep(300);
  t.ok(await k.ev(`getComputedStyle($("lsClear")).display!=="none"`), "the LoRA search has a ✕ while it has text");
  await k.ev(`($("lsClear").click(),1)`);
  await k.sleep(200);
  t.ok(await k.ev(`$("lsearch").value===""&&getComputedStyle($("lsClear")).display==="none"`), "it clears the search");
}

export async function toastsByThePrompt(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1200);
  await k.ev(`(toast("hello"),1)`);
  await k.sleep(300);
  const [tr, lr, cr] = [await k.rect("#toast"), await k.rect("#left"), await k.rect("#lcol .controls")];
  t.near(tr.left + tr.width / 2, lr.left + lr.width / 2, 2, "side by side: centred on the prompt column");
  t.ok(tr.bottom < cr.top || tr.top > cr.bottom, "never over the controls", { tr, cr });
  /* your draft's news sits under the Generating tab (2026-10-28, the user): clearing the prompt, for one */
  await k.ev(`(P.value="a fox",P.dispatchEvent(new Event("input")),$("pclear").click(),1)`);
  await k.sleep(300);
  const [dr, gt] = [await k.rect("#toast"), await k.rect('.tab[data-v="gen"]')];
  t.ok(
    Math.abs(dr.left + dr.width / 2 - (gt.left + gt.width / 2)) <= 2 && dr.top > gt.bottom && dr.top - gt.bottom < 30,
    "your draft's news: under the Generating tab",
    { dr, gt },
  );
  /* M1: one placer — a reset's message under the Layout button; the finished note under the Generating tab */
  const under = async (sel, of, name) => {
    const [m, a] = [await k.rect(sel), await k.rect(of)];
    t.ok(
      Math.abs(m.left + m.width / 2 - (a.left + a.width / 2)) <= 2 && m.top > a.bottom && m.top - a.bottom < 30,
      name,
      { m, a },
    );
  };
  await k.ev(`($("layBtn").click(),1)`);
  await k.sleep(300);
  await k.ev(`(document.querySelector('#layMenu [data-lay="reset"]').click(),1)`);
  await k.sleep(400);
  await under("#toast", "#layBtn", "a reset's message: under the Layout button");
  await k.ev(`(doneNote({ id: 7, status: "done" }),1)`);
  await k.sleep(500);
  await under("#donenote", '.tab[data-v="gen"]', "the finished note: under the Generating tab, by the same placer");
  await k.ev(`(setDock("below"),1)`);
  await k.sleep(1000);
  await k.ev(`(toast("Forge isn't running — Kiln picks it up as soon as it starts"),1)`);
  await k.sleep(300);
  const t2 = await k.rect("#toast"),
    W = await k.ev(`innerWidth`);
  t.ok(t2.top < 40 && W - t2.right < 40, "Vertical: a message with no page — top right", t2);
  t.ok(t2.height < 50, "…on one line (its size is its text's, wherever it's placed)", t2);
  /* a message about a page goes under its tab, in either layout (the user, 2026-11-10): the queue paused */
  await k.ev(`(setPaused(true),1)`);
  await k.until(`/paused/.test($("toastMsg").textContent)`, 3000);
  await k.sleep(300);
  await under("#toast", '.tab[data-v="queue"]', "Vertical: the queue's news under the Queue tab");
  await k.ev(`(setPaused(false),1)`);
}

export async function dragsAlwaysEnd(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1200);
  const e = await k.rect(".pedge.ri");
  const x = e.left + e.width / 2,
    y = e.top + e.height / 2;
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + 30, y, button: "left", buttons: 1 });
  await k.sleep(100);
  t.ok(await k.ev(`document.body.classList.contains("resizing")`), "dragging an edge: the resize cursor");
  await k.ev(
    `(document.querySelector(".pedge.ri").dispatchEvent(new PointerEvent("pointermove",{bubbles:true,pointerId:1,isPrimary:true,pointerType:"mouse",clientX:${x + 60},clientY:${y},buttons:0})),1)`,
  ); // the mouse's own pointer (1): a drag hears its pointer only (gesture.js, G1) — the default 0 is another pointer
  await k.sleep(150); // the release got lost: the next move has no button
  t.ok(
    await k.ev(`!document.body.classList.contains("resizing")&&!lay.drag`),
    "a move without the button ends it (no stuck cursor, nothing follows the pointer)",
  );
}

export async function pressOutline(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1200);
  const tt = await k.rect("#ltitle");
  const x = tt.left + 30,
    y = tt.top + tt.height - 14; // the name line, off the name itself
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await k.sleep(250);
  const O = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--outline-out"))`),
    s = await k.ev(
      `(()=>{const c=getComputedStyle($("left"),"::after"),b=parseFloat(getComputedStyle($("left")).borderTopWidth);return[c.top,c.left,c.right,c.bottom].map(v=>-parseFloat(v)-b)})()`,
    );
  t.ok(await k.ev(`$("left").classList.contains("hint")`), "pressing the box: the outline shows");
  t.ok(
    s.every(d => Math.abs(d - O) <= 0.5),
    "round the box, one outline gap outside it on every side, drawn by the box itself (2026-11-02)",
    { s, O },
  );
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await k.sleep(100);
  t.ok(await k.ev(`!$("left").classList.contains("hint")`), "letting go: it goes");
}

export async function startWhileRunning(k, t) {
  await k.job("a slow one", { steps: 20 });
  await k.until(`!!current()`, 20000, 100);
  // Start's state follows the status loop (every 0.4 s) and the triangle fades over 0.2 s: wait for it, don't time it
  await k.until(`/255, 255, 255/.test(getComputedStyle(document.querySelector("#play svg path")).fill)`, 3000, 50);
  const s = await k.ev(
    `(()=>{const p=getComputedStyle($("play")),b=getComputedStyle($("badge"),"::before");return{anim:p.animationName,bg:p.backgroundImage.slice(0,40),fill:getComputedStyle(document.querySelector("#play svg path")).fill,ring:b.content!=="none"&&b.display!=="none"}})()`,
  );
  t.ok(s.anim === "flow" && /gradient/.test(s.bg), "the whole button flows with the progress bar's gradient", s);
  t.ok(/255, 255, 255/.test(s.fill), "the triangle: bright while working (dark when idle)", s);
  t.ok(s.ring, "a ring round the queue count", s);
}
startWhileRunning.opts = { step: 1 };

/* the box's footprint while you move it (L1 — it was the three dock zones): its glass condenses in */
export async function footprintGlass(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1000);
  const blur = () =>
    k.ev(`parseFloat(getComputedStyle(document.querySelector(".footprint")).backdropFilter.split("blur(")[1]||"0")`);
  await k.ev(`(document.querySelector(".footprint").classList.add("show"),1)`);
  await k.sleep(40);
  const early = await blur();
  await k.sleep(600);
  const late = await blur();
  t.ok(early < 14 && late > 15.5, "it condenses in: the glass blur grows from nothing", { early, late });
  t.ok(
    await k.ev(`getComputedStyle(document.querySelector(".footprint")).opacity==="1"`),
    "never by opacity (it would switch the glass off)",
  );
  await k.ev(`(document.querySelector(".footprint").classList.remove("show"),1)`);
  await k.sleep(40);
  t.ok(
    await k.ev(`getComputedStyle(document.querySelector(".footprint")).display!=="none"`),
    "letting go: it fades back out rather than vanish",
  );
  await k.sleep(600);
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".footprint")).display==="none"`), "…and is gone after");
}

export async function promptEdges(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1000);
  await k.ev(
    `(P.value=Array(40).fill("a long line of prompt text").join(String.fromCharCode(10)),draft=P.value,layoutLeft(),1)`,
  );
  await k.sleep(800);
  /* the fades are the scroll edge's: --ft / --fb on the scroller, driven by its scroll timeline (scrolledge.css,
     DEVLOG DD-2026-11-09-3 — they were classes set by script, "more" / "scrolled") */
  const w = () =>
    k.ev(
      `(()=>{const s=getComputedStyle(document.querySelector(".pwrapT .cm-scroller"));return{top:parseFloat(s.getPropertyValue("--ft"))||0,bottom:parseFloat(s.getPropertyValue("--fb"))||0}})()`,
    );
  const a = await w();
  t.ok(a.bottom > 0 && a.top === 0, "overflowing, at the top: the bottom fades, the top doesn't", a);
  await k.ev(`(document.querySelector(".pwrapT .cm-scroller").scrollTop=99999,1)`);
  await k.sleep(300);
  const b = await w();
  t.ok(b.top > 0 && b.bottom === 0, "scrolled to the end: the top fades, the bottom doesn't", b);
}

/* modeless (2026-10-27, the user): a shown picture's prompt has no bar — change anything (a pill, a LoRA, the text) and
   it becomes your draft (random seed, Undo); ✕ sits at the end of its file name and the title never moves */
export async function peekModeless(k, t) {
  await stepsPillOn(k);
  await k.job("[fill:446688] one", { steps: 2, name: "Harbour" });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(`(S.steps=7,S.ar="16:9",S.pname="",$("pname").value="",P.value="something else",draft=P.value,save(),1)`);
  /* the title at rest, before and after the switch: a condition, not a fixed time (CI draws a few frames a second; fixed
     waits caught the column mid-settle on CI only — 800 ms after the switch, 2026-11-02; 300 ms before it, 2026-11-03) */
  const titleAtRest = async () => {
    await k.ev(`(window.__pnY=null,1)`);
    await k.until(
      `(()=>{const y=$("pname").getBoundingClientRect().top,o=window.__pnY;window.__pnY=y;return o!=null&&Math.abs(o-y)<0.5})()`,
      5000,
      150,
    );
    return (await k.rect("#pname")).top;
  };
  const y0 = await titleAtRest();
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await titleAtRest();
  t.ok(!(await k.ev(`!!document.getElementById("peekbar")`)), "no bar above the box");
  t.near((await k.rect("#pname")).top, y0, 1, "the title stays at its height");
  const g = await k.ev(`(()=>{const c=document.querySelector(".nchip").getBoundingClientRect(),t=$("ltitle"),
    r=t.getBoundingClientRect(),p=parseFloat(getComputedStyle(t).paddingLeft);
    return{pre:$("fnPre").textContent,shown:getComputedStyle($("fnPre")).display!=="none",d:(c.left+c.right)/2-(r.left+r.right)/2}})()`);
  t.ok(g.pre.startsWith("#") && g.shown, "its # is there without hovering", g);
  t.ok(Math.abs(g.d) < 3, "the line (#, title, file name, ✕) centred as one group", g);
  const line = await k.ev(`({suf:$("fnSuf").textContent,x:getComputedStyle($("pkX")).display,
    gap:$("pkX").getBoundingClientRect().left-$("fnSuf").getBoundingClientRect().right})`);
  t.ok(line.suf === "-001.png" && line.x !== "none", "after the title: its number and .png, then ✕", line);
  t.ok(line.gap > 4 && line.gap < 12, "✕ attached to the file name (a tight gap)", line);
  await k.shot("peek-line");
  // a pill: picking a value makes the picture your draft first, then applies
  await k.ev(`($("pST").click(),1)`);
  await k.sleep(200);
  t.ok(await k.ev(`peekJob!==null`), "opening a pop-up changes nothing");
  await k.ev(`(document.querySelector('#popST .qb[data-q="8"]').click(),1)`);
  await k.sleep(300);
  const s = await k.ev(`({peek:!!peekJob,steps:S.steps,ar:S.ar,name:S.pname,seed:S.seedMode,draft})`);
  t.ok(
    !s.peek && s.steps === 8 && s.ar === "3:4" && s.name === "Harbour" && s.seed === "random" && /one/.test(s.draft),
    "a pill changed: the picture is your draft (its settings, series, a random seed), then the change",
    s,
  );
  t.ok(/Undo/.test(await k.ev(`$("toast").textContent`)), "…with Undo");
  // ✕ closes the prompt; in the Gallery it stays closed as you browse, and "Show prompt" under the picture brings it back
  await k.job("[fill:884422] two", { steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 20000);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(600);
  await k.ev(`($("pkX").click(),1)`);
  await k.sleep(300);
  t.ok(
    await k.ev(`peekJob===null&&PV.browse!==null&&$("showP").classList.contains("show")`),
    "✕: your draft; Show prompt",
  );
  const sp = await k.rect("#showP"),
    fr = await k.rect("#frame");
  t.near(sp.left + sp.width / 2, fr.left + fr.width / 2, 2, "…centred under the picture");
  await k.shot("show-prompt");
  t.ok(sp.top > fr.bottom && sp.top - fr.bottom < 24, "…just under it", { gap: sp.top - fr.bottom });
  await k.ev(`(genNav(-1),1)`);
  await k.sleep(400);
  t.ok(await k.ev(`peekJob===null&&$("showP").classList.contains("show")`), "browsing on: still closed");
  await k.ev(`($("showP").click(),1)`);
  await k.sleep(300);
  t.ok(
    await k.ev(`peekJob!==null&&peekJob.id===PV.browse&&!$("showP").classList.contains("show")`),
    "Show prompt: back",
  );
}

/* the narrowest box: title, file name and ✕ share the line with the size buttons — the file name goes first, ✕ never,
   and the line keeps a part gap from the size buttons (box controls, not the prompt's) */
export async function narrowNameLine(k, t) {
  await k.job("[fill:446688] one", { steps: 2, name: "A rather long series name" });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(
    `(setPaneSize("box","w",360,"side"),sizeFrame(),layoutLeft(),document.querySelector('.tab[data-v="gallery"]').click(),1)`,
  );
  await k.mouse(2, 2);
  await k.sleep(1200);
  const r = await k.ev(`(()=>{const x=$("pkX").getBoundingClientRect(),h=$("hmodes").getBoundingClientRect(),
    n=$("pname").getBoundingClientRect();return{gap:h.left-x.right,x:getComputedStyle($("pkX")).display,
    nosuf:document.querySelector(".plbl").classList.contains("nosuf"),noext:document.querySelector(".plbl").classList.contains("noext"),nopre:document.querySelector(".plbl").classList.contains("nopre"),sameRow:Math.abs((x.top+x.bottom)/2-(n.top+n.bottom)/2)<3}})()`);
  t.ok(
    r.x !== "none" && r.gap >= 11.5 && r.sameRow,
    "✕ stays, on the title's line, a part gap from the size buttons",
    r,
  );
  t.ok(r.noext && r.nopre && r.nosuf, "gave way before the title: .png, the #, then the number", r);
  await k.shot("narrow-name-line");
}

/* the box's least width is what its bottom row needs (the user, 2026-11-10: in a very narrow box Start overlapped the
   pills — 9 px with the Steps pill on, the least a fixed 360) */
export async function pillsClearStart(k, t) {
  await stepsPillOn(k);
  await k.mouse(2, 2);
  await k.sleep(800);
  for (const o of ["side", "vert"]) {
    if (o === "vert") {
      await k.ev(`(setDock("below"),1)`);
      await k.sleep(1200);
    }
    await k.ev(`(setPaneSize("box","w",200,"${o}"),sizeFrame(),layoutLeft(),1)`); // under any least: clamped to it
    await k.sleep(1200);
    const r = await k.ev(`(()=>{const pl=$("play").getBoundingClientRect(),
      last=[...document.querySelectorAll("#left .pills > .pill")].filter(x=>x.offsetWidth).pop().getBoundingClientRect();
      return {box:Math.round($("left").getBoundingClientRect().width),space:Math.round(pl.left-last.right)}})()`);
    t.ok(r.space >= 8, `${o}: at its least the last pill ends a gap before Start`, r);
  }
}

export async function tabSwitchKeepsTabs(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1000);
  /* a tab switch is live: no View Transition (its pictures of the page couldn't hold glass and took the pointer away,
     2026-10-28) — the tab bar, the prompt and the panels' glass stay the real thing all through it */
  const vt =
    await k.ev(`new Promise(res=>{let n=0;const o=document.startViewTransition;if(o)document.startViewTransition=function(fn){n++;return o.call(document,fn)};
    document.querySelector('.tab[data-v="queue"]').click();setTimeout(()=>{if(o)document.startViewTransition=o;res(n)},900)})`);
  t.ok(vt === 0, "a tab switch takes no pictures of the page: everything stays live", vt);
  await k.ev(`(document.querySelector('.tab[data-v="gen"]').click(),1)`);
  await k.sleep(1200);
  const r = await k.ev(
    `(()=>{const b=document.body,h=document.documentElement;b.classList.add("laysnap");h.classList.add("tabswitch");const o={tabsProp:getComputedStyle(document.querySelector(".tabs")).transitionProperty,thumb:getComputedStyle(document.querySelector(".seg .thumb")).transitionDuration};b.classList.remove("laysnap");h.classList.remove("tabswitch");return o})()`,
  );
  t.ok(/0\.28s/.test(r.thumb), "…the selected tab's pill slides", r);
  t.ok(!/transform/.test(r.tabsProp), "…the tab bar has no glide of its own (it follows the plate)", r);
  // positions relative to the tab bar: the bar itself glides during a switch (reading screen positions mid-glide mixed
  // the two movements up)
  const inBar = sel =>
    `(document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect().left-document.querySelector(".tabs").getBoundingClientRect().left)`;
  const x0 = await k.ev(inBar("#thumb"));
  await k.ev(`(document.querySelector('.tab[data-v="queue"]').click(),1)`);
  await k.sleep(120);
  const x1 = await k.ev(inBar("#thumb")),
    x2 = await k.ev(inBar('.tab[data-v="queue"]'));
  t.motion(x1 > x0 + 2 && x1 < x2 - 2, "mid-switch the pill is on its way (not jumped)", { x0, x1, x2 });
}
export async function tabBarNoTeleport(k, t) {
  await k.job("[fill:446688] one", { steps: 2, ar: "3:4" });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  const trip = to =>
    k.ev(`new Promise(res=>{
      const xs=[],t0=performance.now(),x=()=>document.querySelector(".seg").getBoundingClientRect().left;
      xs.push(x());
      document.querySelector('.tab[data-v="${to}"]').click();
      (function f(){xs.push(x());if(performance.now()-t0<1200)requestAnimationFrame(f);else res(xs)})();
    })`);
  for (const dock of ["left", "right"]) {
    await k.ev(`(setDock("${dock}"),1)`);
    await k.mouse(2, 2);
    await k.sleep(1500);
    for (const to of ["queue", "gen"]) {
      const xs = await trip(to),
        steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i])),
        jump = Math.max(...steps),
        total = Math.abs(xs[xs.length - 1] - xs[0]);
      t.motion(jump <= Math.max(12, total * 0.35), `prompt ${dock}, to ${to}: the tab bar glides, no leap`, {
        jump,
        total,
        first: xs.slice(0, 5).map(Math.round),
      });
      await k.sleep(400);
    }
  }
}
tabBarNoTeleport.opts = { step: 0.05 };

/* v0.7.1 item 10 (the user, 2026-10-27: "the tab bar doesn't respond to fast clicks"): a switch covers the page and Chrome
   sent every click during it to <html> — a second tab clicked mid-switch was lost. Between two panel tabs the bar
   stays put, so the second click lands where it was aimed */
export async function fastTabClicks(k, t) {
  const at = async v => {
    const r = await k.rect(`.tab[data-v="${v}"]`);
    return [r.x + r.width / 2, r.y + r.height / 2];
  };
  const lit = `document.querySelector(".tab.on").dataset.v`;
  await k.click(...(await at("queue")));
  await k.sleep(1500);
  const [lx, ly] = await at("loras"),
    [px, py] = await at("png");
  await k.click(lx, ly);
  t.ok(await k.until(`document.body.classList.contains("laysnap")`, 1000), "the second click comes mid-switch");
  await k.click(px, py);
  t.ok(await k.until(`${lit}==="png"`, 3000), "…and still opens its tab", await k.ev(lit));
  t.ok(await k.until(`!document.body.classList.contains("laysnap")`, 3000), "the switch ends");
  await k.click(...(await at("queue")));
  await k.until(`document.body.classList.contains("laysnap")`, 1000);
  await k.click(...(await at("loras")));
  t.ok(await k.until(`${lit}==="loras"`, 3000), "again, from a page whose bar moves", await k.ev(lit));
}

/* the user, 2026-10-27: "Clear prompt, expand buttons are rendered on top of the pill menus" (a short prompt, a small
   box). A menu's z-index only counts inside the boxes it sits in; those rise while it's open. The ✕ and the expand modes
   are hover-revealed: shown here for the check */
export async function menusOverPromptButtons(k, t) {
  await stepsPillOn(k);
  await k.ev(`(P.value="a cat",draft=P.value,layoutLeft(),1)`);
  await k.sleep(600);
  let checked = 0;
  for (const id of ["MP", "AR", "ST", "SD", "N"]) {
    await k.ev(`(document.getElementById("pop${id}").parentElement.click(),1)`);
    await k.until(`document.getElementById("pop${id}").classList.contains("show")`, 2000);
    await k.sleep(300);
    const r = await k.ev(`(()=>{const P=document.getElementById("pop${id}"),p=P.getBoundingClientRect(),out={};
      for(const s of ["#pclear","#hmodes"]){const e=document.querySelector(s);e.style.opacity="1";e.style.visibility="visible";e.style.pointerEvents="auto";
        const b=e.getBoundingClientRect(),x=(Math.max(p.left,b.left)+Math.min(p.right,b.right))/2,y=(Math.max(p.top,b.top)+Math.min(p.bottom,b.bottom))/2;
        if(b.width&&x>p.left&&x<p.right&&y>p.top&&y<p.bottom&&x>b.left&&x<b.right&&y>b.top&&y<b.bottom)out[s]=P.contains(document.elementFromPoint(x,y));
        e.style.opacity="";e.style.visibility="";e.style.pointerEvents=""}
      return out})()`);
    for (const [s, under] of Object.entries(r)) {
      checked++;
      t.ok(under, `the ${id} menu is over ${s}`);
    }
    await k.ev(`(document.body.click(),1)`);
    await k.sleep(400);
  }
  t.ok(checked > 0, "at least one menu overlaps a prompt button here (the check means something)", checked);
}

/* Gallery → Generating while the render has no picture yet (2026-10-26, the user: "it still scales up as if for a
   transition but there's no next pic to follow"): the old picture fades where it is — not paired with the empty frame */
export async function galleryToStepZeroFades(k, t) {
  await k.job("[fill:446688] done one", { steps: 1, ar: "16:9" });
  await k.until(`jobs.some(j=>j.status==="done")`, 20000);
  await k.job("[fill:884422] slow one", { steps: 30, ar: "3:4" });
  await k.until(`current()&&current().step===0`, 10000, 50);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1200);
  t.ok(await k.ev(`$("frame").classList.contains("has")`), "the Gallery shows the finished picture");
  // the old picture is its copy (#cvx), at its own size: cropped by the frame, never grown into the empty box
  const r =
    await k.ev(`new Promise(res=>{const o={grew:0,seen:0,ow:null,step:null},x=$("cvx"),t0=performance.now();document.querySelector('.tab[data-v="gen"]').click();
    (function s(){if(+getComputedStyle(x).opacity>0.02&&x.width>1){o.seen++;const w=x.getBoundingClientRect().width;if(o.ow==null)o.ow=w;o.grew=Math.max(o.grew,w-o.ow)}
      if(o.step==null)o.step=current()&&current().step;if(performance.now()-t0<900)requestAnimationFrame(s);else{o.end=+getComputedStyle(x).opacity;res(o)}})()})`);
  t.ok(r.step === 0, "Generating at step 0: no preview yet", r);
  t.ok(r.seen > 0 && r.grew <= 1, "the old picture doesn't grow into the empty frame: it is cropped where it is", r);
  t.ok(r.end === 0, "…and it has gone when the switch ends", r);
  // with a preview: the Gallery's picture and the render are different pictures — the same (2026-10-27)
  await k.until(`current()&&current().preview_rev`, 15000, 100);
  await k.sleep(1200);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1200);
  const g =
    await k.ev(`new Promise(res=>{const o={grew:0,seen:0,ow:null,step:null},x=$("cvx"),t0=performance.now();document.querySelector('.tab[data-v="gen"]').click();
    (function s(){if(+getComputedStyle(x).opacity>0.02&&x.width>1){o.seen++;const w=x.getBoundingClientRect().width;if(o.ow==null)o.ow=w;o.grew=Math.max(o.grew,w-o.ow)}
      if(o.step==null)o.step=current()&&current().step;if(performance.now()-t0<900)requestAnimationFrame(s);else{o.end=+getComputedStyle(x).opacity;res(o)}})()})`);
  t.ok(
    g.grew <= 1 && g.end === 0,
    "with a preview: the Gallery's picture is cropped too, never grown into the render",
    g,
  );
}
galleryToStepZeroFades.opts = { step: 4 }; // step 0 must outlast the Gallery visit on a slow machine (CI run 75 reached step 1)

/* Gallery → Generating with a preview to show (2026-10-27, the user: "looks twitchy"): measured per frame — the old
   picture flashed into the new frame for a frame or two (a second cross-fade on top of the switch's), the box
   squeezed the pictures as it changed shape, and the glow trailed the picture by 0.2 s */
export async function galleryToPreviewIsClean(k, t) {
  await k.theme("aurora"); // the skin with a glow round the picture
  await k.setting("glow", "always"); // …shown without a job running too
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 1 });
  await k.until(`jobs.some(j=>j.status==="done")&&!current()`, 20000);
  await k.mouse(2, 2);
  await k.sleep(1500);
  /* per frame: the old picture's copy fades once (never comes back up), both pictures keep their own shape (the box
     crops them), and the glow is on the frame */
  const sw =
    to => `new Promise(res=>{const o={up:0,last:null,squeeze:0,glow:0,n:0},x=$("cvx"),c=$("cv"),f=$("frame"),g=$("fglow"),ar=+f.dataset.tw/+f.dataset.th,t0=performance.now();
    document.querySelector('.tab[data-v="${to}"]').click();
    (function s(){const op=+getComputedStyle(x).opacity;if(o.last!=null&&op>o.last+0.02)o.up=Math.max(o.up,op-o.last);o.last=op;
      const cr=c.getBoundingClientRect();if(+getComputedStyle(c).opacity>0.02&&cr.height>0){const want=+f.dataset.tw/+f.dataset.th;o.squeeze=Math.max(o.squeeze,Math.abs(cr.width/cr.height-want))}
      if(g&&getComputedStyle(g).display!=="none"&&+getComputedStyle(g).opacity>0.02){const fr=f.getBoundingClientRect(),gr=g.getBoundingClientRect();o.glow=Math.max(o.glow,Math.abs(gr.left+95-fr.left),Math.abs(gr.top+95-fr.top),Math.abs(gr.width-190-fr.width));o.n++}
      if(performance.now()-t0<800)requestAnimationFrame(s);else res(o)})()})`;
  const a = await k.ev(sw("gallery"));
  t.ok(a.squeeze < 0.02, "the same picture into the Gallery: never squeezed", a);
  t.motion(a.glow <= 2, "…the glow on the frame every frame", a);
  // another picture: the render, from the Gallery
  await k.job("[fill:446688] square render", { ar: "1:1", steps: 60 });
  await k.until(`current()&&current().preview_rev`, 20000, 100);
  await k.sleep(1500);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1500);
  const b = await k.ev(sw("gen"));
  t.ok(b.up === 0, "one cross-fade: the old picture never comes back into the frame", b);
  t.ok(b.squeeze < 0.02, "…the pictures are cropped, never squeezed", b);
  t.motion(b.glow <= 2, "…and the glow stays on the frame", b);
}
galleryToPreviewIsClean.opts = { step: 0.6 };

/* menus stay fully on screen (the user, 2026-10-27: "ratio pill menu — in a narrow prompt box, the menu goes off the
   screen"): every pill's menu, opened in a narrow window, sits inside it with the window's margin */
export async function menusStayOnScreen(k, t) {
  await stepsPillOn(k);
  for (const w of [640, 900]) {
    await k.send("Emulation.setDeviceMetricsOverride", { width: w, height: 760, deviceScaleFactor: 1, mobile: false });
    await k.ev(`(dispatchEvent(new Event("resize")),1)`);
    await k.sleep(1200);
    for (const id of ["MP", "AR", "ST", "SD", "N"]) {
      await k.ev(`(document.getElementById("p${id}").click(),1)`);
      await k.until(`document.getElementById("pop${id}").classList.contains("show")`, 2000);
      await k.sleep(250);
      const r = await k.ev(
        `(()=>{const b=document.getElementById("pop${id}").getBoundingClientRect();return {l:Math.round(b.left),r:Math.round(b.right),t:Math.round(b.top),b:Math.round(b.bottom),W:innerWidth,H:innerHeight}})()`,
      );
      t.ok(
        r.l >= 19 && r.r <= r.W - 19 && r.t >= 0 && r.b <= r.H,
        `${w} px wide: the ${id} menu is fully on screen`,
        r,
      );
      await k.ev(`(document.body.click(),1)`);
      await k.sleep(300);
    }
  }
}
menusStayOnScreen.opts = { width: 640, height: 760 };

/* Steps live in Settings → Model; the pill on the prompt box is a switch, off by default (2026-10-27, the user: set once
   with a turbo LoRA and never changed — the pill only took room) */
export async function stepsInSettings(k, t) {
  t.ok(await k.ev(`$("pST").hidden&&getComputedStyle($("pST")).display==="none"`), "by default: no Steps pill");
  await k.ev(`(()=>{const i=$("sSteps");i.value="9";i.dispatchEvent(new Event("change"));return 1})()`);
  t.ok(await k.ev(`S.steps===9`), "Settings → Model → Steps sets them");
  await k.ev(`(P.value="one",draft=P.value,addJobs().then(()=>1))`); // not k.job: it sets its own steps
  t.ok(await k.until(`jobs.some(j=>j.steps===9)`, 5000), "…and new jobs use them", await k.ev(`jobs.map(j=>j.steps)`));
  await stepsPillOn(k);
  t.ok(await k.ev(`!$("pST").hidden&&/9/.test($("vST").textContent)`), "switched on: the pill is back, showing them");
  await k.reload();
  t.ok(await k.ev(`!$("pST").hidden&&S.steps===9`), "both are remembered");
}

/* a picture that isn't carried across a switch fades in once the plate lands — its glow waits with it (2026-10-27: the
   glow came first, the picture after) */
export async function glowWaitsForItsPicture(k, t) {
  await k.theme("aurora");
  await k.setting("glow", "always");
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 1 });
  await k.until(`jobs.some(j=>j.status==="done")&&!current()`, 20000);
  await k.job("[fill:446688] square render", { ar: "1:1", steps: 60 });
  await k.until(`current()&&current().preview_rev`, 20000, 100);
  await k.sleep(1500);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1500);
  /* the glow is its picture's: no frame of the switch shows it without a picture on screen (pictures cover as
     1-(1-a)(1-b) in a cross-fade) — it comes in with its picture, on the same clock (morph.js, plate.js) */
  const r =
    await k.ev(`new Promise(res=>{const o={over:0,n:0},g=$("fglow"),c=$("cv"),x=$("cvx"),t0=performance.now();document.querySelector('.tab[data-v="gen"]').click();
    (function s(){if(getComputedStyle(g).display!=="none"){const a=+getComputedStyle(c).opacity,b=x.width>1?+getComputedStyle(x).opacity:0,pic=1-(1-a)*(1-b);if(pic<0.05)o.over=Math.max(o.over,+getComputedStyle(g).opacity);o.n++}
    if(performance.now()-t0<700)requestAnimationFrame(()=>setTimeout(s,0));else res(o)})()})`); // after the frame's writes
  t.ok(r.over <= 0.05, "the glow comes with its picture: never shown without one", r);
  /* how many frames were sampled is the machine's (CI's have no GPU: 4–5 in the window, runs 80–81) — judged here */
  t.motion(r.n > 5, "…sampled across the switch", r);
}
glowWaitsForItsPicture.opts = { step: 0.6 };

/* the browser's form suggestions are off on every field Kiln has (2026-10-31: a name picked from them took the
   browser's autofill look — a dark-blue box, square corners; CSS can't override it). Kiln's own fields, Kiln's look */
export async function fieldsTakeNoAutofill(k, t) {
  await k.ev(`(document.querySelectorAll(".pill").forEach(p=>p.click()),closePops(),1)`); // the pop-ups' fields made
  const bad = await k.ev(
    `[...document.querySelectorAll("input")].filter(i=>!["range","file","checkbox","hidden"].includes(i.type)&&i.autocomplete!=="off").map(i=>i.id||i.className||i.outerHTML.slice(0,60))`,
  );
  t.ok(bad.length === 0, "every text and number field has the browser's suggestions off", bad);
}

/* R1 (the re-read, 2026-11-10): a fade turned back halfway carries on from where it is — no frame jumps (F4 / F5: they
   restarted from 1 or 0). One rule for every fade in the app (fade.js fade; tools/tests/unit/onefade.test.mjs keeps it
   the one way) */
export async function fadeTurnsBackFromScreen(k, t) {
  /* on the animations' own clock (set, not waited: the runner slows animations to measure frames) */
  const r =
    await k.ev(`(()=>{const d=document.createElement("div");Object.assign(d.style,{position:"fixed",left:"10px",top:"10px",width:"50px",height:"50px",background:"#fff"});
    document.body.appendChild(d);const o=()=>+getComputedStyle(d).opacity;
    const [a]=fade(d,0,{duration:400,easing:"linear",fill:"both"});a.pause();a.currentTime=200;const half=o();
    const [b]=fade(d,1,{duration:400,easing:"linear",fill:"both"});b.pause();b.currentTime=0;const start=o();b.currentTime=200;const mid=o();
    const firstGone=a.playState;d.remove();return {half,start,mid,firstGone}})()`);
  t.near(r.half, 0.5, 0.02, "the first fade halfway: 0.5");
  t.near(r.start, r.half, 0.02, "turned back, it starts where the first one was — not from 0", r);
  t.near(r.mid, 0.75, 0.02, "…and goes on from there", r);
  t.ok(r.firstGone === "idle", "the first fade is replaced (one fade per element)", r);
}

/* R2: the box's stand-in in a layout switch is gone once the switch is over — and one interrupted lives out its own
   fade (it was removed at once when a second switch came) */
export async function leavingCopiesGo(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1000);
  await k.ev(`(setDock("right"),1)`);
  await k.sleep(120);
  const mid = await k.ev(`document.querySelectorAll(".standin").length`);
  await k.ev(`(setDock("below"),1)`);
  await k.sleep(30);
  const both = await k.ev(`document.querySelectorAll(".standin").length`);
  await k.sleep(2000);
  const after = await k.ev(`document.querySelectorAll(".standin, [data-copy-of]").length`);
  t.ok(mid === 1, "mid-switch: the box's copy is leaving", mid);
  t.ok(both === 2, "a second switch: the first copy still leaving beside the new one (not cut)", both);
  t.ok(after === 0, "once the switches are over: no copy left", after);
  await k.ev(`(setDock("left"),1)`);
}

/* T4 (the re-read, 2026-11-10): a switch lets go of the layout's hold at its own end — when its motion and its contents'
   fade are over (plate.js end: html.switching goes) — not on a timer (sw.T + 300 ms: in those ~300 ms after it had
   ended, a change jumped instead of gliding) */
export async function switchLetsGoWhenLanded(k, t) {
  await k.job("[fill:446688] a", { ar: "3:4", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.ev(`(document.querySelector('.tab[data-v="queue"]').click(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const r = await k.ev(`new Promise(res=>{const t0=performance.now(),rows=[];
    document.querySelector('.tab[data-v="gallery"]').click();
    (function f(){rows.push({t:performance.now()-t0,sw:document.documentElement.classList.contains("switching"),snap:document.body.classList.contains("laysnap")});
      if(performance.now()-t0<2500)requestAnimationFrame(f);else res(rows)})()})`);
  const ended = r.find((x, i) => i > 0 && r[i - 1].sw && !x.sw)?.t ?? NaN,
    free = r.find(x => x.t >= ended && !x.snap)?.t ?? Infinity;
  t.ok(ended > 50, "the switch ran, then ended", { ended: Math.round(ended) });
  t.ok(free - ended < 60, "the layout's hold lets go as the switch ends (a frame or so — not ~300 ms later)", {
    ended: Math.round(ended),
    free: Math.round(free),
  });
}

/* G1 (2026-11-10): every drag is one gesture — it ends however it ends. The LoRA weight's scrub heard only the button up:
   with its pointer capture lost (a reload, another window) it went on scrubbing; and Esc puts a scrub back */
export async function dragEndsHoweverItEnds(k, t) {
  await k.until(`LORAS.length>0`, 8000);
  await k.ev(
    `(LORAS.forEach(l=>l.on=false),LORAS.find(l=>l.folder!=="people").on=true,LORAS.find(l=>l.folder!=="people").w=1,renderChips(),1)`,
  );
  await k.mouse(2, 2);
  await k.sleep(600);
  const w = () => k.ev(`LORAS.find(l=>l.on).w`);
  const c = await k.rect("#chips .cw"),
    x = c.left + c.width / 2,
    y = c.top + c.height / 2;
  const m = (type, X, b = 1) =>
    k.send("Input.dispatchMouseEvent", { type, x: X, y, button: "left", buttons: b, clickCount: 1 });
  const w0 = await w();
  await m("mouseMoved", x, 0);
  await m("mousePressed", x);
  for (let i = 1; i <= 5; i++) await m("mouseMoved", x + i * 8);
  const w1 = await w();
  /* the capture taken away (whoever holds it) */
  await k.ev(
    `(()=>{for(const e of document.querySelectorAll("*"))if(e.hasPointerCapture&&e.hasPointerCapture(1))e.releasePointerCapture(1);return 1})()`,
  );
  for (let i = 6; i <= 12; i++) await m("mouseMoved", x + i * 8);
  const w2 = await w();
  await m("mouseReleased", x + 96, 0);
  t.ok(w1 !== w0, "scrubbing changes the weight", { w0, w1 });
  t.ok(w2 === w1, "its pointer lost, the scrub is over — moves no longer change it", { w1, w2 });
  /* Esc puts a scrub back */
  await k.sleep(300);
  const c2 = await k.rect("#chips .cw"),
    x2 = c2.left + c2.width / 2;
  const v0 = await w();
  await m("mouseMoved", x2, 0);
  await m("mousePressed", x2);
  for (let i = 1; i <= 5; i++) await m("mouseMoved", x2 + i * 8);
  const v1 = await w();
  await k.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await k.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await m("mouseReleased", x2 + 40, 0);
  t.ok(v1 !== v0 && (await w()) === v0, "Esc mid-scrub puts the weight back", { v0, v1, after: await w() });
}
