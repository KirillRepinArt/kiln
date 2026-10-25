// The prompt box: no scrollbar gutter while the text fits (it flickered on glass); kept while it overflows.
export async function scrollProbe(k, t) {
  await k.theme("aurora");
  await k.sleep(500);
  const txt =
    "birds eye view.\\nepic cinematic shot of Hogwarts castle, nighttime, cinematic light, fog, mist, atmosphere, lights, spooky, moon";
  await k.ev(`(P.value="${txt}",draft=P.value,layoutLeft(),1)`);
  await k.sleep(600);
  await k.ev(
    `(window._sc=[],(function f(){const s=document.querySelector(".pwrapT .cm-scroller");_sc.push([Math.round(performance.now()),s.scrollHeight,s.clientHeight,$("left").offsetHeight,document.body.className]);if(_sc.length<600)requestAnimationFrame(f)})(),1)`,
  );
  await k.job(
    "birds eye view.\nepic cinematic shot of Hogwarts castle, nighttime, cinematic light, fog, mist, atmosphere, lights, spooky, moon",
    { ar: "16:9", steps: 4, name: "Hogwarts Castle" },
  );
  await k.sleep(9000);
  const r = await k.ev(`_sc`);
  const over = r.filter(x => x[1] > x[2]);
  const hs = [...new Set(r.map(x => x[1] + "/" + x[2] + "/" + x[3]))];
  t.ok(!(await k.ev(`$("prompt").parentElement.classList.contains("ovf")`)), "a prompt that fits: no gutter");
  await k.ev(`(P.value=Array(60).fill("a long line of words").join(String.fromCharCode(10)),1)`);
  await k.sleep(400);
  t.ok(await k.ev(`$("prompt").parentElement.classList.contains("ovf")`), "an overflowing prompt: the gutter is kept");
  t.ok(over.length === 0, "never overflows", {
    over: over.length,
    of: r.length,
    first: over.slice(0, 5),
    states: hs.slice(0, 20),
    cls: r[0][4],
  });
}
scrollProbe.opts = { width: 2000, height: 1023, step: 1 };
