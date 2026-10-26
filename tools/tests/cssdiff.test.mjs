// CSS refactor check: does a stylesheet rewrite change anything you can see?
//
//   KILN_CSS_REF=path/to/old.css node tools/tests/run.mjs cssdiff
//
// The page gets today's styles (app/styles/*.css in index.html's order, as one <style>). In a series of states (empty, rendering, a finished picture, the
// Gallery, each tab, dialogs, pop-ups, privacy, the missing-file card…, under every theme, both materials and every
// layout) it reads the computed style of every element and pseudo-element, swaps the <style> for the reference CSS,
// reads them again — in the same instant, on the same DOM — and lists every difference. :hover / :focus / :active
// are forced (DevTools) on each element a rule hovers, one at a time. Report: tools/tests/out/cssdiff.txt.
// Without KILN_CSS_REF the test is skipped.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)),
  OUT = join(HERE, "out");
const REF = process.env.KILN_CSS_REF;

/* the page side: snapshots and the comparison (one synchronous call, so no frame runs between the two reads) */
const LIB = String.raw`(()=>{
 const links=[...document.querySelectorAll('link[rel="stylesheet"][href*="app/styles/"]')];let st=document.querySelector("style[data-kiln]");if(!st){st=document.createElement("style");st.dataset.kiln="1";st.textContent=window.__new;links.at(-1).after(st);links.forEach(l=>l.disabled=true)}
 const NEW=st.textContent;
 const off=document.createElement("style");off.textContent="*,*::before,*::after,*::placeholder{transition:none!important}";
 const PS=["","::before","::after","::placeholder"],kebab=p=>p.replace(/[A-Z]/g,c=>"-"+c.toLowerCase());
 const SKIP=new Set(["offset","easing","composite","computedOffset"]);
 function animated(){const m=new Map();for(const a of document.getAnimations()){const e=a.effect;if(!e||!e.target)continue;
   const key=e.target,ps=e.pseudoElement||"";let set=m.get(key);if(!set)m.set(key,set=new Set());
   if(a.transitionProperty){set.add(ps+"|"+a.transitionProperty);continue}
   try{for(const kf of e.getKeyframes())for(const p in kf)if(!SKIP.has(p))set.add(ps+"|"+kebab(p))}catch(_){}}
  return m}
 function path(el){const p=[];for(let e=el;e&&e.nodeType===1&&p.length<5;e=e.parentElement){let s=e.tagName.toLowerCase();if(e.id)s+="#"+e.id;
   else if(e.classList.length)s+="."+[...e.classList].slice(0,3).join(".");p.unshift(s);if(e.id)break}return p.join(" > ")}
 function snap(els,trans){const out=[];out.vis=els.map(el=>el.getClientRects().length>0);
  for(const el of els)for(const ps of PS){if(ps==="::placeholder"&&!/^(INPUT|TEXTAREA)$/.test(el.tagName)){out.push(null);continue}
   const cs=getComputedStyle(el,ps||null);if((ps==="::before"||ps==="::after")&&(cs.content==="none"||cs.display==="none")){out.push("none");continue}   /* a pseudo-element that isn't drawn */
   const o={};for(let i=0;i<cs.length;i++){const p=cs[i];if(p.startsWith("--"))continue;if(p.startsWith("transition")!==trans)continue;o[p]=cs.getPropertyValue(p)}
   out.push(o)}return out}
 window.__cssdiff=function(rootSel){
  const root=rootSel?document.querySelector(rootSel):null;
  const els=root?[root,...root.querySelectorAll("*")]:[document.documentElement,document.body,...document.body.querySelectorAll("*")];
  const A0=animated();
  document.head.append(off);
  const n1=snap(els,false);st.textContent=window.__ref;const o1=snap(els,false);st.textContent=NEW;getComputedStyle(document.body).color;
  off.remove();
  const n2=snap(els,true);st.textContent=window.__ref;const o2=snap(els,true);
  const A1=animated();st.textContent=NEW;
  document.head.append(off);getComputedStyle(document.body).color;off.remove();   /* cancel whatever the swaps started */
  const diffs=[];let n=0;
  for(let i=0;i<els.length;i++){const el=els[i],an=new Set([...(A0.get(el)||[]),...(A1.get(el)||[])]);
   if(n1.vis[i]!==o1.vis[i]){diffs.push({el:path(el),ps:"",prop:"(drawn)",now:n1.vis[i]?"yes":"no",ref:o1.vis[i]?"yes":"no"});continue}
   if(!n1.vis[i])continue;   /* not drawn in either: nothing to see */
   for(let k=0;k<PS.length;k++){const ix=i*PS.length+k,ps=PS[k];
    for(const [a,b] of [[n1[ix],o1[ix]],[n2[ix],o2[ix]]]){if(a===null&&b===null)continue;
     if(a==="none"||b==="none"){if(a!==b)diffs.push({el:path(el),ps,prop:"(exists)",now:a==="none"?"no":"yes",ref:b==="none"?"no":"yes"});continue}
     for(const p in a){n++;if(an.has(ps+"|"+p)||an.has(ps+"|all"))continue;if(a[p]!==b[p])diffs.push({el:path(el),ps,prop:p,now:a[p],ref:b[p]})}}}}
  return {diffs,n,els:els.length}};
 /* the elements a rule hovers / focuses / presses (the selector up to the pseudo-class), visible now */
 window.__cdTargets=function(){const css=NEW+"\n"+window.__ref,out=[],seen=new Set();
  const sels=[];css.replace(/\/\*[\s\S]*?\*\//g,"").replace(/([^{}@]+)\{/g,(m,s)=>{sels.push(s);return m});
  const split=s=>{const r=[];let d=0,c="";for(const ch of s){if(ch==="("||ch==="[")d++;if(ch===")"||ch==="]")d--;if(ch===","&&!d){r.push(c);c=""}else c+=ch}r.push(c);return r};
  for(const g of sels)for(let s of split(g)){s=s.trim();const m=s.match(/:(hover|focus-within|focus-visible|focus|active)(?![\w-])/);if(!m)continue;
   const sub=s.slice(0,m.index).trim();if(!sub||/::/.test(sub))continue;let list;try{list=[...document.querySelectorAll(sub)]}catch(e){continue}
   let c=0;for(const el of list){if(!el.getClientRects().length)continue;const key=m[1]+"|"+sub+"|"+c;if(seen.has(key))continue;seen.add(key);
    out.push({sub,cls:m[1],idx:list.indexOf(el)});if(++c>=2)break}}
  return out};
 return 1})()`;

async function forceOn(k, sub, idx, cls) {
  // mark the element and its ancestors, find their DevTools node ids, force the pseudo-class on them
  const n = await k.ev(
    `(()=>{const el=[...document.querySelectorAll(${JSON.stringify(sub)})][${idx}];if(!el)return 0;let i=0;for(let e=el;e&&e.nodeType===1;e=e.parentElement)e.setAttribute("data-cdh",i++);return i})()`,
  );
  if (!n) return null;
  const doc = await k.send("DOM.getDocument", { depth: 0 });
  const q = await k.send("DOM.querySelectorAll", { nodeId: doc.result.root.nodeId, selector: "[data-cdh]" });
  const ids = q.result?.nodeIds || [];
  const ord = await k.ev(`[...document.querySelectorAll("[data-cdh]")].map(e=>+e.getAttribute("data-cdh"))`);
  for (let i = 0; i < ids.length; i++) {
    const self = ord[i] === 0,
      pcs =
        cls === "hover"
          ? ["hover"]
          : cls === "active"
            ? self
              ? ["active", "hover"]
              : ["hover"]
            : self
              ? [cls === "focus-within" ? "focus-within" : "focus", "focus-visible", "focus-within"]
              : ["focus-within"];
    await k.send("CSS.forcePseudoState", { nodeId: ids[i], forcedPseudoClasses: pcs });
  }
  await k.ev(`document.querySelectorAll("[data-cdh]").forEach(e=>e.removeAttribute("data-cdh")),1`);
  return ids;
}
async function forceOff(k, ids) {
  for (const id of ids || []) await k.send("CSS.forcePseudoState", { nodeId: id, forcedPseudoClasses: [] });
}

/* today's styles, one text: the files index.html links from app/styles/, in its order */
function todaysCss() {
  const app = join(HERE, "..", "..");
  const html = readFileSync(join(app, "index.html"), "utf8");
  return [...html.matchAll(/href="(app\/styles\/[\w-]+\.css)"/g)]
    .map(m => readFileSync(join(app, m[1]), "utf8"))
    .join("\n");
}

export async function cssdiff(k, t) {
  if (!REF) {
    t.ok(true, "skipped — set KILN_CSS_REF to the reference CSS");
    return;
  }
  await k.ev(`(window.__ref=${JSON.stringify(readFileSync(REF, "utf8"))}, 1)`);
  await k.ev(`(window.__new=${JSON.stringify(todaysCss())}, 1)`);
  await k.ev(LIB);
  await k.send("DOM.enable");
  await k.send("CSS.enable");
  const all = new Map();
  let checked = 0,
    states = 0;
  const report = (state, r) => {
    checked += r.n;
    for (const d of r.diffs) {
      const key = `${d.el}${d.ps} · ${d.prop}`;
      if (!all.has(key)) all.set(key, { ...d, states: [] });
      const e = all.get(key);
      if (e.states.length < 6) e.states.push(state);
    }
  };
  /* one state: the whole page, then each hover / focus / active target in it */
  async function check(state, { pseudo = true } = {}) {
    states++;
    await k.sleep(120);
    report(state, await k.ev(`__cssdiff()`));
    if (!pseudo) return;
    for (const tg of await k.ev(`__cdTargets()`)) {
      const ids = await forceOn(k, tg.sub, tg.idx, tg.cls);
      if (!ids) continue;
      const r = await k.ev(
        `(()=>{const el=[...document.querySelectorAll(${JSON.stringify(tg.sub)})][${tg.idx}];if(!el)return {diffs:[],n:0};el.setAttribute("data-cdr","");const r=__cssdiff("[data-cdr]");el.removeAttribute("data-cdr");return r})()`,
      );
      report(`${state} :${tg.cls} ${tg.sub}`, r);
      await forceOff(k, ids);
    }
  }
  const go = js => k.ev(`(()=>{${js};return 1})()`);
  const done = n => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 40000);
  const settle = () => k.sleep(700);
  const views = async (tag, pseudo) => {
    await go(`showView("gen")`);
    await settle();
    await check(`${tag} gen`, { pseudo });
    await go(`browseTo(lastDone())`);
    await settle();
    await check(`${tag} gallery`, { pseudo });
    await go(`endPeek();showView("queue")`);
    await settle();
    await check(`${tag} queue`, { pseudo });
    await go(`showView("loras")`);
    await settle();
    await check(`${tag} loras`, { pseudo });
    await go(`showView("png")`);
    await settle();
    await check(`${tag} png`, { pseudo });
    await go(`showView("gen")`);
    await settle();
  };

  // 0 · empty, nothing ever made
  await settle();
  await check("empty");
  await go(`$("pname").value="Series";S.pname="Series";nameUI()`);
  await check("empty named", { pseudo: false });
  // 1 · three finished pictures (two shapes), one stopped, then one rendering with two waiting
  await k.job("[fill:3060a0] first", { ar: "3:4", steps: 2, name: "Fox" });
  await done(1);
  await k.job("[fill:a03060] second", { ar: "16:9", steps: 2, name: "Fox" });
  await done(2);
  await k.job("[fill:30a060] third", { ar: "1:1", steps: 2 });
  await done(3);
  await settle();
  await check("still");
  await k.job("a long one", { ar: "3:4", steps: 3000 });
  await k.until(`!!current()`, 15000);
  await k.job("waiting one", { ar: "2:3", steps: 3, name: "Owl" });
  await k.job("waiting two", { ar: "9:16", steps: 3 });
  await k.until(`!!current()&&current().step>=1`, 20000);
  await settle();
  await check("live");
  await views("live", true);
  await go(`browseTo(lastDone())`);
  await settle();
  await check("live gallery (chip)", { pseudo: false });
  await go(`endPeek();if(current())loadJob(current())`);
  await settle();
  await check("live peek", { pseudo: false });
  await go(`endPeek();const pj=jobs.find(j=>j.status==="pending");if(pj)loadJob(pj)`);
  await settle();
  await check("peek pending");
  await go(`$("pname").value="Renamed";$("pname").dispatchEvent(new Event("input"))`);
  await check("peek pending rename", { pseudo: false });
  await go(`endPeek();browseTo(lastDone());fnShow(true)`);
  await settle();
  await check("gallery filename", { pseudo: false });
  await go(`fnShow(false);endPeek()`);
  // pop-ups, menus, dialogs, toasts, tooltips
  for (const [name, js] of [
    ["pop ratio", `$("pAR").click()`],
    ["pop size", `$("pMP").click()`],
    ["pop steps", `$("pST").click()`],
    ["pop seed", `$("pSD").click()`],
    ["pop count", `$("pN").click()`],
    ["layout menu", `$("layBtn").click()`],
  ]) {
    await go(`closePops();${js}`);
    await k.sleep(400);
    await check(name);
  }
  await go(`closePops();document.querySelectorAll(".pop.show").forEach(p=>p.classList.remove("show"))`);
  await go(`$("gear").click()`);
  await k.sleep(500);
  await check("settings");
  await go(`$("modal").classList.remove("show");openKeys()`);
  await k.sleep(500);
  await check("keys");
  await go(`$("keys").classList.remove("show");toast("Hello","Undo",()=>{})`);
  await k.sleep(300);
  await check("toast", { pseudo: false });
  await go(
    `const b=$("gear"),r=b.getBoundingClientRect();b.dispatchEvent(new MouseEvent("mouseover",{bubbles:true,clientX:r.left+5,clientY:r.top+5}))`,
  );
  await k.sleep(700);
  await check("tooltip", { pseudo: false });
  await go(`endPeek();openViewer(lastDone())`);
  await k.sleep(400);
  await check("viewer");
  await go(`closeViewer()`);
  // edges, drags, the dock zones (classes as the gestures set them)
  await go(`$("right").classList.add("edgehint");$("fithint").classList.add("show")`);
  await k.sleep(300);
  await check("edge hint", { pseudo: false });
  await go(
    `$("right").classList.remove("edgehint");$("fithint").classList.remove("show");document.body.classList.add("cardmove");document.querySelectorAll(".dockzone").forEach((z,i)=>z.classList.add("show",...(i===1?["near"]:[])));document.querySelectorAll(".ghost").forEach((g,i)=>g.classList.add("show",...(i===1?["near"]:[])))`,
  );
  await check("dock drag", { pseudo: false });
  await go(
    `document.body.classList.remove("cardmove");document.querySelectorAll(".dockzone,.ghost").forEach(z=>z.classList.remove("show","near"))`,
  );
  // privacy, stopping, paused
  await go(`toggleCover()`);
  await k.sleep(400);
  await check("private live");
  await go(`toggleCover()`);
  await k.sleep(300);
  await k.ev(`Promise.resolve(current()&&stopJob(current())).then(()=>1)`);
  await k.sleep(300);
  await check("stopping", { pseudo: false });
  await k.ev(`setPaused(true).then(()=>1)`);
  await done(4);
  await k.sleep(1200);
  await go(`showView("gen")`);
  await settle();
  await check("paused");
  await go(`showView("queue")`);
  await settle();
  await check("paused queue");
  await go(`showView("gen")`);
  await settle();
  // the missing-file card
  const file = await k.ev(`lastDone().file`);
  try {
    k.rm(join(k.out, file));
  } catch (e) {}
  await k.until(`$("frame").classList.contains("missing")`, 6000);
  await settle();
  await check("missing");
  await go(`showView("queue")`);
  await settle();
  await check("missing queue", { pseudo: false });
  await go(`showView("gen");browseTo(doneList()[0])`);
  await settle();
  // layouts × a few states
  for (const d of ["right", "below"]) {
    await go(`setDock("${d}")`);
    await k.sleep(1600);
    await views(`dock ${d}`, d === "below");
  }
  await go(`setDock("left")`);
  await k.sleep(1600);
  // a narrow prompt box (the pills' and the Reuse bar's container queries)
  await go(`S.lay.pw=380;sizeFrame();layoutLeft()`);
  await k.sleep(800);
  await check("narrow prompt", { pseudo: false });
  await go(`browseTo(lastDone())`);
  await settle();
  await check("narrow prompt gallery", { pseudo: false });
  await go(`endPeek();S.lay.pw=680;sizeFrame();layoutLeft()`);
  await k.sleep(800);
  // themes × materials
  for (const th of ["aurora", "emerald", "ice", "ember", "sunset"])
    for (const g of ["on", "off"]) {
      await k.theme(th);
      await k.setting("glass", g);
      await k.sleep(500);
      await views(`${th} ${g === "on" ? "glass" : "solid"}`, false);
      await go(`toggleCover()`);
      await k.sleep(300);
      await check(`${th} ${g} private`, { pseudo: false });
      await go(`toggleCover()`);
    }
  await k.theme("ice");
  await k.setting("glass", "on");
  // a narrow window (auto-stacked), and reduced motion
  await k.send("Emulation.setDeviceMetricsOverride", { width: 880, height: 860, deviceScaleFactor: 1, mobile: false });
  await k.sleep(1500);
  await views("narrow window", true);
  await k.send("Emulation.setDeviceMetricsOverride", { width: 1513, height: 900, deviceScaleFactor: 1, mobile: false });
  await k.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await k.sleep(1200);
  await views("reduced motion", false);

  const lines = [...all.values()].map(
    d => `${d.el}${d.ps}  ·  ${d.prop}\n    now: ${d.now}\n    ref: ${d.ref}\n    in: ${d.states.join(" | ")}`,
  );
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, "cssdiff.txt"),
    `${states} states, ${checked.toLocaleString()} values compared, ${all.size} differences\n\n` + lines.join("\n\n"),
  );
  console.log(
    `    cssdiff: ${states} states, ${checked.toLocaleString()} values, ${all.size} differences → tools/tests/out/cssdiff.txt`,
  );
  t.ok(
    all.size === 0,
    "the rewrite changes nothing visible",
    `${all.size} differences — see tools/tests/out/cssdiff.txt`,
  );
}
cssdiff.opts = { step: 0.25, width: 1513, height: 900, limitMin: 30 }; // ~17 min: 115 states, every computed style twice
