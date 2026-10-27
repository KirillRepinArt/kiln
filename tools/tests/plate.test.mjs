// The glass plate (v0.7.2, the user's pick over snapshot switches): one glass object under the right column — the
// frame's shape in Generating, the panel's elsewhere — that changes shape on a tab switch instead of being a snapshot
// (a snapshot can't blur what's behind it: the glass went clear for the switch).
const R = (k, sel) =>
  k.ev(`JSON.parse(JSON.stringify(document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect()))`);
const near = (a, b, d = 2) => ["left", "top", "width", "height"].every(p => Math.abs(a[p] - b[p]) <= d);

export async function plateIsTheGlass(k, t) {
  await k.sleep(900);
  t.ok(near(await R(k, "#plate"), await R(k, "#frame")), "Generating: the plate is the empty frame");
  t.ok(
    await k.ev(
      `getComputedStyle($("frame"),"::before").backdropFilter==="none"&&getComputedStyle($("plate")).backdropFilter!=="none"`,
    ),
    "…and the only glass there (the frame's own is off)",
  );
  t.ok(
    await k.ev(
      `getComputedStyle($("frame")).outlineColor==="rgba(0, 0, 0, 0)"&&/inset/.test(getComputedStyle($("plate")).boxShadow)`,
    ),
    "…its ring is the plate's too (it popped in after a switch, drawn by the frame)",
    await k.ev(`getComputedStyle($("frame")).outlineColor`),
  );
  // a switch: the plate goes from the frame to the panel, every frame live glass, one way
  const s =
    await k.ev(`new Promise(res=>{const p=$("plate"),o=[],t0=performance.now();document.querySelector('.tab[data-v="queue"]').click();
    (function f(){const r=p.getBoundingClientRect();o.push([r.width,r.height,getComputedStyle(p).backdropFilter!=="none"]);if(performance.now()-t0<900)requestAnimationFrame(f);else res(o)})()})`);
  const ws = s.map(x => x[0]);
  t.ok(
    s.every(x => x[2]),
    "the glass blurs all through the switch",
  );
  t.motion(
    ws.every((w, i) => !i || w >= ws[i - 1] - 0.5) && ws.some((w, i) => i && w > ws[i - 1] + 1 && w < ws.at(-1) - 1),
    "the plate grows from the frame to the panel (a glide, not a jump)",
    { first: ws.slice(0, 6).map(Math.round), last: Math.round(ws.at(-1)) },
  );
  await k.sleep(300);
  t.ok(near(await R(k, "#plate"), await R(k, "#rpanel")), "…and lands on the panel");
  t.ok(
    await k.ev(`getComputedStyle($("rpanel"),"::before").backdropFilter==="none"`),
    "the panel's own glass is off (one plate)",
  );
}

/* browsing pictures of different shapes, the plate rides the frame (under the picture) */
export async function plateRidesTheMorph(k, t) {
  await k.job("[fill:446688] tall", { ar: "3:4", steps: 2 });
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const gap = await k.ev(`new Promise(res=>{let m=0;const t0=performance.now();genNav(-1);
    (function f(){const a=$("plate").getBoundingClientRect(),b=$("frame").getBoundingClientRect();
      m=Math.max(m,Math.abs(a.left-b.left),Math.abs(a.top-b.top),Math.abs(a.width-b.width),Math.abs(a.height-b.height));
      if(performance.now()-t0<800)requestAnimationFrame(f);else res(m)})()})`);
  t.motion(gap <= 2, "the plate stays on the frame every frame of a crop-and-reveal", { gap: Math.round(gap) });
}
plateRidesTheMorph.opts = { step: 0.05 };

/* PNG Info's drop line is the plate's (2026-10-27, the user: it moved unpleasantly on a switch — it was inside the
   contents' snapshot, cropped and re-anchored as the box changed shape): inset on the plate, it changes shape with it
   and fades as the switch leaves */
export async function dropLineRidesThePlate(k, t) {
  await k.ev(`(document.querySelector('.tab[data-v="png"]').click(),1)`);
  await k.sleep(1200);
  t.ok(
    await k.ev(`$("plate").classList.contains("drop")&&+getComputedStyle($("plate"),"::after").opacity===1`),
    "empty PNG Info: the line is drawn on the plate",
  );
  t.ok(await k.ev(`getComputedStyle($("drop"),"::after").content==="none"`), "…not inside the panel's contents");
  const s =
    await k.ev(`new Promise(res=>{const p=$("plate"),o=[],t0=performance.now();document.querySelector('.tab[data-v="gen"]').click();
    (function f(){o.push([+getComputedStyle(p,"::after").opacity,p.getBoundingClientRect().width]);if(performance.now()-t0<800)requestAnimationFrame(f);else res(o)})()})`);
  const op = s.map(x => x[0]);
  t.ok(op.at(-1) === 0, "on Generating the line is gone", op.at(-1));
  t.motion(
    op.some(o => o > 0.05 && o < 0.95),
    "…it fades as the switch leaves (no pop)",
    op.slice(0, 14).map(o => o.toFixed(2)),
  );
}
