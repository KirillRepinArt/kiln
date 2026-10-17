// The cover: Privacy hold, the eye button / F9, hover peek, lifts per image.
const held = k => k.ev(`$("frame").classList.contains("held")`);
const cvHidden = k => k.ev(`getComputedStyle($("cv")).visibility==="hidden"`);
const eye = k => k.ev(`($("cbtn").click(),1)`);
const done = k => k.until(`!current()&&!!lastDone()`, 30000);
const running = (k, step = 1) => k.until(`!!current()&&current().step>=${step}`, 20000);
async function hoverLift(k) { const f = await k.rect("#frame"); await k.mouse(5, 5); await k.sleep(1500); const off = await k.veil();
  await k.mouse(f.x + f.width / 2, f.y + f.height / 2); await k.sleep(1500); const on = await k.veil(); await k.mouse(5, 5); return { off, on } }

export async function privacyHold(k, t) {
  await k.theme("aurora"); await k.setting("privacy", "on");
  await k.job("a fox", { steps: 4 }); await running(k);
  t.ok(await held(k), "held while running"); t.ok(await cvHidden(k), "picture hidden while running");
  const { on } = await hoverLift(k); t.ok(on > .3, "hover doesn't peek while held", on);
  await done(k); await k.sleep(1500);
  t.ok(await held(k) && await cvHidden(k), "still held after the finish");
  t.ok(!(await k.ev(`$("amb").classList.contains("on")`)), "no ambient glow from a held picture");
  await k.key("F9"); await k.sleep(400);
  t.ok(!(await held(k)) && !(await cvHidden(k)), "F9 lifts it");
  await k.job("a wolf", { steps: 4 }); await running(k);
  t.ok(await held(k), "the next job is covered again");
}
privacyHold.opts = { step: 0.8 };

export async function eyeMidJob(k, t) {
  await k.theme("aurora"); await k.setting("veil", "light");
  await k.job("an owl", { steps: 10 }); await running(k, 2);
  const a = await hoverLift(k);
  t.ok(a.off > .3 && a.on < .12, "hover lifts the normal cover", a);
  await eye(k); await k.sleep(1200); t.ok(await k.veil() < .02, "eye: cover off", await k.veil());
  await eye(k); await k.sleep(1200);
  t.ok(!(await held(k)), "eye again: the normal cover, not a held one");
  const b = await hoverLift(k); t.ok(b.off > .3 && b.on < .12, "…and hover still lifts it", b);
}
eyeMidJob.opts = { step: 1.5 };

export async function slowFrames(k, t) {   // the hover fade must keep its speed when the page runs at a few fps
  await k.theme("aurora"); await k.setting("veil", "light");
  await k.job("an owl", { steps: 8 }); await running(k, 2);
  await k.send("Emulation.setCPUThrottlingRate", { rate: 25 });
  const a = await hoverLift(k); t.ok(a.on < .12, "lifted within 1.5 s at a few fps", a);
}
slowFrames.opts = { step: 3 };

export async function liftIsPerImage(k, t) {
  await k.theme("aurora");
  await k.job("first", { steps: 2 }); await done(k);
  await k.job("second", { steps: 12 }); await running(k, 2);
  await eye(k); await k.sleep(1200);
  t.ok(await k.veil() < .06, "lifted on the render", await k.veil());   /* Aurora keeps a few bright stars drawn */
  await k.ev(`(document.activeElement.blur(),genNav(-1),updNav(),1)`); await k.sleep(600);
  await k.ev(`(genNav(1),updNav(),1)`); await k.sleep(1200);
  t.ok(await k.veil() > .3, "browse away and back: the cover returns", await k.veil());
}
liftIsPerImage.opts = { step: 1.2 };

export async function forceOnIdle(k, t) {
  await k.job("a fox", { steps: 2 }); await done(k); await k.sleep(1000);
  t.ok(!(await held(k)), "a finished image shows normally");
  await k.key("F9"); await k.sleep(300); t.ok(await held(k) && await cvHidden(k), "F9 on a finished image: full cover");
  await k.key("F9"); await k.sleep(300); t.ok(!(await held(k)), "F9 again: gone");
}
