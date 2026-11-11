// The glass plate (v0.7.2, the user's pick over snapshot switches): one glass object under the right column — the
// frame's shape in Generating, the panel's elsewhere — that changes shape on a tab switch instead of being a snapshot
// (a snapshot can't blur what's behind it: the glass went clear for the switch).
import { glueAnchors, relationOf } from "../../app/layoutmath.js";
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
  /* the bar is one pane gap above the plate (--gap-pane, the spacing role — DD-2026-11-11-8; it was the part gap, 12) */
  const G = await k.ev(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-pane"))`);
  for (const [what, steps] of cases) {
    const watch = k.ev(BAR_GAP(1300));
    for (const st of steps) typeof st === "number" ? await k.sleep(st) : await k.ev(`(${st},1)`);
    const g = await watch;
    t.motion(
      Math.min(...g) >= G - 1 && Math.max(...g) <= G + 1,
      `${what}: the bar stays one pane gap above the plate`,
      {
        min: Math.min(...g),
        max: Math.max(...g),
        end: g.at(-1),
      },
    );
    await k.sleep(900);
  }
}
tabBarFollowsThePlate.opts = { step: 0.05 };

/* what sits round the frame follows it (2026-10-28, one owner): the status row, Show prompt, the edit buttons and the
   edge strips are placed from the frame's live box every frame it moves. They used to aim at its TARGET with CSS glides
   of their own: on a crop-and-reveal they jumped to the end, or slid on another clock. Compared on computed styles (the
   values mid-glide, transforms left out), in the stage's coordinates (the stage fills Generating's view) — the edit buttons
   on screen: they float over the page (the layering rule) */
const AROUND =
  ms => `new Promise(res=>{let m=0,n=0,why="";const t0=performance.now(),px=(e,p)=>parseFloat(getComputedStyle(e)[p]);
  (function s(){const f=$("frame"),l=px(f,"left"),t=px(f,"top"),w=px(f,"width"),h=px(f,"height"),gt=$("gtools"),
    tb=px(gt,"width"),gl=gt.classList.contains("lefty")?l-tb:l+w,he=$("hedges"),pr=$("prog"),sp=$("showP"),
    so=(a=>{let x=0,y=0;for(let e=a;e&&e.id!=="rpanel";e=e.offsetParent){x+=e.offsetLeft;y+=e.offsetTop;const p=e.offsetParent;if(p&&p.id!=="rpanel"){x+=p.clientLeft;y+=p.clientTop}}return{x,y}})($("stage")), /* the strips float in #rpanel */
    d={hedges:Math.max(Math.abs(px(he,"left")-(l+so.x)),Math.abs(px(he,"top")-(t+so.y)),Math.abs(px(he,"width")-w),Math.abs(px(he,"height")-h)),
      tools:(st=>Math.max(Math.abs(px(gt,"left")-(st.left+gl)),Math.abs(px(gt,"top")-(st.top+t))))($("stage").getBoundingClientRect()), /* the floating layer: on screen */
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

/* the views ride the plate (2026-10-28, the user: Queue / LoRAs → Generating / the Gallery "does a snapshot"): the
   plate moves as well as shrinks (the area re-centres), and the leaving list, pinned on screen, stayed behind like a
   still. Every frame it shows: its offset from the plate's centre is what it was at the start (it rides), and what
   shows of it is inside the plate */
export async function viewsRideThePlate(k, t) {
  for (const c of ["aa7733", "3366aa"]) await k.job(`[fill:${c}] p`, { ar: "16:9", steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.mouse(2, 2);
  for (const [from, to] of [
    ["queue", "gen"],
    ["loras", "gallery"],
  ]) {
    await k.ev(`(document.querySelector('.tab[data-v="${from}"]').click(),1)`);
    await k.sleep(1300);
    const o =
      await k.ev(`new Promise(res=>{const p=$("plate"),v=$("v-${from}"),o={drift:0,out:0,seen:0},t0=performance.now();let d0=null;
      document.querySelector('.tab[data-v="${to}"]').click();
      (function s(){if(v.classList.contains("leaving")&&+getComputedStyle(v).opacity>0.02){const r=v.getBoundingClientRect(),pr=p.getBoundingClientRect(),
          d=[(r.left+r.right)/2-(pr.left+pr.right)/2,(r.top+r.bottom)/2-(pr.top+pr.bottom)/2];if(!d0)d0=d;o.drift=Math.max(o.drift,Math.abs(d[0]-d0[0]),Math.abs(d[1]-d0[1]));
          const c=getComputedStyle(v).clipPath,[tt,rg=tt,b=tt,l=rg]=c==="none"?[0,0,0,0]:c.replace("inset(","").split(" round")[0].replace(")","").trim().split(" ").map(parseFloat);
          o.out=Math.max(o.out,pr.left-(r.left+l),pr.top-(r.top+tt),r.right-rg-pr.right,r.bottom-b-pr.bottom);o.seen++}
        if(performance.now()-t0<700)requestAnimationFrame(()=>setTimeout(s,0));else res(o)})()})`);
    t.motion(
      o.seen > 3 && o.drift <= 1.5,
      `${from} → ${to}: the leaving view rides the plate (no still left behind)`,
      o,
    );
    t.motion(o.out <= 1.5, `${from} → ${to}: …and shows only inside it`, o);
    await k.sleep(400);
  }
}
viewsRideThePlate.opts = { step: 0.05 };

/* (a view's opacity is what's SEEN of it: while it is faded by its parts — fade.js, glass never fades through an
   ancestor — as much as its most-seen part, the tracer's reading) */
/* fade-through when the plate changes shape (2026-10-31, the user: "Queue to Generating or Gallery is a bit off"): what
   leaves is gone by the swap, what comes fades in from there over at least ~200 ms, never reversing — it came in over
   the swap's 80 ms, a cut. The same shape (Queue ↔ LoRAs) keeps its cross-fade */
const VIEWS =
  ms => `new Promise(res=>{const o=[],t0=performance.now(),op=id=>{const e=$(id),c=getComputedStyle(e);if(c.visibility==="hidden")return 0;
    const ps=e.getAnimations({subtree:true}).filter(a=>a.id==="glassFade"&&a.fadeRoot&&a.fadeRoot.contains(e)&&a.effect&&a.effect.target);if(!ps.length)return +c.opacity;
    let m=0;for(const a of ps){const t=a.effect.target,pe=a.effect.pseudoElement;if(t===e&&!pe){m=1;continue}
      let o=+getComputedStyle(t,pe||null).opacity;for(let x=pe?t:t.parentElement;x&&x!==e;x=x.parentElement)o*=+getComputedStyle(x).opacity;m=Math.max(m,o)}
    return +c.opacity*m};
  (function s(){requestAnimationFrame(()=>setTimeout(()=>{o.push({t:performance.now()-t0,gen:op("v-gen"),queue:op("v-queue"),loras:op("v-loras")});
  if(performance.now()-t0<${ms})s();else res(o)},0))})()})`;
export async function fadeThrough(k, t) {
  await k.job("[fill:446688] tall", { ar: "9:16", steps: 1 }); // a shape far from the panel's
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.mouse(2, 2);
  const tab = v => `(document.querySelector('.tab[data-v="${v}"]').click(),1)`;
  /** every fade measured, 2 % → 98 % @type {[string, number][]} */
  const speeds = [];
  const run = async (from, to, inId, outId, what) => {
    await k.ev(tab(from));
    await k.sleep(1500);
    const w = k.ev(VIEWS(1100));
    await k.ev(tab(to));
    const s = await w,
      i = s.map(x => x[inId]),
      o = s.map(x => x[outId]),
      up = i.every((v, n) => n === 0 || v >= i[n - 1] - 0.01),
      down = o.every((v, n) => n === 0 || v <= o[n - 1] + 0.01),
      a = s.find(x => x[inId] > 0.02),
      b = s.find(x => x[inId] > 0.98),
      o0 = s.find(x => x[outId] < 0.98),
      gone = s.find(x => x[outId] < 0.02);
    if (a && b) speeds.push([`${what} in`, Math.round(b.t - a.t)]);
    if (o0 && gone) speeds.push([`${what} out`, Math.round(gone.t - o0.t)]);
    t.ok(up, `${what}: what comes only fades in (no blink)`);
    t.ok(down, `${what}: what leaves only fades out`);
    t.motion(!!a && !!b && b.t - a.t >= 170, `${what}: it comes in over ~200 ms or more, not a cut`, {
      ms: a && b ? Math.round(b.t - a.t) : null,
    });
    return { a, gone };
  };
  /* the plate crops into the picture: a fade-through (what leaves is gone by the swap). The other way it only grows
     (a reveal, no crop): the swap is at the start, so the two cross-fade — the same rule */
  for (const [from, to, inId, outId] of [
    ["queue", "gallery", "gen", "queue"],
    ["queue", "gen", "gen", "queue"],
  ]) {
    const { a, gone } = await run(from, to, inId, outId, `${from} → ${to}`);
    t.motion(
      !!a && !!gone && gone.t <= a.t + 120,
      `${from} → ${to}: a fade-through (what leaves is gone near the swap)`,
      {
        in: a && Math.round(a.t),
        gone: gone && Math.round(gone.t),
      },
    );
  }
  await run("gallery", "queue", "queue", "gen", "gallery → queue (a reveal: its cross-fade)");
  await run("queue", "loras", "loras", "queue", "queue → loras (the same shape: its cross-fade)");
  /* one speed (the user, 2026-10-31): every fade, in or out, in every switch, takes the same time */
  const ms = speeds.map(x => x[1]);
  t.motion(Math.max(...ms) - Math.min(...ms) <= 40, "one fade speed: in and out, in every switch", speeds);
}
fadeThrough.opts = { step: 0.05 };

/* a view's look is the view's own (2026-10-31, the user: "the queue items expand a bit and abruptly disappear"): the
   Queue's and LoRAs' boxes were keyed on the container's tab (.rpanel.paneled), which changes at the switch's first
   frame — the leaving list jumped 12 px wider. While a view leaves, its contents' box never changes */
export async function leavingViewKeepsItsLook(k, t) {
  await k.job("[fill:446688] p", { ar: "3:4", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.mouse(2, 2);
  const tab = v => `(document.querySelector('.tab[data-v="${v}"]').click(),1)`;
  for (const [from, sel] of [
    ["queue", "#qwrap"],
    ["loras", ".lwrap"],
    ["png", ".pwrap"],
  ]) {
    await k.ev(tab(from));
    await k.sleep(1500);
    const w =
      k.ev(`new Promise(res=>{const o=[],el=document.querySelector("${sel}"),v=el.closest(".view"),t0=performance.now();
      (function s(){requestAnimationFrame(()=>setTimeout(()=>{if(getComputedStyle(v).visibility!=="hidden"){const c=getComputedStyle(el);
        o.push([el.offsetLeft,el.offsetTop,el.clientWidth,el.clientHeight,c.paddingLeft,c.paddingTop].join(","))}
        if(performance.now()-t0<900)s();else res(o)},0))})()})`);
    await k.ev(tab("gen"));
    const s = await w,
      kinds = [...new Set(s)];
    t.ok(
      s.length > 5 && kinds.length === 1,
      `${from} → Generating: the leaving ${sel} keeps its box`,
      kinds.slice(0, 3),
    );
  }
}
leavingViewKeepsItsLook.opts = { step: 0.05 };

/* the frame's pictures fade by the same one fade (2026-10-31, F1, the user: "Gallery just appears instantly … should we
   use a single owner for the tab transitions?"): a picture coming into an empty frame, one replacing another of the same
   shape, and one of another shape (the crop-and-reveal) — in and out, every one about MORPH.fade long, none a cut */
const PICS = ms => `new Promise(res=>{const o=[],t0=performance.now(),op=id=>+getComputedStyle($(id)).opacity;
  (function s(){requestAnimationFrame(()=>setTimeout(()=>{o.push({t:performance.now()-t0,cv:op("cv"),cvx:$("cvx").width>1?op("cvx"):0});
  if(performance.now()-t0<${ms})s();else res(o)},0))})()})`;
export async function picturesFadeAtOneSpeed(k, t) {
  for (const [c, ar] of [
    ["446688", "3:4"],
    ["aa7733", "3:4"],
    ["338844", "16:9"],
  ])
    await k.job(`[fill:${c}] p`, { ar, steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=3`, 40000);
  await k.mouse(2, 2);
  const span = (s, key, up) => {
    const a = s.find(x => (up ? x[key] > 0.02 : x[key] < 0.98)),
      b = s.find(x => (up ? x[key] > 0.98 : x[key] < 0.02));
    return a && b ? Math.round(b.t - a.t) : null;
  };
  const cases = [
    [
      "an empty frame → the Gallery (same box): the picture fades in",
      `(closeShown(),S.ar="16:9",sizeFrame(),1)`,
      `document.querySelector('.tab[data-v="gallery"]').click()`,
      [["cv", true]],
    ],
    [
      /* the pictures stack: the new one is laid under the old at the swap and the old fades off it (no dip) */
      "browse, another shape (the crop-and-reveal)",
      null,
      `genNav(-1)`,
      [["cvx", false]],
    ],
    ["browse, the same shape (a cross-fade)", null, `genNav(-1)`, [["cvx", false]]],
    /* leaving for an empty frame: the picture fades out too (it used to just go — the user, 2026-10-31) */
    [
      "the Gallery → Generating, nothing rendering: the picture fades out",
      `(document.querySelector('.tab[data-v="gallery"]').click(),1)`,
      `document.querySelector('.tab[data-v="gen"]').click()`,
      [["cvx", false]],
    ],
    [
      "✕ on a picture: it fades out",
      `(document.querySelector('.tab[data-v="gallery"]').click(),1)`,
      `closeShown()`,
      [["cvx", false]],
    ],
  ];
  for (const [what, prep, go, checks] of cases) {
    if (prep) {
      await k.ev(`(document.querySelector('.tab[data-v="gen"]').click(),1)`);
      await k.sleep(1300);
      await k.ev(prep);
      await k.sleep(1300);
    }
    const w = k.ev(PICS(1000));
    await k.ev(`(${go},1)`);
    const s = await w;
    for (const [key, up] of checks) {
      const ms = span(s, key, up);
      t.motion(ms != null && ms >= 160 && ms <= 260, `${what}: ${key} ${up ? "in" : "out"} over the one fade`, { ms });
    }
    /* what you see — the two pictures as one, 1 − (1 − cv)(1 − cvx) — only ever goes one way: never a dip */
    const seen = s.map(x => 1 - (1 - x.cv) * (1 - x.cvx)),
      dip = seen.some(
        (v, i) => i > 0 && seen.slice(0, i).some(a => a > v + 0.05) && seen.slice(i).some(c => c > v + 0.05),
      );
    t.motion(
      !dip,
      `${what}: the picture you see never dips`,
      seen
        .map(v => v.toFixed(2))
        .filter((v, i, a) => v !== a[i - 1])
        .slice(0, 14),
    );
    await k.sleep(800);
  }
}
picturesFadeAtOneSpeed.opts = { step: 0.05 };

/* "the layout lands at once" (body.laysnap) has one owner (2026-10-31, T1): a tab switch and a layout switch each turned
   it off on their own timer, so one ending turned the glides back on in the middle of the other. A layout switch started
   during a tab switch keeps the glides off until it has ended (+ its 300 ms) */
export async function snapHeldUntilTheLastMotion(k, t) {
  await k.mouse(2, 2);
  /* "the plate moves" from its box changing between frames — the motion itself, whatever drives it (it read the plate's
     own animations: since T2c-3b the plate travels on the driver's writes) */
  const s = await k.ev(`new Promise(res=>{const o=[],t0=performance.now(),b=document.body;let pr=null;
    document.querySelector('.tab[data-v="queue"]').click();
    setTimeout(()=>setDock("right"),500);
    (function s(){requestAnimationFrame(()=>setTimeout(()=>{const p=$("plate").getBoundingClientRect(),
      mv=!!pr&&(Math.abs(p.left-pr.left)+Math.abs(p.top-pr.top)+Math.abs(p.width-pr.width)+Math.abs(p.height-pr.height))>0.5;pr=p;
      o.push([Math.round(performance.now()-t0),b.classList.contains("laysnap"),performance.now()-t0>500&&mv,
        [Math.round(p.left),Math.round(p.top),Math.round(p.width),Math.round(p.height)],document.documentElement.classList.contains("switching"),
        [$("rpanel").style.width,minRight(),(c=>Math.round((c[c.length-1].getBoundingClientRect().right-c[0].getBoundingClientRect().left)*100)/100)(document.querySelector(".tabs").children),
          /* the panel's place: the pass's x unrounded, the margin written (CI on 3c2ae95: it landed at x 92, rest 91) */
          lay.pass&&lay.pass.page?Math.round(lay.pass.page.x*100)/100:null,$("rpanel").style.marginLeft,
          /* the area on screen: the switch's goal is converted through it once, at the start ("it never moves") */
          Math.round($("right").getBoundingClientRect().left*100)/100]]);
    if(performance.now()-t0<2600)s();else res(o)},0))})()})`);
  /* the layout switch is the tab switch's system since T2b (no View Transition, decision 0014): it runs while the plate
     moves after the layout was asked for */
  /* the rule (T4, the re-read 2026-11-10): the glides are off on EVERY frame the plate moves, and come back as the last
     motion ends — not on a timer. (Its wording was "no gap from the tab switch until the layout switch has landed, + 250
     ms": the old timer's sw.T + 300 bridged the still moment between the two switches and outlasted the landing — the
     margin and the bridge encoded the guess, not the rule) */
  const lastMorph = s.filter(x => x[2]).at(-1),
    loose = s.filter(x => x[2] && !x[1]),
    free = lastMorph ? s.find(x => x[0] > lastMorph[0] && !x[1]) : null;
  t.ok(!!lastMorph, "the layout switch ran", s.slice(0, 3));
  /* T4's open row (2026-11-11): it fails about once in four long runs and never alone — the report says what moved:
     the plate's box in the frames round the first loose one, when the hold let go, whether a switch still ran, and the
     panel's written width, its floor (minRight) and the tab bar's width (CI on 2ba446f: it landed 606 wide, rest 607) */
  const i = loose.length ? s.indexOf(loose[0]) : -1,
    letGo = s.find((x, j) => j > 0 && !x[1] && s[j - 1][1]);
  t.ok(!loose.length, "the glides stay off on every frame the plate moves", {
    loose: loose.slice(0, 5).map(x => x[0]),
    holdLetGo: letGo?.[0],
    around:
      i < 0
        ? []
        : s
            .slice(Math.max(0, i - 3), i + 4)
            .map(x => [x[0], x[1] ? "held" : "free", x[3], x[4] ? "switching" : "", x[5]]),
  });
  t.ok(!!free && free[0] - lastMorph[0] < 100, "…and come back as the last motion ends (no timer past it)", {
    lastMorph: lastMorph?.[0],
    free: free?.[0],
  });
}
snapHeldUntilTheLastMotion.opts = { step: 0.05 };

/* the empty frame's text fades with the picture (2026-11-01, F2): Generating (empty) ↔ the Gallery is one view, so no
   view fade covers it — the text was hidden and shown at once by the status loop while the picture faded */
export async function emptyTextFadesWithThePicture(k, t) {
  await k.job("[fill:446688] p", { ar: "3:4", steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.mouse(2, 2);
  const tab = v => `(document.querySelector('.tab[data-v="${v}"]').click(),1)`;
  const watch = `new Promise(res=>{const o=[],t0=performance.now();
    (function s(){requestAnimationFrame(()=>setTimeout(()=>{o.push({t:performance.now()-t0,op:+getComputedStyle($("idle")).opacity});
    if(performance.now()-t0<900)s();else res(o)},0))})()})`;
  for (const [from, to, up] of [
    ["gen", "gallery", false],
    ["gallery", "gen", true],
  ]) {
    await k.ev(tab(from));
    if (from === "gen") await k.ev(`(closeShown(),1)`);
    await k.sleep(1300);
    const w = k.ev(watch);
    await k.ev(tab(to));
    const s = await w,
      a = s.find(x => (up ? x.op > 0.02 : x.op < 0.98)),
      b = s.find(x => (up ? x.op > 0.98 : x.op < 0.02));
    const ms = a && b ? Math.round(b.t - a.t) : null;
    t.motion(ms != null && ms >= 150, `${from} → ${to}: the empty frame's text fades ${up ? "in" : "out"}, not a cut`, {
      ms,
    });
  }
}
emptyTextFadesWithThePicture.opts = { step: 0.05 };

/* from a shortened panel to a picture (the user, 2026-11-03: Generating with a 3:4 at its biggest, Queue shorter — the
   switch "first adjusts, then snaps into max size"): the picture was laid out for the switch in the room the panel box
   still had (the Queue's height), cropped to a 3:4 at that height, then snapped. Both axes grow here: one reveal, the
   plate never smaller than where it started, and no jump */
export async function switchFromShortPanelReveals(k, t) {
  await k.job("[fill:446688] tall", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.ev(`(setDock("left"),S.ar="16:9",setPaneSize("queue","h",500,"side"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1500);
  const end = await k.rect("#frame");
  await k.ev(`(document.querySelector('.tab[data-v="queue"]').click(),1)`);
  await k.sleep(1500);
  const start = await k.rect("#plate");
  const rows = await k.ev(`new Promise(res=>{const out=[],t0=performance.now();
    const tick=()=>{const r=$("plate").getBoundingClientRect();out.push([r.width,r.height]);
      if(performance.now()-t0<1500)requestAnimationFrame(tick);else res(out)};
    document.querySelector('.tab[data-v="gen"]').click();requestAnimationFrame(tick)})`);
  const minW = Math.min(...rows.map(r => r[0])),
    /* frame-rate free (CI's runner drops frames: a 0.4 s reveal sampled coarsely looked like a jump): only growing */
    shrinks = rows.slice(1).filter((r, i) => r[0] < rows[i][0] - 1 || r[1] < rows[i][1] - 1).length;
  t.ok(minW >= start.width - 2, "the plate never narrower than the Queue's (no crop: both axes grow)", {
    minW,
    start: start.width,
  });
  t.ok(!shrinks, "…it only grows, on both axes (no crop, then no snap back)", { shrinks });
  const last = rows[rows.length - 1];
  t.ok(
    Math.abs(last[0] - (end.width + 0)) <= 30 && Math.abs(last[1] - end.height) <= 30,
    "…it lands at the picture's size",
    {
      last,
      end: [end.width, end.height],
    },
  );
}
switchFromShortPanelReveals.opts = { width: 1760, height: 1080, step: 0.05 };

/* T2b (docs/decisions/0014; the user 2026-11-07: "it removes the blur first, then fades the pic in, then applies the
   blur"): a layout switch moves the LIVE page on the tab switch's system — no View Transition (its snapshot can't hold
   the glass's blur, and its names made the glass a backdrop root from the first frame). Per frame: the real plate
   travels (several frames between its two places, its glass on); the prompt box fades through its change of relation,
   glued to the live plate all the while — the old relation while it leaves, the new while it comes (DEVLOG
   DD-2026-11-08-7; it used to sit where it was, then where it lands, and the picture moved into it) — and ends shown */
export async function layoutSwitchIsLive(k, t) {
  await k.job("[fill:446688] a", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.ev(`(window._vt=0,document.startViewTransition&&(()=>{const o=document.startViewTransition.bind(document);
    document.startViewTransition=f=>(window._vt++,o(f))})(),1)`);
  for (const page of ["gen", "queue"])
    for (const [from, to] of [
      ["left", "right"],
      ["right", "below"],
      ["below", "left"],
    ]) {
      await k.ev(`(setDock("${from}"),document.querySelector('.tab[data-v="${page}"]').click(),1)`);
      await k.mouse(4, 4);
      await k.sleep(1600);
      const rows = await k.ev(`new Promise(res=>{const out=[],t0=performance.now();setDock("${to}");
        /* the box's fade as built: its keyframes reach 0 (a sampled minimum depends on the frame rate — CI drops
           frames, and a frame landing on the two-frame turn isn't guaranteed) */
        window._fadeTo=Math.min(1,...$("lcol").getAnimations({subtree:true}).flatMap(a=>a.effect.getKeyframes()).filter(k=>k.opacity!=null).map(k=>+k.opacity));
        /* what's seen of the box: the stand-in's while it's there, else the box's — its glass layer's opacity through
           every ancestor (the fade is on the parts, fade.js) */
        const eff=e=>{let o=+getComputedStyle(e,"::before").opacity;for(let a=e;a;a=a.parentElement)o*=+getComputedStyle(a).opacity;return o};
        (function f(){const p=$("plate").getBoundingClientRect(),s=document.querySelector(".standin .left"),so=s?eff(s):0,
            b=s&&so>0.05?s:$("left"),L=b.getBoundingClientRect();
          out.push([Math.round(p.left),Math.round(p.top),getComputedStyle($("plate")).backdropFilter!=="none"?1:0,
            b===s?so:eff(b),Math.round(L.left),Math.round(L.top),Math.round(L.width),Math.round(L.height),Math.round(p.width),Math.round(p.height)]);
          if(performance.now()-t0<1000)requestAnimationFrame(f);else res(out)})()})`);
      const tag = `${page}: ${from} → ${to}`,
        [p0, p1] = [rows[0], rows.at(-1)],
        between = rows.filter(
          r => (r[0] - p0[0]) * (r[0] - p1[0]) < -1 || (r[1] - p0[1]) * (r[1] - p1[1]) < -1, // strictly between
        ).length,
        pos = await k.ev(`S.pos||"mid"`),
        box = r => ({ l: r[4], t: r[5], w: r[6], h: r[7] }),
        plate = r => ({ l: r[0], t: r[1], w: r[8], h: r[9] }),
        [A0, A1] = [glueAnchors(from, pos), glueAnchors(to, pos)],
        [r0, r1] = [relationOf(box(p0), plate(p0), A0), relationOf(box(p1), plate(p1), A1)],
        turn = rows.findIndex(r => r[3] <= 0.05),
        on = (r, A, rel) => {
          const x = relationOf(box(r), plate(r), A);
          return Math.abs(x.dx - rel.dx) <= 2 && Math.abs(x.dy - rel.dy) <= 2;
        },
        off = [
          ...rows.slice(0, turn < 0 ? rows.length : turn).filter(r => r[3] > 0.05 && !on(r, A0, r0)),
          ...(turn < 0 ? [] : rows.slice(turn)).filter(r => r[3] > 0.05 && !on(r, A1, r1)),
        ];
      t.ok(
        rows.every(r => r[2]),
        `${tag}: the plate's glass on every frame`,
      );
      t.ok(between >= 3, `${tag}: the plate travels live (frames between its two places)`, { between, p0, p1 });
      const fadeTo = await k.ev(`window._fadeTo`);
      t.ok(fadeTo === 0 && rows.some(r => r[3] < 0.5) && p1[3] === 1, `${tag}: the box fades through and ends shown`, {
        fadeTo,
        min: Math.min(...rows.map(r => r[3])),
        last: p1[3],
      });
      t.motion(!off.length, `${tag}: …glued to the live plate while seen (old relation, then new)`, {
        off: off.slice(0, 3),
        r0,
        r1,
      });
    }
  t.ok((await k.ev(`window._vt`)) === 0, "no View Transition started", await k.ev(`window._vt`));
}
layoutSwitchIsLive.opts = { width: 1760, height: 1080, step: 0.05 };

/* Contents ride their pane (DEVLOG DD-2026-11-08-2; the user: "panes don't fade — their contents shouldn't either"): in
   a layout switch a panel's contents stay shown and keep their place on the plate's centre every frame — a pure move
   (Left ↔ Right) just travels, a size change crops and reveals them. They used to stay pinned where they were and
   fade out, then fade in at the new place (a second rule for the pane's contents) */
export async function panelContentsRide(k, t) {
  /* the rule as amended in T2c-3b (2026-11-09): a layout switch's panel contents ride their pane — laid out at their new
     place and size, clipped by the plate — starting WHERE THEY WERE on screen: the difference shrinks with the plate's
     progress on each axis (centred on the old plate from the first frame, a resized Queue jumped ~71 px — DD-2026-11-08-2
     as first written). Never faded */
  for (const [from, to] of [
    ["left", "right"],
    ["right", "below"],
    ["below", "left"],
  ]) {
    await k.ev(`(setDock("${from}"),document.querySelector('.tab[data-v="queue"]').click(),1)`);
    await k.mouse(4, 4);
    await k.sleep(1600);
    const rows =
      await k.ev(`new Promise(res=>{const out=[],t0=performance.now(),v=$("v-queue"),b=v.getBoundingClientRect();
      out.push([1,0,0,0,0,b.left,b.top]);setDock("${to}");
      (function f(){setTimeout(()=>{const p=$("plate").getBoundingClientRect(),r=v.getBoundingClientRect();
        out.push([+getComputedStyle(v).opacity,Math.round(r.left+r.width/2-(p.left+p.width/2)),
          Math.round(r.top+r.height/2-(p.top+p.height/2)),Math.round(p.left),Math.round(p.top),r.left,r.top]);
        if(performance.now()-t0<1000)requestAnimationFrame(f);else res(out)},0)})()})`);
    const tag = `Queue: ${from} → ${to}`,
      before = rows[0],
      seen = rows.slice(1),
      last = seen.at(-1),
      dim = seen.filter(r => r[0] < 0.99),
      moved = seen.some(r => Math.abs(r[3] - seen[0][3]) > 20 || Math.abs(r[4] - seen[0][4]) > 20),
      /* each axis: its distance from where it lands never grows (past and back = a reversal) */
      back = seen.filter(
        (r, i) =>
          i &&
          (Math.abs(r[5] - last[5]) > Math.abs(seen[i - 1][5] - last[5]) + 1 ||
            Math.abs(r[6] - last[6]) > Math.abs(seen[i - 1][6] - last[6]) + 1),
      );
    t.ok(moved, `${tag}: the plate moves (the case)`, { first: seen[0], last });
    t.ok(!dim.length, `${tag}: its contents never fade`, { dim: dim.length + "/" + seen.length, min: dim[0] });
    t.ok(
      Math.abs(seen[0][5] - before[5]) <= 3 && Math.abs(seen[0][6] - before[6]) <= 3,
      `${tag}: …start where they were (no jump at the first frame)`,
      { before: before.slice(5), first: seen[0].slice(5) },
    );
    t.ok(!back.length, `${tag}: …and travel to where they land, never past and back`, {
      back: back.length + "/" + seen.length,
      at: back[0],
    });
  }
}
panelContentsRide.opts = { width: 1760, height: 1080, step: 0.05 };

/* a layout switch (DEVLOG DD-2026-11-08-5, -7): the prompt box you SEE is GLUED to the live plate every frame — by its
   old relation (beside / under) and at its old shape while it leaves, by its new one and at its new shape while it
   comes — and never seen changing relation. Measured on what's on screen (the stand-in while it's there, else the box)
   against the plate, every frame: through the Layout menu with a prompt that wraps differently at the two widths (the
   layout measured the old shape mid-switch: an 18 px jump), and through a drag to the bottom dock (the press still held
   the glue: a 56 px jump). The user's report that set the rule: side by side → Vertical, the box sat still while the
   picture moved into it */
export async function boxGluedThroughLayoutSwitch(k, t) {
  await k.job(
    "[fill:446688] birds eye view. epic cinematic shot of a castle, nighttime, cinematic light, fog, mist, atmosphere, lights, spooky, moon, birds eye view of a castle on a hill above a lake with boats",
    { ar: "3:4", steps: 2 },
  );
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  /* the material is ONE layer (DEVLOG DD-2026-11-08-9): an element whose glass is its ::before paints nothing itself —
     its ring and shadow on the element stayed on screen as an empty outline while its glass faded (the user's "trace") */
  const paints =
    await k.ev(`[...document.querySelectorAll("#lcol *")].filter(e=>{const b=getComputedStyle(e,"::before");
    if(b.display==="none"||b.content==="none"||!b.backdropFilter||b.backdropFilter==="none"||!e.getClientRects().length)return false;const c=getComputedStyle(e);
    const clear=v=>v==="transparent"||v.endsWith(", 0)");
    return (parseFloat(c.borderTopWidth)>0&&!clear(c.borderTopColor))||c.boxShadow!=="none"||!clear(c.backgroundColor)}).map(e=>e.id||e.className)`);
  t.ok(!paints.length, "the glass is one layer: what holds it paints nothing itself", paints);
  const REC = `(()=>{window.__rec=[];const t0=performance.now(),R=e=>{const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]},
    /* what's seen of the box: its glass layer's opacity through every ancestor (a fade on the parts or on the column) */
    eff=e=>{let o=+getComputedStyle(e,"::before").opacity;for(let a=e;a;a=a.parentElement)o*=+getComputedStyle(a).opacity;return o},
    V=()=>{const s=document.querySelector(".standin"),sl=s&&s.querySelector(".left"),so=sl?eff(sl):0;
      return [...(sl&&so>0.05?[so,...R(sl)]:[eff($("left")),...R($("left"))]),...R($("plate"))]},
    /* what's seen of the box's parts: every visible element's place and size, in order */
    seen=parts=>parts.flatMap(p=>[p,...p.querySelectorAll("*")]).filter(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);
      return r.width>0&&r.height>0&&c.visibility!=="hidden"&&!e.closest(HANDLES)}).map(e=>[e.tagName,...R(e)]);
    window.__seen0=seen([$("ltitle"),$("left"),$("chips")]);window.__seen1=null;window.__glass=[];window.__pic=1;window.__bare=[];window.__pills=[];
    /* the picture's canvas, seen through every ancestor */
    effEl=e=>{let o=1;for(let a=e;a;a=a.parentElement)o*=+getComputedStyle(a).opacity;return o},
    /* glass under a fade: a rendered glass layer (on itself or its ::before) with an ancestor part-way faded (fade.js;
       an ancestor at 0 is not seen — the title row's buttons wait at 0 until the box is hovered) */
    gl=(e,p)=>{const c=getComputedStyle(e,p);if(p&&(c.display==="none"||c.content==="none"))return false;return c.backdropFilter&&c.backdropFilter!=="none"},
    under=()=>[...document.querySelectorAll("#lcol, #lcol *, .standin, .standin *")].filter(e=>{const b=gl(e,"::before");if(!gl(e)&&!b)return false;
      if(!e.getClientRects().length)return false;{const c=getComputedStyle(e);if(c.visibility==="hidden"||+c.opacity===0)return false} /* not drawn (a closed menu keeps its box) */
      for(let a=b?e:e.parentElement;a&&a!==document.documentElement;a=a.parentElement){const o=+getComputedStyle(a).opacity;if(o>0&&o<1)return true}return false}).map(e=>e.id||e.className);
    (function f(){const s=document.querySelector(".standin");if(s&&!__seen1)__seen1=seen([...s.children]);const u=under();if(u.length)__glass.push(u.slice(0,3));{const [a,b]=[effEl($("cv")),effEl($("cvx"))],c=b>0.5?$("cvx"):$("cv"),r=c.getBoundingClientRect(),f=$("frame").getBoundingClientRect();
        __pic=Math.min(__pic,Math.max(a,b));
        /* the pills fade with their box: no pill's fill more seen than the box it sits in (they stood as empty capsules) */
        for(const box of [document.querySelector(".standin .left"),$("left")]){if(!box)continue;const bo=eff(box);
          for(const p of box.querySelectorAll(".pill")){let o=+getComputedStyle(p,"::before").opacity;for(let x=p;x;x=x.parentElement)o*=+getComputedStyle(x).opacity;
            if(o>bo+0.05)__pills.push([Math.round(o*100)/100,Math.round(bo*100)/100])}}if(r.left>f.left+1||r.top>f.top+1||r.right<f.right-1||r.bottom<f.bottom-1)__bare.push([Math.round(r.width),Math.round(r.height),Math.round(f.width),Math.round(f.height)])}
      __rec.push(V());if(performance.now()-t0<1600)requestAnimationFrame(f)})();return 1})()`;
  /* the stand-in LOOKS like the box: every visible element of it, at its place and size (the copy has no ids — a look
     tied to an id was lost: the hidden textarea showed under the editor, the user 2026-11-08) */
  /* the glass stays live through the fades: nothing that holds glass fades (DEVLOG DD-2026-11-08-8 — the box's blur
     popped back the frame it reached full opacity, the user: "a light flicker when the box reappears") */
  /* the picture RIDES its plate in a layout switch: the same picture, seen every frame — its copy at the old size while
     the plate crops, itself at the new while it reveals — and covering its frame (it was hidden from the first frame to
     the swap, as if a new picture came: the plate travelled empty, the user 2026-11-08; shown at its new size alone, it
     sat in the bigger plate with empty margins) */
  const picRides = async tag => {
    const m = await k.ev(`__pic`),
      bare = await k.ev(`__bare`);
    t.ok(m > 0.95, `${tag}: the picture is seen every frame (it rides its plate)`, { least: m });
    t.ok(!bare.length, `${tag}: …and covers its frame (no empty plate round it)`, {
      frames: bare.length,
      first: bare[0],
    });
  };
  const pillsWithBox = async tag => {
    const p = await k.ev(`__pills`);
    t.ok(!p.length, `${tag}: the pills fade with their box (no fill seen more than the box)`, {
      frames: p.length,
      first: p[0],
    });
  };
  const glassLive = async tag => {
    const g = await k.ev(`__glass`);
    t.ok(!g.length, `${tag}: no glass under a fading part, any frame`, { frames: g.length, first: g[0] });
  };
  const looksAlike = async tag => {
    const [a, b] = [await k.ev(`__seen0`), await k.ev(`__seen1`)];
    if (!b) return; // no stand-in (the old code): nothing to compare
    const diff =
      a.length !== b.length
        ? [a.length, b.length]
        : a.map((e, i) => [e, b[i]]).filter(([e, f]) => e.some((v, j) => (j ? Math.abs(v - f[j]) > 1 : v !== f[j])));
    t.ok(!diff.length, `${tag}: the stand-in looks exactly like the box`, { diff: diff.slice(0, 4) });
  };
  const box = r => ({ l: r[1], t: r[2], w: r[3], h: r[4] }),
    plate = r => ({ l: r[5], t: r[6], w: r[7], h: r[8] });
  /* per frame, sampled in real time: judged on a real PC (t.motion). Known until T2c-4: about one run in three, one
     frame of the fade-in reads ~2.5 px off — the frame and the plate are written by two loops (framebox's drive, the
     plate's tick), and the box rides the plate as it was in between (ux-review/17-t2-motion.md) */
  const check = (tag, rows, from, to, pos) => {
    const [a, z] = [rows[0], rows.at(-1)],
      [A0, A1] = [glueAnchors(from, pos), glueAnchors(to, pos)],
      [r0, r1] = [relationOf(box(a), plate(a), A0), relationOf(box(z), plate(z), A1)],
      turn = rows.findIndex(r => r[0] <= 0.05),
      /* on its relation to the plate as it is in that frame, at its shape */
      on = (r, A, rel, shape) => {
        const x = relationOf(box(r), plate(r), A);
        return (
          Math.abs(x.dx - rel.dx) <= 2 &&
          Math.abs(x.dy - rel.dy) <= 2 &&
          Math.abs(r[3] - shape[3]) <= 1 &&
          Math.abs(r[4] - shape[4]) <= 1
        );
      },
      seenOut = rows.slice(0, turn < 0 ? rows.length : turn).filter(r => r[0] > 0.05),
      seenIn = turn < 0 ? [] : rows.slice(turn).filter(r => r[0] > 0.05),
      offOut = seenOut.filter(r => !on(r, A0, r0, a)),
      offIn = seenIn.filter(r => !on(r, A1, r1, z)),
      plateMoved = seenOut.some(r => Math.abs(r[5] - a[5]) + Math.abs(r[6] - a[6]) > 4);
    t.ok(
      Math.abs(box(a).l - box(z).l) + Math.abs(box(a).t - box(z).t) > 20,
      `${tag}: the box changes place (the case)`,
      { a, z },
    );
    t.motion(turn > 0 && !offOut.length, `${tag}: leaving, it rides the plate by its old relation, at its old shape`, {
      turn,
      plateMoved,
      off: offOut.slice(0, 3),
      r0,
    });
    t.motion(!offIn.length, `${tag}: …coming, by its new relation, at its new shape`, {
      off: offIn.slice(0, 3),
      r1,
      z,
      near: offIn.length ? rows.slice(Math.max(0, rows.indexOf(offIn[0]) - 2), rows.indexOf(offIn[0]) + 3) : [],
    });
  };
  const click = async (x, y) => {
    await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  };
  for (const [from, to] of [
    ["left", "below"],
    ["below", "left"],
    ["left", "right"],
    ["right", "below"],
  ]) {
    await k.ev(`(setDock("${from}"),1)`);
    await k.mouse(4, 4);
    await k.sleep(1600);
    await k.ev(`($("layBtn").click(),1)`);
    await k.sleep(300);
    const o = await k.rect(`#layMenu [data-lay="${to}"]`);
    await k.ev(REC);
    await click(o.left + o.width / 2, o.top + o.height / 2);
    await k.sleep(1700);
    check(`the Layout menu, ${from} → ${to}`, await k.ev(`__rec`), from, to, await k.ev(`S.pos||"mid"`));
    await looksAlike(`the Layout menu, ${from} → ${to}`);
    await glassLive(`the Layout menu, ${from} → ${to}`);
    await picRides(`the Layout menu, ${from} → ${to}`);
    await pillsWithBox(`the Layout menu, ${from} → ${to}`);
  }
  /* dragged by its name row from beside the picture to the bottom dock */
  await k.ev(`(setDock("left"),1)`);
  await k.mouse(4, 4);
  await k.sleep(1600);
  const n = await k.rect("#ltitle"),
    [x, y] = [n.left + 20, n.top + n.height / 2];
  /* onto the drop map's tile under the picture (L1b: the tile under the pointer) */
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: y + 12, button: "left", buttons: 1 });
  const [X, Y] = await k.ev(
    `(r=>[r.left+r.width/2,r.top+r.height/2])(document.querySelector('.droptile[data-dock="below"]').getBoundingClientRect())`,
  );
  for (let i = 1; i <= 10; i++)
    await k.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x + ((X - x) * i) / 10,
      y: y + 12 + ((Y - y - 12) * i) / 10,
      button: "left",
      buttons: 1,
    });
  t.ok(
    (await k.ev(`(document.querySelector(".droptile.hot")||{dataset:{}}).dataset.dock`)) === "below",
    "the drag is over the bottom tile",
  );
  await k.sleep(100);
  await k.ev(REC);
  await k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: X, y: Y, button: "left", clickCount: 1 });
  await k.sleep(1700);
  /* a hand drop TRAVELS (layoutmath.js relationMotion, L1a): no stand-in, no fade — the box itself goes on from where you
     let it go to its landing, seen every frame, never turning back (the menu's switch above fades through) */
  {
    const rows = await k.ev(`__rec`),
      z = rows.at(-1),
      d = r => Math.hypot(r[1] - z[1], r[2] - z[2]),
      hidden = rows.filter(r => r[0] < 0.95),
      back = rows.slice(1).filter((r, i) => d(r) > d(rows[i]) + 2);
    t.ok(d(rows[0]) > 20, "dragged to the bottom dock: the box changes place (the case)", { a: rows[0], z });
    t.ok(
      !(await k.ev(`!!document.querySelector(".standin")||!!__seen1`)),
      "dragged to the bottom dock: no stand-in (it travels itself)",
    );
    t.motion(!hidden.length, "dragged to the bottom dock: the box is seen every frame (no fade)", { first: hidden[0] });
    t.motion(!back.length, "dragged to the bottom dock: …and goes to its landing, never back", { first: back[0], z });
  }
  await glassLive("dragged to the bottom dock");
  await picRides("dragged to the bottom dock");
  await pillsWithBox("dragged to the bottom dock");
}
boxGluedThroughLayoutSwitch.opts = { width: 1400, height: 900, step: 0.05 };

/* a page fades as ONE layer (DEVLOG DD-2026-11-08-12; the user, 2026-11-08: "Generating to Queue — plates of the queue
   items are there right away, while the rest of the content is loading … content is now separated from its page and
   has different clocks"): while the arriving page fades in, nothing of it is already fully shown — rows drawn a frame
   after the switch began included (faded by its parts, the page's list of parts was a snapshot and they escaped it) */
export async function pageFadesAsOne(k, t) {
  for (let i = 0; i < 8; i++) await k.job("[fill:446688] a" + i, { ar: "3:4", steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=8`, 90000);
  await k.mouse(4, 4);
  for (const [from, to] of [
    ["gen", "queue"],
    ["gallery", "queue"],
    ["queue", "loras"],
    ["png", "queue"],
  ]) {
    await k.ev(`(document.querySelector('.tab[data-v="${from}"]').click(),1)`);
    await k.sleep(1300);
    const r =
      await k.ev(`new Promise(res=>{const eff=e=>{let o=1;for(let a=e;a;a=a.parentElement)o*=+getComputedStyle(a).opacity;return o},
        out={frames:0,ahead:[]},t0=performance.now();document.querySelector('.tab[data-v="${to}"]').click();
      (function f(){const v=document.querySelector(".rpanel > .view.on"),els=[...v.querySelectorAll("*")].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=="hidden"),
          ops=els.map(eff),mid=ops.some(o=>o>0.1&&o<0.9);
        if(mid){out.frames++;const i=ops.findIndex(o=>o>0.97);if(i>=0)out.ahead.push((els[i].id||els[i].className)+" "+ops[i].toFixed(2)+" at "+Math.round(performance.now()-t0)+"ms")}
        if(performance.now()-t0<900)requestAnimationFrame(f);else res(out)})()})`);
    t.ok(r.frames > 0 && !r.ahead.length, `${from} → ${to}: nothing of the page is fully shown while it fades in`, {
      frames: r.frames,
      ahead: r.ahead.slice(0, 4),
    });
  }
}
pageFadesAsOne.opts = { width: 1400, height: 900 };

/* T2c-4: the plate IS its element (the picture's frame, a panel's box) — whoever writes the element tells the plate in
   the same frame, so after every frame's writes (rAF → setTimeout 0) the plate sits on it, a mat out for a picture,
   outside a switch's own travel. Through tab switches, layout switches, a ratio change, browsing, Reset and a window
   resize. The plate had a loop of its own that corrected it for 0.7–1.5 s after a change: it hid a 1 px error of the
   switch's goal (dom.js offsetIn missed the panel's border) */
export async function plateIsItsElement(k, t) {
  const tab = v => `document.querySelector('.tab[data-v="${v}"]').click()`;
  await k.job("[fill:446688] a", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.job("[fill:884466] b", { ar: "16:9", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.sleep(1200);
  /* the parts that move with the page (a role each — travels, rides, follows): their geometry is written by their owner
     on the driver's frames, never by a CSS transition or animation of its own (T2c-5) */
  await k.ev(`(window.PARTS="#plate,#rim,#frame,#rpanel,#lcol,#left,#ltitle,#chips,.pgrip,nav.tabs,#gtools,#hedges,#prog,#showP,.gnav",
    window.GEO=["left","top","width","height","right","bottom","inset","transform","translate","scale"],window.__geo=[],1)`);
  await k.ev(`(()=>{window.__off=[];window.__act="";const M=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mat"))||0;
    (function f(){setTimeout(()=>{if(!document.documentElement.classList.contains("switching")){const rp=$("rpanel"),pan=rp.classList.contains("paneled"),
      e=(pan?rp:$("frame")).getBoundingClientRect(),p=$("plate").getBoundingClientRect(),m=pan?0:M;
      const d=Math.max(Math.abs(p.left-(e.left-m)),Math.abs(p.top-(e.top-m)),Math.abs(p.width-(e.width+2*m)),Math.abs(p.height-(e.height+2*m)));
      if(d>0.5&&e.width>0)__off.push([__act,Math.round(d*10)/10])}
      for(const el of document.querySelectorAll(PARTS))for(const a of el.getAnimations()){const ps=a instanceof CSSTransition?[a.transitionProperty]:(a.effect&&a.effect.getKeyframes?a.effect.getKeyframes().flatMap(k=>Object.keys(k)):[]);
        const g=ps.filter(x=>GEO.includes(x));if(g.length&&a.playState==="running")__geo.push([__act,(el.id||el.className).toString().slice(0,30),g.join("+")])}
      requestAnimationFrame(f)},0)})();return 1})()`);
  const act = async (name, js, wait = 1500) => {
    await k.ev(`(window.__act=${JSON.stringify(name)},${js},1)`);
    await k.sleep(wait);
  };
  /* an arrow held while you click through (it stays under the pointer while the picture changes), then let go: it
     catches up with the picture's new edge. Set up directly: the pointer off the picture (on it, the layout holds) */
  await k.mouse(4, 4);
  await k.sleep(300);
  await k.ev(`(lay.navHold=document.querySelector(".gnav.prev"),genNav(-1),updNav(),1)`);
  await k.sleep(900);
  const held = await k.ev(
    `(()=>{const e=document.querySelector(".gnav.prev"),r=$("frame").getBoundingClientRect();return Math.abs(parseFloat(e.style.left)-Math.round(r.left+10))})()`,
  );
  t.ok(held > 20, "an arrow held while the picture changed: it stayed where it was", { off: held });
  await k.ev(`(window.__act="an arrow let go",1)`);
  await k.mouse(10, 10); // a move off it: let go
  await k.sleep(1200);
  for (const dock of ["left", "right", "below"]) {
    await act(`${dock}: the dock`, `setDock(${JSON.stringify(dock)})`);
    for (const v of ["queue", "gallery", "png", "loras", "gen"]) await act(`${dock}: tab ${v}`, tab(v));
    await act(`${dock}: a ratio`, `(S.ar=S.ar==="3:4"?"16:9":"3:4",sizeFrame())`);
    await act(`${dock}: browsing`, `(genNav(-1),updNav())`);
    await act(`${dock}: Reset`, `document.querySelector('[data-lay="reset"]').click()`);
  }
  await k.ev(`(window.__act="the window",1)`);
  await k.send("Emulation.setDeviceMetricsOverride", { width: 1250, height: 820, deviceScaleFactor: 1, mobile: false });
  await k.sleep(1500);
  const off = await k.ev(`__off`),
    by = {};
  for (const [a, d] of off) by[a] = Math.max(by[a] || 0, d);
  t.ok(!off.length, "after every frame's writes the plate is its element (outside a switch's travel)", by);
  const geo = await k.ev(`__geo`),
    gby = {};
  for (const [a, el, g] of geo) gby[`${a}: ${el}`] = g;
  t.ok(!geo.length, "no moving part glides on a clock of its own (a CSS transition or animation of its geometry)", gby);
}
plateIsItsElement.opts = { width: 1600, height: 950, step: 0.05, limitMin: 5 };

/* T2c's acceptance (the user, 2026-11-09: "constant rubber bands in vertical when switching the pages"): in Vertical,
   with each page its own height, a page switch keeps the box glued under the plate — one gap every frame — and moving
   one way only. On 8c373ca the box slid on a clock of its own: the gap ran from −93 (over the page) to 211 px and the box
   overshot and came back (down 290, back 31) */
export async function verticalSwitchesKeepTheBoxGlued(k, t) {
  await k.job("[fill:446688] a", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.ev(
    `(setDock("below"),setPaneSize("queue","h",300,"vert"),setPaneSize("loras","h",420,"vert"),save(),sizeFrame(),1)`,
  );
  await k.mouse(4, 4);
  await k.sleep(1500);
  const tab = v => `document.querySelector('.tab[data-v="${v}"]').click()`;
  for (const v of ["queue", "gen", "loras", "png", "gen"]) {
    const f = await k.ev(`new Promise(res=>{const out=[],t0=performance.now();(${tab(v)});
      (function g(){requestAnimationFrame(()=>setTimeout(()=>{const b=$("left").getBoundingClientRect(),p=$("plate").getBoundingClientRect();
        out.push([b.top,p.bottom]);if(performance.now()-t0<1300)g();else res(out)},0))})()})`);
    const gaps = f.map(([b, p]) => b - p),
      g0 = gaps.at(-1),
      off = gaps.filter(g => Math.abs(g - g0) > 2),
      tops = f.map(([b]) => b);
    let dir = 0,
      back = 0;
    for (let j = 1; j < tops.length; j++) {
      const d = tops[j] - tops[j - 1];
      if (Math.abs(d) < 0.6) continue;
      if (dir && Math.sign(d) !== dir) back += Math.abs(d);
      dir = Math.sign(d);
    }
    t.motion(!off.length, `Vertical, tab ${v}: the box one gap under the plate every frame`, {
      gap: Math.round(g0),
      min: Math.round(Math.min(...gaps)),
      max: Math.round(Math.max(...gaps)),
    });
    t.motion(back <= 2, `…and it moves one way only (no rubber band)`, { back: Math.round(back) });
  }
}
verticalSwitchesKeepTheBoxGlued.opts = { width: 1600, height: 950 };

/* the same picture scales with its pane in a layout switch (the user, 2026-11-10: "we should see picture being scaled up
   and down at the same time as the pane does"; DEVLOG DD-2026-11-10-2): every frame the picture covers exactly its
   frame, no copy of it shows, the picture itself is fully seen. It cropped and revealed at its own two sizes, its copy
   crossing over it — "the pic seems to lag, it's clearly not a part of the page" */
export async function samePictureScalesWithItsPane(k, t) {
  await k.job("[fill:446688] a", { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  await k.ev(`(setDock("left"),1)`);
  await k.mouse(4, 4);
  await k.sleep(1600);
  for (const to of ["below", "right", "left"]) {
    const f = await k.ev(`new Promise(res=>{const out=[],t0=performance.now();setDock(${JSON.stringify(to)});
      const seen=e=>{let o=+getComputedStyle(e).opacity;for(let a=e.parentElement;a;a=a.parentElement)o*=+getComputedStyle(a).opacity;return o};
      (function g(){requestAnimationFrame(()=>setTimeout(()=>{const c=$("cv").getBoundingClientRect(),fr=$("frame").getBoundingClientRect();
        out.push([Math.max(Math.abs(c.left-fr.left),Math.abs(c.top-fr.top),Math.abs(c.width-fr.width),Math.abs(c.height-fr.height)),seen($("cvx")),seen($("cv")),fr.width,fr.left]);
        if(performance.now()-t0<1300)g();else res(out)},0))})()})`);
    const off = f.filter(x => x[0] > 1.5),
      copy = f.filter(x => x[1] > 0.05),
      dim = f.filter(x => x[2] < 0.95),
      span = (/** @type {number} */ i) => Math.max(...f.map(x => x[i])) - Math.min(...f.map(x => x[i]));
    t.ok(span(3) > 20 || span(4) > 20, `→ ${to}: the frame changes size or place (the case)`);
    t.motion(!off.length, `→ ${to}: the picture covers exactly its frame every frame (it scales with its pane)`, {
      frames: off.length,
      most: Math.round(Math.max(0, ...off.map(x => x[0]))),
    });
    t.motion(!copy.length && !dim.length, `→ ${to}: no copy shows, the picture fully seen`, {
      copy: copy.length,
      dim: dim.length,
    });
  }
}
samePictureScalesWithItsPane.opts = { width: 1400, height: 900 };

/* a fade by parts takes in what joins its group while it runs (fade.js glassFade — DEVLOG DD-2026-11-11-10): in a
   layout switch the LoRA row's "+N" chip is rebuilt as the box's width changes (chips.js capChips), a frame after the
   box's fade-in took its parts — it showed at full while the chips beside it faded in (the user, 2026-11-11: "appears
   very first during the layout switches"). Per frame: the "+N" chip as seen as a chip beside it */
export async function addedPartsJoinTheFade(k, t) {
  await k.ev(`(LORAS.forEach((l,i)=>{if(i<14){l.on=true;l.onAt=i}}),renderChips(),1)`);
  await k.ev(`(setDock("below"),1)`);
  await k.mouse(2, 2);
  await k.sleep(1800);
  t.ok(await k.ev(`!!document.querySelector("#chips .chipmore")`), 'the case: the LoRA row has its "+N" chip');
  await k.ev(`($("layBtn").click(),1)`);
  await k.sleep(200);
  const o = await k.rect('#layMenu [data-lay="left"]');
  const watch =
    k.ev(`new Promise(res=>{const out=[],t0=performance.now(),eff=e=>{if(!e)return null;let o=1;for(let a=e;a;a=a.parentElement)o*=+getComputedStyle(a).opacity;return o};
    (function f(){requestAnimationFrame(()=>setTimeout(()=>{out.push([Math.round(performance.now()-t0),eff(document.querySelector("#chips .chipmore")),eff(document.querySelector("#chips .chip[data-n]"))]);
      if(performance.now()-t0<1500)f();else res(out)},0))})()})`);
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: o.left + 5, y: o.top + 5 });
  await k.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: o.left + 5,
    y: o.top + 5,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await k.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: o.left + 5,
    y: o.top + 5,
    button: "left",
    clickCount: 1,
  });
  const rows = /** @type {[number, number | null, number | null][]} */ (await watch),
    fading = rows.filter(r => r[2] != null && r[2] < 0.99),
    ahead = fading.filter(r => r[1] != null && Math.abs(r[1] - /** @type {number} */ (r[2])) > 0.1);
  t.ok(fading.length > 0, "the case: the chips fade in", { frames: rows.length });
  t.motion(!ahead.length, 'the "+N" chip fades with the chips beside it — never ahead', {
    first: ahead[0] && ahead[0].map(v => (typeof v === "number" ? Math.round(v * 100) / 100 : v)),
    frames: ahead.length,
  });
}
addedPartsJoinTheFade.opts = { width: 1600, height: 950, step: 0.05 };
