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
  t.ok(
    await k.ev(`+($("lcol").dataset.dy||0)<0`),
    "Vertical: the prompt column is shifted up (even gaps) — the case that hid the title",
    await k.ev(`$("lcol").dataset.dy`),
  );
  t.ok(await hit(k, "#pname"), "the title takes the pointer in Generating");
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1200);
  t.ok(await hit(k, "#pname"), "…and in the Gallery (rename)");
  await k.ev(
    `(document.head.insertAdjacentHTML("beforeend",'<style id="mut">.app.stacked .stage,.app.stacked #v-gen,.app.stacked>.right,.app.stacked .rpanel{pointer-events:auto!important}</style>'),1)`,
  );
  t.ok(!(await hit(k, "#pname")), "(check: without the fix the picture area's empty box covers it)");
  await k.ev(`($("mut").remove(),1)`);
  const f = await k.rect("#frame");
  await k.mouse(f.left + f.width / 2, f.bottom + 2);
  await k.sleep(400);
  t.ok(
    await k.ev(`document.elementFromPoint(${f.left + f.width / 2},${f.bottom + 2}).classList.contains("hedge")`),
    "the picture's bottom edge still takes the pointer",
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
  await k.ev(`(setDock("below"),1)`);
  await k.sleep(1000);
  await k.ev(`(toast("again"),1)`);
  await k.sleep(300);
  const t2 = await k.rect("#toast"),
    W = await k.ev(`innerWidth`);
  t.ok(t2.top < 40 && W - t2.right < 40, "Vertical: top right", t2);
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
    `(document.querySelector(".pedge.ri").dispatchEvent(new PointerEvent("pointermove",{bubbles:true,clientX:${x + 60},clientY:${y},buttons:0})),1)`,
  );
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
  const h = await k.rect("#cardhint"),
    L = await k.rect("#left"),
    O = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--outline-out"))`);
  t.ok(await k.ev(`$("cardhint").classList.contains("show")`), "pressing the box: the outline shows");
  const off = [L.top - h.top, L.left - h.left, h.right - L.right, h.bottom - L.bottom];
  t.ok(
    off.every(d => Math.abs(d - O) <= 1),
    "round the plate (the box), one outline gap outside it on every side (the outline rule, 2026-10-27)",
    { off, O },
  );
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await k.sleep(100);
  t.ok(await k.ev(`!$("cardhint").classList.contains("show")`), "letting go: it goes");
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

export async function dockZonesGlass(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1000);
  const blur = () =>
    k.ev(
      `[...document.querySelectorAll(".dockzone")].map(z=>parseFloat(getComputedStyle(z).backdropFilter.split("blur(")[1]||"0"))`,
    );
  await k.ev(`(document.querySelectorAll(".dockzone").forEach(z=>z.classList.add("show")),1)`);
  await k.sleep(40);
  const early = await blur();
  await k.sleep(600);
  const late = await blur();
  t.ok(
    early.every(b => b < 14) && late.every(b => b > 15.5),
    "all three condense in: the glass blur grows from nothing",
    { early, late },
  );
  t.ok(
    await k.ev(`[...document.querySelectorAll(".dockzone")].every(z=>getComputedStyle(z).opacity==="1")`),
    "never by opacity (it would switch the glass off)",
  );
  t.ok(
    await k.ev(`[...document.querySelectorAll(".dockzone")].every(z=>getComputedStyle(z).paddingTop==="0px")`),
    "none picks up the prompt box's styles through a class name",
  );
  await k.ev(`(document.querySelectorAll(".dockzone").forEach(z=>z.classList.remove("show")),1)`);
  await k.sleep(40);
  t.ok(
    await k.ev(`getComputedStyle(document.querySelector(".dockzone")).display!=="none"`),
    "letting go: they fade back out rather than vanish",
  );
  await k.sleep(600);
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".dockzone")).display==="none"`), "…and are gone after");
}

export async function promptEdges(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1000);
  await k.ev(
    `(P.value=Array(40).fill("a long line of prompt text").join(String.fromCharCode(10)),draft=P.value,layoutLeft(),1)`,
  );
  await k.sleep(800);
  const w = () => k.ev(`[...$("prompt").parentElement.classList].join(" ")`);
  t.ok(
    /more/.test(await w()) && !/scrolled/.test(await w()),
    "overflowing, at the top: the bottom fades, the top doesn't",
    await w(),
  );
  await k.ev(`(document.querySelector(".pwrapT .cm-scroller").scrollTop=99999,1)`);
  await k.sleep(300);
  t.ok(
    /scrolled/.test(await w()) && !/more/.test(await w()),
    "scrolled to the end: the top fades, the bottom doesn't",
    await w(),
  );
}

/* modeless (2026-10-27, the user): a shown picture's prompt has no bar — change anything (a pill, a LoRA, the text) and
   it becomes your draft (random seed, Undo); ✕ sits at the end of its file name and the title never moves */
export async function peekModeless(k, t) {
  await stepsPillOn(k);
  await k.job("[fill:446688] one", { steps: 2, name: "Harbour" });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(`(S.steps=7,S.ar="16:9",S.pname="",$("pname").value="",P.value="something else",draft=P.value,save(),1)`);
  await k.sleep(300);
  const y0 = (await k.rect("#pname")).top;
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(800);
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
  await k.ev(`(S.lay.pw=360,sizeFrame(),layoutLeft(),document.querySelector('.tab[data-v="gallery"]').click(),1)`);
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

export async function tabSwitchKeepsTabs(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1000);
  const r =
    await k.ev(`(()=>{const h=document.documentElement,b=document.body;h.classList.add("tabmorph","laymorph");b.classList.add("laysnap");
   const o={app:getComputedStyle(document.querySelector(".app")).viewTransitionName,panel:getComputedStyle($("rpanel")).viewTransitionName,view:getComputedStyle(document.querySelector(".rpanel > .view.on")).viewTransitionName,prompt:getComputedStyle($("lcol")).viewTransitionName,tabs:getComputedStyle(document.querySelector(".tabs")).transitionDuration,tabsProp:getComputedStyle(document.querySelector(".tabs")).transitionProperty,thumb:getComputedStyle(document.querySelector(".seg .thumb")).transitionDuration};
   h.classList.remove("tabmorph","laymorph");b.classList.remove("laysnap");return o})()`);
  t.ok(
    r.app === "none" && r.view === "kiln-panel",
    "a tab switch fades only the content under the tabs (the tab bar and the prompt stay live)",
    r,
  );
  /* the panel itself is never named: a named element is a backdrop root, so its glass went clear for the whole switch,
     then the blur popped in (2026-10-27) */
  t.ok(r.panel === "none", "…and the panel stays live: its glass blurs through the switch", r);
  t.ok(/0\.28s/.test(r.thumb), "…and the selected tab's pill slides", r);
  t.ok(
    r.prompt === "none" && !/transform/.test(r.tabsProp),
    "the prompt box slides live (its glass too — no snapshot); the tab bar has no glide of its own (it follows the plate)",
    r,
  );
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

/* a tab switch: the tab bar goes straight from where it was to its new place — it used to leap sideways with its column,
   then slide back (2026-10-26, the user's note). Sampled per frame: no step bigger than a glide's */
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
  t.ok(
    await k.until(`document.documentElement.classList.contains("laymorph")`, 1000),
    "the second click comes mid-switch",
  );
  await k.click(px, py);
  t.ok(await k.until(`${lit}==="png"`, 3000), "…and still opens its tab", await k.ev(lit));
  t.ok(await k.until(`!document.documentElement.classList.contains("laymorph")`, 3000), "the switch ends");
  await k.click(...(await at("queue")));
  await k.until(`document.documentElement.classList.contains("laymorph")`, 1000);
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
  const r = await k.ev(`new Promise(res=>{document.querySelector('.tab[data-v="gen"]').click();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=document.getAnimations().map(a=>a.effect&&a.effect.pseudoElement||"").filter(Boolean);
      res({group:a.filter(p=>p==="::view-transition-group(kiln-pic)").length,old:a.filter(p=>p==="::view-transition-old(kiln-pic)").length,step:current()&&current().step,has:$("frame").classList.contains("has")})}))})`);
  t.ok(r.step === 0, "Generating at step 0: no preview yet", r);
  t.ok(r.group === 0, "the old picture doesn't grow into the empty frame (no box morph)", r);
  t.ok(r.old > 0, "…it fades out where it is", r);
  // with a preview: the Gallery's picture and the render are different pictures — still not paired (2026-10-27)
  await k.until(`current()&&current().preview_rev`, 15000, 100);
  await k.sleep(1200);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1200);
  const g = await k.ev(`new Promise(res=>{document.querySelector('.tab[data-v="gen"]').click();
    requestAnimationFrame(()=>requestAnimationFrame(()=>res(document.getAnimations().filter(a=>a.effect&&a.effect.pseudoElement==="::view-transition-group(kiln-pic)").length)))})`);
  t.ok(g === 0, "with a preview: the Gallery's picture doesn't grow into the render either (another picture)", g);
}
galleryToStepZeroFades.opts = { step: 1.5 };

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
  const sw = to => `new Promise(res=>{const o={cvx:0,dur:{},fit:""},t0=performance.now();
    document.querySelector('.tab[data-v="${to}"]').click();
    (function s(){o.cvx=Math.max(o.cvx,+getComputedStyle($("cvx")).opacity);
      for(const a of document.getAnimations()){const p=a.effect&&a.effect.pseudoElement;if(p&&/group\\((kiln-pic|kiln-glow)\\)/.test(p))o.dur[p]=a.effect.getComputedTiming().duration}
      if(!o.fit&&document.documentElement.classList.contains("laymorph"))o.fit=getComputedStyle(document.documentElement,"::view-transition-old(kiln-pic)").objectFit;
      if(performance.now()-t0<700)requestAnimationFrame(s);else res(o)})()})`;
  // the SAME picture (just finished, on Generating) into the Gallery: it travels — on the glow's clock, cropped
  const a = await k.ev(sw("gallery"));
  const d = Object.values(a.dur);
  t.ok(d.length === 2 && d[0] === d[1], "the same picture travels, the glow on its clock", a.dur);
  t.ok(a.fit === "cover", "the changing box crops the pictures, never squeezes them", a.fit);
  // another picture: the render, from the Gallery
  await k.job("[fill:446688] square render", { ar: "1:1", steps: 60 });
  await k.until(`current()&&current().preview_rev`, 20000, 100);
  await k.sleep(1500);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1500);
  const b = await k.ev(sw("gen"));
  t.ok(b.cvx === 0, "no second cross-fade: the old picture never flashes into the new frame", b);
  t.ok(
    !b.dur["::view-transition-group(kiln-pic)"],
    "the Gallery's picture and the render aren't paired (no zoom)",
    b.dur,
  );
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
  const r =
    await k.ev(`new Promise(res=>{const o={},t0=performance.now();document.querySelector('.tab[data-v="gen"]').click();
    (function s(){for(const a of document.getAnimations()){const p=a.effect&&a.effect.pseudoElement;if(p&&/kiln-(glow|pic)/.test(p))o[p+" "+(a.animationName||"")]=a.effect.getTiming().delay}
    o.picout=document.documentElement.classList.contains("picout");if(performance.now()-t0<500)requestAnimationFrame(s);else res(o)})()})`);
  const glowIn = r["::view-transition-new(kiln-glow) -ua-view-transition-fade-in"];
  t.ok(r.picout && glowIn != null, "the Gallery's picture and the render: not carried across, the glow comes along", r);
  t.ok(glowIn >= 200, "…and the new glow waits for its picture", glowIn);
}
glowWaitsForItsPicture.opts = { step: 0.6 };
