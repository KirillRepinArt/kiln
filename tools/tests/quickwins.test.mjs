// Phase 1 quick wins: notifications, Send to prompt / Keep seed, the start line, Stop, reopen note, About, shortcuts.
const done = (k, n = 1) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);

export async function neutralNotifications(k, t) {
  await k.ev(`(window._notes=[],window.Notification=function(title,o){_notes.push([title,o&&o.body])},Notification.permission="granted",1)`);
  await k.job("a secret prompt about a fox", { name: "Secret Series", steps: 2 }); await done(k);
  const n = await k.ev(`_notes`);
  t.ok(n.length === 1, "one notification", n);
  t.ok(n.length && !/fox|secret/i.test(JSON.stringify(n)), "it names neither the prompt nor the series", n);
}

export async function sendToPrompt(k, t) {
  await k.job("a grey wolf", { name: "Wolf Pack", steps: 2 }); await done(k);
  const load = `fetch("/files/"+encodeURIComponent(lastDone().file)).then(r=>r.blob()).then(b=>readPng(new File([b],lastDone().file,{type:"image/png"}))).then(()=>1)`;
  await k.ev(`(showView("png"),S.keepSeed=false,keepSeedUI(),1)`); await k.ev(load);
  await k.ev(`($("pSend").click(),1)`);
  t.ok(await k.ev(`S.view`) === "gen", "Send to prompt switches to Generating");
  t.ok(await k.ev(`S.seedMode`) === "random", "Keep seed off: a new random seed");
  t.ok(await k.ev(`(S.set||{}).cfg`) === "1.0" || await k.ev(`(S.set||{}).cfg`) === "1", "CFG comes along", await k.ev(`(S.set||{}).cfg`));
  t.ok(/Euler/.test(await k.ev(`(S.set||{}).sampler`)), "sampler comes along", await k.ev(`(S.set||{}).sampler`));
  await k.ev(`(showView("png"),$("pKeep").click(),1)`); t.ok(await k.ev(`S.keepSeed`) === true, "the switch turns Keep seed on");
  await k.ev(`($("pSend").click(),1)`);
  t.ok(await k.ev(`S.seedMode==="fixed"&&S.seed===lastDone().seed`), "Keep seed on: the image's seed");
}

export async function reuseKeepSeed(k, t) {
  await k.job("a grey wolf", { steps: 2 }); await done(k);
  await k.ev(`(S.keepSeed=false,S.seedMode="random",S.steps=7,P.value="other",draft="other",loadJob(lastDone()),1)`);
  t.ok(await k.ev(`$("pkSeed").style.display!=="none"`), "the seed lock shows next to Reuse all");
  await k.ev(`($("pkAll").click(),1)`);
  t.ok(await k.ev(`S.steps===2&&S.seedMode==="random"`), "Reuse all, Keep seed off: its settings, a new seed");
  await k.ev(`(loadJob(lastDone()),$("pkSeed").click(),$("pkAll").click(),1)`);
  t.ok(await k.ev(`S.seedMode==="fixed"&&S.seed===lastDone().seed`), "lock on: its seed too");
}

export async function startLine(k, t) {
  await k.job("a fox", { steps: 3 });
  await k.until(`!!current()`, 5000);
  const txt = await k.ev(`$("ptxt").textContent`);
  t.ok(/…\s*· (loading model|starting)/.test(txt), "before the first step: a word + the real state", txt);
  await k.until(`current()&&current().step>=1`, 10000);
  t.ok(/^Step \d\/3$/.test(await k.ev(`$("ptxt").textContent`)), "then the steps");
}
startLine.opts = { step: 2 };

export async function stopping(k, t) {
  await k.job("an owl", { steps: 5 }); await k.until(`current()&&current().step>=1`, 15000);
  const s = await k.rect("#stopBtn"); t.ok(s.height >= 34, "Stop is a proper button", s.height);
  await k.ev(`($("stopBtn").click(),1)`); await k.sleep(300);
  t.ok(await k.ev(`$("prog").classList.contains("stopping")`), "the bar freezes and greys at once");
  t.ok(/Stopping after this step/.test(await k.ev(`$("ptxt").textContent`)), "and says when it will stop");
  t.ok(await k.until(`!current()`, 15000), "the job stops");
  t.ok(!(await k.ev(`$("prog").classList.contains("stopping")`)), "the status row goes back to normal");
}
stopping.opts = { step: 3 };

export async function finishedWhileClosed(k, t) {
  await k.job("a fox", { steps: 2 }); await done(k);
  await k.ev(`(S.seenDone=0,save(),1)`);                    // as if the window had closed before this job finished
  await k.send("Page.reload", {}); await k.sleep(800); await k.until("!!(window.LIVE&&window._jobsReady)", 15000); await k.sleep(1600);
  t.ok(/1 image finished while Kiln was closed/.test(await k.ev(`$("toastMsg").textContent`)), "a note on reopening", await k.ev(`$("toastMsg").textContent`));
}

export async function updateCheck(k, t) {
  t.ok(/Kiln \d/.test(await k.ev(`$("aboutV").textContent`)), "Settings shows the version");
  await k.ev(`($("updBtn").click(),1)`);
  t.ok(await k.until(`/v9\\.2 is available/.test($("updRes").textContent)`, 8000), "a newer tag is reported (fake GitHub)", await k.ev(`$("updRes").textContent`));
  t.ok(!k.requests.some(r => /github/.test(r.url)), "the page itself never calls GitHub (the server does, only on request)");
}

export async function shortcuts(k, t) {
  await k.ev(`(document.activeElement.blur(),1)`);
  await k.ev(`(document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"?",bubbles:true})),1)`);
  t.ok(await k.ev(`$("keys").classList.contains("show")`), "? opens the shortcut sheet");
  t.ok(await k.ev(`$("keys").textContent.includes("F9")`), "it lists F9");
  await k.ev(`(document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})),1)`);
  t.ok(!(await k.ev(`$("keys").classList.contains("show")`)), "Esc closes it");
  await k.ev(`(P.focus(),1)`); await k.key("?");
  t.ok(!(await k.ev(`$("keys").classList.contains("show")`)), "typing ? in the prompt doesn't open it");
}

export async function categoryTips(k, t) {
  await k.ev(`(showView("loras"),1)`);
  t.ok(/folder/.test(await k.ev(`document.querySelector('#fchips [data-f="people"]').dataset.tip||""`)), "Faces explains it comes from folders");
}
