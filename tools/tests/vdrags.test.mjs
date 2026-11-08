// Vertical's drags through the layout pass — v0.7c C4c (ux-review/16-layout-pass.md C4, rule 4): the shared edge trades
// room between the page and the box (the group's bottom holds; both sizes become yours); an outer edge takes no room
// from the other pane (it grows into the free room only, then the rubber band); the box's bottom sets its height (yours:
// Custom, decision A). Written for C4c (2026-11-09); the old Vertical maths' checks (the box's height never kept, the
// box's top a second handle) are superseded by those rules.
const R = (k, sel) => k.rect(sel);
const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);
/** drag a handle by (dx, dy) and let go: the frame, the box, the panel while held and after */
async function pull(k, sel, dx, dy) {
  const h = await R(k, sel),
    x = h.left + h.width / 2,
    y = h.top + h.height / 2;
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 10; i++)
    await k.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x + (dx * i) / 10,
      y: y + (dy * i) / 10,
      button: "left",
      buttons: 1,
    });
  await k.sleep(300);
  const held = { f: await R(k, "#frame"), b: await R(k, "#left"), p: await R(k, "#rpanel") };
  await k.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: x + dx,
    y: y + dy,
    button: "left",
    clickCount: 1,
  });
  await k.mouse(2, 2);
  await k.sleep(1200);
  return { held, f: await R(k, "#frame"), b: await R(k, "#left"), p: await R(k, "#rpanel") };
}
async function dbl(k, sel) {
  const h = await R(k, sel),
    x = h.left + h.width / 2,
    y = h.top + h.height / 2;
  for (const type of ["mousePressed", "mouseReleased"])
    await k.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 2 });
  await k.mouse(2, 2);
  await k.sleep(1200);
}
const LONG = `(P.value=Array(30).fill("a line of prompt text").join(String.fromCharCode(10)),P.dispatchEvent(new Event("input")),1)`;

/* the shared edge trades: up, the picture shrinks and the box takes it (its bottom holds); both are kept; down from
   there, back; with the box at its least, down has nothing to take: a little give, it settles; double-click: the
   defaults (the picture first) */
export async function sharedEdgeTrades(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await done(k, 1);
  await k.ev(LONG);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const f0 = await R(k, "#frame"),
    b0 = await R(k, "#left");
  const up = await pull(k, "#hsplit", 0, -150);
  t.near(f0.height - up.held.f.height, 150, 4, "up 150: the picture 150 shorter while held", { f0: f0.height });
  t.near(up.held.b.height - b0.height, 150, 4, "…the box 150 taller", { b0: b0.height, held: up.held.b.height });
  t.near(up.held.b.bottom, b0.bottom, 2, "…its bottom holds (the group's)");
  t.near(up.f.height, up.held.f.height, 3, "let go: the picture keeps its size (yours)");
  t.near(up.b.height, up.held.b.height, 3, "…and the box its height (yours: Custom)");
  t.ok(await k.ev(`paneSize("box","vert").h>0`), "the box's height is kept");
  const back = await pull(k, "#hsplit", 0, 150);
  t.near(back.f.height, f0.height, 4, "down 150 from there: the picture back", { f: back.f.height });
  t.near(back.b.height, b0.height, 4, "…the box back to its least");
  const give = await pull(k, "#hsplit", 0, 150);
  t.ok(give.held.f.height - f0.height <= 30, "the box at its least: down gives a little at most", {
    f0: f0.height,
    held: give.held.f.height,
  });
  t.near(give.f.height, f0.height, 3, "…and settles back");
  await pull(k, "#hsplit", 0, -100);
  await dbl(k, "#hsplit");
  t.near((await R(k, "#frame")).height, f0.height, 3, "double-click: the picture at its largest again");
  t.ok(await k.ev(`paneSize("box","vert").h==null`), "…the box's height its text's again");
}
sharedEdgeTrades.opts = { width: 2000, height: 1023, step: 0.05 };

/* the box's bottom edge sets its height (yours): into the free room under it, then the rubber band; the picture never
   moves; double-click: its text's height again */
export async function boxBottomSetsHeight(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await done(k, 1);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const f0 = await R(k, "#frame"),
    b0 = await R(k, "#left");
  const d = await pull(k, "#vedge", 0, 100);
  t.near(d.held.b.height - b0.height, 100, 4, "down 100: the box 100 taller", { b0: b0.height, held: d.held.b.height });
  t.near(d.b.height, d.held.b.height, 3, "let go: it keeps the height (Custom)");
  t.near(d.f.height, f0.height, 1, "the picture never moved");
  t.near(d.held.f.top, f0.top, 1, "…not while held either");
  const far = await pull(k, "#vedge", 0, 2000);
  const chips = await R(k, "#chips");
  t.ok(chips.bottom <= (await k.ev(`innerHeight`)) - 10, "far down: kept inside the room, its LoRA row under it", {
    chipsBottom: chips.bottom,
    box: far.b.height,
  });
  await dbl(k, "#vedge");
  t.near((await R(k, "#left")).height, b0.height, 3, "double-click: its text's height again");
}
boxBottomSetsHeight.opts = { width: 1000, height: 1080, step: 0.05 };

/* an outer edge takes no room from the other pane (B17): the picture's side and top edges leave the box's height be */
export async function outerEdgeKeepsTheBox(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await done(k, 1);
  await k.mouse(2, 2);
  await k.sleep(1400);
  await pull(k, "#vedge", 0, 120); // a box taller than its text: what an outer edge might squeeze
  const b0 = await R(k, "#left"),
    f0 = await R(k, "#frame");
  for (const [sel, dx, dy] of [
    [".hedge.r", 300, 0],
    [".hedge.l", -300, 0],
    [".hedge.t", 0, -300],
  ]) {
    const r = await pull(k, sel, dx, dy);
    t.near(r.held.b.height, b0.height, 2, `${sel} out: the box's height holds while held`, { held: r.held.b.height });
    t.near(r.b.height, b0.height, 2, `…and after`, { after: r.b.height });
    t.ok(r.f.height <= f0.height + 2, `…the picture grows into free room only (none here)`, {
      f0: f0.height,
      f: r.f.height,
    });
  }
}
outerEdgeKeepsTheBox.opts = { width: 1000, height: 1080, step: 0.05 };

/* a panel trades too: the Queue's bottom is the shared edge in Vertical */
export async function panelSharedEdge(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.ev(`(document.querySelector('.tab[data-v="queue"]').click(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const p0 = await R(k, "#rpanel"),
    b0 = await R(k, "#left");
  const up = await pull(k, "#hsplit", 0, -120);
  t.near(p0.height - up.held.p.height, 120, 4, "up 120: the Queue 120 shorter", {
    p0: p0.height,
    held: up.held.p.height,
  });
  t.near(up.held.b.height - b0.height, 120, 4, "…the box 120 taller", { held: up.held.b.height });
  t.near(up.p.height, up.held.p.height, 3, "let go: both kept");
  t.near(up.b.height, up.held.b.height, 3, "…the box too");
}
panelSharedEdge.opts = { width: 1400, height: 1000, step: 0.05 };
