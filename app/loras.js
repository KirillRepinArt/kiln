/* Kiln · LoRA library tab */
/* ======================= LoRA library ======================= */
const FILTERS=[["all","All"],["people","Faces"],["style","Style"],["utility","Utility"],["fav","★ Favorites"],["recent","Recent"]];
function initials(n){return n.slice(0,2).toUpperCase()}
function hue(n){let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))%360;return h}
function renderLoras(){const q=$("lsearch").value.toLowerCase().trim();
 $("fchips").innerHTML=FILTERS.map(([k,t])=>`<button class="${S.lfilter===k?"on":""}" data-f="${k}">${t}</button>`).join("");
 $("ofSw").classList.toggle("on",S.oneFace);
 let L=LORAS.filter(l=>!q||l.display.toLowerCase().includes(q)||l.name.toLowerCase().includes(q));
 if(S.lfilter==="fav")L=L.filter(l=>l.fav);else if(S.lfilter==="recent")L=L.filter(l=>l.used).sort((a,b)=>b.used-a.used);else if(S.lfilter!=="all")L=L.filter(l=>l.folder===S.lfilter);
 $("warn").classList.toggle("show",LORAS.filter(l=>l.on&&l.folder==="people").length>1);
 const on=LORAS.filter(l=>l.on).sort((a,b)=>(a.onAt||0)-(b.onAt||0));
 const row=l=>{const [a,b]=l.folder==="people"?[0,2]:[-3,3];return `<div class="li ${l.on?"on":""}" data-ln="${l.name}">
   <div class="lth" data-tg data-tip="Click to switch on/off" style="background:${l.thumb?"#000":`linear-gradient(135deg,hsl(${hue(l.name)},35%,30%),hsl(${(hue(l.name)+50)%360},35%,18%))`}">${l.thumb?`<img src="${l.thumb}" alt="">`:initials(l.display)}</div>
   <div class="lbody"><div class="l1"><div class="nm"><span data-rename title="Double-click to rename">${esc(l.display)}</span>${l.recipe?'<span class="tag">recipe</span>':""}<small>${esc(l.tags||l.note||l.folder)}</small></div>
    <span class="sw ${l.on?"on":""}" data-tg title="On/off"></span></div>
   <div class="l2"><input type="range" min="${a}" max="${b}" step="0.05" value="${l.w}"><input type="number" min="${a}" max="${b}" step="0.05" value="${l.w}">
    <button class="star ${l.fav?"on":""}" data-star title="Favorite">★</button></div></div></div>`};
 const srt=g=>S.lfilter==="recent"?g:g.sort((a,b)=>(b.fav-a.fav)||a.display.localeCompare(b.display));
 const G=[["people","Faces"],["style","Style"],["utility","Utility"]],known=G.map(g=>g[0]);
 // Active on top as full, editable items — a mirror: they stay in their own section too, so nothing jumps when toggled
 let h=S.lfilter!=="all"||q?"":`<div class="lsec">Active · ${on.length}</div>`+(on.length?on.map(row).join(""):'<div class="lnone">Nothing on — switch LoRAs on below</div>');
 if(S.lfilter==="recent")h=L.map(row).join("");
 else{for(const [k,t] of G){const g=L.filter(l=>l.folder===k);if(g.length)h+=`<div class="lsec">${t} · ${g.length}</div>${srt(g).map(row).join("")}`}
  const o=L.filter(l=>!known.includes(l.folder));if(o.length)h+=`<div class="lsec">Other · ${o.length}</div>${srt(o).map(row).join("")}`}
 $("lscroll").innerHTML=`<div class="lgrid">${h}${!L.length?'<div class="empty">Nothing here</div>':""}</div>`}
$("lsearch").oninput=renderLoras;
$("csize").value=S.th||48;document.documentElement.style.setProperty("--th",(S.th||48)+"px");
$("csize").addEventListener("input",e=>{S.th=+e.target.value;document.documentElement.style.setProperty("--th",S.th+"px");save()});
$("fchips").onclick=e=>{const b=e.target.closest("[data-f]");if(!b)return;S.lfilter=b.dataset.f;save();renderLoras()};
$("oneFace").onclick=e=>{e.preventDefault();S.oneFace=!S.oneFace;save();renderLoras()};
function toggleL(l){if(!l.on&&l.folder==="people"&&S.oneFace)LORAS.forEach(o=>{if(o.folder==="people")o.on=false});l.on=!l.on;if(l.on){l.used=Date.now();l.onAt=Date.now()}save();renderLoras();renderChips()}
let clickT=null;
$("lscroll").addEventListener("click",e=>{const el=e.target.closest("[data-ln]");if(!el)return;const l=LORAS.find(l=>l.name===el.dataset.ln);
 if(e.target.closest("[data-star]")){l.fav=!l.fav;save();renderLoras();return}
 if(e.target.closest("input"))return;
 if(e.target.closest("[data-rename]")){clearTimeout(clickT);clickT=setTimeout(()=>toggleL(l),230);return} // wait: may be a double-click rename
 if(el.classList.contains("card")||e.target.closest("[data-tg]"))toggleL(l)});
$("lscroll").addEventListener("dblclick",e=>{const n=e.target.closest("[data-rename]");if(!n)return;clearTimeout(clickT);e.preventDefault();
 const el=e.target.closest("[data-ln]");const l=LORAS.find(l=>l.name===el.dataset.ln);
 const inp=document.createElement("input");inp.className="nmedit";inp.value=l.display;n.replaceWith(inp);inp.focus();inp.select();
 inp.onclick=k=>k.stopPropagation();
 const done=()=>{l.display=inp.value.trim()||l.display;save();renderLoras();renderChips()};inp.onblur=done;
 inp.onkeydown=k=>{if(k.key==="Enter")inp.blur();if(k.key==="Escape"){inp.value=l.display;inp.blur()}}});
$("lscroll").addEventListener("input",e=>{const el=e.target.closest("[data-ln]");if(!el||e.target.classList.contains("nmedit"))return;const l=LORAS.find(l=>l.name===el.dataset.ln);l.w=+e.target.value;
 document.querySelectorAll(`#lscroll [data-ln="${CSS.escape(l.name)}"] input[type=range],#lscroll [data-ln="${CSS.escape(l.name)}"] input[type=number]`).forEach(i=>{if(i!==e.target)i.value=l.w});const s=el.querySelector(".st span");if(s)s.textContent=fmtW(l.w);save();renderChips()});
