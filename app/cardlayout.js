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
 const st=was?(innerWidth<1020||innerWidth/innerHeight<1.2||innerWidth-54<400+minRight()):(innerWidth<980||innerWidth/innerHeight<1.15||innerWidth-54<360+minRight());
 $("ltitle").dataset.tip=st?"":"Drag to move the prompt box: top · middle · bottom";
 if(a.classList.contains("stacked")!==st){a.classList.toggle("stacked",st);
  // switching layouts: place the image first, then the card, without the glide (it would start from stale positions)
  const L=$("left"),T=$("ltitle");L.classList.add("nodur");T.classList.add("nodur");lyFrozen=false;lyTop=null;lyCy=null;
  sizeFrame();layoutLeft();moveThumb(true);requestAnimationFrame(()=>{sizeFrame();layoutLeft();requestAnimationFrame(()=>{L.classList.remove("nodur");T.classList.remove("nodur")})})}}
function cardMinH(){const L=$("left");return L.offsetHeight-L.querySelector(".pwrapT").offsetHeight+84}
function layoutLeft(){if(lyDrag)return;const L=$("left"),col=$("lcol");const TS=$("peekbar").classList.contains("show")?112:64; // the Reuse bar takes the row above the box; the name moves upcol.style.setProperty("--ts",TS+"px");
 const stk=!!document.querySelector(".app.stacked"),hm=S.hmode==="full"||(S.hmode==="match"&&!stk)?S.hmode:"";L.classList.toggle("hm",!!hm);$("ltitle").classList.toggle("hm",!!hm);
 if(stk){let H;lyTop=0;
  if(hm==="full")H=Math.round(innerHeight*.7);
  else if(S.sch)H=Math.max(200,Math.min(S.sch,Math.round(innerHeight*.7))); // set with the divider above the name
  else{H=Math.min(cardNaturalH(),Math.round(innerHeight*.42));
   const j=browsed()||current()||shownDone(),[a,b]=(j?j.ar:S.ar).split(":").map(Number);
   if(a>b){const want=Math.min(760,innerWidth-36)*b/a,room=innerHeight-36-6-(H+TS+2)-64-BAR;if(room<want)H=Math.max(200,Math.round(H-(want-room)))}} // landscape: at least as wide as the card
  const lch=(H+TS+2)+"px",chg=col.style.getPropertyValue("--lch")!==lch;
  col.style.setProperty("--lch",lch);col.style.setProperty("--ltop",TS+"px");col.style.setProperty("--lh",H+"px");if(chg)requestAnimationFrame(sizeFrame);return}
 const colH=col.clientHeight-TS;if(colH<=0)return;
 const f=$("frame").getBoundingClientRect(),c=col.getBoundingClientRect();
 if(S.view==="gen"&&f.height>0){lyCy=f.top+f.height/2-c.top-TS;lyIT=f.top-c.top-TS;const pb=$("prog").getBoundingClientRect();lyIB=(pb.height?pb.bottom:f.bottom)-c.top-TS}
 if(lyCy==null)lyCy=colH/2;
 if(hm){let top,H;if(hm==="full"){top=0;H=colH}else{top=Math.max(0,lyIT??0);H=Math.min(colH-top,(lyIB??colH)-top)} // match: image top to status line
  const mn=cardMinH();if(H<mn){H=Math.min(colH,mn);top=Math.max(0,Math.min(colH-H,lyCy-H/2))}
  lyTop=top;lyBot=top+H;col.style.setProperty("--ltop",(top+TS)+"px");col.style.setProperty("--lh",H+"px");return}
 let H=S.pph?Math.min(Math.max(240,S.pph),colH):Math.min(cardNaturalH(),colH);let top;const pos=S.pos||"mid";
 if(lyFrozen&&lyTop!=null){if(pos==="bot"&&lyBot!=null){top=Math.max(0,lyBot-H);H=Math.min(H,colH-top)}else{top=lyTop;H=Math.min(H,colH-top)}}
 else{top=anchorTop(pos,H,colH);lyBot=top+H}
 lyTop=top;col.style.setProperty("--ltop",(top+TS)+"px");col.style.setProperty("--lh",H+"px")}
function freeze(){clearTimeout(lyT);lyFrozen=true}
function thaw(){clearTimeout(lyT);lyT=setTimeout(()=>{const ed=document.activeElement&&$("left").contains(document.activeElement);if(lyHover||ed)return;lyFrozen=false;S.pph=0;layoutLeft()},500)}
$("left").addEventListener("pointerenter",()=>{lyHover=true;freeze()});
$("left").addEventListener("pointerleave",()=>{lyHover=false;thaw()});
$("left").addEventListener("focusin",freeze);
$("left").addEventListener("focusout",()=>{if(!lyHover)thaw()});
new ResizeObserver(()=>layoutLeft()).observe($("lcol"));
function updHm(){const m=S.hmode||"";$("hmodes").classList.toggle("on",!!m);
 $("hmMatch").classList.toggle("on",m==="match");$("hmFull").classList.toggle("on",m==="full");
 $("hmMatch").dataset.tip=m==="match"?"Back to normal height":"Match the image height";$("hmFull").dataset.tip=m==="full"?"Back to normal height":"Full height"}
$("hmodes").addEventListener("click",e=>{const b=e.target.closest("[data-hm]");if(!b)return;S.hmode=S.hmode===b.dataset.hm?"":b.dataset.hm;save();updHm();lyFrozen=false;layoutLeft()});
updHm();
(function(){const L=$("left"),T=$("ltitle"),col=$("lcol");let d=null;
 const NO="input,textarea,button,a,select,.chip,.pwrapT,.vedge,.pop,.cwi";
 const ghosts=["top","mid","bot"].map(p=>{const g=document.createElement("div");g.className="ghost";g.dataset.p=p;col.appendChild(g);return g});
 const geo=()=>{const TS=parseFloat(col.style.getPropertyValue("--ts"))||64;return{TS,colH:col.clientHeight-TS,H:L.offsetHeight}};
 const nearest=(t,H,colH)=>["top","mid","bot"].map(p=>[p,Math.abs(anchorTop(p,H,colH)-t)]).sort((a,b)=>a[1]-b[1])[0][0];
 function down(e){if(document.querySelector(".app.stacked")||S.hmode||e.button!==0||e.target.closest(NO))return;e.preventDefault();
  d={y0:e.clientY,t0:lyTop||0,moved:false};try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_){}}
 function move(e){if(!d)return;const dy=e.clientY-d.y0;if(!d.moved&&Math.abs(dy)<5)return;const {TS,colH,H}=geo();
  if(!d.moved){d.moved=true;lyDrag=true;L.classList.add("nodur");T.classList.add("nodur");document.body.classList.add("cardmove");
   ghosts.forEach(g=>{g.style.top=(anchorTop(g.dataset.p,H,colH)+TS)+"px";g.style.height=H+"px";g.classList.add("show")})}
  const t=Math.max(0,Math.min(colH-H,d.t0+dy));col.style.setProperty("--ltop",(t+TS)+"px");d.t=t;
  const n=nearest(t,H,colH);ghosts.forEach(g=>g.classList.toggle("near",g.dataset.p===n))}
 function up(){if(!d)return;const was=d;d=null;if(!was.moved)return;const {colH,H}=geo();S.pos=nearest(was.t,H,colH);save();
  lyDrag=false;L.classList.remove("nodur");T.classList.remove("nodur");document.body.classList.remove("cardmove");ghosts.forEach(g=>g.classList.remove("show","near"));
  const fz=lyFrozen;lyFrozen=false;layoutLeft();lyFrozen=fz}
 for(const el of [L,T]){el.addEventListener("pointerdown",down);el.addEventListener("pointermove",move);el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up)}
 // the empty space under the text belongs to the editor: a click there puts the cursor at the end
 document.querySelector(".pwrapT").addEventListener("mousedown",e=>{if(!e.target.classList.contains("pwrapT"))return;e.preventDefault();P.focus();
  if(window.__cm){const v=window.__cm;v.dispatch({selection:{anchor:v.state.doc.length}})}})})();
// glass mode floats the controls row over the prompt: the text needs that much room to scroll clear of it
new ResizeObserver(()=>{$("left").style.setProperty("--ctrlh",$("left").querySelector(".controls").offsetHeight+"px");layoutLeft()}).observe(document.querySelector("#left .controls"));
