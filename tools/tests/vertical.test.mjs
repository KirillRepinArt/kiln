// Vertical layout (prompt below the picture): the prompt box's side edges, Fit to the picture's width; the layout
// switch as a fade-through with nothing gliding underneath.
const R = (k, sel) => k.rect(sel);
const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);
async function press(k, x, y) { await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }) }
async function moveTo(k, x0, y0, x1, y1) { for (let i = 1; i <= 10; i++) await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + (x1 - x0) * i / 10, y: y0 + (y1 - y0) * i / 10, button: "left", buttons: 1 }) }
const release = (k, x, y) => k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });

export async function sideEdges(k, t) {
  await k.ev(`(setDock("below"),1)`); await k.mouse(2, 2); await k.sleep(900);
  const L0 = await R(k, "#left"), mid = await k.ev(`innerWidth/2`);
  t.near(L0.width, 760, 2, "Vertical: the box starts at its default width");
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".sedge.r")).display`) === "block", "it has side edges");
  // drag the right edge 120 px right: the left edge stays put while dragging, then the box glides back to centre
  const h = await R(k, ".sedge.r"), x = h.left + h.width / 2, y = h.top + h.height / 2;
  await press(k, x, y); await moveTo(k, x, y, x + 120, y);
  const Ld = await R(k, "#left");
  t.near(Ld.left, L0.left, 2, "while dragging, the opposite edge holds still");
  t.near(Ld.width, L0.width + 120, 2, "and the box follows the cursor");
  await release(k, x + 120, y); await k.mouse(2, 2); await k.sleep(700);
  const L1 = await R(k, "#left");
  t.near(L1.left + L1.width / 2, mid, 2, "on release it is centred again");
  t.near(L1.width, 880, 2, "at the new width");
  t.near((await R(k, "#chips")).width, 880, 2, "the LoRA row follows the box");
  t.near(await k.ev(`S.lay.sw`), 880, 1, "remembered");
  await k.send("Page.reload", {}); await k.sleep(800); await k.until("!!(window.LIVE&&window._jobsReady)", 15000); await k.sleep(800);
  t.near((await R(k, "#left")).width, 880, 2, "after a restart too");
  // double-click: back to the default
  const h2 = await R(k, ".sedge.l");
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x: h2.left + 6, y: h2.top + 40, button: "left", clickCount: 2 });
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: h2.left + 6, y: h2.top + 40, button: "left", clickCount: 2 });
  await k.ev(`(document.querySelector(".sedge.l").dispatchEvent(new MouseEvent("dblclick",{bubbles:true})),1)`); await k.sleep(600);
  t.near((await R(k, "#left")).width, 760, 2, "double-click an edge: the default width");
  // beside the picture the side edges are gone (the panel edges do that job)
  await k.ev(`(setDock("left"),1)`); await k.sleep(800);
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".sedge.r")).display`) === "none", "Horizontal: no side edges of their own");
}
sideEdges.opts = { width: 2000, height: 1023 };

export async function fitWidth(k, t) {
  await k.job("[fill:446688] wide", { ar: "21:9", steps: 2 }); await done(k, 1);
  await k.ev(`(setDock("below"),1)`); await k.mouse(2, 2); await k.sleep(900);
  t.ok(await k.ev(`getComputedStyle($("hmMatch")).display!=="none"`), "Vertical: the Fit width button is there");
  t.ok(/width/.test(await k.ev(`$("hmMatch").dataset.tip`)), "it says what it does", await k.ev(`$("hmMatch").dataset.tip`));
  await k.ev(`($("hmMatch").click(),1)`); await k.mouse(2, 2); await k.sleep(800);
  const f = await R(k, "#frame"), L = await R(k, "#left");
  t.near(L.width, f.width, 3, "Fit width: the box is as wide as the picture", { box: L.width, pic: f.width });
  t.near(L.left, f.left, 3, "and lined up with it");
  t.near(f.left + f.width / 2, await k.ev(`innerWidth/2`), 2, "the picture itself sits on the centre line (its column hangs beside it)");
  t.ok(await k.ev(`$("hmMatch").classList.contains("on")`), "the button shows it's on");
  await k.ev(`($("hmMatch").click(),1)`); await k.sleep(700);
  t.near((await R(k, "#left")).width, 760, 2, "off: back to your width");
  await k.ev(`(setDock("left"),1)`); await k.sleep(800);
  t.ok(/height/.test(await k.ev(`$("hmMatch").dataset.tip`)), "beside the picture it is Match height again");
}
fitWidth.opts = { width: 2000, height: 1023, step: 0.05 };

export async function switchFades(k, t) {
  // the switch: no slide, and nothing is mid-glide when the new layout is captured
  await k.ev(`(window._an=[],document.addEventListener("transitionrun",e=>{if(e.target.closest&&e.target.closest(".app"))_an.push(e.target.id||e.target.className)}),1)`);
  await k.ev(`(setDock("right"),1)`); await k.sleep(900);
  const ran = await k.ev(`_an`);
  t.ok(ran.length === 0, "no layout glide runs during a switch (the fade does it all)", ran.slice(0, 8));
  t.ok(await k.until(`!document.documentElement.classList.contains("laymorph")&&!document.body.classList.contains("laysnap")`, 2500, 100), "the switch cleans up after itself");
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".app")).viewTransitionName`) === "none", "outside a switch the app has no transition name (it would cut the glass off from the sky)");
  const L = await R(k, "#left"), Rr = await R(k, "#right");
  t.ok(L.left > Rr.right, "and the prompt ended up on the right");
}
switchFades.opts = { width: 2000, height: 1023 };

export async function tabsOnPicture(k, t) {
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 }); await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2); await k.sleep(900);
  const seg = await R(k, ".seg"), f = await R(k, "#frame"), tabs = await k.ev(`(()=>{const k=document.querySelector(".tabs").children,a=k[0].getBoundingClientRect(),b=k[k.length-1].getBoundingClientRect();return{l:a.left,r:b.right}})()`);
  t.near((tabs.l + tabs.r) / 2, f.left + f.width / 2, 2, "side by side: the tab bar is centred on the picture itself", { tabs, f: [f.left, f.width] });
  await k.ev(`(showView("queue"),1)`); await k.sleep(700);
  const r = await R(k, "#right"), tabs2 = await k.ev(`(()=>{const k=document.querySelector(".tabs").children,a=k[0].getBoundingClientRect(),b=k[k.length-1].getBoundingClientRect();return{l:a.left,r:b.right}})()`);
  t.near((tabs2.l + tabs2.r) / 2, r.left + r.width / 2, 2, "Queue: centred over the panel");
}
tabsOnPicture.opts = { width: 2000, height: 1023, step: 0.05 };
