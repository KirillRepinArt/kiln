// The case table (v0.7c B, 2026-11-03): one test generated from the layout model instead of cases picked by hand (the
// user's screen kept finding what hand-picked tests missed: they each took one ratio, one window). Every case is a
// layout × a page; its edges are not listed here but found on the page (every resize handle you can see and press), so a
// new edge is covered the day it exists. The rule each edge is held to (DEVLOG DD-2026-11-02-12/14): an edge sets its
// pane's size within [least, largest]; past either, the rubber band — "a little give, nothing else moves" — and on
// release it settles back.
//
// For each edge, both ways along its axis: drag 1 goes far past the limit and lets go (the pane now rests AT its limit:
// S1); drag 2 starts there and pulls far past again (held: H2), then lets go (S2). Checked:
//   one drag  — a single drag reaches the limit (the give-way order: empty room first, then the other panes)
//   give      — the grabbed edge moves a little: more than nothing, at most the rubber band's reach (RUBBER)
//   pin       — at its limit the grabbed pane's opposite side, on the drag's axis, holds still (nothing is left to
//               give way: the empty room is used, the others are at their least) — on a centred axis it mirrors the
//               give instead, never more (a drag is a constraint, DEVLOG DD-2026-11-03-6: side by side every outer
//               edge, Vertical's sides); the shared edge's outer sides always hold (the trade)
//   no slide  — nothing moves more than the give (what rides the grabbed pane — the tab bar on its plate, the box at its
//               anchor by the picture — may follow it by that much; a 160 px slide under the tab bar may not)
//   back      — on release, everything is where it was (S2 vs S1)
//   apart     — parts that don't overlap at rest don't overlap while held; nothing leaves the window
//   let go    — nothing stays held after release
//   reachable — at rest, the Layout button can be pressed (ROADMAP v0.7c (p): a small picture covered it)
// The parts: the tab bar, the prompt box, the page's plate, the picture.

const RUBBER = 20, // layoutmath.js RUBBER: the rubber band's reach
  GIVE = RUBBER + 2, // + a frame's rounding
  STILL = 1.5,
  FAR = 1600; // past any limit in these windows (the pointer is kept inside the window)
const HANDLES = ".pedge,.sedge,.vedge,.hsplit,.hedge,.vpedge,.phedge"; // outlines.js HANDLES
const PARTS = { bar: "nav.tabs", box: "#left", plate: "#plate", pic: "#frame" };

const ev = (k, type, x, y, b = 1) =>
  k.send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: "left",
    buttons: type === "mouseReleased" ? 0 : b,
    clickCount: 1,
  });

/** every handle you can see and press now: its index in the page's handle list, a label, its axis, a point that hits it */
const findHandles = k =>
  k.ev(`(()=>{const out=[];document.querySelectorAll(${JSON.stringify(HANDLES)}).forEach((h,i)=>{
    const r=h.getBoundingClientRect(),cs=getComputedStyle(h);
    if(r.width<1||r.height<1||cs.display==="none"||cs.visibility==="hidden"||cs.pointerEvents==="none")return;
    const axis=r.height>r.width?"x":"y";
    const panes=[${JSON.stringify(Object.values({ box: "#left", plate: "#plate" }))}].flat().map(s=>document.querySelector(s))
      .filter(Boolean).map(e=>e.getBoundingClientRect()),
      onPane=(x,y)=>panes.some(p=>x>=p.left-2&&x<=p.right+2&&y>=p.top-2&&y<=p.bottom+2&&
        (axis==="x"?Math.min(Math.abs(x-p.left),Math.abs(x-p.right)):Math.min(Math.abs(y-p.top),Math.abs(y-p.bottom)))<=Math.max(r.width,r.height,40));
    const fs=[0.5,0.3,0.7,0.15,0.85,0.05,0.95,0.4,0.6,0.2,0.8,0.1,0.9];
    for(const f of [...fs.filter(f=>{const x=axis==="x"?r.left+r.width/2:r.left+r.width*f,y=axis==="x"?r.top+r.height*f:r.top+r.height/2;return onPane(x,y)}),...fs]){
      const x=axis==="x"?r.left+r.width/2:r.left+r.width*f,y=axis==="x"?r.top+r.height*f:r.top+r.height/2;
      if(x<1||y<1||x>innerWidth-1||y>innerHeight-1)continue;
      const e=document.elementFromPoint(x,y);
      if(e&&(e===h||h.contains(e))){out.push({i,label:(h.id?"#"+h.id:"")+"."+[...h.classList].join("."),axis,f});return}
    }});return out})()`);

/** where handle i is now: its line (centre on its axis), its thickness, the point to press */
const handleAt = (k, h) =>
  k.ev(`(()=>{const e=document.querySelectorAll(${JSON.stringify(HANDLES)})[${h.i}],r=e.getBoundingClientRect(),f=${h.f};
    return ${JSON.stringify(h.axis)}==="x"?{line:r.left+r.width/2,thick:r.width,x:r.left+r.width/2,y:r.top+r.height*f}
      :{line:r.top+r.height/2,thick:r.height,x:r.left+r.width*f,y:r.top+r.height/2}})()`);

/** every part's rect (null when not on the page), and the window */
const measure = k =>
  k.ev(`(()=>{const o={};for(const[n,s]of Object.entries(${JSON.stringify(PARTS)})){const e=document.querySelector(s);
    if(!e)continue;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
    if(r.width<1||r.height<1||cs.display==="none"||cs.visibility==="hidden"||+cs.opacity===0)continue;
    o[n]={left:r.left,right:r.right,top:r.top,bottom:r.bottom}}o.W=innerWidth;o.H=innerHeight;return o})()`);

const heldClasses = k =>
  k.ev(`[...document.body.classList].filter(c=>/^(resizing|vresizing|laydrag)$/.test(c)).join(" ")||"-"`);

const layReachable = k =>
  k.ev(`(()=>{const b=document.getElementById("layBtn");if(!b)return"no #layBtn";const r=b.getBoundingClientRect();
    if(r.width<1)return"not shown";const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return e&&(e===b||b.contains(e))?"ok":"covered by "+(e?e.id||e.className:"nothing")})()`);

/** press handle h, pull it by d along its axis (12 steps), measure while held, let go, measure at rest */
async function pull(k, h, d) {
  const a = await handleAt(k, h),
    W = await k.ev(`innerWidth`),
    H = await k.ev(`innerHeight`),
    clamp = (v, n) => Math.max(2, Math.min(n - 2, v)),
    x1 = h.axis === "x" ? clamp(a.x + d, W) : a.x,
    y1 = h.axis === "y" ? clamp(a.y + d, H) : a.y;
  await ev(k, "mouseMoved", a.x, a.y, 0);
  await ev(k, "mousePressed", a.x, a.y);
  for (let i = 1; i <= 12; i++) await ev(k, "mouseMoved", a.x + ((x1 - a.x) * i) / 12, a.y + ((y1 - a.y) * i) / 12);
  await k.sleep(250);
  const held = await measure(k),
    heldAt = await handleAt(k, h);
  await ev(k, "mouseReleased", x1, y1);
  await ev(k, "mouseMoved", 4, 4, 0);
  await k.sleep(1200);
  return { start: a, held, heldAt, after: await measure(k), stuck: await heldClasses(k) };
}

const SIDES = ["left", "right", "top", "bottom"];
const AXIS_SIDES = { x: ["left", "right"], y: ["top", "bottom"] };
/** the parts on the grabbed edge, each with its side there: beside the edge along it, and its nearest side on the
   edge's axis within reach of the line (a handle can sit a little off its edge: Vertical's shared edge is drawn on
   either side of the title) */
const touching = (m, axis, a) => {
  const out = {};
  for (const n of Object.keys(PARTS)) {
    const p = m[n];
    if (!p) continue;
    const [lo, hi] = axis === "x" ? [p.top, p.bottom] : [p.left, p.right],
      along = axis === "x" ? a.y : a.x;
    if (along < lo - 2 || along > hi + 2) continue;
    const [s0, s1] = AXIS_SIDES[axis],
      side = Math.abs(p[s0] - a.line) <= Math.abs(p[s1] - a.line) ? s0 : s1;
    if (Math.abs(p[side] - a.line) <= Math.max(a.thick / 2 + 6, 40)) out[n] = side;
  }
  return out;
};
const overlap = (a, b) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
const round = m => JSON.parse(JSON.stringify(m, (_, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v)));

/** one case: a layout × a page */
function caseOf(dock, page, ar) {
  const fn = async (k, t) => {
    await k.ev(`(setDock(${JSON.stringify(dock)}),1)`);
    if (ar) {
      await k.job("[fill:446688] case", { ar, steps: 2 });
      await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
    } else await k.ev(`(showView(${JSON.stringify(page)}),1)`);
    await k.mouse(4, 4);
    await k.sleep(1400);
    const handles = await findHandles(k);
    t.ok(handles.length >= 3, `${dock} · ${page}${ar ? " " + ar : ""}: its edges`, {
      edges: handles.map(h => h.label),
      at: round(await measure(k)),
    });
    /* every handle lies on its pane's side: it doesn't reach past the pane along its edge (a panel's side handle ran the
       room's full height under a shortened panel, 2026-11-03) */
    const reachOf = () =>
      k.ev(`(()=>{const hs=document.querySelectorAll(${JSON.stringify(HANDLES)}),out=[];
      const panes=["#left","#plate"].map(s=>document.querySelector(s)).filter(Boolean).map(e=>e.getBoundingClientRect());
      for(const h of ${JSON.stringify(handles)}){const r=hs[h.i].getBoundingClientRect(),x=h.axis==="x",
          ov=p=>x?Math.min(r.bottom,p.bottom)-Math.max(r.top,p.top):Math.min(r.right,p.right)-Math.max(r.left,p.left);
        const line=x?r.left+r.width/2:r.top+r.height/2,
          p=panes.filter(p=>Math.abs((x?[p.left,p.right]:[p.top,p.bottom]).reduce((a,b)=>Math.abs(a-line)<Math.abs(b-line)?a:b)-line)<=40)
            .sort((a,b)=>ov(b)-ov(a))[0]; /* its pane: the one it lies along most (the widest misread a picture's top
            as the box's when the two tops were within 40 px) */
        if(!p){out.push(h.label+": on no pane's side");continue}
        const over=x?Math.max(p.top-r.top,r.bottom-p.bottom):Math.max(p.left-r.left,r.right-p.right);
        if(over>24)out.push(h.label+": "+Math.round(over)+" px past its pane")}return out})()`);
    const reachCheck = async when => {
      const reach = await reachOf();
      t.ok(!reach.length, `${when}: every edge's handle lies on its pane's side`, reach);
    };
    await reachCheck("at rest");
    for (const h of handles)
      for (const dir of [1, -1]) {
        const name = `${h.label} ${h.axis === "x" ? (dir > 0 ? "→" : "←") : dir > 0 ? "↓" : "↑"}`;
        /* to its limit. Side by side the group re-centres on release, which can free room again (the limit is the
           room's end from where the pin was): pull again until the size at rest stops changing, and say how many */
        const S0 = await measure(k),
          size = m => Object.keys(PARTS).map(n => (m[n] ? [m[n].right - m[n].left, m[n].bottom - m[n].top] : [0, 0]));
        let pulls = 0;
        for (let prev = size(S0); pulls < 6;) {
          await pull(k, h, dir * FAR);
          pulls++;
          const now = size(await measure(k));
          if (now.flat().every((v, i) => Math.abs(v - prev.flat()[i]) <= STILL)) break;
          prev = now;
        }
        if (pulls > 2) t.note(`${h.label} ${dir > 0 ? "+" : "−"}: ${pulls - 1} pulls to reach its limit at rest`);
        const S1 = await measure(k),
          r = await pull(k, h, dir * FAR), // past it again, from there
          S2 = r.after,
          on = touching(S1, h.axis, r.start),
          moving = Object.keys(on),
          /* the give: how far the grabbed edge moved — the panes' sides on it, not the handle (some handles don't ride
             their edge while held) */
          give = Math.max(
            0,
            ...moving.filter(n => n !== "bar" && r.held[n]).map(n => Math.abs(r.held[n][on[n]] - S1[n][on[n]])),
          ),
          /* the box's height is its text's (DD-14): a change of its width reflows it, so its height may change */
          reflow =
            h.axis === "x" &&
            !!S1.box &&
            !!r.held.box &&
            Math.abs(r.held.box.right - r.held.box.left - (S1.box.right - S1.box.left)) > STILL,
          moved = [],
          pinned = [],
          back = [],
          crossed = [];
        for (const n of Object.keys(PARTS)) {
          if (!S1[n] || !r.held[n] || !S2[n]) continue;
          for (const s of SIDES) {
            const dh = Math.abs(r.held[n][s] - S1[n][s]);
            if (dh > GIVE && !(reflow && n === "box" && (s === "top" || s === "bottom")))
              moved.push(`${n}.${s} ${dh.toFixed(1)}`);
            const db = Math.abs(S2[n][s] - S1[n][s]);
            if (db > STILL) back.push(`${n}.${s} ${db.toFixed(1)}`);
          }
          /* the pin: a grabbed pane's side on the drag's axis that is NOT on the grabbed edge — on a centred axis the
             mirror of the give (DD-6): side by side every edge but the shared one, Vertical across */
          const shared = !!on.box && (!!on.plate || !!on.pic),
            centred = !shared && (dock === "below" ? h.axis === "x" : true),
            allow = centred ? give + 2 : STILL; // the mirror, + a frame's rounding (as GIVE)
          if (moving.includes(n) && n !== "bar")
            for (const s of AXIS_SIDES[h.axis]) {
              if (s === on[n]) continue;
              const dp = Math.abs(r.held[n][s] - S1[n][s]);
              if (dp > allow) pinned.push(`${n}.${s} ${dp.toFixed(1)}`);
            }
          const p = r.held[n];
          if (p.left < -1 || p.top < -1 || p.right > S1.W + 1 || p.bottom > S1.H + 1)
            crossed.push(`${n} off the window`);
        }
        const names = Object.keys(PARTS).filter(n => n !== "pic" && S1[n] && r.held[n]);
        for (let i = 0; i < names.length; i++)
          for (let j = i + 1; j < names.length; j++) {
            const [a, b] = [names[i], names[j]];
            if (!overlap(S1[a], S1[b]) && overlap(r.held[a], r.held[b])) crossed.push(`${a} over ${b}`);
          }
        const info = {
          give: +give.toFixed(1),
          pulls,
          on,
          reflow,
          edge: round(r.start),
          S1: round(S1),
          held: round(r.held),
        };
        /* the give-way order (DEVLOG DD-2026-11-03-1): one drag reaches the limit — empty room first, then the other
           panes — so a second drag from rest finds nothing more (with a pin and a centred anchor it took 5+) */
        t.ok(pulls <= 2, `${name}: one drag reaches its limit`, { pulls });
        t.ok(give >= 1 && give <= GIVE, `${name}: past its limit, a little give (1–${GIVE} px)`, info);
        t.ok(!pinned.length, `${name}: …its other side holds (the pin)`, { pinned, ...info });
        t.ok(!moved.length, `${name}: …nothing slides (no part moves more than the give)`, { moved, ...info });
        t.ok(!back.length, `${name}: let go, back where it was`, {
          back,
          S0: round(S0),
          S1: round(S1),
          S2: round(S2),
        });
        t.ok(!crossed.length, `${name}: held, nothing runs over another part or off the window`, { crossed, ...info });
        t.ok(r.stuck === "-", `${name}: nothing held after release`, r.stuck);
        const lay = await layReachable(k);
        t.ok(lay === "ok", `${name}: at rest, the Layout button can be pressed`, lay);
        if (dir < 0) await reachCheck(`after ${h.label}`);
      }
  };
  fn.opts = { width: ar === "21:9" && dock === "below" ? 1440 : 1760, height: 1080, step: 0.05, limitMin: 6 };
  return fn;
}

/* the table: each layout × a picture bound by its height (3:4), one bound by its width (21:9), a panel (the Queue) */
export const casesLeftTall = caseOf("left", "generating", "3:4");
export const casesLeftWide = caseOf("left", "generating", "21:9");
export const casesLeftPanel = caseOf("left", "queue");
export const casesRightTall = caseOf("right", "generating", "3:4");
export const casesRightWide = caseOf("right", "generating", "21:9");
export const casesRightPanel = caseOf("right", "queue");
export const casesVerticalTall = caseOf("below", "generating", "3:4");
export const casesVerticalWide = caseOf("below", "generating", "21:9");
export const casesVerticalPanel = caseOf("below", "queue");
