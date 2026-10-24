/* Kiln · helpers and start-up */
/* ======================= misc ======================= */
function fmt(s){s=Math.round(s);const m=Math.floor(s/60),r=s%60;return m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m}:${String(r).padStart(2,"0")}`}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function toastPlace(){const el=$("toast").style;
 if(document.querySelector(".app.stacked")){Object.assign(el,{left:"auto",right:"24px",top:"24px",bottom:"auto",transform:"none"});return}
 const L=$("left").getBoundingClientRect(),T=$("ltitle").getBoundingClientRect(),C=$("chips").getBoundingClientRect(),low=Math.max(L.bottom,C.height?C.bottom:0);
 Object.assign(el,{left:Math.round(L.left+L.width/2)+"px",right:"auto",transform:"translateX(-50%)"});
 if(T.top-18>=innerHeight-low-18)Object.assign(el,{top:"24px",bottom:"auto"});else Object.assign(el,{top:"auto",bottom:"24px"})}
let tt;function toast(m,btn,fn){$("toastMsg").textContent=m;toastPlace();const b=$("toastBtn");b.textContent=btn||"";b.onclick=()=>{fn&&fn();$("toast").classList.remove("show")};
 $("toast").classList.add("show");clearTimeout(tt);tt=setTimeout(()=>$("toast").classList.remove("show"),btn?5000:2200)}
function syncH(){document.documentElement.style.setProperty("--rightH",$("right").getBoundingClientRect().height+"px")}
function renderAll(){const n=jobs.filter(j=>j.status==="pending"||j.status==="running").length;
 $("badge").textContent=n;$("badge").classList.toggle("show",n>0);$("tabN").textContent=n||"";requestAnimationFrame(()=>moveThumb(true));
 renderPills();renderChips();if(S.view==="queue")renderQueue();if(S.view==="loras")renderLoras()}
$("pname").value=S.pname||"";$("pname").addEventListener("input",e=>{if(peekJob){$("pnSave").classList.toggle("show",e.target.value.trim()!==(peekJob.name||"").trim());return}   /* a waiting job's name: saved with its button */
 S.pname=e.target.value;save();nameUI()});
$("pnx").onclick=()=>{$("pname").value="";S.pname="";save();nameUI();$("pname").focus()};
let nnT=null;
function slugify(n){return n.toLowerCase().replace(/[^\p{L}\p{N}_]+/gu,"-").replace(/^-|-$/g,"").slice(0,60)||"kiln"} // same rule as server.py
function nameTip(file){$("pname").dataset.tip=file?`Names the image files · next: ${file}`:"Optional — names the image files (name-001.png, name-002.png…). Without a name: date and seed"}
function nextHint(){const n=(S.pname||"").trim();
 if(!n){nameTip(null);return}
 if(window.LIVE){clearTimeout(nnT);nnT=setTimeout(()=>fetch("/api/nextname?name="+encodeURIComponent(n)).then(r=>r.json()).then(d=>nameTip(d.file)).catch(()=>{}),250)}
 else{const slug=slugify(n);nameTip(`${slug}-${String((S.ncount[slug]||0)+1).padStart(3,"0")}.png`)}}
function nameUI(){const l=document.querySelector(".plbl");l.classList.toggle("peekname",!!peekJob);
 if(peekJob){$("pname").dataset.tip="";return}   /* its file name shows beside it on hover */
 nextHint();l.classList.toggle("hasname",!!S.pname.trim());l.classList.toggle("dimname",!!S.pname.trim()&&!P.value.trim())}$("pname").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();if(peekJob&&$("pnSave").classList.contains("show")){saveJobName();return}P.focus()}});
if(matchMedia("(prefers-reduced-motion: reduce)").matches)document.querySelector("#playFlow animateTransform")?.remove();
applyMode();$("left").classList.add("nodur");setTimeout(()=>$("left").classList.remove("nodur"),400);
applyFont();applyGlass();applyPH();updPrompt();applyTheme();S.view="gen";showView("gen");renderAll();grow();syncH();demoNote();
