/* Kiln · settings, themes */
/* ======================= settings / themes ======================= */
const THEMES={ice:["#FF8A00","#FF5E8A","#3FE0F0","#140b00"],sunset:["#FFB020","#FF3D7F","#8B5CF6","#16060d"],aurora:["#2DD4BF","#38BDF8","#A78BFA","#04201c"],ember:["#E8361C","#FF8A00","#FFD166","#1a0500"],emerald:["#00E676","#76FF03","#B9F6CA","#00140a"]};
function applyTheme(){const t=THEMES[S.theme]||THEMES.ice;const r=document.documentElement.style;["--a1","--a2","--a3","--ink"].forEach((k,i)=>r.setProperty(k,t[i]));window._themeV=(window._themeV||0)+1}
$("sTheme").value=S.theme;$("sTheme").onchange=e=>{S.theme=e.target.value;applyTheme();save();window._cpv=Date.now()+6000;
 if(!current()){const p=$("prog");window._dp=1;p.classList.add("show");sizeFrame();$("fill").style.width="62%";$("ptxt").textContent="Theme preview";$("peta").textContent="";
  clearTimeout(window._dpt);window._dpt=setTimeout(()=>{window._dp=0},2500)}};
function applyFont(){const f=(S.set||{}).font||"Geist";document.documentElement.style.setProperty("--font",`"${f}"`);requestAnimationFrame(()=>moveThumb(true))}
$("rLayout").onclick=()=>{S.lw=0;S.pph=0;S.sch=0;S.pos="mid";S.hmode="";updHm();grow();applyPH();showView("gen");save();sizeFrame();moveThumb(true);$("modal").classList.remove("show");toast("Layout reset")};
$("rAll").onclick=()=>{if(!confirm("Reset everything? Prompt, name, settings, favourites, thumbnails and layout go back to defaults."))return;try{localStorage.clear()}catch(e){}location.reload()};
S.set=S.set||{};document.querySelectorAll('[data-set]').forEach(el=>{const k=el.dataset.set;if(S.set[k]!=null)el.value=S.set[k];else S.set[k]=el.value;
 el.addEventListener('change',()=>{S.set[k]=el.value;save();if(k==="font")applyFont();if(k==="glass")applyGlass()})});
function applyGlass(){document.body.classList.toggle("glass",(S.set||{}).glass==="on")}
$("gear").onclick=()=>$("modal").classList.add("show");$("mClose").onclick=()=>$("modal").classList.remove("show");
$("modal").onclick=e=>{if(e.target.id==="modal")$("modal").classList.remove("show")};
$("sDemo").value=String(S.demo);$("sDemo").onchange=e=>{S.demo=+e.target.value;save();demoNote()};
function demoNote(){$("demoNote").textContent=S.demo===1?"Prototype · simulated generation at real-time speed":`Prototype · simulated generation, ×${S.demo} faster than your 1060 · not connected to Forge`}
