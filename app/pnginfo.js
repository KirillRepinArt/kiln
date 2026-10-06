/* Kiln · PNG Info tab */
/* ======================= PNG info (real) ======================= */
let parsed=null;const drop=$("drop");
drop.onclick=()=>$("file").click();$("file").onchange=e=>e.target.files[0]&&readPng(e.target.files[0]);
["dragenter","dragover"].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add("over")}));
["dragleave","drop"].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove("over")}));
drop.addEventListener("drop",e=>{const f=e.dataTransfer.files[0];if(f)readPng(f)});
async function readPng(f){try{const u=URL.createObjectURL(f);const el=$("pimgEl");if(el.dataset.u)URL.revokeObjectURL(el.dataset.u);el.dataset.u=u;el.src=u;$("pimg").classList.add("show");$("pClear").style.display=""}catch(e){}const b=new Uint8Array(await f.arrayBuffer());const dv=new DataView(b.buffer);let o=8,txt=null;const dec=new TextDecoder("latin1"),u8=new TextDecoder("utf-8");
 if(b[1]!==0x50){$("pout").textContent="Not a PNG file.";return}
 while(o<b.length){const len=dv.getUint32(o),type=dec.decode(b.slice(o+4,o+8)),d=b.slice(o+8,o+8+len);
  if(type==="tEXt"){const z=d.indexOf(0);if(dec.decode(d.slice(0,z))==="parameters")txt=u8.decode(d.slice(z+1))}
  if(type==="iTXt"){const z=d.indexOf(0);if(dec.decode(d.slice(0,z))==="parameters"){let p=z+3;p=d.indexOf(0,p)+1;p=d.indexOf(0,p)+1;txt=u8.decode(d.slice(p))}}
  if(type==="IEND")break;o+=12+len}
 if(!txt){$("pout").textContent="No generation settings found in this PNG.";$("pSend").disabled=true;return}
 $("pout").dataset.raw=txt;parsed=parseParams(txt);renderPngInfo(txt);$("pSend").disabled=false;$("pRaw").style.display=""}

/* ---------- PNG Info: prompt rendered like the editor + settings table ---------- */
function piLine(t){const e=esc(t).replace(/&lt;lora:([^&]*?)&gt;/g,'<span class="cm-lora">&lt;lora:$1&gt;</span>').replace(/\{([^{}]*\|[^{}]*)\}/g,'<span class="cm-variant">{$1}</span>');
 if(/^\s*\/\//.test(t))return `<div class="ln cmt">${e}</div>`;
 const m=t.match(/^(\s*)(\d+[.)]|[-*•])\s+/);if(m)return `<div class="ln list"><span class="cm-marker">${esc(m[2])}</span>${e.slice(esc(m[0]).length)}</div>`;
 if(/^\s*[^\s:][^:]{0,28}:\s*$/.test(t))return `<div class="ln lbl">${e}</div>`;
 return `<div class="ln">${e||"&nbsp;"}</div>`}
function piParams(line){const out=[];const re=/\s*([^:,]+?):\s*("(?:[^"\\]|\\.)*"|[^,]*)(?:,|$)/g;let m;
 while((m=re.exec(line))&&m[0]){out.push([m[1].trim(),m[2].trim().replace(/^"|"$/g,"")])}return out}
function renderPngInfo(t){const o=$("pout");o.classList.remove("raw");
 const i=t.search(/\n(Negative prompt:|Steps:)/);const prompt=(i>=0?t.slice(0,i):t);const rest=i>=0?t.slice(i+1):"";
 const negM=rest.match(/^Negative prompt:\s*([\s\S]*?)(?=\nSteps:|$)/);const pline=(rest.match(/(^|\n)(Steps:[^\n]*)/)||[])[2]||"";
 let h=`<div class="pi-h">Prompt</div><div class="pi-p">${prompt.split("\n").map(piLine).join("")}</div>`;
 if(negM&&negM[1].trim())h+=`<div class="pi-h">Negative prompt</div><div class="pi-p pi-neg">${esc(negM[1].trim())}</div>`;
 const kv=piParams(pline);if(kv.length)h+=`<div class="pi-h">Settings</div><dl class="pi-grid">${kv.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
 o.innerHTML=h;$("pRaw").textContent="Show raw text"}
$("pClear").onclick=()=>{const el=$("pimgEl");if(el.dataset.u)URL.revokeObjectURL(el.dataset.u);el.removeAttribute("src");el.dataset.u="";$("pimg").classList.remove("show");
 const o=$("pout");o.classList.remove("raw");o.textContent="";o.dataset.raw="";parsed=null;$("pSend").disabled=true;$("pRaw").style.display="none";$("pClear").style.display="none";$("file").value=""};
$("pRaw").onclick=()=>{const o=$("pout");if(o.classList.contains("raw")){renderPngInfo(o.dataset.raw)}else{o.classList.add("raw");o.textContent=o.dataset.raw;$("pRaw").textContent="Show formatted"}};

function parseParams(t){const i=t.search(/\n(Negative prompt:|Steps:)/);const prompt=(i>=0?t.slice(0,i):t).trim();
 const g=k=>{const m=t.match(new RegExp(k+":\\s*([^,\\n]+)"));return m?m[1].trim():null};
 const loras=[...prompt.matchAll(/<lora:([^:>]+):([-\d.]+)>/g)].map(m=>({name:m[1],w:+m[2]}));
 return{prompt:prompt.replace(/<lora:[^>]+>/g,"").trim(),steps:+g("Steps")||null,seed:+g("Seed")||null,size:g("Size"),loras}}
$("pSend").onclick=()=>{if(!parsed)return;P.value=parsed.prompt;draft=parsed.prompt;
 if(parsed.steps)S.steps=parsed.steps;if(parsed.seed){S.seed=parsed.seed;S.seedMode="fixed"}
 if(parsed.size){const [w,h]=parsed.size.split("x").map(Number);let best=null;for(const m in SIZES)for(const r in SIZES[m]){const [a,b]=SIZES[m][r];const d=Math.abs(a-w)+Math.abs(b-h);if(!best||d<best.d)best={m,r,d}}if(best){S.mp=best.m;S.ar=best.r}}
 parsed.loras.forEach(pl=>{const l=LORAS.find(l=>l.name.toLowerCase()===pl.name.toLowerCase());if(l){l.on=true;l.w=pl.w}});
 save();renderAll();grow();toast("Settings loaded into the prompt — seed fixed")};
