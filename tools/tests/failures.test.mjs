// Failure states (ux-review/21-failure-states.md): a failed job is a row in the Queue with why and Retry, a failure
// that would repeat pauses the queue and says why, and Forge going away mid-job puts the job back instead of failing it.
// The fake Forge fails on request: a prompt with [fail:vram] is refused as out of video memory, [fail:die] drops the
// connection once (tools/fake_forge.py).
const state = k => k.ev(`fetch("/api/state").then(r=>r.json())`);
const row = `document.querySelector('#qflist .qi:has(.failed)')`;

export async function failedJobIsARowWithWhyAndRetry(k, t) {
  await k.job("[fail:vram] a cup", { steps: 2 });
  t.ok(await k.until(`jobs.some(j=>j.status==="error")`, 20000), "the job fails");
  t.ok(await k.until(`$("tabF").textContent==="1 failed"`, 3000), "the Queue tab counts it while you're elsewhere");
  const note = await k.ev(`$("donenote").classList.contains("show")?$("dnTxt").textContent:""`);
  t.ok(/failed — Out of video memory/.test(note), "the finished note says it, on Generating too", note);
  await k.ev(`(showView("queue"),1)`);
  t.ok(await k.until(`$("tabF").textContent===""`, 3000), "opening the Queue: seen, the count clears");
  t.ok(await k.until(`!!${row}`, 5000), "it is a row in the Queue's Finished list");
  const why = await k.ev(`${row}?.querySelector(".why")?.textContent||""`);
  t.ok(/Out of video memory at .* MP/.test(why), "the row says why, in words", why);
  t.ok(await k.ev(`!!${row}?.querySelector("[data-retry]")`), "with Retry");
  const s = await state(k);
  t.ok(s.paused === true && s.pause_why?.kind === "vram", "a failure that would repeat pauses the queue", s.pause_why);
  t.ok(
    /paused — Out of video memory/.test(await k.ev(`$("qsPend").querySelector(".qsec")?.textContent||""`)),
    "Up next says why it paused",
  );
  await k.reload();
  await k.ev(`(showView("queue"),1)`);
  t.ok(await k.until(`!!${row}`, 5000), "after a reload the failure is still there (coming back to it)");
  const before = (await state(k)).jobs.find(j => j.status === "error").finished;
  await k.ev(`(${row}.querySelector("[data-retry]").click(),1)`);
  // the fake refuses at once, so the queue is paused again by the time anyone looks: that it ran again (a later
  // failure) is what shows Retry resumed it
  t.ok(
    await k.until(
      `fetch("/api/state").then(r=>r.json()).then(s=>s.jobs.some(j=>j.status==="error"&&j.finished>${before}))`,
      20000,
      150,
    ),
    "Retry resumes the queue the failure paused and runs the job again",
  );
  t.ok(await k.until(`jobs.filter(j=>j.status==="error").length===1&&!!${row}`, 5000), "one row for it, not two");
}
failedJobIsARowWithWhyAndRetry.opts = { step: 0.2 };

export async function forgeGoingAwayPutsTheJobBack(k, t) {
  await k.job("[fail:die] a fox", { steps: 2 });
  t.ok(await k.until(`jobs.some(j=>j.status==="done")`, 30000), "the job runs again and finishes");
  const s = await state(k);
  t.ok(
    !s.jobs.some(j => j.status === "error"),
    "no failed job",
    s.jobs.map(j => j.status),
  );
  t.ok(!s.paused, "the queue didn't pause");
}
forgeGoingAwayPutsTheJobBack.opts = { step: 0.2 };

export async function serverGoneMidSessionHasTheStartLook(k, t) {
  t.ok(!(await k.ev(`$("offline").classList.contains("show")`)), "with the server: no card");
  // the page's own requests fail as if the server had stopped; then they get through again
  await k.ev(
    `(window._kept=window.fetch,window.fetch=(u,...a)=>String(u).startsWith("/api/")?Promise.reject(new TypeError("Failed to fetch")):window._kept(u,...a),window._before=1,1)`,
  );
  t.ok(await k.until(`$("offline").classList.contains("show")`, 10000), "mid-session: the same card as at start");
  await k.ev(`(window.fetch=window._kept,1)`);
  t.ok(
    await k.until(`!window._before&&!!window._jobsReady&&!$("offline").classList.contains("show")`, 15000),
    "the server answers again: the page reloads by itself, the card gone",
  );
}
