/* Kiln · skins: a theme sets the accent colours, the idle background and the cover over a young generation.
   Aurora = northern lights; Emerald = code: a sparse cold code background and an old phosphor monitor as the render
   screen. The other themes keep the starfield and the light bands. Everything is cheap on purpose (the GPU is busy
   generating): pre-drawn glyphs and patterns, low resolution where softness is the look, ~30 fps. */
const SKINS={ice:{bg:"stars",cover:"bands"},sunset:{bg:"stars",cover:"bands"},ember:{bg:"stars",cover:"bands"},
 aurora:{bg:"aurora",cover:"aurora"},emerald:{bg:"code",cover:"crt",font:"IBM Plex Mono",title:"Courier Prime"}};
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

/* northern lights: a few curtains, each a row of thin vertical strokes — bright lower edge (a1), fading up through a2
   into a3. The curtains sway and their rays shimmer; everything drifts slowly to the right. */
function makeAurora(){const off=document.createElement("canvas"),o=off.getContext("2d");let strip=null,key="";
 function mkStrip(c){const s=document.createElement("canvas");s.width=1;s.height=160;const g=s.getContext("2d"),gr=g.createLinearGradient(0,0,0,160);
  gr.addColorStop(0,rgba(c[2],0));gr.addColorStop(.3,rgba(c[2],.18));gr.addColorStop(.6,rgba(c[1],.42));gr.addColorStop(.82,rgba(c[0],.85));gr.addColorStop(.88,rgba("#eafff6",.75));gr.addColorStop(.93,rgba(c[0],.35));gr.addColorStop(1,rgba(c[0],0));
  g.fillStyle=gr;g.fillRect(0,0,1,160);return s}
 return{draw(ctx,W,H,T,cols,op){const sc=op.scale||6,w=Math.max(40,Math.round(W/sc)),h=Math.max(30,Math.round(H/sc));
  if(off.width!==w||off.height!==h){off.width=w;off.height=h}
  const k=cols.join();if(k!==key){strip=mkStrip(cols);key=k}
  o.clearRect(0,0,w,h);o.globalCompositeOperation="lighter";const N=op.ribbons||3;
  for(let r=0;r<N;r++){const ph=r*2.3+.7,base=h*(op.top+op.band*(N>1?r/(N-1):0)),amp=h*.06,len=h*(op.len||.3)*(1-.12*r);
   for(let x=0;x<w;x++){const u=x/w;
    const y=base+Math.sin(u*5.2-T*.12+ph)*amp+Math.sin(u*12.5-T*.07+ph*1.7)*amp*.4;
    const ray=Math.pow(.5+.5*Math.sin(u*46-T*.55+ph*3)*Math.sin(u*19-T*.21+ph),1.6)*(.55+.45*Math.sin(u*3.1-T*.05+ph*2)); // shimmering rays, brighter and darker stretches
    const s=u*1.15-.08+.12*Math.sin(T*.04+r*1.9),env=s<=0||s>=1?0:Math.sin(Math.PI*s); // fades out at the ends
    const a=ray*env*(.75-.14*r);if(a<.02)continue;
    const hh=len*(.7+.3*Math.sin(u*7-T*.09+ph));o.globalAlpha=a;o.drawImage(strip,x,y-hh,1.7,hh)}}
  o.globalAlpha=1;o.globalCompositeOperation="source-over";
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.globalAlpha=op.alpha;ctx.globalCompositeOperation=op.blend||"source-over";
  ctx.drawImage(off,0,0,W,H);ctx.restore()}}}

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
function makeCodeBg(){let at=null,at2=null,key="",streams=[],fatT=0,acc=0;
 const spawn=(W,H,d,run,fx,fat,first)=>{const r=Math.random(),s=(fat?54+Math.random()*46:7+Math.pow(r,3)*26)*d;
  const x=run&&!fat&&Math.random()<.35?fx+(Math.random()-.5)*W*.35:Math.random()*W;
  const L=Math.round(6+Math.random()*(fat?7:18));return{x,s,y:first?Math.random()*H*1.2:-Math.random()*H*.3,v:(55+2.4*s/d)*d*(.75+Math.random()*.5),L,
   alt:Math.random()<.1,g:Array.from({length:L},()=>Math.random()*GLYPHS.length|0),a:fat?.10+Math.random()*.06:.16+(1-s/(34*d))*.18,fat}};
 return{draw(ctx,W,H,t,dt,d,cols,st){const k=cols[2]+cols[0];if(k!==key){key=k;
   const cold=mixHex(mixHex(cols[2],"#9ad7e6",.45),"#8a9aa0",.25);at=glyphAtlas(24,cold,"#e9fbff",.1,.4);
   at2=glyphAtlas(24,mixHex(mixHex(harmonics(cols[0]).an,"#9ad7e6",.4),"#8a9aa0",.25),"#e9fbff",.1,.4);streams=[]} // ~1 column in 10 in the neighbour hue
  const want=Math.round(W/(115*d)*(st.run?1.25:1));
  const first=!streams.length;while(streams.filter(s=>!s.fat).length<want){const b=spawn(W,H,d,st.run,st.fx,false,first);streams.push(b);
   if(Math.random()<.14){for(let k=1,n=2+(Math.random()*3|0);k<n;k++){ // now and then a cluster: 2–4 close columns of a similar size and pace
    const o=spawn(W,H,d,st.run,st.fx,false,first),sz=b.s*(.8+Math.random()*.4);o.s=sz;o.x=b.x+(k%2?1:-1)*Math.ceil(k/2)*b.s*(1.05+Math.random()*.5);
    o.v=b.v*(.85+Math.random()*.3);o.y=b.y-Math.random()*b.s*6;o.a=b.a*(.8+Math.random()*.4);streams.push(o)}}}
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
   the clean image. The pointer parts the rain like a lens. */
function makeCRT(){const scr=document.createElement("canvas"),s=scr.getContext("2d"),ovl=document.createElement("canvas"),o=ovl.getContext("2d");
 const lumC=document.createElement("canvas"),lc=lumC.getContext("2d",{willReadFrequently:true});
 let at=null,key="",cols=[],nc=0,nr=0,cs=0,chh=0,glyph=null,hunt=null,acc=0,on=-1,lum=null,lumT=0,ow=0,oh=0,gl=null,glT=0;
 function layout(W,H,d,c3){cs=Math.round(13*d);chh=Math.round(cs*1.18);nc=Math.floor(W/cs);nr=Math.ceil(H/chh);
  scr.width=W;scr.height=H;at=glyphAtlas(cs,c3[0],"#eafff2",.16,.6);glyph=new Uint8Array(nc*nr).map(()=>Math.random()*GLYPHS.length|0);hunt=new Float32Array(nc*nr);cols=[];
  for(let i=0;i<nc;i++)cols.push(newCol(true))}
 const newCol=first=>({h:first?-1e9:-Math.random()*nr*.5,v:9+Math.random()*16,L:Math.round(nr*(.35+Math.random()*.7)),last:-1});
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
     if(c.h-c.L>nr){Object.assign(c,newCol(false));c.L=Math.round(nr*(.35+Math.random()*.7+res*.6))}}
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
      if(st.px!=null){const ddx=x+cs/2-st.px,ddy=y+chh/2-st.py,dd=Math.hypot(ddx,ddy),R=110*d;
       if(dd<R){const q=dd/R;a*=q*q*(3-2*q)}}                                    // around the pointer the characters go out: a lens
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
