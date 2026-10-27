// Phase 1 quick wins: notifications, Send to prompt / Keep seed, the start line, Stop, reopen note, About, shortcuts.
const done = (k, n = 1) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);

export async function neutralNotifications(k, t) {
  await k.ev(
    `(window._notes=[],window.Notification=function(title,o){_notes.push([title,o&&o.body])},Notification.permission="granted",1)`,
  );
  await k.job("a secret prompt about a fox", { name: "Secret Series", steps: 2 });
  await done(k);
  const n = await k.ev(`_notes`);
  t.ok(n.length === 1, "one notification", n);
  t.ok(n.length && !/fox|secret/i.test(JSON.stringify(n)), "it names neither the prompt nor the series", n);
}

export async function sendToPrompt(k, t) {
  await k.job("a grey wolf", { name: "Wolf Pack", steps: 2 });
  await done(k);
  const load = `fetch("/files/"+encodeURIComponent(lastDone().file)).then(r=>r.blob()).then(b=>readPng(new File([b],lastDone().file,{type:"image/png"}))).then(()=>1)`;
  await k.ev(`(showView("png"),S.keepSeed=false,keepSeedUI(),1)`);
  await k.ev(load);
  await k.ev(`($("pSend").click(),1)`);
  t.ok((await k.ev(`S.view`)) === "gen", "Send to prompt switches to Generating");
  t.ok((await k.ev(`S.seedMode`)) === "random", "Keep seed off: a new random seed");
  t.ok(
    (await k.ev(`(S.set||{}).cfg`)) === "1.0" || (await k.ev(`(S.set||{}).cfg`)) === "1",
    "CFG comes along",
    await k.ev(`(S.set||{}).cfg`),
  );
  t.ok(/Euler/.test(await k.ev(`(S.set||{}).sampler`)), "sampler comes along", await k.ev(`(S.set||{}).sampler`));
  await k.ev(`(showView("png"),$("pKeep").click(),1)`);
  t.ok((await k.ev(`S.keepSeed`)) === true, "the switch turns Keep seed on");
  await k.ev(`($("pSend").click(),1)`);
  t.ok(await k.ev(`S.seedMode==="fixed"&&S.seed===lastDone().seed`), "Keep seed on: the image's seed");
}

/* the seed lock lives in the Seed pill's pop-up (beside the die and copy): unlocked = random each job (the default);
   locking a shown picture's seed makes it your draft with that seed */
export async function seedLock(k, t) {
  await k.job("a grey wolf", { steps: 2 });
  await done(k);
  await k.ev(`(S.seedMode="random",S.steps=7,P.value="other",draft="other",renderPills(),1)`);
  t.ok((await k.ev(`$("vSD").textContent`)) === "Random", "unlocked: the pill says Random (no 'Fixed')");
  await k.ev(`($("pSD").click(),1)`);
  await k.ev(`($("seedLock").click(),1)`);
  t.ok(await k.ev(`S.seedMode==="fixed"&&!!$("vSD").querySelector(".lk")`), "the lock: this seed, a lock on the pill");
  await k.ev(`($("seedLock").click(),closePops(),1)`);
  t.ok(await k.ev(`S.seedMode==="random"`), "again: random each job");
  // a shown picture: its seed on the pill; locking it = the picture becomes your draft, with that seed
  await k.ev(`(loadJob(lastDone()),1)`);
  t.ok(+(await k.ev(`$("vSD").textContent`)) === (await k.ev(`lastDone().seed`)), "a shown picture: its seed");
  await k.ev(`($("pSD").click(),1)`);
  t.ok(await k.ev(`peekJob!==null&&$("popSD").classList.contains("show")`), "opening the pop-up changes nothing");
  await k.ev(`($("seedLock").click(),1)`);
  t.ok(
    await k.ev(`peekJob===null&&S.seedMode==="fixed"&&S.seed===lastDone().seed&&S.steps===2&&draft==="a grey wolf"`),
    "locking its seed: the picture is your draft, with that seed",
    await k.ev(`({peek:!!peekJob,mode:S.seedMode,steps:S.steps,draft})`),
  );
}

export async function startLine(k, t) {
  await k.job("a fox", { steps: 3 });
  const ok = await k.until(`/… · (loading model|starting)/.test($("ptxt").textContent)`, 8000, 100);
  t.ok(ok, "before the first step: a word + the real state", await k.ev(`$("ptxt").textContent`));
  t.ok(
    await k.until(`/^Step [0-9]+.3$/.test($("ptxt").textContent)`, 20000),
    "then the steps",
    await k.ev(`$("ptxt").textContent`),
  );
}
startLine.opts = { step: 5 };

export async function stopping(k, t) {
  await k.job("an owl", { steps: 5 });
  await k.until(`current()&&current().step>=1`, 15000);
  const s = await k.rect("#stopBtn");
  t.ok(s.height >= 34, "Stop is a proper button", s.height);
  await k.ev(`($("stopBtn").click(),1)`);
  // within the running step (3 s): the click asks the server first, which took longer than a fixed 0.3 s on CI
  t.ok(await k.until(`$("prog").classList.contains("stopping")`, 1500, 50), "the bar freezes and greys at once");
  t.ok(
    await k.until(`/Stopping after this step/.test($("ptxt").textContent)`, 1500, 50),
    "and says when it will stop",
    await k.ev(`$("ptxt").textContent`),
  );
  t.ok(await k.until(`!current()`, 15000), "the job stops");
  t.ok(await k.until(`!$("prog").classList.contains("stopping")`, 3000), "the status row goes back to normal");
}
stopping.opts = { step: 3 };

export async function finishedWhileClosed(k, t) {
  await k.job("a fox", { steps: 2 });
  await done(k);
  // as if the window had closed before this job finished: no save may slip in between (the poll would update it)
  await k.ev(
    `(()=>{save=function(){};const st=JSON.parse(localStorage.getItem("kiln_state"));st.S.seenDone=0;localStorage.setItem("kiln_state",JSON.stringify(st));return 1})()`,
  );
  await k.reload(); // waits for the new page, not the old one
  t.ok(
    await k.until(`/1 image finished while Kiln was closed/.test($("toastMsg").textContent)`, 6000, 100),
    "a note on reopening",
    await k.ev(`$("toastMsg").textContent`),
  );
}

export async function updateCheck(k, t) {
  t.ok(/Kiln \d/.test(await k.ev(`$("aboutV").textContent`)), "Settings shows the version");
  await k.ev(`($("updBtn").click(),1)`);
  t.ok(
    await k.until(`/v9\\.2 is available/.test($("updRes").textContent)`, 8000),
    "a newer tag is reported (fake GitHub)",
    await k.ev(`$("updRes").textContent`),
  );
  t.ok(
    !k.requests.some(r => /github/.test(r.url)),
    "the page itself never calls GitHub (the server does, only on request)",
  );
}

export async function shortcuts(k, t) {
  await k.ev(`(document.activeElement.blur(),1)`);
  await k.ev(`(document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"?",bubbles:true})),1)`);
  t.ok(await k.ev(`$("keys").classList.contains("show")`), "? opens the shortcut sheet");
  t.ok(
    await k.ev(`["F9","F8","Del","Ctrl+Enter"].every(x=>$("keys").textContent.includes(x))`),
    "it lists F9, F8, Del, Ctrl+Enter",
  );
  await k.ev(`(document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})),1)`);
  t.ok(!(await k.ev(`$("keys").classList.contains("show")`)), "Esc closes it");
  await k.ev(`(P.focus(),1)`);
  await k.key("?");
  t.ok(!(await k.ev(`$("keys").classList.contains("show")`)), "typing ? in the prompt doesn't open it");
}

export async function categoryTips(k, t) {
  await k.ev(`(showView("loras"),1)`);
  t.ok(
    /folder/.test(await k.ev(`document.querySelector('#fchips [data-f="people"]').dataset.tip||""`)),
    "Faces explains it comes from folders",
  );
}
