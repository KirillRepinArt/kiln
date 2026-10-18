// Phase 1 queue items: pause, delete with undo, remove from list, times, renaming waiting jobs, previews, upscale
// jumping the line, missing files.
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
const done = (k, n = 1) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 40000);
const state = k => k.ev(`fetch("/api/state").then(r=>r.json())`);

export async function pauseAfterCurrent(k, t) {
  await k.job("one", { steps: 3 }); await k.job("two", { steps: 2 }); await k.until(`!!current()`, 8000);
  await k.ev(`(setPaused(true),1)`); await k.sleep(400);
  t.ok((await state(k)).paused === true, "the server is paused");
  await k.until(`!current()`, 20000); await k.sleep(3000);
  t.ok(await k.ev(`jobs.filter(j=>j.status==="pending").length`) === 1, "the current image finished, the next didn't start");
  t.ok(/Queue paused/.test(await k.ev(`$("ptxt").textContent`)), "the status row says so");
  t.ok(/^Paused/.test(await k.ev(`document.title`)), "and the window title");
  t.ok(await k.ev(`getComputedStyle($("resumeBtn")).display!=="none"`), "Resume shows in the status row");
  await k.ev(`($("resumeBtn").click(),1)`);
  t.ok(await done(k, 2), "Resume runs the rest");
}

export async function deleteAndUndo(k, t) {
  await k.job("[fill:dc2828] keep me", { steps: 2, name: "Del Test" }); await done(k);
  const file = await k.ev(`lastDone().file`), path = join(k.out, file);
  await k.ev(`(document.activeElement.blur(),1)`);
  await k.ev(`(document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Delete",bubbles:true})),1)`); await k.sleep(800);
  t.ok(!existsSync(path), "Del: the file leaves the output folder");
  t.ok(/Recycle Bin/.test(await k.ev(`$("toastMsg").textContent`)), "an Undo toast", await k.ev(`$("toastMsg").textContent`));
  t.ok(await k.ev(`!jobs.some(j=>j.file===${JSON.stringify(file)})`), "and it leaves the list");
  await k.ev(`($("toastBtn").click(),1)`); await k.sleep(1200);
  t.ok(existsSync(path), "Undo brings the file back");
  t.ok(await k.ev(`jobs.some(j=>j.file===${JSON.stringify(file)}&&j.status==="done")`), "and the entry");
  await k.ev(`(deleteJob(lastDone()),1)`); await k.sleep(13500);   // past the undo window
  t.ok(!existsSync(path) && !(await state(k)).jobs.some(j => j.file === file), "after 12 s it's gone for good (Recycle Bin)");
}
deleteAndUndo.opts = { step: 0.4 };

export async function removeFromList(k, t) {
  await k.job("a fox", { steps: 2 }); await done(k);
  const file = await k.ev(`lastDone().file`);
  await k.ev(`(showView("queue"),1)`); await k.sleep(300);
  await k.ev(`(document.querySelector("[data-rm]").click(),1)`); await k.sleep(1000);
  t.ok(await k.ev(`!jobs.some(j=>j.status==="done")`), "✕ on a finished row removes it from the list");
  t.ok(existsSync(join(k.out, file)), "the file stays");
}

export async function timesAndRename(k, t) {
  await k.ev(`(setPaused(true),1)`); await k.sleep(300);
  await k.job("waiting job", { steps: 2 });
  await k.ev(`(showView("queue"),1)`); await k.until(`!!document.querySelector(".qi")`, 4000);
  t.ok(/added \d\d?:\d\d/.test(await k.ev(`document.querySelector(".qi .times").textContent`)), "rows say when they were added");
  await k.ev(`(loadJob(jobs.find(j=>j.status==="pending")),1)`);
  t.ok(!(await k.ev(`$("pname").readOnly`)), "a waiting job's name is editable in its peek");
  await k.ev(`(()=>{const n=$("pname");n.value="Renamed Series";n.dispatchEvent(new Event("input"));return 1})()`);
  t.ok(await k.ev(`$("pnSave").classList.contains("show")`), "Save name appears");
  await k.ev(`($("pnSave").click(),1)`); await k.sleep(1200);
  t.ok(await k.ev(`jobs.find(j=>j.status==="pending").name`) === "Renamed Series", "saved on the server");
  t.ok(await k.ev(`S.pname`) === "", "your draft's own name is untouched");
  await k.ev(`(endPeek(),setPaused(false),1)`); await done(k);
  t.ok(await k.ev(`lastDone().file`) === "renamed-series-001.png", "the file gets the new name", await k.ev(`lastDone().file`));
  await k.ev(`(showView("queue"),1)`); await k.sleep(300);
  t.ok(/done \d\d?:\d\d · took/.test(await k.ev(`document.querySelector(".qi .times").textContent`)), "finished rows: done + took");
}

export async function previews(k, t) {
  await k.job("a fox", { steps: 2 }); await done(k);
  await k.job("an owl", { steps: 6 }); await k.ev(`(showView("queue"),1)`);
  t.ok(await k.until(`(()=>{const i=document.querySelector("img.lp");return i&&i.naturalWidth>0})()`, 12000), "the running row shows the live render");
  const r = await k.ev(`JSON.parse(JSON.stringify(document.querySelector(".qi canvas[data-th]").getBoundingClientRect()))`);
  await k.mouse(r.x + r.width / 2, r.y + r.height / 2); await k.sleep(700);
  t.ok(await k.ev(`$("qpop").classList.contains("show")&&$("qpop").offsetWidth>=200`), "hovering a finished thumbnail shows it bigger");
  await k.mouse(2, 2); await k.ev(`(stopJob(current()),1)`); await k.until(`!current()`, 15000);
  await k.ev(`(showView("gen"),setTimeout(()=>{},0),1)`);

}
previews.opts = { step: 0.8 };

export async function upscaleJumpsLine(k, t) {
  await k.job("first", { steps: 2 }); await done(k);
  await k.ev(`(setPaused(true),1)`); await k.sleep(300);
  await k.job("waiting A", { steps: 2 }); await k.job("waiting B", { steps: 2 });
  await k.ev(`fetch("/api/upscale",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:lastDone().id,upscaler:"R-ESRGAN 4x+",scale:2})}).then(()=>1)`);
  const order = (await state(k)).jobs.filter(j => j.status === "pending").map(j => j.kind);
  t.ok(order[0] === "upscale", "the upscale waits at the front of the line", order);
}

export async function missingFiles(k, t) {
  await k.job("a fox", { steps: 2 }); await done(k); await k.job("an owl", { steps: 2 }); await done(k, 2);
  unlinkSync(join(k.out, await k.ev(`jobs.filter(j=>j.status==="done")[0].file`)));
  await k.ev(`(showView("queue"),1)`);
  t.ok(await k.until(`!!document.querySelector(".qi.missing")`, 5000), "a file deleted on disk shows greyed, 'file deleted'");
  t.ok(await k.ev(`!!document.querySelector(".qi.missing [data-rm]")`), "a missing row has its own ✕");
  t.ok(await k.ev(`getComputedStyle(document.querySelector(".qi.missing [data-rm]")).opacity`) === "1", "…not dimmed with the row");
  await k.ev(`(document.querySelector(".qi.missing [data-rm]").click(),1)`); await k.sleep(1200);
  t.ok(await k.ev(`jobs.filter(j=>j.status==="done").length`) === 1, "✕ on a missing row removes it");
  await k.job("a bear", { steps: 2 }); await done(k, 2);
  unlinkSync(join(k.out, await k.ev(`lastDone().file`))); await k.until(`!!document.querySelector(".qi.missing")`, 5000);
  await k.ev(`($("rmMissing").click(),1)`); await k.sleep(1200);
  t.ok(await k.ev(`jobs.filter(j=>j.status==="done").length`) === 1, "Remove missing clears all of those at once");
}
