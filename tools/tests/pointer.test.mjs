/* The pointer map (ux-review/14-ownership-reread.md, Step 1.1 — v0.7c's re-read): in each layout and state, a grid of
   points across the window (every 8 px) — what takes the pointer there, its cursor, what lies under it. It fails on:
   - an INVISIBLE box taking the pointer over a visible control (a layout box wider than what it draws, a faded thing
     with its pointer left on — the tab bar's container over the box's name row, 2026-11-01);
   - two resize handles claiming one point (the picture's bottom edge and Vertical's split line, L4);
   - a point of the box's grip zone that doesn't show the grab hand (L3: the grip is one zone — its cursor too).
   Known cases in ALLOW, each with its ownership-map id; the baseline only shrinks. */

const HANDLES = ".pedge,.sedge,.vedge,.hedge,.vpedge,.phedge"; // outlines.js HANDLES
const CONTROL = "button, input, select, textarea, a, [role=button], .pill, .chip, [contenteditable=true], .cm-content";
/* the box's grip (cardlayout.js L1): its group, less what keeps its own pointer */
const GROUP = "#pgrip,#left,#ltitle,#chips";
const NO = "input,textarea,button,a,select,.chip,.pwrapT,.pop,.cwi," + HANDLES;

/** known findings: their key → the map's id and why it's there */
const ALLOW = /** @type {Record<string, string>} */ ({
  /* L5 (the re-read, 2026-11-10): at the picture's outer corners its top / bottom band and its outer band overlap (each runs
     out to the outline, B19) — the corner goes to whichever is on top */
  "two handles: div.hedge.t + div.pedge.ro": "L5",
  "two handles: div.hedge.b + div.pedge.ro": "L5",
});

/** one sweep of the window: findings by key, each with how many points and one example point */
const sweep = (k, step = 8) =>
  k.ev(`(()=>{const H=${JSON.stringify(HANDLES)},C=${JSON.stringify(CONTROL)},G=${JSON.stringify(GROUP)},N=${JSON.stringify(NO)};
    const cs=new Map(),st=(e,p)=>{const k=p?e:null;if(!p){let s=cs.get(e);if(!s)cs.set(e,s=getComputedStyle(e));return s}return getComputedStyle(e,p)};
    const alpha=c=>{const m=/rgba?\\(([^)]+)\\)/.exec(c||"");if(!m)return c&&c!=="transparent"?1:0;const v=m[1].split(/[ ,/]+/).filter(Boolean);return v.length>3?parseFloat(v[3]):1};
    const paints=s=>s&&(alpha(s.backgroundColor)>0.02||s.backgroundImage!=="none"||(parseFloat(s.borderTopWidth)>0&&alpha(s.borderTopColor)>0.02)||s.boxShadow!=="none"||(s.backdropFilter&&s.backdropFilter!=="none"));
    const op=new Map(),opac=e=>{if(!e)return 1;if(op.has(e))return op.get(e);const v=+st(e).opacity*opac(e.parentElement);op.set(e,v);return v};
    const drawn=e=>{const s=st(e);if(s.visibility==="hidden"||opac(e)<0.05)return false;if(paints(s))return true;
      for(const p of ["::before","::after"]){const q=st(e,p);if(q.content!=="none"&&q.display!=="none"&&paints(q))return true}
      if(/^(IMG|CANVAS|VIDEO|INPUT|TEXTAREA|SELECT|svg|path|circle|rect|use)$/i.test(e.tagName))return true;
      for(const n of e.childNodes)if(n.nodeType===3&&n.textContent.trim())return true;return false};
    const name=e=>e.id?"#"+e.id:e.tagName.toLowerCase()+([...e.classList].length?"."+[...e.classList].join("."):"");
    const live=e=>{const s=st(e);return s.pointerEvents!=="none"&&s.visibility!=="hidden"};
    const out={},add=(key,x,y)=>{const o=out[key]||(out[key]={n:0,at:[x,y]});o.n++};
    for(let y=4;y<innerHeight;y+=${step})for(let x=4;x<innerWidth;x+=${step}){
      const stack=document.elementsFromPoint(x,y),top=stack[0];if(!top||top===document.documentElement||top===document.body)continue;
      /* two handles at one point */
      const hs=stack.filter(e=>e.matches(H)&&live(e));
      if(hs.length>1)add("two handles: "+hs.map(name).sort().join(" + "),x,y);
      /* the grip's cursor */
      if(top.closest(G)&&!top.closest(N)&&!/grab/.test(st(top).cursor))add("grip without the grab hand: "+name(top)+" ("+st(top).cursor+")",x,y);
      /* an invisible box over a visible control */
      if(top.matches(H)||top.closest(C))continue;
      if(drawn(top))continue;
      const ctl=stack.slice(1).map(e=>e.closest(C)).find(c=>c&&!c.contains(top)&&!top.contains(c)&&live(c)&&opac(c)>0.05&&st(c).visibility!=="hidden");
      if(ctl)add("invisible "+name(top)+" over "+name(ctl),x,y)}
    return out})()`);

/** one case: a layout × its states */
function caseOf(dock) {
  const fn = async (k, t) => {
    await k.job("[fill:446688] a", { ar: "3:4", steps: 1 });
    await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
    const states = [
      ["Generating, a picture", `showView("gen")`],
      ["the Queue", `showView("queue")`],
      ["LoRAs", `showView("loras")`],
      ["PNG Info", `showView("png")`],
      ["a menu open (Ratio)", `(showView("gen"),$("pAR").click())`],
    ];
    const all = /** @type {Record<string, { n: number, at: number[], where: string[] }>} */ ({});
    await k.ev(`(setDock(${JSON.stringify(dock)}),1)`);
    await k.sleep(1200);
    for (const [label, act] of states) {
      await k.ev(`(${act},1)`);
      await k.mouse(2, 2);
      await k.sleep(1400);
      const f = await sweep(k);
      for (const [key, v] of Object.entries(f)) {
        const a = (all[key] ||= { n: 0, at: v.at, where: [] });
        a.n += v.n;
        a.where.push(label);
      }
      await k.ev(`(document.querySelectorAll(".pop.show").forEach(p=>p.classList.remove("show")),1)`);
    }
    const unknown = Object.keys(all).filter(key => !(key in ALLOW));
    for (const key of Object.keys(all)) if (key in ALLOW) t.note(`baseline (${ALLOW[key]}): ${key}`);
    t.ok(
      !unknown.length,
      `${dock}: no invisible box over a control, no two handles at one point, the grip shows its hand`,
      Object.fromEntries(unknown.map(key => [key, all[key]])),
    );
  };
  fn.opts = { width: 1600, height: 950, limitMin: 6 };
  return fn;
}
export const pointerLeft = caseOf("left");
export const pointerRight = caseOf("right");
export const pointerVertical = caseOf("below");

/* the sweep catches each class: three planted faults, each must be found (a detector that finds nothing proves nothing) */
export async function pointerSelfCheck(k, t) {
  await k.mouse(2, 2);
  await k.sleep(1200);
  await k.ev(`(()=>{const p=$("play").getBoundingClientRect(),d=document.createElement("div");d.id="zzGhost";
    Object.assign(d.style,{position:"fixed",left:p.left-20+"px",top:p.top-20+"px",width:p.width+40+"px",height:p.height+40+"px",zIndex:9999});
    document.body.appendChild(d);
    const h=document.querySelector(".pedge.ro"),c=h.cloneNode();c.id="zzTwin";h.parentElement.appendChild(c);
    const s=document.createElement("style");s.id="zzCursor";s.textContent=".controls{cursor:default!important}";document.head.appendChild(s);return 1})()`);
  await k.sleep(300);
  const keys = Object.keys(await sweep(k));
  t.ok(
    keys.some(x => /^invisible #zzGhost over /.test(x)),
    "finds an invisible box over a control",
    keys,
  );
  t.ok(
    keys.some(x => /^two handles: .*#zzTwin/.test(x)),
    "finds two handles at one point",
    keys,
  );
  t.ok(
    keys.some(x => /^grip without the grab hand: div\.controls/.test(x)),
    "finds the grip without its hand",
    keys,
  );
}
