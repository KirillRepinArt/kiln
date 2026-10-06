/* ======================= LIVE MODE =======================
   When served by server.py, swap the simulated runner for the real queue.
   Opened as a file, none of this runs and the demo stays as it was. */
(async function(){
 if(!location.protocol.startsWith("http"))return;
 let st;try{st=await (await fetch("/api/state")).json()}catch(e){return}
 window.LIVE=true;
 const api=(p,b)=>fetch(p,b===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(r=>r.json());
 document.documentElement.classList.add("live");
 $("demoNote").textContent="";
 $("sDemo").closest(".fg")&&($("sDemo").previousElementSibling.style.display="none",$("sDemo").style.display="none");

 /* ---------- images: real files and live previews, cached ---------- */
 const imgs={};
 function img(url){if(!imgs[url]){const i=new Image();i.decoding="async";imgs[url]={i,p:new Promise(r=>{i.onload=()=>r(i);i.onerror=()=>r(null)})};i.src=url}return imgs[url]}
 function urlFor(j){return j.file?`/files/${encodeURIComponent(j.file)}`:null}
 function drawTo(cv,im,natural){const dpr=devicePixelRatio||1,iw=im.naturalWidth,ih=im.naturalHeight;
  if(natural){if(cv.width!==iw||cv.height!==ih){cv.width=iw;cv.height=ih}const c=cv.getContext("2d");c.drawImage(im,0,0);return}
  // the canvas takes its box's shape; the image keeps its own (a preview of another shape never gets stretched)
  const cw=cv.clientWidth||300,ch=cv.clientHeight||Math.round(cw*ih/iw);const W=Math.max(64,Math.round(cw*dpr)),H=Math.max(64,Math.round(ch*dpr));
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}const c=cv.getContext("2d");c.imageSmoothingQuality="high";c.clearRect(0,0,W,H);
  const k=cv.id==="cv"?Math.min(W/iw,H/ih):Math.max(W/iw,H/ih);c.drawImage(im,(W-iw*k)/2,(H-ih*k)/2,iw*k,ih*k)}
 window.paint=function(cv,j,progress){const u=urlFor(j);if(!u)return;const e=img(u);
  if(e.i.complete&&e.i.naturalWidth)drawTo(cv,e.i,cv.id==="vcv");else e.p.then(im=>{if(im)drawTo(cv,im,cv.id==="vcv")})};

 /* ---------- server job -> UI job ---------- */
 function toUI(s){const sp=s.spec||{};return Object.assign({},sp,{id:s.id,kind:s.kind,status:s.status,file:s.file||null,
  seed:s.seed_used??sp.seed,est:s.est,est_first:s.est_first,t_first:s.t_first&&s.t_first*1000,step:s.step||0,steps:s.steps||sp.steps||0,progress:s.progress||0,eta:s.eta,preview_rev:s.preview_rev||0,
  error:s.error,started:s.started&&s.started*1000,finished:s.finished&&s.finished*1000,loras:sp.loras||[],mp:sp.mp||"1.0",ar:sp.ar||"1:1"})}
 let sig="",forgeOk=true,forgeStarting=false,firstPoll=true,loadingM=false;const seen=new Set();
 async function poll(){let s;try{s=await (await fetch("/api/state")).json()}catch(e){forgeMsg("Kiln server not reachable");return}
  forgeOk=s.forge.ok;forgeStarting=!!s.forge.starting;
  if(forgeOk&&!models&&!loadingM){loadingM=true;loadModels(false).then(ok=>{loadingM=false;if(ok){refreshUp();toast("Forge is ready — models and LoRAs loaded")}})}
  for(const b in s.stats.sec_per_step||{})SEC_PER_STEP[b]=Math.max(1,s.stats.sec_per_step[b]);
  if((typeof dragId!=="undefined"&&dragId!=null)||window._rp){setTimeout(poll,700);return} // dragging, or the new order not saved yet: keep the local order
  const prev=new Map(jobs.map(j=>[j.id,j]));
  jobs=s.jobs.map(x=>{const u=toUI(x),o=prev.get(u.id);if(o&&o.status==="running"&&u.status==="running"){u._ss=o._ss;u._lastStep=o._lastStep}return u});
  for(const j of jobs){if(j.status==="done"&&!seen.has(j.id)){seen.add(j.id);neKey="";if(!firstPoll){justDone=j.id;resultStale=false;onJobDone(j)}}
   if(j.status==="error"&&!seen.has("e"+j.id)){seen.add("e"+j.id);if(!firstPoll)toast(`Job #${j.id} failed: ${j.error||"error"}`)}}
  firstPoll=false;
  if(peekJob)peekJob=jobs.find(j=>j.id===peekJob.id)||peekJob;
  const ns=jobs.map(j=>`${j.id}:${j.status}:${j.file}`).join("|");
  if(ns!==sig){sig=ns;renderAll()}else{const n=jobs.filter(j=>j.status==="pending"||j.status==="running").length;$("badge").textContent=n;$("badge").classList.toggle("show",n>0);$("tabN").textContent=n||""}
  setTimeout(poll,current()?700:1800)}

 /* ---------- queue actions -> server ---------- */
 window.tick=function(){};
 window.addJobs=async function(){if(peekJob){toast("Viewing a queued prompt — choose Reuse, or ✕ to go back");return}
  const text=P.value.trim();if(!text){toast("Write a prompt first");return}
  const on=LORAS.filter(l=>l.on);on.forEach(l=>l.used=Date.now());const L=on.map(l=>({name:l.name,w:+l.w}));
  const set=S.set||{},[sampler,scheduler]=(set.sampler||"Euler · Simple").split(" · ");const [w,h]=SIZES[S.mp][S.ar];
  const mods=[set.vae,set.te].filter(Boolean);
  const specs=[];for(let i=0;i<S.n;i++){const seed=S.seedMode==="random"?Math.floor(Math.random()*4294967295):(S.seed+i)>>>0;
   const ex=expandVariants(stripComments(text));
   specs.push({prompt:ex.text,raw:text,picks:ex.picks,name:S.pname.trim(),mp:S.mp,ar:S.ar,w,h,steps:S.steps,seed,loras:L,
    checkpoint:set.ckpt||undefined,modules:mods.length?mods:undefined,shift:+(set.shift||1.15),cfg:+(set.cfg||1),sampler,scheduler})}
  save();await api("/api/jobs",{jobs:specs});toast(S.n>1?`Added ${S.n} jobs to the queue`:"Added to queue");
  if(!forgeOk)setTimeout(()=>toast("Queued — Forge isn't running yet, jobs start when it is"),2300);poll()};
 window.stopJob=async function(j){if(!j)return;await api(`/api/jobs/${j.id}/cancel`,{});if(j.status==="running")toast("Stopping…");poll()};
 $("qwrap").addEventListener("drop",()=>{},true);
 $("qwrap").addEventListener("dragend",()=>{const ids=[...document.querySelectorAll('.qi[draggable="true"]')].map(q=>+q.dataset.id);window._rp=true;
  api("/api/reorder",{ids}).finally(()=>{window._rp=false;poll()})});
 $("qwrap").addEventListener("click",e=>{if(e.target.id==="clearDone"){e.stopImmediatePropagation();api("/api/clear",{}).then(poll)}},true);
 window.openInApp=j=>api("/api/open",{id:j.id});
 function act(a,j){if(!j)return;
  if(a==="open")return api("/api/open",{id:j.id});
  if(a==="folder")return api("/api/reveal",{id:j.id});
  if(a==="up"){const u=(S.set||{}).upscaler||(models&&models.upscalers[0]);if(!u)return toast("No upscalers found in Forge");
   return api("/api/upscale",{id:j.id,upscaler:u,scale:+((S.set||{}).upscale||2)}).then(()=>{toast(`Upscale ×${(S.set||{}).upscale||2} queued (${u})`);poll()})}
  if(a==="i2i")return toast("img2img is next on the roadmap")}
 for(const [el,get] of [[$("sideGen"),()=>shownDone()]]){
  el.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||b.dataset.a==="thumb")return;e.stopImmediatePropagation();act(b.dataset.a,get())},true)}

 /* ---------- LoRA thumbnails stored by the server ---------- */
 window.setThumbs=async function(j){if(!j)return;const faces=j.loras.map(x=>LORAS.find(l=>l.name===x.name)).filter(l=>l&&l.folder==="people");
  if(!faces.length){toast("This image used no face LoRA");return}
  const im=await img(urlFor(j)).p;if(!im)return;const t=document.createElement("canvas");t.width=t.height=256;
  const s=Math.min(im.naturalWidth,im.naturalHeight);t.getContext("2d").drawImage(im,(im.naturalWidth-s)/2,(im.naturalHeight-s)*.22,s,s,0,0,256,256);
  const data=t.toDataURL("image/jpeg",.85);
  for(const l of faces){const r=await api("/api/thumb",{name:l.name,data});l.thumb=r.url+"?t="+Date.now()}
  save();renderLoras();toast(`Thumbnail set for ${faces.map(l=>l.display).join(", ")}`)};

 /* ---------- models, LoRAs and settings from Forge ---------- */
 let models=null;
 function forgeMsg(m){if(!current()){$("ptxt").textContent=m;$("peta").textContent=""}}
 async function loadModels(refresh){try{const r=await fetch("/api/models"+(refresh?"?refresh":""));if(!r.ok)throw 0;models=await r.json()}catch(e){models=null;return false}
  let saved={};try{(JSON.parse(localStorage.getItem("kiln_state")||"{}").loras||[]).forEach(x=>saved[x.name]=x)}catch(e){}
  const keep=Object.fromEntries(LORAS.map(l=>[l.name,l]));
  LORAS.length=0;
  for(const m of models.loras){const p=parseName(m.name,m.category),sv=saved[m.name]||{},k=keep[m.name]||{};
   LORAS.push({name:m.name,folder:m.category,display:sv.display||p.display,tags:p.tags,w:k.w??sv.w??(m.category==="people"?.7:.5),
    on:k.on??!!sv.on,onAt:k.onAt??sv.onAt??0,recipe:false,note:m.folder?m.folder+(m.internal&&m.internal!==m.name?" · "+m.internal:""):(m.internal&&m.internal!==m.name?m.internal:""),
    fav:!!sv.fav,used:sv.used||0,thumb:m.thumb||null})}
  const sel=(key,opts,label)=>{const el=document.querySelector(`[data-set="${key}"]`);if(!el)return;const cur=(S.set||{})[key]||"";
   el.innerHTML=`<option value="">${label}</option>`+opts.map(o=>`<option value="${esc(o.v)}">${esc(o.t)}</option>`).join("");el.value=opts.some(o=>o.v===cur)?cur:"";S.set[key]=el.value};
  const curCk=(models.current.sd_model_checkpoint||"").replace(/\s*\[[0-9a-f]+\]$/,"");
  sel("ckpt",models.checkpoints.map(c=>({v:c,t:c.replace(/\s*\[[0-9a-f]+\]$/,"")})),`Keep Forge's current (${curCk||"none"})`);
  const vae=models.modules.filter(m=>/vae|\bae\b/i.test(m.name)),te=models.modules.filter(m=>!/vae|\bae\b/i.test(m.name));
  sel("vae",vae.map(m=>({v:m.file,t:m.name})),"Keep Forge's current");sel("te",te.map(m=>({v:m.file,t:m.name})),"Keep Forge's current");
  renderLoras();renderChips();return true}
 // settings: read-only server facts + upscaler choice
 const fg=document.querySelector(".mcard .fg");
 fg.querySelector('[data-set="outdir"]').value=st.out_dir;fg.querySelector('[data-set="outdir"]').readOnly=true;
 const fu=fg.querySelector('[data-set="forge"]');fu.readOnly=true;fu.title="Set in config.local.json";
 const up=document.createElement("select");up.dataset.set="upscaler";const upl=document.createElement("label");upl.textContent="Upscaler";
 const us=document.createElement("select");us.dataset.set="upscale";us.innerHTML='<option value="2">×2</option><option value="1.5">×1.5</option><option value="4">×4</option>';
 const usl=document.createElement("label");usl.textContent="Upscale by";
 const fx=$("fghFx");for(const el of [upl,up,usl,us])fg.insertBefore(el,fx);
 for(const el of [up,us]){el.addEventListener("change",()=>{S.set[el.dataset.set]=el.value;save()})}
 const refreshUp=()=>{if(!models)return;up.innerHTML=models.upscalers.map(u=>`<option>${esc(u)}</option>`).join("");if(S.set.upscaler)up.value=S.set.upscaler;us.value=S.set.upscale||"2"};
 const rb=document.createElement("button");rb.className="btn";rb.textContent="Refresh models & LoRAs";rb.onclick=async()=>{rb.textContent="Refreshing…";await loadModels(true);refreshUp();rb.textContent="Refresh models & LoRAs";toast("Models and LoRAs refreshed")};
 document.querySelector(".mcard .pact div").append(rb);

 /* ---------- progress: real steps, smooth glide in between, live preview ---------- */
 let lastPrev=0,prevLoading=false;
 /* countdown from the history-based total; if the first step came late compared with history, stretch it */
 function remaining(j){if(!j.est||!j.started)return null;const el=(Date.now()-j.started)/1000;let f=1;
  if(j.t_first&&j.est_first){const at=(j.t_first-j.started)/1000;f=Math.max(.75,Math.min(2.5,at/j.est_first))}
  const r=j.est*f-el;return r>2?r:null} // overdue: fall back to step timing
 let nextEst=null,neKey="";
 function refreshEst(){const [w,h]=SIZES[S.mp][S.ar],k=`${w}x${h}x${S.steps}`;if(k===neKey)return;neKey=k;
  api("/api/estimate",{spec:{w,h,steps:S.steps}}).then(r=>{if(neKey===k)nextEst=r.est}).catch(()=>{})}
 window.frame=function(){const j=current();const prog=$("prog");
  if(j){prog.classList.add("show","run");
   const per=Math.max(1,SEC_PER_STEP[j.mp]||60)*1000;
   if(j._lastStep!==j.step){j._lastStep=j.step;j._ss=Date.now()}
   const part=j.steps?Math.min((Date.now()-(j._ss||Date.now()))/per,.95):0;
   const p=j.steps?Math.min(1,(j.step+part)/j.steps):0;$("fill").style.width=(p*100).toFixed(2)+"%";
   const rm=remaining(j),left=rm!=null?rm:(j.eta&&j.eta>0?j.eta:Math.max(0,(j.steps-j.step-part)*per/1000));
   const started=j.step||j.preview_rev;$("ptxt").textContent=j.kind==="upscale"?"Upscaling…":started?`Step ${Math.min(j.step+1,j.steps)}/${j.steps}`:"Loading model…";
   $("peta").textContent=j.kind==="upscale"?"":(started||rm!=null)?`~${fmt(left)} left`:"";
   if(S.view==="gen"&&!browsed()){const f=$("frame");f.classList.add("has");$("idle").style.display="none";
    if(+$("cv").dataset.j!==j.id){$("cv").dataset.j=j.id;$("cv").dataset.d="";lastPrev=0;const c=$("cv");c.width=1;c.height=1;sizeFrame()}
    if(j.preview_rev&&j.preview_rev!==lastPrev&&!prevLoading){prevLoading=true;const r=j.preview_rev;const i=new Image();
     i.onload=()=>{drawTo($("cv"),i,false);lastPrev=r;prevLoading=false};i.onerror=()=>{prevLoading=false;lastPrev=r};i.src=`/api/preview/${j.id}?r=${r}`}}
   const mini=document.querySelector(`.qi[data-id="${j.id}"] .mini i`);if(mini)mini.style.width=(p*100)+"%";
  }else if(!window._dp){prog.classList.add("show");prog.classList.remove("run");$("fill").style.width="0%";
    if(!forgeOk){$("ptxt").textContent=forgeStarting?"Starting Forge…":"Forge not running";$("peta").textContent=forgeStarting?"jobs start when it's ready":"queue waits for it"}
    else{refreshEst();$("ptxt").textContent="Ready";$("peta").textContent=`~${fmt(nextEst??S.steps*(SEC_PER_STEP[S.mp]||60))} per image`}}
  if(!j||browsed()){const d=shownDone();
   if(d&&S.view==="gen"){if($("cv").dataset.d!=d.id){$("cv").dataset.d=d.id;$("cv").dataset.j="";sizeFrame();
     if(justDone===d.id){const f=$("frame");f.classList.remove("reveal");void f.offsetWidth;f.classList.add("reveal");setTimeout(()=>f.classList.remove("reveal"),1200);justDone=null}
     paint($("cv"),d,1)}$("frame").classList.add("has");$("idle").style.display="none"}
   else if(!d){$("frame").classList.remove("has");$("idle").style.display="";const c=$("cv");if(c.width>1){c.width=1;c.height=1;c.dataset.d="";c.dataset.j=""}}}
  browseStatus();requestAnimationFrame(frame)};

 window.jobProgress=function(j){const per=Math.max(1,SEC_PER_STEP[j.mp]||60)*1000;const part=j.steps&&j._ss?Math.min((Date.now()-j._ss)/per,.95):0;
  const p=j.steps?Math.min(1,(j.step+part)/j.steps):0;const started=j.step||j.preview_rev,rm=remaining(j);
  return{p,left:rm!=null?rm:started?(j.eta&&j.eta>0?j.eta:Math.max(0,(j.steps-j.step-part)*per/1000)):null}};
 /* ---------- go ---------- */
 addEventListener("pagehide",()=>navigator.sendBeacon("/api/bye"));
 jobs=[];await loadModels(false);refreshUp();
 if(!models)toast(st.forge.starting?"Starting Forge — jobs start when it's ready":"Forge isn't running — Kiln picks it up as soon as it starts");
 poll();
})();
