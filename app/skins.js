/* Kiln · skins: a theme sets the accent colours, the idle background and the cover over a young generation.
   Aurora = northern lights, Emerald = Matrix rain; the other themes keep the starfield and the light bands.
   Both effects are cheap on purpose (the GPU is busy generating): the aurora is drawn at 1/6 size and scaled up
   (the scaling is its softness), the rain only changes 20 times a second. */
const SKINS={ice:{bg:"stars",cover:"bands"},sunset:{bg:"stars",cover:"bands"},ember:{bg:"stars",cover:"bands"},
 aurora:{bg:"aurora",cover:"aurora"},emerald:{bg:"matrix",cover:"matrix"}};
function skin(){return SKINS[S.theme]||SKINS.ice}
function toHex(c){if(/^#[0-9a-f]{6}$/i.test(c))return c;const d=document.createElement("canvas").getContext("2d");d.fillStyle=c;return d.fillStyle}
function rgba(hex,a){const n=parseInt(toHex(hex).slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
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

/* Matrix rain: columns of glyphs falling at their own speed; the head is near-white, the trail theme green and fading. */
function makeRain(){const off=document.createElement("canvas"),o=off.getContext("2d"),gl=document.createElement("canvas"),g=gl.getContext("2d");let cols=[],cw=0,rows=0,acc=0,key="";
 const G="ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:.=*+<>¦";
 const col=(op,first)=>({y:first?Math.random()*rows*1.3-rows*.3:-Math.random()*rows*.5,v:(op.speed||1)*(5+Math.random()*13),last:-1,ch:"",on:Math.random()<(op.density||.6)});
 return{reset(){key=""},draw(ctx,W,H,dt,d,c3,op){const fs=Math.max(8,Math.round((op.size||16)*d));
  const tick=step=>{
   o.globalCompositeOperation="destination-out";o.fillStyle=`rgba(0,0,0,${op.fade||.1})`;o.fillRect(0,0,W,H);o.globalCompositeOperation="source-over";
   o.font=`${fs}px "MS Gothic","Yu Gothic","Meiryo",monospace`;o.textAlign="center";o.textBaseline="top";
   for(let i=0;i<cols.length;i++){const c=cols[i];c.y+=c.v*step;const r=Math.floor(c.y);
    if(c.on&&r!==c.last&&r>=0&&r<rows){
     if(c.last>=0){o.clearRect(i*cw,c.last*fs,cw,fs);o.fillStyle=c3[0];o.fillText(c.ch,i*cw+cw/2,c.last*fs) // the old head turns green
      for(let q=c.last+1;q<r;q++)o.fillText(G[Math.random()*G.length|0],i*cw+cw/2,q*fs)} // a late frame skipped rows: no gaps
     c.ch=G[Math.random()*G.length|0];o.fillStyle="#eafff1";o.fillText(c.ch,i*cw+cw/2,r*fs);c.last=r}
    if(r>rows*(1.05+Math.random()*.4))cols[i]=col(op)}};
  const k=W+"x"+H+"x"+fs;if(k!==key){key=k;off.width=W;off.height=H;cw=fs;rows=Math.ceil(H/fs);cols=[];for(let i=0;i<Math.ceil(W/cw);i++)cols.push(col(op,true));
   for(let i=0;i<60;i++)tick(.05)} // pre-roll ~3 s so it opens full of trails, not empty
  acc+=dt;if(acc>=50){tick(Math.min(.2,acc/1000));acc=0}
  ctx.save();ctx.globalAlpha=op.alpha;ctx.globalCompositeOperation=op.blend||"source-over";ctx.drawImage(off,0,0);
  if(op.glow){const gw=Math.max(8,W>>2),gh=Math.max(8,H>>2);if(gl.width!==gw||gl.height!==gh){gl.width=gw;gl.height=gh} // glow: the same rain at 1/4 size, scaled back up
   g.clearRect(0,0,gw,gh);g.drawImage(off,0,0,gw,gh);ctx.globalCompositeOperation="lighter";ctx.globalAlpha=op.alpha*op.glow;ctx.imageSmoothingEnabled=true;ctx.drawImage(gl,0,0,W,H)}
  ctx.restore()}}}
