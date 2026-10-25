// Phase 1b gate fixes.
import { join } from "node:path";
const done = (k, n = 1) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);

export async function namesNeverReused(k, t) {
  for (const c of ["dc2828", "2850e6", "28c83c"]) {
    await k.job(`[fill:${c}] x`, { steps: 2, name: "Gap" });
    await done(k, ["dc2828", "2850e6", "28c83c"].indexOf(c) + 1);
  }
  t.ok((await k.ev(`lastDone().file`)) === "gap-003.png", "gap-001…003");
  k.rm(join(k.out, "gap-003.png"));
  k.rm(join(k.out, "gap-002.png")); // deleted outside Kiln
  await k.ev(`(removeMissing(),1)`);
  await k.sleep(1200);
  await k.job("[fill:e0e0e0] new one", { steps: 2, name: "Gap" });
  await done(k, 2);
  t.ok(
    (await k.ev(`lastDone().file`)) === "gap-004.png",
    "the next one is gap-004 — a deleted number is never handed out again",
    await k.ev(`lastDone().file`),
  );
  t.ok((await k.ev(`lastDone().id`)) === 4, "and its job id isn't a removed one's either", await k.ev(`lastDone().id`));
  await k.sleep(1500);
  const c = await k.cvColor();
  t.ok(c[0] > 200 && c[1] > 200, "and the new picture shows (not an old one)", c);
}

export async function deleteLandsOnNeighbour(k, t) {
  for (const c of ["dc2828", "2850e6", "28c83c"]) {
    await k.job(`[fill:${c}] x`, { steps: 2 });
    await done(k, ["dc2828", "2850e6", "28c83c"].indexOf(c) + 1);
  }
  await k.ev(`(document.activeElement.blur(),genNav(-1),updNav(),1)`);
  await k.sleep(800); // browsing the blue one
  await k.ev(`(deleteJob(browsed()),1)`);
  await k.sleep(1500);
  t.ok(await k.ev(`!!browsed()`), "still browsing after the delete");
  const c = await k.cvColor();
  t.ok(c[0] > 180 && c[2] < 80, "on the one before it (red)", c);
}
deleteLandsOnNeighbour.opts = { step: 0.4 };

export async function stoppedRowTip(k, t) {
  await k.job("an owl", { steps: 6 });
  await k.until(`current()&&current().step>=1`, 10000);
  await k.ev(`(stopJob(current()),1)`);
  await k.until(`!current()`, 15000);
  await k.ev(`(showView("queue"),1)`);
  await k.sleep(300);
  t.ok(
    (await k.ev(`document.querySelector("[data-rm]").dataset.tip||document.querySelector("[data-rm]").title`)) ===
      "Remove from the list",
    "a stopped row's ✕ doesn't mention a file",
  );
}

export async function stopCountdown(k, t) {
  await k.job("an owl", { steps: 5 });
  await k.until(`current()&&current().step>=1`, 15000);
  await k.ev(`(stopJob(current()),1)`);
  await k.sleep(400);
  t.ok(
    /stops in ~\d+:\d\d|any moment/.test(await k.ev(`$("peta").textContent`)),
    "a countdown to the stop",
    await k.ev(`$("peta").textContent`),
  );
}
stopCountdown.opts = { step: 6 };

export async function loraListStays(k, t) {
  await k.ev(`(showView("loras"),1)`);
  await k.sleep(500);
  await k.ev(`(LORAS.forEach(l=>l.on=false),renderLoras(),1)`);
  const name = await k.ev(`[...document.querySelectorAll("#lscroll .li:not([data-act])")].pop().dataset.ln`);
  await k.ev(`($("lscroll").scrollTop=99999,1)`);
  await k.sleep(200);
  const before = await k.ev(
    `document.querySelector('#lscroll .li[data-ln="${name}"]:not([data-act])').getBoundingClientRect().top`,
  );
  await k.ev(`(document.querySelector('#lscroll .li[data-ln="${name}"]:not([data-act]) [data-tg]').click(),1)`);
  await k.sleep(300);
  const after = await k.ev(
    `document.querySelector('#lscroll .li[data-ln="${name}"]:not([data-act])').getBoundingClientRect().top`,
  );
  t.ok(await k.ev(`LORAS.find(l=>l.name===${JSON.stringify(name)}).on`), "it switched on");
  t.ok(Math.abs(after - before) < 2, "the row you clicked stays put", { before, after });
}

export async function halfMegapixel(k, t) {
  await k.ev(`(S.mp="0.5",S.ar="1:1",renderPills(),1)`);
  await k.job("quick test", { ar: "1:1", steps: 2 });
  await done(k);
  t.ok(
    await k.ev(`lastDone().w===720&&lastDone().h===720`),
    "0.5 MP renders 720×720 at 1:1",
    await k.ev(`[lastDone().w,lastDone().h]`),
  );
  t.ok(await k.ev(`$("popMP").textContent.includes("0.5 MP")`), "offered in the size pill");
}

export async function badgeAndCount(k, t) {
  await k.ev(`(setPaused(true),1)`);
  await k.sleep(300);
  await k.job("a", { steps: 2 });
  await k.job("b", { steps: 2 });
  await k.sleep(1500);
  await k.ev(`(P.value="short",draft=P.value,P.focus(),updPrompt(),1)`);
  await k.sleep(400);
  const b = await k.rect("#badge"),
    p = await k.rect("#play"),
    c = await k.rect("#pcount");
  t.ok(b.left < p.right && b.bottom > p.top, "the queue count sits on Start's corner", { b, p });
  t.ok(c.right <= b.left || c.bottom <= b.top || c.top >= b.bottom, "the character count doesn't collide with it", {
    c,
    b,
  });
}
