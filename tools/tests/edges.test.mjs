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
  /* a drag is a constraint on a centred axis (DD-2026-11-03-6; panels on the pass, C2a's rest): the far side mirrors */
  t.near(q1, q0 + 160, 3, "the Queue wider by the drag (both sides)", { q0, q1 });
  await k.ev(`(showView("loras"),1)`);
  await k.sleep(1000);
  t.near((await R(k, "#rpanel")).width, q0, 3, "LoRAs keeps its own width (the default)");
  await dragBy(k, ".pedge.ro", 140);
  const l1 = (await R(k, "#rpanel")).width;
  t.near(l1, q0 + 280, 3, "LoRAs wider by its own drag (both sides)", { l1 });
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
  /* the outer edge in by 200 (a drag is a constraint on a centred axis, DD-2026-11-03-6 — the pass, C3): the edge at
     the pointer, the far side mirrors, so the picture is 400 narrower, its height by its ratio; the prompt keeps its
     width (an outer edge takes nothing from the other pane, DD-2026-11-07-1) and moves with the pair's centre; a
     release moves nothing */
  const a = await dragMeasure(k, ".pedge.ro", -200, ["#frame", "#left"]);
  t.near(a.held["#frame"].width, f0.width - 400, 4, "held: the picture 400 px narrower (the mirror)", {
    w: a.held["#frame"].width,
  });
  t.near(a.held["#frame"].height, ((f0.width - 400) * f0.height) / f0.width, 4, "…its height by its ratio");
  t.near(a.held["#frame"].right, f0.right - 200, 3, "…its outer edge at the pointer");
  t.near(a.held["#left"].width, L0.width, 3, "…the prompt keeps its width");
  t.near(a.held["#left"].left, L0.left + 200, 3, "…and moves with the pair's centre");
  t.near(a.after["#frame"].width, f0.width - 400, 4, "let go: the picture keeps that size");
  t.near(a.after["#frame"].left, a.held["#frame"].left, 3, "…and nothing glides back");
  /* back out by 120: it grows by both sides */
  const b = await dragMeasure(k, ".pedge.ro", 120, ["#frame"]);
  t.near(b.held["#frame"].width, a.after["#frame"].width + 240, 4, "the outer edge out: the picture grows");
  /* the divider toward the picture by 100 (C6b, DEVLOG DD-2026-11-10-2): the prompt gets the room first — it grows by
     twice the pull (the pair centred, its far side mirrors), the picture pushed at its own size */
  const f1 = b.after["#frame"],
    L1 = await R(k, "#left"),
    c = await dragMeasure(k, ".pedge.ri", 100, ["#frame", "#left"]);
  t.near(c.held["#left"].width, L1.width + 200, 4, "the divider: the prompt 200 px wider (twice the pull)");
  t.near(c.held["#frame"].width, f1.width, 4, "…the picture keeps its size");
  t.near(c.held["#frame"].right, f1.right + 100, 3, "…pushed by the pull");
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
  const p0 = await R(k, "#rpanel"); // the panel itself: the page area is the whole room since C2b's rest
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
  const held = await R(k, "#rpanel");
  await ev(k, "mouseReleased", x + 100, y);
  await ev(k, "mouseMoved", 8, 8, 0);
  await k.sleep(900);
  t.near(held.width, p0.width + 200, 3, "its right edge out by 100: 200 wider, about its centre", { w: held.width });
  t.near(held.left + held.width / 2, p0.left + p0.width / 2, 2, "…its centre stays");
  t.near(held.right, p0.right + 100, 3, "…the edge under the pointer");
  t.near((await R(k, "#rpanel")).width, p0.width + 200, 3, "kept");
  await k.ev(`(showView("loras"),1)`);
  await k.sleep(1200);
  t.near((await R(k, "#rpanel")).width, p0.width, 3, "LoRAs keeps its own width in Vertical");
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(1200);
  t.near((await R(k, "#rpanel")).width, p0.width + 200, 3, "back on the Queue: its own");
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
  /* side by side a panel is centred in its room: a drag is a constraint there (DD-2026-11-03-6; panels on the pass,
     C2a's rest) — the top mirrors the bottom while held, and a release moves nothing (it used to snap to centre) */
  t.near(
    a.held.height,
    p0.height - 400,
    3,
    "side by side: the bottom edge up 200, the panel 400 shorter (both sides)",
    {
      h: a.held.height,
    },
  );
  t.near(a.held.top, p0.top + 200, 2, "…its top mirrors it while dragging");
  t.near(a.after.height, a.held.height, 3, "let go: the height is kept");
  t.near(a.after.top, a.held.top, 3, "…and nothing moves on release (centred already)");
  t.near(a.bar.top, b0.top + 200, 3, "…the tabs came down with it (they ride on the panel)");
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
    v = await drag("#hsplit", -150); // Vertical: the panel's bottom IS the shared edge — its one handle (B10, C4c)
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

/* the box's height is a spec, the same in both layouts (ux-review/16-layout-pass.md rule 3; C6): side by side its bottom
   and its top set your height (Custom) within its least and the room — it keeps the height you let go at, the other
   side holding while you drag — and a double-click puts it back to its text's. (Before C6 it was its text's only,
   DEVLOG DD-2026-11-02-12: these edges gave a little and snapped back.) In Vertical, with no free room under the
   picture, its bottom only gives a little */
export async function boxHeightEdges(k, t) {
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
  let was = h0;
  for (const [sel, dy] of [
    ["#vedge", 200],
    ["#vedge", -100],
    [".vedge.t", -60],
  ]) {
    const r = await pull(sel, dy);
    t.near(
      r.after,
      /* resting in the middle (the default) it grows about its centre: the far side mirrors, twice the pull */
      was + 2 * Math.abs(dy) * (dy > 0 === (sel === "#vedge") ? 1 : -1),
      3,
      `side by side, ${sel} ${dy}: it keeps the height you let go at`,
    );
    was = r.after;
  }
  /* a double-click on its bottom: its text's height again */
  const v1 = await R(k, "#vedge"),
    [dx, dy1] = [v1.left + v1.width / 2, v1.top + v1.height / 2];
  await ev(k, "mouseMoved", dx, dy1, 0);
  for (const c of [1, 2]) {
    await k.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: dx,
      y: dy1,
      button: "left",
      buttons: 1,
      clickCount: c,
    });
    await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: dx, y: dy1, button: "left", clickCount: c });
  }
  await ev(k, "mouseMoved", 8, 8, 0);
  await k.sleep(900);
  t.near((await R(k, "#left")).height, h0, 2, "double-click: back to its text's height");
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const v0 = (await R(k, "#left")).height,
    v = await pull("#vedge", 150);
  t.ok(Math.abs(v.held - v0) > 1 && Math.abs(v.held - v0) <= area, "Vertical, its bottom edge: a little give", v);
  t.near(v.after, v0, 2, "…and it snaps back");
}
boxHeightEdges.opts = { width: 1760, height: 1080, step: 0.05 };

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

/* held, the layout computes from the held size (2026-11-02, the user): side by side, after the prompt is narrowed the
   picture's bottom edge showed no growth while dragged and jumped on release (the area's width was frozen while a
   top / bottom edge was held) */
export async function pictureBottomGrowsWhileHeld(k, t) {
  await k.ev(`(setDock("left"),1)`);
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.mouse(2, 2);
  await k.sleep(1400);
  /* a capped picture with room to grow: its side edge pulled in first, then the prompt narrowed (more room) */
  const pull = async (sel, dx, dy) => {
    const h = await R(k, sel),
      x = h.left + h.width / 2,
      y = h.top + Math.min(h.height / 2, 200);
    await ev(k, "mouseMoved", x, y, 0);
    await ev(k, "mousePressed", x, y);
    for (let i = 1; i <= 10; i++) await ev(k, "mouseMoved", x + (dx * i) / 10, y + (dy * i) / 10);
    await k.sleep(250);
    const held = await R(k, "#frame");
    await ev(k, "mouseReleased", x + dx, y + dy);
    await ev(k, "mouseMoved", 8, 8, 0);
    await k.sleep(1200);
    return { held, after: await R(k, "#frame") };
  };
  await pull(".pedge.ro", -300, 0); // the picture narrowed from its side: a width cap (and its height by its ratio)
  await pull(".pedge.po", 250, 0); // the prompt narrowed: more room
  const f0 = await R(k, "#frame"),
    r = await pull(".hedge.b", 0, 120);
  t.ok(r.held.height > f0.height + 60, "held: the picture grows with the edge (not after release)", {
    f0: f0.height,
    held: r.held.height,
  });
  t.near(r.after.height, r.held.height, 4, "let go: it stays where you left it (no jump)");
}
pictureBottomGrowsWhileHeld.opts = { width: 1760, height: 1080, step: 0.05 };

/* Vertical (2026-11-02, the user): after the picture was made smaller (the box floating under it), grabbing the shared
   edge again grew the picture only a little at a time — its limit counted the spare room as the status row's. And the
   rubber band moved the box: the overshoot is the grabbed edge's feedback only, the box stays at the picture's kept
   bottom */
export async function verticalSharedEdgeAgainAndNoTwitch(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.job("[fill:446688] wide", { ar: "21:9", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.ev(
    `(P.value=Array(12).fill("a line of prompt text").join(String.fromCharCode(10)),P.dispatchEvent(new Event("input")),1)`,
  );
  await k.mouse(2, 2);
  await k.sleep(1400);
  /** drag a handle by (dx, dy); the frame and the box held, and after */
  const pull = async (sel, dx, dy) => {
    const h = await R(k, sel),
      x = h.left + h.width / 2,
      y = h.top + Math.min(h.height / 2, 200);
    await ev(k, "mouseMoved", x, y, 0);
    await ev(k, "mousePressed", x, y);
    for (let i = 1; i <= 12; i++) await ev(k, "mouseMoved", x + (dx * i) / 12, y + (dy * i) / 12);
    await k.sleep(250);
    const held = { f: await R(k, "#frame"), b: await R(k, "#left") };
    await ev(k, "mouseReleased", x + dx, y + dy);
    await ev(k, "mouseMoved", 8, 8, 0);
    await k.sleep(1300);
    return { held, f: await R(k, "#frame"), b: await R(k, "#left") };
  };
  const f0 = await R(k, "#frame");
  await pull("#hsplit", 0, -200); // the picture smaller: the box floats under it, the spare room below
  const f1 = await R(k, "#frame"),
    again = await pull("#hsplit", 0, 260);
  t.ok(f1.height < f0.height - 100, "made smaller first", { f0: f0.height, f1: f1.height });
  t.ok(again.held.f.height > f1.height + 200, "grabbed again: it grows the whole way in one drag", {
    f1: f1.height,
    held: again.held.f.height,
  });
  /* the picture at its largest: its side edge pulled out — the box mustn't move */
  await k.ev(`(setPaneSize(pageId(),"h",null),sizeFrame(),layoutLeft(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const b0 = await R(k, "#left"),
    side = await pull(".hedge.r", 300, 0);
  t.near(side.held.b.top, b0.top, 1, "the rubber band past its largest: the box doesn't move", {
    b0: b0.top,
    held: side.held.b.top,
  });
}
verticalSharedEdgeAgainAndNoTwitch.opts = { width: 1760, height: 1080, step: 0.05 };

/* squeezed in Vertical (2026-11-02, the user's screenshot): the box's least height has one owner (the editor kept a CSS
   min-height of its own), and the text that scrolls under the controls does so behind the fade at once (the fade
   waited for the box to stop changing: during a drag or a settle the text slid under the controls bare) */
export async function squeezedBoxScrollsNoOverlap(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.job("[fill:446688] wide", { ar: "21:9", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.ev(
    `(P.value=Array(9).fill("epic cinematic shot of a castle tower at night, fog, mist, moon, dark forest").join(" "),P.dispatchEvent(new Event("input")),1)`,
  );
  await k.mouse(2, 2);
  await k.sleep(1400);
  const h = await R(k, "#hsplit"),
    x = h.left + h.width / 2,
    y = h.top + h.height / 2;
  await ev(k, "mouseMoved", x, y, 0);
  await ev(k, "mousePressed", x, y);
  for (let i = 1; i <= 10; i++) await ev(k, "mouseMoved", x, y + 30 * i);
  await ev(k, "mouseReleased", x, y + 300);
  await ev(k, "mouseMoved", 8, 8, 0);
  await k.sleep(1300);
  const r = await k.ev(
    `(()=>{const w=document.querySelector(".pwrapT"),s=w.querySelector(".cm-scroller");return{scrolls:s.scrollHeight>s.clientHeight,more:(parseFloat(getComputedStyle(s).getPropertyValue("--fb"))||0)>0}})()`,
  );
  t.ok(r.scrolls, "squeezed: the text scrolls inside the box", r);
  /* the fade is the scroll edge's, in CSS on the scroll position (acf4d60, DD-2026-11-09-3): its bottom fade is on */
  t.ok(r.more, "…and slides under the controls behind the fade (not bare): the bottom edge fades", r);
}
squeezedBoxScrollsNoOverlap.opts = { width: 1760, height: 1080, step: 0.05 };

/* the grip works in every mode (2026-11-02, the user: in Full side by side the box's title didn't drag) */
export async function gripInFullMode(k, t) {
  await k.ev(`(setDock("left"),S.hmode="full",updHm(),layoutLeft(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  const tt = await R(k, "#ltitle"),
    x = tt.left + 30,
    y = tt.top + tt.height - 14;
  await ev(k, "mouseMoved", x, y, 0);
  await ev(k, "mousePressed", x, y);
  for (let i = 1; i <= 6; i++) await ev(k, "mouseMoved", x + 10 * i, y + 10 * i);
  await k.sleep(150);
  t.ok(await k.ev(`document.body.classList.contains("cardmove")`), "Full: pressing the title grips the box");
  await ev(k, "mouseReleased", x + 60, y + 60);
  await ev(k, "mouseMoved", 8, 8, 0);
  await k.sleep(600);
  await k.ev(`(S.hmode="",updHm(),layoutLeft(),1)`);
}
gripInFullMode.opts = { width: 1760, height: 1080, step: 0.05 };

/* the Right layout (2026-11-03, the user's screenshots): pulling the prompt box's outer edge slid the picture under the
   box — the press rebuilt the picture's area the old way (the picture alone) while its place in the area came from the
   layout pass (its buttons' strip first, on the left in Right). The Left layout's strip is on the right: no jump there.
   Held either way, the picture doesn't move and stays one gap from the box */
export async function boxOuterEdgeKeepsThePicture(k, t) {
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  for (const dock of ["right", "left"]) {
    await k.ev(`(setDock(${JSON.stringify(dock)}),1)`);
    await k.mouse(2, 2);
    await k.sleep(1400);
    for (const dx of dock === "right" ? [-120, 40] : [120, -40]) {
      const f0 = await R(k, "#frame"), // where it is when this drag starts
        L0 = await R(k, "#left"),
        a = await dragMeasure(k, ".pedge.po", dx, ["#frame", "#left"]),
        f = a.held["#frame"],
        L = a.held["#left"];
      /* B13 (the picture slid under the box) under the pass's rule (C3, DD-2026-11-03-6: a drag is a constraint, the
         pair stays centred): the picture keeps its size and moves only by the mirror — half the box's change, away
         from it as the box grows, toward it as it shrinks — never under the box. (Under the old pin it held still
         and the release glided the pair to centre instead.) */
      const dw = L.width - L0.width;
      t.near(f.width, f0.width, 1, `${dock}, the box's outer edge by ${dx}: held, the picture keeps its size`);
      t.near(Math.abs(f.left - f0.left), Math.abs(dw) / 2, 3, `${dock}: …and moves by the mirror only (½ of ${dw})`);
      t.ok(dock === "right" ? f.right <= L.left - 8 : L.right <= f.left - 8, `${dock}: …clear of the box`, {
        f: [f.left, f.right],
        L: [L.left, L.right],
      });
    }
  }
}
boxOuterEdgeKeepsThePicture.opts = { width: 1386, height: 1080, step: 0.05 };

/* a picture's size is a share of ITS largest (C2a; the user 2026-11-03: after a drag on a 16:9, the Gallery's 3:4
   came up the 16:9's height, 510 px of its 717). A drag left a px cap, read on the next picture by the first one's
   ratio. A drag's release keeps the scale: the next picture, another ratio, gets the same share of its own largest */
/** the frame once it has landed: at the layout's target (sizeFrame's data-tw / data-th) and unchanged for 300 ms. A new
 * picture of another shape crops and reveals (~1.1 s), and a finished render waits ~270 ms for its image before it does:
 * a fixed sleep caught it mid-way on CI (2026-11-07: a 3:4 at 0.28 of its size), and "still for 300 ms" alone was
 * fooled by that wait */
async function stillFrame(k) {
  let last = "",
    same = 0;
  for (let i = 0; i < 60 && same < 3; i++) {
    const r = await k.ev(`(()=>{const f=document.getElementById("frame"),d=f.dataset;
      return [f.offsetLeft,f.offsetTop,f.offsetWidth,f.offsetHeight,+d.tw,+d.th,current()?1:0]})()`),
      key = r.slice(0, 4).join(),
      atGoal = Math.abs(r[2] - r[4]) <= 1 && Math.abs(r[3] - r[5]) <= 1 && !r[6];
    same = atGoal && key === last ? same + 1 : 0;
    last = key;
    await k.sleep(100);
  }
  return R(k, "#frame");
}

export async function dragKeepsAScaleNotPixels(k, t) {
  await k.ev(`(setDock("right"),1)`);
  const show = async (name, ar) => {
    await k.job(`[fill:446688] ${name}`, { ar, steps: 2 });
    await k.until(`!current()&&jobs.length&&jobs.every(j=>j.status==="done")`, 30000);
    await k.mouse(2, 2);
    await k.sleep(400);
    return stillFrame(k);
  };
  const tall0 = await show("tall", "3:4"), // at its biggest: the whole room's height
    wide0 = await show("wide", "16:9"), // at its biggest: the room's width
    a = await dragMeasure(k, ".pedge.ro", 150, ["#frame"]), // Right: the outer edge is the left one; in by 150
    share = a.after["#frame"].width / wide0.width;
  t.ok(share < 0.95 && share > 0.6, "the 16:9 dragged smaller", { share });
  const tall1 = await show("tall again", "3:4");
  t.near(tall1.height / tall0.height, share, 0.03, "the next 3:4: the same share of its own largest", {
    h: tall1.height,
    full: tall0.height,
  });
}
dragKeepsAScaleNotPixels.opts = { width: 1900, height: 1300, step: 0.05 };
