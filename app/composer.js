/* Kiln · prompt card controls: pills, prompt, LoRA chips */
/* ======================= pills ======================= */
function slider(id,min,max,val,quick,hint){return `<div class="row"><input type="range" id="${id}R" min="${min}" max="${max}" value="${val}" style="flex:1"><input type="number" id="${id}N" min="1" max="${max*2}" value="${val}"></div>
  <div class="row" style="justify-content:space-between">${quick.map(q=>`<button class="qb ${q===val?"on":""}" data-q="${q}">${q}</button>`).join("")}</div><div class="hint" id="${id}H">${hint}</div>`}
function stepsHint(){return `~${fmt(S.steps*SEC_PER_STEP[S.mp])} per image at ${S.mp} MP`}
function countHint(){return S.n>1?`${S.n} jobs · ~${fmt(S.n*S.steps*SEC_PER_STEP[S.mp])} total · ${S.seedMode==="random"?"random seeds":"seeds count up"}`:"one image"}
function idleText(){const [w,h]=SIZES[S.mp][S.ar];const had=jobs.some(j=>j.status==="done");
 $("idleT").textContent=had?`Next: ${S.ar} · ${w}×${h}`:"Queue is empty";
 $("idleS").textContent=had?"Your last image is in Queue → Finished":"Write a prompt and press ▶ (Ctrl+Enter)"}
function renderPills(){idleText();
 const pk=typeof peekJob!=="undefined"&&peekJob; // peeking: the pills show that job's own settings
 const v=pk?{mp:pk.mp,ar:pk.ar,steps:pk.steps,seed:pk.seed!=null?String(pk.seed):"—",n:1}:{mp:S.mp,ar:S.ar,steps:S.steps,seed:S.seedMode==="random"?"Random":String(S.seed),n:S.n};
 $("pSD").dataset.tip=pk?"Click to copy this seed":"Seed — random each job, or fixed";
 $("vMP").textContent=v.mp+" MP";$("vAR").innerHTML=v.ar+'<span class="w"> Ratio</span>';$("vST").innerHTML=v.steps+'<span class="w"> Steps</span>';
 $("vSD").textContent=v.seed;$("vN").textContent="×"+v.n;
 $("popMP").innerHTML=["1.0","1.5","2.0"].map(m=>`<div class="opt ${m===S.mp?"on":""}" data-v="${m}">${m} MP <small>~${SEC_PER_STEP[m]}s/step</small></div>`).join("");
 $("popAR").innerHTML=`<div class="rgrid">${RATIOS.map(r=>{const [a,b]=r.split(":").map(Number);const k=34/Math.max(a,b);const [w,h]=SIZES[S.mp][r];
   return `<div class="rt ${r===S.ar?"on":""}" data-v="${r}"><div class="shape" style="width:${Math.round(a*k)}px;height:${Math.round(b*k)}px"></div><div class="t">${r}</div><div class="px">${w}×${h}</div></div>`}).join("")}</div>`;
 if(!$("popST").classList.contains("show"))$("popST").innerHTML=slider("st",1,30,S.steps,[4,6,8,12],stepsHint());
 if(!$("popN").classList.contains("show"))$("popN").innerHTML=slider("cn",1,50,S.n,[1,4,8,16],countHint());
 $("popSD").innerHTML=`<div class="opt ${S.seedMode==="random"?"on":""}" data-v="random">Random each job</div>
   <div class="row"><input type="number" id="seedIn" value="${S.seed}" style="width:140px"><button class="iconbtn" id="dice" title="New random seed">${IC.dice}</button><button class="iconbtn" id="seedCopy" title="Copy the seed">${IC.copy}</button></div>
   <div class="opt ${S.seedMode==="fixed"?"on":""}" data-v="fixed">Fixed</div>`;
 sizeFrame()}
function closePops(){document.querySelectorAll(".pop.show").forEach(p=>{p.classList.remove("show");p.parentElement.classList.remove("open")});renderPills()}
function staleIf(ch){if(ch&&!current()&&lastDone()){resultStale=true;$("cv").dataset.d="";$("frame").classList.remove("has")}}
const PILLS=[["pMP","popMP",v=>{staleIf(S.mp!==v);S.mp=v}],["pAR","popAR",v=>{staleIf(S.ar!==v);S.ar=v}],["pST","popST",v=>S.steps=+v],["pN","popN",v=>S.n=+v],["pSD","popSD",v=>S.seedMode=v]];
function copySeed(s){if(s==null||s==="")return;navigator.clipboard.writeText(String(s)).then(()=>toast(`Seed ${s} copied`),()=>toast("Couldn't copy the seed"))}
PILLS.forEach(([b,p,set])=>{$(b).addEventListener("click",e=>{const pop=$(p);
 if(b==="pSD"&&typeof peekJob!=="undefined"&&peekJob){copySeed(peekJob.seed);return} // an old job: the seed pill copies its seed
 if(e.target.closest(".pop")&&!e.target.closest(".opt,.rt,.qb"))return;
 const o=e.target.closest(".opt,.rt");if(o){set(o.dataset.v);save();closePops();return}
 const q=e.target.closest(".qb");if(q){set(q.dataset.q);save();pop.classList.remove("show");renderPills();pop.classList.add("show");return}
 const was=pop.classList.contains("show");closePops();if(!was){pop.classList.add("show");$(b).classList.add("open")}})});
document.addEventListener("click",e=>{if(e.target.closest("#seedCopy")){copySeed(S.seed);return}if(e.target.closest("#dice")){S.seed=Math.floor(Math.random()*4294967295);S.seedMode="fixed";save();renderPills();$("popSD").classList.add("show");return}
 if(!e.target.isConnected||e.target.closest(".pill"))return;closePops()});
document.addEventListener("input",e=>{const id=e.target.id;
 if(id==="stR"||id==="stN"){S.steps=clamp(+e.target.value,1,60);$(id==="stR"?"stN":"stR").value=S.steps;$("vST").innerHTML=S.steps+'<span class="w"> Steps</span>';$("stH").textContent=stepsHint();save()}
 if(id==="cnR"||id==="cnN"){S.n=clamp(+e.target.value,1,100);$(id==="cnR"?"cnN":"cnR").value=S.n;$("vN").textContent="×"+S.n;$("cnH").textContent=countHint();save()}
 if(id==="seedIn"){S.seed=+e.target.value||0;S.seedMode="fixed";$("vSD").textContent="Fixed";save()}});
[["pST",d=>S.steps=clamp(S.steps+d,1,60)],["pN",d=>S.n=clamp(S.n+d,1,100)]].forEach(([id,f])=>$(id).addEventListener("wheel",e=>{e.preventDefault();f(e.deltaY<0?1:-1);save();renderPills()},{passive:false}));
function clamp(v,a,b){return Math.max(a,Math.min(b,Math.round(v)||a))}

/* ======================= prompt + chips ======================= */
function applyPH(){if(window.layoutLeft){delete S.ph;layoutLeft();return}delete S.ph;const r=document.documentElement.style;const max=$("left").parentElement.getBoundingClientRect().height-36;if(S.pph>max)S.pph=Math.max(240,max);if(S.pph){r.setProperty("--ph",S.pph+"px");$("left").classList.add("sized")}else{r.removeProperty("--ph");$("left").classList.remove("sized")}}
(function(){const g=$("vedge");let y0=0,h0=0;
 g.addEventListener("pointerdown",e=>{e.preventDefault();g.setPointerCapture(e.pointerId);g.classList.add("drag");document.body.classList.add("vresizing");$("left").classList.add("nodur");y0=e.clientY;h0=$("left").getBoundingClientRect().height});
 g.addEventListener("pointermove",e=>{if(!g.classList.contains("drag"))return;const max=$("left").parentElement.getBoundingClientRect().height-36;S.pph=Math.max(240,Math.min(max,Math.round(h0+e.clientY-y0)));applyPH()});
 g.addEventListener("pointerup",()=>{g.classList.remove("drag");document.body.classList.remove("vresizing");$("left").classList.remove("nodur");lyFrozen=false;layoutLeft();save()});
 g.addEventListener("dblclick",()=>{S.pph=0;applyPH();save();toast("Prompt height back to auto")});})();
function grow(){} // column widths now come from sizeFrame()
(function(){const g=$("hsplit");let y0=0,h0=0;
 g.addEventListener("pointerdown",e=>{e.preventDefault();g.setPointerCapture(e.pointerId);g.classList.add("drag");document.body.classList.add("vresizing");y0=e.clientY;h0=$("left").getBoundingClientRect().height});
 g.addEventListener("pointermove",e=>{if(!g.classList.contains("drag"))return;S.sch=Math.max(200,Math.min(Math.round(innerHeight*.7),Math.round(h0-(e.clientY-y0))));layoutLeft()});
 g.addEventListener("pointerup",()=>{g.classList.remove("drag");document.body.classList.remove("vresizing");save()});
 g.addEventListener("dblclick",()=>{S.sch=0;save();layoutLeft();toast("Image / prompt split back to auto")});})();
(function(){const g=$("split");let x0=0,w0=0;
 g.addEventListener("pointerdown",e=>{e.preventDefault();g.setPointerCapture(e.pointerId);g.classList.add("drag");document.body.classList.add("resizing");x0=e.clientX;w0=$("left").getBoundingClientRect().width});
 g.addEventListener("pointermove",e=>{if(!g.classList.contains("drag"))return;const max=Math.min(CARDMAX,innerWidth-36-18-minRight());S.lw=Math.max(360,Math.min(max,Math.round(w0+e.clientX-x0)));grow();sizeFrame();moveThumb(true)});
 g.addEventListener("pointerup",()=>{g.classList.remove("drag");document.body.classList.remove("resizing");save()});
 g.addEventListener("dblclick",()=>{S.lw=0;save();grow();sizeFrame();moveThumb(true)});})();

P.addEventListener("input",()=>{grow();requestAnimationFrame(layoutLeft);if(!peekJob){draft=P.value;save()}updPrompt()});
let chipsOpen=false;
function renderChips(){requestAnimationFrame(()=>window.layoutLeft&&layoutLeft());
 const pk=typeof peekJob!=="undefined"&&peekJob;$("chips").classList.toggle("peek",!!pk);
 if(pk){$("chips").innerHTML=(pk.loras||[]).map(x=>{const l=LORAS.find(l=>l.name===x.name);
   return `<span class="chip ${l&&l.folder==="people"?"face":""}"><span class="cn">${esc(l?l.display:x.name)}</span><span class="cw">${fmtW(x.w)}</span></span>`}).join("");
  $("chips").insertAdjacentHTML("afterbegin",`<span class="chiplbl">${(pk.loras||[]).length===1?"LoRA":"LoRAs"}</span>`);capChips();peekButtons();return}
 $("chips").innerHTML=LORAS.filter(l=>l.on).sort((a,b)=>(a.onAt||0)-(b.onAt||0)).map(l=>`<span class="chip ${l.folder==="people"?"face":""}" data-n="${l.name}" draggable="true"><span class="cn">${esc(l.display)}</span><span class="cw" data-tip="Drag or scroll to change · click to type">${fmtW(l.w)}</span><button class="cx" title="Remove">${IC.x}</button></span>`).join("");
 $("chips").insertAdjacentHTML("afterbegin",`<span class="chiplbl" data-tip="LoRAs used for the next image · drag to reorder">${LORAS.filter(l=>l.on).length===1?"LoRA":"LoRAs"}</span>`);
 $("chips").insertAdjacentHTML("beforeend",'<button class="chip chipadd" data-tip="Add a LoRA — opens the library">+</button>');capChips();if(typeof peekJob!=="undefined"&&peekJob)peekButtons()}
/* more than two rows of chips: hide the rest behind a "+N" chip that expands (and collapses again) */
function capChips(){const box=$("chips");box.querySelector(".chipmore")?.remove();const cs=[...box.querySelectorAll(".chip[data-n]")];cs.forEach(c=>c.hidden=false);
 const rows=[...new Set(cs.map(c=>c.offsetTop))].sort((a,b)=>a-b);if(rows.length<=2)return;
 const more=document.createElement("button");more.className="chip chipmore";box.append(more);
 if(chipsOpen){more.textContent="Show less";more.dataset.tip="Back to two rows";return}
 const lim=rows[1],hid=cs.filter(c=>c.offsetTop>lim);hid.forEach(c=>c.hidden=true);more.textContent="+"+hid.length;
 const vis=cs.filter(c=>!c.hidden);while(more.offsetTop>lim&&vis.length){const c=vis.pop();c.hidden=true;hid.unshift(c);more.textContent="+"+hid.length}
 more.dataset.tip="Show all · "+hid.map(c=>c.querySelector(".cn").textContent+" "+c.querySelector(".cw").textContent).join(", ")}
(function(){let w=0;new ResizeObserver(()=>{const n=$("chips").clientWidth;if(n!==w){w=n;capChips()}}).observe($("chips"))})();
$("chips").onclick=e=>{const c=e.target.closest(".chip");if(!c)return;if(c.classList.contains("chipadd")){showView("loras");return}if(c.classList.contains("chipmore")){chipsOpen=!chipsOpen;renderChips();return}if(peekJob)return;const l=LORAS.find(l=>l.name===c.dataset.n);
 if(e.target.closest(".cx")){l.on=false;save();renderChips();renderLoras();return}
 S.lfilter=l.folder==="people"?"people":"all";showView("loras");const el=document.querySelector(`[data-ln="${l.name}"]`);
 if(el){el.scrollIntoView({block:"center"});el.classList.remove("flash");void el.offsetWidth;el.classList.add("flash")}};

/* chip weights: drag to scrub, wheel to nudge, click to type */
(function(){const box=$("chips");let drag=null;
 const lor=el=>LORAS.find(l=>l.name===el.closest(".chip").dataset.n);
 const lim=l=>l.folder==="people"?[0,2]:[-3,3];
 function setW(l,w,el){const [a,b]=lim(l);l.w=Math.round(Math.max(a,Math.min(b,w))*100)/100;if(el)el.textContent=fmtW(l.w);save();if(S.view==="loras")renderLoras()}
 box.addEventListener("pointerdown",e=>{const el=e.target.closest(".cw");if(!el)return;e.preventDefault();el.setPointerCapture(e.pointerId);drag={el,l:lor(el),x:e.clientX,w0:lor(el).w,moved:false}});
 box.addEventListener("pointermove",e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>3)drag.moved=true;if(drag.moved)setW(drag.l,drag.w0+Math.round(dx/4)*.01*(e.shiftKey?1:5),drag.el)});
 box.addEventListener("pointerup",e=>{if(!drag)return;const d=drag;drag=null;if(d.moved)return;
  const inp=document.createElement("input");inp.className="cwi";inp.value=fmtW(d.l.w);d.el.replaceWith(inp);inp.focus();inp.select();
  const done=ok=>{if(ok){const v=parseFloat(inp.value.replace(",","."));if(!isNaN(v))setW(d.l,v)}renderChips()};
  inp.addEventListener("keydown",k=>{if(k.key==="Enter")done(true);if(k.key==="Escape")done(false);k.stopPropagation()});inp.addEventListener("blur",()=>done(true))});
 box.addEventListener("wheel",e=>{const el=e.target.closest(".cw");if(!el)return;e.preventDefault();const l=lor(el);setW(l,l.w+(e.deltaY<0?1:-1)*(e.shiftKey?.01:.05),el)},{passive:false});
 box.addEventListener("click",e=>{if(e.target.closest(".cw,.cwi"))e.stopImmediatePropagation()},true)})();

/* drag a chip to reorder: it moves in place, the others slide aside; the order is kept (onAt), so it sticks */
(function(){const box=$("chips");let dragEl=null,noDrag=false;
 box.addEventListener("pointerdown",e=>{noDrag=!!e.target.closest(".cw,.cx,.cwi")},true); // the weight and ✕ keep their own gestures
 box.addEventListener("dragstart",e=>{const c=e.target.closest(".chip[data-n]");if(!c||noDrag||(typeof peekJob!=="undefined"&&peekJob)){e.preventDefault();return}
  dragEl=c;c.classList.add("dragging");e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",c.dataset.n)}catch(_){}});
 box.addEventListener("dragover",e=>{if(!dragEl)return;e.preventDefault();e.dataTransfer.dropEffect="move";const q=e.target.closest(".chip[data-n]");if(!q||q===dragEl)return;
  const r=q.getBoundingClientRect(),after=e.clientX>r.left+r.width/2;if(after?q.nextElementSibling===dragEl:q.previousElementSibling===dragEl)return;
  const all=[...box.querySelectorAll(".chip[data-n]")],before=new Map(all.map(x=>[x,x.getBoundingClientRect()]));
  if(after)q.after(dragEl);else q.before(dragEl);
  for(const x of all){if(x===dragEl)continue;const b=before.get(x),n=x.getBoundingClientRect(),dx=b.left-n.left,dy=b.top-n.top;if(Math.abs(dx)+Math.abs(dy)<1)continue;
   x.style.transition="none";x.style.transform=`translate(${dx}px,${dy}px)`;requestAnimationFrame(()=>{x.style.transition="transform .2s var(--ease)";x.style.transform=""})}});
 box.addEventListener("drop",e=>{if(dragEl)e.preventDefault()});
 box.addEventListener("dragend",()=>{if(!dragEl)return;dragEl.classList.remove("dragging");const t=Date.now();
  [...box.querySelectorAll(".chip[data-n]")].forEach((c,i)=>{const l=LORAS.find(l=>l.name===c.dataset.n);if(l)l.onAt=t+i});
  dragEl=null;save();renderChips();if(S.view==="loras")renderLoras()})})();
function fmtW(w){return (+w).toFixed(2).replace(/\.?0+$/,"")}
