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
  t.near(s.held, W - area, 3, "side by side: held, the prompt's outer edge reaches the window less one area gap", s);
  t.ok(s.after < s.held, "let go: the pair settles back to the centre (the box keeps its new width)", s);
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const v = await toEdge(".sedge.r", W);
  t.ok(v.held <= W - area + 3, "Vertical: the box's side never leaves the window", v);
}
edgesReachTheRoom.opts = { width: 1680, height: 1080, step: 0.05 };
