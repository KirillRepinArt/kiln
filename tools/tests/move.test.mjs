// Moving the prompt box is ONE system (v0.7c L1 — the design agreed 2026-10-31, ux-review/13-ownership-map.md L1): one
// placement state {dock, pos}, one drag offering its seven places (left × top / middle / bottom, right × 3, below). The box
// follows the pointer; dashed lanes show where it could go, one glass footprint where it will land — and it lands where
// the footprint was (both come from the layout pass: layout.js placeFor). Esc puts it back. It was two systems: ghost
// outlines for the column's three spots and glass dock zones with thresholds of their own.

const PLACES = [
  ["left", "top"],
  ["left", "mid"],
  ["left", "bot"],
  ["right", "top"],
  ["right", "mid"],
  ["right", "bot"],
  ["below", "mid"],
];
const ev = (k, type, x, y, b = 1) =>
  k.send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: "left",
    buttons: type === "mouseReleased" ? 0 : b,
    clickCount: 1,
  });
const rectOf = (k, sel) =>
  k.ev(
    `(r=>r?[r.left,r.top,r.width,r.height].map(v=>Math.round(v)):null)(document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect())`,
  );
/** a point of the box's grip: its name row, clear of the name field and its buttons */
const grip = async k => {
  const t = await k.rect("#ltitle"),
    n = await k.rect("#pname");
  return [Math.max(t.left + 8, n.left - 12), t.top + t.height / 2];
};

/** press the grip, carry the box's centre to the place's footprint centre, read what's shown, let go */
async function carry(k, dock, pos) {
  const [gx, gy] = await grip(k),
    b0 = await k.rect("#left"),
    to = await k.ev(
      `(r=>[r.x+r.w/2,r.y+r.h/2,Math.round(r.x),Math.round(r.y),Math.round(r.w),Math.round(r.h)])(placeFor(${JSON.stringify(dock)},${JSON.stringify(pos)}))`,
    ),
    [dx, dy] = [to[0] - (b0.left + b0.width / 2), to[1] - (b0.top + b0.height / 2)];
  await ev(k, "mouseMoved", gx, gy, 0);
  await ev(k, "mousePressed", gx, gy);
  /* by a detour (out 150 px, then to the place): even back to its own place is a real drag */
  for (let i = 1; i <= 6; i++) await ev(k, "mouseMoved", gx + 25 * i, gy);
  for (let i = 1; i <= 16; i++) await ev(k, "mouseMoved", gx + 150 + ((dx - 150) * i) / 16, gy + (dy * i) / 16);
  await k.sleep(150);
  const shown = await k.ev(
    `(f=>({dock:f.dataset.dock,pos:f.dataset.pos,r:(r=>[r.left,r.top,r.width,r.height].map(v=>Math.round(v)))(f.getBoundingClientRect()),lanes:document.querySelectorAll(".lane.show").length}))(document.querySelector(".footprint"))`,
  );
  await ev(k, "mouseReleased", gx + dx, gy + dy);
  await ev(k, "mouseMoved", 4, 4, 0);
  await k.sleep(1600);
  return { shown, want: to.slice(2), after: await rectOf(k, "#left") };
}

/** one start: from each layout, every place */
function from(start) {
  const fn = async (k, t) => {
    await k.job("[fill:446688] a", { ar: "3:4", steps: 1 });
    await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
    t.ok(await k.ev(`!document.querySelector(".ghost,.dockzone")`), "one system: no ghost outlines, no dock zones");
    for (const [dock, pos] of PLACES) {
      await k.ev(`(S.pos="mid",setDock(${JSON.stringify(start)}),1)`);
      await k.mouse(4, 4);
      await k.sleep(1600);
      const r = await carry(k, dock, pos),
        name = `${start} → ${dock}${dock === "below" ? "" : " " + pos}`;
      t.ok(r.shown.lanes === 3, `${name}: held, the three lanes show`, r.shown);
      t.ok(
        r.shown.dock === dock && (dock === "below" || r.shown.pos === pos),
        `${name}: held, the footprint is at that place`,
        r.shown,
      );
      t.ok(
        !!r.after && r.after.every((v, i) => Math.abs(v - r.shown.r[i]) <= 2),
        `${name}: let go, the box lands exactly on the footprint shown`,
        { footprint: r.shown.r, landed: r.after },
      );
      t.ok(
        (await k.ev(`(S.dock||"left")`)) === dock && (dock === "below" || (await k.ev(`S.pos`)) === pos),
        `${name}: its place is the state {dock, pos}`,
      );
    }
    /* Esc: back where it was */
    await k.ev(`(S.pos="mid",setDock(${JSON.stringify(start)}),1)`);
    await k.mouse(4, 4);
    await k.sleep(1600);
    const b0 = await rectOf(k, "#left"),
      [gx, gy] = await grip(k);
    await ev(k, "mouseMoved", gx, gy, 0);
    await ev(k, "mousePressed", gx, gy);
    for (let i = 1; i <= 8; i++) await ev(k, "mouseMoved", gx + 30 * i, gy + 20 * i);
    await k.sleep(100);
    await k.key("Escape");
    await ev(k, "mouseReleased", gx + 240, gy + 160);
    await ev(k, "mouseMoved", 4, 4, 0);
    await k.sleep(1200);
    const b1 = await rectOf(k, "#left");
    t.ok(
      b1.every((v, i) => Math.abs(v - b0[i]) <= 1),
      `${start}: Esc while moving it — back where it was`,
      { b0, b1 },
    );
  };
  fn.opts = { width: 1600, height: 950, limitMin: 5 };
  return fn;
}
export const moveFromSide = from("left");
export const moveFromBelow = from("below");
