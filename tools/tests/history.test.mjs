// What the image canvas shows after cancels, deletions and quick browsing.
import { join } from "node:path";
const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);
const close = (a, b, tol = 12) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const shape = k =>
  k.ev(
    `(()=>{const c=$("cv"),f=$("frame");return [+(c.width/c.height).toFixed(2),+(f.offsetWidth/f.offsetHeight).toFixed(2)]})()`,
  );

export async function cancelShowsPrevious(k, t) {
  await k.job("[fill:dc2828] red", { ar: "3:4", steps: 2 });
  await done(k, 1);
  await k.sleep(2500);
  await k.job("[fill:2850e6] blue", { ar: "16:9", steps: 12 });
  await k.until(`!!current()&&current().step>=2`, 20000);
  await k.ev(`(stopJob(current()),1)`);
  await k.until(`!current()`, 10000);
  await k.sleep(2500);
  const c = await k.cvColor(),
    [ca, fa] = await shape(k);
  t.ok(close(c, [220, 40, 40]), "after a cancel the previous image shows (not the cancelled preview)", c);
  t.ok(Math.abs(ca - fa) < 0.03, "in its own shape", { canvas: ca, frame: fa });
  t.ok((await k.ev(`$("frame").style.getPropertyValue("--vf")`)) === "none", "and not blurred");
}
cancelShowsPrevious.opts = { step: 1 };

export async function missingFile(k, t) {
  await k.job("[fill:dc2828] red", { ar: "3:4", steps: 2 });
  await done(k, 1);
  await k.job("[fill:2850e6] blue", { ar: "16:9", steps: 2 });
  await done(k, 2);
  await k.job("[fill:28c83c] green", { ar: "3:4", steps: 2 });
  await done(k, 3);
  await k.sleep(2000);
  const files = await k.ev(`jobs.filter(j=>j.status==="done").map(j=>j.file)`);
  k.rm(join(k.out, files[1])); // blue is gone before the page ever loads it
  await k.send("Network.setCacheDisabled", { cacheDisabled: true });
  await k.reload({ ignoreCache: true });
  await k.sleep(800);
  await k.until("!!(window.LIVE&&window._jobsReady)", 15000);
  await k.sleep(1500);
  t.ok(close(await k.cvColor(), [40, 200, 60]), "after a reload: the newest (green)", await k.cvColor());
  await k.ev(`(document.activeElement.blur(),genNav(-1),updNav(),1)`);
  await k.sleep(1500); // to blue, whose file is gone
  const c = await k.cvColor(),
    [ca, fa] = await shape(k);
  t.ok(
    c[0] < 30 && c[1] < 30 && c[2] < 30,
    "a missing file shows the dark 'not found' card, not the previous picture",
    c,
  );
  t.ok(Math.abs(ca - fa) < 0.03, "in the missing image's shape (nothing stretched)", { canvas: ca, frame: fa });
  await k.ev(`(genNav(-1),updNav(),1)`);
  await k.sleep(1500);
  t.ok(close(await k.cvColor(), [220, 40, 40]), "the one before it still shows (red)", await k.cvColor());
}
