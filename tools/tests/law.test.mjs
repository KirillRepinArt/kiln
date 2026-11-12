// The layout pass's law (ux-review/22-layout-law.md, v0.7d step 6L): the pass gives each part of the box its width, the
// part answers its height at that width, the pass places it once — so the box is written, in a change's first frame, to
// the place it stays at. Generated over the changes that move or resize the box × the box's width × its chips × its
// text. The user's case (Q2, 2026-11-12): dropped into Vertical, the box was placed for three rows of LoRA chips, then
// capChips cut them to two from its own observer, and the box moved 34 px.
const viewport = (k, w, h) =>
  k.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
async function press(k, x, y) {
  await k.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await k.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
}
async function moveTo(k, x0, y0, x1, y1) {
  for (let i = 1; i <= 10; i++)
    await k.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x0 + ((x1 - x0) * i) / 10,
      y: y0 + ((y1 - y0) * i) / 10,
      button: "left",
      buttons: 1,
    });
}
const release = (k, x, y) =>
  k.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });

/* the box as WRITTEN (its layout place: no lift, no ride — layoutRect) and its chips row, read after a frame's writes
   (rAF → setTimeout 0); window.__law[tag] */
const READ = tag =>
  `(()=>{const e=$("left");let top=0;for(let x=e;x;x=x.offsetParent)top+=x.offsetTop;const L={top,height:e.offsetHeight};window.__law=window.__law||{};window.__law[${JSON.stringify(tag)}]={top:Math.round(L.top),h:Math.round(L.height),chips:$("chips").offsetHeight,chipsShown:[...document.querySelectorAll("#chips .chip[data-n]")].filter(c=>!c.hidden).length};return 1})()`;
/** read the box in the first frame after the next `event` on window @param {string} event */
const firstFrameAfter = event =>
  `(window.addEventListener(${JSON.stringify(event)},()=>requestAnimationFrame(()=>setTimeout(()=>${READ("first")},0)),{once:true}),1)`;

/* chip labels as short as real ones (the test LoRAs' names are long: they never left the "+" on a row of its own) —
   page code: NAMES */
const NAMES_JS = `window.NAMES=["Turbo 4step","Carrie Fisher","Christina Applegate","Betty Gilpin","Anya Taylor Joy","Alison Brie"]`;
const LONG =
  "epic cinematic shot of a castle tower at night, fog, mist, a dark lake, a giant squid's tentacles, aurora in the sky, a pumpkin patch, moonlight on the stone";

/** one case: its state, then the change; the box's written place and chips in the change's first frame vs at rest */
async function lawCase(k, { from, vw, sw, loras, text, change, mode = "", page = "png" }) {
  await viewport(k, 1785, 1080);
  await k.ev(`(document.querySelector('.tab[data-v="${page}"]').click(),1)`);
  await k.ev(`(LORAS.forEach((l,i)=>{l.on=i<${loras};l.display=NAMES[i]||l.display}),renderChips(),P.value=${JSON.stringify(text)},P.dispatchEvent(new Event("input")),
    setPaneSize("box","w",${vw},"vert"),setPaneSize("box","w",${sw},"side"),S.hmode=${JSON.stringify(mode)},updHm(),setDock(${JSON.stringify(from)}),1)`);
  await k.mouse(4, 4);
  await k.sleep(1100);
  await k.ev(`(window.__law={},1)`);
  await k.ev(READ("before"));
  if (change === "drop") {
    const n = await k.rect("#ltitle"),
      x = n.left + 20,
      y = n.top + n.height / 2,
      to = from === "below" ? "left" : "below";
    await press(k, x, y);
    await moveTo(k, x, y, x, y + 12);
    const r = await k.ev(
      `(r=>r&&{x:r.left+r.width/2,y:r.top+r.height/2})(document.querySelector('.droptile[data-dock="${to}"][data-pos="mid"]')?.getBoundingClientRect())`,
    );
    await moveTo(k, x, y + 12, r.x, r.y);
    await k.ev(firstFrameAfter("pointerup"));
    await release(k, r.x, r.y);
  } else if (change === "menu") {
    await k.ev(
      `(setDock(${JSON.stringify(from === "below" ? "left" : "below")}),requestAnimationFrame(()=>setTimeout(()=>${READ("first")},0)),1)`,
    );
  } else if (change === "lora") {
    await k.ev(
      `(LORAS.forEach((l,i)=>l.on=i<${loras === 6 ? 2 : 6}),renderChips(),requestAnimationFrame(()=>setTimeout(()=>${READ("first")},0)),1)`,
    );
  } else if (change === "window") {
    await k.ev(firstFrameAfter("resize"));
    await viewport(k, 1600, 1000);
  }
  await k.sleep(1200);
  await k.ev(READ("rest"));
  /* the pass's inputs were the rendered ones: run again at rest, it changes nothing (a fixed point) */
  await k.ev(`(layoutLeft(),sizeFrame(),1)`);
  await k.sleep(700);
  await k.ev(READ("again"));
  const r = await k.ev(`window.__law`);
  return r;
}

/** the cases of one change: the Vertical box's width (the chips cross two → three rows → capped) × chips × text */
const casesOf = change => {
  const out = [];
  /* side by side's box: at 552–560 with five chips the "+" wraps to a row of its own (94 px: measured in a sweep, the
     user's case); at 680 it doesn't. Vertical's: 520 (capped to two rows) and 760 */
  for (const sw of [680, 560, 552])
    for (const vw of [760, 520])
      for (const loras of [2, 5, 6])
        out.push({
          from: change === "drop" || change === "menu" ? "left" : "below",
          vw,
          sw,
          loras,
          text: LONG,
          change,
        });
  /* Fit (Vertical: the box as wide as the picture — a loop the pass solves): a picture page, long text */
  if (change !== "lora")
    for (const loras of [2, 5])
      out.push({ from: "left", vw: 760, sw: 560, loras, text: LONG + " " + LONG, change, mode: "match", page: "gen" });
  return out;
};

/* the law: written once, to where it stays */
async function writtenWhereItStays(k, t, change) {
  await k.until(`typeof LORAS!=="undefined"&&LORAS.length>=6`, 15000);
  await k.ev(`(${NAMES_JS},1)`);
  const cases = casesOf(change),
    bad = [],
    log = [];
  for (const c of cases) {
    const r = await lawCase(k, c);
    const tag = `${c.change}${c.mode ? " (Fit)" : ""} ${c.from}→ sw ${c.sw} vw ${c.vw} loras ${c.loras} ${c.text.length > 80 ? "long" : "short"}`;
    log.push(`${tag}: ${JSON.stringify(r)}`);
    if (!r.first || !r.rest || !r.again) {
      bad.push(`${tag}: not read ${JSON.stringify(r)}`);
      continue;
    }
    const same = (/** @type {any} */ a, /** @type {any} */ b) =>
      Math.abs(a.top - b.top) <= 1 && Math.abs(a.h - b.h) <= 1 && a.chips === b.chips;
    if (!same(r.first, r.rest))
      bad.push(`${tag}: moved after it landed — first ${JSON.stringify(r.first)} → rest ${JSON.stringify(r.rest)}`);
    else if (!same(r.rest, r.again))
      bad.push(
        `${tag}: placed from stale sizes — rest ${JSON.stringify(r.rest)} → the pass again ${JSON.stringify(r.again)}`,
      );
  }
  const { appendFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("tools/tests/out", { recursive: true });
  appendFileSync("tools/tests/out/law.txt", log.join(String.fromCharCode(10)) + String.fromCharCode(10));
  t.ok(
    bad.length === 0,
    `${change}: the box is written, in the change's first frame, where it stays, placed from the sizes it renders (${cases.length} cases; ${bad.length} not)`,
    bad.slice(0, 12),
  );
}
export const dropIntoALane = (k, t) => writtenWhereItStays(k, t, "drop");
export const layoutMenu = (k, t) => writtenWhereItStays(k, t, "menu");
export const loraOnOrOff = (k, t) => writtenWhereItStays(k, t, "lora");
export const windowResized = (k, t) => writtenWhereItStays(k, t, "window");
for (const f of [dropIntoALane, layoutMenu, loraOnOrOff, windowResized]) f.opts = { width: 1785, height: 1080 };

/* Rule 2 — nothing resizes or re-places the box after the pass. Every ResizeObserver is wrapped before Kiln loads: a
   callback that changes the box's place or size (#lcol's and #left's styles) or which chips show is a re-run after the
   fact (today: the controls row's observer, the chips' capChips, the patch on the chips row). */
const RO_WATCH = `(()=>{const O=window.ResizeObserver;window.__ro=[];window.__roOn=false;
  const snap=()=>{const c=document.getElementById("lcol"),l=document.getElementById("left"),ch=document.getElementById("chips");
    return [c?c.getAttribute("style"):"",l?l.getAttribute("style"):"",ch?[...ch.children].map(e=>e.hidden?0:1).join("")+"/"+ch.childElementCount:""]};
  window.ResizeObserver=class extends O{constructor(cb){super((es,o)=>{const a=snap();cb(es,o);const b=snap();
    if(window.__roOn&&(a[0]!==b[0]||a[1]!==b[1]||a[2]!==b[2]))window.__ro.push({on:es.map(e=>e.target.id||e.target.className).join(","),
      changed:["#lcol","#left","chips shown"].filter((_,i)=>a[i]!==b[i]).join(",")})})}}})()`;
export async function nothingResizesAfterThePass(k, t) {
  await k.until(`typeof LORAS!=="undefined"&&LORAS.length>=6`, 15000);
  await viewport(k, 1785, 1080);
  await k.ev(`(${NAMES_JS},document.querySelector('.tab[data-v="png"]').click(),1)`);
  await k.ev(`(LORAS.forEach((l,i)=>{l.on=i<5;l.display=NAMES[i]||l.display}),renderChips(),P.value=${JSON.stringify(LONG)},P.dispatchEvent(new Event("input")),
    setPaneSize("box","w",520,"vert"),setPaneSize("box","w",560,"side"),setDock("left"),1)`);
  await k.mouse(4, 4);
  await k.sleep(1200);
  await k.ev(`(window.__roOn=true,1)`);
  /* the changes: the user's drop into Vertical, the Layout menu back, a LoRA off and on, the window, typing */
  const n = await k.rect("#ltitle");
  await press(k, n.left + 20, n.top + n.height / 2);
  await moveTo(k, n.left + 20, n.top + n.height / 2, n.left + 20, n.top + n.height / 2 + 12);
  const r = await k.ev(
    `(r=>r&&{x:r.left+r.width/2,y:r.top+r.height/2})(document.querySelector('.droptile[data-dock="below"][data-pos="mid"]')?.getBoundingClientRect())`,
  );
  await moveTo(k, n.left + 20, n.top + n.height / 2 + 12, r.x, r.y);
  await release(k, r.x, r.y);
  await k.sleep(1200);
  await k.ev(`(setDock("left"),1)`);
  await k.sleep(1200);
  await k.ev(`(LORAS[4].on=false,renderChips(),1)`);
  await k.sleep(600);
  await k.ev(`(LORAS[4].on=true,renderChips(),1)`);
  await k.sleep(600);
  await viewport(k, 1600, 1000);
  await k.sleep(900);
  await k.ev(`(P.value=${JSON.stringify(LONG + " " + LONG)},P.dispatchEvent(new Event("input")),1)`);
  await k.sleep(900);
  const ro = await k.ev(`(window.__roOn=false,window.__ro)`);
  const kinds = [...new Set(ro.map(x => `${x.on} → ${x.changed}`))];
  t.ok(ro.length === 0, `no observer re-places or resizes the box after the pass (${ro.length} did)`, kinds);
}
nothingResizesAfterThePass.opts = { width: 1785, height: 1080, inject: RO_WATCH };
