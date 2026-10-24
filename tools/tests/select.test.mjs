// Selecting finished pictures in the Queue: Ctrl-click, Shift-click a range, a plain click once selecting, the whole
// series, Ctrl+A, Esc; Delete with one Undo; Remove from list.
const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 40000);
const sel = k => k.ev(`[...QS].sort((a,b)=>a-b)`);
const row = id => `document.querySelector('.qi[data-id="${id}"]')`;
const click = (k, id, mods = {}) => k.ev(`(${row(id)}.querySelector(".p").dispatchEvent(new MouseEvent("click",{bubbles:true,ctrlKey:${!!mods.ctrl},shiftKey:${!!mods.shift}})),1)`);
const key = (k, key, ctrl) => k.ev(`(document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"${key}",ctrlKey:${!!ctrl},bubbles:true})),1)`);

export async function selecting(k, t) {
  for (const [i, n] of ["Fox", "Fox", "Owl", "Fox", "Owl", "Owl"].entries()) { await k.job(`[fill:${["dc2828", "28dc28", "2828dc"][i % 3]}] ${n}`, { steps: 2, name: n }); await done(k, i + 1) }
  const ids = await k.ev(`doneList().map(j=>j.id)`);
  await k.ev(`(document.activeElement.blur(),showView("queue"),1)`); await k.sleep(400);
  await click(k, ids[0]); await k.sleep(300);
  t.ok(await k.ev(`document.body.dataset.pic==="browse"`), "no selection: a click opens the picture, as before");
  await k.ev(`(showView("queue"),1)`); await k.sleep(300);
  const before = await k.ev(`(window.__rows=[...document.querySelectorAll(".qi")],document.querySelector(".qi").getBoundingClientRect().top)`);
  await click(k, ids[0], { ctrl: true }); await k.sleep(200);
  t.ok(await k.ev(`[...document.querySelectorAll(".qi")].every((q,i)=>q===window.__rows[i])`), "selecting doesn't rebuild the list (the same rows, nothing reloads)");
  t.near(await k.ev(`document.querySelector(".qi").getBoundingClientRect().top`), before, 0.5, "…and nothing moves (the header keeps its height)");
  t.ok(JSON.stringify(await sel(k)) === JSON.stringify([ids[0]]) && await k.ev(`!!document.querySelector(".qbar")&&/1 of 6 selected/.test(document.querySelector(".qbar").textContent)`), "Ctrl-click selects; the bar says 1 selected", await sel(k));
  t.ok(await k.ev(`/All “Fox” · 3/.test(document.querySelector(".qbar").textContent)`), "it offers the whole series");
  await k.ev(`($("qsSeries").click(),1)`); await k.sleep(200);
  t.ok(JSON.stringify(await sel(k)) === JSON.stringify([ids[0], ids[1], ids[3]]), "Select all “Fox”: the three Foxes", await sel(k));
  await click(k, ids[1]); await k.sleep(200);
  t.ok(!(await sel(k)).includes(ids[1]) && await k.ev(`S.view==="queue"`), "while selecting, a plain click toggles (it doesn't open)", await sel(k));
  await key(k, "Escape"); await k.sleep(200);
  t.ok((await sel(k)).length === 0 && await k.ev(`!document.querySelector(".qbar")`), "Esc clears the selection");
  await click(k, ids[5], { ctrl: true }); await click(k, ids[2], { shift: true }); await k.sleep(200);
  t.ok(JSON.stringify(await sel(k)) === JSON.stringify([ids[2], ids[3], ids[4], ids[5]]), "Shift-click selects the range between", await sel(k));
  await key(k, "a", true); await k.sleep(200);
  t.ok((await sel(k)).length === 6, "Ctrl+A: every finished picture", await sel(k));
  await key(k, "Delete"); await k.sleep(1200);
  t.ok(await k.ev(`doneList().length===0`), "Del: all of them to the Recycle Bin…");
  t.ok(/6 moved to the Recycle Bin/.test(await k.ev(`$("toastMsg").textContent`)) && await k.ev(`$("toastBtn").textContent==="Undo"`), "…with one Undo", await k.ev(`$("toastMsg").textContent`));
  await k.ev(`($("toastBtn").click(),1)`); await k.until(`doneList().length===6`, 6000, 100);
  t.ok(await k.ev(`doneList().length===6`), "Undo brings all six back");
  await click(k, ids[0], { ctrl: true }); await click(k, ids[1], { ctrl: true }); await k.ev(`($("qsRemove").click(),1)`); await k.sleep(1000);
  t.ok(await k.ev(`doneList().length===4`), "Remove from list: off the list (the files stay)");
  await click(k, ids[2], { ctrl: true }); await k.ev(`(showView("gen"),1)`); await k.sleep(200);
  t.ok((await sel(k)).length === 0, "leaving the Queue tab ends the selection");
}
selecting.opts = { step: 0.05 };

/* reordering the waiting jobs leaves the finished rows alone; the running row shows an hourglass until its first
   preview; "Added to queue" appears under the Queue tab */
export async function sectionsStay(k, t) {
  await k.job("[fill:dc2828] done one", { steps: 2 }); await done(k, 1);
  await k.job("[fill:2828dc] slow", { steps: 40 }); await k.until(`!!current()`, 15000, 50);
  t.ok(await k.ev(`(()=>{const r=$("toast").getBoundingClientRect(),q=document.querySelector('.tab[data-v="queue"]').getBoundingClientRect();return Math.abs((r.left+r.right)/2-(q.left+q.right)/2)<3&&r.top>q.bottom})()`), "“Added to queue” appears under the Queue tab");
  await k.job("w1", { steps: 2 }); await k.job("w2", { steps: 2 });
  await k.ev(`(showView("queue"),1)`); await k.sleep(400);
  t.ok(await k.ev(`!current().preview_rev?getComputedStyle(document.querySelector(".qi .th .hg")).display!=="none":true`), "before its first preview the running row shows an hourglass (no empty square)");
  await k.ev(`(window.__fin=[...document.querySelectorAll("#qsFin .qi")],1)`);
  await k.ev(`(()=>{const p=jobs.filter(j=>j.status==="pending"),a=jobs.indexOf(p[0]),b=jobs.indexOf(p[1]);[jobs[a],jobs[b]]=[jobs[b],jobs[a]];renderQueue();return 1})()`); await k.sleep(200);
  t.ok(await k.ev(`[...document.querySelectorAll("#qsFin .qi")].every((q,i)=>q===window.__fin[i])&&window.__fin.length>0`), "reordering the waiting jobs doesn't rebuild the finished ones");
  t.ok(await k.ev(`[...document.querySelectorAll("#qsPend .qi")].map(q=>q.querySelector(".p").textContent).join("|")`).then(x => /w2.*w1/.test(x)), "…while the waiting ones show the new order");
}
sectionsStay.opts = { step: 1 };
