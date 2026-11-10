// The box in your hand, from press to rest (L1c — DEVLOG DD-2026-11-11-8): ONE gesture, checked whole, for every kind of
// move — another spot in its own lane, the other side, into and out of Vertical. The laws, per frame:
//   · it is seen every frame (never faded, never a copy);
//   · the lift is a motion: the box condenses to the token over frames, never in one (a change the system makes runs on
//     the driver — the token's shrink was written at once: the user, 2026-11-11 "made in a jump — no bueno");
//   · let go, it goes from where it is seen to where it lands, never farther from it — no frame back at its origin (the
//     user, 2026-11-11: "it teleports to its original position and then travels from there");
//   · it rests at its full size.
// Real pointer events; t.motion for what's sampled in real time (judged on a real PC, reported on CI).
const viewport = (k, w, h) =>
  k.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
const menu = async (k, v) => {
  await k.ev(`($("layBtn").click(),1)`);
  await k.sleep(150);
  await k.ev(`(document.querySelector('#layMenu [data-lay="${v}"]').click(),1)`);
  await k.sleep(1600);
};
const mouse = (k, type, x, y, buttons = 1) =>
  k.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1 });

/* per frame, after the frame's writes: [ms, carried (body.cardmove), the box's left, top, width, height, how seen] */
const REC = `(()=>{window.__r=[];window.__stop=false;const t0=performance.now(),
  eff=e=>{let o=+getComputedStyle(e,"::before").opacity;for(let a=e;a;a=a.parentElement)o*=+getComputedStyle(a).opacity;return o};
  (function f(){requestAnimationFrame(()=>setTimeout(()=>{const r=$("left").getBoundingClientRect();
    __r.push([Math.round(performance.now()-t0),document.body.classList.contains("cardmove")?1:0,r.left,r.top,r.width,r.height,eff($("left"))]);
    if(!__stop)f()},0))})();return 1})()`;

/** one whole gesture: from dock `from`, carried onto the tile {dock, pos}, let go; returns the frames */
async function gesture(k, from, dock, pos) {
  await menu(k, from);
  await k.mouse(4, 4);
  await k.sleep(400);
  const n = await k.rect("#ltitle"),
    x = n.left + 24,
    y = n.top + n.height / 2;
  await k.ev(REC);
  await mouse(k, "mouseMoved", x, y, 0);
  await mouse(k, "mousePressed", x, y);
  for (let i = 1; i <= 4; i++) await mouse(k, "mouseMoved", x, y + 4 * i); // past the lift's threshold
  await k.sleep(500); // the lift runs
  const c = await k.ev(
    `(r=>r&&{x:r.left+r.width/2,y:r.top+r.height/2})(document.querySelector('.droptile[data-dock="${dock}"][data-pos="${pos}"]')?.getBoundingClientRect())`,
  );
  if (!c) throw new Error(`no drop tile ${dock}/${pos}`);
  for (let i = 1; i <= 12; i++)
    await mouse(k, "mouseMoved", x + ((c.x - x) * i) / 12, y + 16 + ((c.y - y - 16) * i) / 12);
  await k.sleep(200);
  await mouse(k, "mouseReleased", c.x, c.y, 0);
  await k.sleep(2200); // the drop, the travel, the settle
  await k.ev(`(window.__stop=true,1)`);
  return /** @type {number[][]} */ (await k.ev(`__r`));
}

/** the laws over one gesture's frames @param {any} t @param {string} tag @param {number[][]} rows */
function judge(t, tag, rows) {
  const first = rows.findIndex(r => r[1] === 1),
    lastCarried = rows.findLastIndex(r => r[1] === 1),
    rest = rows.at(-1);
  t.ok(first >= 0 && lastCarried > first, `${tag}: the case — carried, then let go`, { first, lastCarried });
  if (first < 0 || lastCarried <= first) return;
  const w0 = rows[Math.max(0, first - 1)][4],
    carried = rows.slice(first, lastCarried + 1),
    wMin = Math.min(...carried.map(r => r[4]));
  /* the lift: between the full box and the token there are frames in between (it condenses, not jumps) */
  const between = carried.filter(r => r[4] < w0 - 2 && r[4] > wMin + 2).length;
  t.motion(between > 0, `${tag}: the lift condenses over frames (never one jump to the token)`, {
    w0,
    wMin,
    firstFrames: carried.slice(0, 5).map(r => Math.round(r[4])),
  });
  /* let go: never farther from where it lands than where it was let go — no frame back at its origin */
  const d = (/** @type {number[]} */ r) => Math.hypot(r[2] - rest[2], r[3] - rest[3]),
    at = d(rows[lastCarried]),
    after = rows.slice(lastCarried + 1),
    back = after.filter(r => d(r) > at + 2);
  t.motion(!back.length, `${tag}: let go, it goes from where it is to where it lands — never back`, {
    atRelease: Math.round(at),
    first: back[0] && { ms: back[0][0], d: Math.round(d(back[0])) },
    frames: rows.slice(lastCarried - 1, lastCarried + 4).map(r => r.slice(0, 4).map(Math.round)),
  });
  const unseen = rows.filter(r => r[6] < 0.95);
  t.motion(!unseen.length, `${tag}: seen every frame (no fade, no copy)`, { first: unseen[0] });
  /* its full size where it lands (a layout's own width: Vertical's differs from side by side's) — not the token's */
  t.ok(rest[4] > wMin * 1.5, `${tag}: it rests at its full size, not the token's`, { rest: rest[4], wMin });
}

export async function boxInHandSideBySide(k, t) {
  await viewport(k, 1700, 950);
  for (const [from, dock, pos] of [
    ["left", "left", "top"], // its own lane, another spot
    ["left", "right", "mid"], // the other side
    ["right", "left", "bot"],
  ])
    judge(t, `${from} → ${dock}/${pos}`, await gesture(k, from, dock, pos));
}
boxInHandSideBySide.opts = { width: 1700, height: 950, step: 0.05 };

export async function boxInHandVertical(k, t) {
  await viewport(k, 1700, 950);
  for (const [from, dock, pos] of [
    ["left", "below", "mid"], // into Vertical
    ["below", "left", "mid"], // out of it
    ["below", "right", "top"],
  ])
    judge(t, `${from} → ${dock}/${pos}`, await gesture(k, from, dock, pos));
}
boxInHandVertical.opts = { width: 1700, height: 950, step: 0.05 };
