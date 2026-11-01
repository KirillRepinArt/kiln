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
