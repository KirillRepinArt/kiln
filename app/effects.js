/* Kiln · starfield, ambient glow + title/favicon, notifications, veil + embers */
/* app background, set by the skin: starfield (three parallax layers, gentle twinkle, a rare shooting star),
   northern lights over a dimmer starfield, or sparse cold code. Redrawn at ~30 fps. */
(function(){const cv=$("stars"),c=cv.getContext("2d");const R=Math.random;let W=0,H=0,stars=[],shoot=null,last=0,lastDraw=0,was="",bcols=null,bcT=0;
 const aur=makeAurora(),night=makeNightSky(),code=makeCodeBg();let lastIn=performance.now(),dimV=1,holes=[],holeT=0;
 const HOLES="#ltitle .phead,#ltitle .peekbar.show,#prog .meta,#idle>div";
 ["pointermove","keydown","wheel"].forEach(ev=>addEventListener(ev,()=>lastIn=performance.now(),{passive:true}));
 const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
 function init(){const b=cv.getBoundingClientRect();if(!b.width)return;const d=devicePixelRatio||1;
  W=cv.width=Math.round(b.width*d);H=cv.height=Math.round(b.height*d);
  const n=Math.round(b.width*b.height/3400);stars=[];for(let i=0;i<n;i++){const l=R()<.6?0:R()<.75?1:2;
   stars.push({x:R()*W,y:R()*H,l,r:(.5+l*.45+R()*.4)*d,p:R()*6.28,s:.6+R()*1.6})}}
 function draw(t){const idle=((S.set||{}).stars||"on")!=="off";cv.classList.toggle("on",idle);
  if(idle){if(!W||Math.abs(cv.getBoundingClientRect().width*(devicePixelRatio||1)-W)>2)init();
   const bg=skin().bg;if(bg!==was){was=bg;c.clearRect(0,0,W,H)}
   if(t-lastDraw<(current()?49:31)){last=t;requestAnimationFrame(draw);return}/* ~30 fps, ~20 while a job runs: the GPU is Forge's then */const dt=Math.min(66,t-lastDraw);lastDraw=t;
   if(!bcols||bcT!==window._themeV){bcols=themeCols();bcT=window._themeV}
   c.clearRect(0,0,W,H);const d=devicePixelRatio||1;
   if(bg==="code"){const run=!!current(),f=$("frame").getBoundingClientRect(),cb=cv.getBoundingClientRect();
    dimV+=((!run&&t-lastIn>120000?.45:1)-dimV)*Math.min(1,dt/1500); // idle for 2 min: dims
    if(t-holeT>500){holeT=t;holes=[...document.querySelectorAll(HOLES)].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height)
     .map(r=>({x:(r.left-cb.left)*d,y:(r.top-cb.top)*d,w:r.width*d,h:r.height*d}))}
    code.draw(c,W,H,t,dt,d,bcols,{run,fx:(f.left+f.width/2-cb.left)*d,dim:dimV,wave:window._bgWave||0,reduce,holes});last=t;requestAnimationFrame(draw);return}
   const dim=bg==="aurora"?.55:1;
   if(bg!=="aurora")for(const st of stars){const v=[.002,.0045,.009][st.l]*(reduce?0:1);st.x+=v*dt;st.y+=v*dt*.62;
    if(st.x>W+4)st.x-=W+8;if(st.y>H+4)st.y-=H+8;
    const tw=reduce?.8:.55+.45*Math.sin(t/1000*st.s+st.p);c.globalAlpha=(.25+st.l*.25)*tw*.62*dim;
    c.fillStyle=st.l===2?"#fff":"#cfd6ff";c.beginPath();c.arc(st.x,st.y,st.r,0,6.283);c.fill()}
   if(bg==="aurora"){const wv=window._bgWave?(t-window._bgWave)/4200:9,fl=wv>=0&&wv<1?Math.pow(Math.sin(Math.PI*Math.pow(wv,.7)),2):0; /* an image landed: the sky swells, slowly */
    night.draw(c,W,H,t,d,bcols,{reduce,landscape:(S.set||{}).landscape==="on",aur:{scale:6,layout:"sky",auto:!reduce,alpha:.46*(1+.8*fl),blend:"lighter",boost:fl*.6}})}
   if(!reduce&&bg==="stars"){if(!shoot&&R()<dt/9000)shoot={x:W*R()*.7,y:H*R()*.4,vx:.5+R()*.4,vy:.3+R()*.15,life:0};
    if(shoot){shoot.life+=dt;const k=shoot.life/900,len=120*(devicePixelRatio||1);const x=shoot.x+shoot.vx*shoot.life,y=shoot.y+shoot.vy*shoot.life;
     const g=c.createLinearGradient(x,y,x-shoot.vx*len,y-shoot.vy*len);g.addColorStop(0,"rgba(255,255,255,.8)");g.addColorStop(1,"rgba(255,255,255,0)");
     c.globalAlpha=Math.max(0,1-k);c.strokeStyle=g;c.lineWidth=1.4*(devicePixelRatio||1);c.beginPath();c.moveTo(x,y);c.lineTo(x-shoot.vx*len,y-shoot.vy*len);c.stroke();
     if(k>=1)shoot=null}}
   c.globalAlpha=1}else if(W&&!cv.classList.contains("on")&&getComputedStyle(cv).opacity<.02)c.clearRect(0,0,W,H);
  last=t;requestAnimationFrame(draw)}
 requestAnimationFrame(draw)})();

/* ambient glow + window title + favicon progress ring (throttled) */
const amb=$("amb"),ambC=amb.getContext("2d"),favC=document.createElement("canvas");favC.width=favC.height=64;
function jobProgress(j){const part=Math.min((Date.now()-j.stepStart)/j.est,.95)||0;return{p:(j.step+part)/j.steps,left:Math.max(0,(j.steps-j.step-part)*j.est*S.demo/1000)}}
function status(){const j=current();
 if(window._jobsReady){const d=lastDone(),v=resultStale&&d?d.id:null;if((S.clearedId??null)!==v){S.clearedId=v;save()}} // remember: closed on a clean screen
 $("frame").classList.toggle("running",!!j&&!browsed());const pend=jobs.filter(x=>x.status==="pending").length;
 const gm=(S.set||{}).glow||"gen";
 const src=(S.view==="gen"&&gm!=="off"&&!(j&&skin().cover==="camera")&&(j||(gm==="always"&&shownDone())))?$("cv"):null;   /* Aurora has its frame glow instead */
 if(src&&src.width){ambC.imageSmoothingQuality="high";ambC.drawImage(src,0,0,12,12);amb.classList.add("on")}else amb.classList.remove("on");
 let p=null;
 if(j){const q=jobProgress(j);p=q.p;
  document.title=`${Math.min(j.step+1,j.steps)}/${j.steps}${q.left!=null?` · ~${fmt(q.left)}`:""}${pend?` · +${pend}`:""} — Kiln`}
 else document.title=pend?`${pend} queued — Kiln`:"Kiln";
 const c=favC.getContext("2d");c.clearRect(0,0,64,64);const cs=getComputedStyle(document.documentElement);
 const g=c.createLinearGradient(0,0,64,64);g.addColorStop(0,cs.getPropertyValue("--a1").trim()||"#FF8A00");g.addColorStop(1,cs.getPropertyValue("--a3").trim()||"#3FE0F0");
 c.lineWidth=9;c.lineCap="round";c.strokeStyle="#2f2f34";c.beginPath();c.arc(32,32,24,0,Math.PI*2);c.stroke();
 c.strokeStyle=g;c.beginPath();c.arc(32,32,24,-Math.PI/2,-Math.PI/2+Math.PI*2*(p==null?1:Math.max(.02,p)));c.stroke();
 if(p==null){c.fillStyle=g;c.beginPath();c.moveTo(27,21);c.lineTo(43,32);c.lineTo(27,43);c.closePath();c.fill()}
 $("fav").href=favC.toDataURL("image/png")}
setInterval(status,400);
let notifAsked=false;
function askNotify(){if(notifAsked||!("Notification" in window))return;notifAsked=true;try{if(Notification.permission==="default")Notification.requestPermission()}catch(e){}}
function onJobDone(j){window.emberBurst&&emberBurst();if(jobs.some(x=>x.status==="pending"))return;if(((S.set||{}).notify||"on")==="off")return;
 try{if(Notification.permission==="granted")new Notification("Kiln — queue finished",{body:"Last: "+j.prompt.slice(0,80),silent:(S.set||{}).notify==="silent"})}catch(e){}}


/* ======================= effects =======================
   VEIL while a job runs: the young preview is mostly hidden under flowing diagonal light and drifting sparkles,
   and emerges as progress grows (hover the image to peek through). EMBERS: a short burst when a job finishes. */
(function(){const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
 const vc=$("veil"),v=vc.getContext("2d"),ec=$("embers"),e=ec.getContext("2d");let W=0,H=0,last=0,str=0,hover=false,sparks=[],embers=[],burst=0,cols=["#FF8A00","#FF5E8A","#3FE0F0"],colT=0;
 const aur=makeAurora(),crt=makeCRT(),cam=makeCamera();let crtJob=null,sweepT=0,nstr=0,fadeT=0,fadeFrom=0,fgA=0,stormAt=-1e9;const fg=$("fglow"),fgc=fg.getContext("2d");const HOLD=.7,FADE=5000; /* Aurora: the night layer holds at 70 % from mid-job, then fades slowly after the finish */
 const smooth=(a,b,x)=>{const q=Math.max(0,Math.min(1,(x-a)/(b-a)));return q*q*(3-2*q)};
 $("frame").addEventListener("pointerenter",()=>hover=true);$("frame").addEventListener("pointerleave",()=>hover=false);
 function sprite(color,size){const c=document.createElement("canvas");c.width=c.height=size;const g=c.getContext("2d");const r=g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  r.addColorStop(0,color);r.addColorStop(.18,color+"cc");r.addColorStop(.45,color+"33");r.addColorStop(1,color+"00");g.fillStyle=r;g.fillRect(0,0,size,size);return c}
 let spr={};function sprites(){const cs=getComputedStyle(document.documentElement);cols=["--a1","--a2","--a3"].map((k,i)=>cs.getPropertyValue(k).trim()||cols[i]);
  const hex=c=>{if(/^#[0-9a-f]{6}$/i.test(c))return c;const d=document.createElement("canvas").getContext("2d");d.fillStyle=c;return d.fillStyle};
  spr={a1:sprite(hex(cols[0]),64),a2:sprite(hex(cols[1]),64),a3:sprite(hex(cols[2]),64),w:sprite("#ffffff",64),comp:sprite(hex((window.HARM||{}).comp||cols[2]),64)}}
 sprites();
 window.emberBurst=function(){if(reduce||((S.set||{}).embers||"on")==="off")return;
 if(skin().cover==="crt"){sweepT=performance.now();window._bgWave=sweepT;return}
 if(skin().cover==="camera"){const n=performance.now();cam.storm(W,H,devicePixelRatio||1,n);fadeT=n;stormAt=n;fadeFrom=nstr;window._bgWave=n;return} /* a meteor storm over the night sky, which then fades slowly */
 burst=2400};
 function draw(t){const dt=Math.min(50,t-last||16);last=t;if(colT!==window._themeV){sprites();colT=window._themeV}
  const b=vc.getBoundingClientRect(),d=devicePixelRatio||1;const nw=Math.round(b.width*d),nh=Math.round(b.height*d);
  if(nw!==W||nh!==H){W=vc.width=ec.width=nw;H=vc.height=ec.height=nh}
  const j=current();const mode=(S.set||{}).veil||"full";const cover0=skin().cover;
  if(cover0==="crt"||cover0==="camera"){const k=j&&!browsed()?j.id:(Date.now()<(window._cpv||0)?"pv"+window._cpv:null);
   if(k!==crtJob){crtJob=k;if(k!=null){if(cover0==="crt")crt.powerOn(t);else cam.reset()}}} // a new job: the screen powers on / a new exposure starts
  let target=0,tN=null;if(j&&!browsed()&&S.view==="gen"&&mode!=="off"&&!reduce){const pr=Math.max(0,Math.min(1,jobProgress(j).p||0));
   // full while step 1 renders, most of it gone during step 2, a little left on step 3, clear for the last step
   const K=cover0==="crt"||cover0==="camera"?[[0,1],[.25,1],[.5,.85],[.75,.45],[.92,0]]:[[0,1],[.25,1],[.5,.4],[.75,.12],[.92,0]]; /* the CRT stays longer: the code forms the image on steps 2–3 */let k0=0;for(let i=1;i<K.length;i++)if(pr<=K[i][0]){const [a,va]=K[i-1],[b,vb]=K[i];k0=va+(vb-va)*(pr-a)/(b-a);break}
   target=k0*(mode==="light"?.55:1);if(cover0==="camera")tN=(pr>=.5?Math.max(k0,HOLD):k0)*(mode==="light"?.55:1)*(hover?.12:1);if(hover)target*=.12}
  else if(!j&&Date.now()<(window._cpv||0)&&S.view==="gen"&&mode!=="off"&&!reduce&&$("frame").classList.contains("has"))target=hover?.1:.8; // theme picked: preview the cover on the shown image
  str+=(target-str)*Math.min(1,dt/260);if(str<.002||(browsed()&&!(Date.now()<(window._cpv||0))))str=0; // a finished image you browse to shows clean at once
  if(tN==null)tN=target;if(j&&!browsed())fadeT=0;else if(fadeT){const p=(t-fadeT)/FADE;if(p>=1)fadeT=0;else tN=fadeFrom*(.5+.5*Math.cos(Math.PI*p))*(hover?.12:1)} // after the finish: a slow fade, slow at first
  nstr+=(tN-nstr)*Math.min(1,dt/260);if(nstr<.002||(browsed()&&!(Date.now()<(window._cpv||0))))nstr=0;
  document.getElementById("frame").style.setProperty("--vf",str?`blur(${(24*str).toFixed(1)}px) brightness(${(1-.45*str).toFixed(3)}) saturate(${(1-.4*str).toFixed(3)})`:"none");
  v.clearRect(0,0,W,H);
  if((cover0==="camera"?nstr:str)>0&&W){const T=t/1000;
   const cover=skin().cover;
   v.globalCompositeOperation="source-over";v.fillStyle=cover==="crt"?`rgba(0,9,4,${.88*str})`:cover==="camera"?`rgba(2,5,9,${.8*nstr})`:`rgba(8,8,12,${.30*str})`;v.fillRect(0,0,W,H);
   if(cover==="crt"){const pr=j?Math.max(0,Math.min(1,jobProgress(j).p||0)):.55;
    crt.draw(v,W,H,t,dt,d,cols.map(toHex),{str,resolve:smooth(.18,.6,pr),src:$("cv")});sparks.length=0}
   else if(cover==="camera"){const age=j&&j.started?(Date.now()-j.started)/1000:Math.max(0,(Date.now()-(window._cpv||Date.now())+6000)/1000);
    cam.draw(v,W,H,t,d,cols.map(toHex),{str:nstr,age,prog:j?Math.max(0,Math.min(1,jobProgress(j).p||0)):.55,step:j?j.step:null,src:$("cv")})}
   v.globalCompositeOperation="lighter";
   if(cover==="bands")
   for(let k=0;k<3;k++){const span=W+H,off=((T*(38+k*17)*d+k*span/3)%(span*1.4))-span*.2;
    const g=v.createLinearGradient(off,0,off+H*.9,H*.9);const a=(.10-.025*k)*str;const col=k===1?cols[2]:cols[k===0?0:1];
    g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(.45,"rgba(0,0,0,0)");g.addColorStop(.5,col);g.addColorStop(.55,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,0)");
    v.globalAlpha=a*2.2;v.fillStyle=g;v.fillRect(0,0,W,H)}
   const want=cover==="crt"||cover==="camera"?0:Math.round(230*str*(W*H)/(700*900*d*d));while(sparks.length<want)sparks.push({x:Math.random()*(W+40*d)-20*d,y:Math.random()*(H+40*d)-20*d,s:(.5+Math.random()*1.3)*d,v:(.012+Math.random()*.03)*d,ph:Math.random()*6.28,tw:.6+Math.random()*1.8,c:Math.random()<.07?"comp":Math.random()<.5?"w":(Math.random()<.5?"a3":"a1")});
   if(sparks.length>want)sparks.length=want;
   for(const p of sparks){p.x+=p.v*dt;p.y+=p.v*dt*.62;const m=20*d;if(p.x>W+m)p.x-=W+2*m;if(p.y>H+m)p.y-=H+2*m; // wrap around: density stays even however long the render
    const tw=Math.max(0,Math.sin(T*p.tw*3+p.ph));const a=tw*tw*str*.9;if(a<.01)continue;
    v.globalAlpha=a*.55;const r=p.s*7;v.drawImage(spr[p.c],p.x-r,p.y-r,r*2,r*2);
    v.globalAlpha=a;v.strokeStyle="#ffffff";v.lineWidth=.7*d;const L=p.s*4*tw;v.beginPath();v.moveTo(p.x-L,p.y);v.lineTo(p.x+L,p.y);v.moveTo(p.x,p.y-L);v.lineTo(p.x,p.y+L);v.stroke()}
   v.globalAlpha=1;v.globalCompositeOperation="source-over"}else sparks.length=0;
  /* Aurora: light spills from behind the image box — the cover's own aurora, scaled up soft past the edges; a meteor
     brightens it a moment, the finish storm swells it while the night layer fades */
  {const gm=(S.set||{}).glow||"gen",on=cover0==="camera"&&gm!=="off"&&S.view==="gen"&&nstr>0;
   const gi=on?cam.glowInfo():null,pulse=gi?Math.max(0,1-(t-gi.met)/1400)*.3+Math.max(0,1-(t-stormAt)/3500)*.35:0;
   fgA+=((on?Math.min(1,.3+.7*nstr+pulse):0)-fgA)*Math.min(1,dt/250);
   if(fgA>.01&&gi&&gi.src.width){const a=$("frame").getBoundingClientRect(),pad=48,gw=64,gh=Math.max(16,Math.round(64*(a.height+2*pad)/(a.width+2*pad)));
    if(fg.width!==gw||fg.height!==gh){fg.width=gw;fg.height=gh}
    const fs=fg.style;fs.left=(a.left-pad)+"px";fs.top=(a.top-pad)+"px";fs.width=(a.width+2*pad)+"px";fs.height=(a.height+2*pad)+"px";fs.opacity=(fgA*.5).toFixed(3);
    fgc.globalCompositeOperation="source-over";fgc.fillStyle=rgba(toHex(cols[0]),.28);fgc.fillRect(0,0,gw,gh);   // a faint rim in the theme colour, everywhere
    fgc.globalCompositeOperation="lighter";fgc.imageSmoothingQuality="high";fgc.drawImage(gi.src,0,0,gw,gh);fgc.globalCompositeOperation="source-over"}   // the curtains, carried out past the edge
   else if(fg.style.opacity!=="0")fg.style.opacity="0"}
  e.clearRect(0,0,W,H);
  if(W&&S.view==="gen")cam.drawStorm(e,W,H,t,d);
  if(sweepT&&W){const p=(t-sweepT)/900;if(p>=1||p<0)sweepT=0;else if(S.view==="gen")crt.sweep(e,W,H,p,d,cols.map(toHex))}
  if(burst>0&&W&&S.view==="gen"){const k=burst/2400;let n=dt*.09*k*(W/600);while(n-->0||Math.random()<n){const mx=2200+Math.random()*2400;embers.push({x:Math.random()*W,y:H+6*d,vx:(Math.random()-.5)*.03*d,vy:-H*(.75+Math.random()*.6)/mx,life:0,max:mx,r:(1+Math.random()*2)*d,c:Math.random()<.05?"comp":Math.random()<.65?"a1":"a2",ph:Math.random()*6.28})}}
  burst=Math.max(0,burst-dt);
  if(embers.length){e.globalCompositeOperation="lighter";
   embers=embers.filter(p=>{p.life+=dt;if(p.life>p.max)return false;p.x+=(p.vx+Math.sin(p.life/420+p.ph)*.015*d)*dt;p.y+=p.vy*dt;const q=p.life/p.max;
    const a=Math.min(1,q*6)*(1-q)*(.75+.25*Math.sin(p.life/90+p.ph));const r=p.r*5*(1-q*.4);
    e.globalAlpha=a*.7;e.drawImage(spr[p.c],p.x-r,p.y-r,r*2,r*2);e.globalAlpha=a;e.drawImage(spr.w,p.x-r*.25,p.y-r*.25,r*.5,r*.5);return true});
   e.globalCompositeOperation="source-over";e.globalAlpha=1}
  requestAnimationFrame(draw)}
 requestAnimationFrame(draw)})();
