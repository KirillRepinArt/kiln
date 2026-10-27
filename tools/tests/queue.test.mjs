// Phase 1 queue items: pause, delete with undo, remove from list, times, renaming waiting jobs, previews, upscale
// jumping the line, missing files.
import { existsSync } from "node:fs";
import { join } from "node:path";
const done = (k, n = 1) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 40000);
const state = k => k.ev(`fetch("/api/state").then(r=>r.json())`);

export async function pauseAfterCurrent(k, t) {
  await k.job("one", { steps: 3 });
  await k.job("two", { steps: 2 });
  await k.until(`!!current()`, 8000);
  await k.ev(`(setPaused(true),1)`);
  await k.until(`fetch("/api/state").then(r=>r.json()).then(s=>s.paused===true)`, 5000, 150);
  t.ok((await state(k)).paused === true, "the server is paused");
  await k.until(`!current()`, 20000);
  await k.sleep(3000);
  t.ok(
    (await k.ev(`jobs.filter(j=>j.status==="pending").length`)) === 1,
    "the current image finished, the next didn't start",
  );
  t.ok(/Queue paused/.test(await k.ev(`$("ptxt").textContent`)), "the status row says so");
  t.ok(/^Paused/.test(await k.ev(`document.title`)), "and the window title");
  t.ok(await k.ev(`getComputedStyle($("resumeBtn")).display!=="none"`), "Resume shows in the status row");
  await k.ev(`($("resumeBtn").click(),1)`);
  t.ok(await done(k, 2), "Resume runs the rest");
}

export async function deleteAndUndo(k, t) {
  await k.job("[fill:dc2828] keep me", { steps: 2, name: "Del Test" });
  await done(k);
  const file = await k.ev(`lastDone().file`),
    path = join(k.out, file);
  await k.ev(`(document.activeElement.blur(),1)`);
  await k.ev(`(document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Delete",bubbles:true})),1)`);
  await k.sleep(800);
  t.ok(!existsSync(path), "Del: the file leaves the output folder");
  t.ok(
    /Recycle Bin/.test(await k.ev(`$("toastMsg").textContent`)),
    "an Undo toast",
    await k.ev(`$("toastMsg").textContent`),
  );
  t.ok(await k.ev(`!jobs.some(j=>j.file===${JSON.stringify(file)})`), "and it leaves the list");
  await k.ev(`($("toastBtn").click(),1)`);
  await k.sleep(1200);
  t.ok(existsSync(path), "Undo brings the file back");
  t.ok(await k.ev(`jobs.some(j=>j.file===${JSON.stringify(file)}&&j.status==="done")`), "and the entry");
  await k.ev(`(deleteJob(lastDone()),1)`);
  await k.sleep(13500); // past the undo window
  t.ok(
    !existsSync(path) && !(await state(k)).jobs.some(j => j.file === file),
    "after 12 s it's gone for good (Recycle Bin)",
  );
}
deleteAndUndo.opts = { step: 0.4 };

export async function removeFromList(k, t) {
  await k.job("a fox", { steps: 2 });
  await done(k);
  const file = await k.ev(`lastDone().file`);
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(300);
  await k.ev(`(document.querySelector("[data-rm]").click(),1)`);
  await k.sleep(1000);
  t.ok(await k.ev(`!jobs.some(j=>j.status==="done")`), "✕ on a finished row removes it from the list");
  t.ok(existsSync(join(k.out, file)), "the file stays");
}

export async function timesAndRename(k, t) {
  await k.ev(`(setPaused(true),1)`);
  await k.sleep(300);
  await k.job("waiting job", { steps: 2 });
  await k.ev(`(showView("queue"),1)`);
  await k.until(`!!document.querySelector(".qi")`, 4000);
  t.ok(
    /added \d\d?:\d\d/.test(await k.ev(`document.querySelector(".qi .times").textContent`)),
    "rows say when they were added",
  );
  await k.ev(`(loadJob(jobs.find(j=>j.status==="pending")),1)`);
  t.ok(!(await k.ev(`$("pname").readOnly`)), "a waiting job's name is editable in its peek");
  await k.ev(`(()=>{const n=$("pname");n.value="Renamed Series";n.dispatchEvent(new Event("input"));return 1})()`);
  t.ok(await k.ev(`$("pnSave").classList.contains("show")`), "Save name appears");
  await k.ev(`($("pnSave").click(),1)`);
  await k.sleep(1200);
  t.ok((await k.ev(`jobs.find(j=>j.status==="pending").name`)) === "Renamed Series", "saved on the server");
  t.ok((await k.ev(`S.pname`)) === "", "your draft's own name is untouched");
  await k.ev(`(endPeek(),setPaused(false),1)`);
  await done(k);
  t.ok(
    (await k.ev(`lastDone().file`)) === "renamed-series-001.png",
    "the file gets the new name",
    await k.ev(`lastDone().file`),
  );
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(300);
  t.ok(
    /done \d\d?:\d\d · took/.test(await k.ev(`document.querySelector(".qi .times").textContent`)),
    "finished rows: done + took",
  );
}

export async function previews(k, t) {
  await k.job("a fox", { steps: 2 });
  await done(k);
  await k.job("an owl", { steps: 6 });
  await k.ev(`(showView("queue"),1)`);
  t.ok(
    await k.until(`(()=>{const i=document.querySelector("img.lp");return i&&i.naturalWidth>0})()`, 12000),
    "the running row shows the live render",
  );
  const r = await k.ev(`JSON.parse(JSON.stringify(document.querySelector(".qi img.qt").getBoundingClientRect()))`);
  await k.mouse(r.x + r.width / 2, r.y + r.height / 2);
  await k.sleep(700);
  t.ok(
    await k.ev(`$("qpop").classList.contains("show")&&$("qpop").offsetWidth>=200`),
    "hovering a finished thumbnail shows it bigger",
  );
  const pr = await k.ev(
    `(()=>{const p=$("qpop").getBoundingClientRect(),row=document.querySelector(".qi img.qt").closest(".qi").getBoundingClientRect(),w=$("qwrap").getBoundingClientRect();return{p:[p.left,p.top,p.right,p.bottom],row:[row.top,row.bottom],w:[w.left,w.right]}})()`,
  );
  t.ok(
    pr.p[3] <= pr.row[0] + 1 || pr.p[1] >= pr.row[1] - 1,
    "it never covers the row you're pointing at (above it, or below)",
    pr,
  );
  t.ok(pr.p[0] >= pr.w[0] - 1 && pr.p[2] <= pr.w[1] + 1, "and stays inside the Queue panel", pr);
  await k.mouse(2, 2);
  await k.ev(`(stopJob(current()),1)`);
  await k.until(`!current()`, 15000);
  await k.ev(`(showView("gen"),setTimeout(()=>{},0),1)`);
}
previews.opts = { step: 0.8 };

export async function upscaleJumpsLine(k, t) {
  await k.job("first", { steps: 2 });
  await done(k);
  await k.ev(`(setPaused(true),1)`);
  await k.sleep(300);
  await k.job("waiting A", { steps: 2 });
  await k.job("waiting B", { steps: 2 });
  await k.ev(
    `fetch("/api/upscale",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:lastDone().id,upscaler:"R-ESRGAN 4x+",scale:2})}).then(()=>1)`,
  );
  const order = (await state(k)).jobs.filter(j => j.status === "pending").map(j => j.kind);
  t.ok(order[0] === "upscale", "the upscale waits at the front of the line", order);
}

export async function missingFiles(k, t) {
  await k.job("a fox", { steps: 2 });
  await done(k);
  await k.job("an owl", { steps: 2 });
  await done(k, 2);
  k.rm(join(k.out, await k.ev(`jobs.filter(j=>j.status==="done")[0].file`)));
  await k.ev(`(showView("queue"),1)`);
  t.ok(
    await k.until(`!!document.querySelector(".qi.missing")`, 5000),
    "a file deleted on disk shows greyed, 'file deleted'",
  );
  t.ok(await k.ev(`!!document.querySelector(".qi.missing [data-rm]")`), "a missing row has its own ✕");
  t.ok(
    (await k.ev(`getComputedStyle(document.querySelector(".qi.missing [data-rm]")).opacity`)) === "1",
    "…not dimmed with the row",
  );
  await k.ev(`(document.querySelector(".qi.missing [data-rm]").click(),1)`);
  await k.sleep(1200);
  t.ok((await k.ev(`jobs.filter(j=>j.status==="done").length`)) === 1, "✕ on a missing row removes it");
  await k.job("a bear", { steps: 2 });
  await done(k, 2);
  k.rm(join(k.out, await k.ev(`lastDone().file`)));
  await k.until(`!!document.querySelector(".qi.missing")`, 5000);
  await k.ev(`($("rmMissing").click(),1)`);
  await k.sleep(1200);
  t.ok((await k.ev(`jobs.filter(j=>j.status==="done").length`)) === 1, "Remove missing clears all of those at once");
}

export async function thumbnailsDraw(k, t) {
  await k.job("[fill:dc2828] red", { steps: 2 });
  await k.until(`jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(1500);
  await k.until(
    `(()=>{const i=document.querySelector(".qi img.qt");return i&&i.complete&&i.naturalWidth>0})()`,
    8000,
    100,
  );
  const px = await k.ev(
    `(()=>{const i=document.querySelector(".qi img.qt");if(!i||!i.naturalWidth)return "no thumbnail";const c=document.createElement("canvas");c.width=c.height=8;const g=c.getContext("2d");g.drawImage(i,0,0,8,8);const d=g.getImageData(4,4,1,1).data;return [d[0],d[1],d[2]]})()`,
  );
  t.ok(Array.isArray(px) && px[0] > 150 && px[1] < 90, "a finished row's thumbnail shows the picture", px);
  t.ok(
    await k.until(`fetch("/qthumbs/"+lastDone().id+".jpg").then(r=>r.ok)`, 6000, 300),
    "…a small file the server keeps (made once)",
  );
  t.ok(
    await k.ev(`performance.getEntriesByType("resource").filter(e=>e.name.includes("/qthumbs/")).length>0`),
    "the row loads that file, not the full picture",
  );
}

/* reorder = pick up the plate (2026-10-27): the row itself lifts and follows the pointer (one copy, no ghost), its
   footprint travels through the list, letting go settles it there; Esc puts it back; a press without
   moving is still a click (its prompt) */
export async function pickUpThePlate(k, t) {
  await k.job("[fill:2828dc] running", { steps: 60 });
  await k.until(`!!current()`, 15000, 50);
  for (const n of ["a", "b", "c", "d"]) await k.job(n, { steps: 2 });
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(800);
  const order = () =>
    k.ev(`[...document.querySelectorAll("#qsPend .qi")].map(r=>r.querySelector(".p").textContent.trim())`);
  const server = () => k.ev(`api("/api/state").then(s=>s.jobs.filter(j=>j.status==="pending").map(j=>j.spec.raw))`);
  t.ok((await order()).join() === "a,b,c,d", "four waiting", await order());
  const rows = await k.ev(
    `[...document.querySelectorAll("#qsPend .qi")].map(r=>{const b=r.getBoundingClientRect();return{top:b.top,h:b.height,left:b.left}})`,
  );
  const x = rows[0].left + 80,
    y = rows[0].top + rows[0].h / 2,
    step = rows[1].top - rows[0].top;
  // hold "a" and carry it below "c"
  await k.press(x, y);
  await k.drag(x, y, x, y + 2.2 * step, 16);
  await k.sleep(500);
  const held = await k.ev(`(()=>{const l=document.querySelector(".qi.lifted"),s=document.querySelector(".qslot");
    return{lifted:!!l,copies:document.querySelectorAll('.qi[data-id="'+(l&&l.dataset.id)+'"]').length,
      clones:document.querySelectorAll(".qi").length,slot:!!s,
      order:[...document.querySelector("#qsPend").children].filter(e=>e.matches(".qi:not(.lifted),.qslot")).map(e=>e.classList.contains("qslot")?"_":e.querySelector(".p").textContent.trim()),
      rowTop:l&&l.getBoundingClientRect().top,
      line:!!s&&getComputedStyle(s).borderTopStyle,fill:!!s&&getComputedStyle(s).backgroundColor}})()`);
  await k.shot("held");
  t.ok(held.lifted && held.copies === 1, "the row itself is lifted: one copy, no ghost", held);
  t.ok(held.order.join() === "b,c,_,d", "the footprint travels to where it would land (after c)", held);
  t.ok(
    held.line === "dashed" && held.fill === "rgba(0, 0, 0, 0)",
    "…its footprint: the dashed line on its edge, nothing inside",
    held,
  );
  t.near(held.rowTop, rows[0].top + 2.2 * step, 6, "the row follows the pointer", held);
  await k.release(x, y + 2.2 * step);
  await k.sleep(1500);
  t.ok((await order()).join() === "b,c,a,d", "let go: it settles there", await order());
  t.ok(!(await k.ev(`!!document.querySelector(".qi.lifted,.qi.settling,.qslot")`)), "…no plate or lifted row left");
  t.ok((await server()).join() === "b,c,a,d", "…and the server has the new order", await server());
  // Esc: back where it was
  const r2 = await k.ev(
    `(()=>{const r=document.querySelectorAll("#qsPend .qi")[3].getBoundingClientRect();return{top:r.top,h:r.height,left:r.left}})()`,
  );
  const y2 = r2.top + r2.h / 2;
  await k.press(x, y2);
  await k.drag(x, y2, x, y2 - 2 * step, 12);
  await k.sleep(300);
  await k.key("Escape");
  await k.sleep(900);
  await k.release(x, y2 - 2 * step);
  await k.sleep(800);
  t.ok((await order()).join() === "b,c,a,d", "Esc: it goes back where it was", await order());
  t.ok((await server()).join() === "b,c,a,d", "…the order unchanged", await server());
  // a press without moving: a click (its prompt in the box)
  const r3 = await k.rect("#qsPend .qi");
  await k.click(r3.left + 80, r3.top + r3.height / 2);
  await k.sleep(400);
  t.ok(
    await k.ev(`peekJob&&peekJob.raw==="b"`),
    "a press without moving is a click: its prompt",
    await k.ev(`peekJob&&peekJob.raw`),
  );
}
pickUpThePlate.opts = { step: 1 };
