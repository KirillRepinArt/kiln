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

/* B21 (the user, 2026-11-06): browsing to a picture with a longer prompt, the box grows to fit it — and while it grew
   the text overflowed mid-way and the scrollbar's thumb flickered. The thumb is decided at rest only: no frame shows
   one (the text overflowing and the box not settling) when the prompt fits the box it settles to */
export async function thumbOnlyAtRest(k, t) {
  await k.ev(`(setDock("left"),1)`);
  await k.job("a short prompt", { ar: "3:4", steps: 2 });
  const long = Array.from({ length: 7 }, (_, i) => `line ${i + 1} of a longer prompt, words and more words`).join("\n");
  await k.job(long, { ar: "3:4", steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 30000);
  await k.ev(`(P.value="",draft="",document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.mouse(4, 4);
  await k.sleep(1500);
  await k.ev(`(genNav(-1),1)`); // to the short one
  await k.sleep(1500);
  const rows = await k.ev(`new Promise(res=>{const out=[],t0=performance.now();
      genNav(1); // to the long one: the box grows
      (function f(){const s=document.querySelector(".pwrapT .cm-scroller"),w=s.parentElement.closest(".pwrapT");
        out.push([s.scrollHeight>s.clientHeight+1?1:0,w.classList.contains("settling")?1:0,$("left").offsetHeight]);
        if(performance.now()-t0<1200)requestAnimationFrame(f);else res(out)})()})`),
    last = rows[rows.length - 1],
    grew = last[2] - rows[0][2],
    shown = rows.filter(r => r[0] && !r[1]).length;
  t.ok(grew > 40 && !last[0], "the box grew to the longer prompt, which fits it at rest", { grew, last });
  t.ok(
    rows.some(r => r[0]),
    "…the text overflowed while it grew (the case)",
    { frames: rows.length },
  );
  t.ok(shown === 0, "…and no frame showed the scrollbar's thumb", {
    shown,
    of: rows.length,
    at: rows.map((r, i) => (r[0] && !r[1] ? i : -1)).filter(i => i >= 0),
    rows: rows.slice(0, 6),
  });
}
thumbOnlyAtRest.opts = { width: 1760, height: 1080, step: 0.05 };
