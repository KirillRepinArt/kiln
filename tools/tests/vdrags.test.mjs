// Vertical's drags — acceptance for v0.7c C4c (ux-review/16-layout-pass.md C4: the shared edge trades, the box's outer
// edge sets its height, through the layout pass). PENDING in run.mjs: these were written for the old Vertical maths
// (the box a row of its own, the divider's holds) and moved here at C4b step 2 (2026-11-09), when Vertical's at-rest
// layout moved to the pass; C4c rewrites them to the model's rule 4 and removes the PENDING entry.
const R = (k, sel) => k.rect(sel);
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
const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);

/* each axis is yours or its content's (2026-11-02, DEVLOG DD-2026-11-02-14): in Vertical the picture's height is yours
   and the box's is its text's. The edge they share (two handles: the line above the title, the box's top) moves both:
   the picture records it, the box takes what's left — squeezed, never below its least; past a limit the rubber band */
export async function dividerSizesThePicture(k, t) {
  const L = "String.fromCharCode(10)";
  await k.ev(`(setDock("below"),1)`);
  await k.job("[fill:446688] wide", { ar: "16:9", steps: 2 });
  await done(k, 1);
  await k.ev(`(P.value=Array(30).fill("a line of prompt text").join(${L}),P.dispatchEvent(new Event("input")),1)`);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const area = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-area"))`);
  /** drag a handle by dy and let go; the frame and the box held, and after */
  const pull = async (sel, dy) => {
    const h = await R(k, sel),
      x = h.left + h.width / 2,
      y = h.top + h.height / 2;
    await press(k, x, y);
    await moveTo(k, x, y, x, y + dy);
    await k.sleep(300);
    const held = { f: await R(k, "#frame"), b: await R(k, "#left") };
    await release(k, x, y + dy);
    await k.mouse(2, 2);
    await k.sleep(1300);
    return { held, f: await R(k, "#frame"), b: await R(k, "#left") };
  };
  const f0 = await R(k, "#frame"),
    b0 = await R(k, "#left");
  /* a long draft: the box at its text (~40 %). Down: the picture grows, the box is squeezed */
  const down = await pull("#hsplit", 150);
  t.ok(down.held.f.height > f0.height + 100, "the shared edge down: the picture grows", {
    f0: f0.height,
    held: down.held.f.height,
  });
  t.ok(down.held.b.height < b0.height - 100, "…the box is squeezed (its text scrolls)", { held: down.held.b.height });
  t.near(down.f.height, down.held.f.height, 4, "let go: the picture keeps its size (yours)");
  t.ok(await k.ev(`paneSize().h>0&&!("sch" in S)`), "the picture's height is kept, the box's never");
  /* the box's top edge (the same edge, below the title) up: the picture shrinks, the box grows back to its text */
  const up = await pull(".vedge.t", -150);
  t.near(up.f.height, f0.height, 6, "the box's top up: the picture back down", { f: up.f.height });
  t.near(up.b.height, b0.height, 4, "…and the box back to its text");
  /* double-click: the picture fills again */
  const hs = await R(k, "#hsplit");
  for (const type of ["mousePressed", "mouseReleased"])
    await k.send("Input.dispatchMouseEvent", {
      type,
      x: hs.left + hs.width / 2,
      y: hs.top + hs.height / 2,
      button: "left",
      clickCount: 2,
    });
  await k.mouse(2, 2);
  await k.sleep(1000);
  t.ok(await k.ev(`paneSize().h==null`), "double-click: no height of yours — the picture fills again");
  /* a short draft: the box at its least — down there's nothing to squeeze: a little give */
  await k.ev(`(P.value="a short prompt",draft=P.value,P.dispatchEvent(new Event("input")),1)`);
  await k.mouse(2, 2);
  await k.sleep(1400);
  const f1 = await R(k, "#frame"),
    s1 = await pull("#hsplit", 150);
  t.ok(s1.held.f.height - f1.height <= area, "the box at its least: the picture gives a little at most", {
    f1: f1.height,
    held: s1.held.f.height,
  });
  t.near(s1.f.height, f1.height, 3, "…and settles back");
  /* an old saved height (S.sch, before 2026-11-01) is dropped at start-up */
  await k.ev(`(S.sch=420,save(),1)`);
  await k.reload();
  await k.until("!!(window.LIVE&&window._jobsReady)", 15000);
  await k.sleep(1200);
  t.ok(await k.ev(`!("sch" in S)`), "an old kept height is dropped at start-up");
}
dividerSizesThePicture.opts = { width: 2000, height: 1023, step: 0.05 };

/* the shared edge up 60 px: the box keeps its text, the picture 60 smaller (yours), the spare room at the bottom */
export async function splitLineUp(k, t) {
  await k.ev(`(setDock("below"),1)`);
  await k.job("[fill:446688] sq", { ar: "1:1", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(
    `(P.value=Array(40).fill("a long line of prompt text").join(String.fromCharCode(10)),P.dispatchEvent(new Event("input")),1)`,
  );
  await k.mouse(2, 2);
  await k.sleep(1500);
  const slot = (await k.rect("#left")).height;
  const e = await k.rect("#hsplit"),
    x = e.left + e.width / 2,
    y = e.top + e.height / 2,
    b0 = (await k.rect("#left")).bottom,
    p0 = (await k.rect("#frame")).height;
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 6; i++) {
    await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: y - 10 * i, button: "left", buttons: 1 });
    await k.sleep(30);
  }
  await k.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y: y - 60,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await k.sleep(1200);
  t.near((await k.rect("#left")).height, slot, 3, "the shared edge up 60 px: the box still fits its text");
  t.near((await k.rect("#frame")).height, p0 - 60, 4, "…the picture 60 smaller (yours)", {
    p0,
    p1: (await k.rect("#frame")).height,
  });
  t.ok((await k.rect("#left")).bottom < b0 - 40, "…the box rode up glued: the spare room at the bottom");
}
splitLineUp.opts = { width: 1872, height: 1080, step: 0.05 };
