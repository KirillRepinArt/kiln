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
const BAR=66; // bar block height incl. gap: 12 + track 10 + 7 + status row 36
/* Wide window = the prompt and the image area as one pair: their own widths (S.lay.pw / S.lay.rw), a fixed 18 px gap,
   the pair centred in the window. A window resize only changes the margins around it. The image area is the same
   rectangle in every tab and for every image shape: Generating fits the picture into it, Queue / LoRAs / PNG Info
   fill it. Edges (composer.js): the divider between them trades width (the prompt stops at its minimum); an outer edge
   follows the cursor, and on release the pair glides back to centre — the same rule as resizing the window.
   (Design agreed 2026-10-18 after the first try left a growing gap in the middle.) */
const LISTMIN=660,GAP=18,PWMIN=360;
/* the edit buttons' column beside the picture: 40 px buttons, 6 px apart and from the picture. Room is kept for as many
   columns as the picture's height needs, so none is ever cut off (the panel clips anything outside the area) */
function tbW(h){const n=document.querySelectorAll("#sideGen button").length||6,per=Math.max(1,Math.floor((Math.max(h,40)+6)/46)),cols=Math.ceil(n/per);return 6+cols*46}
/* Two remembered widths for the right side: rw = the panel width of Queue / LoRAs / PNG Info (the same for every
   picture); iw = in Generating, the largest the picture may be (null = no cap). In Generating the image area HUGS the
   picture: as wide as the picture shown (or, idle, the next ratio) at the available height, capped by iw — so the prompt
   always sits 18 px from the actual picture. Changes glide (CSS transition on the grid). Nothing moves under the
   cursor: while the pointer is over the picture the whole layout holds (a new picture fits inside the held area); while
   it is over the prompt the prompt holds its place and only the picture side reshapes. Leaving lets it glide. */
/* widths are PREFERRED sizes in px (S.lay v:3): a window resize never grows a panel past what you chose — the extra
   goes to the margins; shrinking takes the margins first (down to MMIN), then both panels in proportion, and they come
   back when there's room (flex's "shrink, don't grow"). Shares of the window (v:2) shrank them far too early. */
const layW=()=>innerWidth-36,MMIN=24;
const layDef=()=>({pw:680,rw:Math.max(LISTMIN,tabsW()+2),iw:null,v:3});
const lay={overImg:false,navAt:0,pressCard:false,last:null,drag:false};
/* the picture's height: the stage minus the status row, capped in Generating by S.lay.ih (a share of that height,
   set with the image area's top / bottom edges; null = no cap). While such an edge is held, lay.vh is the live height */
function picH(){const full=$("stage").getBoundingClientRect().height-BAR;if(lay.vh)return Math.min(full,lay.vh);
 const ih=S.lay&&S.lay.ih;return S.view==="gen"&&ih?Math.max(200,Math.min(full,ih*full)):full}
function hugW(){const j=browsed()||current()||shownDone(),ar=j?j.ar:S.ar,[a,b]=ar.split(":").map(Number),h=picH();return h>0?h*a/b+tbW(h):9999}
function layGeo(){const W=layW();
 if(S.lay&&S.lay.v===2){const o=S.lay;S.lay={pw:o.pw*W,rw:o.rw*W,iw:o.iw?o.iw*W:null,ih:o.ih,v:3}}   /* shares → px, once */
 else if(S.lay&&!S.lay.v){S.lay.v=3}
 const L=S.lay||(S.lay=Object.assign(layDef(),S.lw?{pw:S.lw}:{})),minR=minRight(),gen=S.view==="gen";
 let pw=Math.max(PWMIN,Math.min(L.pw,CARDMAX));
 const want=gen?(lay.drag?(L.iw||W):Math.min(L.iw||1e9,hugW())):L.rw;
 let rw=Math.max(minR,want);
 const room=W-GAP-2*MMIN;                                            // too narrow: both give way in proportion
 if(pw+rw>room){const k=Math.max(0,room)/(pw+rw);pw=Math.max(PWMIN,pw*k);rw=Math.max(minR,Math.min(rw*k,W-GAP-pw))}
 const m=Math.max(0,(W-GAP-pw-rw)/2);return{pw,rw,mL:m,mR:m,W,minR,off:0,gen}}
function layApply(g){const app=document.querySelector(".app"),st=app.style,px=v=>Math.round(v*10)/10+"px";
 const mL=Math.max(0,g.mL+(g.off||0)),mR=Math.max(0,g.W-GAP-g.pw-g.rw-mL);
 st.setProperty("--mL",px(mL));st.setProperty("--pw",px(g.pw));st.setProperty("--gap",px(GAP));st.setProperty("--rw",px(g.rw));st.setProperty("--mR",px(mR));st.setProperty("--cw",px(g.pw));
 lay.last=Object.assign({},g,{mL,mR,off:0})}
/* what to apply now. Holds last only while you're doing something, and the layout adjusts the moment you finish:
   flipping with the arrows on the picture holds it (so "next" stays under the cursor) until ~1 s after the last flip;
   a menu open in the prompt box (ratio, size…) or a press in it holds the prompt in place until you let go. */
function layNow(){const g=layGeo();if(!lay.last||lay.drag)return g;
 if(lay.vh)return lay.last;                                                            // a top / bottom edge held: the width waits for the release
 if(lay.overImg&&Date.now()-lay.navAt<1000)return lay.last;
 if(lay.pressCard||document.querySelector("#left .pop.show")){g.pw=lay.last.pw;g.rw=Math.max(g.minR,Math.min(g.rw,g.W-GAP-g.pw));   /* the prompt keeps its place and its width */
  g.mL=g.mR=Math.max(0,(g.W-GAP-g.pw-g.rw)/2);g.off=lay.last.mL-g.mL;return g}
 return g}
/* an edge drag, in px from where it started. dv = the divider (the prompt's inner edge and the image area's inner edge
   are the same boundary): one panel grows exactly as much as the other shrinks. po / ro = the outer edges: that panel
   changes and the pair is held still (off) so the edge stays under the cursor; layRelease() lets it re-centre.
   In Generating the right-side width written is the picture's cap (iw), elsewhere the panel width (rw). */
function layDrag(edge,g0,dx){const g=Object.assign({},g0),W=layW(),R=document.querySelector(".app").classList.contains("pright");
 if(R){dx=-dx;if(edge==="po"||edge==="ro")return layDragR(edge,g0,dx,W)}   /* prompt on the right: everything mirrored */
 if(edge==="dv"){const pw=Math.max(PWMIN,Math.min(CARDMAX,g0.pw+g0.rw-g0.minR,g0.pw+dx));g.rw=g0.rw-(pw-g0.pw);g.pw=pw}
 if(edge==="po"){const pw=Math.max(PWMIN,Math.min(CARDMAX,g0.pw+g0.mL,g0.pw-dx));g.pw=pw;const W2=g.W-GAP-g.pw-g.rw;g.off=(g0.mL-(pw-g0.pw))-W2/2}
 if(edge==="ro"){const rw=Math.max(g0.minR,Math.min(g0.rw+g0.mR,g0.rw+dx));g.rw=rw;const W2=g.W-GAP-g.pw-g.rw;g.off=g0.mL-W2/2}
 g.mL=g.mR=Math.max(0,(g.W-GAP-g.pw-g.rw)/2);
 S.lay.pw=g.pw;if(g0.gen)S.lay.iw=g.rw;else S.lay.rw=g.rw;layApply(g);return g}
/* prompt on the right: the left margin sits next to the image area's outer edge */
function layDragR(edge,g0,dx,W){const g=Object.assign({},g0);
 if(edge==="po"){const pw=Math.max(PWMIN,Math.min(CARDMAX,g0.pw+g0.mR,g0.pw-dx));g.pw=pw;const W2=g.W-GAP-g.pw-g.rw;g.off=g0.mL-W2/2}
 if(edge==="ro"){const rw=Math.max(g0.minR,Math.min(g0.rw+g0.mL,g0.rw+dx));g.rw=rw;const W2=g.W-GAP-g.pw-g.rw;g.off=(g0.mL-(rw-g0.rw))-W2/2}   /* dx arrives mirrored: leftwards grows it */
 g.mL=g.mR=Math.max(0,(g.W-GAP-g.pw-g.rw)/2);
 S.lay.pw=g.pw;if(g0.gen)S.lay.iw=g.rw;else S.lay.rw=g.rw;layApply(g);return g}
function layRelease(){lay.drag=false;sizeFrame()}
/* the prompt's place: "left" / "right" beside the picture (horizontal) or "below" it (vertical). Switching is a
   fade-through (Material's pattern for elements whose paths would cross): the old layout fades out, the new one fades in
   where it belongs — sliding made the panels pass through each other. */
function setDock(z){if((S.dock||"left")===z)return;
 layMorph(()=>{S.dock=z;save();lyFrozen=false;lyTop=null;lyCy=null;applyMode();sizeFrame();layoutLeft();moveThumb(true);sizeFrame();layoutLeft();if(window.layMenuUI)layMenuUI()})}
/* a layout switch as a View Transition: the old layout is a snapshot, the new one is applied with every glide off (so it
   is captured where it ends, not mid-way), then they cross-fade (CSS ::view-transition-*). Without the API: a plain switch */
function layMorph(fn){const b=document.body,h=document.documentElement;let ended=false;
 const end=()=>{if(ended)return;ended=true;h.classList.remove("laymorph");requestAnimationFrame(()=>requestAnimationFrame(()=>b.classList.remove("laysnap")));setTimeout(()=>b.classList.remove("laysnap"),200)};
 setTimeout(end,1500);   /* whatever happens to the transition (skipped, a hidden window pausing frames), the glides come back */
 b.classList.add("laysnap");
 if(!document.startViewTransition||matchMedia("(prefers-reduced-motion: reduce)").matches){fn();end();return}
 h.classList.add("laymorph");try{document.startViewTransition(fn).finished.finally(end)}catch(e){fn();end()}}
function sizeFrame(){const app=document.querySelector(".app"),stk=app.classList.contains("stacked");const j=browsed()||current()||shownDone();const ar=j?j.ar:S.ar;
 if(!stk&&!sizeFrame.hold)layApply(layNow());
 /* the target geometry, not a measurement: the grid may be mid-glide */
 const st=$("stage").getBoundingClientRect(),SW=stk?st.width:lay.last.rw;const f=$("frame");
 const PH=stk?st.height-BAR:picH(),TB=tbW(PH);fitBox(f,ar,SW-(stk?2:1)*TB,PH);const w=parseFloat(f.style.width),h=parseFloat(f.style.height);   /* Vertical keeps the column's room on both sides */
 let top=Math.max(0,(st.height-h-BAR)/2);if(lay.vtop!=null)top=lay.vtop;   /* a held top / bottom edge: the other edge stays put */
 /* picture + toolbar as one group, centred in the area; the toolbar on the side away from the prompt */
 const tbLeft=!stk&&document.querySelector(".app").classList.contains("pright"),g0=Math.max(0,Math.floor((SW-w-TB)/2)),left=stk?Math.floor((SW-w)/2):tbLeft?g0+TB:g0;   /* Vertical: the picture itself on the centre line (the prompt box and the tab bar are centred there too); its column hangs in the margin */
 f.style.left=left+"px";f.style.top=top+"px";
 const gt=$("gtools");if(gt){gt.style.top=top+"px";gt.style.left=(tbLeft?left-TB:left+w)+"px";gt.style.width=TB+"px";gt.style.height=Math.max(40,h)+"px";gt.classList.toggle("lefty",tbLeft)}
 /* where the picture is going (not where it is mid-glide): the prompt's vertical anchors use this */
 lay.target={top:st.top+top,h,bottom:st.top+top+h+BAR-1,w};
 const he=$("hedges");if(he){he.style.left=left+"px";he.style.width=w+"px";he.style.top=top+"px";he.style.height=h+"px"}
 /* tab bar: centred over the panel in Queue / LoRAs / PNG Info; in Generating it sits right on top of the picture and is
    centred on the picture itself, not on picture + button column — as far as the area allows (it never pokes out) */
 const tb=document.querySelector(".tabs");if(tb){tb.style.width=stk?"":SW+"px";const gen=S.view==="gen";
  const room=Math.max(0,(SW-tabsW())/2),dx=gen&&!stk?Math.max(-room,Math.min(room,Math.round(left+w/2-SW/2))):0;
  tb.style.transform=gen&&(top>0||dx)?`translate(${dx}px,${Math.round(Math.max(0,top))}px)`:""}
 const sx=0;const pr=$("prog");pr.style.left=(left+sx)+"px";pr.style.width=w+"px";pr.style.top=(top+h+12)+"px";pr.style.setProperty("--tw",w+"px");
 if(window.layoutLeft)requestAnimationFrame(layoutLeft)}
/* the holds: over the picture, over the prompt (card, its name row, its LoRA chips) */
$("frame").addEventListener("pointerenter",()=>{lay.overImg=true});
$("frame").addEventListener("pointerleave",()=>{lay.overImg=false;sizeFrame()});
$("lcol").addEventListener("pointerdown",()=>{lay.pressCard=true});
/* letting go anywhere (a menu choice, a click, an edge) lets the layout catch up at once */
addEventListener("pointerup",()=>{lay.pressCard=false;setTimeout(sizeFrame,0)});
addEventListener("click",()=>setTimeout(sizeFrame,0));
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
function genNav(dir,dry){if(!dry&&lay.overImg){lay.navAt=Date.now();clearTimeout(genNav.t);genNav.t=setTimeout(sizeFrame,1050)}const run=!!current(),b=browsed(),cur=b||(run?null:shownDone()),L=doneList();
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
function tick(){if(current()||window.qPaused)return;const j=jobs.find(j=>j.status==="pending");if(!j){renderAll();return}
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
