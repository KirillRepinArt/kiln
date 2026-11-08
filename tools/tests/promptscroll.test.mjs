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
  /* overflow is decided at rest, like the thumb (DEVLOG DD-2026-11-09-1): once the box has settled */
  await k.until(`$("prompt").parentElement.classList.contains("ovf")`, 3000).catch(() => {});
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

/* a scroll area ends where the controls on its surface begin (DEVLOG DD-2026-11-08-14): in a box shorter than its text,
   the caret at the very end is never under a control — it hid behind the pills when the text ran on under them — and
   the scroll edge's fade and blur stop at the scrollbar (the fade is the text's, the user 2026-11-08) */
export async function caretNeverUnderAControl(k, t) {
  await k.ev(
    `(P.value=Array(30).fill("a long line of words that wraps across the prompt box, dusk light, fog over the water").join(String.fromCharCode(10)),1)`,
  );
  await k.sleep(800);
  await k.ev(
    `(()=>{const s=document.createElement("style");s.textContent="#left{height:180px!important}";document.head.append(s);return 1})()`,
  );
  await k.sleep(600);
  await k.ev(`(document.querySelector(".pwrapT .cm-content").focus(),1)`);
  await k.sleep(200);
  await k.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "End",
    code: "End",
    windowsVirtualKeyCode: 35,
    modifiers: 2,
  });
  await k.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "End",
    code: "End",
    windowsVirtualKeyCode: 35,
    modifiers: 2,
  });
  await k.sleep(500);
  const g =
    await k.ev(`(()=>{const sel=getSelection(),r=sel.rangeCount?sel.getRangeAt(0).getBoundingClientRect():null,ctl=document.querySelector("#left .controls").getBoundingClientRect(),
      w=document.querySelector(".pwrapT"),sc=w.querySelector(".cm-scroller"),cs=getComputedStyle(w,"::after");
    const sr=sc.getBoundingClientRect(),fade=parseFloat(getComputedStyle(w).getPropertyValue("--edge-fade"))||0;
    return {clean:!w.classList.contains("more")||(r&&r.bottom<=sr.bottom-fade+1),caret:r?Math.round(r.bottom):null,controls:Math.round(ctl.top),ovf:w.classList.contains("ovf"),blurRight:cs.right,scrollbar:sc.offsetWidth-sc.clientWidth}})()`);
  t.ok(g.caret != null && g.caret <= g.controls, "the caret at the end of a long prompt stays above the controls", g);
  t.ok(g.clean, "the line being edited is never under the fade", g);
  t.ok(!g.ovf || parseFloat(g.blurRight) >= g.scrollbar - 1, "the scroll edge's blur stops at the scrollbar", g);
  const r = await k.ev(
    `[getComputedStyle(document.querySelector(".pwrapT")).borderTopLeftRadius,getComputedStyle(document.getElementById("left")).borderTopLeftRadius].map(parseFloat)`,
  );
  t.ok(
    r[0] > 0 && r[0] >= r[1] - 2,
    "the text area follows the box's rounded corners (its edge strips stay inside the curve)",
    r,
  );
}
caretNeverUnderAControl.opts = { width: 1400, height: 900 };

/* typing grows the box at once (the user's call, DEVLOG DD-2026-11-09-2): the text is the clock — composers grow with
   their text; animated, the box lagged its text and the text overflowed mid-growth */
export async function typingGrowsAtOnce(k, t) {
  await k.ev(`(P.value="one line",1)`);
  await k.sleep(1200);
  await k.ev(`(document.querySelector(".pwrapT .cm-content").focus(),1)`);
  await k.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "End",
    code: "End",
    windowsVirtualKeyCode: 35,
    modifiers: 2,
  });
  await k.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "End",
    code: "End",
    windowsVirtualKeyCode: 35,
    modifiers: 2,
  });
  await k.sleep(300);
  await k.ev(
    `(window.__h=[],(function f(){__h.push(document.getElementById("left").offsetHeight);if(__h.length<40)requestAnimationFrame(f)})(),1)`,
  );
  await k.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await k.send("Input.dispatchKeyEvent", { type: "char", text: String.fromCharCode(13) });
  await k.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await k.send("Input.insertText", { text: "two" });
  await k.sleep(900);
  const h = await k.ev(`__h`),
    end = h.at(-1),
    first = h.findIndex(v => v !== h[0]),
    at = h.findIndex(v => v === end);
  t.ok(end > h[0], "a new line grows the box", { from: h[0], to: end });
  t.ok(first >= 0 && at - first <= 1, "…at once: its new height within a frame of the first change (no glide)", {
    first,
    at,
    path: [...new Set(h)],
  });
}
typingGrowsAtOnce.opts = { width: 1400, height: 900 };
