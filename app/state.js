/* Kiln · data, state, icons, image hover buttons */
/* ======================= data ======================= */
const SIZES={ // ~1.0 / 1.5 / 2.0 MP presets, all sides multiples of 16
 "1.0":{"1:1":[1024,1024],"4:3":[1152,864],"3:2":[1248,832],"16:9":[1360,768],"21:9":[1568,672],"3:4":[864,1152],"2:3":[832,1248],"9:16":[768,1360]},
 "1.5":{"1:1":[1232,1232],"4:3":[1408,1056],"3:2":[1488,992],"16:9":[1648,928],"21:9":[1872,800],"3:4":[1056,1408],"2:3":[992,1488],"9:16":[928,1648]},
 "2.0":{"1:1":[1408,1408],"4:3":[1632,1216],"3:2":[1728,1152],"16:9":[1888,1056],"21:9":[2160,928],"3:4":[1232,1648],"2:3":[1152,1728],"9:16":[1056,1872]}};
const RATIOS=["3:4","2:3","9:16","1:1","4:3","3:2","16:9","21:9"];
const SEC_PER_STEP={"1.0":60,"1.5":130,"2.0":220}; // placeholders until real history exists
/* LoRA library — demo data only; names under "people" are fictional placeholders. — the real app reads Forge's /sdapi/v1/loras (folder comes from the file path) */
const LIB=[
 ["krea2_turbo_4step_rank_64_lora_comfyui","utility"],["detail_enhancer_krea2","utility"],["skin_texture_krea2","utility"],
 ["lenovo_ultrareal_krea2","style"],["realistic_snapshot_krea2","style"],["krea2_softwatercolor","style"],["krea2_vintagetarot","style"],
 ["krea2_janedoe_v2_large_onetrainer","people"],["krea2_annasmith_v1_onetrainer","people"],["krea2_lunavale_v1_large_onetrainer","people"],
 ["krea2_miraklein_v3_onetrainer","people"],["krea2_sofiareyes_v1_onetrainer","people"],["krea2_evarosen_v2_onetrainer","people"],
 ["krea2_ninablake_v1_large_onetrainer","people"],["krea2_claraholt_v1_onetrainer","people"],["krea2_idamorrow_v2_onetrainer","people"],
];
const DEF={krea2_turbo_4step_rank_64_lora_comfyui:{w:.75,on:true,recipe:true,note:"4-step distill"},
 detail_enhancer_krea2:{w:.5,on:true,recipe:true,note:"example utility LoRA"},skin_texture_krea2:{w:.4,note:"example utility LoRA"}};
function parseName(file,folder){
 const m=file.match(/^krea2_([a-z0-9]+)_v(\d+)(?:_(large|small))?(?:_(onetrainer|aitoolkit|kohya))?$/i);
 if(folder==="people"&&m){const n=m[1];return{display:n[0].toUpperCase()+n.slice(1),tags:[`v${m[2]}`,m[3],m[4]].filter(Boolean).join(" · ")}}
 return{display:file.replace(/^krea2_?/,"").replace(/_krea2$/,"").replace(/_lora_comfyui$/,"").replace(/_rank_\d+/,"").replace(/_/g," "),tags:""}}
const LORAS=LIB.map(([file,folder])=>{const p=parseName(file,folder);const d=DEF[file]||{};
 return{name:file,folder,display:p.display,tags:p.tags,w:d.w??(folder==="people"?0.7:0.5),on:!!d.on,recipe:!!d.recipe,note:d.note||"",fav:false,used:0,thumb:null}});

/* ======================= state ======================= */
const S={pname:"",ncount:{},pph:0,lw:0,mp:"1.5",ar:"3:4",steps:4,seedMode:"random",seed:123456789,n:1,view:"gen",demo:20,theme:"ice",oneFace:true,lfilter:"all"};
let draft="";let jobs=[];let nextId=1;
try{const sv=JSON.parse(localStorage.getItem("kiln_state")||"{}");Object.assign(S,sv.S||{});draft=sv.draft||"";
 (sv.loras||[]).forEach(x=>{const l=LORAS.find(l=>l.name===x.name);if(l)Object.assign(l,x)})}catch(e){}
function save(){try{localStorage.setItem("kiln_state",JSON.stringify({S,draft,loras:LORAS.map(({name,on,onAt,w,fav,used,display,thumb})=>({name,on,onAt,w,fav,used,display,thumb}))}))}catch(e){}}
const $=id=>document.getElementById(id);
const P=$("prompt");
P.value=draft||"";

/* ======================= icons ======================= */
const IC={
 i2i:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="3" y="5" width="8" height="8" rx="1.5"/><rect x="13" y="11" width="8" height="8" rx="1.5"/><path d="M11 9h3a2 2 0 0 1 2 2"/><path d="M14.5 7.5L16 9l-1.5 1.5"/></svg>',
 up:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
 open:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
 folder:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
 thumb:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="12" cy="9" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/><rect x="2.5" y="2.5" width="19" height="19" rx="4"/></svg>',
 x:'<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 dice:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="#fff"/><circle cx="15" cy="15" r="1.2" fill="#fff"/><circle cx="15" cy="9" r="1.2" fill="#fff"/><circle cx="9" cy="15" r="1.2" fill="#fff"/></svg>',
};
function sideButtons(el,getJob){el.innerHTML=
 `<button data-tip="Send to img2img" data-a="i2i">${IC.i2i}</button>
  <button data-tip="Upscale" data-a="up">${IC.up}</button>
  <button data-tip="Open in default app" data-a="open">${IC.open}</button>
  <button data-tip="Show in folder" data-a="folder">${IC.folder}</button>
  <button data-tip="Use as LoRA thumbnail" data-a="thumb">${IC.thumb}</button>`;
 el.onclick=e=>{const b=e.target.closest("button");if(!b)return;e.stopPropagation();
  if(b.dataset.a==="thumb"){setThumbs(getJob());return}
  toast({i2i:"Prototype: would send this image to img2img",up:"Prototype: would upscale with your default upscaler",open:"Prototype: would open the PNG in your default app",folder:"Prototype: would open Explorer with the file selected"}[b.dataset.a])}}
sideButtons($("sideGen"),()=>shownDone());
function setThumbs(j){if(!j)return;const faces=j.loras.map(x=>LORAS.find(l=>l.name===x.name)).filter(l=>l&&l.folder==="people");
 if(!faces.length){toast("This image used no face LoRA");return}
 const c=document.createElement("canvas");paint(c,j,1);const t=document.createElement("canvas");t.width=t.height=160;
 const s=Math.min(c.width,c.height);t.getContext("2d").drawImage(c,(c.width-s)/2,(c.height-s)*0.25,s,s,0,0,160,160);
 const url=t.toDataURL("image/jpeg",.8);faces.forEach(l=>l.thumb=url);save();renderLoras();toast(`Thumbnail set for ${faces.map(l=>l.display).join(", ")}`)}
