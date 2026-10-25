// Phase 2a step 2: docking the prompt — Layout presets and drag-to-dock.
const R = (k, sel) => k.rect(sel);
const viewport = (k, w, h) =>
  k.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
const stacked = k => k.ev(`document.querySelector(".app").classList.contains("stacked")`);
const menu = async (k, v) => {
  await k.ev(`($("layBtn").click(),1)`);
  await k.sleep(150);
  await k.ev(`(document.querySelector('#layMenu [data-lay="${v}"]').click(),1)`);
  await k.sleep(800);
};
const nearZone = k => k.ev(`(()=>{const z=document.querySelector(".dockzone.near");return z?z.dataset.z:null})()`);
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
async function drag(k, sel, dx) {
  const h = await R(k, sel),
    x = h.left + h.width / 2,
    y = h.top + Math.min(200, h.height / 2);
  await press(k, x, y);
  await moveTo(k, x, y, x + dx, y);
  await release(k, x + dx, y);
  await k.sleep(600);
}

export async function presets(k, t) {
  await viewport(k, 1700, 950);
  await k.mouse(2, 2);
  await k.sleep(600);
  await menu(k, "right");
  let L = await R(k, "#left"),
    Rr = await R(k, "#right");
  t.ok(
    L.left > Rr.right &&
      Math.round(L.left - Rr.right) === 18 &&
      Math.abs((await R(k, "#lcol")).top - Rr.top) < 2 &&
      Rr.bottom <= 950,
    "Horizontal · prompt on the right: right of the picture, same row, 18 px gap",
    { L: L.left, R: [Rr.right, Rr.top, Rr.bottom] },
  );
  t.ok(Math.abs(Rr.left - 18 - (1700 - 18 - L.right)) <= 3, "the pair is centred");
  t.ok(
    await k.ev(`document.querySelector('#layMenu [data-lay="right"]').classList.contains("on")`),
    "the menu ticks the current preset",
  );
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(500);
  const a = Math.round((await R(k, "#right")).width),
    room = Math.min(60, Math.round((await R(k, "#right")).left) - 18 - 4);
  await drag(k, ".pedge.ro", -room);
  await k.mouse(2, 2);
  await k.sleep(500);
  const b = Math.round((await R(k, "#right")).width);
  t.ok(
    room > 10 && Math.abs(b - (a + room)) <= 1,
    "mirrored edges: the image area's (now left) outer edge, dragged left, widens it",
    { a, b, room },
  );
  const pw0 = Math.round((await R(k, "#left")).width),
    room2 = Math.min(50, 1700 - 18 - Math.round((await R(k, "#left")).right) - 4);
  await drag(k, ".pedge.po", room2);
  await k.mouse(2, 2);
  await k.sleep(500);
  t.ok(
    room2 > 10 && Math.abs(Math.round((await R(k, "#left")).width) - (pw0 + room2)) <= 1,
    "…and the prompt's (now right) outer edge, dragged right, widens the prompt",
    { pw0, room2 },
  );
  await menu(k, "below");
  t.ok(await stacked(k), "Vertical: stacked even on a wide window");
  L = await R(k, "#left");
  const f = await R(k, "#frame");
  t.ok(L.top > f.bottom, "the prompt is under the picture");
  await k.reload();
  await k.sleep(800);
  await k.until("!!(window.LIVE&&window._jobsReady)", 15000);
  await k.sleep(800);
  t.ok(await stacked(k), "remembered after a restart");
  await menu(k, "left");
  t.ok(
    !(await stacked(k)) && (await R(k, "#left")).right < (await R(k, "#right")).left,
    "Horizontal · prompt on the left: back beside it",
  );
}

export async function narrowKeepsChoice(k, t) {
  await viewport(k, 1700, 950);
  await menu(k, "right");
  await viewport(k, 900, 900);
  await k.sleep(700);
  t.ok(await stacked(k), "a narrow window stacks even with the prompt docked right");
  await viewport(k, 1700, 950);
  await k.sleep(700);
  t.ok(
    !(await stacked(k)) && (await R(k, "#left")).left > (await R(k, "#right")).right,
    "wide again: back on the right",
  );
}

export async function dragToDock(k, t) {
  await viewport(k, 1700, 950);
  await k.mouse(2, 2);
  await k.sleep(600);
  let n = await R(k, "#ltitle"),
    x = n.left + 20,
    y = n.top + n.height / 2;
  await press(k, x, y);
  await moveTo(k, x, y, 1600, 400);
  const z1 = await nearZone(k);
  await release(k, 1600, 400);
  await k.sleep(800);
  t.ok(z1 === "right", "dragging the name line to the right shows the right drop zone", z1);
  t.ok(
    (await k.ev(`S.dock`)) === "right" && (await R(k, "#left")).left > (await R(k, "#right")).right,
    "dropping there docks the prompt on the right",
  );
  await k.mouse(2, 2);
  await k.sleep(300);
  n = await R(k, "#ltitle");
  x = n.left + 20;
  y = n.top + n.height / 2;
  const yBot =
    y +
    (await k.ev(
      `(()=>{const c=$("lcol"),TS=parseFloat(c.style.getPropertyValue("--ts"))||64;return c.clientHeight-TS-$("left").offsetHeight-chipsH()-(lyTop||0)})()`,
    ));
  await press(k, x, y);
  await moveTo(k, x, y, x, Math.min(940, yBot + 40));
  const z2 = await nearZone(k);
  await release(k, x, Math.min(940, yBot + 40));
  await k.sleep(800); // to the bottom position and a little past it
  t.ok(
    z2 === null && (await k.ev(`S.dock`)) === "right" && (await k.ev(`S.pos`)) === "bot",
    "straight down its own column: the bottom position, never a dock",
    { z2, dock: await k.ev(`S.dock`), pos: await k.ev(`S.pos`) },
  );
  await k.mouse(2, 2);
  await k.sleep(300);
  n = await R(k, "#ltitle");
  x = n.left + 20;
  y = n.top + n.height / 2;
  await press(k, x, y);
  await moveTo(k, x, y, 850, 900);
  const z3 = await nearZone(k);
  await release(k, 850, 900);
  await k.sleep(900);
  t.ok(
    z3 === "below" && (await stacked(k)) && (await k.ev(`S.dock`)) === "below",
    "dragged out to the bottom: docked below",
    z3,
  );
}
