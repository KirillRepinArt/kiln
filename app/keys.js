/* Kiln · keyboard shortcuts sheet: "?" anywhere outside a text field, or Settings → About */
const KEYS=[["Ctrl+Enter","Add to the queue"],["← →","Browse finished images"],["Esc","Close the image, the viewer or a dialog"],
 ["F9","Privacy: cover the picture fully and hide the prompt — again to show"],["Del","Delete the image on show — to the Recycle Bin, with Undo"],["F8","Replay the theme's finish on the image shown"],["?","This list"]];
const MOUSE=[["Drag the name line","Move the prompt box: top · middle · bottom"],["Double-click a divider","Reset its size"],
 ["Click a seed","Copy it"],["Drag a waiting job","Reorder the queue"],["Hover the image","Peek under the cover (not with privacy on)"],["The eye on the image","Privacy on / off"]];
(function(){const m=document.createElement("div");m.className="modal keys";m.id="keys";
 const rows=(L,keys)=>L.map(([k,t])=>`<div class="kk">${keys?k.split(" ").map(x=>`<kbd>${esc(x)}</kbd>`).join(" "):esc(k)}</div><div class="kt">${esc(t)}</div>`).join("");
 m.innerHTML=`<div class="mcard"><div class="mhead"><button class="iconbtn" data-close title="Close (Esc)">${IC.x}</button><h2>Keyboard shortcuts</h2></div>
  <div class="mbody"><div class="kgrid">${rows(KEYS,true)}</div><div class="fgh">Mouse</div><div class="kgrid mouse">${rows(MOUSE)}</div></div></div>`;
 document.body.appendChild(m);
 window.openKeys=()=>{$("modal").classList.remove("show");m.classList.add("show")};const close=()=>m.classList.remove("show");
 m.addEventListener("click",e=>{if(e.target===m||e.target.closest("[data-close]"))close()});
 document.addEventListener("keydown",e=>{if(m.classList.contains("show")&&e.key==="Escape"){e.stopPropagation();close();return}
  if(e.key!=="?"||e.ctrlKey||e.altKey)return;const a=document.activeElement;
  if(a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)))return;e.preventDefault();m.classList.contains("show")?close():openKeys()},true)})();
