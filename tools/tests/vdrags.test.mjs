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

/* C4d (DD-2026-11-03-5, the user 2026-11-09: "in vertical, reset grows the prompt box and not the pic — we optimise for
   the biggest pic"): Reset layout = the defaults with the picture first (its largest; the box at its default width and
   its text's height in what's left); double-click a picture edge = the picture at its largest, the box squeezed toward
   its least (a height of yours is kept, clamped) */
export async function resetPictureFirst(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await done(k, 1);
  await k.ev(LONG);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const f0 = await R(k, "#frame"),
    b0 = await R(k, "#left");
  await pull(k, "#hsplit", 0, -200); // the picture smaller, the box taller (both yours)
  await pull(k, ".sedge.r", 100, 0); // the box wider (yours)
  const moved = { f: await R(k, "#frame"), b: await R(k, "#left") };
  t.ok(
    moved.f.height < f0.height - 150 && moved.b.height > b0.height + 150,
    "set up: a smaller picture, a taller box",
    {
      f: moved.f.height,
      b: moved.b.height,
    },
  );
  await k.ev(`(document.querySelector('#layMenu [data-lay="reset"]').click(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const f1 = await R(k, "#frame"),
    b1 = await R(k, "#left");
  t.near(f1.height, f0.height, 2, "Reset: the picture at its largest (the picture first)", { f0: f0.height });
  t.near(b1.height, b0.height, 2, "…the box at its text's height in what's left (its least here)", { b0: b0.height });
  t.near(b1.width, b0.width, 2, "…at its default width", { b0: b0.width });
  t.ok(await k.ev(`paneSize("box","vert").h==null&&paneSize("box","vert").w==null`), "…nothing of yours kept");
  /* the picture's edge, double-clicked: its largest; the box (taller by your height) squeezed toward its least */
  await pull(k, "#hsplit", 0, -200);
  await dbl(k, ".hedge.r");
  t.near((await R(k, "#frame")).height, f0.height, 2, "double-click a picture edge: the picture at its largest");
  t.near((await R(k, "#left")).height, b0.height, 2, "…the box squeezed to its least");
}
resetPictureFirst.opts = { width: 2000, height: 1023, step: 0.05 };

/* B16 in Vertical (C2b's rest): a panel's size change from a gesture (Reset, a double-click) moves on the rearrangement's
   plan — no snap. It was written at once (the panel) and on a CSS transition of its own (the column's width) */
export async function panelResetGlides(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.ev(`(document.querySelector('.tab[data-v="queue"]').click(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1400);
  await pull(k, "#hsplit", 0, -200); // a shorter Queue
  await pull(k, ".vpedge.r", 150, 0); // a wider one
  const p0 = await R(k, "#rpanel");
  const w = k.ev(
    `new Promise(res=>{const o=[],t0=performance.now();(function s(){requestAnimationFrame(()=>setTimeout(()=>{const r=$("rpanel").getBoundingClientRect();o.push([r.width,r.height]);if(performance.now()-t0<1200)s();else res(o)},0))})();document.querySelector('#layMenu [data-lay="reset"]').click()})`,
  ); // Reset clicked in the same evaluation: the harness runs one at a time (a second one waited for the sampling to end)
  /* from the size before the click: a snap lands before the first sampled frame */
  const s = [[p0.width, p0.height], ...(await w)],
    p1 = await R(k, "#rpanel"),
    /* each axis on its own: the biggest jump in one frame, against that axis's whole change */
    axis = (/** @type {number} */ i, /** @type {number} */ d) => ({
      change: Math.round(d),
      biggest: Math.round(Math.max(...s.slice(1).map((v, j) => Math.abs(v[i] - s[j][i])))),
    }),
    W = axis(0, p1.width - p0.width),
    H = axis(1, p1.height - p0.height);
  t.ok(Math.abs(W.change) > 100 && Math.abs(H.change) > 100, "Reset changed the Queue's width and height", { W, H });
  t.motion(W.biggest < 0.6 * Math.abs(W.change), "…its width in a motion, not a snap", W);
  t.motion(H.biggest < 0.6 * Math.abs(H.change), "…its height in a motion, not a snap", H);
}
panelResetGlides.opts = { width: 1400, height: 1000, step: 0.05 };
