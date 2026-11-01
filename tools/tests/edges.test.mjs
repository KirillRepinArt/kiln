// The edges you drag: every edge is one gesture (edges.js gesture), and a drag ends however it ends — the button up,
// or the pointer's capture lost (a reload, another window) — leaving no resize cursor behind (2026-11-01: a lost capture
// left it stuck on every edge; the 2026-10-24 fix covered only a move without the button).
const R = (k, sel) => k.rect(sel);
const ev = (k, type, x, y, b = 1) =>
  k.send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: "left",
    buttons: type === "mouseReleased" ? 0 : b,
    clickCount: 1,
  });
const held = k =>
  k.ev(`[...document.body.classList].filter(c=>/^(resizing|vresizing|laydrag)$/.test(c)).join(" ")||"-"`);
const clear = k => k.ev(`(document.body.classList.remove("resizing","vresizing","laydrag"),1)`);

/** press a handle, drag it a little, end the drag `how`; what's left on the page */
async function dragEnd(k, sel, how) {
  const h = await R(k, sel),
    x = h.left + h.width / 2,
    y = h.top + h.height / 2;
  await ev(k, "mouseMoved", x, y, 0);
  await ev(k, "mousePressed", x, y);
  const during = await held(k);
  for (let i = 1; i <= 6; i++) await ev(k, "mouseMoved", x - 3 * i, y - 3 * i);
  if (how === "lost capture") await k.ev(`(document.querySelector(${JSON.stringify(sel)}).releasePointerCapture(1),1)`);
  await ev(k, "mouseReleased", how === "lost capture" ? 5 : x - 18, how === "lost capture" ? 5 : y - 18);
  await ev(k, "mouseMoved", 8, 8, 0);
  await k.sleep(300);
  return { during, after: await held(k) };
}

async function everyEdge(k, t, handles) {
  for (const sel of handles)
    for (const how of ["release", "lost capture"]) {
      const { during, after } = await dragEnd(k, sel, how);
      t.ok(during !== "-", `${sel}: a press is a drag (${during})`);
      t.ok(after === "-", `${sel} after ${how}: nothing held`, after);
      if (after !== "-") await clear(k);
    }
}

export async function dragsEndSideBySide(k, t) {
  await k.ev(`(S.ar="16:9",setDock("left"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  await everyEdge(k, t, ["#vedge", ".pedge.po", ".pedge.pi", ".pedge.ri", ".pedge.ro", ".hedge.t", ".hedge.b"]);
}
dragsEndSideBySide.opts = { width: 1760, height: 1080, step: 0.05 };

export async function dragsEndVertical(k, t) {
  await k.ev(`(S.ar="16:9",setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  await everyEdge(k, t, [".hedge.t", ".hedge.l", ".hedge.r", "#hsplit", ".sedge.l", ".sedge.r"]);
}
dragsEndVertical.opts = { width: 1760, height: 1080, step: 0.05 };

/** drag a handle by dx (side by side) and let go */
async function dragBy(k, sel, dx) {
  const h = await R(k, sel),
    x = h.left + h.width / 2,
    y = h.top + h.height / 2;
  await ev(k, "mouseMoved", x, y, 0);
  await ev(k, "mousePressed", x, y);
  for (let i = 1; i <= 10; i++) await ev(k, "mouseMoved", x + (dx * i) / 10, y);
  await ev(k, "mouseReleased", x + dx, y);
  await ev(k, "mouseMoved", 8, 8, 0);
  await k.sleep(900);
}

/* every page keeps its own size (v0.7c, the user: "each page remembers its own"): the Queue and LoRAs shared one width */
export async function eachPageItsOwnSize(k, t) {
  await k.ev(`(setDock("left"),showView("queue"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1000);
  const q0 = (await R(k, "#rpanel")).width;
  await dragBy(k, ".pedge.ro", 80); // (narrower stops at the tab bar's width: the bar sits on the plate)
  const q1 = (await R(k, "#rpanel")).width;
  t.near(q1, q0 + 80, 3, "the Queue wider by the drag", { q0, q1 });
  await k.ev(`(showView("loras"),1)`);
  await k.sleep(1000);
  t.near((await R(k, "#rpanel")).width, q0, 3, "LoRAs keeps its own width (the default)");
  await dragBy(k, ".pedge.ro", 140);
  const l1 = (await R(k, "#rpanel")).width;
  t.near(l1, q0 + 140, 3, "LoRAs wider by its own drag", { l1 });
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(1000);
  t.near((await R(k, "#rpanel")).width, q1, 3, "back on the Queue: its own width");
  await k.reload();
  await k.until("!!(window.LIVE&&window._jobsReady)", 15000);
  await k.ev(`(showView("loras"),1)`);
  await k.sleep(1200);
  t.near((await R(k, "#rpanel")).width, l1, 3, "after a restart too");
  t.ok(await k.ev(`S.lay.v===4`), "kept in the v4 format");
}
eachPageItsOwnSize.opts = { width: 1760, height: 1080, step: 0.05 };

/* one limit for every edge (v0.7c, the user 2026-11-02): an edge goes until its group meets the room's end — the window
   less its area gap — and no further. Side by side the prompt stopped ~60 px short (a 900 px cap, a 24 px margin, the
   buttons' clearance kept on its side too); in Vertical its side edges slid off the screen */
export async function edgesReachTheRoom(k, t) {
  const area = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-area"))`);
  /** drag a handle to the window's right edge (events stop outside it); the box's right while held, and after */
  const toEdge = async (sel, W) => {
    const h = await R(k, sel),
      x = h.left + h.width / 2,
      y = h.top + h.height / 2,
      x1 = W - 4;
    await ev(k, "mouseMoved", x, y, 0);
    await ev(k, "mousePressed", x, y);
    for (let i = 1; i <= 12; i++) await ev(k, "mouseMoved", x + ((x1 - x) * i) / 12, y);
    await k.sleep(200);
    const held = (await R(k, "#left")).right;
    await ev(k, "mouseReleased", x1, y);
    await ev(k, "mouseMoved", 8, 8, 0);
    await k.sleep(900);
    return { held, after: (await R(k, "#left")).right };
  };
  /* a panel page (on a picture page the prompt hugs the picture inside its area until the fit-page rule, E) */
  await k.ev(`(setDock("right"),showView("queue"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  const W = await k.ev(`innerWidth`),
    s = await toEdge(".pedge.po", W);
  t.ok(
    s.held >= W - area - 3 && s.held < W,
    "side by side: held, the prompt's edge reaches the window less one area gap (past it: resistance)",
    s,
  );
  t.ok(s.after < s.held, "let go: the pair settles back to the centre (the box keeps its new width)", s);
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const v = await toEdge(".sedge.r", W);
  t.ok(v.held < W, "Vertical: the box's side never leaves the window", v);
  t.ok((await k.ev(`paneSize("box","vert").w`)) <= W - 2 * area + 1, "…what's kept is the limit");
}
edgesReachTheRoom.opts = { width: 1680, height: 1080, step: 0.05 };

/** press a handle, move it by dx in steps, measure while held, let go; returns { held, after } of the given selectors */
async function dragMeasure(k, sel, dx, what) {
  const h = await R(k, sel),
    x = h.left + h.width / 2,
    y = h.top + Math.min(h.height / 2, 200);
  await ev(k, "mouseMoved", x, y, 0);
  await ev(k, "mousePressed", x, y);
  for (let i = 1; i <= 12; i++) await ev(k, "mouseMoved", x + (dx * i) / 12, y);
  await k.sleep(250);
  const held = {};
  for (const s of what) held[s] = await R(k, s);
  await ev(k, "mouseReleased", x + dx, y);
  await ev(k, "mouseMoved", 8, 8, 0);
  await k.sleep(1200);
  const after = {};
  for (const s of what) after[s] = await R(k, s);
  return { held, after };
}

/* the fit-page rule (v0.7c E, the user 2026-11-02): on a picture page the picture's edges drag the PICTURE — its
   ratio moves its height — and the divider trades the prompt against the picture. They set the area's width: a
   picture held by its height didn't change, and the edge bounced back */
export async function pictureEdgesDragThePicture(k, t) {
  await k.ev(`(setDock("left"),1)`);
  await k.job("[fill:446688] tall", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const f0 = await R(k, "#frame"),
    L0 = await R(k, "#left");
  /* the outer edge in by 200: the picture 200 narrower, its height by its ratio; the prompt doesn't move */
  const a = await dragMeasure(k, ".pedge.ro", -200, ["#frame", "#left"]);
  t.near(a.held["#frame"].width, f0.width - 200, 4, "held: the picture 200 px narrower", { w: a.held["#frame"].width });
  t.near(a.held["#frame"].height, ((f0.width - 200) * f0.height) / f0.width, 4, "…its height by its ratio");
  t.near(a.held["#frame"].left, f0.left, 3, "…its inner side holds");
  t.near(a.held["#left"].left, L0.left, 3, "…and the prompt doesn't move");
  t.near(a.after["#frame"].width, f0.width - 200, 4, "let go: the picture keeps that size");
  /* back out by 120: it grows */
  const b = await dragMeasure(k, ".pedge.ro", 120, ["#frame"]);
  t.near(b.held["#frame"].width, a.after["#frame"].width + 120, 4, "the outer edge out: the picture grows");
  /* the divider toward the picture by 100: the prompt 100 wider, the picture 100 narrower, its outer side still */
  const f1 = b.after["#frame"],
    L1 = await R(k, "#left"),
    c = await dragMeasure(k, ".pedge.ri", 100, ["#frame", "#left"]);
  t.near(c.held["#left"].width, L1.width + 100, 4, "the divider: the prompt 100 px wider");
  t.near(c.held["#frame"].width, f1.width - 100, 4, "…the picture 100 px narrower");
  t.near(c.held["#frame"].right, f1.right, 3, "…its outer side holds");
  /* at its full height it can't grow: the edge answers with resistance and the picture settles back */
  await k.ev(`(setPaneSize(pageId(),"h",null),setPaneSize(pageId(),"w",null,"side"),sizeFrame(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const f2 = await R(k, "#frame"),
    d = await dragMeasure(k, ".pedge.ro", 200, ["#frame"]);
  const grew = d.held["#frame"].width - f2.width;
  const area = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-area"))`);
  t.ok(grew > 2 && grew <= area, "at full height: the edge answers with a little give, one area gap at most", {
    grew,
  });
  t.near(d.after["#frame"].width, f2.width, 3, "…and the picture settles back on release");
}
pictureEdgesDragThePicture.opts = { width: 1900, height: 1300, step: 0.05 }; // a 3:4 picture wider than the tab bar

/* the rubber band never covers another part (2026-11-02, the user: it ran under the tab bar and off the window): a
   picture held past its room overshoots only into the gap round it */
export async function rubberStaysInItsGap(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.job("[fill:446688] tall", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const bar = await R(k, ".tabs"),
    { held } = await (async () => {
      const h = await R(k, ".hedge.t"),
        x = h.left + h.width / 2,
        y = h.top + h.height / 2;
      await ev(k, "mouseMoved", x, y, 0);
      await ev(k, "mousePressed", x, y);
      for (let i = 1; i <= 12; i++) await ev(k, "mouseMoved", x, y - (300 * i) / 12);
      await k.sleep(250);
      const r = await R(k, "#plate");
      await ev(k, "mouseReleased", x, y - 300);
      await ev(k, "mouseMoved", 8, 8, 0);
      await k.sleep(1000);
      return { held: r };
    })();
  t.ok(held.top >= bar.bottom, "Vertical, the top edge pulled far up: the picture never goes under the tab bar", {
    top: held.top,
    bar: bar.bottom,
  });
  t.ok(held.bottom <= (await R(k, "#left")).top, "…nor under the prompt");
}
rubberStaysInItsGap.opts = { width: 1760, height: 1080, step: 0.05 };

/* Vertical: Queue / LoRAs / PNG Info have side edges and their own widths (v0.7c E3; they had none: the user,
   2026-11-02). The defaults: a 2:3 plate side by side, 1:1 in Vertical, at the room's height */
export async function verticalPanelsResize(k, t) {
  await k.ev(`(setDock("left"),showView("queue"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  const side = await R(k, "#rpanel"),
    stage = await R(k, "#rpanel");
  t.near(
    side.width,
    Math.max(await k.ev(`minRight()`), Math.round((stage.height * 2) / 3)),
    3,
    "side by side: a 2:3 plate",
  );
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const p0 = await R(k, "#right");
  t.near(p0.width, (await R(k, "#rpanel")).height, 3, "Vertical: a 1:1 plate at the room's height", {
    w: p0.width,
  });
  const e = await R(k, ".vpedge.r"),
    x = e.left + e.width / 2,
    y = e.top + 200;
  await ev(k, "mouseMoved", x, y, 0);
  await ev(k, "mousePressed", x, y);
  for (let i = 1; i <= 10; i++) await ev(k, "mouseMoved", x + (100 * i) / 10, y);
  await k.sleep(250);
  const held = await R(k, "#right");
  await ev(k, "mouseReleased", x + 100, y);
  await ev(k, "mouseMoved", 8, 8, 0);
  await k.sleep(900);
  t.near(held.width, p0.width + 200, 3, "its right edge out by 100: 200 wider, about its centre", { w: held.width });
  t.near(held.left + held.width / 2, p0.left + p0.width / 2, 2, "…its centre stays");
  t.near(held.right, p0.right + 100, 3, "…the edge under the pointer");
  t.near((await R(k, "#right")).width, p0.width + 200, 3, "kept");
  await k.ev(`(showView("loras"),1)`);
  await k.sleep(1200);
  t.near((await R(k, "#right")).width, p0.width, 3, "LoRAs keeps its own width in Vertical");
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(1200);
  t.near((await R(k, "#right")).width, p0.width + 200, 3, "back on the Queue: its own");
}
verticalPanelsResize.opts = { width: 1760, height: 1080, step: 0.05 };

/* a panel's height (v0.7c, the user 2026-11-02: every pane every edge; the tab bar rides on the panel): its top and
   bottom edges, the other side held while dragging; on release it rests centred side by side, at the top in Vertical,
   and keeps the height; the tabs come down with it; each page its own */
export async function panelHeights(k, t) {
  const area = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-area"))`);
  /** drag a panel edge by dy; the panel and the tab bar while held, and after */
  const drag = async (sel, dy) => {
    const h = await R(k, sel),
      x = h.left + 120,
      y = h.top + h.height / 2;
    await ev(k, "mouseMoved", x, y, 0);
    await ev(k, "mousePressed", x, y);
    for (let i = 1; i <= 10; i++) await ev(k, "mouseMoved", x, y + (dy * i) / 10);
    await k.sleep(250);
    const held = await R(k, "#rpanel");
    await ev(k, "mouseReleased", x, y + dy);
    await ev(k, "mouseMoved", 8, 8, 0);
    await k.sleep(1000);
    return { held, after: await R(k, "#rpanel"), bar: await R(k, ".tabs") };
  };
  await k.ev(`(setDock("left"),showView("queue"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  const p0 = await R(k, "#rpanel"),
    b0 = await R(k, ".tabs");
  const a = await drag(".phedge.b", -200);
  t.near(a.held.height, p0.height - 200, 3, "side by side: the bottom edge up 200, the panel 200 shorter", {
    h: a.held.height,
  });
  t.near(a.held.top, p0.top, 2, "…its top holds while dragging");
  t.near(a.after.height, p0.height - 200, 3, "let go: the height is kept");
  t.near(a.after.top, p0.top + 100, 3, "…and it rests centred in its room");
  t.near(a.bar.top, b0.top + 100, 3, "…the tabs came down with it (they ride on the panel)");
  const r = await drag(".phedge.t", -300);
  t.ok(r.held.top >= b0.top - 1 && r.held.height <= p0.height + area, "past the room: a little give at most", {
    held: r.held,
  });
  await k.ev(`(showView("loras"),1)`);
  await k.sleep(1200);
  t.near((await R(k, "#rpanel")).height, p0.height, 3, "LoRAs keeps its own height (the whole room)");
  await k.ev(`(setDock("below"),showView("queue"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const v0 = await R(k, "#rpanel"),
    v = await drag(".phedge.b", -150);
  t.near(v.after.height, v0.height - 150, 3, "Vertical: the panel 150 shorter", { h: v.after.height });
  t.near(v.after.top, v0.top, 3, "…resting at the top (Vertical's anchor)");
}
panelHeights.opts = { width: 1760, height: 1080, step: 0.05 };

/* every limit and default comes from one place (layoutmath.js limits / paneDefault, v0.7c 3b): the Queue stops at a
   readable width (~900 px), PNG Info keeps a fixed width (its edges give a little and settle back) — agreed 2026-11-01,
   never enforced while each edge had its own numbers */
export async function panelLimitsFromOnePlace(k, t) {
  const area = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-area"))`);
  await k.ev(`(setDock("left"),showView("queue"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  const q0 = await R(k, "#rpanel");
  await dragBy(k, ".pedge.ro", Math.min(500, (await k.ev(`innerWidth`)) - 8 - q0.right));
  t.ok(
    (await R(k, "#rpanel")).width <= 900 + 1,
    "the Queue stops at its readable width",
    (await R(k, "#rpanel")).width,
  );
  await k.ev(`(showView("png"),1)`);
  await k.sleep(1200);
  const p0 = await R(k, "#rpanel");
  await dragBy(k, ".pedge.ro", 150);
  t.near((await R(k, "#rpanel")).width, p0.width, 2, "PNG Info: a fixed width — it gives a little, then settles back");
  t.ok(area > 0, "(the area gap reads)");
}
panelLimitsFromOnePlace.opts = { width: 2200, height: 1080, step: 0.05 };

/* one rule for every edge, the numbers make the behaviour (2026-11-02, DEVLOG DD-2026-11-02-12): the prompt box's least
   and largest are both its text's height, so its height edges give a little and snap back — side by side its bottom
   (it jumped to a stored 240 px) and its top, in Vertical its bottom; nothing about its height is stored */
export async function boxHeightEdgesSnapBack(k, t) {
  const area = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-area"))`);
  /** drag a box edge by dy: its height while held, and after */
  const pull = async (sel, dy) => {
    const h = await R(k, sel),
      x = h.left + h.width / 2,
      y = h.top + h.height / 2;
    await ev(k, "mouseMoved", x, y, 0);
    await ev(k, "mousePressed", x, y);
    for (let i = 1; i <= 10; i++) await ev(k, "mouseMoved", x, y + (dy * i) / 10);
    await k.sleep(200);
    const held = (await R(k, "#left")).height;
    await ev(k, "mouseReleased", x, y + dy);
    await ev(k, "mouseMoved", 8, 8, 0);
    await k.sleep(900);
    return { held, after: (await R(k, "#left")).height };
  };
  await k.ev(`(setDock("left"),P.value="a short prompt",draft=P.value,layoutLeft(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  const h0 = (await R(k, "#left")).height;
  for (const [sel, dy] of [
    ["#vedge", 200],
    ["#vedge", -100],
    [".vedge.t", -200],
  ]) {
    const r = await pull(sel, dy);
    t.ok(Math.abs(r.held - h0) > 1 && Math.abs(r.held - h0) <= area, `side by side, ${sel} ${dy}: a little give`, r);
    t.near(r.after, h0, 2, `…and it snaps back to its text`);
  }
  t.ok(await k.ev(`!("pph" in S)`), "nothing about its height is stored");
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const v0 = (await R(k, "#left")).height,
    v = await pull("#vedge", 150);
  t.ok(Math.abs(v.held - v0) > 1 && Math.abs(v.held - v0) <= area, "Vertical, its bottom edge: a little give", v);
  t.near(v.after, v0, 2, "…and it snaps back");
}
boxHeightEdgesSnapBack.opts = { width: 1760, height: 1080, step: 0.05 };

/* a picture's largest height is what fits both ways (2026-11-02, the user's screenshot): a 16:9 picture bound by its
   width can't get taller — pulling its top edge only gives a little; nothing slides, the box isn't lifted */
export async function widthBoundPictureGivesALittle(k, t) {
  await k.ev(`(setDock("right"),1)`);
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const f0 = await R(k, "#frame"),
    b0 = await R(k, "#left"),
    bar = await R(k, ".tabs"),
    h = await R(k, ".hedge.t"),
    x = h.left + h.width / 2,
    y = h.top + h.height / 2;
  await ev(k, "mouseMoved", x, y, 0);
  await ev(k, "mousePressed", x, y);
  for (let i = 1; i <= 10; i++) await ev(k, "mouseMoved", x, y - 30 * i);
  await k.sleep(250);
  const fh = await R(k, "#frame"),
    bh = await R(k, "#left");
  await ev(k, "mouseReleased", x, y - 300);
  await ev(k, "mouseMoved", 8, 8, 0);
  await k.sleep(1200);
  t.ok(fh.top >= bar.bottom, "held: the picture never goes under the tab bar", { top: fh.top, bar: bar.bottom });
  t.ok(f0.top - fh.top <= 13, "held: its top gives a little at most (it can't grow: its width binds)", {
    moved: f0.top - fh.top,
  });
  t.ok(Math.abs(bh.top - b0.top) <= 13, "…and the box isn't lifted", { moved: b0.top - bh.top });
  t.near((await R(k, "#frame")).top, f0.top, 2, "let go: back where it was");
}
widthBoundPictureGivesALittle.opts = { width: 1680, height: 1080, step: 0.05 };
