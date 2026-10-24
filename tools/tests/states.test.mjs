// The picture view's states (ux-review/11-picture-states.md): LIVE / STILL (result | reference) / EMPTY in
// Generating, BROWSE in the Gallery — one test per group of rows of the transition table.
const st = k => k.ev(`({pic:document.body.dataset.pic,still:PV.still&&PV.still.kind,sid:PV.still&&PV.still.id,browse:PV.browse,peek:peekJob&&peekJob.id,tab:document.querySelector(".tab.on").dataset.v,has:$("frame").classList.contains("has"),draft:P.value===draft&&!P.readOnly})`);
const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 40000);
const tab = (k, v) => k.ev(`(document.querySelector('.tab[data-v="${v}"]').click(),1)`);
const red = k => k.until(`(()=>{const c=$("cv");if(c.width<4)return false;const d=c.getContext("2d").getImageData(c.width>>1,c.height>>1,1,1).data;return d[0]>180&&d[1]<70})()`, 6000, 100);

/* a job finishes, nothing waiting: Generating shows it, full quality, and your draft stays; ✕ = the empty frame */
export async function resultStill(k, t) {
  await k.ev(`(P.value="my own draft",draft=P.value,1)`);
  await k.job("[fill:dc2828] a red one", { steps: 2 }); await done(k, 1); await k.sleep(600);
  await k.ev(`(P.value="my own draft",draft=P.value,1)`);
  let s = await st(k);
  t.ok(s.pic === "still" && s.still === "result" && s.has, "the finished picture stays in Generating", s);
  t.ok(await red(k), "full quality: the real picture, not the blurred preview");
  t.ok(s.tab === "gen" && s.peek == null && s.draft, "on the Generating tab, the prompt box still holds your draft", s);
  t.ok(await k.ev(`$("frame").classList.contains("clearable")&&getComputedStyle(document.querySelector(".prog")).visibility==="hidden"`), "it has the ✕ Close (on hover); no status row");
  await k.ev(`($("bclose").click(),1)`); await k.sleep(400); s = await st(k);
  t.ok(s.pic === "empty" && !s.has && s.draft, "✕: the empty frame, your draft untouched", s);
  await k.ev(`(genNav(-1),1)`); await k.sleep(400); s = await st(k);
  t.ok(s.pic === "browse" && s.tab === "gallery", "← brings it back — in the Gallery", s);
}
resultStill.opts = { step: 0.1 };

/* option a: with more waiting, the result holds until the next job has a picture of its own, then the render
   cross-fades in; ✕ skips the wait */
export async function resultHoldsForTheRender(k, t) {
  await k.job("[fill:dc2828] first", { steps: 2 }); await k.job("[fill:2828dc] second", { steps: 3 });
  await k.until(`jobs.some(j=>j.status==="done")`, 30000, 50); await k.sleep(150);
  let s = await st(k);
  t.ok(s.pic === "still" && s.still === "result", "the first picture shows while the next job starts", s);
  await k.until(`!!current()`, 8000, 50); await k.sleep(150);
  s = await st(k); t.ok(s.pic === "still" && await k.ev(`!current().preview_rev`), "…while the next job runs without a preview yet", s);
  t.ok(await k.ev(`!$("frame").classList.contains("running")&&getComputedStyle(document.querySelector(".prog .track")).visibility==="visible"`), "no cover over it; the status row shows the new job's progress");
  t.ok(await k.until(`document.body.dataset.pic==="live"`, 15000, 100), "the render takes over once it has a picture");
  t.ok(await k.ev(`current()&&current().preview_rev>0`), "…and only then");
  await done(k, 2);
  await k.job("[fill:dc2828] third", { steps: 2 }); await k.job("[fill:2828dc] fourth", { steps: 6 });
  await k.until(`jobs.filter(j=>j.status==="done").length>=3`, 30000, 50); await k.sleep(100);
  if ((await st(k)).pic === "still") {
    await k.ev(`($("bclose").click(),1)`); await k.sleep(200);
    t.ok((await st(k)).pic === "live", "✕ on the waiting result: the render at once (its cover)");
  } else t.ok(false, "the third result should have shown first", await st(k));
}
resultHoldsForTheRender.opts = { step: 1.5 };

/* rule 1: a tab switch never changes the picture; an arrow always does */
export async function tabsAndArrows(k, t) {
  await k.job("[fill:dc2828] one", { steps: 2, ar: "3:4" }); await done(k, 1);
  await k.job("[fill:28dc28] two", { steps: 2, ar: "3:4" }); await done(k, 2); await k.sleep(500);
  const ids = await k.ev(`doneList().map(j=>j.id)`);
  let s = await st(k); const r0 = await k.rect("#frame");
  t.ok(s.pic === "still" && s.sid === ids[1], "the newest result in Generating", s);
  await tab(k, "gallery"); await k.sleep(700); s = await st(k); const r1 = await k.rect("#frame");
  t.ok(s.pic === "browse" && s.browse === ids[1] && s.peek === ids[1], "Gallery tab: the SAME picture, now with its prompt", s);
  t.ok(Math.abs(r0.left - r1.left) < 1 && Math.abs(r0.top - r1.top) < 1 && Math.abs(r0.width - r1.width) < 1, "…in the same place (nothing moves)", { r0, r1 });
  await k.ev(`(genNav(-1),1)`); await k.sleep(500); s = await st(k);
  t.ok(s.browse === ids[0] && s.peek === ids[0], "← : the picture before it", s);
  await tab(k, "gen"); await k.sleep(700); s = await st(k);
  t.ok(s.pic === "empty" && s.draft && s.tab === "gen", "Generating tab, idle: the clean frame (the live view), your draft", s);
  await k.ev(`(genNav(-1),1)`); await k.sleep(500); await k.ev(`(genNav(-1),1)`); await k.sleep(500);
  await k.ev(`($("pkPrompt").click(),1)`); await k.sleep(500); s = await st(k);
  t.ok(s.pic === "still" && s.still === "reference" && s.sid === ids[0], "Reuse: the picture as a reference", s);
  t.ok(!(await k.ev(`genNav(-1,true)`)), "← from the oldest: nothing to go to");
  await k.ev(`(genNav(1),1)`); await k.sleep(500); s = await st(k);
  t.ok(s.pic === "browse" && s.browse === ids[1], "→ from it: the next picture, in the Gallery", s);
  await k.ev(`(genNav(1),1)`); await k.sleep(500); s = await st(k);
  t.ok(s.pic === "empty" && s.tab === "gen" && s.draft, "→ past the newest: Generating, clean", s);
  await k.ev(`(genNav(-1),1)`); await k.sleep(500); s = await st(k);
  t.ok(s.pic === "browse" && s.browse === ids[1], "← from the empty frame: the newest", s);
  await k.ev(`(showView("queue"),1)`); await k.sleep(300); await k.ev(`(showView("gen"),1)`); await k.sleep(300); s = await st(k);
  t.ok(s.pic === "browse" && s.browse === ids[1], "Queue and back: the same state", s);
  await k.ev(`($("bclose").click(),1)`); await k.sleep(400); s = await st(k);
  t.ok(s.pic === "empty" && s.tab === "gen", "✕ in the Gallery: Generating, clean", s);
}
tabsAndArrows.opts = { step: 0.05 };

/* a reference stays through a running render and its finish (rule 3, Q1); Start lets it go (rule 2) */
export async function referenceHolds(k, t) {
  await k.job("[fill:dc2828] one", { steps: 2 }); await done(k, 1);
  await k.job("[fill:2828dc] elsewhere", { steps: 4 }); await k.until(`!!current()`, 20000, 50);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`); await k.sleep(500);
  await k.ev(`($("pkPrompt").click(),1)`); await k.sleep(500);
  let s = await st(k);
  t.ok(s.pic === "still" && s.still === "reference" && s.tab === "gen" && s.peek == null, "Reuse: Generating, the picture as your reference", s);
  t.ok(await k.ev(`P.value.includes("one")`), "your draft is now its prompt");
  await k.until(`current()&&current().preview_rev>0`, 20000, 100); await k.sleep(300); s = await st(k);
  t.ok(s.pic === "still" && s.still === "reference", "a job renders (with previews): the reference stays", s);
  t.ok(await k.ev(`!$("frame").classList.contains("running")`), "no cover over it");
  await done(k, 2); await k.sleep(1500); s = await st(k);
  t.ok(s.pic === "still" && s.still === "reference" && s.sid === (await k.ev(`doneList()[0].id`)), "it finishes: still your reference", s);
  t.ok(/^#\d+ finished$/.test(await k.ev(`$("ptxt").textContent`)) && await k.ev(`!document.body.classList.contains("norow")`), "the status row says the new one finished", await k.ev(`$("ptxt").textContent`));
  await k.ev(`($("prog").click(),1)`); await k.sleep(500); s = await st(k);
  t.ok(s.pic === "browse" && s.browse === (await k.ev(`lastDone().id`)), "clicking it: the new picture, in the Gallery", s);
  // Start from a reference: it holds until the render has a picture, then gives way
  await k.ev(`($("pkPrompt").click(),1)`); await k.sleep(400);
  await k.ev(`(P.value="[fill:28dc28] go",draft=P.value,1)`); await k.ev(`addJobs().then(()=>1)`);
  s = await st(k); t.ok(s.pic === "still" && s.still === "result", "Start: the picture stays for now (it gives way like a result)", s);
  t.ok(await k.until(`document.body.dataset.pic==="live"`, 15000, 100), "…and the render takes over once it has a picture");
}
referenceHolds.opts = { step: 1 };

/* clicking the render peeks its prompt; your draft comes back with ✕ / Esc; the status row says when the render
   isn't your draft */
export async function peekTheRender(k, t) {
  await k.job("[fill:dc2828] the render's prompt", { steps: 8 }); await k.until(`current()&&current().preview_rev>0`, 20000, 100);
  await k.ev(`(P.value="something else entirely",draft=P.value,1)`); await k.sleep(600);
  t.ok(/another prompt/.test(await k.ev(`$("ptxt").innerHTML`)), "the status row: the render isn't your draft", await k.ev(`$("ptxt").innerHTML`));
  const f = await k.rect("#frame"); await k.click(f.left + f.width / 2, f.top + f.height / 2); await k.sleep(400);
  let s = await st(k);
  t.ok(s.pic === "live" && s.peek === (await k.ev(`current().id`)) && await k.ev(`P.value.includes("the render's prompt")`), "click the render: its prompt in the box", s);
  t.ok(!(await k.ev(`$("viewer").classList.contains("show")`)), "(not the full-size viewer)");
  await k.ev(`($("pkX").click(),1)`); await k.sleep(300); s = await st(k);
  t.ok(s.peek == null && await k.ev(`P.value==="something else entirely"`), "✕: your draft back", s);
  await k.ev(`(P.value="[fill:dc2828] the render's prompt",draft=P.value,1)`); await k.sleep(400);
  t.ok(!/another prompt/.test(await k.ev(`$("ptxt").innerHTML`)), "the same prompt: no note");
}
peekTheRender.opts = { step: 1.2 };

/* size / ratio: a result clears (the frame previews the new shape), a reference stays (Q2); Del on a still */
export async function shapeAndDelete(k, t) {
  await k.job("[fill:dc2828] one", { steps: 2 }); await done(k, 1); await k.sleep(400);
  await k.ev(`($("pAR").click(),1)`); await k.sleep(200); await k.ev(`(document.querySelector('#popAR .rt[data-v="16:9"]').click(),1)`); await k.sleep(400);
  let s = await st(k); t.ok(s.pic === "empty", "a result + a new ratio: the empty frame shows the next shape", s);
  await tab(k, "gallery"); await k.sleep(400); await k.ev(`($("pkPrompt").click(),1)`); await k.sleep(400);
  await k.ev(`($("pAR").click(),1)`); await k.sleep(200); await k.ev(`(document.querySelector('#popAR .rt[data-v="1:1"]').click(),1)`); await k.sleep(400);
  s = await st(k); t.ok(s.pic === "still" && s.still === "reference", "a reference + a new ratio: it stays", s);
  await k.ev(`(document.activeElement.blur(),document.dispatchEvent(new KeyboardEvent("keydown",{key:"Delete",bubbles:true})),1)`); await k.sleep(800);
  s = await st(k); t.ok(s.pic === "empty" && !s.has, "Del on a still: to the Recycle Bin, the frame clean", s);
}
shapeAndDelete.opts = { step: 0.05 };

/* the queue rows and a restart */
export async function rowsAndRestart(k, t) {
  await k.job("[fill:dc2828] one", { steps: 2 }); await done(k, 1);
  await k.job("[fill:2828dc] two", { steps: 30 }); await k.until(`!!current()`, 20000, 100);
  await k.ev(`(showView("queue"),1)`); await k.sleep(400);
  await k.ev(`(document.querySelector('.qi[data-id="'+doneList()[0].id+'"]').click(),1)`); await k.sleep(500);
  let s = await st(k); t.ok(s.pic === "browse" && s.tab === "gallery", "a finished row: the Gallery at it", s);
  await k.ev(`(showView("queue"),1)`); await k.sleep(400);
  await k.ev(`(document.querySelector('.qi[data-id="'+current().id+'"]').click(),1)`); await k.sleep(500);
  s = await st(k); t.ok(s.pic === "live" && s.peek === (await k.ev(`current().id`)), "the running row: the render, with its prompt", s);
  await k.ev(`(stopJob(current()),1)`); await k.until(`!current()`, 20000, 200);
  await k.ev(`(peekHide(),1)`); await k.ev(`(PV.still={id:doneList()[0].id,kind:"result"},pvSync(),1)`); await k.sleep(800);   // the last result on show…
  await k.send("Page.reload"); await k.sleep(500); await k.until(`!!(window.LIVE&&window._jobsReady)`, 20000, 100); await k.sleep(800);
  s = await st(k); t.ok(s.pic === "still" && s.still === "result", "…comes back after a restart", s);
  await k.ev(`($("bclose").click(),1)`); await k.sleep(800);
  await k.send("Page.reload"); await k.sleep(500); await k.until(`!!(window.LIVE&&window._jobsReady)`, 20000, 100); await k.sleep(800);
  s = await st(k); t.ok(s.pic === "empty", "closed, it stays closed after a restart", s);
}
rowsAndRestart.opts = { step: 0.5 };

/* the Generating tab is the live view: over a reference, while a job renders, it shows the render */
export async function generatingTabIsLive(k, t) {
  await k.job("[fill:dc2828] one", { steps: 2 }); await done(k, 1);
  await k.job("[fill:2828dc] two", { steps: 8 }); await k.until(`current()&&current().preview_rev>0`, 20000, 100);
  await tab(k, "gallery"); await k.sleep(400); await k.ev(`($("pkPrompt").click(),1)`); await k.sleep(400);
  t.ok((await st(k)).still === "reference", "a reference over the running render");
  await tab(k, "gen"); await k.sleep(500); const s = await st(k);
  t.ok(s.pic === "live" && s.draft, "the Generating tab: the render, your draft kept", s);
  await k.sleep(800);
  t.ok(await k.ev(`document.querySelector(".trw").style.getPropertyValue("--ko").startsWith("url(")`), "the ring has its knockout round the letters");
}
generatingTabIsLive.opts = { step: 1 };

/* Start in the Gallery = Vary: the picture again with a new seed; your draft untouched, you stay in the Gallery */
export async function startVaries(k, t) {
  await k.job("[fill:dc2828] the original", { steps: 2, name: "Fox" }); await done(k, 1);
  await k.ev(`(P.value="my draft",draft=P.value,1)`);
  await tab(k, "gallery"); await k.sleep(500);
  const src = await k.ev(`({id:lastDone().id,seed:lastDone().seed,prompt:lastDone().prompt,name:lastDone().name})`);
  t.ok(await k.ev(`!$("play").classList.contains("off")&&/^Vary/.test($("play").dataset.tip)`), "in the Gallery Start is live: it says Vary");
  await k.ev(`($("play").click(),1)`); await k.until(`jobs.length>=2`, 8000, 100);
  const nj = await k.ev(`(()=>{const j=jobs.find(x=>x.id!==${src.id});return{prompt:j.prompt,seed:j.seed,name:j.name}})()`);
  t.ok(nj.prompt === src.prompt && nj.name === src.name, "the same prompt and series", { src, nj });
  t.ok(nj.seed !== src.seed, "a new seed", { src, nj });
  const s = await st(k); t.ok(s.pic === "browse" && s.browse === src.id, "you stay on the picture in the Gallery", s);
  t.ok(await k.ev(`draft==="my draft"`), "your draft untouched");
  t.ok(/^Variation of #\d+ queued/.test(await k.ev(`$("toastMsg").textContent`)), "it says so, with Undo");
}
startVaries.opts = { step: 0.5 };
