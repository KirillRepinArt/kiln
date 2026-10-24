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
  await click(k, ids[0], { ctrl: true }); await k.sleep(200);
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
