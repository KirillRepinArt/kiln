// Moving the prompt box is ONE system (v0.7c L1 — agreed 2026-10-31; its look, the drop map, L1b 2026-11-11 —
// ux-review/18-box-placement.md): one placement state {dock, pos}, one drag offering its seven places (left × top /
// middle / bottom, right × 3, below). Carried, the box is a token under the hand and a MAP of its places shows behind it
// (an ideogram: its partner's edges unfolded); the tile under the pointer is lit, and let go there the box lands at that
// place's resting place (the layout pass's). Esc puts it back. (Before the map: lanes and a footprint each from the
// layout pass for its own place, and "lands exactly on the footprint shown" — retired with the footprint, DD-2026-11-10-8.)

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

/** press the grip, carry the pointer onto the place's tile (by a detour), read what's shown, let go */
async function carry(k, dock, pos) {
  const [gx, gy] = await grip(k);
  await ev(k, "mouseMoved", gx, gy, 0);
  await ev(k, "mousePressed", gx, gy);
  /* by a detour (out 150 px, then to the place): even back to its own place is a real drag */
  for (let i = 1; i <= 6; i++) await ev(k, "mouseMoved", gx + 25 * i, gy);
  const to = await k.ev(
    `(r=>r&&[r.left+r.width/2,r.top+r.height/2])(document.querySelector('.droptile[data-dock=${JSON.stringify(dock)}][data-pos=${JSON.stringify(pos)}]')?.getBoundingClientRect())`,
  );
  for (let i = 1; i <= 16; i++)
    await ev(k, "mouseMoved", gx + 150 + ((to[0] - gx - 150) * i) / 16, gy + ((to[1] - gy) * i) / 16);
  await k.sleep(150);
  const shown = await k.ev(
    `(()=>{const h=document.querySelector(".droptile.hot");return {dock:h&&h.dataset.dock,pos:h&&h.dataset.pos,tiles:document.querySelectorAll(".dropmap.show .droptile").length}})()`,
  );
  await ev(k, "mouseReleased", to[0], to[1]);
  await ev(k, "mouseMoved", 4, 4, 0);
  await k.sleep(1600);
  const want = await k.ev(
    `(r=>[r.x,r.y,r.w,r.h].map(v=>Math.round(v)))(placeFor(${JSON.stringify(dock)},${JSON.stringify(pos)}))`,
  );
  return { shown, want, after: await rectOf(k, "#left") };
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
      t.ok(r.shown.tiles === 7, `${name}: held, the drop map shows its seven places`, r.shown);
      t.ok(
        r.shown.dock === dock && (dock === "below" || r.shown.pos === pos),
        `${name}: held, the tile under the pointer is lit`,
        r.shown,
      );
      t.ok(
        !!r.after && r.after.every((v, i) => Math.abs(v - r.want[i]) <= 2),
        `${name}: let go, the box lands at that place's resting place`,
        { want: r.want, landed: r.after },
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
