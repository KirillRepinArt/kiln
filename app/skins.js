/* Kiln · skins: a theme sets the accent colours, the idle background and the cover over a young generation.
   Aurora = northern lights; Emerald = code: a sparse cold code background and an old phosphor monitor as the render
   screen. The other themes keep the starfield and the light bands. Everything is cheap on purpose (the GPU is busy
   generating): pre-drawn glyphs and patterns, low resolution where softness is the look, ~30 fps. */
const SKINS={ice:{bg:"stars",cover:"bands"},sunset:{bg:"stars",cover:"bands"},ember:{bg:"stars",cover:"bands"},
 aurora:{bg:"aurora",cover:"camera"},emerald:{bg:"code",cover:"crt",font:"IBM Plex Mono",title:"Courier Prime"}};
function skin(){return SKINS[S.theme]||SKINS.ice}
function toHex(c){if(/^#[0-9a-f]{6}$/i.test(c))return c;const d=document.createElement("canvas").getContext("2d");d.fillStyle=c;return d.fillStyle}
function rgba(hex,a){const n=parseInt(toHex(hex).slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
/* harmonic colours: from the theme's main colour, in OKLCH (perceptual: equal lightness looks equally bright) —
   a neighbour hue on the cooler side, the complement, the triad, and a calm "cool" tone for controls. Used 60-30-10:
   tinted neutrals, the theme colour, tiny accents. */
function _lin(c){c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}
function _gam(x){x=x<=.0031308?12.92*x:1.055*Math.pow(Math.max(0,x),1/2.4)-.055;return Math.round(Math.max(0,Math.min(1,x))*255)}
function hex2oklch(hex){const n=parseInt(toHex(hex).slice(1),16),r=_lin(n>>16&255),g=_lin(n>>8&255),b=_lin(n&255);
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),q=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 const L=.2104542553*l+.793617785*m-.0040720468*q,A=1.9779984951*l-2.428592205*m+.4505937099*q,B=.0259040371*l+.7827717662*m-.808675766*q;
 return[L,Math.hypot(A,B),(Math.atan2(B,A)*180/Math.PI+360)%360]}
function _rgb(L,C,h){const A=C*Math.cos(h*Math.PI/180),B=C*Math.sin(h*Math.PI/180);
 const l=(L+.3963377774*A+.2158037573*B)**3,m=(L-.1055613458*A-.0638541728*B)**3,q=(L-.0894841775*A-1.291485548*B)**3;
 return[4.0767416621*l-3.3077115913*m+.2309699292*q,-1.2684380046*l+2.6097574011*m-.3413193965*q,-.0041960863*l-.7034186147*m+1.707614701*q]}
function oklch2hex(L,C,h){for(let i=0;i<30&&_rgb(L,C,h).some(v=>v<-.001||v>1.001);i++)C*=.9; // keep it inside sRGB by easing the chroma
 return"#"+_rgb(L,C,h).map(v=>_gam(v).toString(16).padStart(2,"0")).join("")}
function harmonics(hex){const[L,C,h]=hex2oklch(hex),f=(dh,cm=1,l=L)=>oklch2hex(l,C*cm,((h+dh)%360+360)%360);
 const toBlue=d=>{const df=((250-h)%360+540)%360-180;return Math.sign(df||1)*Math.min(Math.abs(df),d)}; // turn toward blue
 return{an:f(toBlue(32)),comp:f(180,.9),tri1:f(120),tri2:f(240),cool:mixHex("#9fb6cc",hex,.2)}} // cool: a cold steel with a fifth of the theme in it — cold for every theme
function themeCols(){const cs=getComputedStyle(document.documentElement);return ["--a1","--a2","--a3"].map(k=>toHex(cs.getPropertyValue(k).trim()||"#ffffff"))}

/* northern lights, after real photos. Each curtain is a free curve laid along a great diagonal arc (high on the right,
   down toward the lower left) that folds and unfolds; vertical rays rise from it. Nothing slides: the folds, the ray
   heights and the bright patches come from slowly evolving noise, so the shape keeps changing and never repeats.
   Near curtains are big and bright, far ones thin and high. Colour by altitude: green base, a whitish hot edge, mint,
   magenta, faint red at the top. Mostly calm — every minute or two a surge brightens along the curtain while the rays
   dance faster. Drawn at 1/5–1/6 size and scaled up (the scaling is the softness). */
const _hash=(i,j)=>{let n=(Math.imul(i,374761393)+Math.imul(j,668265263))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296};
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
 const a=_hash(xi,yi),b=_hash(xi+1,yi),c=_hash(xi,yi+1),d=_hash(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,y){return .55*vnoise(x,y)+.3*vnoise(x*2.1+5.2,y*2.1+1.3)+.15*vnoise(x*4.3+9.7,y*4.3+7.1)}
const AURORA_LAYOUTS={ // arc ends (fractions of width / height), how much the arc bows, ray length, depth (1 = near)
 sky:[{a:[1.03,-.03],b:[-.03,.32],sag:.05,len:.17,depth:.45},{a:[1.1,.12],b:[-.1,.7],sag:.1,len:.36,depth:1}],
 frame:[{a:[1.05,.08],b:[-.05,.45],sag:.06,len:.3,depth:.6},{a:[1.1,.18],b:[-.1,.64],sag:.08,len:.44,depth:1}]};
function makeAurora(){const off=document.createElement("canvas"),o=off.getContext("2d"),soft=document.createElement("canvas"),sf=soft.getContext("2d");let ray=null,glow=null,key="",tt=0,lastT=null,surgeAt=null,nextSurge=null;
 function strips(c){const red=mixHex(c[2],"#ff3355",.5),hot=mixHex(c[0],"#ffffff",.4);
  const r=document.createElement("canvas");r.width=1;r.height=256;let g=r.getContext("2d"),gr=g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,rgba(red,0));gr.addColorStop(.12,rgba(red,.09));gr.addColorStop(.3,rgba(c[2],.18));gr.addColorStop(.5,rgba(c[1],.28));
  gr.addColorStop(.74,rgba(c[0],.7));gr.addColorStop(.87,rgba(c[0],.95));gr.addColorStop(.91,rgba(hot,.95));gr.addColorStop(.95,rgba(c[0],.45));gr.addColorStop(1,rgba(c[0],0));
  g.fillStyle=gr;g.fillRect(0,0,1,256);
  const w=document.createElement("canvas");w.width=1;w.height=128;g=w.getContext("2d");gr=g.createLinearGradient(0,0,0,128);
  gr.addColorStop(0,rgba(c[0],0));gr.addColorStop(.6,rgba(c[0],.5));gr.addColorStop(1,rgba(c[0],0));g.fillStyle=gr;g.fillRect(0,0,1,128);return[r,w]}
 return{draw(ctx,W,H,T,cols,op){const sc=op.scale||6,w=Math.max(40,Math.round(W/sc)),h=Math.max(30,Math.round(H/sc));
  if(off.width!==w||off.height!==h){off.width=soft.width=w;off.height=soft.height=h}
  const k=cols.join();if(k!==key){[ray,glow]=strips(cols);key=k}
  const dT=lastT==null?0:Math.max(0,Math.min(.2,T-lastT));lastT=T;
  let surge=0,su=0;                                                              // a surge: brightening travelling along the curtain
  if(op.auto){if(nextSurge==null)nextSurge=T+25+Math.random()*50;if(T>nextSurge&&surgeAt==null){surgeAt=T;nextSurge=T+60+Math.random()*60}
   if(surgeAt!=null){const p=(T-surgeAt)/11;if(p>=1)surgeAt=null;else{const e=p<.3?p/.3:p>.6?(1-p)/.4:1;surge=e*e*(3-2*e)*(op.surgeK??1);su=p*1.3-.15}}}
  const boost=Math.max(surge,op.boost||0);tt+=dT*(1+.7*boost);                // the rays dance faster while it lasts
  o.clearRect(0,0,w,h);o.globalCompositeOperation="lighter";
  for(const L of AURORA_LAYOUTS[op.layout||"sky"]){const A=[L.a[0]*w,L.a[1]*h],B=[L.b[0]*w,L.b[1]*h],dx=B[0]-A[0],dy=B[1]-A[1],len=Math.hypot(dx,dy),
    tx=dx/len,ty=dy/len,nx=ty,ny=-tx,ln=h*L.len,dep=L.depth,N=Math.ceil(len/.8),z=L.depth*9.3;  // nx,ny: the arc bows toward the lower right
   for(let i=0;i<=N;i++){const s=i/N;
    const fold=(fbm(s*2.4+z,tt*.045)-.5)*h*.22*dep,along=(fbm(s*5.5+3+z,tt*.07)-.5)*len*.05;   // the curve folds and unfolds
    const off2=Math.sin(Math.PI*s)*L.sag*h+fold,x=A[0]+tx*(s*len+along)-nx*off2,y=A[1]+ty*(s*len+along)-ny*off2;
    const q=Math.min(1,Math.max(0,s*1.1-.05)),env=q<=0||q>=1?0:Math.pow(Math.sin(Math.PI*q),.6);
    if(env<.01)continue;
    const patch=Math.pow(fbm(s*3.2+z*.3,tt*.05),2.2)*2.8;                        // bright and dim stretches, slowly changing
    const gl=env*dep*(.1+.1*patch)*(1+boost)*(op.gain||1);                        // the glow behind: continuous
    if(gl>.005){o.globalAlpha=Math.min(1,gl);o.drawImage(glow,x,y-ln*.5,1.6,ln*.7)}
    const sg=surge?surge*Math.exp(-Math.pow(s-su,2)/.024):0;
    const I=Math.min(1,Math.pow(fbm(s*34+z,tt*.35),2.2)*2.2*patch*env*dep*(op.gain||1)*(1+1.3*boost)+sg*env*.9);
    if(I<.012)continue;
    const hh=ln*(.35+1.05*Math.pow(fbm(s*7+z*.5,tt*.09),1.3))*(1+.3*boost);     // rays of very different height
    o.globalAlpha=I*.85;o.drawImage(ray,x,y-hh,1.6,hh*1.06)}}
  o.globalAlpha=1;o.globalCompositeOperation="source-over";
  sf.clearRect(0,0,w,h);sf.filter="blur(1.1px)";sf.drawImage(off,0,0);sf.filter="none";   /* a touch of blur at low size: no stair-steps after scaling */
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.globalAlpha=op.alpha;ctx.globalCompositeOperation=op.blend||"source-over";
  ctx.drawImage(soft,0,0,W,H);ctx.restore()},canvas(){return soft}}}

/* Aurora's background as a night landscape, the classic aurora photograph: stars wheeling slowly around the pole star
   (the earth turning, as in a timelapse — about one turn in 10 minutes), the aurora over a dark mountain ridge, and a
   still lake below that mirrors the sky, softened. */
function makeNightSky(){const aur=makeAurora();let stars=[],ridge=[],ridge2=[],key="";
 return{draw(ctx,W,H,t,d,cols,op){const k=W+"x"+H;if(k!==key){key=k;stars=[];
   /* stars spread evenly over a disc around the pole that reaches the farthest corner, so turning never empties a corner */
   const qx=W*.86,qy=-H*.06,R=Math.hypot(Math.max(qx,W-qx),H-qy)+20*d,n=Math.round(Math.PI*R*R/(3400*d*d));
   for(let i=0;i<n;i++){const r=R*Math.sqrt(Math.random()),a=Math.random()*6.2832;
    stars.push({x:qx+r*Math.cos(a),y:qy+r*Math.sin(a),b:.18+Math.pow(Math.random(),2.6)*.82,s:(.6+Math.random()*1.2)*d,p:Math.random()*6.3,tw:.4+Math.random()*1.4})}
   ridge=Array.from({length:97},(_,i)=>.55*fbm(i*.09,3.7)+.45*Math.pow(fbm(i*.23,8.1),1.6));
   ridge2=Array.from({length:97},(_,i)=>.6*fbm(i*.06+11,2.3)+.4*Math.pow(fbm(i*.17+4,5.9),1.4))}
  const land=!!op.landscape,HY=land?H*.76:H,px=W*.86,py=-H*.06,ang=op.reduce?0:t/1000*.0104,ca=Math.cos(ang),sa=Math.sin(ang),T=t/1000;
  ctx.save();ctx.beginPath();ctx.rect(0,0,W,HY);ctx.clip();ctx.fillStyle="#e2e8ff";
  for(const s of stars){const dx=s.x-px,dy=s.y-py,x=px+dx*ca-dy*sa,y=py+dx*sa+dy*ca;if(x<-3||x>W+3||y<-3||y>HY)continue;
   ctx.globalAlpha=s.b*(op.reduce?.8:.62+.38*Math.sin(T*s.tw+s.p))*.75;ctx.fillRect(x,y,s.s,s.s)}
  ctx.restore();
  aur.draw(ctx,W,H,op.reduce?0:T,cols,op.aur);
  if(!land)return;
  // the lake: the sky mirrored about the horizon, squashed a little, dimmer
  const soft=aur.canvas(),kq=.85;
  ctx.save();ctx.beginPath();ctx.rect(0,HY,W,H-HY);ctx.clip();ctx.globalCompositeOperation="lighter";
  ctx.translate(0,HY*(1+kq));ctx.scale(1,-kq);ctx.imageSmoothingEnabled=true;
  ctx.globalAlpha=op.aur.alpha*.34;ctx.drawImage(soft,0,0,W,H);ctx.globalAlpha=op.aur.alpha*.12;ctx.drawImage(soft,2*d,0,W,H);   // a faint shimmer
  ctx.restore();
  // a faint glow over the horizon (airglow, far twilight): it is what makes the ridge read against the sky; mirrored in the lake
  const tint=mixHex(mixHex(cols[0],"#2a6a8a",.55),"#000000",.15),ga=.16*(.8+.4*op.aur.alpha);
  let g=ctx.createLinearGradient(0,HY-H*.34,0,HY);g.addColorStop(0,rgba(tint,0));g.addColorStop(1,rgba(tint,ga));ctx.fillStyle=g;ctx.fillRect(0,HY-H*.34,W,H*.34);
  g=ctx.createLinearGradient(0,HY,0,H);g.addColorStop(0,rgba(tint,ga*.7));g.addColorStop(1,rgba(tint,0));ctx.fillStyle=g;ctx.fillRect(0,HY,W,H-HY);
  // mist drifting over the horizon
  for(let m=0;m<7;m++){const mx=((m*.19+T*.004*(1+m%3))%1.3-.15)*W,my=HY-H*(.015+.03*Math.sin(m*1.7)),r=W*(.18+.06*(m%3));
   const mg=ctx.createRadialGradient(mx,my,0,mx,my,r);mg.addColorStop(0,rgba(mixHex(tint,"#9fb8c0",.3),.2));mg.addColorStop(1,rgba(tint,0));
   ctx.save();ctx.translate(mx,my);ctx.scale(1,.18);ctx.translate(-mx,-my);ctx.fillStyle=mg;ctx.fillRect(mx-r,my-r,2*r,2*r);ctx.restore()}
  // the near ridge, and its reflection
  const peak=i=>HY-H*(.015+ridge[i]*.13);
  ctx.save();ctx.fillStyle="#010203";ctx.beginPath();ctx.moveTo(0,HY);for(let i=0;i<ridge.length;i++)ctx.lineTo(W*i/(ridge.length-1),peak(i));ctx.lineTo(W,HY);ctx.closePath();ctx.fill();
  ctx.fillStyle="#020406";ctx.beginPath();ctx.moveTo(0,HY);for(let i=0;i<ridge.length;i++)ctx.lineTo(W*i/(ridge.length-1),HY+(HY-peak(i))*kq);ctx.lineTo(W,HY);ctx.closePath();ctx.fill();
  const hl=ctx.createLinearGradient(0,HY-2*d,0,HY+2*d);hl.addColorStop(0,"rgba(120,200,170,0)");hl.addColorStop(.5,`rgba(120,200,170,${.08*op.aur.alpha})`);hl.addColorStop(1,"rgba(120,200,170,0)");
  ctx.fillStyle=hl;ctx.fillRect(0,HY-2*d,W,4*d);                                                // the waterline catches a little light
  ctx.restore()}}}

/* the render screen of Aurora: a comet-mode star-trail time-lapse, after real photos (Takasaka, Yukon 2010).
   The pole is inside the frame and the sky turns at the background's speed (one turn in ~10 min); each trail has a bright
   head (the star now) and a tail fading behind it, lengthening with the job's progress to the photo's 28°. Stars follow
   real statistics (a few bright, thousands faint); one bright band of orbits, a quiet centre, a fade to a floor outside.
   Starlight shows the image: trails are brighter where the preview is bright. A meteor for each finished step, streaming
   in from a shower's radiant just off the frame (some sporadic) with a lingering train; now and then a satellite. The
   aurora is smeared by the exposure into a soft glow. At the finish the night layer (held at 70 % by effects.js) fades
   slowly and the image emerges.
   Cheap: a worker exposes the trails (culled, batched by look) into a film a little larger than the frame every 2 s;
   in between, the film is just rotated. */
AURORA_LAYOUTS.cam=[{a:[1.05,-.06],b:[-.05,.3],sag:.05,len:.26,depth:.55},{a:[1.1,.02],b:[-.12,.72],sag:.1,len:.44,depth:1}];
/* star trails for Aurora's camera: every star's arc from its tail to its head, in SEG pieces that fade toward the tail.
   Pure (no outside state), because a worker runs it from its source text: the GPU then never has to raster thousands of
   thin arcs at once — that stalled the whole page every redraw. */
function exposeTrails(g,B,P,W,H,M,d,sp,th,SEG){g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W+2*M,H+2*M);
 g.setTransform(1,0,0,1,M,M);g.globalCompositeOperation="lighter";g.lineCap="butt";               /* square ends: a tail's pieces meet without overlapping */
 const inF=(r,a)=>{const x=P.px+r*Math.cos(a),y=P.py+r*Math.sin(a);return x>-M&&x<W+M&&y>-M&&y<H+M};
 for(const b of B){const paths=[];for(let k=0;k<SEG;k++)paths.push(new Path2D());
  for(let i=0;i<b.s.length;i+=2){const r=b.s[i],h=b.s[i+1]+th,sw=Math.max(sp,1.1*d/r);
   if(!inF(r,h)&&!inF(r,h-sw/2)&&!inF(r,h-sw))continue;
   for(let k=0;k<SEG;k++){const a0=h-sw+sw*k/SEG,a1=h-sw+sw*(k+1)/SEG;if(sw<=1.1*d/r*1.01&&k<SEG-1)continue;   // a dot: just the head
    paths[k].moveTo(P.px+r*Math.cos(a0),P.py+r*Math.sin(a0));paths[k].arc(P.px,P.py,r,a0,a1)}}
  g.strokeStyle=b.c;
  for(let k=0;k<SEG;k++){const fade=.12+.88*Math.pow((k+1)/SEG,1.3);                                // the tail fades behind the head
   g.globalAlpha=b.a*fade;g.lineWidth=b.w;g.stroke(paths[k]);
   if(b.bloom){g.globalAlpha=b.a*fade*.1;g.lineWidth=b.w*3;g.stroke(paths[k])}}}
 g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation="source-over";g.globalAlpha=1}
/* the worker: software raster on its own thread (willReadFrequently), the result handed back as an ImageBitmap */
function trailsWorker(){let B,P,W,H,M,d,cv,g;
 const px=bm=>{const c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext("2d",{willReadFrequently:true});x.drawImage(bm,0,0);bm.close();return x.getImageData(0,0,c.width,c.height).data};
 onmessage=e=>{const m=e.data;
  if(m.ae){const q=px(m.ae),hg=new Uint32Array(64);let n=0;                                            // auto-exposure: the brightest 1 % of the aurora
   for(let i=0;i<q.length;i+=4){hg[Math.min(63,((q[i]*.3+q[i+1]*.59+q[i+2]*.11)*q[i+3]/65025*64)|0)]++;n++}
   let c=0,b=63;for(;b>0;b--){c+=hg[b];if(c>=n*.01)break}postMessage({hi:(b+.5)/64});return}
  if(m.lum){const q=px(m.lum),L=new Float32Array(q.length/4);for(let i=0;i<L.length;i++)L[i]=(q[i*4]*.3+q[i*4+1]*.59+q[i*4+2]*.11)/255;   // the preview's light and dark
   postMessage({lum:L,nc:m.nc,nr:m.nr},[L.buffer]);return}
  if(m.init){({B,P,W,H,M,d}=m.init);cv=new OffscreenCanvas(W+2*M,H+2*M);g=cv.getContext("2d",{willReadFrequently:true});return}
  exposeTrails(g,B,P,W,H,M,d,m.sp,m.th,m.seg);const bm=cv.transferToImageBitmap();postMessage({gen:m.gen,th:m.th,bm},[bm])}}
function makeCamera(){const aur=makeAurora(),lit=document.createElement("canvas"),lc=lit.getContext("2d");
 const grain=document.createElement("canvas"),gg=grain.getContext("2d"),sm=document.createElement("canvas"),smc=sm.getContext("2d"),sm2=document.createElement("canvas"),sm2c=sm2.getContext("2d");
 const mask=document.createElement("canvas"),mc=mask.getContext("2d"),lum=document.createElement("canvas"),lu=lum.getContext("2d",{willReadFrequently:true});
 const OMEGA=.0104,SPAN=.49,SEG=8,AE_LEVEL=.36;                                                      // rad/s as the background sky; 28°
 /* the film, a little larger than the frame so stars turning in from the edge are already there: re-exposed every 2 s by
    a worker, shown rotated by however far the sky has turned since */
 let film=null,M=0,pending=false,gen=0,wk=null,fb=null,prev=null,prevTh=0,fresh=false,xfT=-1e9,aeBusy=false,lumBusy=false,lumRes=0;
 try{wk=new Worker(URL.createObjectURL(new Blob([exposeTrails.toString()+";("+trailsWorker.toString()+")()"],{type:"text/javascript"})));
  wk.onmessage=e=>{const m=e.data;if(m.hi!=null){aeBusy=false;const r=AE_LEVEL/Math.max(.02,m.hi);ae=Math.max(.6,Math.min(1.7,ae*Math.pow(r,r<1?.35:.03)));return}   // quick to darken (~1 s), slow to brighten (~8 s)
   if(m.lum){lumBusy=false;setMask(m.lum,m.nc,m.nr,lumRes);return}
   if(m.gen!==gen){m.bm.close();return}if(prev&&prev.close)prev.close();prev=film;prevTh=filmTh;film=m.bm;filmTh=m.th;fresh=true;pending=false};
  wk.onerror=()=>{wk=null;pending=false}}catch(e){wk=null}                                        // no worker: expose on the page (slower)
 let batches=[],sk="",pat=null,filmT=-1e9,filmTh=0,span=0,P={px:0,py:0},meteors=[],sat=null,satAt=null,lastStep=null,maskT=-1e9,hasMask=false,lt=null,mt=null,mcur=null,mimg=null,ae=1,aeT=-1e9;
 grain.width=grain.height=160;const id=gg.createImageData(160,160);
 for(let i=0;i<id.data.length;i+=4){const v=Math.random()*255|0;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255}gg.putImageData(id,0,0);
 const TINT=["#dfe8ff","#f4f6ff","#ffffff","#ffe2c4","#cddcff"],ss=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
 function build(W,H,d){const px=W*.6,py=H*.15,R=Math.hypot(Math.max(px,W-px),Math.max(py,H-py))+8*d,map=new Map();P={px,py};
  const add=(r,f,fine)=>{const q=r/R;
   const cap=(.2+.7*ss(.1,.42,q))*(.5+.5*ss(.015,.08,q)),g=Math.max(.3,(1-.7*ss(.48,1,q))*(1-.95*ss(.68,.82,q)))*(fine?1:.7+.3*ss(.36,.42,q));
   const al=Math.min(.9,.075*Math.pow(f,.72),cap)*g;if(al<.012)return;
   const w=Math.min(1.7,.42+.17*Math.sqrt(f)),c=f>4&&!fine?TINT[Math.random()*TINT.length|0]:"#e6ecff";
   const key=c+"|"+Math.round(al*40)+"|"+Math.round(w*8)+"|"+(f>14?1:0);
   let b=map.get(key);if(!b)map.set(key,b={c,a:Math.round(al*40)/40,w:Math.round(w*8)/8*d,bloom:f>14,s:[]});b.s.push(r,Math.random()*6.2832)};
  const n=Math.round(Math.PI*R*R/(800*d*d));
  for(let i=0;i<n;i++)add(R*Math.sqrt(Math.random()),Math.min(60,Math.pow(Math.random(),-1/1.1)));
  for(let i=0;i<60;i++)add(10*d+R*.26*Math.pow(Math.random(),.7),1.5+Math.random()*3,true);   // a few fine orbits around the pole
  heroes=[];for(let i=0;i<2;i++){let r=0,a=0;for(let k=0;k<80;k++){r=R*(.74+Math.random()*.18);a=Math.random()*6.2832;const x=px+r*Math.cos(a),y=py+r*Math.sin(a);if(x>W*.08&&x<W*.92&&y>H*.6&&y<H*.95)break}
   heroes.push({r,a,c:TINT[Math.random()*TINT.length|0],w:1.6*d})}                                   // two bright stars low in the frame: drawn on top, no fade, no mask
  batches=[...map.values()].sort((a,b)=>a.a-b.a)}
 /* starlight shows the image: an alpha mask from the preview's light and dark (tiny, scaled up soft) */
 function setMask(L,nc,nr,res){if(!mimg||mimg.width!==nc||mimg.height!==nr){mask.width=nc;mask.height=nr;mimg=mc.createImageData(nc,nr);mcur=null}
  mt=new Float32Array(nc*nr);for(let i=0;i<nc*nr;i++)mt[i]=1-res*.65*(1-Math.min(1,1.5*L[i]));        // dark parts down to ~45 %, bright parts full
  if(!mcur)mcur=Float32Array.from(mt)}
 function sampleMask(src,W,H,res){if(!src||src.width<8)return;const nc=40,nr=Math.max(8,Math.round(40*H/W));
  if(wk){if(!lumBusy){lumBusy=true;lumRes=res;createImageBitmap(src,{resizeWidth:nc,resizeHeight:nr,resizeQuality:"medium"}).then(b=>wk.postMessage({lum:b,nc,nr},[b]),()=>lumBusy=false)}return}
  lum.width=nc;lum.height=nr;lu.drawImage(src,0,0,nc,nr);const q=lu.getImageData(0,0,nc,nr).data,L=new Float32Array(nc*nr);   // no worker: read it here
  for(let i=0;i<L.length;i++)L[i]=(q[i*4]*.3+q[i*4+1]*.59+q[i*4+2]*.11)/255;setMask(L,nc,nr,res)}
 function easeMask(dt){if(!mcur)return false;const k=Math.min(1,dt/1500),D=mimg.data;                 // a new preview (once a step) eases in, never snaps
  for(let i=0;i<mcur.length;i++){mcur[i]+=(mt[i]-mcur[i])*k;const o=i*4;D[o]=D[o+1]=D[o+2]=255;D[o+3]=255*mcur[i]}mc.putImageData(mimg,0,0);return true}
 function meteor(W,H,d,t){const D=Math.hypot(W,H);let x,y,dx,dy,L;
  if(Math.random()<.7){const rx=-W*.12,ry=-H*.1;x=W*(.05+Math.random()*.75);y=H*(.03+Math.random()*.55);    // shower: from a radiant just off the frame
   dx=x-rx;dy=y-ry;const s0=Math.hypot(dx,dy);dx/=s0;dy/=s0;L=Math.min(D*.9,s0*(.5+.7*Math.random()))}      // farther from the radiant = longer
  else{const a=Math.random()*6.2832;x=W*(.1+Math.random()*.8);y=H*(.05+Math.random()*.6);dx=Math.cos(a);dy=Math.sin(a);L=D*(.2+.35*Math.random())} // a sporadic: any way
  meteors.push({x,y,dx,dy,len:L,t0:t,dur:650+900*L/D,w:(1.3+Math.random()*.9)*d});lastMet=Math.max(lastMet,t)}
 function drawMeteors(ctx,t,d,str,list){ctx.save();ctx.globalCompositeOperation="lighter";ctx.lineCap="round";const vis=Math.min(1,str*1.3+.3);
  const out=(list||meteors).filter(m=>{const p=(t-m.t0)/m.dur;if(p<0)return true;const TR=2.4;if(p>=1+TR)return false;     // the train lingers ~2.4 durations
   const hp=1-Math.pow(1-Math.min(1,p),1.6),hx=m.x+m.dx*m.len*hp,hy=m.y+m.dy*m.len*hp;
   // the persistent train: a faint glow along the path that fades slowly and widens a little
   const tr=p<1?Math.min(1,p*3)*.22:.22*Math.pow(1-(p-1)/TR,1.5);
   if(tr>.004){const g=ctx.createLinearGradient(m.x,m.y,hx,hy);g.addColorStop(0,"rgba(150,255,210,0)");g.addColorStop(.6,`rgba(170,255,220,${tr*vis})`);g.addColorStop(1,`rgba(190,255,230,${tr*vis*(p<1?1:.6)})`);
    ctx.strokeStyle=g;ctx.lineWidth=m.w*(2.2+(p>1?(p-1)*1.5:0));ctx.beginPath();ctx.moveTo(m.x,m.y);ctx.lineTo(hx,hy);ctx.stroke()}
   if(p<1){const a=(p<.08?p/.08:1)*(p>.75?(1-p)/.25:1)*vis,tl=m.len*Math.min(.4,p*.9),tx=hx-m.dx*tl,ty=hy-m.dy*tl;
    const g=ctx.createLinearGradient(tx,ty,hx,hy);g.addColorStop(0,"rgba(220,255,240,0)");g.addColorStop(1,`rgba(245,255,250,${a})`);
    ctx.strokeStyle=g;ctx.lineWidth=m.w;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(hx,hy);ctx.stroke();
    ctx.globalAlpha=.25;ctx.lineWidth=m.w*4;ctx.stroke();ctx.globalAlpha=1;                                       // its glow
    ctx.fillStyle=`rgba(255,255,255,${a})`;ctx.beginPath();ctx.arc(hx,hy,m.w*1.1,0,6.283);ctx.fill()}
   return true});
  ctx.restore();return out}
 function drawSat(ctx,W,H,t,d,str){if(satAt==null)satAt=t+60000+Math.random()*60000;
  if(!sat&&t>satAt){const e=Math.random()<.5,y0=H*(.1+Math.random()*.7),y1=H*(.1+Math.random()*.7);
   sat={x0:e?-10*d:W+10*d,y0,x1:e?W+10*d:-10*d,y1,t0:t,dur:11000+Math.random()*5000}}
  if(!sat)return;const p=(t-sat.t0)/sat.dur;if(p>1.6){sat=null;satAt=t+70000+Math.random()*60000;return}
  const hp=Math.min(1,p),hx=sat.x0+(sat.x1-sat.x0)*hp,hy=sat.y0+(sat.y1-sat.y0)*hp,back=.35,tp=Math.max(0,p-back),tx=sat.x0+(sat.x1-sat.x0)*Math.min(1,tp),ty=sat.y0+(sat.y1-sat.y0)*Math.min(1,tp);
  const a=.5*Math.min(1,str*1.2)*(p>1?1-(p-1)/.6:1);ctx.save();ctx.globalCompositeOperation="lighter";
  const g=ctx.createLinearGradient(tx,ty,hx,hy);g.addColorStop(0,"rgba(230,236,255,0)");g.addColorStop(1,`rgba(235,240,255,${a})`);
  ctx.strokeStyle=g;ctx.lineWidth=.9*d;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(hx,hy);ctx.stroke();ctx.restore()}
 let lastMet=-1e9,heroes=[];
 /* the finish, a crescendo: for ~1.4 s the sky spins up (ease-in, the trails smearing into rings) and the aurora flares; at
    the peak a soft exposure flash; effects.js then dissolves the night in ~0.9 s and the image is there. Deterministic —
    it starts when the job is done, never on a guess of when it will be. The counter stops, the dot goes out. */
 const RAMP=1400;let finT=null,fin=null,live={th:0,age:0,span:0,pr:0},spinA=0,spinW=0;
 return{finish(t){finT=t;fin=null;spinA=spinW=0},
  /* the peak's soft exposure flash: its own layer (effects.js draws it above the cover) so it runs its full course after
     the night has cleared — the sky is gone under it, then it hands over to the clean image */
  drawFlash(ctx,W,H,t,cols){if(finT==null)return;const r=t-finT-RAMP,fl=r<0?Math.pow(Math.max(0,1+r/RAMP),2):r<900?.5+.5*Math.cos(Math.PI*r/900):0;   /* the light builds through the whole ramp, then releases */if(fl<.01)return;
   ctx.save();ctx.globalCompositeOperation="screen";ctx.globalAlpha=.3*fl;ctx.fillStyle=mixHex(cols[1],"#ffffff",.6);ctx.fillRect(0,0,W,H);ctx.restore()},glowInfo(){return{src:sm2,met:lastMet}},
  reset(){sk="";span=0;lastStep=null;meteors=[];hasMask=false;mt=mcur=null;ae=1;finT=null;fin=null;spinA=spinW=0},
  draw(ctx,W,H,t,d,cols,st){const k=W+"x"+H;if(k!==sk){sk=k;M=Math.round(60*d);lit.width=W;lit.height=H;build(W,H,d);filmT=-1e9;pending=false;gen++;
    if(film&&film.close)film.close();if(prev&&prev.close)prev.close();film=prev=null;if(wk)wk.postMessage({init:{B:batches,P,W,H,M,d}})}
   const dt=lt==null?16:Math.min(100,Math.max(0,t-lt));lt=t;
   let str=st.str,age=Math.max(0,st.age||0),pr=Math.max(0,Math.min(1,st.prog||0)),sky=st.sky!=null?st.sky:t/1000,th=OMEGA*sky;
   const fz=finT!=null&&t>=finT,ramp=fz?Math.min(1,(t-finT)/RAMP):0,acc=ramp*ramp*ramp;
   if(fz){if(!fin)fin={...live};spinW=3.2*acc;spinA+=spinW*dt/1000;th=fin.th+spinA;age=fin.age;pr=fin.pr}   // the sky spins up; the counter stops
   if(fz)str*=Math.max(0,1-Math.max(0,t-finT-RAMP)/450);                                               /* at the peak the flash consumes the sky: gone in ~0.45 s */
   const want=SPAN*Math.min(1,pr/.9);span=fz?fin.span:filmT<-1e8?want:span+(want-span)*Math.min(1,dt/2500);if(!fz)live={th,age,span,pr};   // eases: a step finishing early or late doesn't jolt the trails
   if(!fz&&st.step!=null&&lastStep!=null&&st.step>lastStep)meteor(W,H,d,t);if(st.step!=null)lastStep=st.step;    // a meteor for each finished step
   if(!pending&&t-filmT>2000){filmT=t;
    if(wk){pending=true;wk.postMessage({gen,th,sp:span,seg:SEG})}
    else{if(!fb){fb=document.createElement("canvas")}fb.width=W+2*M;fb.height=H+2*M;exposeTrails(fb.getContext("2d"),batches,P,W,H,M,d,span,th,SEG);film=fb;filmTh=th}}
   if(fresh){fresh=false;xfT=t}const xf=prev?Math.min(1,(t-xfT)/600):1;if(prev&&xf>=1){if(prev.close)prev.close();prev=null}
   const put=(img,a,ang)=>{lc.save();lc.globalAlpha=Math.min(1,a);lc.globalCompositeOperation="lighter";lc.translate(P.px,P.py);lc.rotate(th-ang);lc.translate(-P.px,-P.py);lc.drawImage(img,-M,-M);lc.restore()};
   lc.clearRect(0,0,W,H);
   const nb=spinW>.05?6:1,sweep=spinW*.07;                                                            // ~70 ms of shutter: the trails smear into rings
   for(let b=0;b<nb;b++){const o=nb>1?-sweep*b/(nb-1):0,wb=1/nb;if(film)put(film,xf*wb,filmTh-o);if(prev)put(prev,(1-xf)*wb,prevTh-o)}                 // the new film cross-fades in over 0.6 s
   const res=ss(.12,.6,pr);if(t-maskT>400){maskT=t;try{sampleMask(st.src,W,H,res)}catch(e){}}hasMask=easeMask(dt);
   if(hasMask){lc.globalCompositeOperation="destination-in";lc.imageSmoothingEnabled=true;lc.imageSmoothingQuality="high";lc.drawImage(mask,0,0,W,H);lc.globalCompositeOperation="source-over"}
   ctx.save();
   const w4=Math.max(40,Math.round(W/4)),h4=Math.max(30,Math.round(H/4));if(sm.width!==w4||sm.height!==h4){sm.width=sm2.width=w4;sm.height=sm2.height=h4}
   smc.clearRect(0,0,w4,h4);const brk=fz&&ramp>.3?Math.pow((ramp-.3)/.7,1.3)*1.1:0;   /* the aurora answers the build: it starts ~0.4 s in, after the spin and the light, and catches up by the peak */
   aur.draw(smc,w4,h4,t/1000,cols,{scale:2,layout:"cam",auto:true,alpha:1,blend:"lighter",gain:.62*ae,surgeK:.45,boost:brk});   // gentler surges: a dark theme
   if(wk&&!fz&&!aeBusy&&t-aeT>250){aeT=t;aeBusy=true;                                                  // auto-exposure, like the camera it is, metered on the highlights (worker)
    createImageBitmap(sm,{resizeWidth:64,resizeHeight:80,resizeQuality:"medium"}).then(b=>wk.postMessage({ae:b},[b]),()=>aeBusy=false)}
   sm2c.clearRect(0,0,w4,h4);sm2c.filter="blur(1.4px)";sm2c.drawImage(sm,0,0);sm2c.filter="none";
   ctx.globalCompositeOperation="screen";ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";   /* screen, not add: the soft and sharp aurora layers stacked additively and clipped to white in a surge */
   ctx.globalAlpha=Math.min(1,str*1.3);ctx.drawImage(sm2,0,0,W,H);ctx.globalAlpha=Math.min(1,str*.4);ctx.drawImage(sm,0,0,W,H);ctx.globalCompositeOperation="lighter";   // keeps its rays
   ctx.globalAlpha=Math.min(1,Math.pow(str,1.4)*1.15);ctx.drawImage(lit,0,0);
   ctx.lineCap="butt";for(const s of heroes){const h=s.a+th,sw=Math.max(span,1.1*d/s.r),fa=Math.min(1,Math.pow(str,1.4)*1.15);   // the two bright ones
    ctx.strokeStyle=s.c;for(let k=0;k<SEG;k++){const a0=h-sw+sw*k/SEG;ctx.globalAlpha=fa*.9*(.12+.88*Math.pow((k+1)/SEG,1.3));ctx.lineWidth=s.w;ctx.beginPath();ctx.arc(P.px,P.py,s.r,a0,a0+sw/SEG);ctx.stroke()}
    ctx.globalAlpha=fa*.25;ctx.lineWidth=s.w*3.5;ctx.beginPath();ctx.arc(P.px,P.py,s.r,h-sw*.3,h);ctx.stroke();                          // a little bloom near the head
    ctx.globalAlpha=fa;ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(P.px+s.r*Math.cos(h),P.py+s.r*Math.sin(h),s.w*.9,0,6.283);ctx.fill()}   // the star itselfctx.globalAlpha=1;
   drawSat(ctx,W,H,t,d,str);meteors=drawMeteors(ctx,t,d,str);
   ctx.globalCompositeOperation="overlay";ctx.globalAlpha=.07*str;if(!pat)pat=ctx.createPattern(grain,"repeat");
   ctx.translate(Math.random()*160|0,Math.random()*160|0);ctx.fillStyle=pat;ctx.fillRect(-160,-160,W+320,H+320);ctx.setTransform(1,0,0,1,0,0);
   ctx.globalCompositeOperation="source-over";const fs=Math.round(11*d),m=Math.round(14*d),mm=String(Math.floor(age/60)).padStart(2,"0"),sc=String(Math.floor(age%60)).padStart(2,"0");
   ctx.font=`500 ${fs}px "IBM Plex Mono",ui-monospace,monospace`;ctx.textBaseline="bottom";
   ctx.globalAlpha=fz?0:str*(.55+.45*(Math.sin(t/420)>0?1:0));ctx.fillStyle="#ff5a4e";ctx.beginPath();ctx.arc(m+fs*.35,H-m-fs*.42,fs*.3,0,6.283);ctx.fill();
   ctx.globalAlpha=str*.62;ctx.fillStyle="#e8f0ec";ctx.fillText(`EXP ${mm}:${sc}  ·  ƒ/1.4  ·  ISO 6400`,m+fs*1.1,H-m);
   ctx.restore()}}}

/* Aurora's halo: the image box glows while a job runs. Two layers, built with the user over many clips:
   - the bloom: ~10 soft lobes of light drifting slowly round the border, each pulsing on its own 3–9 s rhythm (green
     at the edge, mint further out, a hint of magenta at the far end); the bottom is shorter (the status sits under it)
   - the edge: a thin glow hard against the image, falling off outward like light (inverse-square), that swells from
     ~3 to ~20 px where a lobe is bright and shrinks where it is dim, so it breathes with the bloom
   Its own clock only: nothing here is paced by the job's speed (it must look the same on any GPU). Swells (a meteor,
   the finish) come in through `boost` with a soft envelope from effects.js. Drawn at device pixels; the bloom at
   1/5 size, the edge from two fixed band shapes cut by a lobe-lit tint, so a frame is a handful of image draws. */
function makeHalo(){const so=document.createElement("canvas"),sx=so.getContext("2d"),sb=document.createElement("canvas"),sbx=sb.getContext("2d");
 const swN=document.createElement("canvas"),swW=document.createElement("canvas"),swT=document.createElement("canvas"),swT2=document.createElement("canvas"),ts=document.createElement("canvas");
 let sstrip=null,key="",spts=null,pk="",lastT=null,fT=0,swKey="",rimPts=null,rk="";
 /* normalised: the lobes stay evenly spaced and turn round the border together (each with a small wobble of its own), and
    their pulses are staggered (golden-ratio phases), so there is always light on every side and never a moment when all dip */
 const patches=Array.from({length:10},(_,i)=>({s0:i/10,s:i/10,wob:Math.random()*6.283,wf:.05+Math.random()*.06,w:.024+Math.random()*.022,
  per:3+Math.random()*6,ph:i*2.39996,d:.7+Math.random()*.3}));let spin=0;
 function strip(c){const red=mixHex(c[2],"#ff3355",.45),s=document.createElement("canvas");s.width=1;s.height=256;
  const g=s.getContext("2d"),gr=g.createLinearGradient(0,0,0,256);                                  // base (y=256) at the edge, a long smooth fall-off
  /* ambient light, not a second edge: less saturated (toward a dark teal), and dimmer right at the edge so the hot edge
     keeps a darker margin to pop against; its mass sits a little further out */
  const a0=mixHex(c[0],"#3d6e66",.3),a1=mixHex(c[1],"#4d6f6b",.3);
  gr.addColorStop(0,rgba(red,0));gr.addColorStop(.25,rgba(c[2],.06));gr.addColorStop(.55,rgba(a1,.2));gr.addColorStop(.8,rgba(a0,.42));gr.addColorStop(.93,rgba(a0,.34));gr.addColorStop(1,rgba(a0,.26));
  g.fillStyle=gr;g.fillRect(0,0,1,256);return s}
 /* points round the rounded rectangle: position, outward normal, side weight (the bottom shorter), position along it */
 function perimeter(x0,y0,w,h,rr,step){const p=[],L=2*(w+h-4*rr)+2*Math.PI*rr;let s=0;
  const seg=[[x0+rr,y0,1,0,w-2*rr,"t"],[x0+w,y0+rr,0,1,h-2*rr,"r"],[x0+w-rr,y0+h,-1,0,w-2*rr,"b"],[x0,y0+h-rr,0,-1,h-2*rr,"l"]];
  const corners=[[x0+w-rr,y0+rr,-Math.PI/2],[x0+w-rr,y0+h-rr,0],[x0+rr,y0+h-rr,Math.PI/2],[x0+rr,y0+rr,Math.PI]];
  const wt={t:.7,r:.8,b:.45,l:.8},nxt=["r","b","l","t"];   /* the top quieter too: the tab bar sits right above it */
  for(let i=0;i<4;i++){const [sx0,sy0,dx,dy,len,side]=seg[i];for(let d=0;d<len;d+=step)p.push({x:sx0+dx*d,y:sy0+dy*d,nx:dy,ny:-dx,w:wt[side],s:(s+d)/L});s+=len;
   const [cx,cy,a0]=corners[i],arc=Math.PI/2*rr;for(let d=0;d<arc;d+=step){const a=a0+d/rr;p.push({x:cx+rr*Math.cos(a),y:cy+rr*Math.sin(a),nx:Math.cos(a),ny:Math.sin(a),w:wt[side]+(wt[nxt[i]]-wt[side])*d/arc,s:(s+d)/L})}s+=arc}
  return p}
 /* how lit the border is at s: the lobes, each pulsing */
 const field=s=>{let v=0;for(const p of patches){let ds=Math.abs(s-p.s);ds=Math.min(ds,1-ds);if(ds<p.w*3){const pul=.3+.7*Math.pow(.5+.5*Math.sin(fT*6.283/p.per+p.ph),2);
   v+=Math.exp(-(ds*ds)/(2*p.w*p.w))*pul*p.d}}return v<.5?v:.5+(v-.5)/(1+1.5*(v-.5))};   // a soft knee: stacked lobes never light the whole edge at full
 return{
  /* the bloom, around a frame at X,Y (FW×FH) in ctx's pixels, reaching op.reach out */
  draw(ctx,X,Y,FW,FH,T,cols,op){fT=T;const P=op.reach,k=cols.join();if(k!==key){sstrip=strip(cols);key=k}
   const sw=Math.round((FW+2*P)/5),sh=Math.round((FH+2*P)/5);
   const kk=sw+"x"+sh+"x"+op.radius;if(kk!==pk){pk=kk;so.width=sb.width=sw;so.height=sb.height=sh;spts=perimeter(P/5,P/5,FW/5,FH/5,op.radius/5,1.2)}
   const dT=lastT==null?0:Math.max(0,Math.min(.2,T-lastT));lastT=T;const B=op.boost||0;
   spin=(spin+.004*dT)%1;for(const p of patches)p.s=(p.s0+spin+.022*Math.sin(T*p.wf*6.283+p.wob)+1)%1;   // they turn together, each wobbling a little
   sx.setTransform(1,0,0,1,0,0);sx.clearRect(0,0,sw,sh);sx.globalCompositeOperation="lighter";const SR=P/5;
   for(const q of spts){const f=(.18+.82*field(q.s))*q.w*(1+B);if(f<.01)continue;   /* a gentle floor */
    const hh=SR*(.6+.44*Math.min(1,f))*(.55+.45*q.w);sx.setTransform(-q.ny,q.nx,-q.nx,-q.ny,q.x,q.y);sx.globalAlpha=Math.min(1,f*.28);sx.drawImage(sstrip,-3.8,-hh,7.6,hh)}   /* ~6 strips overlap at a point */
   sx.setTransform(1,0,0,1,0,0);sx.globalAlpha=1;
   sbx.clearRect(0,0,sw,sh);sbx.filter="blur(.8px)";sbx.drawImage(so,0,0);sbx.filter="none";      // blurred at 1/5 size, then scaled straight up
   ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.globalCompositeOperation="lighter";ctx.globalAlpha=op.alpha;
   ctx.drawImage(sb,X-P,Y-P,FW+2*P,FH+2*P);ctx.restore()},
  /* the edge: two fixed inverse-square bands (narrow, wide), drawn once per size; each frame a lobe-lit tint picks the
     wide one where a lobe is bright and the narrow one where it is dim. Starts half a pixel under the image: no gap. */
  edge(ctx,X,Y,FW,FH,cols,op){const W1=op.narrow,W2=op.wide,M=Math.ceil(W2*1.6+4),bw=Math.ceil(FW+2*M),bh=Math.ceil(FH+2*M);
   const mk=[bw,bh,W1,W2,op.radius].join();
   if(mk!==swKey){swKey=mk;for(const c of [swN,swW,swT,swT2]){c.width=bw;c.height=bh}
    const F=(d,w)=>1/(1+Math.pow(d/(1.15*w/7),2));
    for(const [c,w] of [[swN,W1],[swW,W2]]){const g=c.getContext("2d");g.clearRect(0,0,bw,bh);g.strokeStyle="#fff";g.lineWidth=.6;
     for(let d=-.5;d<w*1.6;d+=.5){g.globalAlpha=Math.min(1,F(Math.max(0,d),w));g.beginPath();g.roundRect(M-d,M-d,FW+2*d,FH+2*d,Math.max(0,op.radius+d));g.stroke()}g.globalAlpha=1}}   // concentric: the radius grows outward
   const k=[X,Y,FW,FH,op.radius].join();if(k!==rk){rk=k;rimPts=perimeter(X,Y,FW,FH,op.radius,3)}
   const sw=Math.ceil(bw/4),sh=Math.ceil(bh/4);if(ts.width!==sw||ts.height!==sh){ts.width=sw;ts.height=sh}
   const tint=(c,col,pick)=>{const t=ts.getContext("2d");t.clearRect(0,0,sw,sh);t.lineCap="round";t.lineWidth=M/2;t.strokeStyle=col;
    for(let i=0;i<rimPts.length;i+=2){const a=rimPts[i],f=Math.min(1.3,field(a.s)),lit=(.12+.58*Math.pow(Math.min(1,f),1.3))*(.6+.4*a.w)*(1+.6*(op.boost||0))*op.alpha;
     const wide=Math.min(1,Math.max(0,(f-.15)/.75))*(.5+.5*a.w),al=lit*pick(wide);if(al<.01)continue;   // how far it reaches here follows the lobe
     t.globalAlpha=Math.min(1,al*.5);t.beginPath();t.moveTo((a.x-X+M)/4,(a.y-Y+M)/4);t.lineTo((a.x-X+M)/4+.01,(a.y-Y+M)/4);t.stroke()}t.globalAlpha=1;   /* round dots at 1/4 size: smooth, no wedges at corners */
    const g=c.getContext("2d");g.globalCompositeOperation="source-over";g.clearRect(0,0,bw,bh);g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";g.drawImage(ts,0,0,bw,bh)};
   const cut=(c,m)=>{const g=c.getContext("2d");g.globalCompositeOperation="destination-in";g.drawImage(m,0,0);g.globalCompositeOperation="source-over"};
   tint(swT,cols[0],w=>1-w);cut(swT,swN);tint(swT2,mixHex(cols[0],cols[1],.35),w=>w);cut(swT2,swW);
   ctx.save();ctx.globalCompositeOperation="lighter";ctx.drawImage(swT,X-M,Y-M);ctx.drawImage(swT2,X-M,Y-M);ctx.restore()}}}

/* ---------- Code (Emerald): our own glyphs, a cold sparse background, a CRT render screen ----------
   Inspired by the film's rain, not copied: the glyphs are drawn here from straight strokes on a 4×6 grid
   (blocky, half of them mirrored), so the set is ours to ship. */
const GLYPHS=(()=>{const P=s=>s.split(";").map(l=>l.trim().split(",").map(p=>p.trim().split(" ").map(Number)));
 const kana=["1 1,0 5;3 1,4 5","0 1,4 2;0 3,4 4;1 5,4 6","4 0,4 6,0 6;4 3,1 3","2 0,2 1;0 1,4 1,4 3,2 6;0 1,0 3","0 1,1 2;0 3,1 4;4 1,3 5,0 6",
  "0 2,4 2;2 0,2 4,1 6","0 1,4 1;0 3,4 3;2 1,2 6,4 6","1 1,3 1;0 5,4 5","0 2,4 2;1 0,1 4;3 0,3 4,1 6","0 2,4 2;3 0,3 6,2 6;3 2,0 5",
  "1 0,1 3;3 0,3 4,2 6","0 1,4 1,3 3;2 2,2 4,1 6","0 2,4 2;2 0,2 6;1 4,0 5;3 4,4 5","1 0,3 0;0 2,4 2;2 2,2 4,1 6","0 1,4 1,2 4;1 3,3 5",
  "1 0,0 3;1 2,4 2;3 2,3 4,2 6","4 0,0 6;1 2,3 5","0 1,4 1;2 1,2 5;0 5,4 5","0 2,4 2,4 6,3 6;2 0,2 3,0 6","0 2,4 2;0 4,4 4;2 0,2 6",
  "2 0,0 5,4 5;3 3,4 6","0 2,3 2,3 5;0 5,4 5","1 0,3 0;0 2,4 2,3 4,1 6","0 2,4 2,3 4;1 0,1 5,4 5","2 0,2 1;0 2,4 2,0 5;2 3,2 6;3 4,4 5",
  "1 0,0 3;1 1,4 1,3 4,1 6;1 3,3 4"];
 const other=["0 0,4 0,4 6,0 6,0 0","1 1,2 0,2 6","0 0,4 0,4 3,0 3,0 6,4 6","0 0,4 0,4 6,0 6;1 3,4 3","0 0,0 3,4 3;4 0,4 6","4 0,0 0,0 3,4 3,4 6,0 6",
  "0 0,4 0,4 6","0 0,4 0,4 6,0 6,0 0;0 3,4 3","4 3,0 3,0 0,4 0,4 6,0 6","0 0,4 0,0 6,4 6","2 1.6,2 2.4;2 3.8,2 4.6","0 2,4 2;0 4,4 4","0 3,4 3;2 1,2 5",
  "0 1,4 5;4 1,0 5;2 0.5,2 5.5","4 0,0 3,4 6","0 0,4 3,0 6","1.6 5.4,2.4 5.4","1 0,1 1.2;3 0,3 1.2"];
 const mir=g=>g.map(l=>l.map(([x,y])=>[4-x,y]));
 return kana.map(P).map((g,i)=>i%2?g:mir(g)).concat(other.map(P))})();

/* an atlas: every glyph pre-drawn with its glow, in the trail colour and the head colour; cells are drawn from it */
function glyphAtlas(cs,trail,head,glowT,glowH){const pad=Math.ceil(cs*.45),cw=cs+pad*2,ch=Math.round(cs*1.18)+pad*2,n=GLYPHS.length;
 const a=document.createElement("canvas");a.width=cw*n;a.height=ch*2;const g=a.getContext("2d");g.lineCap="square";g.lineJoin="miter";
 const sx=cs*.62/4,sy=cs*1.0/6,ox=pad+cs*.19,oy=pad+cs*.09;
 [trail,head].forEach((col,row)=>{g.strokeStyle=col;g.lineWidth=Math.max(1,cs*.14);g.shadowColor=col;g.shadowBlur=(row?glowH:glowT)*cs; // the trail is crisp, only the head glows
  GLYPHS.forEach((gl,i)=>{g.beginPath();for(const line of gl){line.forEach(([x,y],k)=>{const px=i*cw+ox+x*sx,py=row*ch+oy+y*sy;k?g.lineTo(px,py):g.moveTo(px,py)})}g.stroke()})});
 return{a,cw,ch,pad,n}}

/* background: sparse, slow, pale and cold, with a wide range of sizes — tiny sharp far columns, now and then one fat soft
   near one. Size sets depth: speed, blur and brightness. It answers the app quietly: almost still and dimming when idle,
   livelier and drifting toward the render window while a job runs, one wave of light when an image lands. */
function makeCodeBg(){let at=null,at2=null,key="",streams=[],fatT=0,acc=0,events=[],evT=8000+Math.random()*12000;
 const spawn=(W,H,d,run,fx,fat,first)=>{const r=Math.random(),s=(fat?54+Math.random()*46:7+Math.pow(r,3)*26)*d;
  const x=run&&!fat&&Math.random()<.35?fx+(Math.random()-.5)*W*.35:Math.random()*W;
  const L=Math.round(fat?6+Math.random()*7:Math.random()<.08?26+Math.random()*30:5+Math.random()*18); /* now and then a long one */return{x,s,y:first?Math.random()*H*1.2:-Math.random()*H*.3,v:(55+2.4*s/d)*d*(()=>{const r=Math.random();return r<.06?1.8+Math.random()*.7:r<.14?.3+Math.random()*.15:.5+Math.random()})(),L, /* ×0.5–1.5, a rare racer, a rare drifter */
   alt:Math.random()<.1,g:Array.from({length:L},()=>Math.random()*GLYPHS.length|0),a:fat?.10+Math.random()*.06:.16+(1-s/(34*d))*.18,fat}};
 return{draw(ctx,W,H,t,dt,d,cols,st){const k=cols[2]+cols[0];if(k!==key){key=k;
   const cold=mixHex(mixHex(cols[2],"#9ad7e6",.45),"#8a9aa0",.25);at=glyphAtlas(24,cold,"#e9fbff",.1,.4);
   at2=glyphAtlas(24,mixHex(mixHex(harmonics(cols[0]).an,"#9ad7e6",.4),"#8a9aa0",.25),"#e9fbff",.1,.4);streams=[]} // ~1 column in 10 in the neighbour hue
  const want=Math.round(W/(115*d)*(st.run?1.25:1));
  const first=!streams.length;while(streams.filter(s=>!s.fat&&!s.ev).length<want)streams.push(spawn(W,H,d,st.run,st.fx,false,first));
  /* clusters: every 15–35 s a small area comes alive — 3–8 columns over 1.5–4 s, each its own size, speed and length */
  evT-=dt;if(evT<=0&&!st.reduce){evT=15000+Math.random()*20000;const dur=1500+Math.random()*2500,n=3+(Math.random()*6|0);
   events.push({x:(.08+Math.random()*.84)*W,w:(80+Math.random()*170)*d,at:Array.from({length:n},()=>t+Math.random()*dur).sort((a,b)=>a-b)})}
  for(let i=events.length-1;i>=0;i--){const ev=events[i];while(ev.at.length&&ev.at[0]<=t){ev.at.shift();const o=spawn(W,H,d,false,0,false,false);
    o.x=ev.x+(Math.random()-.5)*ev.w;o.ev=1;streams.push(o)}if(!ev.at.length)events.splice(i,1)}
  fatT-=dt;if(fatT<=0&&!streams.some(s=>s.fat)){streams.push(spawn(W,H,d,st.run,st.fx,true));fatT=10000+Math.random()*10000}
  const sp=(st.run?1:.55)*(st.reduce?0:1),dim=st.dim;
  const wave=st.wave?(t-st.wave)/1300:null;
  ctx.save();ctx.imageSmoothingEnabled=true;
  for(let i=streams.length-1;i>=0;i--){const s=streams[i];s.y+=s.v*sp*dt/1000;const ch=s.s*1.18;
   const X=s.x,A=s.alt?at2:at;
   if(!s.hr)s.hr=Math.random()<.12?1.6+Math.random()*1.4:.5+Math.random()*1.5; // its head changes 0.5–2 times a second, now and then a livelier one
   if(Math.random()<s.hr*dt/1000)s.g[0]=Math.random()*GLYPHS.length|0;
   if(s.y-ch*s.L>H){streams.splice(i,1);continue}
   if(Math.random()<.015*dt/33){(s.hu||(s.hu=[]))[Math.random()*s.L|0]=t+700+Math.random()*1000} // now and then a glyph isn't sure
   for(let c=0;c<s.L;c++){const y=s.y-c*ch;if(y<-ch||y>H+ch)continue;
    const hz=s.hu&&s.hu[c]>t;if(hz&&Math.random()<.12*dt/33)s.g[c]=Math.random()*GLYPHS.length|0;
    let a=s.a*dim*(c===0?1.6:1-c/s.L*.75);
    if(wave!=null&&wave<1.2){const f=wave*(W+H)-(s.x+y);a*=1+1.6*Math.exp(-f*f/(2*Math.pow(140*d,2)))}
    ctx.globalAlpha=Math.min(1,a);const row=c===0?1:0,sc=s.s/24;
    ctx.drawImage(A.a,s.g[c]*A.cw,row*A.ch,A.cw,A.ch,X-A.pad*sc,y-A.pad*sc,A.cw*sc,A.ch*sc)
    if(c===0){ctx.globalAlpha=Math.min(1,a)*(.06+.34*Math.pow(.5+.5*Math.sin(t/(700+s.s*6)+s.x*.013),2)); /* only the head glows, pulsing slowly */ctx.drawImage(A.a,s.g[0]*A.cw,A.ch,A.cw,A.ch,X-A.pad*sc*1.7-s.s*.35,y-A.pad*sc*1.7-ch*.35,A.cw*sc*1.7,A.ch*sc*1.7)}}}
  // where app text sits on the bare background (the name, the status line), the code fades out softly, like depth of field
  ctx.globalCompositeOperation="destination-out";
  for(const h of st.holes||[])for(let k=0;k<6;k++){const e=(6-k)*7*d;ctx.globalAlpha=k===5?.9:.16;
   ctx.beginPath();ctx.roundRect(h.x-e,h.y-e,h.w+2*e,h.h+2*e,14*d+e);ctx.fill()}
  ctx.restore()}}}

/* the render screen while a job is young: an old phosphor monitor. It powers on with a single line that blooms open,
   one lone stream falls, then the cascade fills the screen — fine, bright, standing text written by bright heads.
   As the steps go on the code takes on your image's light and dark (it forms the picture), and the screen hands over to
   the clean image. */
function makeCRT(){const scr=document.createElement("canvas"),s=scr.getContext("2d"),ovl=document.createElement("canvas"),o=ovl.getContext("2d");
 const lumC=document.createElement("canvas"),lc=lumC.getContext("2d",{willReadFrequently:true});
 let at=null,key="",cols=[],nc=0,nr=0,cs=0,chh=0,glyph=null,hunt=null,acc=0,on=-1,lum=null,lumT=0,ow=0,oh=0,gl=null,glT=0;
 function layout(W,H,d,c3){cs=Math.round(13*d);chh=Math.round(cs*1.18);nc=Math.floor(W/cs);nr=Math.ceil(H/chh);
  scr.width=W;scr.height=H;at=glyphAtlas(cs,c3[0],"#eafff2",.16,.6);glyph=new Uint8Array(nc*nr).map(()=>Math.random()*GLYPHS.length|0);hunt=new Float32Array(nc*nr);cols=[];
  for(let i=0;i<nc;i++)cols.push(newCol(true))}
 const lenFor=res=>{const r=Math.random();return Math.max(3,Math.round(r<.15?3+Math.random()*6:r>.9?nr*(1+Math.random()*.8):nr*(.3+Math.random()*.6+res*.5)))}; // short bursts, long runs
 const newCol=first=>({h:first?-1e9:-Math.random()*nr*.5,v:Math.random()<.05?34+Math.random()*12:5+Math.random()*24,L:lenFor(0),last:-1});
 const rnd=()=>Math.random()*GLYPHS.length|0;
 function overlay(W,H,d){if(ow===W&&oh===H)return;ow=ovl.width=W;oh=ovl.height=H;o.clearRect(0,0,W,H);
  const step=Math.max(2,Math.round(3*d));o.fillStyle="rgba(0,0,0,.26)";for(let y=0;y<H;y+=step)o.fillRect(0,y,W,Math.max(1,Math.round(d))); // scanlines
  o.fillStyle="rgba(0,0,0,.07)";for(let x=0;x<W;x+=step)o.fillRect(x,0,Math.max(1,Math.round(d*.8)),H);                                     // phosphor mask
  const v=o.createRadialGradient(W/2,H/2,Math.min(W,H)*.32,W/2,H/2,Math.hypot(W,H)*.56);v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(1,"rgba(0,0,0,.62)");
  o.fillStyle=v;o.fillRect(0,0,W,H);                                                                                                        // tube vignette
  const r=o.createLinearGradient(0,0,W*.6,H*.6);r.addColorStop(0,"rgba(255,255,255,.05)");r.addColorStop(.35,"rgba(255,255,255,0)");o.fillStyle=r;o.fillRect(0,0,W,H)} // glass reflection
 function sample(src){if(!src||src.width<8)return;lumC.width=nc;lumC.height=nr;lc.drawImage(src,0,0,nc,nr);const p=lc.getImageData(0,0,nc,nr).data;
  lum=new Float32Array(nc*nr);for(let i=0;i<nc*nr;i++)lum[i]=(p[i*4]*.3+p[i*4+1]*.59+p[i*4+2]*.11)/255}
 /* glitches: rare and short — a block of cells scrambles with a flash, a band of rows tears sideways, or a few columns drop out */
 function glitch(t){const k=Math.random();
  if(k<.45)gl={type:"block",until:t+180+Math.random()*220,x0:Math.random()*nc|0,y0:Math.random()*nr|0,w:2+Math.random()*6|0,h:3+Math.random()*7|0};
  else if(k<.8)gl={type:"tear",until:t+90+Math.random()*110,y0:Math.random()*nr|0,h:1+Math.random()*4|0,dx:(Math.random()<.5?-1:1)*(1+Math.random()*3|0)*cs};
  else gl={type:"drop",until:t+70+Math.random()*90,x0:Math.random()*nc|0,w:1+Math.random()*4|0}}
 return{powerOn(t){on=t;cols.forEach(c=>Object.assign(c,newCol(true)));lum=null;gl=null;glT=t+4000+Math.random()*5000},
  draw(ctx,W,H,t,dt,d,c3,st){const k=W+"x"+H+c3[0];if(k!==key){key=k;layout(W,H,d,c3)}overlay(W,H,d);
   if(on<0){on=t;glT=t+2500}const age=t-on;
   if(t-lumT>500){lumT=t;try{sample(st.src)}catch(e){}}
   acc+=dt;if(acc>=33){const step=Math.min(.1,acc/1000);acc=0;              // the code moves at ~30 fps
    const lone=age<1400,res=st.resolve;
    if(t>glT&&age>2000&&!st.reduce){glitch(t);glT=t+6000+Math.random()*8000}
    if(gl&&t>gl.until)gl=null;
    for(let i=0;i<nc;i++){const c=cols[i];
     if(c.h<-1e8){const start=lone?(i===Math.floor(nc*.38)?0:null):Math.random()<(.05+res*.4)*(age<3000?.6:1)*(c.boost>t?5:1)?0:null; // one lone stream first, then the cascade
      if(start===null)continue;c.h=-Math.random()*3;for(let k=-3;k<=3;k++)if(k&&cols[i+k])cols[i+k].boost=t+700} // a start makes its neighbours likelier to start: patches, not an even rain
     c.h+=c.v*step;const hd=Math.floor(c.h);
     if(hd!==c.last&&hd>=0&&hd<nr){c.last=hd;const n=i*nr+hd;glyph[n]=rnd();if(Math.random()<.25)hunt[n]=t+600+Math.random()*1000} // now and then a fresh cell isn't sure yet
     if(c.h-c.L>nr){Object.assign(c,newCol(false));c.L=lenFor(res)}}
    for(let q=Math.round(nc*.008);q>0;q--){const n=Math.random()*nc*nr|0;if(hunt[n]<t)hunt[n]=t+700+Math.random()*900} // rarely, a standing one doubts itself
    s.clearRect(0,0,W,H);const fl=.94+.06*Math.random();                      // flicker
    for(let i=0;i<nc;i++){const c=cols[i];if(c.h<0)continue;const top=Math.max(0,Math.floor(c.h-c.L)),hd=Math.min(nr-1,Math.floor(c.h));
     const drop=gl&&gl.type==="drop"&&i>=gl.x0&&i<gl.x0+gl.w;if(drop)continue;
     for(let r=top;r<=hd;r++){const n=i*nr+r,x=i*cs,y=r*chh;let a=r===hd?1:.42+.5*Math.pow(1-(hd-r)/c.L,.6),row=r===hd?1:0;
      const hunting=hunt[n]>t;if(hunting&&Math.random()<.12)glyph[n]=rnd();                // still deciding: changes every ~¼–½ s, calmly
      if(r===hd&&Math.random()<(c.hr||(c.hr=2+Math.random()*2.5))*.033)glyph[n]=rnd();    // the head keeps changing, 2–4.5 times a second: a comet
      let dx=0;
      if(gl){if(gl.type==="block"&&i>=gl.x0&&i<gl.x0+gl.w&&r>=gl.y0&&r<gl.y0+gl.h){glyph[n]=rnd();row=1;a=1}
       else if(gl.type==="tear"&&r>=gl.y0&&r<gl.y0+gl.h)dx=gl.dx}
      if(res>0&&lum){const L=lum[r*nc+i];a*=1-res+res*(.08+1.5*L*L)}           // the code takes on the image
      if(a<.03)continue;s.globalAlpha=Math.min(1,a*fl);
      s.drawImage(at.a,glyph[n]*at.cw,row*at.ch,at.cw,at.ch,x-at.pad+dx,y-at.pad,at.cw,at.ch)
      if(r===hd){s.globalAlpha=Math.min(1,a*fl)*(.08+.42*Math.pow(.5+.5*Math.sin(t/520+i*1.7),2)); /* a pulsing head, not a double image */s.drawImage(at.a,glyph[n]*at.cw,at.ch,at.cw,at.ch,x-at.pad*1.7+dx-cs*.35,y-at.pad*1.7-chh*.35,at.cw*1.7,at.ch*1.7)}}} // its halo
    s.globalAlpha=1}
   const str=st.str;
   ctx.save();
   if(age<650){const p=age/650;ctx.fillStyle="rgba(0,0,0,.92)";ctx.fillRect(0,0,W,H);             // power-on: a line that blooms open
    const lw=W*Math.min(1,p/.35),lh=Math.max(1.5*d,H*Math.pow(Math.max(0,(p-.35)/.65),2)),fade=1-Math.max(0,p-.55)/.45;ctx.globalCompositeOperation="lighter";
    const g=ctx.createLinearGradient((W-lw)/2,0,(W+lw)/2,0);g.addColorStop(0,rgba(c3[0],0));g.addColorStop(.2,rgba(c3[0],1));g.addColorStop(.5,rgba("#f2fff6",1));g.addColorStop(.8,rgba(c3[0],1));g.addColorStop(1,rgba(c3[0],0));
    ctx.fillStyle=g;for(let k=5;k>=0;k--){const h=lh+k*k*3*d;ctx.globalAlpha=fade*(k?.16/(1+k*.5):.95);ctx.fillRect((W-lw)/2,H/2-h/2,lw,h)} // halo layers, then the hot core
    ctx.restore();return}
   ctx.globalAlpha=Math.min(1,str*1.15);ctx.globalCompositeOperation="lighter";ctx.drawImage(scr,0,0);
   if(gl&&gl.type==="block"){ctx.globalAlpha=.12*str;ctx.fillStyle=(window.HARM||{}).comp||c3[0];ctx.fillRect(0,0,W,H)} // a glitch flashes the tube in the complementary hue
   ctx.globalCompositeOperation="source-over";ctx.globalAlpha=Math.min(1,str*1.4);ctx.drawImage(ovl,0,0);
   ctx.restore()},
  sweep(ctx,W,H,p,d,c3){overlay(W,H,d);const y=H*(1-Math.pow(1-p,2.2)),ac=(window.HARM||{}).an||c3[0]; /* the neighbour hue */                             // finish: one refresh sweeps the screen clean
   ctx.save();ctx.beginPath();ctx.rect(0,y,W,H-y);ctx.clip();ctx.globalAlpha=.85*(1-p*.4);ctx.drawImage(ovl,0,0);ctx.fillStyle=rgba(ac,.10);ctx.fillRect(0,y,W,H-y);ctx.restore();
   ctx.save();ctx.globalCompositeOperation="lighter";const g=ctx.createLinearGradient(0,y-46*d,0,y+6*d);g.addColorStop(0,rgba(ac,0));g.addColorStop(.85,rgba("#eafff2",.5*(1-p)));g.addColorStop(1,rgba(ac,0));
   ctx.fillStyle=g;ctx.fillRect(0,y-46*d,W,52*d);ctx.restore()}}}
function mixHex(a,b,t){const A=parseInt(toHex(a).slice(1),16),B=parseInt(toHex(b).slice(1),16);const m=s=>Math.round(((A>>s)&255)*(1-t)+((B>>s)&255)*t);
 return "#"+[16,8,0].map(s=>m(s).toString(16).padStart(2,"0")).join("")}
