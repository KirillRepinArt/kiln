/* Kiln · settings, themes */
/* ======================= settings / themes ======================= */
const THEMES={ice:["#FF8A00","#FF5E8A","#3FE0F0","#140b00"],sunset:["#FFB020","#FF3D7F","#8B5CF6","#16060d"],aurora:["#3CF29F","#86F0DD","#C46BFF","#03140e"],ember:["#E8361C","#FF8A00","#FFD166","#1a0500"],emerald:["#00E676","#76FF03","#B9F6CA","#00140a"]};
function applyTheme(){const t=THEMES[S.theme]||THEMES.ice;const r=document.documentElement.style;["--a1","--a2","--a3","--ink"].forEach((k,i)=>r.setProperty(k,t[i]));
 const hm=harmonics(t[0]);window.HARM=hm;for(const k in hm)r.setProperty("--"+k,hm[k]);
 [...document.body.classList].filter(c=>c.startsWith("skin-")).forEach(c=>document.body.classList.remove(c));document.body.classList.add("skin-"+(S.theme||"ice"));
 window._themeV=(window._themeV||0)+1;applyFont()}
$("sTheme").value=S.theme;$("sTheme").onchange=e=>{S.theme=e.target.value;applyTheme();save();window._cpv=Date.now()+6000;
 if(!current()){const p=$("prog");window._dp=1;p.classList.add("show");sizeFrame();$("fill").style.width="62%";$("ptxt").textContent="Theme preview";$("peta").textContent="";
  clearTimeout(window._dpt);window._dpt=setTimeout(()=>{window._dp=0},2500)}};
/* "Theme font" (the default until you pick one) follows the skin: Emerald = IBM Plex Mono, its name in Courier Prime */
function applyFont(){S.set=S.set||{};if(!S.set.fontPicked)S.set.font="theme";const sk=skin(),th=S.set.font==="theme",f=th?(sk.font||"Geist"):S.set.font,rs=document.documentElement.style;
 rs.setProperty("--font",`"${f}"`);if(th&&sk.title)rs.setProperty("--font-title",`"${sk.title}"`);else rs.removeProperty("--font-title");
 const sel=document.getElementById("sFont");if(sel)sel.value=S.set.font;requestAnimationFrame(()=>moveThumb(true))}
$("rLayout").onclick=()=>{resetLayout();showView("gen");$("modal").classList.remove("show");toast("Layout reset")};
/* the Layout button by the gear: a small menu (docking joins it in Phase 2a step 2) */
(function(){const b=$("layBtn"),m=$("layMenu");b.onclick=e=>{e.stopPropagation();m.classList.toggle("show")};
 document.addEventListener("click",e=>{if(!e.target.closest("#layMenu"))m.classList.remove("show")});
 m.addEventListener("click",e=>{const a=e.target.closest("[data-lay]");if(!a)return;m.classList.remove("show");if(a.dataset.lay==="reset"){resetLayout();toast("Layout reset — the default sizes, centred")}})})();
$("rAll").onclick=()=>{if(!confirm("Reset everything? Prompt, name, settings, favourites, thumbnails and layout go back to defaults."))return;try{localStorage.clear()}catch(e){}location.reload()};
S.set=S.set||{};document.querySelectorAll('[data-set]').forEach(el=>{const k=el.dataset.set;if(S.set[k]!=null)el.value=S.set[k];else S.set[k]=el.value;
 el.addEventListener('change',()=>{S.set[k]=el.value;save();if(k==="font"){S.set.fontPicked=1;save();applyFont()}if(k==="glass")applyGlass()})});
function applyGlass(){document.body.classList.toggle("glass",(S.set||{}).glass==="on")}
$("updBtn").onclick=()=>toast("The update check needs the Kiln server (kiln.bat)");$("keysBtn").onclick=()=>openKeys();
$("gear").onclick=()=>$("modal").classList.add("show");$("mClose").onclick=()=>$("modal").classList.remove("show");
$("modal").onclick=e=>{if(e.target.id==="modal")$("modal").classList.remove("show")};
$("sDemo").value=String(S.demo);$("sDemo").onchange=e=>{S.demo=+e.target.value;save();demoNote()};
function demoNote(){$("demoNote").textContent=S.demo===1?"Prototype · simulated generation at real-time speed":`Prototype · simulated generation, ×${S.demo} faster than your 1060 · not connected to Forge`}
