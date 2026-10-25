// TRIAL (ROADMAP v0.7 step 1): the e2e runner's launch() as a Playwright fixture, to compare the two.
// Each test gets its own fake Forge, Kiln server and data/output folders; Playwright gives it a fresh browser context.
import { test as base, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PY = process.platform === "win32" ? "python" : "python3";
const freePort = () =>
  new Promise(r => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => r(p));
    });
  });
async function waitHttp(url, ms = 15000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    try {
      await fetch(url);
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  throw new Error("no answer from " + url);
}

export const test = base.extend({
  // per-test options, like `fn.opts` in the old runner: test.use({ step: 1 })
  step: [0.6, { option: true }],
  kiln: async ({ page, step }, use, info) => {
    const dir = join(tmpdir(), `kiln-pw-${info.testId}-${Date.now()}`),
      out = join(dir, "out"),
      data = join(dir, "data");
    mkdirSync(out, { recursive: true });
    mkdirSync(data, { recursive: true });
    const [fport, kport] = [await freePort(), await freePort()],
      procs = [];
    const run = (args, env = {}) =>
      procs.push(spawn(PY, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: "ignore" }));
    run(["tools/fake_forge.py", String(fport), String(step)]);
    await waitHttp(`http://127.0.0.1:${fport}/sdapi/v1/options`);
    run(["-c", "import server; server.CFG['exit_when_closed']=False; server.CFG['forge_start']=''; server.main()"], {
      KILN_PORT: String(kport),
      KILN_FORGE_URL: `http://127.0.0.1:${fport}`,
      KILN_OUTPUT_DIR: out,
      KILN_DATA_DIR: data,
      KILN_UPDATE_URL: `http://127.0.0.1:${fport}/tags`,
      KILN_NO_RECYCLE: "1",
    });
    await waitHttp(`http://127.0.0.1:${kport}/api/state`);

    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    // like the old runner: script errors and console.error calls; the browser's own "failed to load" lines are
    // network results, kept apart (a test about a missing file causes one on purpose)
    page.on(
      "console",
      m =>
        m.type() === "error" &&
        !m.text().startsWith("Failed to load resource") &&
        errors.push("console.error " + m.text()),
    );
    const notFound = [];
    page.on("response", r => r.status() === 404 && notFound.push(r.url()));
    await page.goto(`http://127.0.0.1:${kport}/`);
    await page.waitForFunction("!!(window.LIVE&&window._jobsReady&&LORAS.length)", null, { timeout: 30000 });

    const ev = expr => page.evaluate(expr);
    await use({
      page,
      out,
      data,
      ev,
      until: (expr, timeout = 20000) => page.waitForFunction(expr, null, { timeout, polling: 200 }),
      job: (prompt, o = {}) =>
        ev(`(()=>{S.ar=${JSON.stringify(o.ar || "3:4")};S.steps=${o.steps || 3};S.n=1;S.seedMode="random";
        S.pname=${JSON.stringify(o.name || "")};$("pname").value=S.pname;P.value=${JSON.stringify(prompt)};draft=P.value;return addJobs().then(()=>1)})()`),
      cvColor: () =>
        ev(
          `(()=>{const c=$("cv"),d=c.getContext("2d").getImageData(0,(c.height/2)|0,c.width,1).data,s=[0,0,0];for(let i=0;i<d.length;i+=4){s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2]}return s.map(v=>Math.round(v/(d.length/4)))})()`,
        ),
    });

    if (notFound.length) info.annotations.push({ type: "404", description: notFound.join(" ") });
    expect(errors, "no page errors").toEqual([]);
    for (const p of procs)
      try {
        p.kill();
      } catch (e) {}
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (e) {}
  },
});
export { expect };
