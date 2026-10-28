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
      `getComputedStyle($("frame")).outlineStyle==="none"&&/inset/.test(getComputedStyle($("rim")).boxShadow)`,
    ),
    "…its ring is the plate's rim (drawn by the frame, it popped in / faded in with a switch)",
    await k.ev(`[getComputedStyle($("frame")).outlineStyle,getComputedStyle($("rim")).boxShadow]`),
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

/* the tab bar has one owner: it follows the plate (2026-10-28, the user: "teleporting… getting on top of the area";
   four writers moved it, and a switch during a ratio change left it 137 px over the panel). In every case that combines
   motions it sits a part gap (12 px) above the plate, every frame */
const BAR_GAP = ms => `new Promise(res=>{const tb=document.querySelector(".tabs"),o=[],t0=performance.now();
  (function s(){o.push(Math.round($("plate").getBoundingClientRect().top-tb.getBoundingClientRect().bottom));
    if(performance.now()-t0<${ms})requestAnimationFrame(s);else res(o)})()})`;
export async function tabBarFollowsThePlate(k, t) {
  for (const [c, ar] of [
    ["446688", "3:4"],
    ["aa7733", "16:9"],
    ["338844", "1:1"],
    ["884488", "16:9"],
  ])
    await k.job(`[fill:${c}] p`, { ar, steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=4`, 40000);
  await k.mouse(2, 2);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1500);
  const cases = [
    ["a step to another shape", [`genNav(-1)`]],
    ["two fast steps", [`genNav(-1)`, 120, `genNav(-1)`]],
    [
      "a tab switch during a ratio change",
      [`genNav(1)`, 150, `document.querySelector('.tab[data-v="queue"]').click()`],
    ],
    ["the Queue to the Gallery", [`document.querySelector('.tab[data-v="gallery"]').click()`]],
    [
      "Gallery → Generating → Gallery, fast",
      [
        `document.querySelector('.tab[data-v="gen"]').click()`,
        200,
        `document.querySelector('.tab[data-v="gallery"]').click()`,
      ],
    ],
  ];
  for (const [what, steps] of cases) {
    const watch = k.ev(BAR_GAP(1300));
    for (const st of steps) typeof st === "number" ? await k.sleep(st) : await k.ev(`(${st},1)`);
    const g = await watch;
    t.motion(Math.min(...g) >= 11 && Math.max(...g) <= 13, `${what}: the bar stays 12 px above the plate`, {
      min: Math.min(...g),
      max: Math.max(...g),
      end: g.at(-1),
    });
    await k.sleep(900);
  }
}
tabBarFollowsThePlate.opts = { step: 0.05 };

/* what sits round the frame follows it (2026-10-28, one owner): the status row, Show prompt, the edit buttons and the
   edge strips are placed from the frame's live box every frame it moves. They used to aim at its TARGET with CSS glides
   of their own: on a crop-and-reveal they jumped to the end, or slid on another clock. Compared on computed styles (the
   values mid-glide, transforms left out), in the stage's coordinates (the stage fills Generating's view) */
const AROUND =
  ms => `new Promise(res=>{let m=0,n=0,why="";const t0=performance.now(),px=(e,p)=>parseFloat(getComputedStyle(e)[p]);
  (function s(){const f=$("frame"),l=px(f,"left"),t=px(f,"top"),w=px(f,"width"),h=px(f,"height"),gt=$("gtools"),
    tb=px(gt,"width"),gl=gt.classList.contains("lefty")?l-tb:l+w,he=$("hedges"),pr=$("prog"),sp=$("showP"),
    d={hedges:Math.max(Math.abs(px(he,"left")-l),Math.abs(px(he,"top")-t),Math.abs(px(he,"width")-w),Math.abs(px(he,"height")-h)),
      tools:Math.max(Math.abs(px(gt,"left")-gl),Math.abs(px(gt,"top")-t)),
      prog:Math.max(Math.abs(px(pr,"left")-l),Math.abs(px(pr,"width")-w),Math.abs(px(pr,"top")-(t+h+12))),
      showP:Math.max(Math.abs(px(sp,"left")-(l+w/2)),Math.abs(px(sp,"top")-(t+h+12)))};
    for(const k in d)if(d[k]>m){m=d[k];why=k}n++;
    if(performance.now()-t0<${ms})requestAnimationFrame(s);else res({m,why,n})})()})`;
export async function aroundFollowsTheFrame(k, t) {
  for (const [c, ar] of [
    ["446688", "3:4"],
    ["aa7733", "16:9"],
    ["338844", "1:1"],
    ["884488", "16:9"],
  ])
    await k.job(`[fill:${c}] p`, { ar, steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=4`, 40000);
  await k.mouse(2, 2);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1500);
  const cases = [
    ["a step to another shape", [`genNav(-1)`]],
    ["two fast steps", [`genNav(-1)`, 120, `genNav(-1)`]],
    ["the Gallery to Generating", [`document.querySelector('.tab[data-v="gen"]').click()`]],
    [
      "Generating → Gallery → a step, fast",
      [`document.querySelector('.tab[data-v="gallery"]').click()`, 150, `genNav(1)`],
    ],
  ];
  for (const [what, steps] of cases) {
    const watch = k.ev(AROUND(1300));
    for (const st of steps) typeof st === "number" ? await k.sleep(st) : await k.ev(`(${st},1)`);
    const g = await watch;
    t.motion(g.m <= 1, `${what}: everything round the frame stays on it, every frame`, g);
    await k.sleep(900);
  }
}
aroundFollowsTheFrame.opts = { step: 0.05 };

/* the picture frame's box has one owner (2026-10-28, framebox.js): the layout gives the goal, a crop-and-reveal drives
   it, nothing else writes it. Before, the layout's CSS glide, the crop-and-reveal and a "put the old values back"
   took turns by flags. In motions that overlap, every frame: the box on screen is the one its owner wrote (no second
   writer, no CSS glide underneath), it never jumps, and it lands where the layout wants it */
const FRAME = ms => `new Promise(res=>{const f=$("frame"),o=[],t0=performance.now();
  (function s(){const c=getComputedStyle(f),b=frameBox(),box=[c.left,c.top,c.width,c.height].map(parseFloat);
    o.push({box,own:b?[b.l,b.t,b.w,b.h]:null});if(performance.now()-t0<${ms})requestAnimationFrame(s);else res(o)})()})`;
export async function frameOneOwner(k, t) {
  for (const [c, ar] of [
    ["446688", "3:4"],
    ["aa7733", "16:9"],
    ["338844", "1:1"],
  ])
    await k.job(`[fill:${c}] p`, { ar, steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=3`, 40000);
  await k.mouse(2, 2);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1500);
  const size = (w, h) =>
    k.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const cases = [
    ["a step, the window resized mid-way", [`genNav(-1)`, 150, [1400, 860]]],
    ["a step, a tab switch mid-way", [`genNav(-1)`, 150, `document.querySelector('.tab[data-v="gen"]').click()`]],
    [
      "two fast steps",
      [`document.querySelector('.tab[data-v="gallery"]').click()`, 900, `genNav(1)`, 100, `genNav(1)`],
    ],
    ["the window resized back, then a step mid-glide", [[1513, 900], 60, `genNav(-1)`]],
  ];
  for (const [what, steps] of cases) {
    const watch = k.ev(FRAME(1400));
    for (const st of steps)
      typeof st === "number" ? await k.sleep(st) : Array.isArray(st) ? await size(...st) : await k.ev(`(${st},1)`);
    const o = await watch;
    const off = Math.max(...o.filter(x => x.own).map(x => Math.max(...x.box.map((v, i) => Math.abs(v - x.own[i]))))),
      jump = Math.max(...o.map((x, i) => (i ? Math.max(...x.box.map((v, j) => Math.abs(v - o[i - 1].box[j]))) : 0)));
    t.ok(off <= 0.5, `${what}: the box on screen is the one its owner wrote, every frame`, { off });
    if (!/tab switch/.test(what)) t.motion(jump <= 120, `${what}: …it never jumps`, { jump: Math.round(jump) }); // a switch jumps under its View Transition, on purpose
    await k.sleep(300);
    const end = await k.ev(
      `(()=>{const f=$("frame"),c=getComputedStyle(f),d=f.dataset;return [c.left,c.top,c.width,c.height].map(parseFloat).map((v,i)=>Math.abs(v-[+d.tl,+d.tt,+d.tw,+d.th][i]))})()`,
    );
    t.ok(Math.max(...end) <= 0.5, `${what}: …and lands where the layout wants it`, end);
  }
}
frameOneOwner.opts = { step: 0.05 };

/* the outline is the plate's rim (2026-10-28, the user: in the Gallery "the outline fades" — the picture drew a line of
   its own that came in with the switch's fading contents, over the plate's ring it hid): one line on every plate, over
   the picture, that holds through a switch. Every frame of Generating → Gallery (a picture of another shape) and back:
   the rim sits on the plate, at full strength, and it's drawn above the picture */
export async function rimHoldsThroughSwitches(k, t) {
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(`(closeShown(),S.ar="3:4",sizeFrame(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  for (const to of ["gallery", "gen"]) {
    const o =
      await k.ev(`new Promise(res=>{const r=$("rim"),p=$("plate"),o={off:0,op:1,shadow:new Set()},t0=performance.now();
      document.querySelector('.tab[data-v="${to}"]').click();
      (function s(){const a=r.getBoundingClientRect(),b=p.getBoundingClientRect(),c=getComputedStyle(r);
        o.off=Math.max(o.off,Math.abs(a.left-b.left),Math.abs(a.top-b.top),Math.abs(a.width-b.width),Math.abs(a.height-b.height));
        o.op=Math.min(o.op,+c.opacity);o.shadow.add(c.boxShadow);
        if(performance.now()-t0<900)requestAnimationFrame(s);else res({off:o.off,op:o.op,shadows:o.shadow.size})})()})`);
    t.motion(
      o.off <= 0.5 && o.op === 1 && o.shadows === 1,
      `→ ${to}: the ring stays on the plate, unchanged, every frame`,
      o,
    );
  }
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1200);
  t.ok(
    (await k.ev(`$("frame").classList.contains("has")`)) &&
      (await k.ev(`+getComputedStyle($("rim")).zIndex>+getComputedStyle($("stage")).zIndex`)),
    "the ring is drawn above the picture",
  );
}
rimHoldsThroughSwitches.opts = { step: 0.05 };

/* a tab switch's motion has one owner (2026-10-28, plate.js switchGlide): the plate, its rim, the tab bar, the switch's
   own layers and the contents' clip all start at one time from one geometry. Five things timed themselves before: the
   clip ran ~20 px off the plate, the rim's line crossed the picture, the plate sat empty ~200 ms. Every frame of empty
   Generating → the Gallery (another shape) and back: one start time for all of them; the incoming contents' clip (its
   layer's box + clip-path, read from the browser) 1 px inside the plate while they can be seen (the browser's layers
   take the owner's timing a frame in — the contents are still at 0 then); the rim on the plate */
const SWITCH_WATCH = `new Promise(res=>{const p=$("plate"),rim=$("rim"),f=$("frame"),o={clip:0,rim:0,starts:0,n:0,clipped:0,onFrame:0},t0=performance.now(),
    m=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mat"))||0,mine=a=>!(a instanceof CSSTransition)&&!(a instanceof CSSAnimation)&&a.playState==="running";
  (function s(){const pr=p.getBoundingClientRect(),rr=rim.getBoundingClientRect();
    o.rim=Math.max(o.rim,Math.abs(pr.left-rr.left),Math.abs(pr.top-rr.top),Math.abs(pr.width-rr.width),Math.abs(pr.height-rr.height));
    const els=[p,rim,document.querySelector(".tabs"),f,...document.querySelectorAll(".rpanel > .view")],sw=document.getAnimations().filter(a=>mine(a)&&a.effect&&els.includes(a.effect.target));
    o.starts=Math.max(o.starts,new Set(sw.map(a=>Math.round(a.startTime))).size);
    for(const el of [f,...document.querySelectorAll(".rpanel > .view")]){const c=getComputedStyle(el),v=c.clipPath,vw=el.closest(".view");if(!v.startsWith("inset(")||+c.opacity<0.02||(vw&&+getComputedStyle(vw).opacity<0.02))continue;
      const r=el.getBoundingClientRect(),[tt,rgt=tt,b=tt,l=rgt]=v.replace("inset(","").split(" round")[0].replace(")","").trim().split(" ").map(parseFloat);
      o.clip=Math.max(o.clip,pr.left-(r.left+l),pr.top-(r.top+tt),r.right-rgt-pr.right,r.bottom-b-pr.bottom);o.clipped++}
    if(!document.querySelector(".rpanel.paneled")&&!document.querySelector(".view.leaving")){const fr=f.getBoundingClientRect();
      o.onFrame=Math.max(o.onFrame,Math.abs(fr.left-m-pr.left),Math.abs(fr.top-m-pr.top),Math.abs(fr.width+2*m-pr.width),Math.abs(fr.height+2*m-pr.height))}
    o.n++;if(performance.now()-t0<900)requestAnimationFrame(()=>setTimeout(s,0));else res(o)})()})`; // after the frame's writes
export async function switchHasOneOwner(k, t) {
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(`(closeShown(),S.ar="3:4",sizeFrame(),1)`);
  await k.mouse(2, 2);
  await k.sleep(1200);
  for (const [to, sameView] of [
    ["gallery", true],
    ["gen", true],
    ["queue", false],
    ["gallery", false],
  ]) {
    const w = k.ev(SWITCH_WATCH);
    await k.ev(`(document.querySelector('.tab[data-v="${to}"]').click(),1)`);
    const o = await w;
    t.ok(o.starts <= 1, `→ ${to}: everything the switch starts, starts at one time`, o);
    if (sameView) t.motion(o.onFrame <= 1.5, `→ ${to}: the same view — the plate rides the frame, every frame`, o);
    else
      t.motion(
        o.clipped > 5 && o.clip <= 1.5,
        `→ ${to}: …the contents stay inside the plate, every frame they show`,
        o,
      );
    t.motion(o.rim <= 0.5, `→ ${to}: …the rim on the plate`, o);
    await k.sleep(500);
  }
}
switchHasOneOwner.opts = { step: 0.05 };

/* the arrow you click stays under the pointer through the switch it starts (2026-10-28, the user: from Generating to
   the Gallery with another shape it ran off — the switch's layers read as the pointer leaving it, 261 px). Held until
   the pointer really moves off it; then it goes to the picture's edge */
export async function arrowStaysUnderThePointer(k, t) {
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(`(closeShown(),S.ar="3:4",sizeFrame(),1)`);
  await k.sleep(1200);
  const f = await k.ev(`JSON.parse(JSON.stringify($("frame").getBoundingClientRect()))`);
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: f.left + f.width / 2, y: f.top + f.height / 2 });
  await k.sleep(500);
  const a = await k.ev(
    `(()=>{const r=document.querySelector('.gnav[data-nav="-1"]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`,
  );
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: a.x, y: a.y });
  await k.sleep(400);
  const w =
    k.ev(`new Promise(res=>{const g=document.querySelector('.gnav[data-nav="-1"]'),r0=g.getBoundingClientRect(),t0=performance.now();let m=0;
    (function s(){const r=g.getBoundingClientRect();m=Math.max(m,Math.abs(r.left-r0.left),Math.abs(r.top-r0.top));if(performance.now()-t0<1300)requestAnimationFrame(s);else res(m)})()})`);
  await k.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: a.x,
    y: a.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: a.x, y: a.y, button: "left", clickCount: 1 });
  const moved = await w;
  t.ok(await k.ev(`document.body.dataset.pic==="browse"`), "the arrow opened the Gallery");
  t.motion(moved <= 1, "the arrow stayed under the pointer all through the switch", { moved });
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: a.x + 200, y: a.y });
  await k.sleep(900);
  const end = await k.ev(
    `(()=>{const g=document.querySelector('.gnav[data-nav="-1"]').getBoundingClientRect(),f=$("frame").getBoundingClientRect();return {held:!!lay.navHold,dx:Math.round(g.left-(f.left+10))}})()`,
  );
  t.ok(!end.held && Math.abs(end.dx) <= 1, "…and once the pointer left it, it went to the picture's edge", end);
}
arrowStaysUnderThePointer.opts = { step: 0.05 };

/* a switch into a picture moves by the one choreography (2026-10-28, the user: from a clean 1:1 canvas to a 16:9
   picture "the edges flicker as if washed — the top shouldn't be affected; why is the Gallery even?"). The switch had a
   rule of its own (one curve for both axes): the plate stayed taller than the picture while it came in — a band of bare
   glass above and below it. Now crop, swap, reveal, as when browsing: every frame the new picture shows, the plate is
   no taller than it (the shrinking axis is done by the swap) */
const BAND = `new Promise(res=>{const p=$("plate"),f=$("frame"),c=$("cv"),o={over:0,shown:0},t0=performance.now(),m=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mat"))||0;
  (function s(){if(f.classList.contains("has")&&+getComputedStyle(c).opacity>0.02){
      const pr=p.getBoundingClientRect();o.over=Math.max(o.over,pr.height-(+f.dataset.th+2*m));o.shown++}
    if(performance.now()-t0<900)requestAnimationFrame(()=>setTimeout(s,0));else res(o)})()})`; // read after the frame's own writes
export async function switchIntoAPictureHasNoBand(k, t) {
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.mouse(2, 2);
  for (const [how, act] of [
    ["the Gallery tab", `document.querySelector('.tab[data-v="gallery"]').click()`],
    ["an arrow", `genNav(-1)`],
  ]) {
    await k.ev(`(document.querySelector('.tab[data-v="gen"]').click(),1)`);
    await k.sleep(900);
    await k.ev(`(closeShown(),S.ar="1:1",sizeFrame(),1)`);
    await k.sleep(1200);
    const w = k.ev(BAND);
    await k.ev(`(${act},1)`);
    const o = await w;
    t.motion(o.shown > 3 && o.over <= 1, `${how}: no bare glass above or below the picture while it comes in`, o);
    await k.sleep(400);
  }
}
switchIntoAPictureHasNoBand.opts = { step: 0.05 };

/* the Gallery's picture is cropped by the plate on the way out (2026-10-28, the user: Gallery → PNG Info "snaps",
   Generating → PNG Info morphs). Its layer doesn't move, so the browser gave it no animation and the switch never
   clipped it: it stayed whole over the plate's crop and vanished at the swap. Every frame it shows: inside the plate */
export async function galleryPictureCropsOnTheWayOut(k, t) {
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.mouse(2, 2);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(1500);
  const w = k.ev(`new Promise(res=>{const p=$("plate"),f=$("frame"),v=$("v-gen"),o={out:0,seen:0},t0=performance.now();
    (function s(){if(v.classList.contains("leaving")&&+getComputedStyle(v).opacity>0.02){const c=getComputedStyle(f).clipPath,r=f.getBoundingClientRect(),pr=p.getBoundingClientRect(),
        [tt,rg=tt,b=tt,l=rg]=c==="none"?[0,0,0,0]:c.replace("inset(","").split(" round")[0].replace(")","").trim().split(" ").map(parseFloat);
      o.out=Math.max(o.out,pr.left-(r.left+l),pr.top-(r.top+tt),(r.right-rg)-pr.right,(r.bottom-b)-pr.bottom);o.seen++}
      if(performance.now()-t0<700)requestAnimationFrame(s);else res(o)})()})`);
  await k.ev(`(document.querySelector('.tab[data-v="png"]').click(),1)`);
  const o = await w;
  t.motion(
    o.seen > 3 && o.out <= 1,
    "the Gallery's picture stays inside the plate as it crops, every frame it shows",
    o,
  );
}
galleryPictureCropsOnTheWayOut.opts = { step: 0.05 };

/* the picture's edit buttons and arrows are shown by hovering the picture, nothing else (2026-10-28, the user: "they
   are blinking on some transitions; the only reason for them to be shown is pic hover"). The switch faded them in on
   arrival and out from fully shown on leaving. With the pointer away, through every switch with the picture's view,
   they stay hidden every frame */
export async function editButtonsOnlyOnHover(k, t) {
  await k.job("[fill:aa7733] wide", { ar: "16:9", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.mouse(2, 2);
  await k.sleep(800);
  for (const to of ["gallery", "queue", "gallery", "png", "gen", "loras", "gen"]) {
    const o =
      await k.ev(`new Promise(res=>{const els=[$("gtools"),...document.querySelectorAll(".gnav")],o={max:0,who:""},t0=performance.now();
      document.querySelector('.tab[data-v="${to}"]').click();
      (function s(){for(const el of els){const c=getComputedStyle(el),vw=el.closest(".view");if(c.display==="none"||c.visibility==="hidden"||(vw&&+getComputedStyle(vw).opacity<0.02))continue;
        if(+c.opacity>o.max){o.max=+c.opacity;o.who=el.id||el.className}}
        if(performance.now()-t0<900)requestAnimationFrame(()=>setTimeout(s,0));else res(o)})()})`);
    t.motion(o.max <= 0.01, `→ ${to}: the edit buttons and arrows stay hidden (the pointer is away)`, o);
    await k.sleep(300);
  }
}
editButtonsOnlyOnHover.opts = { step: 0.05 };
