/* Kiln · tabs, image frame sizing, queue core, browsing, the frame loop (demo runner) */
/* ======================= tabs ======================= */
function moveThumb(instant){const t=document.querySelector(".tab.on"),th=$("thumb");if(!t)return;if(instant)th.style.transition="none";th.style.left=t.offsetLeft+"px";th.style.width=t.offsetWidth+"px";if(instant){void th.offsetWidth;th.style.transition=""}}
function showView(v){const was=S.view;
 if(was!==v){ // temporary state belongs to the visit: an open preview, a browse, a search, a scroll position
  if(was==="queue")$("qwrap").scrollTop=0; // the prompt box (and its peek) is left as it is
  if(was==="loras"){$("lsearch").value="";$("lscroll").scrollTop=0}}
 S.view=v;$("rpanel").classList.toggle("paneled",v!=="gen");document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("on",t.dataset.v===v));moveThumb();
 document.querySelectorAll(".view").forEach(x=>x.classList.toggle("on",x.id==="v-"+v));if(v==="queue")renderQueue();if(v==="loras")renderLoras();sizeFrame()}
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>showView(t.dataset.v));

/* ======================= mock image ======================= */
function rng(seed){let s=seed>>>0||1;return()=>((s=Math.imul(s^s>>>15,1|s)+0x6D2B79F5|0,(s>>>0)/4294967296))}
function paint(cv,job,progress){const [w,h]=SIZES[job.mp][job.ar];const W=Math.round(w/4),H=Math.round(h/4);cv.width=W;cv.height=H;
 const c=cv.getContext("2d");const r=rng(job.seed);const h1=r()*360,h2=(h1+60+r()*120)%360;
 const g=c.createLinearGradient(0,0,W*r(),H);g.addColorStop(0,`hsl(${h1},45%,${18+r()*15}%)`);g.addColorStop(1,`hsl(${h2},40%,${10+r()*20}%)`);c.fillStyle=g;c.fillRect(0,0,W,H);
 for(let i=0;i<9;i++){const x=r()*W,y=r()*H,rad=(0.12+r()*0.35)*Math.min(W,H);const rg=c.createRadialGradient(x,y,0,x,y,rad);
  rg.addColorStop(0,`hsla(${(h1+r()*90)%360},55%,${40+r()*30}%,.55)`);rg.addColorStop(1,"hsla(0,0%,0%,0)");c.fillStyle=rg;c.fillRect(0,0,W,H)}
 c.fillStyle="rgba(255,255,255,.08)";c.font=`${Math.round(W/16)}px Segoe UI`;c.fillText(`seed ${job.seed}`,W*.05,H*.95);
 if(progress<1){const k=Math.max(.03,progress*progress*.6);const sw=Math.max(2,Math.round(W*k)),sh=Math.max(2,Math.round(H*k));
  const t=document.createElement("canvas");t.width=sw;t.height=sh;const tc=t.getContext("2d");tc.imageSmoothingQuality="high";tc.drawImage(cv,0,0,sw,sh);
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality="high";c.clearRect(0,0,W,H);c.drawImage(t,0,0,W,H)}}
function fitBox(el,ar,bw,bh){const [a,b]=ar.split(":").map(Number);let w=bw,h=bw*b/a;if(h>bh){h=bh;w=bh*a/b}el.style.width=w+"px";el.style.height=h+"px"}
const BAR=56; // bar block height incl. gap
/* Wide window = a fixed pane (the prompt card, width set with the divider: S.lw) + a flexible pane (the right box).
   The right box is the same rectangle in every tab — Generating centres the image in it, Queue / LoRAs / PNG Info
   fill it — so nothing moves when you switch tabs. Card + box are centred as one group (equal outer margins).
   The box is as wide as the image, but never narrower than the tab bar or two LoRA columns (LISTMIN). */
const LISTMIN=660;
function sizeFrame(){const app=document.querySelector(".app"),stk=app.classList.contains("stacked");const j=browsed()||current()||shownDone();const ar=j?j.ar:S.ar;
 const TW=tabsW();
 if(!stk){const avail=innerWidth-36-18,cw=Math.max(360,Math.min(S.lw||680,CARDMAX,avail-minRight()));const sh=$("stage").getBoundingClientRect().height-BAR;
  const [a,b]=ar.split(":").map(Number);const iw=Math.min(avail-cw,sh*a/b),rw=Math.floor(Math.min(avail-cw,Math.max(iw,TW,LISTMIN)));const side=Math.max(0,Math.floor((avail-cw-rw)/2));
  app.style.setProperty("--lc",(side+cw)+"px");app.style.setProperty("--cw",cw+"px");app.style.setProperty("--rc",rw+"px")}
 const st=$("stage").getBoundingClientRect();const f=$("frame");
 fitBox(f,ar,st.width,st.height-BAR);const w=parseFloat(f.style.width),h=parseFloat(f.style.height);
 const top=Math.max(0,(st.height-h-BAR)/2),left=stk?0:Math.max(0,Math.floor((st.width-w)/2));f.style.left=left+"px";f.style.top=top+"px";
 // tab bar: centred over the box in every tab; in Generating it also sits right on top of the image
 const tb=document.querySelector(".tabs");if(tb){tb.style.width=stk?"":$("rpanel").offsetWidth+"px";tb.style.transform=S.view==="gen"&&top>0?`translateY(${Math.round(top)}px)`:""}
 const sx=document.querySelector(".app.stacked")?(st.width-w)/2:0;const pr=$("prog");pr.style.left=(left+sx)+"px";pr.style.width=w+"px";pr.style.top=(top+h+12)+"px";pr.style.setProperty("--tw",w+"px");
 if(window.layoutLeft)requestAnimationFrame(layoutLeft)}
// live resize: everything follows the window edge directly; animations return ~150 ms after the last resize event
let lrT=null;
window.addEventListener("resize",()=>{document.body.classList.add("liveresize");clearTimeout(lrT);lrT=setTimeout(()=>document.body.classList.remove("liveresize"),150);
 applyMode();applyPH();sizeFrame();syncH();moveThumb(true)});
document.fonts&&document.fonts.ready.then(()=>moveThumb(true));

/* ======================= queue ======================= */
function current(){return jobs.find(j=>j.status==="running")}
function jEst(j){return j.est||j.steps*(SEC_PER_STEP[j.mp]||60)} // the server's history-based estimate when there is one
function lastDone(){return [...jobs].reverse().find(j=>j.status==="done")}
let resultStale=false;function shownDone(){return browsed()||(resultStale?null:lastDone())}
/* ======================= browsing finished images =======================
   ← / → (or the arrows on the image) step through finished images: in the Generating view, the queue overlay and
   the full-size viewer. Browsing back holds that image even when a new one finishes; stepping past the newest
   returns to the live render. */
let browseId=null;
function doneList(){return jobs.filter(j=>j.status==="done")}
function browsed(){if(browseId==null)return null;const b=jobs.find(j=>j.id===browseId&&j.status==="done");if(!b)browseId=null;return b||null}
function genNav(dir,dry){const run=!!current(),b=browsed(),cur=b||(run?null:shownDone()),L=doneList();
 let i=cur?L.findIndex(x=>x.id===cur.id):L.length;if(i<0)i=L.length;const n=i+dir;let id;
 if(n<0)return false;if(n>=L.length){if(!b)return false;id=null}else id=L[n].id; // past the newest: back to your working view
 if(!dry){browseId=id;resultStale=false;$("cv").dataset.d="";$("cv").dataset.j="";sizeFrame();if(id==null)endPeek();else if(!peekOff)loadJob(L[n])}return true}
function vNav(dir,dry){const L=doneList(),i=L.findIndex(x=>x.id===(V.job&&V.job.id)),t=L[i+dir];if(i<0||!t)return false;if(!dry)openViewer(t);return true}
function navFn(el){return el.closest("#viewer")?vNav:genNav}
function updNav(){document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("off",!navFn(b)(+b.dataset.nav,true)))}
document.addEventListener("click",e=>{const b=e.target.closest(".nav");if(!b)return;e.stopPropagation();navFn(b)(+b.dataset.nav);updNav()},true);
document.addEventListener("keydown",e=>{if((e.key!=="ArrowLeft"&&e.key!=="ArrowRight")||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey)return;
 const a=document.activeElement;if(a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)))return;if($("modal").classList.contains("show"))return;
 const f=$("viewer").classList.contains("show")?vNav:S.view==="gen"?genNav:null;
 if(f&&f(e.key==="ArrowLeft"?-1:1)){e.preventDefault();updNav()}});
function stripComments(t){return t.split("\n").filter(l=>!/^\s*\/\//.test(l)).join("\n").replace(/\n{3,}/g,"\n\n").trim()}
function expandVariants(t){const picks=[];const out=t.replace(/\{([^{}]*\|[^{}]*)\}/g,(m,body)=>{const o=body.split("|").map(x=>x.trim());const c=o[Math.floor(Math.random()*o.length)];picks.push(c);return c});return{text:out,picks}}
function addJobs(){if(peekJob){toast("Viewing a queued prompt — choose Reuse, or ✕ to go back");return}const text=P.value.trim();if(!text){toast("Write a prompt first");return}
 const on=LORAS.filter(l=>l.on);on.forEach(l=>l.used=Date.now());
 const L=on.map(l=>({name:l.name,w:l.w}));
 for(let i=0;i<S.n;i++){const seed=S.seedMode==="random"?Math.floor(Math.random()*4294967295):(S.seed+i)>>>0;
  const nm=S.pname.trim();let file=null;if(nm){const slug=slugify(nm);S.ncount[slug]=(S.ncount[slug]||0)+1;file=`${slug}-${String(S.ncount[slug]).padStart(3,"0")}.png`}
  const ex=expandVariants(stripComments(text));
  jobs.push({id:nextId++,name:nm,file,prompt:ex.text,raw:text,picks:ex.picks,mp:S.mp,ar:S.ar,steps:S.steps,seed,loras:L,status:"pending",step:0})}
 save();toast(S.n>1?`Added ${S.n} jobs to the queue`:"Added to queue");tick();renderAll()}
$("play").onclick=()=>{askNotify();addJobs()};
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();addJobs()}
 if(e.key==="Escape"){if($("viewer").classList.contains("show")){closeViewer();return}
  if($("modal").classList.contains("show")){$("modal").classList.remove("show");return}
  if(browseId!=null&&!(e.target.closest&&e.target.closest(".pwrapT"))){closeShown();return} // Esc outside the editor = the image's ✕
  closePops()}});
function tick(){if(current())return;const j=jobs.find(j=>j.status==="pending");if(!j){renderAll();return}
 j.status="running";j.started=Date.now();j.step=0;j.stepStart=Date.now();const est=SEC_PER_STEP[j.mp]*1000/S.demo;j.est=est;const r=rng(j.seed^0x9e37);
 const next=()=>{if(j.status!=="running")return;j.timer=setTimeout(()=>{if(j.status!=="running")return;j.step++;j.stepStart=Date.now();
   if(j.step>=j.steps){j.status="done";j.finished=Date.now();justDone=j.id;resultStale=false;onJobDone(j);renderAll();tick()}else next()},est*(.8+r()*.4))};next();renderAll()}
function stopJob(j){if(!j)return;clearTimeout(j.timer);if(j.status==="running"){j.status="cancelled";toast("Stopped")}else if(j.status==="pending")jobs=jobs.filter(x=>x!==j);renderAll();tick()}
$("stopBtn").onclick=()=>stopJob(current());
$("prog").addEventListener("click",e=>{if(e.target.closest(".stop"))return;const b=browsed();if(b){peekOff=false;loadJob(b);return}const j=current();if(j)loadJob(j)}); // peek at the shown image's prompt
function browseStatus(){const b=browsed(),on=!!(b&&peekOff);$("prog").classList.toggle("showp",on);if(on&&!window._dp)$("ptxt").textContent=`#${b.id} · Show prompt`}
function frame(){const j=current();const prog=$("prog");
 if(j){prog.classList.add("show","run");
  const part=Math.min((Date.now()-j.stepStart)/j.est,.95);const p=(j.step+part)/j.steps;$("fill").style.width=(p*100).toFixed(2)+"%";
  $("ptxt").textContent=`Step ${Math.min(j.step+1,j.steps)}/${j.steps}`;$("peta").textContent=`~${fmt(Math.max(0,(j.steps-j.step-part)*j.est*S.demo/1000))} left`;
  if(S.view==="gen"&&!browsed()){$("frame").classList.add("has");$("idle").style.display="none";if(+$("cv").dataset.j!==j.id){$("cv").dataset.j=j.id;sizeFrame()}paint($("cv"),j,p)}
  const mini=document.querySelector(`.qi[data-id="${j.id}"] .mini i`);if(mini)mini.style.width=(p*100)+"%";
 }else if(!window._dp){prog.classList.add("show");prog.classList.remove("run");$("fill").style.width="0%";$("ptxt").textContent="Ready";$("peta").textContent=`~${fmt(S.steps*SEC_PER_STEP[S.mp])} per image`}
 if(!j||browsed()){const d=shownDone();
  if(d&&S.view==="gen"){if($("cv").dataset.d!=d.id){$("cv").dataset.d=d.id;$("cv").dataset.j="";sizeFrame();
    if(justDone===d.id){const f=$("frame");f.classList.remove("reveal");void f.offsetWidth;f.classList.add("reveal");setTimeout(()=>f.classList.remove("reveal"),1200);justDone=null}
    paint($("cv"),d,1)}$("frame").classList.add("has");$("idle").style.display="none"}
  else if(!d){$("frame").classList.remove("has");$("idle").style.display="";const c=$("cv");if(c.width>1){c.width=1;c.height=1;c.dataset.d="";c.dataset.j=""}}}
 browseStatus();requestAnimationFrame(frame)}
requestAnimationFrame(frame);
