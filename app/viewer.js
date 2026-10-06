/* Kiln · full-size viewer, clicking the image */
/* ======================= full-size viewer ======================= */
const V={job:null,s:1,tx:0,ty:0,fit:1,w:0,h:0};
function openViewer(j){if(!j||j.status!=="done")return;V.job=j;const [w,h]=SIZES[j.mp][j.ar];V.w=w;V.h=h;
 const cv=$("vcv");paint(cv,j,1);cv.style.width=w+"px";cv.style.height=h+"px";$("viewer").classList.add("show");vFit()}
function vFit(){V.fit=Math.min(innerWidth/V.w,innerHeight/V.h)*.94;vSet(V.fit,(innerWidth-V.w*V.fit)/2,(innerHeight-V.h*V.fit)/2)}
function vClamp(){const sw=V.w*V.s,sh=V.h*V.s;
 V.tx=sw<=innerWidth?(innerWidth-sw)/2:Math.min(0,Math.max(innerWidth-sw,V.tx));V.ty=sh<=innerHeight?(innerHeight-sh)/2:Math.min(0,Math.max(innerHeight-sh,V.ty))}
function vSet(s,tx,ty){V.s=s;V.tx=tx;V.ty=ty;vClamp();$("vcv").style.transform=`translate(${V.tx}px,${V.ty}px) scale(${V.s})`;
 $("vzoom").textContent=Math.round(V.s*100)+"%";$("viewer").classList.toggle("zoomed",V.s>V.fit+.001)}
function vZoomAt(ns,cx,cy){ns=Math.max(V.fit,Math.min(4,ns));vSet(ns,cx-(cx-V.tx)*(ns/V.s),cy-(cy-V.ty)*(ns/V.s))}
function closeViewer(){$("viewer").classList.remove("show");V.job=null}
(function(){const el=$("viewer");let down=null,moved=false,clickT=null;
 el.addEventListener("wheel",e=>{e.preventDefault();vZoomAt(V.s*(e.deltaY<0?1.15:1/1.15),e.clientX,e.clientY)},{passive:false});
 el.addEventListener("pointerdown",e=>{if(e.target.closest(".vclose,.nav"))return;down={x:e.clientX,y:e.clientY,tx:V.tx,ty:V.ty,img:e.target.id==="vcv"};moved=false;el.setPointerCapture(e.pointerId)});
 el.addEventListener("pointermove",e=>{if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;
  if(moved&&V.s>V.fit+.001){el.classList.add("panning");vSet(V.s,down.tx+dx,down.ty+dy)}});
 el.addEventListener("pointerup",e=>{el.classList.remove("panning");const wasDown=down;down=null;if(!wasDown||moved)return;if(!wasDown.img){closeViewer();return}
  clearTimeout(clickT);const x=e.clientX,y=e.clientY;clickT=setTimeout(()=>{if(V.s>V.fit+.001)vFit();else vZoomAt(1,x,y)},230)});
 el.addEventListener("dblclick",e=>{clearTimeout(clickT);if(V.job)openInApp(V.job)});
 $("vclose").onclick=closeViewer;})();
function openInApp(j){toast(`Prototype: would open ${j.file||("#"+j.id+".png")} in your default app`)}
/* click the finished image (Generating view and queue overlay) */
(function(){let t=null;
 function bind(el,getJob){el.addEventListener("click",e=>{if(e.target.closest(".side,.nav,.bclose"))return;const j=getJob();if(!j||j.status!=="done")return;clearTimeout(t);t=setTimeout(()=>openViewer(j),230)});
  el.addEventListener("dblclick",e=>{if(e.target.closest(".side,.nav,.bclose"))return;const j=getJob();if(!j||j.status!=="done")return;clearTimeout(t);openInApp(j)})}
 bind($("frame"),()=>current()&&!browsed()?null:shownDone())})();
setInterval(()=>{$("frame").classList.toggle("clickable",(!current()||!!browsed())&&!!shownDone());const br=!!browsed(),cl=!br&&!current()&&!!shownDone();$("frame").classList.toggle("browsing",br);$("frame").classList.toggle("clearable",cl);
 $("bclose").dataset.tip=br?"Back to the live view (Esc)":"Clear the image — ← brings it back";updNav()},300);
// browsing: back to the live view; otherwise: clear the finished image (same as changing size or ratio does)
$("bclose").onclick=e=>{e.stopPropagation();if(browsed()){endPeek();return}staleIf(true);sizeFrame()};
