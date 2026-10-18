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

const centred = b => Math.abs((b.pl - 18) - (1700 - 18 - b.rr)) <= 2;
const b0ok = a => a.rl - a.pr === 18 && centred(a);
export async function dividerAndEdges(k, t) {
  await viewport(k, 1700, 950); await settle(k);
  let a = await box(k);
  t.ok(b0ok(a), "default: a centred pair with an 18 px gap", a);
  await drag(k, ".pedge.ri", -100); await k.sleep(500); let b = await box(k);
  t.ok(b.rr - b.rl === a.rr - a.rl + 100 && b.pr - b.pl === a.pr - a.pl - 100 && b.rl - b.pr === 18 && centred(b),
    "dragging the image area's left edge: it grows exactly as much as the prompt shrinks; still centred", { a, b });
  await drag(k, ".pedge.ri", -2000); await k.sleep(500); b = await box(k);
  t.ok(b.pr - b.pl === 360, "the prompt stops at its minimum (360)", b.pr - b.pl);
  a = b; await drag(k, ".pedge.pi", 150); await k.sleep(500); b = await box(k);
  t.ok(b.pr - b.pl === a.pr - a.pl + 150 && b.rl - b.pr === 18, "the prompt's right edge is the same divider", { a, b });
  a = b;
  const h = await R(k, ".pedge.ro"), x = h.left + h.width / 2, y = h.top + 200;
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 8; i++) await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + 10 * i, y, button: "left", buttons: 1 });
  await k.sleep(100); const mid = await box(k);
  t.ok(mid.rr === a.rr + 80 && mid.pl === a.pl, "an outer edge follows the cursor while you drag (the rest holds still)", { a, mid });
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + 80, y, button: "left", clickCount: 1 }); await k.sleep(700);
  b = await box(k);
  t.ok(b.rr - b.rl === a.rr - a.rl + 80 && centred(b), "…and on release the pair glides back to centre", { a, b });
  a = b; await drag(k, ".pedge.po", -60); await k.sleep(700); b = await box(k);
  t.ok(b.pr - b.pl === a.pr - a.pl + 60 && b.rr - b.rl === a.rr - a.rl && centred(b), "the prompt's outer edge: only the prompt changes; centred again", { a, b });
  const w = (await R(k, "#rpanel")).width; await k.ev(`(showView("queue"),1)`); await settle(k);
  t.ok(Math.abs((await R(k, "#rpanel")).width - w) < 1, "the Queue tab has the same width as the image area");
  await k.send("Page.reload", {}); await k.sleep(800); await k.until("!!(window.LIVE&&window._jobsReady)", 15000); await settle(k);
  const c = await box(k); t.ok(Math.abs(c.pl - b.pl) <= 1 && Math.abs(c.rr - b.rr) <= 1, "remembered after a restart", { b, c });
}

export async function windowResize(k, t) {
  await viewport(k, 1700, 950); await settle(k); const a = await box(k);
  await viewport(k, 1450, 950); await settle(k); const b = await box(k);
  t.ok(b.pr - b.pl === a.pr - a.pl && b.rr - b.rl === a.rr - a.rl && b.rl - b.pr === 18, "a narrower window: the panels keep their widths and stay attached", { a, b });
  t.ok(Math.abs((b.pl - 18) - (1450 - 18 - b.rr)) <= 2, "still centred: only the margins shrank", b);
  await viewport(k, 1150, 950); await settle(k); const c = await box(k);
  t.ok(c.rr <= 1150 - 18 + 1 && c.rl - c.pr === 18, "too narrow for both: they shrink to fit, still attached", c);
}

export async function resetAndDoubleClick(k, t) {
  await viewport(k, 1700, 950); await settle(k);
  const d = await box(k);
  await drag(k, ".pedge.po", -80); await drag(k, ".pedge.ro", 60); await k.sleep(500);
  const h = await R(k, ".pedge.po"); await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x: h.left + 6, y: h.top + 100, button: "left", clickCount: 2 });
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: h.left + 6, y: h.top + 100, button: "left", clickCount: 2 }); await k.sleep(500);
  t.ok(await k.ev(`S.lay.pw`) === 680, "double-click the prompt's edge: its default width", await k.ev(`S.lay.pw`));
  await k.ev(`($("layBtn").click(),1)`); await k.sleep(200); await k.ev(`(document.querySelector('[data-lay="reset"]').click(),1)`); await settle(k);
  const r = await box(k); t.ok(JSON.stringify(r) === JSON.stringify(d), "Layout → Reset: back to the default, centred", { d, r });
}
