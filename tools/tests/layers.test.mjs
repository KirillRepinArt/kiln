// The layering rule (v0.7c T2c, DEVLOG DD-2026-11-08-12): materials (glass) sit on the surfaces that float — the plate,
// the prompt box, the tab bar, pop-ups — and content sits on them as one layer with no material inside. These tests are
// the rule's acceptance: PENDING in tools/tests/run.mjs until the content's glass becomes fills (the user's look call).
/* glass never fades through an ancestor, in tab switches too (DEVLOG DD-2026-11-08-8; T2c-3a): a view, the status row,
   the edit buttons faded by their container's opacity turn the glass inside them into flat tint until the fade ends —
   the blur pops back (glass.css already turned the views' own CSS fade off in glass mode for that reason; the switch's
   animations faded them anyway). Every frame of switches between every page: no rendered glass layer has an ancestor
   part-way faded */
export async function tabSwitchGlassLive(k, t) {
  for (let i = 0; i < 4; i++) await k.job("[fill:446688] a" + i, { ar: "3:4", steps: 1 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=4`, 60000);
  await k.mouse(4, 4);
  const tour = ["queue", "gen", "loras", "png", "gallery", "queue", "png", "gen"];
  await k.ev(`(document.querySelector('.tab[data-v="${tour[0]}"]').click(),1)`);
  await k.sleep(1200);
  for (let i = 1; i < tour.length; i++) {
    const [from, to] = [tour[i - 1], tour[i]];
    const bad =
      await k.ev(`new Promise(res=>{const gl=(e,p)=>{const c=getComputedStyle(e,p);if(p&&(c.display==="none"||c.content==="none"))return false;return c.backdropFilter&&c.backdropFilter!=="none"},
        all=[...document.querySelectorAll("body *")].filter(e=>gl(e)||gl(e,"::before")),out=[],t0=performance.now();
      document.querySelector('.tab[data-v="${to}"]').click();
      (function f(){for(const e of all){if(!e.getClientRects().length)continue;const b=gl(e,"::before");
          for(let a=b?e:e.parentElement;a&&a!==document.documentElement;a=a.parentElement){const o=+getComputedStyle(a).opacity;
            if(o>0&&o<1){out.push((e.id||e.className)+" under "+(a.id||a.className)+" "+o.toFixed(2));break}}}
        if(performance.now()-t0<900)requestAnimationFrame(f);else res([...new Set(out)])})()})`);
    await k.sleep(400);
    t.ok(!bad.length, `${from} → ${to}: no glass under a part-way faded ancestor, any frame`, bad.slice(0, 4));
  }
}
tabSwitchGlassLive.opts = { width: 1400, height: 900 };
