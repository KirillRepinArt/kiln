// Vertical layout (prompt below the picture): the prompt box's side edges, Fit to the picture's width; the layout
// switch as a fade-through with nothing gliding underneath.
const R = (k, sel) => k.rect(sel);
const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);
async function press(k, x, y) {
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
}
async function moveTo(k, x0, y0, x1, y1) {
  for (let i = 1; i <= 10; i++)
    await k.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x0 + ((x1 - x0) * i) / 10,
      y: y0 + ((y1 - y0) * i) / 10,
      button: "left",
      buttons: 1,
    });
}
const release = (k, x, y) =>
  k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });

export async function sideEdges(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.until(`!document.body.classList.contains("laysnap")`, 4000, 50);
  await k.sleep(700); /* the switch and any glide done: the edge is where it stays */
  const L0 = await R(k, "#left"),
    mid = await k.ev(`innerWidth/2`);
  t.near(L0.width, 760, 2, "Vertical: the box starts at its default width");
  t.ok((await k.ev(`getComputedStyle(document.querySelector(".sedge.r")).display`)) === "block", "it has side edges");
  // drag the right edge 120 px right: the left edge stays put while dragging, then the box glides back to centre
  const h = await R(k, ".sedge.r"),
    x = h.left + h.width / 2,
    y = h.top + h.height / 2;
  await press(k, x, y);
  await moveTo(k, x, y, x + 120, y);
  const Ld = await R(k, "#left");
  t.near(Ld.left, L0.left, 2, "while dragging, the opposite edge holds still");
  t.near(Ld.width, L0.width + 120, 2, "and the box follows the cursor");
  await release(k, x + 120, y);
  await k.mouse(2, 2);
  await k.sleep(700);
  const L1 = await R(k, "#left");
  t.near(L1.left + L1.width / 2, mid, 2, "on release it is centred again");
  t.near(L1.width, 880, 2, "at the new width");
  t.near((await R(k, "#chips")).width, 880, 2, "the LoRA row follows the box");
  t.near(await k.ev(`S.lay.sw`), 880, 1, "remembered");
  await k.send("Page.reload", {});
  await k.sleep(800);
  await k.until("!!(window.LIVE&&window._jobsReady)", 15000);
  await k.sleep(800);
  t.ok(
    await k.until(`Math.abs($("left").getBoundingClientRect().width-880)<=2`, 3000, 100),
    "after a restart too",
    (await R(k, "#left")).width,
  );
  // double-click: back to the default
  const h2 = await R(k, ".sedge.l");
  await k.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: h2.left + 6,
    y: h2.top + 40,
    button: "left",
    clickCount: 2,
  });
  await k.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: h2.left + 6,
    y: h2.top + 40,
    button: "left",
    clickCount: 2,
  });
  await k.ev(`(document.querySelector(".sedge.l").dispatchEvent(new MouseEvent("dblclick",{bubbles:true})),1)`);
  await k.sleep(600);
  t.near((await R(k, "#left")).width, 760, 2, "double-click an edge: the default width");
  // beside the picture the side edges are gone (the panel edges do that job)
  await k.ev(`(setDock("left"),1)`);
  await k.sleep(800);
  t.ok(
    (await k.ev(`getComputedStyle(document.querySelector(".sedge.r")).display`)) === "none",
    "Horizontal: no side edges of their own",
  );
}
sideEdges.opts = { width: 2000, height: 1023 };

export async function fitWidth(k, t) {
  await k.job("[fill:446688] wide", { ar: "21:9", steps: 2 });
  await done(k, 1);
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(900);
  t.ok(await k.ev(`getComputedStyle($("hmMatch")).display!=="none"`), "Vertical: the Fit width button is there");
  t.ok(
    /width/.test(await k.ev(`$("hmMatch").dataset.tip`)),
    "it says what it does",
    await k.ev(`$("hmMatch").dataset.tip`),
  );
  await k.ev(`($("hmMatch").click(),1)`);
  await k.mouse(2, 2);
  await k.sleep(800);
  const f = await R(k, "#frame"),
    L = await R(k, "#left");
  t.near(L.width, f.width, 3, "Fit width: the box is as wide as the picture", { box: L.width, pic: f.width });
  t.near(L.left, f.left, 3, "and lined up with it");
  t.near(
    f.left + f.width / 2,
    await k.ev(`innerWidth/2`),
    2,
    "the picture itself sits on the centre line (its column hangs beside it)",
  );
  t.ok(await k.ev(`$("hmMatch").classList.contains("on")`), "the button shows it's on");
  await k.ev(`($("hmMatch").click(),1)`);
  await k.sleep(700);
  t.near((await R(k, "#left")).width, 760, 2, "off: back to your width");
  await k.ev(`(setDock("left"),1)`);
  await k.sleep(800);
  t.ok(/height/.test(await k.ev(`$("hmMatch").dataset.tip`)), "beside the picture it is Match height again");
}
fitWidth.opts = { width: 2000, height: 1023, step: 0.05 };

export async function switchFades(k, t) {
  // the switch: no slide, and nothing is mid-glide when the new layout is captured (after the page has settled from
  // loading: its own first glides would be reported a frame late and look like the switch's)
  await k.mouse(2, 2);
  await k.sleep(1500);
  await k.ev(
    `(window._an=[],document.addEventListener("transitionrun",e=>{if(e.target.closest&&e.target.closest(".app"))_an.push(e.target.id||e.target.className)}),1)`,
  );
  await k.ev(`(setDock("right"),1)`);
  await k.until(`!document.body.classList.contains("laysnap")`, 3000, 50);
  await k.sleep(500);
  const ran = await k.ev(`_an`);
  t.ok(ran.length === 0, "no layout glide runs during a switch (the fade does it all)", ran.slice(0, 8));
  t.ok(
    await k.until(
      `!document.documentElement.classList.contains("laymorph")&&!document.body.classList.contains("laysnap")`,
      2500,
      100,
    ),
    "the switch cleans up after itself",
  );
  t.ok(
    (await k.ev(`getComputedStyle(document.querySelector(".app")).viewTransitionName`)) === "none",
    "outside a switch the app has no transition name (it would cut the glass off from the sky)",
  );
  const L = await R(k, "#left"),
    Rr = await R(k, "#right");
  t.ok(L.left > Rr.right, "and the prompt ended up on the right");
}
switchFades.opts = { width: 2000, height: 1023 };

export async function tabsOnPicture(k, t) {
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2);
  await k.sleep(900);
  const f = await R(k, "#frame"),
    tabs = await k.ev(
      `(()=>{const k=document.querySelector(".tabs").children,a=k[0].getBoundingClientRect(),b=k[k.length-1].getBoundingClientRect();return{l:a.left,r:b.right}})()`,
    );
  t.near((tabs.l + tabs.r) / 2, f.left + f.width / 2, 2, "side by side: the tab bar is centred on the picture itself", {
    tabs,
    f: [f.left, f.width],
  });
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(700);
  const r = await R(k, "#right"),
    tabs2 = await k.ev(
      `(()=>{const k=document.querySelector(".tabs").children,a=k[0].getBoundingClientRect(),b=k[k.length-1].getBoundingClientRect();return{l:a.left,r:b.right}})()`,
    );
  t.near((tabs2.l + tabs2.r) / 2, r.left + r.width / 2, 2, "Queue: centred over the panel");
}
tabsOnPicture.opts = { width: 2000, height: 1023, step: 0.05 };

export async function columnCap(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(900);
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(800);
  const r = await R(k, "#right"),
    st = await R(k, "#stage"),
    W = await k.ev(`innerWidth`);
  const cap = ((st.height - 66) * 16) / 9 + 2 * 52;
  t.ok(r.width < W - 36 - 50, "Vertical on a wide window: the panel is not edge to edge", { w: r.width, W });
  t.near(r.width, cap, 50, "about a 16:9 box at its height", { w: r.width, cap });
  t.near(r.left + r.width / 2, W / 2, 2, "centred");
  await k.ev(`(setDock("left"),1)`);
  await k.sleep(900);
  t.ok(await k.ev(`$("right").style.width===""`), "side by side: the grid sizes it again");
}
columnCap.opts = { width: 2400, height: 1000 };

export async function startRing(k, t) {
  const ring = `getComputedStyle(document.querySelector('.tab[data-v="gen"] .trw')).display!=="none"`;
  t.ok(!(await k.ev(ring)), "idle: no ring on the Generating tab");
  await k.job("[fill:224433] ring", { steps: 4 });
  t.ok(
    await k.until(`$("play").classList.contains("gen")`, 10000, 100),
    "a job runs: Start takes the flowing gradient (v0.5: the whole button, the triangle white)",
  );
  t.ok(await k.ev(`getComputedStyle($("play")).animationName==="flow"`), "the bar's gradient, flowing");
  t.ok(await k.until(ring, 3000, 100), "the Generating tab shows the job's progress ring");
  t.ok(
    await k.ev(`getComputedStyle(document.querySelector(".play .pring")).display==="none"`),
    "Start carries no ring (the Generating tab has it)",
  );
  t.ok(
    await k.ev(`getComputedStyle(document.querySelector(".controls .play .badge")).display!=="none"`),
    "but the queue count is on Start, where you add to the queue",
  );
  await k.ev(`(showView("queue"),1)`);
  t.ok(await k.ev(ring), "on another tab too");
  await k.until(`current()&&current().step>=1`, 15000, 100);
  await k.sleep(600);
  const p1 = +(await k.ev(`getComputedStyle(document.documentElement).getPropertyValue("--p")`));
  await k.until(`current()&&current().step>=3`, 15000, 100);
  await k.sleep(600);
  const p2 = +(await k.ev(`getComputedStyle(document.documentElement).getPropertyValue("--p")`));
  t.ok(p1 > 0 && p2 > p1, "it fills with the job's progress", { p1, p2 });
  t.ok(
    await k.until(
      `!current()&&!document.body.classList.contains("jobrun")&&!$("play").classList.contains("gen")`,
      15000,
      100,
    ),
    "done: the ring and the gradient go",
  );
}
startRing.opts = { step: 1 };

export async function edgeOnPicture(k, t) {
  await k.job("[fill:446688] tall", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2);
  await k.sleep(900);
  const f = await R(k, "#frame"),
    h = await R(k, ".pedge.ro");
  t.near(h.left + h.width / 2, f.right, 2, "Generating: the outer handle is on the picture's outer edge", {
    h: h.left + h.width / 2,
    f: f.right,
  });
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(700);
  const r = await R(k, "#right"),
    h2 = await R(k, ".pedge.ro");
  t.near(h2.left + h2.width / 2, r.right, 2, "other tabs: on the panel's edge");
}
edgeOnPicture.opts = { width: 2000, height: 1023, step: 0.05 };

export async function outlineIsFitBox(k, t) {
  await k.ev(`(setDock("right"),1)`);
  await k.sleep(800);
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2);
  await k.sleep(900);
  await k.ev(`($("right").classList.add("edgehint"),1)`);
  await k.sleep(100);
  const h = await R(k, "#fithint"),
    f = await R(k, "#frame");
  t.ok(h.width > 0, "the outline shows");
  for (const [n, d] of [
    ["left", f.left - h.left],
    ["right", h.right - f.right],
    ["top", f.top - h.top],
    ["bottom", h.bottom - f.bottom],
  ])
    t.near(d, 12, 1, `an even 12 px round the picture (${n})`);
  await k.ev(`($("right").classList.remove("edgehint"),1)`);
}
outlineIsFitBox.opts = { width: 2000, height: 1023, step: 0.05 };

export async function heightIsALimit(k, t) {
  await k.ev(`(setDock("below"),S.sch=420,save(),P.value="a short prompt",draft=P.value,layoutLeft(),1)`);
  await k.mouse(2, 2);
  await k.sleep(800);
  const short = (await R(k, "#left")).height;
  t.near(short, 420, 3, "a short prompt: the box fills its slot (2026-10-24 — no dead space under it)");
  await k.ev(
    `(P.value=Array(40).fill("a long line of prompt text that keeps going").join(String.fromCharCode(10)),draft=P.value,1)`,
  );
  await k.sleep(900);
  t.near((await R(k, "#left")).height, 420, 3, "a long prompt: it stops at the limit (and scrolls)");
}
heightIsALimit.opts = { width: 2000, height: 1023 };

export async function runningThumb(k, t) {
  await k.job("[fill:446688] first", { steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.ev(`(closeShown(),1)`);
  await k.mouse(2, 2);
  await k.sleep(600);
  t.ok(
    await k.ev(`document.body.classList.contains("norow")&&getComputedStyle($("prog")).visibility==="hidden"`),
    "an empty screen: no status row at all",
  );
  t.ok(
    /^Next: /.test(await k.ev(`$("idleT").textContent`)) &&
      /^Estimated time: ~/.test(await k.ev(`$("idleS").textContent`)),
    "the frame says what's next and the estimated time, as proper lines",
    [await k.ev(`$("idleT").textContent`), await k.ev(`$("idleS").textContent`)],
  );
  const fr = await R(k, "#frame");
  await k.mouse(fr.left + 40, fr.top + fr.height / 2);
  await k.sleep(500);
  t.ok(
    await k.ev(
      `getComputedStyle(document.querySelector(".gnav.prev")).opacity==="1"&&!document.querySelector(".gnav.prev").classList.contains("off")`,
    ),
    "and ← into the Gallery is there",
  );
  await k.mouse(2, 2);
  await k.job("[fill:884422] second", { steps: 6 });
  await k.until(`current()&&current().preview_rev>0`, 20000, 100);
  await k.sleep(400);
  t.ok(
    await k.ev(
      `!document.body.classList.contains("norow")&&getComputedStyle(document.querySelector(".prog .track")).visibility==="visible"`,
    ),
    "watching the render: the bar",
  );
  await k.ev(`(browseTo(lastDone()),1)`);
  await k.sleep(900);
  t.ok(
    await k.ev(`document.body.classList.contains("norow")`),
    "browsing during a job: no row under the picture (no caption, no chip)",
  );
  t.ok(
    await k.ev(`getComputedStyle(document.querySelector('.tab[data-v="gen"] .trw')).display!=="none"`),
    "the job's progress is on the Generating tab",
  );
  t.ok(
    /^Rendering #\d+ · step \d\/6/.test(await k.ev(`document.querySelector('.tab[data-v="gen"]').dataset.tip`)),
    "its tooltip says which job and how far",
    await k.ev(`document.querySelector('.tab[data-v="gen"]').dataset.tip`),
  );
  await k.ev(`(document.querySelector('.tab[data-v="gen"]').click(),1)`);
  await k.sleep(400);
  t.ok(
    await k.ev(`PV.browse===null&&document.body.dataset.pic==="live"`),
    "clicking it: Generating shows the render (the live view)",
  );
}
runningThumb.opts = { step: 1.2 };

export async function slotIsFixed(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(800);
  const L = String.fromCharCode(10);
  await k.job("[fill:446688] one line", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=1`, 30000);
  await k.job("[fill:446688] three" + L + "SCENE:" + L + "lines of prompt text, and more, and more", {
    ar: "16:9",
    steps: 2,
  });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.ev(`(browseTo(doneList()[0]),1)`);
  await k.sleep(900);
  const a = await R(k, "#frame");
  await k.ev(`(genNav(1),1)`);
  await k.sleep(900);
  const b = await R(k, "#frame");
  t.ok(
    Math.abs(a.top - b.top) < 1 && Math.abs(a.height - b.height) < 1 && Math.abs(a.left - b.left) < 1,
    "Vertical: browsing prompts of different lengths never moves or resizes the picture",
    { a: [a.left, a.top, a.height], b: [b.left, b.top, b.height] },
  );
  t.ok((await k.ev(`getComputedStyle($("hmFull")).display`)) === "none", "no Full height in Vertical");
}
slotIsFixed.opts = { width: 2000, height: 1023, step: 0.05 };

export async function textFillsBox(k, t) {
  await k.ev(`(P.value=Array(6).fill("word").join(" ").repeat(30),draft=P.value,1)`);
  await k.sleep(600);
  const r = await k.ev(
    `(()=>{const L=$("left").getBoundingClientRect(),c=document.querySelector(".pwrapT .cm-line").getBoundingClientRect(),rg=document.createRange();rg.selectNodeContents(document.querySelector(".pwrapT .cm-line"));const rs=[...rg.getClientRects()];return{box:L.right,text:Math.max(...rs.map(x=>x.right))}})()`,
  );
  t.ok(r.box - r.text < 70, "a long prompt's lines run to the box's right side (no ~76-character cap)", r);
}
textFillsBox.opts = { width: 2400, height: 1000 };

export async function arrowsHold(k, t) {
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=1`, 30000);
  await k.job("[fill:884422] tall", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.job("[fill:228844] wide again", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=3`, 30000);
  t.ok(
    await k.ev(
      `document.querySelector(".tab").dataset.v==="gallery"&&document.querySelectorAll(".tab")[1].dataset.v==="gen"`,
    ),
    "Gallery is the tab left of Generating (the tabs read like the timeline)",
  );
  const on = () => k.ev(`document.querySelector(".tab.on").dataset.v`);
  t.ok((await on()) === "gen" && (await k.ev(`PV.browse===null`)), "at the start: Generating, the live view");
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(400);
  t.ok(
    (await on()) === "gallery" && (await k.ev(`PV.browse===lastDone().id`)),
    "clicking Gallery: the last finished picture, Gallery lit",
  );
  await k.ev(`(genNav(1),1)`);
  await k.sleep(500);
  t.ok((await on()) === "gen" && (await k.ev(`PV.browse===null`)), "stepping past the newest: back to Generating");
  await k.ev(`(genNav(-1),1)`);
  await k.sleep(500);
  t.ok((await on()) === "gallery", "stepping back from the render lights Gallery");
  await k.ev(`(document.querySelector('.tab[data-v="gen"]').click(),1)`);
  await k.sleep(400);
  t.ok(
    (await on()) === "gen" && (await k.ev(`PV.browse===null&&document.body.dataset.pic==="empty"`)),
    "clicking Generating, idle: the clean frame (the live view)",
  );
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.mouse(2, 2);
  await k.sleep(900);
  const f = await R(k, "#frame");
  await k.mouse(f.left + 30, f.top + f.height / 2);
  await k.sleep(500);
  const p0 = await R(k, ".gnav.prev");
  t.ok(
    (await k.ev(`getComputedStyle(document.querySelector(".gnav.prev")).opacity`)) === "1",
    "hovering the picture shows the arrows",
  );
  t.near(p0.left, f.left + 10, 2, "at the picture's edge");
  const x = p0.left + p0.width / 2,
    y = p0.top + p0.height / 2;
  await k.mouse(x, y);
  await k.sleep(150);
  await k.click(x, y);
  await k.sleep(500);
  const p1 = await R(k, ".gnav.prev"),
    f1 = await R(k, "#frame");
  t.ok(Math.abs(f1.width / f1.height - f.width / f.height) > 0.3, "the picture changed shape", {
    f: [f.width, f.height],
    f1: [f1.width, f1.height],
  });
  t.near(p1.left, p0.left, 1, "the arrow under the pointer held still");
  await k.sleep(1500);
  t.near((await R(k, ".gnav.prev")).left, p0.left, 1, "it stays as long as the pointer is on it — no timer");
  await k.mouse(x, y + 120);
  await k.sleep(700);
  const p2 = await R(k, ".gnav.prev"),
    f2 = await R(k, "#frame");
  t.near(p2.left, f2.left + 10, 2, "moving off it, it slides to the new picture's edge");
}
arrowsHold.opts = { width: 2000, height: 1023, step: 0.05 };

export async function crossFade(k, t) {
  await k.job("[fill:446688] one", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=1`, 30000);
  await k.job("[fill:884422] two", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.sleep(800);
  await k.ev(
    `(window._xo=[],genNav(-1),(function f(n){_xo.push(+getComputedStyle($("cvx")).opacity);if(n)requestAnimationFrame(()=>f(n-1))})(30),1)`,
  );
  await k.sleep(1200);
  const xo = await k.ev(`_xo`);
  t.ok(
    xo.some(v => v > 0.5),
    "the picture on show stays, as a layer over the next",
    xo.slice(0, 12),
  );
  t.ok(xo[xo.length - 1] < 0.05, "and fades out", xo.slice(-4));
  t.ok(await k.ev(`$("cv").width>2`), "the new one is drawn under it");
}
crossFade.opts = { width: 2000, height: 1023, step: 0.05 };

export async function simpleRename(k, t) {
  const { readFileSync, existsSync } = await import("node:fs"),
    { join } = await import("node:path");
  await k.job("[fill:446688] one", { ar: "16:9", steps: 2, name: "Castle" });
  await k.until(`!current()&&jobs.some(j=>j.status==="done"&&j.file)`, 30000);
  const f0 = await k.ev(`lastDone().file`);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(600);
  await k.ev(`(document.querySelector(".plbl").dispatchEvent(new MouseEvent("mouseenter")),1)`);
  t.ok(
    await k.ev(
      `$("fnPre").textContent==="#"+lastDone().id&&$("pname").value==="Castle"&&$("fnSuf").textContent==="-001.png"&&document.querySelector(".plbl").classList.contains("fnon")`,
    ),
    "hovering the title: it stays as it is, its number and .png appear beside it",
    [await k.ev(`$("fnPre").textContent`), await k.ev(`$("pname").value`), await k.ev(`$("fnSuf").textContent`)],
  );
  t.ok(
    (await k.ev(`getComputedStyle($("pname")).backgroundColor`)) === "rgba(0, 0, 0, 0)",
    "no plate on hover (only while editing)",
    await k.ev(`getComputedStyle($("pname")).backgroundColor`),
  );
  await k.ev(`(document.querySelector(".plbl").dispatchEvent(new MouseEvent("mouseleave")),1)`);
  t.ok((await k.ev(`$("pname").value`)) === "Castle", "and the title again when you leave");
  await k.ev(`($("pname").focus(),$("pname").value="Rome",$("pname").dispatchEvent(new Event("input")),1)`);
  t.ok(
    await k.ev(`$("pnSave").classList.contains("show")&&$("pnSave").textContent==="Rename"`),
    "editing it offers Rename",
  );
  await k.ev(`($("pnSave").click(),1)`);
  t.ok(
    await k.until(`lastDone().file==="rome-001.png"`, 6000, 100),
    "the file joins the series you typed, as its next number",
    await k.ev(`lastDone().file`),
  );
  t.ok(existsSync(join(k.out, "rome-001.png")) && !existsSync(join(k.out, f0)), "renamed on disk");
  t.ok(
    readFileSync(join(k.out, "rome-001.png")).includes("Rome") &&
      !readFileSync(join(k.out, "rome-001.png")).includes("Castle"),
    "the name inside the PNG follows",
  );
  await k.ev(`($("toastBtn").click(),1)`);
  t.ok(await k.until(`lastDone().file===${JSON.stringify(f0)}`, 6000, 100), "Undo puts it back under its old name");
  t.ok(existsSync(join(k.out, f0)), "on disk too");
}
simpleRename.opts = { step: 0.05 };

export async function reuseLeavesClean(k, t) {
  await k.job("[fill:446688] one", { steps: 2 });
  await k.job("[fill:884422] two", { steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),genNav(-1),1)`);
  await k.sleep(500);
  await k.ev(`($("pkPrompt").style.display==="none"?$("pkAll").click():$("pkPrompt").click(),1)`);
  await k.sleep(600);
  t.ok(
    await k.ev(
      `PV.browse===null&&PV.still&&PV.still.kind==="reference"&&peekJob===null&&$("frame").classList.contains("has")&&!P.readOnly&&document.querySelector(".tab.on").dataset.v==="gen"`,
    ),
    "Reuse from the Gallery: Generating, you edit your draft with that picture on show as the reference",
  );
  await k.ev(`(closeShown(),1)`);
  await k.sleep(400);
  t.ok(await k.ev(`PV.browse===null&&!$("frame").classList.contains("has")`), "✕ closes it: a clean Generating");
  // the outline: in at once, out late and slowly
  await k.ev(`($("right").classList.add("edgehint"),1)`);
  await k.sleep(400);
  t.ok(+(await k.ev(`getComputedStyle($("fithint")).opacity`)) > 0.9, "the outline comes in");
  await k.ev(`($("right").classList.remove("edgehint"),1)`);
  await k.sleep(150);
  t.ok(
    +(await k.ev(`getComputedStyle($("fithint")).opacity`)) > 0.9,
    "and is still there a moment after you leave (no blinking as you cross an edge)",
  );
  await k.sleep(1000);
  t.ok(+(await k.ev(`getComputedStyle($("fithint")).opacity`)) < 0.05, "then fades out");
}
reuseLeavesClean.opts = { step: 0.05 };

export async function glowAndDip(k, t) {
  await k.theme("aurora");
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await k.job("[fill:884422] tall", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  // the top / bottom edges show the outline on hover
  await k.mouse(2, 2);
  await k.sleep(400);
  const he = await R(k, ".hedge.t");
  await k.mouse(he.left + he.width / 2, he.top + 6);
  await k.sleep(500);
  t.motion(+(await k.ev(`getComputedStyle($("fithint")).opacity`)) > 0.9, "hovering the top edge shows the outline");
  await k.mouse(2, 2);
  // breathing: browsing to another shape dips the box
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(500);
  await k.ev(`(genNav(-1),1)`);
  await k.sleep(60);
  t.ok(await k.ev(`$("frame").classList.contains("morph")`), "a picture of another shape: crop, then reveal");
  await k.sleep(800);
  t.ok(
    await k.ev(`!$("frame").classList.contains("morph")&&+getComputedStyle($("cvx")).opacity<.05`),
    "it ends clean: the old picture gone, the frame free again",
  );
  // the glow while a job runs, wherever you are
  await k.ev(`(endPeek(),1)`);
  await k.job("[fill:224433] r", { steps: 20 });
  await k.until(`current()&&current().step>=1`, 20000, 100);
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(1500);
  const g = await k.ev(
    `(()=>{const f=$("fglow"),r=f.getBoundingClientRect(),p=$("rpanel").getBoundingClientRect();return{shown:f.style.display!=="none"&&+f.style.opacity>0,around:Math.abs((r.left+r.width/2)-(p.left+p.width/2))<4}})()`,
  );
  t.ok(!g.shown, "on the Queue tab no glow (only round the live render — 2026-10-19)", g);
}
glowAndDip.opts = { width: 1872, height: 1080, step: 1 };

export async function evenGaps(k, t) {
  await k.theme("aurora");
  await k.ev(`(setDock("below"),1)`);
  await k.sleep(900);
  await k.job("[fill:335577] one", { ar: "16:9", steps: 2, name: "Hogwarts Castle" });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  const m = () =>
    k.ev(
      `(()=>{const s=document.querySelector(".seg").getBoundingClientRect(),f=$("frame").getBoundingClientRect(),p=$("prog").getBoundingClientRect(),n=$("pname").getBoundingClientRect(),run=!document.body.classList.contains("norow");return{above:Math.round(f.top-s.bottom),below:Math.round(n.top-(run?p.bottom:f.bottom))}})()`,
    );
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  let g = await m();
  t.ok(
    Math.abs(g.above - g.below) <= 2,
    "Vertical, Gallery: the title is as far under the picture as the picture is under the tab bar",
    g,
  );
  await k.ev(`(endPeek(),1)`);
  await k.job("[fill:224433] r", { steps: 30 });
  await k.until(`current()&&current().step>=1`, 30000, 100);
  await k.sleep(1200);
  g = await m();
  t.ok(Math.abs(g.above - g.below) <= 2, "…and while rendering, under the progress bar", g);
}
evenGaps.opts = { width: 1872, height: 1080, step: 0.5 };

export async function verticalHeight(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(900);
  await k.job("[fill:446688] tall", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.sleep(800);
  const f0 = await R(k, "#frame"),
    h = await R(k, ".hedge.b"),
    x = h.left + h.width / 2,
    y = h.top + h.height / 2;
  t.ok(h.width > 0, "Vertical: the picture has its bottom edge");
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 10; i++)
    await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: y - 15 * i, button: "left", buttons: 1 });
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y: y - 150, button: "left", clickCount: 1 });
  await k.mouse(2, 2);
  await k.sleep(800);
  const f1 = await R(k, "#frame");
  t.near(f1.height, f0.height - 150, 3, "dragging it up makes the picture smaller", { f0: f0.height, f1: f1.height });
  t.ok(await k.ev(`S.lay.vih>0&&!S.lay.ih`), "Vertical remembers its own limit");
  await k.ev(`(setDock("left"),1)`);
  await k.sleep(900);
  t.ok((await R(k, "#frame")).height > f1.height + 50, "side by side is unaffected");
}
verticalHeight.opts = { width: 1872, height: 1080, step: 0.05 };

export async function lateFixes(k, t) {
  await k.job("[fill:446688] tall", { ar: "3:4", steps: 2 });
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1000);
  // the curve: one continuous move — the box never stands still before it lands
  const r = await k.ev(
    `new Promise(res=>{const out=[];const t0=performance.now();genNav(-1);(function f(t){const b=$("frame").getBoundingClientRect();out.push([t-t0,b.width,b.height]);if(t-t0<600)requestAnimationFrame(f);else res(out)})(performance.now())})`,
  );
  const mid = r.filter(x => x[0] > 120 && x[0] < 420),
    still = mid.filter(
      (x, i) => i && Math.abs(x[1] - mid[i - 1][1]) < 0.05 && Math.abs(x[2] - mid[i - 1][2]) < 0.05,
    ).length;
  t.motion(mid.length > 8 && still <= 1, "crop-then-reveal is one continuous move (no stop at the middle box)", {
    frames: mid.length,
    still,
  });
  // the edit column reacts to hover even while its buttons are hidden
  await k.mouse(2, 2);
  await k.sleep(500);
  const g = await R(k, "#gtools");
  await k.mouse(g.left + g.width / 2, g.top + 30);
  await k.sleep(400);
  t.ok(await k.ev(`$("stage").classList.contains("tools")`), "hovering the edit buttons' column shows them");
  await k.mouse(2, 2);
  // the Reuse bar sits ~9 px above the box
  const pb = await R(k, "#peekbar"),
    L = await R(k, "#left");
  t.near(L.top - pb.bottom, 9, 2, "the Reuse bar ~9 px above the prompt box", { gap: L.top - pb.bottom });
  // Vertical: a side edge scales the picture
  await k.ev(`(endPeek(),setDock("below"),1)`);
  await k.until(`!document.body.classList.contains("laysnap")`, 4000, 50);
  await k.sleep(700);
  const f0 = await R(k, "#frame"),
    h = await R(k, ".hedge.r"),
    x = h.left + h.width / 2,
    y = h.top + h.height / 2;
  t.ok(h.width > 0, "Vertical: the picture has side edges");
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 10; i++)
    await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x - 8 * i, y, button: "left", buttons: 1 });
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x - 80, y, button: "left", clickCount: 1 });
  await k.mouse(2, 2);
  await k.sleep(800);
  const f1 = await R(k, "#frame");
  t.ok(
    f1.width < f0.width - 100 && Math.abs(f1.width / f1.height - f0.width / f0.height) < 0.02,
    "dragging it in makes the picture smaller, its shape kept",
    { f0: [f0.width, f0.height], f1: [f1.width, f1.height] },
  );
}
lateFixes.opts = { width: 1872, height: 1080, step: 0.05 };

/* Vertical: the box fills its slot; its bottom edge sizes the slot, following the pointer, then the layout settles */
export async function verticalBoxBottom(k, t) {
  await k.ev(`(setDock("below"),P.value="short",draft=P.value,1)`);
  await k.job("[fill:446688] sq", { ar: "1:1", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(`(P.value="short",draft=P.value,layoutLeft(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const slot = await k.ev(
    `Math.max(200,Math.min(S.sch||Math.min(250,Math.round(innerHeight*.42)),Math.round(innerHeight*.7)))`,
  );
  t.near(
    (await k.rect("#left")).height,
    slot,
    2,
    "a short prompt: the box still fills its slot (no dead space under it)",
  );
  const e = await k.rect(".vedge"),
    x = e.left + e.width / 2,
    y = e.top + e.height / 2,
    b0 = (await k.rect("#left")).bottom,
    p0 = (await k.rect("#frame")).height;
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 6; i++) {
    await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: y + 10 * i, button: "left", buttons: 1 });
    await k.sleep(30);
  }
  t.near((await k.rect("#left")).bottom, b0 + 60, 3, "dragging the bottom edge: it follows the pointer");
  await k.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y: y + 60,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await k.sleep(1200);
  t.near(await k.ev(`S.sch`), slot + 60, 3, "let go: the slot is 60 px taller");
  t.ok((await k.rect("#frame")).height < p0 - 20, "…and the picture gave up the room", {
    p0,
    p1: (await k.rect("#frame")).height,
  });
}
verticalBoxBottom.opts = { width: 1872, height: 1080, step: 0.05 };
