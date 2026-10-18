// Panel layout: what must hold before and after the Phase 2a rewrite, plus the new behaviour.
const R = (k, sel) => k.rect(sel);
const viewport = (k, w, h) => k.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
const settle = k => k.sleep(700);
const overlapX = (a, b) => !(a.right <= b.left || a.left >= b.right);

export async function wideBasics(k, t) {
  await viewport(k, 1513, 900); await settle(k);
  const L = await R(k, "#left"), Rr = await R(k, "#rpanel"), tabs = await R(k, ".tabs"), f = await R(k, "#frame"), p = await R(k, "#prog");
  t.ok(!(await k.ev(`document.querySelector(".app").classList.contains("stacked")`)), "1513×900: side by side");
  t.ok(!overlapX(L, Rr) && L.right < Rr.left, "the prompt is left of the right area, no overlap", { L: [L.left, L.right], R: [Rr.left, Rr.right] });
  t.ok(Math.abs(tabs.left - Rr.left) < 2 && Math.abs(tabs.width - Rr.width) < 2, "the tab bar spans the right area", { tabs: [tabs.left, tabs.width], R: [Rr.left, Rr.width] });
  t.ok(f.left >= Rr.left - 1 && f.right <= Rr.right + 1, "the image sits inside the right area");
  t.ok(Math.abs((f.left + f.right) / 2 - (Rr.left + Rr.right) / 2) < 2, "centred in it");
  t.ok(await k.until(`(()=>{const p=$("prog").getBoundingClientRect(),f=$("frame").getBoundingClientRect();return Math.abs(p.left-f.left)<2&&Math.abs(p.width-f.width)<2&&p.top>f.bottom})()`, 2000),
    "the status row sits under the image, as wide", { p: [p.left, p.width, p.top], f: [f.left, f.width, f.bottom] });
  t.ok(L.left >= 0 && Rr.right <= 1513, "everything on screen");
}

export async function narrowStacks(k, t) {
  await viewport(k, 900, 900); await settle(k);
  t.ok(await k.ev(`document.querySelector(".app").classList.contains("stacked")`), "900 wide: stacked (prompt under the image)");
  const L = await R(k, "#left"), f = await R(k, "#frame");
  t.ok(L.top > f.bottom, "the prompt is below the image");
  await viewport(k, 1513, 900); await settle(k);
  t.ok(!(await k.ev(`document.querySelector(".app").classList.contains("stacked")`)), "back to side by side when wide again");
}

export async function promptPositions(k, t) {
  await viewport(k, 1513, 900); await settle(k);
  const pos = {};
  for (const p of ["top", "mid", "bot"]) { await k.ev(`(S.pos="${p}",lyFrozen=false,layoutLeft(),1)`); await settle(k); pos[p] = (await R(k, "#left")).top }
  t.ok(pos.top < pos.mid && pos.mid < pos.bot, "top / middle / bottom positions differ in order", pos);
  const f = await R(k, "#frame"); await k.ev(`(S.pos="top",lyFrozen=false,layoutLeft(),1)`); await settle(k);
  t.ok(Math.abs((await R(k, "#left")).top - f.top) < 3, "top: level with the image's top");
}

export async function tabsKeepWidth(k, t) {
  await viewport(k, 1513, 900); await settle(k);
  const w = {};
  for (const ar of ["3:4", "16:9", "21:9"]) {
    await k.job("x", { ar, steps: 2 }); await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${["3:4", "16:9", "21:9"].indexOf(ar) + 1}`, 30000); await settle(k);
    for (const v of ["gen", "queue", "loras"]) { await k.ev(`(showView("${v}"),1)`); await settle(k); w[ar + " " + v] = Math.round((await R(k, "#rpanel")).width) }
  }
  const vals = Object.values(w);
  t.ok(vals.every(x => x === vals[0]), "the right area keeps one width for every tab and every image shape", w);
}
tabsKeepWidth.opts = { step: 0.3 };

/* Phase 2a step 1: four edges, each changing only its own panel; proportional free space; reset */
async function drag(k, sel, dx) {
  const h = await R(k, sel), x = h.left + h.width / 2, y = h.top + Math.min(200, h.height / 2);
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 8; i++) await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + dx * i / 8, y, button: "left", buttons: 1 });   // the button stays down (or the browser treats it as released)
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dx, y, button: "left", clickCount: 1 }); await k.sleep(400);
}
const box = async k => { const L = await R(k, "#left"), Rr = await R(k, "#right"); return { pl: Math.round(L.left), pr: Math.round(L.right), rl: Math.round(Rr.left), rr: Math.round(Rr.right) } };

export async function edgesMoveOnlyTheirPanel(k, t) {
  await viewport(k, 1700, 950); await settle(k);
  let a = await box(k);
  await drag(k, ".pedge.po", -60); let b = await box(k);
  t.ok(b.pl < a.pl - 50 && b.pr === a.pr && b.rl === a.rl && b.rr === a.rr, "prompt's outer edge: only the prompt's left side moves", { a, b });
  a = b; await drag(k, ".pedge.pi", 40); b = await box(k);
  t.ok(b.pr > a.pr + 30 && b.pl === a.pl && b.rr - b.rl === a.rr - a.rl && b.rl >= b.pr + 18, "prompt's inner edge: the prompt grows; the image area keeps its width (pushed if needed)", { a, b });
  a = b; await drag(k, ".pedge.ri", 30); b = await box(k);
  t.ok(b.rl > a.rl + 20 && b.rr === a.rr && b.pl === a.pl && b.pr === a.pr, "image area's inner edge, inward: only its left side", { a, b });
  a = b; await drag(k, ".pedge.ri", -150); b = await box(k);
  t.ok(b.rl < a.rl - 100 && b.rr === a.rr && b.pr - b.pl === a.pr - a.pl && b.pr <= b.rl - 18, "outward past the gap: it grows, the prompt slides but keeps its width", { a, b });
  a = b; await drag(k, ".pedge.ro", 50); b = await box(k);
  t.ok(b.rr > a.rr + 40 && b.rl === a.rl && b.pl === a.pl && b.pr === a.pr, "image area's outer edge: only its right side", { a, b });
  a = b; await drag(k, ".pedge.pi", 2000); b = await box(k);
  t.ok(b.pr < b.rl, "panels never overlap", { a, b });
  const w = (await R(k, "#rpanel")).width; await k.ev(`(showView("queue"),1)`); await settle(k);
  t.ok(Math.abs((await R(k, "#rpanel")).width - w) < 1, "the Queue tab has the same width as the image area");
  await k.send("Page.reload", {}); await k.sleep(800); await k.until("!!(window.LIVE&&window._jobsReady)", 15000); await settle(k);
  const c = await box(k); t.ok(Math.abs(c.pl - b.pl) <= 1 && Math.abs(c.rr - b.rr) <= 1, "remembered after a restart", { b, c });
}

export async function resizeKeepsShape(k, t) {
  await viewport(k, 1700, 950); await settle(k);
  await drag(k, ".pedge.ro", -120);   // more room on the right than on the left
  const a = await box(k), W1 = 1700, f1 = { l: a.pl - 18, r: W1 - 18 - a.rr };
  await viewport(k, 1500, 950); await settle(k);
  const b = await box(k), W2 = 1500, f2 = { l: b.pl - 18, r: W2 - 18 - b.rr };
  t.ok(b.pr - b.pl === a.pr - a.pl && b.rr - b.rl === a.rr - a.rl, "a narrower window: the panels keep their widths", { a, b });
  t.ok(Math.abs(f1.l / (f1.l + f1.r) - f2.l / (f2.l + f2.r)) < .03, "the free space keeps its proportions", { f1, f2 });
}

export async function resetAndDoubleClick(k, t) {
  await viewport(k, 1700, 950); await settle(k);
  const d = await box(k);
  await drag(k, ".pedge.po", -80); await drag(k, ".pedge.ro", 60);
  const h = await R(k, ".pedge.po"); await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x: h.left + 6, y: h.top + 100, button: "left", clickCount: 2 });
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: h.left + 6, y: h.top + 100, button: "left", clickCount: 2 }); await k.sleep(500);
  t.ok(await k.ev(`S.lay.pw`) === 680, "double-click the prompt's edge: its default width", await k.ev(`S.lay.pw`));
  await k.ev(`($("layBtn").click(),1)`); await k.sleep(200); await k.ev(`(document.querySelector('[data-lay="reset"]').click(),1)`); await settle(k);
  const r = await box(k); t.ok(JSON.stringify(r) === JSON.stringify(d), "Layout → Reset: back to the default, centred", { d, r });
}
