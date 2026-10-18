// Vertical layout (prompt below the picture): the prompt box's side edges, Fit to the picture's width; the layout
// switch as a fade-through with nothing gliding underneath.
const R = (k, sel) => k.rect(sel);
const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);
async function press(k, x, y) { await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }) }
async function moveTo(k, x0, y0, x1, y1) { for (let i = 1; i <= 10; i++) await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + (x1 - x0) * i / 10, y: y0 + (y1 - y0) * i / 10, button: "left", buttons: 1 }) }
const release = (k, x, y) => k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });

export async function sideEdges(k, t) {
  await k.ev(`(setDock("below"),1)`); await k.mouse(2, 2);
  await k.until(`!document.body.classList.contains("laysnap")`, 4000, 50); await k.sleep(700);   /* the switch and any glide done: the edge is where it stays */
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
  t.ok(await k.until(`Math.abs($("left").getBoundingClientRect().width-880)<=2`, 3000, 100), "after a restart too", (await R(k, "#left")).width);
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
  // the switch: no slide, and nothing is mid-glide when the new layout is captured (after the page has settled from
  // loading: its own first glides would be reported a frame late and look like the switch's)
  await k.mouse(2, 2); await k.sleep(1500);
  await k.ev(`(window._an=[],document.addEventListener("transitionrun",e=>{if(e.target.closest&&e.target.closest(".app"))_an.push(e.target.id||e.target.className)}),1)`);
  await k.ev(`(setDock("right"),1)`); await k.until(`!document.body.classList.contains("laysnap")`, 3000, 50); await k.sleep(500);
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

export async function columnCap(k, t) {
  await k.ev(`(setDock("below"),1)`); await k.mouse(2, 2); await k.sleep(900);
  await k.ev(`(showView("queue"),1)`); await k.sleep(800);
  const r = await R(k, "#right"), st = await R(k, "#stage"), W = await k.ev(`innerWidth`);
  const cap = (st.height - 66) * 16 / 9 + 2 * 52;
  t.ok(r.width < W - 36 - 50, "Vertical on a wide window: the panel is not edge to edge", { w: r.width, W });
  t.near(r.width, cap, 50, "about a 16:9 box at its height", { w: r.width, cap });
  t.near(r.left + r.width / 2, W / 2, 2, "centred");
  await k.ev(`(setDock("left"),1)`); await k.sleep(900);
  t.ok(await k.ev(`$("right").style.width===""`), "side by side: the grid sizes it again");
}
columnCap.opts = { width: 2400, height: 1000 };

export async function startRing(k, t) {
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".play .pring")).opacity`) === "0", "idle: no ring on Start");
  await k.job("[fill:224433] ring", { steps: 4 });
  t.ok(await k.until(`$("play").classList.contains("gen")`, 10000, 100), "a job runs: Start's triangle takes the flowing gradient");
  t.ok(/playFlow/.test(await k.ev(`getComputedStyle(document.querySelector(".play svg path")).fill`)), "the bar's gradient");
  await k.sleep(300);
  t.ok(!(await k.ev(`$("play").classList.contains("running")`)), "in Generating no ring: the progress bar is right there");
  await k.ev(`(showView("queue"),1)`);
  t.ok(await k.until(`$("play").classList.contains("running")`, 3000, 100), "on another tab the ring shows");
  await k.until(`current()&&current().step>=1`, 15000, 100); await k.sleep(600);
  const p1 = +(await k.ev(`getComputedStyle($("play")).getPropertyValue("--p")`));
  await k.until(`current()&&current().step>=3`, 15000, 100); await k.sleep(600);
  const p2 = +(await k.ev(`getComputedStyle($("play")).getPropertyValue("--p")`));
  t.ok(p1 > 0 && p2 > p1, "it fills with the job's progress", { p1, p2 });
  t.ok(await k.until(`!current()&&!$("play").classList.contains("running")&&!$("play").classList.contains("gen")`, 15000, 100), "done: the ring and the gradient go");
}
startRing.opts = { step: 1 };

export async function edgeOnPicture(k, t) {
  await k.job("[fill:446688] tall", { ar: "3:4", steps: 2 }); await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2); await k.sleep(900);
  const f = await R(k, "#frame"), h = await R(k, ".pedge.ro");
  t.near(h.left + h.width / 2, f.right, 2, "Generating: the outer handle is on the picture's outer edge", { h: h.left + h.width / 2, f: f.right });
  await k.ev(`(showView("queue"),1)`); await k.sleep(700);
  const r = await R(k, "#right"), h2 = await R(k, ".pedge.ro");
  t.near(h2.left + h2.width / 2, r.right, 2, "other tabs: on the panel's edge");
}
edgeOnPicture.opts = { width: 2000, height: 1023, step: 0.05 };

export async function outlineIsFitBox(k, t) {
  await k.ev(`(setDock("right"),1)`); await k.sleep(800);
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 }); await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2); await k.sleep(900);
  await k.ev(`($("right").classList.add("edgehint"),1)`); await k.sleep(100);
  const h = await R(k, "#fithint"), f = await R(k, "#frame");
  t.ok(h.width > 0, "the outline shows");
  for (const [n, d] of [["left", f.left - h.left], ["right", h.right - f.right], ["top", f.top - h.top], ["bottom", h.bottom - f.bottom]]) t.near(d, 12, 1, `an even 12 px round the picture (${n})`);
  await k.ev(`($("right").classList.remove("edgehint"),1)`);
}
outlineIsFitBox.opts = { width: 2000, height: 1023, step: 0.05 };

export async function heightIsALimit(k, t) {
  await k.ev(`(setDock("below"),S.sch=420,save(),P.value="a short prompt",draft=P.value,layoutLeft(),1)`); await k.mouse(2, 2); await k.sleep(800);
  const short = (await R(k, "#left")).height;
  t.ok(short < 380, "a short prompt under a high limit: the box fits the text", short);
  await k.ev(`(P.value=Array(40).fill("a long line of prompt text that keeps going").join(String.fromCharCode(10)),draft=P.value,1)`); await k.sleep(900);
  t.near((await R(k, "#left")).height, 420, 3, "a long prompt: it stops at the limit (and scrolls)");
}
heightIsALimit.opts = { width: 2000, height: 1023 };

export async function runningThumb(k, t) {
  await k.job("[fill:446688] first", { steps: 2 }); await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2); await k.sleep(400);
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".prog .track")).visibility`) === "hidden" || await k.ev(`getComputedStyle(document.querySelector(".prog .track")).display`) === "none", "idle with the result on show: no empty track");
  t.ok(new RegExp("^#" + await k.ev(`lastDone().id`) + " · ").test(await k.ev(`$("ptxt").textContent`)), "but its caption", await k.ev(`$("ptxt").textContent`));
  await k.ev(`(closeShown(),1)`); await k.sleep(600);
  t.ok(await k.ev(`document.body.classList.contains("norow")&&getComputedStyle($("prog")).visibility==="hidden"`), "an empty screen: no status row at all");
  t.ok(/^Next: /.test(await k.ev(`$("idleT").textContent`)) && /per image/.test(await k.ev(`$("idleS").textContent`)), "the frame says what's next and how long it takes", [await k.ev(`$("idleT").textContent`), await k.ev(`$("idleS").textContent`)]);
  await k.mouse(2, 2); const fr = await R(k, "#frame"); await k.mouse(fr.left + 40, fr.top + fr.height / 2); await k.sleep(500);
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".gnav.prev")).opacity==="1"&&!document.querySelector(".gnav.prev").classList.contains("off")`), "and ← into the Gallery is there");
  await k.mouse(2, 2);
  await k.job("[fill:884422] second", { steps: 6 }); await k.until(`current()&&current().preview_rev>0`, 20000, 100);
  t.ok(!(await k.ev(`$("prog").classList.contains("bgjob")`)) && await k.ev(`getComputedStyle(document.querySelector(".prog .track")).visibility`) === "visible", "watching the render: the bar, no chip");
  await k.ev(`(browseTo(lastDone()),1)`); await k.sleep(1500);
  const b = await k.ev(`lastDone().id`), txt = await k.ev(`$("ptxt").textContent`);
  t.ok(new RegExp("^#" + b + " · ").test(txt) && txt.includes(await k.ev(`lastDone().file`)), "browsing: the row is the picture's caption", txt);
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".prog .track")).visibility`) === "hidden", "no bar under a finished picture");
  t.ok(await k.ev(`getComputedStyle($("pchip")).display`) !== "none", "the running job is a chip at the row's end");
  t.ok(await k.until(`$("pthImg").naturalWidth>0`, 8000, 100), "with its live render");
  t.ok(/^\d\/6/.test(await k.ev(`$("pchipT").textContent`)), "and its step", await k.ev(`$("pchipT").textContent`));
  t.ok(await k.until(`$("play").classList.contains("running")`, 2000, 100), "the ring on Start shows (the bar is out of sight)");
  await k.ev(`($("pchip").click(),1)`); await k.sleep(400);
  t.ok(await k.ev(`browseId===null&&!$("prog").classList.contains("bgjob")`), "clicking the chip goes back to the render");
}
runningThumb.opts = { step: 1.2 };

export async function slotIsFixed(k, t) {
  await k.ev(`(setDock("below"),1)`); await k.mouse(2, 2); await k.sleep(800);
  const L = String.fromCharCode(10);
  await k.job("[fill:446688] one line", { ar: "16:9", steps: 2 }); await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=1`, 30000);
  await k.job("[fill:446688] three" + L + "SCENE:" + L + "lines of prompt text, and more, and more", { ar: "16:9", steps: 2 }); await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.ev(`(browseTo(doneList()[0]),1)`); await k.sleep(900); const a = await R(k, "#frame");
  await k.ev(`(genNav(1),1)`); await k.sleep(900); const b = await R(k, "#frame");
  t.ok(Math.abs(a.top - b.top) < 1 && Math.abs(a.height - b.height) < 1 && Math.abs(a.left - b.left) < 1, "Vertical: browsing prompts of different lengths never moves or resizes the picture", { a: [a.left, a.top, a.height], b: [b.left, b.top, b.height] });
  t.ok(await k.ev(`getComputedStyle($("hmFull")).display`) === "none", "no Full height in Vertical");
}
slotIsFixed.opts = { width: 2000, height: 1023, step: 0.05 };

export async function textFillsBox(k, t) {
  await k.ev(`(P.value=Array(6).fill("word").join(" ").repeat(30),draft=P.value,1)`); await k.sleep(600);
  const r = await k.ev(`(()=>{const L=$("left").getBoundingClientRect(),c=document.querySelector(".pwrapT .cm-line").getBoundingClientRect(),rg=document.createRange();rg.selectNodeContents(document.querySelector(".pwrapT .cm-line"));const rs=[...rg.getClientRects()];return{box:L.right,text:Math.max(...rs.map(x=>x.right))}})()`);
  t.ok(r.box - r.text < 70, "a long prompt's lines run to the box's right side (no ~76-character cap)", r);
}
textFillsBox.opts = { width: 2400, height: 1000 };

export async function arrowsHold(k, t) {
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 }); await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=1`, 30000);
  await k.job("[fill:884422] tall", { ar: "3:4", steps: 2 }); await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  t.ok(await k.ev(`document.querySelector(".tab").dataset.v==="gallery"&&document.querySelectorAll(".tab")[1].dataset.v==="gen"`), "Gallery is the tab left of Generating (the tabs read like the timeline)");
  const on = () => k.ev(`document.querySelector(".tab.on").dataset.v`);
  t.ok(await on() === "gen" && await k.ev(`browseId===null`), "at the start: Generating, the live view");
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`); await k.sleep(400);
  t.ok(await on() === "gallery" && await k.ev(`browseId===lastDone().id`), "clicking Gallery: the last finished picture, Gallery lit");
  await k.ev(`(genNav(1),1)`); await k.sleep(500);
  t.ok(await on() === "gen" && await k.ev(`browseId===null`), "stepping past the newest: back to Generating");
  await k.ev(`(genNav(-1),1)`); await k.sleep(500);
  t.ok(await on() === "gallery", "stepping back from the render lights Gallery");
  await k.ev(`(document.querySelector('.tab[data-v="gen"]').click(),1)`); await k.sleep(400);
  t.ok(await on() === "gen" && await k.ev(`browseId===null`), "clicking Generating: the live view again");
  t.ok(await k.ev(`!$("frame").classList.contains("has")`), "idle, it's clean — the picture lives in the Gallery, not shown twice");
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`); await k.mouse(2, 2); await k.sleep(900);
  const f = await R(k, "#frame"); await k.mouse(f.left + 30, f.top + f.height / 2); await k.sleep(500);
  const p0 = await R(k, ".gnav.prev");
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".gnav.prev")).opacity`) === "1", "hovering the picture shows the arrows");
  t.near(p0.left, f.left + 10, 2, "at the picture's edge");
  const x = p0.left + p0.width / 2, y = p0.top + p0.height / 2;
  await k.mouse(x, y); await k.sleep(150); await k.click(x, y); await k.sleep(500);
  const p1 = await R(k, ".gnav.prev"), f1 = await R(k, "#frame");
  t.ok(Math.abs(f1.width / f1.height - f.width / f.height) > .3, "the picture changed shape", { f: [f.width, f.height], f1: [f1.width, f1.height] });
  t.near(p1.left, p0.left, 1, "the arrow under the pointer held still");
  await k.sleep(1500);
  const p2 = await R(k, ".gnav.prev"), f2 = await R(k, "#frame");
  t.near(p2.left, f2.left + 10, 2, "a moment after the last click it moved to the new picture's edge");
}
arrowsHold.opts = { width: 2000, height: 1023, step: 0.05 };

export async function crossFade(k, t) {
  await k.job("[fill:446688] one", { ar: "16:9", steps: 2 }); await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=1`, 30000);
  await k.job("[fill:884422] two", { ar: "3:4", steps: 2 }); await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.sleep(800);
  await k.ev(`(window._xo=[],genNav(-1),(function f(n){_xo.push(+getComputedStyle($("cvx")).opacity);if(n)requestAnimationFrame(()=>f(n-1))})(30),1)`); await k.sleep(1200);
  const xo = await k.ev(`_xo`);
  t.ok(xo.some(v => v > 0.5), "the picture on show stays, as a layer over the next", xo.slice(0, 12));
  t.ok(xo[xo.length - 1] < 0.05, "and fades out", xo.slice(-4));
  t.ok(await k.ev(`$("cv").width>2`), "the new one is drawn under it");
}
crossFade.opts = { width: 2000, height: 1023, step: 0.05 };
