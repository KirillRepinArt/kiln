// The cover (Settings) and the privacy button (the eye / F9).
const held = k => k.ev(`$("frame").classList.contains("held")`);
const cvHidden = k => k.ev(`getComputedStyle($("cv")).visibility==="hidden"`);
const eye = k => k.ev(`($("cbtn").click(),1)`);
const done = k => k.until(`!current()&&!!lastDone()`, 30000);
const running = (k, step = 1) => k.until(`!!current()&&current().step>=${step}`, 20000);
const hiddenEl = (k, sel) => k.ev(`getComputedStyle(document.querySelector(${JSON.stringify(sel)})).visibility==="hidden"`);
async function hoverLift(k) { const f = await k.rect("#frame"); await k.mouse(5, 5); await k.sleep(1500); const off = await k.veil();
  await k.mouse(f.x + f.width / 2, f.y + f.height / 2); await k.sleep(1500); const on = await k.veil(); await k.mouse(5, 5); return { off, on } }

export async function privacyButton(k, t) {
  await k.theme("aurora"); await k.setting("veil", "light");
  await k.job("a fox", { steps: 5, name: "Secret" }); await running(k);
  t.ok(!(await held(k)), "privacy off: the normal cover (Settings)");
  await k.key("F9"); await k.sleep(400);
  t.ok(await held(k) && await cvHidden(k), "F9: the picture is covered outright while it renders");
  const { on } = await hoverLift(k); t.ok(on > .3, "no peek on hover", on);
  t.ok(await hiddenEl(k, ".pwrapT .cm-editor") && await hiddenEl(k, ".ltitle .nchip") && await hiddenEl(k, ".chips"), "prompt, name and LoRA chips hidden");
  t.ok(await k.ev(`getComputedStyle($("privov")).display!=="none"`), "a lock note in the prompt box");
  await done(k); await k.sleep(1500);
  t.ok(await held(k) && await cvHidden(k), "still covered after the finish");
  await k.ev(`(showView("queue"),1)`); await k.sleep(300);
  t.ok(await k.ev(`!!document.querySelector(".qi canvas[data-th]")`), "the Queue tab is untouched");
  await k.ev(`(showView("gen"),1)`);
  await k.job("a wolf", { steps: 3 }); await running(k);
  t.ok(await held(k), "it stays on for the next job");
  await k.send("Page.reload", {}); await k.sleep(800); await k.until("!!(window.LIVE&&window._jobsReady)", 15000); await k.sleep(800);
  t.ok(await k.ev(`document.body.classList.contains("private")`), "and after a restart");
  await eye(k); await k.sleep(400);
  t.ok(!(await held(k)) && !(await k.ev(`document.body.classList.contains("private")`)), "the eye turns it off");
  t.ok(await k.ev(`!document.querySelector('[data-set="privacy"]')`), "Settings no longer has Privacy hold");
}
privacyButton.opts = { step: 0.8 };

export async function normalCoverHover(k, t) {
  await k.theme("aurora"); await k.setting("veil", "light");
  await k.job("an owl", { steps: 8 }); await running(k, 2);
  const a = await hoverLift(k);
  t.ok(a.off > .3 && a.on < .12, "hover lifts the normal cover", a);
}
normalCoverHover.opts = { step: 1.5 };

export async function slowFrames(k, t) {   // the hover fade must keep its speed when the page runs at a few fps
  await k.theme("aurora"); await k.setting("veil", "light");
  await k.job("an owl", { steps: 8 }); await running(k, 2);
  await k.send("Emulation.setCPUThrottlingRate", { rate: 25 });
  const a = await hoverLift(k); t.ok(a.on < .12, "lifted within 1.5 s at a few fps", a);
}
slowFrames.opts = { step: 3 };

export async function privacyOnFinished(k, t) {
  await k.job("a fox", { steps: 2 }); await done(k); await k.sleep(1000);
  t.ok(!(await held(k)), "a finished image shows normally");
  await k.key("F9"); await k.sleep(300); t.ok(await held(k) && await cvHidden(k), "F9 on a finished image: covered");
  await k.ev(`($("frame").click(),1)`); await k.sleep(400);
  t.ok(!(await k.ev(`$("viewer").classList.contains("show")`)), "no full-size viewer while private");
  await k.key("F9"); await k.sleep(300); t.ok(!(await held(k)), "F9 again: shown");
}
