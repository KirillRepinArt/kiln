// One home per strip (CLAUDE.md; ROADMAP v0.7c B19 — the user's note, 2026-11-06: the prompt box's buttons sit under the
// resize handles). A resize handle's strip of screen belongs to the handle alone: no control (a button, a field, a pill, a
// link) lies under it, so a press never lands on a handle when it means a control — or the other way round.
const HANDLES = ".pedge,.sedge,.vedge,.hsplit,.hedge,.vpedge,.phedge"; // outlines.js HANDLES
const CONTROL = "button, input, select, textarea, a, [role=button], .pill, .chip, [contenteditable=true], .cm-content";

/** every visible handle, sampled along its length: what lies under it */
const underHandles = k =>
  k.ev(`(()=>{const out=[];for(const h of document.querySelectorAll(${JSON.stringify(HANDLES)})){const r=h.getBoundingClientRect(),c=getComputedStyle(h);
    if(r.width<1||r.height<1||c.display==="none"||c.visibility==="hidden"||c.pointerEvents==="none")continue;
    const along=r.height>r.width,n=24,name=(h.id?"#"+h.id:"")+"."+[...h.classList].join(".");
    for(let i=1;i<n;i++)for(const across of [0.25,0.5,0.75]){const x=along?r.left+r.width*across:r.left+r.width*i/n,y=along?r.top+r.height*i/n:r.top+r.height*across;
      if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;
      const st=document.elementsFromPoint(x,y),top=st[0];if(!top||!(top===h||h.contains(top)))continue; /* only where the handle itself takes the press */
      const under=st.find(e=>e!==h&&!h.contains(e)&&e.closest(${JSON.stringify(CONTROL)}));
      if(under){const u=under.closest(${JSON.stringify(CONTROL)}),s=getComputedStyle(u);if(s.visibility==="hidden"||+s.opacity===0)continue;
        out.push(name+" over "+(u.id?"#"+u.id:u.tagName.toLowerCase()+"."+[...u.classList].join(".")))}}}
    return [...new Set(out)]})()`);

/** every handle's band against its pane: how far it reaches in, and out (B19: 1 px in, out to the outline) */
const bands = k =>
  k.ev(`(()=>{const out=[],O=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--outline-out"));
    const paneOf=h=>h.matches(".pedge.po,.pedge.pi,.sedge,.vedge")?$("left"):h.matches(".hsplit")?null:$("plate");
    for(const h of document.querySelectorAll(${JSON.stringify(HANDLES)})){const r=h.getBoundingClientRect(),c=getComputedStyle(h);
      if(r.width<1||r.height<1||c.display==="none"||c.visibility==="hidden"||c.pointerEvents==="none")continue;
      const pane=paneOf(h);if(!pane)continue;const p=pane.getBoundingClientRect(),name=(h.id?"#"+h.id:"")+"."+[...h.classList].join(".");
      const across=r.height>r.width?[[r.left,r.right],[p.left,p.right]]:[[r.top,r.bottom],[p.top,p.bottom]];
      const [[a,b],[lo,hi]]=across,side=Math.abs((a+b)/2-lo)<Math.abs((a+b)/2-hi)?"lo":"hi",
        inside=side==="lo"?b-lo:hi-a,outside=side==="lo"?lo-a:b-hi;
      out.push([name,Math.round(inside*10)/10,Math.round(outside*10)/10,O])}
    return out})()`);

/** one case: a layout × a page */
function caseOf(dock, view) {
  const fn = async (k, t) => {
    if (view === "gen") {
      await k.job("[fill:446688] a", { ar: "3:4", steps: 1 });
      await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
    }
    await k.ev(`(setDock(${JSON.stringify(dock)}),showView(${JSON.stringify(view)}),1)`);
    await k.mouse(4, 4);
    await k.sleep(1500);
    const found = await underHandles(k);
    t.ok(!found.length, `${dock} · ${view}: no control under any resize handle (one home per strip)`, found);
    /* one rule for every pane's band: 1 px inside its edge, out to its outline */
    const off = (await bands(k)).filter(([, i, o, O]) => Math.abs(i - 1) > 1 || Math.abs(o - O) > 1);
    t.ok(!off.length, `${dock} · ${view}: every resize band runs from 1 px inside its edge out to its outline`, off);
  };
  fn.opts = { width: 1600, height: 950 };
  return fn;
}
export const stripsLeftPicture = caseOf("left", "gen");
export const stripsRightPicture = caseOf("right", "gen");
export const stripsVerticalPicture = caseOf("below", "gen");
export const stripsLeftQueue = caseOf("left", "queue");
export const stripsVerticalQueue = caseOf("below", "queue");
