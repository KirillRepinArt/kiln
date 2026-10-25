// The prompt card's controls.
const overlap = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

export async function countClearsStart(k, t) {
  await k.ev(`(P.value="short",draft=P.value,P.focus(),updPrompt(),1)`);
  await k.sleep(300);
  t.ok(!overlap(await k.rect("#pcount"), await k.rect("#play")), "the character count doesn't sit under Start");
}

export async function startStates(k, t) {
  await k.ev(`(P.value="",draft="",updPrompt(),1)`);
  t.ok(await k.ev(`$("play").classList.contains("off")`), "empty prompt: Start is off");
  await k.ev(`(P.value="a fox",draft=P.value,updPrompt(),1)`);
  t.ok(!(await k.ev(`$("play").classList.contains("off")`)), "with a prompt: Start is on");
  t.ok(/gradient/.test(await k.ev(`getComputedStyle($("play")).backgroundImage`)), "on: the theme gradient");
}
