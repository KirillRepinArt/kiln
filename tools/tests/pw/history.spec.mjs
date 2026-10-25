// TRIAL: tools/tests/history.test.mjs ported to Playwright, assertion for assertion.
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "./kiln.fixture.mjs";

const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);
const near = (a, b, tol = 12) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const shape = k => k.ev(`(()=>{const c=$("cv"),f=$("frame");return [+(c.width/c.height).toFixed(2),+(f.offsetWidth/f.offsetHeight).toFixed(2)]})()`);

test.describe("history", () => {
  test.describe(() => {
    test.use({ step: 1 });
    test("cancel shows the previous picture", async ({ kiln: k, page }) => {
      await k.job("[fill:dc2828] red", { ar: "3:4", steps: 2 }); await done(k, 1); await page.waitForTimeout(2500);
      await k.job("[fill:2850e6] blue", { ar: "16:9", steps: 12 }); await k.until(`!!current()&&current().step>=2`);
      await k.ev(`(stopJob(current()),1)`); await k.until(`!current()`, 10000); await page.waitForTimeout(2500);
      const c = await k.cvColor(), [ca, fa] = await shape(k);
      expect.soft(near(c, [220, 40, 40]), `after a cancel the previous image shows (not the cancelled preview): ${c}`).toBe(true);
      expect.soft(Math.abs(ca - fa), "in its own shape").toBeLessThan(0.03);
      expect.soft(await k.ev(`$("frame").style.getPropertyValue("--vf")`), "and not blurred").toBe("none");
    });
  });

  test("a missing file shows the 'not found' card", async ({ kiln: k, page }) => {
    await k.job("[fill:dc2828] red", { ar: "3:4", steps: 2 }); await done(k, 1);
    await k.job("[fill:2850e6] blue", { ar: "16:9", steps: 2 }); await done(k, 2);
    await k.job("[fill:28c83c] green", { ar: "3:4", steps: 2 }); await done(k, 3); await page.waitForTimeout(2000);
    const files = await k.ev(`jobs.filter(j=>j.status==="done").map(j=>j.file)`);
    unlinkSync(join(k.out, files[1]));                               // blue is gone before the page ever loads it
    await page.route("**/*", r => r.continue());                     // routing switches the browser cache off, like Network.setCacheDisabled
    await page.reload();
    await k.until("!!(window.LIVE&&window._jobsReady)", 15000); await page.waitForTimeout(1500);
    expect.soft(near(await k.cvColor(), [40, 200, 60]), "after a reload: the newest (green)").toBe(true);
    await k.ev(`(document.activeElement.blur(),genNav(-1),updNav(),1)`); await page.waitForTimeout(1500);   // to blue, whose file is gone
    const c = await k.cvColor(), [ca, fa] = await shape(k);
    expect.soft(c.every(v => v < 30), `a missing file shows the dark 'not found' card, not the previous picture: ${c}`).toBe(true);
    expect.soft(Math.abs(ca - fa), "in the missing image's shape (nothing stretched)").toBeLessThan(0.03);
    await k.ev(`(genNav(-1),updNav(),1)`); await page.waitForTimeout(1500);
    expect.soft(near(await k.cvColor(), [220, 40, 40]), "the one before it still shows (red)").toBe(true);
  });
});
