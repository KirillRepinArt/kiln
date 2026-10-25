// v0.5 quick list (notes of 2026-10-24): the Vertical title, privacy with no picture, clear buttons, toasts by the
// prompt, drags that always end, the press outline, Start while a job runs.
const done = (k, n = 1) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);
const hit = (k, sel) => k.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}),r=e.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e})()`);

export async function verticalTitleClicks(k, t) {
  await k.ev(`(setDock("below"),1)`); await k.sleep(900);
  await k.job("[fill:335577] one", { ar: "16:9", steps: 2, name: "Castle" }); await done(k); await k.mouse(2, 2); await k.sleep(1200);
  t.ok(await k.ev(`+($("lcol").dataset.dy||0)<0`), "Vertical: the prompt column is shifted up (even gaps) — the case that hid the title", await k.ev(`$("lcol").dataset.dy`));
  t.ok(await hit(k, "#pname"), "the title takes the pointer in Generating");
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`); await k.sleep(1200);
  t.ok(await hit(k, "#pname"), "…and in the Gallery (rename)");
  await k.ev(`(document.head.insertAdjacentHTML("beforeend",'<style id="mut">.app.stacked .stage,.app.stacked #v-gen,.app.stacked>.right,.app.stacked .rpanel{pointer-events:auto!important}</style>'),1)`);
  t.ok(!(await hit(k, "#pname")), "(check: without the fix the picture area's empty box covers it)");
  await k.ev(`($("mut").remove(),1)`);
  const f = await k.rect("#frame"); await k.mouse(f.left + f.width / 2, f.bottom + 2); await k.sleep(400);
  t.ok(await k.ev(`document.elementFromPoint(${f.left + f.width / 2},${f.bottom + 2}).classList.contains("hedge")`), "the picture's bottom edge still takes the pointer");
}
verticalTitleClicks.opts = { width: 1872, height: 1080, step: 0.05 };

export async function privacyWithNoPicture(k, t) {
  const f = await k.rect("#frame"); await k.mouse(f.left + f.width / 2, f.top + f.height / 2); await k.sleep(400);
  t.ok(await k.ev(`!$("frame").classList.contains("has")&&getComputedStyle($("cbtn")).display!=="none"&&+getComputedStyle($("cbtn")).opacity>.9`), "the eye is on the empty frame (on hover)");
  await k.ev(`($("cbtn").click(),1)`); await k.sleep(200);
  t.ok(await k.ev(`document.body.classList.contains("private")&&getComputedStyle(document.querySelector(".pwrapT .cm-editor")).visibility==="hidden"`), "it hides the prompt");
}

export async function clearButtons(k, t) {
  await k.mouse(2, 2); await k.sleep(1200);
  await k.ev(`(P.value="a prompt worth keeping",draft=P.value,updPrompt(),1)`);
  const l = await k.rect("#left"); await k.mouse(l.left + 40, l.top + 40); await k.sleep(300);
  t.ok(+(await k.ev(`getComputedStyle($("pclear")).opacity`)) > .9, "the prompt's ✕ shows while it has text");
  await k.ev(`($("pclear").click(),1)`); await k.sleep(300);
  t.ok(await k.ev(`P.value===""&&draft===""`), "one click clears it");
  t.ok(await k.ev(`$("toastBtn").textContent==="Undo"`), "with Undo");
  await k.ev(`($("toastBtn").click(),1)`); await k.sleep(300);
  t.ok(await k.ev(`P.value==="a prompt worth keeping"&&draft===P.value`), "Undo brings it back");
  await k.ev(`(showView("loras"),$("lsearch").value="zzz",$("lsearch").oninput(),1)`); await k.sleep(300);
  t.ok(await k.ev(`getComputedStyle($("lsClear")).display!=="none"`), "the LoRA search has a ✕ while it has text");
  await k.ev(`($("lsClear").click(),1)`); await k.sleep(200);
  t.ok(await k.ev(`$("lsearch").value===""&&getComputedStyle($("lsClear")).display==="none"`), "it clears the search");
}

export async function toastsByThePrompt(k, t) {
  await k.mouse(2, 2); await k.sleep(1200);
  await k.ev(`(toast("hello"),1)`); await k.sleep(300);
  const [tr, lr, cr] = [await k.rect("#toast"), await k.rect("#left"), await k.rect("#lcol .controls")];
  t.near(tr.left + tr.width / 2, lr.left + lr.width / 2, 2, "side by side: centred on the prompt column");
  t.ok(tr.bottom < cr.top || tr.top > cr.bottom, "never over the controls", { tr, cr });
  await k.ev(`(setDock("below"),1)`); await k.sleep(1000); await k.ev(`(toast("again"),1)`); await k.sleep(300);
  const t2 = await k.rect("#toast"), W = await k.ev(`innerWidth`);
  t.ok(t2.top < 40 && W - t2.right < 40, "Vertical: top right", t2);
}

export async function dragsAlwaysEnd(k, t) {
  await k.mouse(2, 2); await k.sleep(1200);
  const e = await k.rect(".pedge.ri"); const x = e.left + e.width / 2, y = e.top + e.height / 2;
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + 30, y, button: "left", buttons: 1 }); await k.sleep(100);
  t.ok(await k.ev(`document.body.classList.contains("resizing")`), "dragging an edge: the resize cursor");
  await k.ev(`(document.querySelector(".pedge.ri").dispatchEvent(new PointerEvent("pointermove",{bubbles:true,clientX:${x + 60},clientY:${y},buttons:0})),1)`); await k.sleep(150);   // the release got lost: the next move has no button
  t.ok(await k.ev(`!document.body.classList.contains("resizing")&&!lay.drag`), "a move without the button ends it (no stuck cursor, nothing follows the pointer)");
}

export async function pressOutline(k, t) {
  await k.mouse(2, 2); await k.sleep(1200);
  const tt = await k.rect("#ltitle"); const x = tt.left + 30, y = tt.top + tt.height - 14;   // the name line, off the name itself
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }); await k.sleep(250);
  const h = await k.rect("#cardhint"), tr = await k.rect("#ltitle"), L = await k.rect("#left");
  t.ok(await k.ev(`$("cardhint").classList.contains("show")`), "pressing the box: the outline shows");
  t.ok(h.top <= tr.top - 8 && h.bottom >= L.bottom + 8, "round the whole block: the title, the box and the LoRAs", { h, tr, L });
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); await k.sleep(100);
  t.ok(await k.ev(`!$("cardhint").classList.contains("show")`), "letting go: it goes");
}

export async function startWhileRunning(k, t) {
  await k.job("a slow one", { steps: 20 }); await k.until(`!!current()`, 20000, 100); await k.sleep(800);
  const s = await k.ev(`(()=>{const p=getComputedStyle($("play")),b=getComputedStyle($("badge"),"::before");return{anim:p.animationName,bg:p.backgroundImage.slice(0,40),fill:getComputedStyle(document.querySelector("#play svg path")).fill,ring:b.content!=="none"&&b.display!=="none"}})()`);
  t.ok(s.anim === "flow" && /gradient/.test(s.bg), "the whole button flows with the progress bar's gradient", s);
  t.ok(/255, 255, 255/.test(s.fill), "the triangle: bright while working (dark when idle)", s);
  t.ok(s.ring, "a ring round the queue count", s);
}
startWhileRunning.opts = { step: 1 };

export async function dockZonesGlass(k, t) {
  await k.mouse(2, 2); await k.sleep(1000);
  const blur = () => k.ev(`[...document.querySelectorAll(".dockzone")].map(z=>parseFloat(getComputedStyle(z).backdropFilter.split("blur(")[1]||"0"))`);
  await k.ev(`(document.querySelectorAll(".dockzone").forEach(z=>z.classList.add("show")),1)`); await k.sleep(40);
  const early = await blur(); await k.sleep(600); const late = await blur();
  t.ok(early.every(b => b < 14) && late.every(b => b > 15.5), "all three condense in: the glass blur grows from nothing", { early, late });
  t.ok(await k.ev(`[...document.querySelectorAll(".dockzone")].every(z=>getComputedStyle(z).opacity==="1")`), "never by opacity (it would switch the glass off)");
  t.ok(await k.ev(`[...document.querySelectorAll(".dockzone")].every(z=>getComputedStyle(z).paddingTop==="0px")`), "none picks up the prompt box's styles through a class name");
  await k.ev(`(document.querySelectorAll(".dockzone").forEach(z=>z.classList.remove("show")),1)`); await k.sleep(40);
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".dockzone")).display!=="none"`), "letting go: they fade back out rather than vanish");
  await k.sleep(600); t.ok(await k.ev(`getComputedStyle(document.querySelector(".dockzone")).display==="none"`), "…and are gone after");
}

export async function promptEdges(k, t) {
  await k.mouse(2, 2); await k.sleep(1000);
  await k.ev(`(P.value=Array(40).fill("a long line of prompt text").join(String.fromCharCode(10)),draft=P.value,layoutLeft(),1)`); await k.sleep(800);
  const w = () => k.ev(`[...$("prompt").parentElement.classList].join(" ")`);
  t.ok(/more/.test(await w()) && !/scrolled/.test(await w()), "overflowing, at the top: the bottom fades, the top doesn't", await w());
  await k.ev(`(document.querySelector(".pwrapT .cm-scroller").scrollTop=99999,1)`); await k.sleep(300);
  t.ok(/scrolled/.test(await w()) && !/more/.test(await w()), "scrolled to the end: the top fades, the bottom doesn't", await w());
}

export async function narrowReuseRow(k, t) {
  await k.job("[fill:446688] one", { steps: 2 }); await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(`(S.lay.pw=380,sizeFrame(),layoutLeft(),document.querySelector('.tab[data-v="gallery"]').click(),1)`); await k.mouse(2, 2); await k.sleep(1200);
  const r = await k.ev(`(()=>{const a=$("peekbar").getBoundingClientRect(),b=$("hmodes").getBoundingClientRect();return{narrow:$("ltitle").classList.contains("tnarrow"),overlap:!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top),sameRow:Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2)<6}})()`);
  t.ok(r.narrow && !r.overlap && r.sameRow, "a narrow box: the Reuse bar and the size buttons share one row, no overlap", r);
  await k.shot("narrow-row");
}

export async function tabSwitchKeepsTabs(k, t) {
  await k.mouse(2, 2); await k.sleep(1000);
  const r = await k.ev(`(()=>{const h=document.documentElement,b=document.body;h.classList.add("tabmorph","laymorph");b.classList.add("laysnap");
   const o={app:getComputedStyle(document.querySelector(".app")).viewTransitionName,panel:getComputedStyle($("rpanel")).viewTransitionName,prompt:getComputedStyle($("lcol")).viewTransitionName,tabs:getComputedStyle(document.querySelector(".tabs")).transitionDuration,thumb:getComputedStyle(document.querySelector(".seg .thumb")).transitionDuration};
   h.classList.remove("tabmorph","laymorph");b.classList.remove("laysnap");return o})()`);
  t.ok(r.app === "none" && r.panel === "kiln-panel", "a tab switch fades only the content under the tabs (the tab bar and the prompt stay live)", r);
  t.ok(/0\.28s/.test(r.thumb), "…and the selected tab's pill slides", r);
  t.ok(r.prompt === "kiln-prompt" && /0\.42s/.test(r.tabs), "the prompt box slides as a snapshot, the tab bar glides (no jump between the tabs' widths)", r);
  // positions relative to the tab bar: the bar itself glides during a switch (reading screen positions mid-glide mixed
  // the two movements up)
  const inBar = sel => `(document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect().left-document.querySelector(".tabs").getBoundingClientRect().left)`;
  const x0 = await k.ev(inBar("#thumb"));
  await k.ev(`(document.querySelector('.tab[data-v="queue"]').click(),1)`); await k.sleep(120);
  const x1 = await k.ev(inBar("#thumb")), x2 = await k.ev(inBar('.tab[data-v="queue"]'));
  t.motion(x1 > x0 + 2 && x1 < x2 - 2, "mid-switch the pill is on its way (not jumped)", { x0, x1, x2 });
}
