// Panel layout: what must hold before and after the Phase 2a rewrite, plus the new behaviour.
const R = (k, sel) => k.rect(sel);
const viewport = (k, w, h) =>
  k.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
const settle = k => k.sleep(700);
const overlapX = (a, b) => !(a.right <= b.left || a.left >= b.right);

export async function wideBasics(k, t) {
  await viewport(k, 1513, 900);
  await settle(k);
  const L = await R(k, "#left"),
    Rr = await R(k, "#rpanel"),
    tabs = await R(k, ".tabs"),
    f = await R(k, "#frame"),
    p = await R(k, "#prog");
  t.ok(!(await k.ev(`document.querySelector(".app").classList.contains("stacked")`)), "1513×900: side by side");
  t.ok(!overlapX(L, Rr) && L.right < Rr.left, "the prompt is left of the right area, no overlap", {
    L: [L.left, L.right],
    R: [Rr.left, Rr.right],
  });
  const tk = await k.ev(
    `(()=>{const k=document.querySelector(".tabs").children,a=k[0].getBoundingClientRect(),b=k[k.length-1].getBoundingClientRect();return{l:a.left,r:b.right}})()`,
  );
  t.ok(
    Math.abs(tabs.width - Rr.width) < 2 && tk.l >= Rr.left - 1 && tk.r <= Rr.right + 1,
    "the tab bar is as wide as the right area, its buttons inside it",
    { tabs: [tabs.left, tabs.width], tk, R: [Rr.left, Rr.right] },
  );
  t.ok(f.left >= Rr.left - 1 && f.right <= Rr.right + 1, "the image sits inside the right area");
  const tb = await k.ev(`tbW($("frame").offsetHeight)`); // the room kept for the edit buttons (hidden with no picture)
  t.ok(
    Math.abs((f.left + f.right + tb) / 2 - (Rr.left + Rr.right) / 2) < 3,
    "the picture and its toolbar's room are centred in it",
    { f: [f.left, f.right], tb, R: [Rr.left, Rr.right] },
  );
  t.ok(
    await k.until(
      `(()=>{const p=$("prog").getBoundingClientRect(),f=$("frame").getBoundingClientRect();return Math.abs(p.left-f.left)<2&&Math.abs(p.width-f.width)<2&&p.top>f.bottom})()`,
      2000,
    ),
    "the status row sits under the image, as wide",
    { p: [p.left, p.width, p.top], f: [f.left, f.width, f.bottom] },
  );
  t.ok(L.left >= 0 && Rr.right <= 1513, "everything on screen");
}

export async function narrowStacks(k, t) {
  await viewport(k, 900, 900);
  await settle(k);
  t.ok(
    await k.ev(`document.querySelector(".app").classList.contains("stacked")`),
    "900 wide: stacked (prompt under the image)",
  );
  const L = await R(k, "#left"),
    f = await R(k, "#frame");
  t.ok(L.top > f.bottom, "the prompt is below the image");
  await viewport(k, 1513, 900);
  await settle(k);
  t.ok(
    !(await k.ev(`document.querySelector(".app").classList.contains("stacked")`)),
    "back to side by side when wide again",
  );
}

export async function promptPositions(k, t) {
  await viewport(k, 1513, 900);
  await settle(k);
  const pos = {};
  for (const p of ["top", "mid", "bot"]) {
    await k.ev(`(S.pos="${p}",lyFrozen=false,layoutLeft(),1)`);
    await settle(k);
    pos[p] = (await R(k, "#left")).top;
  }
  t.ok(pos.top < pos.mid && pos.mid < pos.bot, "top / middle / bottom positions differ in order", pos);
  const f = await R(k, "#frame");
  await k.ev(`(S.pos="top",lyFrozen=false,layoutLeft(),1)`);
  await settle(k);
  t.ok(Math.abs((await R(k, "#left")).top - f.top) < 3, "top: level with the image's top");
}

export async function tabsKeepWidth(k, t) {
  await viewport(k, 1513, 900);
  await settle(k);
  const w = {};
  for (const ar of ["3:4", "16:9", "21:9"]) {
    await k.job("x", { ar, steps: 2 });
    await k.until(
      `!current()&&jobs.filter(j=>j.status==="done").length>=${["3:4", "16:9", "21:9"].indexOf(ar) + 1}`,
      30000,
    );
    await settle(k);
    for (const v of ["queue", "loras", "png"]) {
      await k.ev(`(showView("${v}"),1)`);
      await settle(k);
      w[ar + " " + v] = Math.round((await R(k, "#rpanel")).width);
    }
  }
  const vals = Object.values(w);
  t.ok(
    vals.every(x => x === vals[0]),
    "Queue, LoRAs and PNG Info keep one width whatever the picture's shape",
    w,
  );
}
tabsKeepWidth.opts = { step: 0.3 };

/* Phase 2a step 1: four edges, each changing only its own panel; proportional free space; reset */
async function drag(k, sel, dx) {
  const h = await R(k, sel),
    x = h.left + h.width / 2,
    y = h.top + Math.min(200, h.height / 2);
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 8; i++)
    await k.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x + (dx * i) / 8,
      y,
      button: "left",
      buttons: 1,
    }); // the button stays down (or the browser treats it as released)
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dx, y, button: "left", clickCount: 1 });
  await k.sleep(400);
}
const box = async k => {
  const L = await R(k, "#left"),
    Rr = await R(k, "#right");
  return { pl: Math.round(L.left), pr: Math.round(L.right), rl: Math.round(Rr.left), rr: Math.round(Rr.right) };
};

let AREA = 20; // the area gap (prompt ↔ picture, the window's edge): each test reads it from the page's tokens
const readArea = async k =>
  (AREA = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-area"))`));
const centred = b => Math.abs(b.pl - AREA - (1700 - AREA - b.rr)) <= 2;
const b0ok = a => a.rl - a.pr === AREA && centred(a);
export async function dividerAndEdges(k, t) {
  await readArea(k);
  await viewport(k, 1700, 950);
  await k.ev(`(showView("queue"),1)`);
  await settle(k);
  let a = await box(k);
  t.ok(b0ok(a), "default: a centred pair, the area gap between", a);
  await drag(k, ".pedge.ri", -100);
  await k.sleep(500);
  let b = await box(k);
  t.ok(
    b.rr - b.rl === a.rr - a.rl + 100 && b.pr - b.pl === a.pr - a.pl - 100 && b.rl - b.pr === AREA && centred(b),
    "dragging the image area's left edge: it grows exactly as much as the prompt shrinks; still centred",
    { a, b },
  );
  await drag(k, ".pedge.ri", -2000);
  await k.sleep(500);
  b = await box(k);
  t.ok(b.pr - b.pl === 360, "the prompt stops at its minimum (360)", b.pr - b.pl);
  a = b;
  await drag(k, ".pedge.pi", 150);
  await k.sleep(500);
  b = await box(k);
  t.ok(b.pr - b.pl === a.pr - a.pl + 150 && b.rl - b.pr === AREA, "the prompt's right edge is the same divider", {
    a,
    b,
  });
  a = b;
  const room = Math.max(10, Math.min(80, 1700 - AREA - a.rr - 4)); // as far as the free space allows
  const h = await R(k, ".pedge.ro"),
    x = h.left + h.width / 2,
    y = h.top + 200;
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 8; i++)
    await k.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x + (room * i) / 8,
      y,
      button: "left",
      buttons: 1,
    });
  await k.sleep(100);
  const mid = await box(k);
  t.ok(
    Math.abs(mid.rr - (a.rr + room)) <= 1 && mid.pl === a.pl,
    "an outer edge follows the cursor while you drag (the rest holds still)",
    { a, mid, room },
  );
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + room, y, button: "left", clickCount: 1 });
  await k.sleep(600);
  b = await box(k);
  t.ok(
    Math.abs(b.rr - b.rl - (a.rr - a.rl + room)) <= 1 && centred(b),
    "…and on release the pair glides back to centre",
    { a, b },
  );
  a = b;
  const room2 = Math.max(10, Math.min(60, a.pl - AREA - 4));
  await drag(k, ".pedge.po", -room2);
  await k.sleep(500);
  b = await box(k);
  t.ok(
    Math.abs(b.pr - b.pl - (a.pr - a.pl + room2)) <= 1 && b.rr - b.rl === a.rr - a.rl && centred(b),
    "the prompt's outer edge: only the prompt changes; centred as soon as you let go",
    { a, b, room2 },
  );
  const w = (await R(k, "#rpanel")).width;
  await k.ev(`(showView("loras"),1)`);
  await settle(k);
  t.ok(Math.abs((await R(k, "#rpanel")).width - w) < 1, "LoRAs has the same width as Queue");
  await k.reload();
  await k.sleep(800);
  await k.until("!!(window.LIVE&&window._jobsReady)", 15000);
  await k.ev(`(showView("queue"),1)`);
  await settle(k);
  const c = await box(k);
  t.ok(Math.abs(c.pl - b.pl) <= 1 && Math.abs(c.rr - b.rr) <= 1, "remembered after a restart", { b, c });
}

export async function windowResize(k, t) {
  await readArea(k);
  await viewport(k, 1700, 950);
  await k.ev(`(showView("queue"),1)`);
  await settle(k);
  const a = await box(k);
  await viewport(k, 2200, 950);
  await settle(k);
  const b = await box(k);
  t.ok(
    b.pr - b.pl === a.pr - a.pl && b.rr - b.rl === a.rr - a.rl && b.rl - b.pr === AREA,
    "a wider window: the panels keep your widths (the margins grow)",
    { a, b },
  );
  await viewport(k, 1500, 950);
  await settle(k);
  const c = await box(k);
  t.ok(c.pr - c.pl === a.pr - a.pl && c.rr - c.rl === a.rr - a.rl, "narrower but still room: nothing shrinks yet", {
    a,
    c,
  });
  await viewport(k, 1250, 950);
  await settle(k);
  const d = await box(k);
  t.ok(
    d.pl - AREA <= 26 &&
      Math.abs(d.pl - AREA - (1250 - AREA - d.rr)) <= 2 &&
      d.rl - d.pr === AREA &&
      d.pr - d.pl < a.pr - a.pl,
    "too narrow: the margins go down to ~24 px (less only at the panels' minimums), then both panels shrink",
    d,
  );
  await viewport(k, 1700, 950);
  await settle(k);
  const e = await box(k);
  t.ok(e.pr - e.pl === a.pr - a.pl && e.rr - e.rl === a.rr - a.rl, "wide again: back to your widths", { a, e });
}

export async function resetAndDoubleClick(k, t) {
  await readArea(k);
  await viewport(k, 1700, 950);
  await k.ev(`(showView("queue"),1)`);
  await settle(k);
  await drag(k, ".pedge.po", -80);
  await drag(k, ".pedge.ro", 60);
  await k.sleep(500);
  const h = await R(k, ".pedge.po");
  await k.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: h.left + 6,
    y: h.top + 100,
    button: "left",
    clickCount: 2,
  });
  await k.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: h.left + 6,
    y: h.top + 100,
    button: "left",
    clickCount: 2,
  });
  await k.sleep(500);
  t.ok(
    await k.until(`Math.abs($("left").getBoundingClientRect().width-680)<=2`, 3000, 100),
    "double-click the prompt's edge: its default width",
    (await R(k, "#left")).width,
  );
  await k.ev(`($("layBtn").click(),1)`);
  await k.sleep(200);
  await k.ev(`(document.querySelector('[data-lay="reset"]').click(),1)`);
  await settle(k);
  const r = await box(k);
  t.ok(
    Math.abs(r.pr - r.pl - 680) <= 1 &&
      Math.abs(r.rr - r.rl - 660) <= 1 &&
      r.rl - r.pr === AREA &&
      Math.abs(r.pl - AREA - (1700 - AREA - r.rr)) <= 2,
    "Layout → Reset: the default sizes for this window, centred",
    r,
  );
}

/* Generating: the image area hugs the picture; nothing moves under the cursor */
const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);
const gapToPic = async k => {
  const L = await R(k, "#left"),
    f = await R(k, "#frame");
  return Math.round(f.left - L.right);
};

export async function hugsThePicture(k, t) {
  await readArea(k);
  await viewport(k, 1700, 950);
  await k.mouse(2, 2);
  await k.job("[fill:dc2828] portrait", { ar: "3:4", steps: 2 });
  await done(k, 1);
  await k.job("[fill:2850e6] landscape", { ar: "16:9", steps: 2 });
  await done(k, 2);
  await k.sleep(900);
  const wide = (await R(k, "#frame")).width;
  t.ok(
    Math.abs((await gapToPic(k)) - AREA) <= 1,
    "a landscape picture: the prompt sits one area gap from it",
    await gapToPic(k),
  );
  await k.ev(`(document.activeElement.blur(),genNav(-1),updNav(),1)`);
  await k.sleep(900);
  const narrow = (await R(k, "#frame")).width;
  t.ok(narrow < wide - 200, "flipping to the portrait one: the area narrows to it", { wide, narrow });
  t.ok(
    Math.abs((await gapToPic(k)) - AREA) <= 1,
    "…and the prompt still sits one area gap from the picture (no gap in the middle)",
    await gapToPic(k),
  );
  const fr = await R(k, "#right"),
    L = await R(k, "#left");
  t.ok(Math.abs(L.left - 18 - (1700 - 18 - fr.right)) <= 3, "the pair is centred", { l: L.left, r: fr.right });
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(900);
  t.ok(
    Math.abs((await R(k, "#rpanel")).width - (await k.ev(`S.lay.rw`))) <= 1,
    "Queue keeps its own width",
    (await R(k, "#rpanel")).width,
  );
}

export async function holdsWhileYouWork(k, t) {
  await viewport(k, 1700, 950);
  await k.job("[fill:dc2828] portrait", { ar: "3:4", steps: 2 });
  await done(k, 1);
  await k.job("[fill:2850e6] landscape", { ar: "16:9", steps: 2 });
  await done(k, 2);
  await k.sleep(900);
  const f = await R(k, "#frame");
  await k.mouse(f.left + f.width / 2, f.top + f.height / 2);
  await k.sleep(200);
  const before = await R(k, "#rpanel");
  await k.ev(`(document.activeElement.blur(),genNav(-1),updNav(),1)`);
  await k.sleep(500);
  const during = await R(k, "#rpanel");
  await k.sleep(500);
  const after = await R(k, "#rpanel");
  t.ok(
    Math.abs(during.width - after.width) < 2 && Math.abs(after.width - before.width) > 40,
    "flipping with the pointer on the picture: the area goes straight to the new picture's size — one glide, no hold (the arrows hold on their own)",
    { before: [before.left, before.width], during: [during.left, during.width], after: [after.left, after.width] },
  );
  await k.sleep(1100);
  t.ok(
    (await R(k, "#rpanel")).width < before.width - 200,
    "~1 s after the last flip it fits the picture, even with the pointer still there",
  );
  // the prompt holds while a menu in it is open, and adjusts the moment you choose
  await k.mouse(2, 2);
  await k.ev(`(closeShown(),1)`);
  await k.sleep(900);
  const l0 = (await R(k, "#left")).left;
  await k.ev(`($("pAR").click(),1)`);
  await k.sleep(200);
  t.ok(await k.ev(`$("popAR").classList.contains("show")`), "the ratio menu is open");
  await k.ev(`(S.ar=S.ar==="16:9"?"3:4":"16:9",sizeFrame(),1)`);
  await k.sleep(500);
  t.ok(Math.abs((await R(k, "#left")).left - l0) < 1, "while the menu is open the prompt doesn't move", {
    l0,
    now: (await R(k, "#left")).left,
  });
  await k.ev(`(closePops(),document.body.click(),1)`);
  await k.sleep(600);
  const fr = await R(k, "#right"),
    L2 = await R(k, "#left");
  t.ok(Math.abs(L2.left - 18 - (1700 - 18 - fr.right)) <= 3, "once it closes, the pair re-centres", {
    l: L2.left,
    r: fr.right,
  });
}

export async function capInGenerating(k, t) {
  await viewport(k, 1700, 950);
  await k.mouse(2, 2);
  await k.job("[fill:2850e6] landscape", { ar: "16:9", steps: 2 });
  await done(k, 1);
  await k.sleep(900);
  const w0 = (await R(k, "#frame")).width;
  await drag(k, ".pedge.ro", -200);
  await k.mouse(2, 2);
  await k.sleep(900);
  const w1 = (await R(k, "#frame")).width;
  t.ok(w1 < w0 - 100, "in Generating the outer edge caps how wide the picture may be", { w0, w1 });
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(900);
  t.ok(
    Math.abs((await R(k, "#rpanel")).width - (await k.ev(`S.lay.rw`))) <= 1 && (await k.ev(`S.lay.iw`)) != null,
    "…without touching Queue's width",
  );
}

/* step 3: the picture's height limit; the arrows at mid-height */
export async function heightLimit(k, t) {
  await readArea(k);
  await viewport(k, 1700, 950);
  await k.mouse(2, 2);
  await k.job("[fill:dc2828] portrait", { ar: "3:4", steps: 2 });
  await done(k, 1);
  await k.sleep(900);
  const f0 = await R(k, "#frame"),
    h = await R(k, ".hedge.b"),
    x = h.left + h.width / 2,
    y = h.top + 6;
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 8; i++)
    await k.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y: y - (200 * i) / 8,
      button: "left",
      buttons: 1,
    });
  await k.sleep(150);
  const mid = await R(k, "#frame");
  t.ok(
    Math.abs(mid.height - (f0.height - 200)) <= 2 && Math.abs(mid.top - f0.top) <= 1,
    "the bottom edge follows the cursor; the top holds still",
    { f0: [f0.top, f0.height], mid: [mid.top, mid.height] },
  );
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y: y - 200, button: "left", clickCount: 1 });
  await k.mouse(2, 2);
  await k.sleep(800);
  const f1 = await R(k, "#frame"),
    st = await R(k, "#stage");
  t.ok(Math.abs(f1.height - (f0.height - 200)) <= 2, "the limit stays after release", f1.height);
  const bar = await k.ev(`BAR`);
  t.ok(Math.abs(f1.top - st.top - (st.height - bar - f1.height) / 2) <= 2, "the picture re-centres vertically", {
    top: f1.top - st.top,
    h: f1.height,
    bar,
  });
  const want = AREA + Math.max(0, (420 - f1.width - 56) / 2); // 56: the edit buttons' column // in Generating the area only stops at 420 px (the tab bar may overhang a narrow picture)
  t.ok(
    Math.abs(f1.width / f1.height - 0.75) < 0.01 && Math.abs((await gapToPic(k)) - want) <= 1.5,
    "its width follows (3:4); the prompt hugs it",
    { w: f1.width, gap: await gapToPic(k), want },
  );
  await k.mouse(f1.left + f1.width / 2, f1.top + f1.height / 2);
  await k.sleep(300);
  const n = await R(k, ".gnav.next");
  t.ok(Math.abs(n.top + n.height / 2 - (f1.top + f1.height / 2)) <= 2, "the arrows sit at the picture's middle");
  const hb = await R(k, ".hedge.b");
  await k.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: hb.left + 60,
    y: hb.top + 6,
    button: "left",
    clickCount: 2,
  });
  await k.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: hb.left + 60,
    y: hb.top + 6,
    button: "left",
    clickCount: 2,
  });
  await k.mouse(2, 2);
  await k.sleep(800);
  t.ok(Math.abs((await R(k, "#frame")).height - f0.height) <= 2, "double-click: no limit again");
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(500);
  t.ok(
    Math.abs((await R(k, "#rpanel")).height - (await R(k, "#right")).height + 64) <= 2,
    "Queue keeps the full height",
  );
}

const toolsShown = k =>
  k.ev(`getComputedStyle($("gtools")).display!=="none"&&getComputedStyle($("gtools")).opacity>0.5`);
export async function toolbarBesideThePicture(k, t) {
  await viewport(k, 1500, 820);
  await k.mouse(2, 2);
  await k.job("[fill:2850e6] a", { ar: "21:9", steps: 2 });
  await done(k, 1);
  await k.job("[fill:28c83c] b", { ar: "21:9", steps: 2 });
  await done(k, 2);
  await k.sleep(900);
  const f0 = await R(k, "#frame");
  await k.mouse(f0.left + f0.width / 2, f0.top + f0.height / 2);
  await k.sleep(300);
  const f = await R(k, "#frame"),
    n = await R(k, ".gnav.prev"),
    eye = await R(k, "#cbtn");
  await k.mouse(2, 2);
  await k.sleep(500);
  t.ok(
    Math.abs(n.top + n.height / 2 - (f.top + f.height / 2)) <= 2,
    "a short (21:9) picture: the arrows sit at its middle",
  );
  t.ok(eye.right <= f.right && eye.top >= f.top && eye.top < f.top + 30, "the eye sits on the picture, top right", {
    eye: [eye.top, eye.right],
    f: [f.top, f.right],
  });
  t.ok(!(await toolsShown(k)), "the edit buttons are hidden until you hover the picture");
  await k.mouse(f.left + f.width / 2, f.top + f.height / 2);
  await k.sleep(300);
  t.ok(await toolsShown(k), "hovering the picture shows them");
  const g = await R(k, "#gtools");
  await k.mouse(g.left + 20, g.top + 20);
  await k.sleep(450);
  t.ok(await toolsShown(k), "moving onto them keeps them (one hover zone)");
  const btns = await k.ev(
      `[...document.querySelectorAll("#gtools button")].map(b=>{const r=b.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})`,
    ),
    rp = await R(k, "#rpanel");
  t.ok(
    btns.length === 6 && btns.every(([l, , r, b]) => l >= f.right && r <= rp.right + 1 && b <= rp.bottom + 1),
    "all six outside the picture and none cut off (they wrap into a second column)",
    { btns, rp: [rp.right, rp.bottom] },
  );
  await k.mouse(2, 2);
  await k.sleep(500);
  t.ok(!(await toolsShown(k)), "leaving hides them after a moment");
  await k.ev(`(setDock("right"),1)`);
  await k.mouse(2, 2);
  await k.sleep(900);
  const f2 = await R(k, "#frame"),
    g2 = await R(k, "#gtools");
  t.ok(g2.right <= f2.left + 1, "prompt on the right: the column moves to the picture's left (outer) side", {
    f: f2.left,
    g: g2.right,
  });
}

export async function promptMovesWithThePicture(k, t) {
  await viewport(k, 1700, 950);
  await k.mouse(2, 2);
  await k.job("[fill:dc2828] portrait", { ar: "3:4", steps: 2 });
  await done(k, 1);
  await k.job("[fill:2850e6] landscape", { ar: "16:9", steps: 2 });
  await done(k, 2);
  await k.sleep(1000);
  await k.ev(`(document.activeElement.blur(),genNav(-1),updNav(),1)`);
  await k.sleep(320); // just past the 0.25 s glide
  const early = (await R(k, "#left")).top;
  await k.sleep(1000);
  const final = (await R(k, "#left")).top;
  t.ok(
    Math.abs(early - final) <= 3,
    "0.3 s after a flip the prompt is already where it ends up (no lag behind the picture)",
    { early, final },
  );
}
