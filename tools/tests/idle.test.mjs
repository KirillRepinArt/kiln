// An idle page does no drawing (ux-review/20-quality-bar.md §2): what's derived from a picture or the progress — the
// ambient glow, the favicon — is drawn when what it shows changes, not on the 400 ms status timer (it scaled the
// full-size picture to 12 px and encoded the favicon every 400 ms: ~40 ms of script, landing in the middle of motions).

export async function idlePageDrawsNothing(k, t) {
  await k.job("[fill:446688] a cup", { steps: 1 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 20000);
  await k.ev(`(S.set={...(S.set||{}),glow:"always"},showView("gen"),1)`); // the glow on while idle: it has a picture to show
  await k.sleep(1500); // the finish settles, the glow drawn once
  await k.ev(`(()=>{
    window._draws={amb:0,fav:0};
    const amb=document.getElementById("amb"), di=CanvasRenderingContext2D.prototype.drawImage, td=HTMLCanvasElement.prototype.toDataURL;
    CanvasRenderingContext2D.prototype.drawImage=function(...a){if(this.canvas===amb)window._draws.amb++;return di.apply(this,a)};
    HTMLCanvasElement.prototype.toDataURL=function(...a){if(this.width===64&&this.height===64)window._draws.fav++;return td.apply(this,a)};
    return 1})()`);
  await k.sleep(2000); // five turns of the status timer
  const d = await k.ev(`window._draws`);
  t.ok(d.amb === 0, "the ambient glow isn't redrawn while its picture is the same", d);
  t.ok(d.fav === 0, "the favicon isn't drawn and encoded again while it shows the same", d);
  await k.job("[fill:aa7733] a saucer", { steps: 2 });
  await k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=2`, 20000);
  await k.sleep(800);
  const d2 = await k.ev(`window._draws`);
  t.ok(d2.fav > 0, "a render changes the favicon (the progress ring): it's drawn then", d2);
}
idlePageDrawsNothing.opts = { step: 0.3 };
