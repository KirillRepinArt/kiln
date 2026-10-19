/* Kiln · prompt card placement: centring, freeze while working, drag top/middle/bottom */
/* ======================= prompt card layout =======================
   Centred on the image's vertical centre while there's room. While the editor is focused or the pointer is over
   the card it is FROZEN: it only grows downward (then scrolls), so nothing moves under the cursor. ~0.5 s after the
   pointer leaves (and the editor isn't focused) it glides back to centre and re-expands to use the space. */
let lyFrozen=false,lyHover=false,lyT=null,lyTop=null,lyCy=null,lyIT=null,lyIB=null,lyBot=null,lyDrag=false;
/* S.pos (wide window): "top" = card top level with the image top (name row beside the tabs), "mid" = centred on the
   image, "bot" = card bottom level with the status line. A bottom card grows upward while you type. */
function anchorTop(pos,H,colH){const t=pos==="top"?(lyIT??0):pos==="bot"?((lyIB??colH)-H):(lyCy??colH/2)-H/2;return Math.max(0,Math.min(colH-H,t))}
function cardNaturalH(){const L=$("left"),w=L.querySelector(".pwrapT");const sc=L.querySelector(".cm-scroller");
 const edH=(sc?sc.scrollHeight:P.scrollHeight)+16;return Math.max(170,L.offsetHeight-w.offsetHeight+Math.max(84,edH))}
const CARDMAX=900; // wide window: the prompt card never gets wider than this (text stops at ~76ch anyway)
function tabsW(){const k=document.querySelector(".tabs").children;return k.length?Math.ceil(k[k.length-1].getBoundingClientRect().right-k[0].getBoundingClientRect().left):0}
function minRight(){return Math.max(420,tabsW()+2)} // the image column never gets narrower than the tab bar
function applyMode(){const a=document.querySelector(".app"),was=a.classList.contains("stacked");
 // switch to narrow below 980 px (or a tall window); back to wide only above 1020 px, so dragging near the edge doesn't flicker
 const narrow=was&&a.dataset.narrow==="1"?(innerWidth<1020||innerWidth/innerHeight<1.2||innerWidth-54<400+minRight()):(innerWidth<980||innerWidth/innerHeight<1.15||innerWidth-54<360+minRight());
 a.dataset.narrow=narrow?"1":"";const st=narrow||S.dock==="below";   /* Layout → Vertical stacks on any window; a horizontal dock comes back when there's room */
 a.classList.toggle("pright",S.dock==="right"&&!st);
 $("ltitle").dataset.tip=st?"":"Drag to move the prompt box: top · middle · bottom";
 if(a.classList.contains("stacked")!==st){a.classList.toggle("stacked",st);
  // switching layouts: place the image first, then the card, without the glide (it would start from stale positions)
  const L=$("left"),T=$("ltitle");L.classList.add("nodur");T.classList.add("nodur");lyFrozen=false;lyTop=null;lyCy=null;
  sizeFrame();layoutLeft();moveThumb(true);requestAnimationFrame(()=>{sizeFrame();layoutLeft();requestAnimationFrame(()=>{L.classList.remove("nodur");T.classList.remove("nodur")})})}
 if(window.updHm)updHm()}
/* Vertical: the prompt box's width — yours (S.lay.sw, set with its side edges), or the picture's (Fit width), never
   narrower than the box's minimum or wider than the window */
function stackW(){const max=innerWidth-36,pic=typeof lay!=="undefined"&&lay.target&&lay.target.w;
 const w=S.vfit&&pic?pic:(S.lay&&S.lay.sw)||760;return Math.round(Math.max(Math.min(PWMIN,max),Math.min(max,w)))}
function cardMinH(){const L=$("left");return L.offsetHeight-L.querySelector(".pwrapT").offsetHeight+84}
function chipsH(){const c=$("chips");return c.childElementCount?c.offsetHeight+10:0} // the row always shows ("LoRA +") // the chip row under the box, and its gap
function layoutLeft(){if(lyDrag)return;const L=$("left"),col=$("lcol"),CH=chipsH();const TS=$("peekbar").classList.contains("show")?104:64; /* the Reuse bar takes the row above the box; the name moves up */col.style.setProperty("--ts",TS+"px");
 const stk=!!document.querySelector(".app.stacked"),hm=!stk&&(S.hmode==="full"||S.hmode==="match")?S.hmode:"";   /* Vertical has no height modes: they took the picture's room */L.classList.toggle("hm",!!hm);$("ltitle").classList.toggle("hm",!!hm);
 if(stk){let H;lyTop=0;
  /* the prompt's SLOT is fixed: set with the line above the name, or ~4 lines + the pills by default. The box fits its
     text inside it (top-aligned) and the picture's size never depends on what the prompt says — browsing prompts of
     different lengths used to resize and move the picture on every step (2026-10-19) */
  const slot=Math.max(200,Math.min(S.sch||Math.min(250,Math.round(innerHeight*.42)),Math.round(innerHeight*.7)));
  H=$("hsplit").classList.contains("drag")?slot:Math.min(slot,cardNaturalH());
  col.style.setProperty("--sw",stackW()+"px");
  const lch=(slot+TS+2+CH)+"px",chg=col.style.getPropertyValue("--lch")!==lch;
  col.style.setProperty("--lch",lch);col.style.setProperty("--ltop",TS+"px");if(window.vAlign)requestAnimationFrame(vAlign);col.style.setProperty("--lh",H+"px");col.style.setProperty("--chtop",(TS+H+10)+"px");if(chg)requestAnimationFrame(sizeFrame);return}
 const colH=col.clientHeight-TS;if(colH<=0)return;
 const f=$("frame").getBoundingClientRect(),c=col.getBoundingClientRect();
 const T=typeof lay!=="undefined"&&lay.target;   /* the picture's target (it may be mid-glide): the prompt moves with it, not after it */
 if(S.view==="gen"&&f.height>0){if(T){lyCy=T.top+T.h/2-c.top-TS;lyIT=T.top-c.top-TS;lyIB=T.bottom-c.top-TS}else{lyCy=f.top+f.height/2-c.top-TS;lyIT=f.top-c.top-TS;const pb=$("prog").getBoundingClientRect();lyIB=(pb.height?pb.bottom:f.bottom)-c.top-TS}}
 if(lyCy==null)lyCy=colH/2;
 if(hm){let top,H;if(hm==="full"){top=0;H=colH}else{top=Math.max(0,lyIT??0);H=Math.min(colH-top,(lyIB??colH)-top)} // match: image top to status line
  H=Math.max(0,H-CH);const mn=cardMinH();if(H<mn){H=Math.min(colH-CH,mn);top=Math.max(0,Math.min(colH-H-CH,lyCy-(H+CH)/2))}
  lyTop=top;lyBot=top+H+CH;col.style.setProperty("--ltop",(top+TS)+"px");col.style.setProperty("--lh",H+"px");col.style.setProperty("--chtop",(top+TS+H+10)+"px");return}
 // the box and its chip row are placed as one group
 const room=colH-CH;let H=S.pph?Math.min(Math.max(240,S.pph),room):Math.min(cardNaturalH(),room);let top;const pos=S.pos||"mid";
 if(lyFrozen&&lyTop!=null){if(pos==="bot"&&lyBot!=null){top=Math.max(0,lyBot-H-CH);H=Math.min(H,room-top)}else{top=lyTop;H=Math.min(H,room-top)}}
 else{top=anchorTop(pos,H+CH,colH);lyBot=top+H+CH}
 lyTop=top;col.style.setProperty("--ltop",(top+TS)+"px");col.style.setProperty("--lh",H+"px");col.style.setProperty("--chtop",(top+TS+H+10)+"px")}
function freeze(){clearTimeout(lyT);lyFrozen=true}
function thaw(){clearTimeout(lyT);lyT=setTimeout(()=>{const ed=document.activeElement&&$("left").contains(document.activeElement);if(lyHover||ed)return;lyFrozen=false;S.pph=0;layoutLeft()},500)}
$("left").addEventListener("pointerenter",()=>{lyHover=true;freeze()});
$("left").addEventListener("pointerleave",()=>{lyHover=false;thaw()});
$("left").addEventListener("focusin",freeze);
$("left").addEventListener("focusout",()=>{if(!lyHover)thaw()});
new ResizeObserver(()=>layoutLeft()).observe($("lcol"));
/* the size buttons by the name: side by side, Match = the picture's height; in Vertical, Fit = the picture's width */
const HM_H='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h14M5 20h14M12 8v8M9 11l3-3 3 3M9 13l3 3 3-3"/></svg>',
 HM_W='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5v14M20 5v14M8 12h8M11 9l-3 3 3 3M13 9l3 3-3 3"/></svg>';
function updHm(){const stk=!!document.querySelector(".app.stacked"),m=S.hmode||"",fit=stk?!!S.vfit:m==="match";$("hmodes").classList.toggle("on",fit||m==="full");
 const b=$("hmMatch");if(b.dataset.ic!==String(stk)){b.dataset.ic=String(stk);b.innerHTML=stk?HM_W:HM_H}
 b.classList.toggle("on",fit);$("hmFull").classList.toggle("on",m==="full");
 b.dataset.tip=stk?(fit?"Back to your width":"Fit the box to the picture's width"):(fit?"Back to normal height":"Match the image height");$("hmFull").dataset.tip=m==="full"?"Back to normal height":"Full height"}
$("hmodes").addEventListener("click",e=>{const b=e.target.closest("[data-hm]");if(!b)return;
 if(b.dataset.hm==="match"&&document.querySelector(".app.stacked"))S.vfit=!S.vfit;else S.hmode=S.hmode===b.dataset.hm?"":b.dataset.hm;
 save();updHm();lyFrozen=false;layoutLeft()});
updHm();
(function(){const L=$("left"),T=$("ltitle"),col=$("lcol");let d=null;
 const NO="input,textarea,button,a,select,.chip,.pwrapT,.vedge,.pedge,.pop,.cwi";
 const ghosts=["top","mid","bot"].map(p=>{const g=document.createElement("div");g.className="ghost";g.dataset.p=p;col.appendChild(g);return g});
 const geo=()=>{const TS=parseFloat(col.style.getPropertyValue("--ts"))||64;return{TS,colH:col.clientHeight-TS,H:L.offsetHeight}};
 const nearest=(t,H,colH)=>["top","mid","bot"].map(p=>[p,Math.abs(anchorTop(p,H,colH)-t)]).sort((a,b)=>a[1]-b[1])[0][0];
 /* dock zones: drag the prompt far to the other side, or to the bottom, and drop it there */
 const zones=["left","right","below"].map(z=>{const g=document.createElement("div");g.className="dockzone "+z;g.dataset.z=z;
  g.innerHTML=`<span>${{left:"Prompt on the left",right:"Prompt on the right",below:"Prompt below the picture"}[z]}</span>`;document.body.appendChild(g);return g});
 const dockOf=()=>S.dock||"left";
 /* "below" needs the pointer well past the lowest place the card can go (yMax): moving the card to its bottom position
    never docks it by accident — the card stops, the pointer goes on, the zone lights up */
 function zoneAt(x,y,yMax){const W=innerWidth,Hh=innerHeight,cur=document.querySelector(".app.stacked")?"below":dockOf();
  let z=null;if(y>Math.max(Hh*.75,yMax+80)&&cur!=="below")z="below";else if(x<W*.3&&cur!=="left")z="left";else if(x>W*.7&&cur!=="right")z="right";return z}
 function down(e){if(S.hmode||e.button!==0||e.target.closest(NO))return;e.preventDefault();
  d={x0:e.clientX,y0:e.clientY,t0:lyTop||0,moved:false,stk:!!document.querySelector(".app.stacked")};try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_){}}
 function move(e){if(!d)return;const dx=e.clientX-d.x0,dy=e.clientY-d.y0;if(!d.moved&&Math.hypot(dx,dy)<6)return;const {TS,colH,H}=geo();
  if(!d.moved){d.moved=true;lyDrag=true;L.classList.add("nodur");T.classList.add("nodur");document.body.classList.add("cardmove");
   zones.forEach(z=>z.classList.toggle("show",z.dataset.z!==(d.stk?"below":dockOf())));
   if(!d.stk)ghosts.forEach(g=>{g.style.top=(anchorTop(g.dataset.p,H,colH)+TS)+"px";g.style.height=H+"px";g.classList.add("show")})}
  d.zone=zoneAt(e.clientX,e.clientY,d.stk?0:d.y0+(colH-H-chipsH()-d.t0));zones.forEach(z=>z.classList.toggle("near",z.dataset.z===d.zone));
  if(d.stk)return;
  const t=Math.max(0,Math.min(colH-H-chipsH(),d.t0+dy));col.style.setProperty("--ltop",(t+TS)+"px");col.style.setProperty("--chtop",(t+TS+H+10)+"px");d.t=t;
  const n=nearest(t,H,colH);ghosts.forEach(g=>g.classList.toggle("near",!d.zone&&g.dataset.p===n))}
 function up(){if(!d)return;const was=d;d=null;if(!was.moved)return;
  lyDrag=false;L.classList.remove("nodur");T.classList.remove("nodur");document.body.classList.remove("cardmove");ghosts.forEach(g=>g.classList.remove("show","near"));zones.forEach(z=>z.classList.remove("show","near"));
  if(was.zone){setDock(was.zone);return}
  if(was.stk)return;const {colH,H}=geo();S.pos=nearest(was.t,H,colH);save();
  const fz=lyFrozen;lyFrozen=false;layoutLeft();lyFrozen=fz}
 for(const el of [L,T]){el.addEventListener("pointerdown",down);el.addEventListener("pointermove",move);el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up)}
 // the empty space under the text belongs to the editor: a click there puts the cursor at the end
 document.querySelector(".pwrapT").addEventListener("mousedown",e=>{if(!e.target.classList.contains("pwrapT"))return;e.preventDefault();P.focus();
  if(window.__cm){const v=window.__cm;v.dispatch({selection:{anchor:v.state.doc.length}})}})})();
// glass mode floats the controls row over the prompt: the text needs that much room to scroll clear of it
new ResizeObserver(()=>{$("left").style.setProperty("--ctrlh",$("left").querySelector(".controls").offsetHeight+"px");layoutLeft()}).observe(document.querySelector("#left .controls"));
