// Glass legibility (ux-review/20-quality-bar.md §3): every text and icon on screen against what's actually behind it,
// read from pixels — over a white and a bright, busy picture, in every theme, glass on and off.
// How: each state is captured twice, as it is and with every text and icon transparent. The pixels that change are the
// glyphs; the second capture is exactly what's behind them. A glyph's colour is its core (its strongest pixels against
// their own background); its contrast is against the worst 5 % of the background behind it.
// Needs (WCAG 2.2 AA): text 4.5:1, large text (≥ 24 px, or ≥ 18.66 px bold) 3:1, an icon (a control's only label) 3:1.
// The backgrounds stand still under Reduce Motion (Kiln reads it at start: set, then reload).

const NEED = { text: 4.5, large: 3, icon: 3 };
const THEMES = process.env.LEG_THEMES ? process.env.LEG_THEMES.split(",") : ["starscape", "aurora", "embers", "matrix"];

/* the page side: what's shown as text or as an icon, and the contrast of each from the two captures */
const PAGE = `(() => {
  const lum = (r, g, b) => {
    const f = c => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const seen = el => {
    if (el.closest("#modal:not(.show), .pop:not(.show)")) return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return false;
    }
    return true;
  };
  const name = el =>
    (el.id ? "#" + el.id : el.tagName.toLowerCase() + (el.classList[0] ? "." + el.classList[0] : "")) +
    (el.closest("[id]") && el.closest("[id]") !== el ? " in #" + el.closest("[id]").id : "");
  window.__leg = {
    items() {
      const out = [], W = innerWidth, H = innerHeight;
      const add = (el, r, kind, what) => {
        const x = Math.max(0, Math.floor(r.left)), y = Math.max(0, Math.floor(r.top));
        const w = Math.min(W, Math.ceil(r.right)) - x, h = Math.min(H, Math.ceil(r.bottom)) - y;
        if (w >= 3 && h >= 3) out.push({ name: name(el), what, kind, x, y, w, h });
      };
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode()); ) {
        const t = n.textContent.trim(), el = n.parentElement;
        if (!t || !el || el.closest("script,style,canvas,svg,.vendor") || !seen(el)) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        const r = rg.getBoundingClientRect(), cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
        const large = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
        add(el, r, large ? "large" : "text", t.slice(0, 40));
      }
      /* a placeholder isn't a text node: an empty field's box, its glyphs found by the two captures like any text */
      for (const f of document.querySelectorAll("input[placeholder], textarea[placeholder]")) {
        if (f.value || !f.placeholder || !seen(f)) continue;
        const cs = getComputedStyle(f), fs = parseFloat(cs.fontSize);
        add(f, f.getBoundingClientRect(), fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700) ? "large" : "text", f.placeholder.slice(0, 40));
      }
      for (const svg of document.querySelectorAll("button svg, .tab svg, [data-tip] > svg")) {
        const b = svg.closest("button, [data-tip]");
        if (!b || b.textContent.trim() || !seen(svg)) continue; // a label in words is checked as text
        add(b, svg.getBoundingClientRect(), "icon", b.getAttribute("data-tip") || b.title || "");
      }
      return out;
    },
    async decode(b64) {
      const im = new Image();
      im.src = "data:image/png;base64," + b64;
      await im.decode();
      const c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext("2d");
      g.drawImage(im, 0, 0);
      return g.getImageData(0, 0, c.width, c.height);
    },
    async measure(withText, without, items) {
      const A = await this.decode(withText), B = await this.decode(without), out = [];
      for (const it of items) {
        const pairs = [];
        for (let y = it.y; y < it.y + it.h; y++)
          for (let x = it.x; x < it.x + it.w; x++) {
            const i = (y * A.width + x) * 4;
            const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
            if (d < 12) continue;
            const la = lum(A.data[i], A.data[i + 1], A.data[i + 2]), lb = lum(B.data[i], B.data[i + 1], B.data[i + 2]);
            pairs.push([la, lb, ratio(la, lb)]);
          }
        if (pairs.length < 6) continue; // nothing drawn there (or covered)
        pairs.sort((p, q) => q[2] - p[2]);
        const core = pairs[Math.floor(pairs.length * 0.05)][0]; // the glyph's colour: its strongest pixels
        const vs = pairs.map(p => ratio(core, p[1])).sort((p, q) => p - q);
        out.push({ ...it, contrast: +vs[Math.floor(vs.length * 0.05)].toFixed(2) });
      }
      return out;
    },
  };
  return 1;
})()`;

const HIDE = `(()=>{const s=document.createElement("style");s.id="__legHide";s.textContent="*,*::before,*::after,*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;transition:none!important}svg,svg *{color:transparent!important;stroke:transparent!important;fill:transparent!important}";document.head.appendChild(s);return 1})()`;
const SHOW = `($("__legHide")?.remove(),1)`;

/** one state: both captures, then each text and icon's contrast against its need */
async function measure(k, label) {
  await k.mouse(2, 2);
  await k.sleep(900);
  const items = await k.ev(`__leg.items()`);
  if (process.env.LEG_SHOTS) await k.shot(label.replace(/[^\w]+/g, "-"));
  const a = (await k.send("Page.captureScreenshot", { format: "png" })).result.data;
  await k.ev(HIDE);
  await k.ev(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(1))))`);
  const b = (await k.send("Page.captureScreenshot", { format: "png" })).result.data;
  await k.ev(SHOW);
  const got = await k.ev(`__leg.measure(${JSON.stringify(a)},${JSON.stringify(b)},${JSON.stringify(items)})`);
  return got.map(g => ({ ...g, state: label, need: NEED[g.kind] }));
}

export async function textIsLegibleOverAnything(k, t) {
  await k.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await k.reload();
  await k.job("[fill:ffffff] a white page", { steps: 1, name: "White" });
  await k.job("[fill:busy] a busy bright one", { steps: 1, name: "Busy" });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.ev(PAGE);
  const all = [];
  for (const glass of ["on", "off"])
    for (const theme of THEMES) {
      await k.setting("glass", glass);
      await k.ev(`(S.theme="${theme}",$("sTheme").value="${theme}",applyTheme(),save(),1)`);
      const st = `${theme}, glass ${glass}`;
      for (const pic of ["White", "Busy"]) {
        await k.ev(`(showView("gen"),browseTo(jobs.find(j=>j.name==="${pic}")),1)`);
        await k.sleep(1200);
        all.push(...(await measure(k, `${st}: the Gallery, ${pic.toLowerCase()} picture`)));
        // the picture's own controls (the edit tools, the arrows) show while the pointer is on it
        const r = await k.rect("#frame");
        await k.mouse(r.left + r.width / 2, r.top + r.height / 2);
        await k.sleep(700);
        const items = await k.ev(`__leg.items()`);
        const a = (await k.send("Page.captureScreenshot", { format: "png" })).result.data;
        await k.ev(HIDE);
        await k.ev(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(1))))`);
        const b = (await k.send("Page.captureScreenshot", { format: "png" })).result.data;
        await k.ev(SHOW);
        const over = await k.ev(`__leg.measure(${JSON.stringify(a)},${JSON.stringify(b)},${JSON.stringify(items)})`);
        all.push(
          ...over.map(g => ({ ...g, state: `${st}: hovering the ${pic.toLowerCase()} picture`, need: NEED[g.kind] })),
        );
      }
      // your empty draft: the name's and the prompt's placeholders
      await k.ev(
        `(endPeek(),showView("gen"),["pname","prompt"].forEach(i=>{$(i).value="";$(i).dispatchEvent(new Event("input"))}),1)`,
      );
      await k.sleep(1200);
      all.push(...(await measure(k, `${st}: your empty draft`)));
      await k.ev(`(showView("queue"),1)`);
      await k.sleep(1200);
      all.push(...(await measure(k, `${st}: the Queue`)));
    }
  t.ok(all.length > 200, "it found the text and icons on screen", { measured: all.length });
  /* one line per element and need: its worst state */
  const worst = new Map();
  for (const g of all) {
    const key = `${g.name} “${g.what}”`;
    const w = worst.get(key);
    if (!w || g.contrast / g.need < w.contrast / w.need) worst.set(key, g);
  }
  const fails = [...worst.entries()].filter(([, g]) => g.contrast < g.need);
  t.ok(
    !fails.length,
    `every text and icon reads (${worst.size} of them, each in its worst state)`,
    fails
      .sort((p, q) => p[1].contrast / p[1].need - q[1].contrast / q[1].need)
      .map(([key, g]) => `${g.contrast}:1 (needs ${g.need}) ${key} — ${g.state}`),
  );
  if (process.env.LEG_ALL) for (const [key, g] of worst) t.note(`all: ${g.contrast}:1 (${g.kind}) ${key} — ${g.state}`);
}
textIsLegibleOverAnything.opts = { step: 0.2 };

/* Text on the bare sky reads wherever the sky is brightest (effects.js clearSkyText): each skin's sky is read from its
   canvas, a piece of sky text is moved over the brightest spot, and the sky under it must leave the quietest grey that
   sits on the sky (--faint, the LoRA label) at 4.5:1, and be at most a tenth of the spot's light (the headless sky is
   dimmer than a real GPU's, ~1/5, so the contrast alone could pass with nothing cleared). The sky moves, as you see it: under Reduce Motion the aurora's
   exposure is off and its brightest spot is a tenth as bright; it drifts slowly enough to be where it was 3 frames on. */
export async function skyIsClearUnderItsText(k, t) {
  await k.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await k.reload();
  const fails = [];
  for (const theme of THEMES) {
    await k.ev(`(S.theme="${theme}",$("sTheme").value="${theme}",applyTheme(),save(),1)`);
    await k.ev(`(showView("gen"),1)`);
    await k.sleep(4000); // the aurora's exposure settles
    if (process.env.LEG_SHOTS) await k.shot(`sky-${theme}`);
    const got = await k.ev(`(async()=>{
      const cv=$("stars"),g=cv.getContext("2d"),d=devicePixelRatio||1,cb=cv.getBoundingClientRect();
      const lum=(r,gg,b)=>{const f=c=>((c/=255)<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);return 0.2126*f(r)+0.7152*f(gg)+0.0722*f(b)};
      const at=(D,i)=>lum(D[i]*D[i+3]/255,D[i+1]*D[i+3]/255,D[i+2]*D[i+3]/255); // over the page's black
      /* the brightest 60 px square of the sky, away from the edges */
      const A=g.getImageData(0,0,cv.width,cv.height).data,S=Math.round(60*d);let best=-1,bx=0,by=0;
      for(let y=S;y<cv.height-2*S;y+=S/2)for(let x=S;x<cv.width-2*S;x+=S/2){let s=0;
        for(let j=0;j<S;j+=4)for(let i=0;i<S;i+=4)s+=at(A,((y+j)*cv.width+x+i)*4);
        if(s>best){best=s;bx=x;by=y}}
      const lbl=document.querySelector("#chips .chiplbl");if(!lbl)return{err:"no LoRA label"};
      const keep=lbl.style.cssText;
      const want={x:cb.left+bx/d,y:cb.top+by/d};
      /* fixed inside a transformed box is placed against that box: placed, measured, moved by the miss */
      lbl.style.cssText+=";position:fixed;z-index:99;left:"+want.x+"px;top:"+want.y+"px";
      const r0=lbl.getBoundingClientRect();
      lbl.style.left=(2*want.x-r0.left)+"px";lbl.style.top=(2*want.y-r0.top)+"px";
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,120)))));
      const r=lbl.getBoundingClientRect(),x0=Math.round((r.left-cb.left)*d),y0=Math.round((r.top-cb.top)*d);
      const w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
      const B=g.getImageData(x0,y0,w,h).data,L=[];for(let i=0;i<B.length;i+=4)L.push(at(B,i));
      const avg=L.reduce((p,q)=>p+q,0)/L.length;L.sort((p,q)=>q-p);const sky=L[Math.floor(L.length*0.05)];
      const c=getComputedStyle(lbl).color.match(/[0-9.]+/g).map(Number),fg=lum(c[0],c[1],c[2]);
      lbl.style.cssText=keep;
      if(Math.abs(r.left-want.x)>2||Math.abs(r.top-want.y)>2)return{err:"the label landed at "+[r.left,r.top].map(Math.round)+", not at the spot "+[want.x,want.y].map(Math.round)};
      return{peak:+(best/((S/4)**2)).toFixed(3),avg:+avg.toFixed(4),sky:+sky.toFixed(3),contrast:+((Math.max(fg,sky)+0.05)/(Math.min(fg,sky)+0.05)).toFixed(2)};
    })()`);
    t.note(
      `${theme}: the sky's brightest spot ${got.peak} → under the text ${got.avg} (its brightest 5 %: ${got.sky}), ${got.contrast}:1`,
    );
    if (got.err) fails.push(`${theme}: ${got.err}`);
    else if (got.contrast < 4.5) fails.push(`${theme}: ${got.contrast}:1 (needs 4.5)`);
    else if (got.peak > 0.005 && got.avg > got.peak / 10)
      fails.push(`${theme}: ${got.avg} under the text, ${got.peak} at the spot (averages)`);
  }
  t.ok(!fails.length, "the sky is clear under its text, wherever it's brightest", fails);
}
skyIsClearUnderItsText.opts = { step: 0.2 };
