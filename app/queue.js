/* Kiln · Queue tab, peek / reuse */
function renderQueue(){const before={};document.querySelectorAll(".qi").forEach(q=>before[q.dataset.id]=q.getBoundingClientRect().top);
 renderQueueInner();const had=Object.keys(before).length;
 document.querySelectorAll(".qi").forEach(q=>{const b=before[q.dataset.id];if(b==null){if(had)q.classList.add("new");return}
  const d=b-q.getBoundingClientRect().top;if(Math.abs(d)<1)return;q.style.transition="none";q.style.transform=`translateY(${d}px)`;
  requestAnimationFrame(()=>{q.style.transition="transform .3s var(--ease)";q.style.transform=""})})}
function renderQueueInner(){const run=jobs.filter(j=>j.status==="running"),pend=jobs.filter(j=>j.status==="pending"),done=jobs.filter(j=>j.status==="done"||j.status==="cancelled").reverse();
 const left=pend.reduce((a,j)=>a+jEst(j),0);
 const item=(j,k)=>`<div class="qi${j.missing?" missing":""}" data-id="${j.id}" draggable="${k==="pend"}">
   ${k==="pend"?'<span class="handle" title="Drag to reorder">⋮⋮</span>':""}
   <div class="th">${j.missing?"gone":j.status==="done"?`<canvas data-th="${j.id}"></canvas>`:j.status==="cancelled"?"stopped":k==="run"?(window.LIVE&&(S.set||{}).privacy!=="on"?`<img class="lp" data-lp="${j.id}" alt="">`:"…"):"#"+j.id}</div>
   <div class="body"><div class="p">${j.file?`<b style="font-weight:600">${esc(j.file)}</b> · `:""}${esc(j.prompt)}</div>
   <div class="meta">${j.picks&&j.picks.length?`<span style="color:#e6e6ea">${esc(j.picks.join(" · "))}</span> · `:""}${j.mp} MP · ${j.ar} · ${j.steps} steps · <span class="seedc" data-seed="${j.seed}" data-tip="Click to copy the seed">seed ${j.seed}</span>${k==="pend"?` · ~${fmt(jEst(j))}`:""}${j.missing?' · <span class="gone">file deleted</span>':""}</div>
   ${j.created||j.finished?`<div class="meta times">${j.created?`added ${clock(j.created)}`:""}${j.finished&&j.status==="done"?` · done ${clock(j.finished)}`:""}${j.finished&&j.started?` · took ${fmt((j.finished-j.started)*(window.LIVE?1:S.demo)/1000)}`:""}</div>`:""}
   ${k==="run"?'<div class="mini"><i></i></div>':""}</div>
   ${k!=="done"?`<button class="x" data-x="${j.id}" title="${k==="run"?"Stop":"Remove"}">${IC.x}</button>`:`<button class="x" data-rm="${j.id}" title="Remove from the list — the file stays">${IC.x}</button>`}</div>`;
 $("qwrap").innerHTML=(run.length?`<div class="qsec">Running</div>${run.map(j=>item(j,"run")).join("")}`:"")+
  `<div class="qsec"><span>Up next ${pend.length?`· ${pend.length} · ~${fmt(left)}`:""}${window.qPaused?' · <b class="paused">paused</b>':""}</span><button id="pauseQ" data-tip="${window.qPaused?"Start the waiting jobs again":"The current image finishes; nothing new starts until you resume"}">${window.qPaused?"Resume":"Pause after this"}</button></div>`+
  (pend.length?pend.map(j=>item(j,"pend")).join(""):'<div class="empty">Nothing queued</div>')+
  (done.length?`<div class="qsec"><span>Finished</span><span>${done.some(j=>j.missing)?`<button id="rmMissing">Remove missing (${done.filter(j=>j.missing).length})</button> `:""}<button id="clearDone">Clear list</button></span></div>${done.map(j=>item(j,"done")).join("")}`:"");
 done.forEach(j=>{const c=document.querySelector(`canvas[data-th="${j.id}"]`);if(c&&j.status==="done"&&!j.missing)paint(c,j,1)})}
function clock(ms){const d=new Date(ms),t=d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return d.toDateString()===new Date().toDateString()?t:d.toLocaleDateString([],{month:"short",day:"numeric"})+" "+t}
/* demo versions; live.js replaces them with server calls */
window.removeJob=j=>{jobs=jobs.filter(x=>x!==j);renderAll()};
window.deleteJob=j=>{if(!j)return;toast("Prototype: would move the file to the Recycle Bin")};
window.setPaused=p=>{window.qPaused=p;renderAll();if(!p)tick()};
window.renameJob=(j,n)=>{j.name=n;toast("Name saved")};
$("qwrap").addEventListener("click",e=>{
 const sc=e.target.closest(".seedc");if(sc){e.stopPropagation();copySeed(sc.dataset.seed);return}
 if(e.target.id==="pauseQ"){setPaused(!window.qPaused);return}
 if(e.target.id==="rmMissing"){removeMissing();return}
 const rm=e.target.closest("[data-rm]");if(rm){removeJob(jobs.find(j=>j.id==+rm.dataset.rm));return}
 if(e.target.id==="clearDone"){jobs=jobs.filter(j=>j.status==="pending"||j.status==="running");renderAll();return}
 const x=e.target.closest("[data-x]");if(x){stopJob(jobs.find(j=>j.id==+x.dataset.x));return}
 const q=e.target.closest(".qi");if(!q)return;const j=jobs.find(j=>j.id==+q.dataset.id);
 if(j.status==="running"){showView("gen");loadJob(j);return}
 if(j.status==="done"){showView("gen");browseTo(j);return} // finished: browse to it in Generating
 loadJob(j)});
function browseTo(j){browseId=j.id;peekOff=false;resultStale=false;$("cv").dataset.d="";$("cv").dataset.j="";sizeFrame();loadJob(j);updNav()}
let undo=null;var justDone=null;
let peekJob=null;
/* the peek bar only offers what would change something: no "Reuse prompt" when the prompt is already your draft;
   "Use this seed" when only the seed differs; nothing but ✕ when it all matches */
function sameLoras(j){const on=LORAS.filter(l=>l.on),jl=j.loras||[];return on.length===jl.length&&jl.every(x=>{const l=on.find(l=>l.name===x.name);return l&&Math.abs(l.w-x.w)<1e-6})}
function peekButtons(){const j=peekJob;if(!j)return;const pSame=(j.raw||j.prompt||"").trim()===(draft||"").trim();
 const sSame=j.mp===S.mp&&j.ar===S.ar&&+j.steps===+S.steps&&sameLoras(j),seedSame=S.seedMode==="fixed"&&+S.seed===+j.seed;
 $("pkPrompt").style.display=pSame?"none":"";const all=$("pkAll");
 const lbl=(lg,sm)=>`<span class="lg">${lg}</span><span class="sm">${sm}</span>`; // the short form shows when the box is narrow
 if(!pSame||!sSame){all.style.display="";all.dataset.m="all";all.innerHTML=lbl("Reuse all","All")}else if(!seedSame){all.style.display="";all.dataset.m="seed";all.innerHTML=lbl("Use this seed","Seed")}else all.style.display="none";
 $("pkSeed").style.display=all.style.display==="none"||all.dataset.m==="seed"?"none":"";
 $("peekLbl").textContent=`#${j.id}${j.status==="running"?" · generating":""}${pSame&&sSame&&seedSame?" · same as your draft":""}`}
function loadJob(j){peekJob=j;P.value=j.raw||j.prompt;P.readOnly=true;P.classList.add("peek");P.scrollTop=0;
 const n=$("pname");n.value=j.name||"";n.placeholder=j.status==="pending"?"Name this job":"Unnamed";n.readOnly=j.status!=="pending";$("pnSave").classList.remove("show");
 peekButtons();$("peekbar").classList.add("show");$("left").classList.add("peeking");renderChips();renderPills();updPrompt();layoutLeft()}
/* Two ways out of a browse: the prompt's ✕ (or Esc in the editor) closes only the prompt — your draft comes back, the
   image stays, and the arrows keep the prompt closed (peekOff) until the browse ends; the image's ✕ (or Esc elsewhere)
   closes both and returns to the live view. */
let peekOff=false;
function closePromptPeek(){if(browseId!=null){peekOff=true;endPeek(true)}else endPeek()}
function endPeek(keep){if(!keep){peekOff=false;if(browseId!=null){browseId=null;resultStale=false;$("cv").dataset.d="";$("cv").dataset.j="";sizeFrame()}}
 if(!peekJob)return;peekJob=null;P.readOnly=false;P.classList.remove("peek");P.value=draft;
 const n=$("pname");n.value=S.pname||"";n.placeholder="Add name";n.readOnly=false;
 $("peekbar").classList.remove("show");$("pnSave").classList.remove("show");$("left").classList.remove("peeking");renderChips();renderPills();updPrompt();layoutLeft()}
function saveJobName(){const j=peekJob;if(!j||j.status!=="pending")return;const v=$("pname").value.trim();renameJob(j,v);j.name=v;$("pnSave").classList.remove("show")}
$("pnSave").onclick=e=>{e.stopPropagation();saveJobName()};
/* Q5: hover a finished thumbnail for a bigger look */
(function(){const pop=document.createElement("div");pop.id="qpop";document.body.appendChild(pop);let t=null,cur=null;
 const hide=()=>{clearTimeout(t);cur=null;pop.classList.remove("show")};
 $("qwrap").addEventListener("mouseover",e=>{const c=e.target.closest(".qi .th canvas");if(c===cur)return;hide();if(!c||!window.fileUrl)return;cur=c;
  const j=jobs.find(x=>x.id==+c.dataset.th);if(!j||!j.file)return;
  t=setTimeout(()=>{if(cur!==c)return;const r=c.getBoundingClientRect(),[a,b]=(j.ar||"1:1").split(":").map(Number),w=a>=b?320:Math.round(320*a/b),h=Math.round(w*b/a);
   pop.innerHTML=`<img src="${fileUrl(j)}" alt="">`;pop.style.width=w+"px";pop.style.height=h+"px";
   const x=r.right+12+w<innerWidth?r.right+12:r.left-12-w,y=Math.max(8,Math.min(innerHeight-h-8,r.top+r.height/2-h/2));pop.style.transform=`translate(${x}px,${y}px)`;pop.classList.add("show")},350)});
 $("qwrap").addEventListener("mouseleave",hide);$("qwrap").addEventListener("scroll",hide,{passive:true});$("qwrap").addEventListener("mousedown",hide)})();
function reuse(all,seedToo){const j=peekJob;const fixed=!!(seedToo||S.keepSeed);if(!j)return;const prev={draft,S:{mp:S.mp,ar:S.ar,steps:S.steps,seedMode:S.seedMode,seed:S.seed,pname:S.pname},loras:LORAS.map(l=>({on:l.on,w:l.w}))};
 draft=j.raw||j.prompt;if((j.name||"").trim())S.pname=j.name.trim();   /* reusing the working file, title included: the next image joins its series */if(all){Object.assign(S,{mp:j.mp,ar:j.ar,steps:j.steps},fixed?{seedMode:"fixed",seed:j.seed}:{seedMode:"random"});LORAS.forEach(l=>{const i=j.loras.findIndex(x=>x.name===l.name);l.on=i>=0;if(i>=0){l.w=j.loras[i].w;l.onAt=Date.now()+i}})}
 endPeek();save();renderAll();P.focus();
 toast(all?`Reused #${j.id} — prompt, settings and LoRAs${fixed?", its seed":", new seed"}`:`Reused #${j.id}'s prompt`,"Undo",()=>{draft=prev.draft;P.value=draft;Object.assign(S,prev.S);$("pname").value=S.pname||"";LORAS.forEach((l,i)=>Object.assign(l,prev.loras[i]));save();renderAll();updPrompt()})}
$("pkPrompt").onclick=()=>reuse(false);$("pkAll").onclick=()=>reuse(true,$("pkAll").dataset.m==="seed");
$("pkSeed").onclick=e=>{e.stopPropagation();S.keepSeed=!S.keepSeed;save();keepSeedUI()};$("pkX").onclick=()=>closePromptPeek();
P.addEventListener("keydown",e=>{if(!peekJob)return;if(e.key==="Escape"){closePromptPeek();return}
 if(e.key.length===1||e.key==="Backspace"||e.key==="Enter"){if(e.ctrlKey&&e.key==="Enter")return;reuse(false)}});
function updPrompt(){if(window.nameUI)nameUI();const n=P.value.length;$("pcount").textContent=n?n.toLocaleString()+" chars":"";$("play").classList.toggle("off",!P.value.trim()||!!peekJob);
 $("play").title=peekJob?"Choose Reuse first":(!P.value.trim()?"Write a prompt first":"Add to queue (Ctrl+Enter)")}
/* drag to reorder: the dragged row itself moves in the list (no re-render while dragging — that swapped the element
   under the pointer and made the cursor flicker); it moves once the pointer crosses a row's middle, so rows don't
   ping-pong; the others slide out of the way */
let dragId=null,dragEl=null;
$("qwrap").addEventListener("dragstart",e=>{const q=e.target.closest('.qi[draggable="true"]');if(!q)return;dragId=+q.dataset.id;dragEl=q;q.classList.add("drag");
 e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",String(dragId))}catch(_){}});
$("qwrap").addEventListener("dragover",e=>{if(!dragEl)return;e.preventDefault();e.dataTransfer.dropEffect="move";
 const q=e.target.closest('.qi[draggable="true"]');if(!q||q===dragEl)return;const r=q.getBoundingClientRect(),after=e.clientY>r.top+r.height/2;
 if(after?q.nextElementSibling===dragEl:q.previousElementSibling===dragEl)return;
 const rows=[...$("qwrap").querySelectorAll('.qi[draggable="true"]')],before=new Map(rows.map(x=>[x,x.getBoundingClientRect().top]));
 if(after)q.after(dragEl);else q.before(dragEl);
 for(const x of rows){if(x===dragEl)continue;const d=before.get(x)-x.getBoundingClientRect().top;if(Math.abs(d)<1)continue;
  x.style.transition="none";x.style.transform=`translateY(${d}px)`;requestAnimationFrame(()=>{x.style.transition="transform .22s var(--ease)";x.style.transform=""})}});
$("qwrap").addEventListener("drop",e=>{if(dragEl)e.preventDefault()});
$("qwrap").addEventListener("dragend",()=>{if(!dragEl)return;const ids=[...$("qwrap").querySelectorAll('.qi[draggable="true"]')].map(x=>+x.dataset.id);
 const pend=ids.map(id=>jobs.find(j=>j.id===id)).filter(Boolean);let k=0;jobs=jobs.map(j=>j.status==="pending"&&pend.includes(j)?pend[k++]:j); // the new order, in place of the old
 dragEl.classList.remove("drag");dragId=null;dragEl=null;renderQueue()});
