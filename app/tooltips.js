/* Kiln · tooltips */
/* ======================= tooltips: one consistent style, short delay ======================= */
(function(){const tip=document.createElement("div");tip.id="tip";document.body.appendChild(tip);let t=null,cur=null;
 function hide(){clearTimeout(t);tip.classList.remove("show");cur=null}
 let mx=0,my=0;document.addEventListener("mousemove",e=>{mx=e.clientX;my=e.clientY},{passive:true});
 document.addEventListener("mouseover",e=>{const el=e.target.closest("[title],[data-tip]");if(el===cur)return;hide();if(!el)return;
  if(el.hasAttribute("title")){el.dataset.tip=el.getAttribute("title");el.removeAttribute("title")}
  const text=el.dataset.tip;if(!text)return;cur=el;
  t=setTimeout(()=>{if(cur!==el||document.querySelector(".pop.show"))return;tip.textContent=text;tip.classList.add("show");
   const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;let x=r.left+r.width/2-w/2,y=r.bottom+8;
   if(y+h>innerHeight-6)y=r.top-h-8;
   if(y<6){y=Math.max(6,Math.min(innerHeight-h-6,my+18));x=mx-w/2} // taller than the window: follow the pointer instead
   x=Math.max(6,Math.min(innerWidth-w-6,x));tip.style.transform=`translate(${x}px,${y}px)`},450)});
 document.addEventListener("mousedown",hide);document.addEventListener("wheel",hide,{passive:true});
 const TIPS={pMP:"Image size (megapixels)",pAR:"Aspect ratio",pST:"Sampling steps — scroll to nudge",pSD:"Seed — random each job, or fixed",
  pN:"How many images to queue — scroll to nudge",play:"Add to queue (Ctrl+Enter)",prog:"Click to see this image's prompt · the preview shows the last finished step",
  stopBtn:"Stop this job",csize:"Thumbnail size",lsearch:"Search LoRAs by name",gear:"Settings",vclose:"Close (Esc)"};
 for(const id in TIPS){const el=$(id);if(el&&!el.title)el.dataset.tip=TIPS[id]}
 const TABT={gen:"The image being made, and the last result",queue:"Running, waiting and finished jobs",loras:"Your LoRA library",png:"Read settings from any Forge PNG"};
 document.querySelectorAll(".tab").forEach(t=>t.dataset.tip=TABT[t.dataset.v]);
 const CHIPT=e=>{const c=e.target.closest(".chip .cn");if(c&&!c.dataset.tip)c.dataset.tip="Open in the LoRA library";const x=e.target.closest(".chip .cx");if(x&&!x.dataset.tip)x.dataset.tip="Remove";
  const s=e.target.closest(".star");if(s&&!s.dataset.tip)s.dataset.tip="Favourite";const tg=e.target.closest("[data-tg]");if(tg&&!tg.dataset.tip)tg.dataset.tip="On / off";
  const cd=e.target.closest(".card .img");if(cd&&!cd.dataset.tip)cd.dataset.tip="Click to switch on/off";const fc=e.target.closest(".fchips button");if(fc&&!fc.dataset.tip)fc.dataset.tip="Filter";
  const h=e.target.closest(".qi .handle");if(h&&!h.dataset.tip)h.dataset.tip="Drag to reorder";const qi=e.target.closest(".qi .body");if(qi&&!qi.dataset.tip)qi.dataset.tip="Peek at this prompt — Reuse to load it"};
 document.addEventListener("mouseover",CHIPT,true)})();
