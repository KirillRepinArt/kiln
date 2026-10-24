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
 const imgs=new Map(),IMAX=16;   /* the pictures used last (the cache used to keep every picture you'd seen, decoded) */
 function img(url){let e=imgs.get(url);if(e){imgs.delete(url);imgs.set(url,e);return e}
  const i=new Image();i.decoding="async";e={i,p:new Promise(r=>{i.onload=()=>r(i);i.onerror=()=>r(null)})};i.src=url;imgs.set(url,e);
  while(imgs.size>IMAX)imgs.delete(imgs.keys().next().value);return e}
 window.__imgsN=()=>imgs.size;
 function urlFor(j){return j.file?`/files/${encodeURIComponent(j.file)}?j=${j.id}`:null}
 function drawTo(cv,im,natural){const dpr=devicePixelRatio||1,iw=im.naturalWidth,ih=im.naturalHeight;
  if(natural){if(cv.width!==iw||cv.height!==ih){cv.width=iw;cv.height=ih}const c=cv.getContext("2d");c.drawImage(im,0,0);return}
  // the canvas takes its box's shape; the image keeps its own (a preview of another shape never gets stretched)
  const fd=cv.id==="cv"&&$("frame").dataset,cw=(fd&&+fd.tw)||cv.clientWidth||300,ch=(fd&&+fd.th)||cv.clientHeight||Math.round(cw*ih/iw);const W=Math.max(64,Math.round(cw*dpr)),H=Math.max(64,Math.round(ch*dpr));
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}const c=cv.getContext("2d");c.imageSmoothingQuality="high";c.clearRect(0,0,W,H);
  const k=cv.id==="cv"?Math.min(W/iw,H/ih):Math.max(W/iw,H/ih);c.drawImage(im,(W-iw*k)/2,(H-ih*k)/2,iw*k,ih*k)}
 /* a canvas only ever shows the image it was last asked for: while that one loads it is blank (never the previous
    picture or a cancelled job's preview stretched to the new shape), a load that lands after you moved on is dropped,
    and a file that's gone says so */
 /* switching pictures: the one on show is copied to an overlay (#cvx) at its own size and fades out once the next is
    drawn — never an empty frame in between (Photos / Lightroom). The neighbours are decoded ahead (preload) */
 function xfadeFrom(cv,id){const x=$("cvx");if(!x||x.dataset.wait||cv.id!=="cv"||cv.width<2||!cv.dataset.shown||cv.dataset.shown===String(id))return;   /* already taken (xfadeSnap, before the box changed) */
  x.width=cv.width;x.height=cv.height;x.getContext("2d").drawImage(cv,0,0);x.style.width=cv.style.width;x.style.height=cv.style.height;
  x.style.transition="none";x.style.opacity="1";x.dataset.wait="1"}
 function xfadeGo(cv,id){if(cv.id!=="cv")return;cv.dataset.shown=id;cv.dataset.cw=cv.style.width;cv.dataset.ch=cv.style.height;const x=$("cvx");
  if(x&&x.dataset.morph){x.dataset.wait="";return}   /* a crop-and-reveal is running: it fades the old picture at its seam */
  if(x&&x.dataset.wait){x.dataset.wait="";void x.offsetWidth;x.style.transition="";x.style.opacity="0"}}
 /* any other change of what's on show (leaving the Gallery, ✕, the render taking over): the picture fades out the same
    way — over whatever comes next (a render's first preview), or at once if nothing does (a clean screen) */
 window.xfadeSnap=()=>{const cv=$("cv"),x=$("cvx");if(!x||cv.width<2)return;x.width=cv.width;x.height=cv.height;x.getContext("2d").drawImage(cv,0,0);
  x.style.width=cv.style.width;x.style.height=cv.style.height;x.style.transition="none";x.style.opacity="1";x.dataset.wait="1";
  clearTimeout(x._t);x._t=setTimeout(xfadeEnd,260)};
 function xfadeEnd(){const x=$("cvx");if(!x||!x.dataset.wait||x.dataset.morph)return;x.dataset.wait="";void x.offsetWidth;x.style.transition="";x.style.opacity="0"}
 window.preload=j=>{const u=urlFor(j);if(!u||j.missing)return;const e=img(u);try{e.i.decode().catch(()=>{})}catch(_){}};
 window.paint=function(cv,j,progress){const u=urlFor(j);if(!u)return;xfadeFrom(cv,j.id);if(j.missing){cv.dataset.want=j.id;if(cv.id==="cv")missing(cv,j);return}const e=img(u),nat=cv.id==="vcv";cv.dataset.want=j.id;
  if(e.i.complete&&e.i.naturalWidth){drawTo(cv,e.i,nat);xfadeGo(cv,j.id);return}
  if(cv.id==="cv"){cv.width=1;cv.height=1}
  e.p.then(im=>{if(cv.dataset.want!=String(j.id))return;if(im){drawTo(cv,im,nat);xfadeGo(cv,j.id)}else{imgs.delete(u);missing(cv,j);xfadeGo(cv,j.id)}})};
 function missing(cv,j){const dpr=devicePixelRatio||1,fd=cv.id==="cv"&&$("frame").dataset,W=Math.max(64,Math.round(((fd&&+fd.tw)||cv.clientWidth||300)*dpr)),H=Math.max(64,Math.round(((fd&&+fd.th)||cv.clientHeight||300)*dpr));   /* the box's target size (it may be mid-glide) */
  cv.width=W;cv.height=H;const c=cv.getContext("2d");c.fillStyle="#0b0b0e";c.fillRect(0,0,W,H)}   /* the words and the ways back are on the card (#missCard) */
 /* the missing-file card: what can bring it back, best first */
 const inBin={};
 function missUI(d){const on=!!(d&&d.missing&&S.view==="gen");$("frame").classList.toggle("missing",on);if(!on)return;
  $("missFile").textContent=d.file;if(inBin[d.id]===undefined){inBin[d.id]=null;api(`/api/jobs/${d.id}/recycled`,{}).then(r=>inBin[d.id]=!!r.found).catch(()=>{})}
  const held=imgs.get(urlFor(d)),copy=!!(held&&held.i.complete&&held.i.naturalWidth);
  $("mRestore").style.display=inBin[d.id]?"":"none";$("mSave").style.display=copy&&!inBin[d.id]?"":"none";
  $("missHint").textContent=inBin[d.id]?"It's in the Recycle Bin — Restore puts the original file back.":copy?"Kiln still has it from this session — Save back writes it to the output folder again.":"Render again makes it anew from the same prompt, seed and settings."}
 const shownMissing=()=>{const d=shownDone();return d&&d.missing?d:null};
 $("mRestore").onclick=async()=>{const d=shownMissing();if(!d)return;const r=await api(`/api/jobs/${d.id}/restore`,{});toast(r.error||"Restored from the Recycle Bin");delete inBin[d.id];poll()};
 $("mSave").onclick=async()=>{const d=shownMissing();if(!d)return;const e=imgs.get(urlFor(d));if(!e||!e.i.naturalWidth)return toast("Kiln no longer has a copy");
  const c=document.createElement("canvas");c.width=e.i.naturalWidth;c.height=e.i.naturalHeight;c.getContext("2d").drawImage(e.i,0,0);
  const r=await api(`/api/jobs/${d.id}/saveback`,{data:c.toDataURL("image/png")});toast(r.error||`Saved back as ${d.file}`);imgs.delete(urlFor(d));poll()};
 $("mAgain").onclick=async()=>{const d=shownMissing();if(!d)return;const sp=Object.assign({},d.spec,{seed:d.seed,as_file:d.file});
  await api("/api/jobs",{jobs:[sp]});await api(`/api/jobs/${d.id}/remove`,{});toast(`Rendering it again — same seed, saved as ${d.file}`);poll()};
 $("mRemove").onclick=()=>{const d=shownMissing();if(d)removeJob(d)};

 /* ---------- server job -> UI job ---------- */
 function toUI(s){const sp=s.spec||{};return Object.assign({},sp,{id:s.id,kind:s.kind,status:s.status,file:s.file||null,
  seed:s.seed_used??sp.seed,est:s.est,est_first:s.est_first,t_first:s.t_first&&s.t_first*1000,step:s.step||0,steps:s.steps||sp.steps||0,progress:s.progress||0,eta:s.eta,preview_rev:s.preview_rev||0,
  error:s.error,started:s.started&&s.started*1000,finished:s.finished&&s.finished*1000,loras:sp.loras||[],mp:sp.mp||"1.0",ar:sp.ar||"1:1",spec:sp,warm:!!s.warm,stopping:!!s.stopping,missing:!!s.missing,created:s.created&&s.created*1000})}
 let sig="",forgeOk=true,forgeStarting=false,firstPoll=true,loadingM=false;const seen=new Set();
 let since="";
 async function poll(){let s;try{s=await (await fetch("/api/state"+(since?"?since="+since:""))).json()}catch(e){forgeMsg("Kiln server not reachable");return}
  forgeOk=s.forge.ok;forgeStarting=!!s.forge.starting;if(window.qPaused!==!!s.paused){window.qPaused=!!s.paused;sig=""}
  if(forgeOk&&!models&&!loadingM){loadingM=true;loadModels(false).then(ok=>{loadingM=false;if(ok){refreshUp();toast("Forge is ready — models and LoRAs loaded")}})}
  for(const b in s.stats.sec_per_step||{})SEC_PER_STEP[b]=Math.max(1,s.stats.sec_per_step[b]);
  if((typeof dragId!=="undefined"&&dragId!=null)||window._rp){setTimeout(poll,700);return} // dragging, or the new order not saved yet: keep the local order
  if(s.same){const r=s.run,cur=current();   /* nothing changed but the running job's progress */
   if(r&&cur&&cur.id===r.id){const u=toUI(r);u._ss=cur._ss;u._lastStep=cur._lastStep;Object.assign(cur,u)}
   else if(r||cur){since="";setTimeout(poll,0);return}   /* out of step: the full list next */
   const n=jobs.filter(j=>j.status==="pending"||j.status==="running").length;$("badge").textContent=n;$("badge").classList.toggle("show",n>0);$("tabN").textContent=n||"";
   setTimeout(poll,current()?700:1800);return}
  since=s.sig||"";
  const prev=new Map(jobs.map(j=>[j.id,j]));
  jobs=s.jobs.map(x=>{const u=toUI(x),o=prev.get(u.id);if(o&&o.status==="running"&&u.status==="running"){u._ss=o._ss;u._lastStep=o._lastStep}return u});
  for(const j of jobs){const jk=j.id+":"+(j.created||0);   /* the server can hand an id out again after its job left the list */
   if(j.status==="done"&&!seen.has(jk)){seen.add(jk);neKey="";if(!firstPoll){pv("done",j);onJobDone(j);if(S.view!=="gen"||PV.browse!=null)doneNote(j);setTimeout(()=>makeQThumb(j),1500)}}
   if(j.status==="error"&&!seen.has("e"+jk)){seen.add("e"+jk);if(!firstPoll)toast(`Job #${j.id} failed: ${j.error||"error"}`)}}
  if(firstPoll){const d=lastDone();window._jobsReady=true;if(d&&S.clearedId!==d.id)PV.still={id:d.id,kind:"result"}; // the last result, unless you had closed it
   if(S.seenDone!=null){const n=jobs.filter(x=>x.status==="done"&&x.id>S.seenDone).length;if(n)setTimeout(()=>toast(`${n} image${n>1?"s":""} finished while Kiln was closed`),1200)}}
  {const m=Math.max(0,...jobs.filter(x=>x.status==="done").map(x=>x.id));if(m!==S.seenDone){S.seenDone=m;save()}}
  firstPoll=false;
  if(peekJob)peekJob=jobs.find(j=>j.id===peekJob.id)||peekJob;
  pvPrune();
  const ns=jobs.map(j=>`${j.id}:${j.status}:${j.file}:${j.missing?1:0}:${j.name||""}`).join("|");
  if(ns!==sig){sig=ns;renderAll()}else{const n=jobs.filter(j=>j.status==="pending"||j.status==="running").length;$("badge").textContent=n;$("badge").classList.toggle("show",n>0);$("tabN").textContent=n||""}
  setTimeout(poll,current()?700:1800)}

 /* ---------- queue actions -> server ---------- */
 window.tick=function(){};
 /* Start in the Gallery = Vary: the picture on show again — its prompt, settings, LoRAs and series — with a new seed.
   Your draft isn't touched, and you stay where you are (Midjourney's Vary; Reuse is for editing first) */
 async function vary(j){if(j.kind==="upscale"){toast("Variations come from generated pictures, not upscales");return}
  const sp=Object.assign({},j.spec);delete sp.as_file;sp.seed=Math.floor(Math.random()*4294967295);
  const r=await api("/api/jobs",{jobs:[sp]}),id=r&&r.ids&&r.ids[0];
  toast(`Variation of #${j.id} queued — new seed`,id?"Undo":"",()=>api(`/api/jobs/${id}/cancel`,{}).then(poll));
  if(!forgeOk)setTimeout(()=>toast("Queued — Forge isn't running yet, jobs start when it is"),2300);poll()}
 window.addJobs=async function(){if(peekJob&&picMode()==="browse"&&peekJob.status==="done"){await vary(peekJob);return}
  if(peekJob){toast("Viewing a queued prompt — choose Reuse, or ✕ to go back");return}
  const text=P.value.trim();if(!text){toast("Write a prompt first");return}
  const on=LORAS.filter(l=>l.on);on.forEach(l=>l.used=Date.now());const L=on.map(l=>({name:l.name,w:+l.w}));
  const set=S.set||{},[sampler,scheduler]=(set.sampler||"Euler · Simple").split(" · ");const [w,h]=SIZES[S.mp][S.ar];
  const mods=[set.vae,set.te].filter(Boolean);
  const specs=[];for(let i=0;i<S.n;i++){const seed=S.seedMode==="random"?Math.floor(Math.random()*4294967295):(S.seed+i)>>>0;
   const ex=expandVariants(stripComments(text));
   specs.push({prompt:ex.text,raw:text,picks:ex.picks,name:S.pname.trim(),mp:S.mp,ar:S.ar,w,h,steps:S.steps,seed,loras:L,
    checkpoint:set.ckpt||undefined,modules:mods.length?mods:undefined,shift:+(set.shift||1.15),cfg:+(set.cfg||1),sampler,scheduler})}
  save();await api("/api/jobs",{jobs:specs});pv("start");   /* a picture you held gives way to the render once it has a picture */toast(S.n>1?`Added ${S.n} jobs to the queue`:"Added to queue");
  if(!forgeOk)setTimeout(()=>toast("Queued — Forge isn't running yet, jobs start when it is"),2300);poll()};
 window.stopJob=async function(j){if(!j)return;if(j.status==="running")j.stopping=true;await api(`/api/jobs/${j.id}/cancel`,{});poll()};
 $("qwrap").addEventListener("drop",()=>{},true);
 $("qwrap").addEventListener("dragend",()=>{const ids=[...document.querySelectorAll('.qi[draggable="true"]')].map(q=>+q.dataset.id);window._rp=true;
  api("/api/reorder",{ids}).finally(()=>{window._rp=false;poll()})});
 $("qwrap").addEventListener("click",e=>{if(e.target.id==="clearDone"){e.stopImmediatePropagation();api("/api/clear",{}).then(poll)}},true);
 window.openInApp=j=>api("/api/open",{id:j.id});
 window.fileUrl=urlFor;
 const qtq=[];let qtBusy=false;
 window.makeQThumb=(j,el)=>{if(!j||j.missing||!j.file||j.status!=="done"||qtq.some(x=>x[0].id===j.id))return;qtq.push([j,el]);if(!qtBusy)qtNext()};
 async function qtNext(){const n=qtq.shift();if(!n){qtBusy=false;return}qtBusy=true;const [j,el]=n;
  try{const held=imgs.get(urlFor(j));   /* a picture already decoded (the one just finished, the one on show): no second load */
   const im=held&&held.i.complete&&held.i.naturalWidth?held.i:await new Promise(r=>{const i=new Image();i.decoding="async";i.onload=()=>r(i);i.onerror=()=>r(null);i.src=urlFor(j)});   /* not via the cache: hundreds of thumbnails mustn't push the pictures you browse out of it */
   if(im){const Z=120,c=document.createElement("canvas");c.width=c.height=Z;const s=Math.min(im.naturalWidth,im.naturalHeight);
    c.getContext("2d").drawImage(im,(im.naturalWidth-s)/2,(im.naturalHeight-s)/2,s,s,0,0,Z,Z);const data=c.toDataURL("image/jpeg",.82);
    const t=el&&el.isConnected?el:document.querySelector(`img.qt[data-qt="${j.id}"]`);if(t)t.src=data;
    await api("/api/qthumb",{id:j.id,data})}}catch(e){}
  setTimeout(qtNext,0)}
 /* several at once: one Undo for all (Delete), or off the list (cancelled rows, missing files) */
 window.deleteMany=async ids=>{const L=[...ids].map(id=>jobs.find(j=>j.id===id)).filter(Boolean),del=L.filter(j=>j.status==="done"&&j.file&&!j.missing),rm=L.filter(j=>!del.includes(j));
  await Promise.all(del.map(j=>api(`/api/jobs/${j.id}/delete`,{})).concat(rm.map(j=>api(`/api/jobs/${j.id}/remove`,{}))));
  const gone=new Set(L.map(j=>j.id));jobs=jobs.filter(j=>!gone.has(j.id));pvPrune();renderAll();
  const msg=[del.length&&`${del.length} moved to the Recycle Bin`,rm.length&&`${rm.length} taken off the list`].filter(Boolean).join(" · ");
  toast(msg,del.length?"Undo":"",async()=>{await Promise.all(del.map(j=>api(`/api/jobs/${j.id}/undelete`,{})));poll()});poll()};
 window.removeMany=async ids=>{await Promise.all([...ids].map(id=>api(`/api/jobs/${id}/remove`,{})));const g=new Set(ids);jobs=jobs.filter(j=>!g.has(j.id));pvPrune();renderAll();poll()};
 /* a picture finished while you weren't watching Generating: a small card slides out under the Generating tab (where
    its ring was); click = the picture in the Gallery. ~6 s, held while you're on it; several in a row = one card */
 let dnT=null,dnN=0,dnId=null;const dn=$("donenote");
 function dnHide(){clearTimeout(dnT);dn.classList.remove("show");dnN=0}
 window.doneNote=j=>{dnN=dn.classList.contains("show")?dnN+1:1;dnId=j.id;
  $("dnTxt").textContent=dnN>1?`${dnN} finished · the last #${j.id}`:`#${j.id} finished`;
  const im=$("dnImg");if(S.privacy)im.removeAttribute("src");else im.src=urlFor(j);dn.classList.toggle("priv",!!S.privacy);
  const r=document.querySelector('.tab[data-v="gen"]').getBoundingClientRect();dn.style.left=Math.round(r.left+r.width/2)+"px";dn.style.top=Math.round(r.bottom+10)+"px";
  dn.classList.add("show");clearTimeout(dnT);dnT=setTimeout(dnHide,6000)};
 dn.addEventListener("mouseenter",()=>clearTimeout(dnT));dn.addEventListener("mouseleave",()=>{clearTimeout(dnT);dnT=setTimeout(dnHide,2500)});
 dn.onclick=()=>{const j=doneById(dnId);dnHide();if(!j)return;tabGo(()=>{showView("gen");pv("browse",j)})};
 window.removeJob=async j=>{if(!j)return;await api(`/api/jobs/${j.id}/remove`,{});poll()};
 window.removeMissing=async()=>{await api("/api/remove-missing",{});poll()};
 window.setPaused=async p=>{await api("/api/pause",{paused:p});window.qPaused=p;sig="";poll();toast(p?"Queue paused — the current image finishes, nothing new starts":"Queue resumed")};
 window.renameFile=async(j,n)=>{let r;try{r=await api(`/api/jobs/${j.id}/rename`,{name:n})}catch(e){r={error:"Kiln server not reachable"}}
  if(r.error){toast(`Couldn't rename: ${r.error}`);return false}if(r.file===r.old){return true}const back={name:j.name||"",as_file:r.old};
  toast(`Renamed to ${r.file}`,"Undo",async()=>{await api(`/api/jobs/${j.id}/rename`,back);poll()});poll();return true};
 window.renameJob=async(j,n)=>{await api(`/api/jobs/${j.id}/name`,{name:n});toast(n?`Name saved — it will be saved as ${slugify(n)}-NNN.png`:"Name cleared — it will be named by date and seed");poll()};
 /* Q1: delete = to the Recycle Bin, with Undo (the server waits 12 s before it really goes) */
 window.deleteJob=async j=>{if(!j)return;const L=doneList(),i=L.findIndex(x=>x.id===j.id),d=PV.dir||1,nb=L[i+d]||L[i-d]||null;   /* where to land: onward in the way you were stepping (the ones behind you, you kept), else back */
  const r=await api(`/api/jobs/${j.id}/delete`,{});if(r.error){toast(r.error);return}
  jobs=jobs.filter(x=>x.id!==j.id);
  if($("viewer").classList.contains("show")&&V.job&&V.job.id===j.id){if(nb)openViewer(nb);else closeViewer()}
  pv("deleted",{job:j,next:nb});if(peekJob&&peekJob.id===j.id)peekHide();
  toast("Moved to the Recycle Bin","Undo",async()=>{await api(`/api/jobs/${j.id}/undelete`,{});poll()});poll()};
 $("resumeBtn").onclick=e=>{e.stopPropagation();setPaused(false)};
 $("pchip").onclick=e=>{e.stopPropagation();pv("close")};   /* the running job's chip: back to the render */
 /* browsing: the status row is the picture's caption — its number, file, shape and size (click: its prompt) */
 function capTxt(b){if(!b)return;const sp=b.spec||{},w=sp.w||(SIZES[b.mp]||{})[b.ar]?.[0],h=sp.h||(SIZES[b.mp]||{})[b.ar]?.[1];
  const t=[`#${b.id}`,b.file,b.ar,w&&h?`${w}×${h}`:""].filter(Boolean).join(" · ");if($("ptxt").textContent!==t)$("ptxt").textContent=t;$("peta").textContent=""}
 function act(a,j){if(!j)return;
  if(a==="open")return api("/api/open",{id:j.id});
  if(a==="folder")return api("/api/reveal",{id:j.id});
  if(a==="up"){const u=(S.set||{}).upscaler||(models&&models.upscalers[0]);if(!u)return toast("No upscalers found in Forge");
   return api("/api/upscale",{id:j.id,upscaler:u,scale:+((S.set||{}).upscale||2)}).then(()=>{toast(`Upscale ×${(S.set||{}).upscale||2} queued (${u})`);poll()})}
  if(a==="i2i")return toast("img2img is next on the roadmap");
  if(a==="del")return deleteJob(j)}
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
  renderLoras();renderChips();restoreLoras();return true}
 /* a one-time restore of LoRA names, stars and weights the server holds in data/lora_restore.json */
 let restoreTried=false;
 async function restoreLoras(){if(restoreTried)return;restoreTried=true;let r;try{const x=await fetch("/api/lora-restore");if(!x.ok)return;r=await x.json()}catch(e){return}
  let n=0;for(const x of r.loras||[]){const l=LORAS.find(l=>l.name===x.name);if(!l)continue;
   if(x.display)l.display=x.display;if(x.fav!=null)l.fav=!!x.fav;if(x.w!=null)l.w=+x.w;if(x.used)l.used=x.used;n++}
  save();renderLoras();renderChips();await api("/api/lora-restore",{done:true});if(n)toast(`Restored names, stars and weights for ${n} LoRAs`)}
 // settings: read-only server facts + upscaler choice
 const fg=document.querySelector(".mcard .fg");
 fg.querySelector('[data-set="outdir"]').value=st.out_dir;fg.querySelector('[data-set="outdir"]').readOnly=true;
 const fu=fg.querySelector('[data-set="forge"]');fu.readOnly=true;fu.title="Set in config.local.json";
 const up=document.createElement("select");up.dataset.set="upscaler";const upl=document.createElement("label");upl.textContent="Upscaler";
 const us=document.createElement("select");us.dataset.set="upscale";us.innerHTML='<option value="2">×2</option><option value="1.5">×1.5</option><option value="4">×4</option>';
 const usl=document.createElement("label");usl.textContent="Upscale by";
 const fx=$("fghAp");for(const el of [upl,up,usl,us])fg.insertBefore(el,fx);   /* at the end of Output, above Appearance */
 for(const el of [up,us]){el.addEventListener("change",()=>{S.set[el.dataset.set]=el.value;save()})}
 const refreshUp=()=>{if(!models)return;up.innerHTML=models.upscalers.map(u=>`<option>${esc(u)}</option>`).join("");if(S.set.upscaler)up.value=S.set.upscaler;us.value=S.set.upscale||"2"};
 const rb=document.createElement("button");rb.className="iconbtn";rb.title="Refresh models & LoRAs from Forge";
 rb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/></svg>';
 rb.onclick=async()=>{rb.classList.add("spin");await loadModels(true);refreshUp();rb.classList.remove("spin");toast("Models and LoRAs refreshed")};
 document.querySelector(".mcard .mact").prepend(rb);
 /* About: the version, and a manual update check — the only time Kiln goes online, and only when you ask */
 $("aboutV").textContent="Kiln "+(st.version||"");
 $("updBtn").onclick=async()=>{const b=$("updBtn"),o=$("updRes");b.disabled=true;o.textContent="Checking GitHub…";let r;
  try{r=await api("/api/update-check",{})}catch(e){r={error:"Kiln server not reachable"}}b.disabled=false;
  o.innerHTML=r.error?esc(r.error):r.newer?`<b>${esc(r.latest)} is available</b> (you have v${esc(r.current)}). To update: in the Kiln folder run <code>git pull</code> — or download the ZIP from <a href="${esc(r.url)}" target="_blank" rel="noopener">GitHub</a> — then close Kiln and run kiln.bat again.`
   :`You have the latest version (v${esc(r.current)}).`};
 /* the LoRA tab rescans the folder: with its button, and on its own when the tab opens (at most once a minute, never
    while a job runs — Forge is busy then); a quiet note only when something changed */
 let lscanT=0;
 async function rescanLoras(manual){if(!manual&&(current()||Date.now()-lscanT<60000||!forgeOk))return;lscanT=Date.now();const b=$("lRefresh");b.classList.add("spin");
  const before=new Set(LORAS.map(l=>l.name)),ok=await loadModels(true);b.classList.remove("spin");if(!ok){if(manual)toast("Forge isn't reachable — LoRAs not rescanned");return}
  const added=LORAS.filter(l=>!before.has(l.name)).length,gone=[...before].filter(n=>!LORAS.some(l=>l.name===n)).length;
  if(added||gone)toast([added&&`${added} new LoRA${added>1?"s":""}`,gone&&`${gone} gone`].filter(Boolean).join(" · "));else if(manual)toast("LoRAs are up to date")}
 $("lRefresh").onclick=()=>rescanLoras(true);
 document.querySelector('.tab[data-v="loras"]').addEventListener("click",()=>rescanLoras(false));

 /* ---------- progress: real steps, smooth glide in between, live preview ---------- */
 let lastPrev=0,prevLoading=false;
 /* countdown from the history-based total; if the first step came late compared with history, stretch it */
 function remaining(j){if(!j.est||!j.started)return null;const el=(Date.now()-j.started)/1000;let f=1;
  if(j.t_first&&j.est_first){const at=(j.t_first-j.started)/1000;f=Math.max(.75,Math.min(2.5,at/j.est_first))}
  const r=j.est*f-el;return r>2?r:null} // overdue: fall back to step timing
 /* before the first step: a word in Kiln's spirit, with the real state small beside it */
 const WORDS=["Stoking the kiln","Kindling","Warming up","Simmering","Firing up","Tempering","Gathering embers"];
 function setTxt(h){const el=$("ptxt");if(el.innerHTML!==h)el.innerHTML=h}
 let nextEst=null,neKey="";
 function refreshEst(){const [w,h]=SIZES[S.mp][S.ar],k=`${w}x${h}x${S.steps}`;if(k===neKey)return;neKey=k;
  api("/api/estimate",{spec:{w,h,steps:S.steps}}).then(r=>{if(neKey===k)nextEst=r.est}).catch(()=>{})}
 window.frame=function(){const j=current();const prog=$("prog");
  if(j){prog.classList.add("show","run");
   const per=Math.max(1,SEC_PER_STEP[j.mp]||60)*1000;
   if(j._lastStep!==j.step){j._lastStep=j.step;j._ss=Date.now()}
   const part=j.steps?Math.min((Date.now()-(j._ss||Date.now()))/per,.95):0;
   const p=j.steps?Math.min(1,(j.step+part)/j.steps):0;prog.classList.toggle("stopping",!!j.stopping);if(!j.stopping)$("fill").style.width=(p*100).toFixed(2)+"%";
   const rm=remaining(j),left=rm!=null?rm:(j.eta&&j.eta>0?j.eta:Math.max(0,(j.steps-j.step-part)*per/1000));
   const started=j.step||j.preview_rev;prog.classList.remove("cap");
   /* browsing a finished picture while this job renders: the row is about the picture you're looking at (its caption);
      the job becomes a chip at the row's end — a live thumbnail (soft until the last step, like the cover; a lock with
      privacy on) and its step and time left; the ring on Start shows its progress (effects.js) */
   const bg=S.view==="gen"&&!!browsed(),pre="";prog.classList.toggle("bgjob",bg);
   if(bg){const im=$("pthImg"),key=j.id+":"+(j.preview_rev||0);if(im.dataset.k!==key){im.dataset.k=key;if(j.preview_rev)im.src=`/api/preview/${j.id}?r=${j.preview_rev}`;else im.removeAttribute("src")}
    $("pth").classList.toggle("soft",j.step<j.steps-1);
    $("pchipT").textContent=j.stopping?"stopping":started?`${Math.min(j.step+1,j.steps)}/${j.steps}${rm!=null||j.eta?` · ${fmt(left)}`:""}`:"starting";
    capTxt(browsed())}
   else if(j.stopping){const r=(per-(Date.now()-(j._ss||Date.now())))/1000;setTxt("Stopping after this step");$("peta").textContent=r>3?`stops in ~${fmt(r)}`:"any moment now"}   /* Forge only stops between steps; the next job starts right after */
   else{const other=S.view==="gen"&&picMode()==="live"&&!peekJob&&j.kind!=="upscale"&&(draft||"").trim()!==(j.raw||j.prompt||"").trim()?` <span class="sub">· #${j.id} · another prompt</span>`:"";
    setTxt(pre+(j.kind==="upscale"?"Upscaling…":started?`Step ${Math.min(j.step+1,j.steps)}/${j.steps}`+other:`${WORDS[j.id%WORDS.length]}… <span class="sub">· ${j.warm?"starting":"loading model"}</span>`));
    $("peta").textContent=j.kind==="upscale"?"":(started||rm!=null)?`~${fmt(left)} left`:""}
   if(j.preview_rev&&PV.still&&PV.still.kind==="result"&&PV.browse==null)pv("preview");
   if(S.view==="gen"&&picMode()==="live"){const f=$("frame");f.classList.add("has");$("idle").style.display="none";
    if(+$("cv").dataset.j!==j.id){$("cv").dataset.j=j.id;$("cv").dataset.d="";$("cv").dataset.want="";lastPrev=0;const c=$("cv");c.width=1;c.height=1;sizeFrame()}
    if(j.preview_rev&&j.preview_rev!==lastPrev&&!prevLoading){prevLoading=true;const r=j.preview_rev;const i=new Image();
     const jid=j.id;i.onload=()=>{if(+$("cv").dataset.j===jid&&picMode()==="live"){drawTo($("cv"),i,false);xfadeEnd()}lastPrev=r;prevLoading=false};i.onerror=()=>{prevLoading=false;lastPrev=r};i.src=`/api/preview/${j.id}?r=${r}`}}
   const mini=document.querySelector(`.qi[data-id="${j.id}"] .mini i`);if(mini)mini.style.width=(p*100)+"%";
   const lp=document.querySelector(`img[data-lp="${j.id}"]`);if(lp&&j.preview_rev&&lp.dataset.r!=j.preview_rev){lp.dataset.r=j.preview_rev;lp.src=`/api/preview/${j.id}?r=${j.preview_rev}`}   /* Q6: the render, small, in its queue row */
  }else if(!window._dp){prog.classList.add("show");prog.classList.remove("run","stopping","bgjob");$("fill").style.width="0%";prog.classList.toggle("cap",S.view==="gen"&&!!shownDone());
    if(!forgeOk){$("ptxt").textContent=forgeStarting?"Starting Forge…":"Forge not running";$("peta").textContent=forgeStarting?"jobs start when it's ready":"queue waits for it"}
    else if(window.qPaused&&jobs.some(x=>x.status==="pending")){$("ptxt").textContent="Queue paused";$("peta").textContent=`${jobs.filter(x=>x.status==="pending").length} waiting`}
    else if(S.view==="gen"&&PV.news!=null&&picMode()==="still"&&doneById(PV.news)){$("ptxt").textContent=`#${PV.news} finished`;$("peta").textContent="click to see it"}   /* behind your reference (Q1) */
    else if(S.view==="gen"&&shownDone())capTxt(shownDone());
    else{refreshEst();$("ptxt").textContent="Ready";$("peta").textContent=`~${fmt(nextEst??S.steps*(SEC_PER_STEP[S.mp]||60))} per image`}
    /* the empty frame says what's next: the shape and size, and how long it takes (or why nothing starts) */
    {const [w,h]=SIZES[S.mp][S.ar],T=!forgeOk?(forgeStarting?"Starting Forge…":"Forge isn't running"):`Next: ${S.ar} · ${w}×${h}`,
      Ss=!forgeOk?(forgeStarting?"jobs start when it's ready":"the queue waits for it"):`Estimated time: ~${fmt(nextEst??S.steps*(SEC_PER_STEP[S.mp]||60))}`;
     if($("idleT").textContent!==T)$("idleT").textContent=T;if($("idleS").textContent!==Ss)$("idleS").textContent=Ss}
   prog.classList.toggle("paused",!!window.qPaused&&jobs.some(x=>x.status==="pending"))}
  if(picMode()!=="live"){const d=onShow();
   if(d&&S.view==="gen"){if($("cv").dataset.d!=d.id||$("cv").dataset.m!==String(!!d.missing)){$("cv").dataset.d=d.id;$("cv").dataset.m=String(!!d.missing);$("cv").dataset.j="";sizeFrame();
     if(justDone===d.id){const f=$("frame");f.classList.remove("reveal");void f.offsetWidth;f.classList.add("reveal");setTimeout(()=>f.classList.remove("reveal"),1200);justDone=null}
     paint($("cv"),d,1)}$("frame").classList.add("has");$("idle").style.display="none"}
   else if(!d){$("frame").classList.remove("has");$("idle").style.display="";const c=$("cv");if(c.width>1){c.width=1;c.height=1;c.dataset.d="";c.dataset.j=""}}}
  missUI(onShow());browseStatus();requestAnimationFrame(frame)};

 window.jobProgress=function(j){const per=Math.max(1,SEC_PER_STEP[j.mp]||60)*1000;const part=j.steps&&j._ss?Math.min((Date.now()-j._ss)/per,.95):0;
  const p=j.steps?Math.min(1,(j.step+part)/j.steps):0;const started=j.step||j.preview_rev,rm=remaining(j);
  return{p,left:rm!=null?rm:started?(j.eta&&j.eta>0?j.eta:Math.max(0,(j.steps-j.step-part)*per/1000)):null}};
 /* ---------- go ---------- */
 addEventListener("pagehide",()=>navigator.sendBeacon("/api/bye"));
 /* back from the background (where Edge slows timers to ~1 a minute): check in at once */
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")fetch("/api/state").catch(()=>{})});
 jobs=[];await loadModels(false);refreshUp();
 if(!models)toast(st.forge.starting?"Starting Forge — jobs start when it's ready":"Forge isn't running — Kiln picks it up as soon as it starts");
 poll();
})();
