/* Kiln · Queue tab, peek / reuse */
function renderQueue(){const before={};document.querySelectorAll(".qi").forEach(q=>before[q.dataset.id]=q.getBoundingClientRect().top);
 renderQueueInner();const had=Object.keys(before).length;
 document.querySelectorAll(".qi").forEach(q=>{const b=before[q.dataset.id];if(b==null){if(had)q.classList.add("new");return}
  const d=b-q.getBoundingClientRect().top;if(Math.abs(d)<1)return;q.style.transition="none";q.style.transform=`translateY(${d}px)`;
  requestAnimationFrame(()=>{q.style.transition="transform .3s var(--ease)";q.style.transform=""})})}
function renderQueueInner(){const run=jobs.filter(j=>j.status==="running"),pend=jobs.filter(j=>j.status==="pending"),done=jobs.filter(j=>j.status==="done"||j.status==="cancelled").reverse();
 const left=pend.reduce((a,j)=>a+jEst(j),0);
 const item=(j,k)=>`<div class="qi" data-id="${j.id}" draggable="${k==="pend"}">
   ${k==="pend"?'<span class="handle" title="Drag to reorder">⋮⋮</span>':""}
   <div class="th">${j.status==="done"?`<canvas data-th="${j.id}"></canvas>`:j.status==="cancelled"?"stopped":k==="run"?"…":"#"+j.id}</div>
   <div class="body"><div class="p">${j.file?`<b style="font-weight:600">${esc(j.file)}</b> · `:""}${esc(j.prompt)}</div>
   <div class="meta">${j.picks&&j.picks.length?`<span style="color:#e6e6ea">${esc(j.picks.join(" · "))}</span> · `:""}${j.mp} MP · ${j.ar} · ${j.steps} steps · seed ${j.seed}${k==="pend"?` · ~${fmt(jEst(j))}`:""}${j.finished?` · took ${fmt((j.finished-j.started)*(window.LIVE?1:S.demo)/1000)}`:""}</div>
   ${k==="run"?'<div class="mini"><i></i></div>':""}</div>
   ${k!=="done"?`<button class="x" data-x="${j.id}" title="${k==="run"?"Stop":"Remove"}">${IC.x}</button>`:""}</div>`;
 $("qwrap").innerHTML=(run.length?`<div class="qsec">Running</div>${run.map(j=>item(j,"run")).join("")}`:"")+
  `<div class="qsec"><span>Up next ${pend.length?`· ${pend.length} · ~${fmt(left)}`:""}</span></div>`+
  (pend.length?pend.map(j=>item(j,"pend")).join(""):'<div class="empty">Nothing queued</div>')+
  (done.length?`<div class="qsec"><span>Finished</span><button id="clearDone">Clear list</button></div>${done.map(j=>item(j,"done")).join("")}`:"");
 done.forEach(j=>{const c=document.querySelector(`canvas[data-th="${j.id}"]`);if(c&&j.status==="done")paint(c,j,1)})}
$("qwrap").addEventListener("click",e=>{
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
 if(!pSame||!sSame){all.style.display="";all.textContent="Reuse all"}else if(!seedSame){all.style.display="";all.textContent="Use this seed"}else all.style.display="none";
 $("peekLbl").textContent=`#${j.id}${j.status==="running"?" · generating":""} · ${j.ar} · ${j.steps} steps${pSame&&sSame&&seedSame?" · same as your draft":""}`}
function loadJob(j){peekJob=j;P.value=j.raw||j.prompt;P.readOnly=true;P.classList.add("peek");P.scrollTop=0;
 const n=$("pname");n.value=j.name||"";n.placeholder="Unnamed";n.readOnly=true;
 peekButtons();$("peekbar").classList.add("show");renderChips();updPrompt();layoutLeft()}
/* Two ways out of a browse: the prompt's ✕ (or Esc in the editor) closes only the prompt — your draft comes back, the
   image stays, and the arrows keep the prompt closed (peekOff) until the browse ends; the image's ✕ (or Esc elsewhere)
   closes both and returns to the live view. */
let peekOff=false;
function closePromptPeek(){if(browseId!=null){peekOff=true;endPeek(true)}else endPeek()}
function endPeek(keep){if(!keep){peekOff=false;if(browseId!=null){browseId=null;resultStale=false;$("cv").dataset.d="";$("cv").dataset.j="";sizeFrame()}}
 if(!peekJob)return;peekJob=null;P.readOnly=false;P.classList.remove("peek");P.value=draft;
 const n=$("pname");n.value=S.pname||"";n.placeholder="Add name";n.readOnly=false;
 $("peekbar").classList.remove("show");renderChips();updPrompt();layoutLeft()}
function reuse(all){const j=peekJob;if(!j)return;const prev={draft,S:{mp:S.mp,ar:S.ar,steps:S.steps,seedMode:S.seedMode,seed:S.seed},loras:LORAS.map(l=>({on:l.on,w:l.w}))};
 draft=j.raw||j.prompt;if(all){Object.assign(S,{mp:j.mp,ar:j.ar,steps:j.steps,seedMode:"fixed",seed:j.seed});LORAS.forEach(l=>{const i=j.loras.findIndex(x=>x.name===l.name);l.on=i>=0;if(i>=0){l.w=j.loras[i].w;l.onAt=Date.now()+i}})}
 endPeek();save();renderAll();P.focus();
 toast(all?`Reused #${j.id} — prompt, settings and LoRAs`:`Reused #${j.id}'s prompt`,"Undo",()=>{draft=prev.draft;P.value=draft;Object.assign(S,prev.S);LORAS.forEach((l,i)=>Object.assign(l,prev.loras[i]));save();renderAll();updPrompt()})}
$("pkPrompt").onclick=()=>reuse(false);$("pkAll").onclick=()=>reuse(true);$("pkX").onclick=()=>closePromptPeek();
P.addEventListener("keydown",e=>{if(!peekJob)return;if(e.key==="Escape"){closePromptPeek();return}
 if(e.key.length===1||e.key==="Backspace"||e.key==="Enter"){if(e.ctrlKey&&e.key==="Enter")return;reuse(false)}});
function updPrompt(){if(window.nameUI)nameUI();const n=P.value.length;$("pcount").textContent=n?n.toLocaleString()+" chars":"";$("play").classList.toggle("off",!P.value.trim()||!!peekJob);
 $("play").title=peekJob?"Choose Reuse first":(!P.value.trim()?"Write a prompt first":"Add to queue (Ctrl+Enter)")}
let dragId=null;
$("qwrap").addEventListener("dragstart",e=>{const q=e.target.closest(".qi");if(!q)return;dragId=+q.dataset.id;q.classList.add("drag")});
$("qwrap").addEventListener("dragend",()=>{dragId=null;renderQueue()});
$("qwrap").addEventListener("dragover",e=>{e.preventDefault();const q=e.target.closest(".qi");if(!q||dragId==null)return;const t=jobs.find(j=>j.id==+q.dataset.id);
 if(!t||t.status!=="pending"||t.id===dragId)return;const a=jobs.findIndex(j=>j.id===dragId),b=jobs.indexOf(t);const [m]=jobs.splice(a,1);jobs.splice(b,0,m);renderQueue();
 const n=document.querySelector(`.qi[data-id="${dragId}"]`);if(n)n.classList.add("drag")});
