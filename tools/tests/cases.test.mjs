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
// And each edge's double-click (DEVLOG DD-2026-11-03-14, C5): it puts its pane at its DD-5 size — a picture edge the
// picture at its largest (side by side the box squeezed toward its least), a box edge the box's default, a panel edge
// that panel's default, the shared edge both — in ONE motion: no frame takes most of a change (no snap).
// The parts: the tab bar, the prompt box, the page's plate, the picture.

const RUBBER = 20, // layoutmath.js RUBBER: the rubber band's reach
  GIVE = RUBBER + 2, // + a frame's rounding
  STILL = 1.5,
  FAR = 1600; // past any limit in these windows (the pointer is kept inside the window)
const HANDLES = ".pedge,.sedge,.vedge,.hedge,.vpedge,.phedge"; // outlines.js HANDLES
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

/** the DD-5 size an edge's double-click keeps (DD-2026-11-03-5), as the stored sizes say it: what kind of edge a handle
 * is, by its label — the box's sides, its height edges (its text's height again: C6), the shared edge (side by side the
 * divider's two bands; in Vertical the page's bottom and the box's top — B19b), the page's own */
const dd5 = (label, dock, axis) => {
  const vert = dock === "below";
  if (/\.pedge\.po|\.sedge\./.test(label)) return "box.w";
  if (/#vedge/.test(label)) return "box.h";
  if (/\.vedge\.t/.test(label)) return vert ? "shared" : "box.h";
  if (/\.pedge\.(pi|ri)/.test(label) || (vert && /\.hedge\.b|\.phedge\.b/.test(label))) return "shared";
  return axis === "x" ? "page.x" : "page.y";
};
/** double-click handle h, sampling every part's rect each frame from just before it (in one evaluation: the harness
 * runs one at a time) — and what the stored sizes say after */
const doubleClick = (k, h) =>
  k.ev(`new Promise(res=>{const parts=${JSON.stringify(PARTS)},m=()=>{const o={};for(const[n,s]of Object.entries(parts)){
      const e=document.querySelector(s);if(!e)continue;const r=e.getBoundingClientRect();if(r.width<1||r.height<1)continue;
      o[n]=[r.left,r.top,r.right,r.bottom]}return o};
    const e=document.querySelectorAll(${JSON.stringify(HANDLES)})[${h.i}],frames=[m()],t0=performance.now();
    e.dispatchEvent(new MouseEvent("dblclick",{bubbles:true}));
    (function s(){requestAnimationFrame(()=>setTimeout(()=>{frames.push(m());if(performance.now()-t0<1300)s();else{
      const o=document.querySelector(".app.stacked")?"vert":"side",b=paneSize("box",o),p=paneSize(pageId(),o);
      res({frames,box:{w:b.w,h:b.h},page:{w:p.w,h:p.h,s:p.s},pic:pageId()==="generating"||pageId()==="gallery",
        squeezeW:lay.pass&&lay.pass.squeezeW!=null?Math.round(lay.pass.squeezeW):null})}},0))})()})`);

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
    /* how much each edge changed its panes' sizes, either way (C6: an edge that changes nothing is dead — the box's
       height edges side by side only gave a little and snapped back, and every check below passed them) */
    /** @type {Record<string, number>} */
    const changed = {};
    for (const h of handles) {
      /* each edge from the layout you meet — the defaults (Reset): after the edge before it, a pane could rest at its
         limit, and an edge looked dead only because of the order (C6: Vertical's panel top after its bottom) */
      await k.ev(`(document.querySelector('[data-lay="reset"]').click(),1)`);
      await k.mouse(4, 4);
      await k.sleep(1400);
      /* Vertical's shared edge with empty room under the box (C6, DEVLOG DD-2026-11-09-19): a short pull down pushes the
         box into the room at its own size — it doesn't trade first */
      /* side by side, the divider with empty room beside the box (C6b, DEVLOG DD-2026-11-10-2): a short pull toward the
         box pushes it at its own width */
      if (dock !== "below" && /\.pedge\.(pi|ri)/.test(h.label)) {
        const m0 = await measure(k),
          d = dock === "left" ? -40 : 40;
        if (m0.box && (dock === "left" ? m0.box.left - 20 : m0.W - 20 - m0.box.right) > 120) {
          const m1 = (await pull(k, h, d)).after;
          /* judged only if the page grew (a picture at its largest takes nothing more: the edge doesn't move) */
          if (m1.plate && m1.plate.right - m1.plate.left - (m0.plate.right - m0.plate.left) > 20)
            t.ok(
              Math.abs(m1.box.right - m1.box.left - (m0.box.right - m0.box.left)) <= 2 &&
                Math.abs(m1.box.left - m0.box.left - d) <= 4,
              `${h.label}: with empty room beside the box, a pull toward it pushes it at its own width (the room first)`,
              { before: round(m0.box), after: round(m1.box) },
            );
        }
      }
      if (dock === "below" && h.label.includes(".vedge.t")) {
        const m0 = await measure(k);
        if (m0.box && m0.H - 20 - m0.box.bottom > 120) {
          const r = await pull(k, h, 40),
            m1 = r.after;
          /* judged only if the page grew (a picture bound by its width can't: the edge doesn't move) */
          if (m1.plate && m1.plate.bottom - m0.plate.bottom > 20)
            t.ok(
              Math.abs(m1.box.bottom - m1.box.top - (m0.box.bottom - m0.box.top)) <= 2 &&
                Math.abs(m1.box.top - m0.box.top - 40) <= 3,
              `${h.label}: with empty room under the box, a pull down moves it at its own size (the room first)`,
              { before: round(m0.box), after: round(m1.box) },
            );
        }
      }
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
        const S1 = await measure(k);
        changed[h.label] = Math.max(
          changed[h.label] ?? 0,
          ...size(S1)
            .flat()
            .map((v, i) => Math.abs(v - size(S0).flat()[i])),
        );
        const r = await pull(k, h, dir * FAR), // past it again, from there
          S2 = r.after,
          /* Vertical: the box's top band and the page's bottom band are the SHARED edge's (B19b) — both panes, whatever the
             band touches (the name row lies between the box's band and the page) */
          on =
            dock === "below" && /\.vedge\.t|\.hedge\.b|\.phedge\.b/.test(h.label)
              ? { box: "top", plate: "bottom", ...(S1.pic ? { pic: "bottom" } : {}) }
              : touching(S1, h.axis, r.start),
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
            /* side by side every edge is on a centred axis — the shared edge too since C6b (the push keeps the group
               centred, its far side mirrors); Vertical's shared edge is anchored at the top */
            centred = dock === "below" ? !shared && h.axis === "x" : true,
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
      /* (Vertical's box bottom at the defaults: the page takes all the room the box's least leaves — the box is at its
         least with no empty room under it, so its outer edge has nothing to give by the rule, DD-2026-11-07-1) */
      if (dock === "below" && h.label.startsWith("#vedge") && changed[h.label] <= GIVE)
        t.note(`${h.label}: still at the defaults — the page takes the room, the box is at its least`);
      else
        t.ok(
          changed[h.label] > GIVE,
          `${h.label}: it changes its pane's size, one way or the other (not a dead edge)`,
          {
            most: Math.round(changed[h.label]),
          },
        );
    }
    /* C5 (DD-2026-11-03-14): every edge's double-click — its DD-5 size, in one motion */
    for (const h of handles) {
      const kind = dd5(h.label, dock, h.axis),
        d = await doubleClick(k, h),
        name = `${h.label} double-click`;
      const p = d.page,
        want = {
          "box.w": d.box.w == null,
          "box.h": d.box.h == null,
          "shared": p.w == null && p.h == null && !p.s && (dock === "below" ? d.box.h == null : d.box.w == null),
          "page.x": d.pic ? p.w == null && p.h == null && !p.s : p.w == null,
          "page.y": d.pic ? p.w == null && p.h == null && !p.s : p.h == null,
        };
      if (kind) t.ok(want[kind], `${name}: its pane at its DD-5 size (${kind})`, { kind, box: d.box, page: p });
      if (kind && kind.startsWith("page") && d.pic && dock !== "below")
        t.ok(
          d.squeezeW == null || Math.abs((d.box.w ?? 0) - d.squeezeW) <= 1 || d.box.w == null,
          `${name}: …the box squeezed toward its least (the picture first)`,
          { box: d.box.w, squeezeW: d.squeezeW },
        );
      /* one motion: for every side of every part that moves more than 20 px, no frame takes most of it */
      const f = d.frames,
        snaps = [];
      for (const n of Object.keys(PARTS))
        for (let i = 0; i < 4; i++) {
          const v = f.filter(x => x[n]).map(x => x[n][i]);
          if (v.length < 2) continue;
          const total = Math.abs(v[v.length - 1] - v[0]),
            step = Math.max(...v.slice(1).map((x, j) => Math.abs(x - v[j])));
          if (total > 20 && step > 0.6 * total)
            snaps.push(`${n}.${["left", "top", "right", "bottom"][i]} ${Math.round(step)} of ${Math.round(total)}`);
        }
      t.motion(!snaps.length, `${name}: in one motion (no snap)`, { snaps, frames: f.length });
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
