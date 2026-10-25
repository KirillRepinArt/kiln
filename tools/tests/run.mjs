// Kiln end-to-end tests: each test gets its own fake Forge, Kiln server and headless Edge/Chrome (fresh profile,
// fresh data and output folders), driven over the DevTools protocol in real time.
//
//   node tools/tests/run.mjs              # all tests, several at a time
//   node tools/tests/run.mjs cover        # tests whose file name contains "cover"
//   node tools/tests/run.mjs -j 1         # one at a time (-j N or KILN_JOBS=N; default: a third of the CPU cores, at most 3)
//
// Needs Node 22+ (built-in WebSocket), Python 3 and Edge or Chrome (KILN_BROWSER=path to pick one).
// Screenshots and logs land in tools/tests/out/ (git-ignored).
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, readdirSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir, availableParallelism } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "..", ".."), OUT = join(HERE, "out");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PY = process.platform === "win32" ? "python" : "python3";

function browserPath() {
  if (process.env.KILN_BROWSER) return process.env.KILN_BROWSER;
  const c = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/microsoft-edge", "/usr/bin/google-chrome", "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  const p = c.find(existsSync); if (!p) throw new Error("No Edge/Chrome found — set KILN_BROWSER"); return p;
}
/* a port nobody listens on; never the same one twice in a run (tests start in parallel, and a port just closed by one
   test could otherwise be handed to the next before the first one's server has bound it) */
const given = new Set();
/* stop a process and everything it started (Edge runs a dozen helper processes; Windows doesn't end them with the parent) */
const killTree = p => { try { if (process.platform === "win32") spawn("taskkill", ["/T", "/F", "/PID", String(p.pid)], { stdio: "ignore" }); else p.kill() } catch (e) {} };
const freePort = () => new Promise(r => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => given.has(p) ? r(freePort()) : (given.add(p), r(p))) }) });
async function waitHttp(url, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { try { await fetch(url); return } catch (e) { await sleep(150) } } throw new Error("no answer from " + url) }

/* one Kiln instance + browser page, with the helpers a test uses */
async function launch(name, { step = 0.6, width = 1513, height = 900, env = {}, autoExit = false, before = null } = {}) {
  const dir = join(tmpdir(), `kiln-test-${name}-${Date.now()}`), out = join(dir, "out"), data = join(dir, "data");
  mkdirSync(out, { recursive: true }); mkdirSync(data, { recursive: true });
  if (before) await before({ out, data });   // a test can fill the queue and the output folder before Kiln starts
  const [fport, kport, dport] = [await freePort(), await freePort(), await freePort()];
  const procs = [], log = [];
  const run = (cmd, args, env) => { const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", d => log.push(String(d))); p.stderr.on("data", d => log.push(String(d))); procs.push(p); return p };
  // everything started from here on is stopped again if the start fails: a failed start must never leave a fake Forge,
  // a Kiln server or an Edge running (under load, leaked ones made the next starts fail too, and so on until the PC froze)
  let ws = null;
  try {
  run(PY, ["tools/fake_forge.py", String(fport), String(step)]);
  await waitHttp(`http://127.0.0.1:${fport}/sdapi/v1/options`);
  run(PY, ["-c", `import server; server.CFG['exit_when_closed']=${autoExit ? "True" : "False"}; server.CFG['forge_start']=''; server.main()`],
    { KILN_PORT: String(kport), KILN_FORGE_URL: `http://127.0.0.1:${fport}`, KILN_OUTPUT_DIR: out, KILN_DATA_DIR: data, PYTHONUNBUFFERED: "1",
      KILN_UPDATE_URL: `http://127.0.0.1:${fport}/tags`, KILN_NO_RECYCLE: "1", ...env });
  await waitHttp(`http://127.0.0.1:${kport}/api/state`);
  const url = `http://127.0.0.1:${kport}/`;
  // --no-proxy-server like kiln.bat: a system proxy (VPN client, antivirus web filter) must not stall the local page
  run(browserPath(), ["--headless=new", `--user-data-dir=${join(dir, "profile")}`, `--remote-debugging-port=${dport}`, "--no-proxy-server",
    "--no-first-run", "--no-default-browser-check", `--window-size=${width},${height}`, "about:blank"]);
  let pg = null;
  for (let i = 0; i < 80 && !pg; i++) { try { pg = (await (await fetch(`http://127.0.0.1:${dport}/json`)).json()).find(t => t.type === "page") } catch (e) {} if (!pg) await sleep(250) }
  if (!pg) throw new Error("browser page not found");
  ws = new WebSocket(pg.webSocketDebuggerUrl); let id = 0; const wait = {}, errors = [], requests = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id] }
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push("console.error " + d.params.args.map(a => a.value ?? a.description).join(" "));
    if (d.method === "Network.requestWillBeSent") requests.push({ url: d.params.request.url, type: d.params.type }) };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({ id: i, method, params })) });
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
  // the same conditions on every machine, set before Kiln loads (it reads them at start): motion on — Windows Server
  // (CI) has animations off, which Kiln honours as "reduce motion" — and a 24-hour English clock
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await send("Emulation.setLocaleOverride", { locale: "en-GB" });
  await send("Page.navigate", { url });
  const ev = async expr => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error("in page: " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text) + "\n  " + expr.slice(0, 200));
    return r.result?.result?.value };
  const until = async (expr, ms = 20000, every = 200) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return true } catch (e) {} await sleep(every) } return false };
  const t0 = Date.now(); const ready = await until("!!(window.LIVE&&window._jobsReady&&LORAS.length)", 30000, 100);
  if (!ready) throw new Error("Kiln never became ready");
  const k = {
    url, out, data, errors, requests, readyMs: Date.now() - t0, ev, until, sleep, send, kport,
    /* a job; settings as page code, e.g. job("[fill:ff0000] a fox", {ar:"3:4", steps:3, name:"Fox"}) */
    job: (prompt, o = {}) => ev(`(()=>{S.ar=${JSON.stringify(o.ar || "3:4")};S.steps=${o.steps || 3};S.n=1;S.seedMode="random";
      S.pname=${JSON.stringify(o.name || "")};$("pname").value=S.pname;P.value=${JSON.stringify(prompt)};draft=P.value;return addJobs().then(()=>1)})()`),
    setting: (key, value) => ev(`(()=>{const el=document.querySelector('[data-set="${key}"]');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event("change"));return 1})()`),
    theme: t => ev(`(()=>{S.theme="${t}";$("sTheme").value="${t}";applyTheme();save();showView("gen");return 1})()`),   // not via the select: that also previews the cover
    key: key => ev(`(()=>{const e=new KeyboardEvent("keydown",{key:${JSON.stringify(key)},bubbles:true});(document.activeElement||document.body).dispatchEvent(e);return 1})()`),
    mouse: (x, y) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }),
    click: async (x, y) => { await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }) },
    rect: sel => ev(`JSON.parse(JSON.stringify(document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect()))`),
    /* the cover's mean opacity (0 = image fully visible) */
    veil: () => ev(`(()=>{const c=$("veil"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return +(s/(d.length/4)/255).toFixed(3)})()`),
    /* the image canvas's mean colour along its middle row */
    cvColor: () => ev(`(()=>{const c=$("cv"),d=c.getContext("2d").getImageData(0,(c.height/2)|0,c.width,1).data,s=[0,0,0];for(let i=0;i<d.length;i+=4){s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2]}return s.map(v=>Math.round(v/(d.length/4)))})()`),
    shot: async n => { mkdirSync(OUT, { recursive: true }); const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(OUT, `${name}-${n}.png`), Buffer.from(s.result.data, "base64")) },
    log,
    async close() { try { await send("Browser.close") } catch (e) {} ws.close(); await sleep(300); procs.forEach(killTree)
      await sleep(300); try { rmSync(dir, { recursive: true, force: true }) } catch (e) {} },
  };
  return k;
  } catch (e) {
    try { ws?.close() } catch (e2) {}
    procs.forEach(killTree)
    await sleep(300); try { rmSync(dir, { recursive: true, force: true }) } catch (e2) {}
    throw e;
  }
}

/* tiny assertion collector */
function checker() { const fails = [], passes = []; return {
  ok(cond, what, detail) { (cond ? passes : fails).push(what + (cond || detail === undefined ? "" : `  →  ${typeof detail === "string" ? detail : JSON.stringify(detail)}`)) },
  near(a, b, tol, what) { this.ok(Math.abs(a - b) <= tol, what, { got: a, want: b, tol }) },
  fails, passes } }

/* arguments: an optional file-name filter and -j N */
const args = process.argv.slice(2);
const ji = args.indexOf("-j"), jobs = Math.max(1, +(ji >= 0 ? args.splice(ji, 2)[1] : process.env.KILN_JOBS || Math.min(3, Math.floor(availableParallelism() / 3))));
const filter = args[0] || "";
const tests = [];
for (const f of readdirSync(HERE).filter(f => f.endsWith(".test.mjs") && f.includes(filter)).sort()) {
  const mod = await import(pathToFileURL(join(HERE, f)));
  for (const [tname, fn] of Object.entries(mod)) if (typeof fn === "function") tests.push({ file: f.replace(".test.mjs", ""), tname, fn });
}

/* one test: its own Kiln, browser and folders; returns its report as text, printed in one piece */
async function runOne({ file, tname, fn }) {
  const label = `${file} › ${tname}`, t = checker(); let k = null; const t0 = Date.now();
  try { try { k = await launch(`${file}-${tname}`, fn.opts || {}); startFails = 0 } catch (e) { startFails++; throw e }
    await fn(k, t);
    t.ok(k.errors.length === 0, "no page errors", k.errors) }
  catch (e) { t.fails.push("threw: " + (e.stack || e)) }
  finally { if (k) await k.close() }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  return t.fails.length ? { ok: false, label, text: [`✗ ${label} (${secs}s)`, ...t.fails.map(x => "    ✗ " + x)].join("\n") }
                        : { ok: true, label, text: `✓ ${label} (${secs}s, ${t.passes.length} checks)` };
}

/* a pool of workers, each taking the next test off the list until it's empty. Circuit breaker: when Kiln fails to
   start 3 times in a row the machine is overloaded (or something is broken) — stop rather than start more */
let startFails = 0;
const t0 = Date.now(), queue = [...tests], results = [];
console.log(`${tests.length} tests, ${Math.min(jobs, tests.length)} at a time`);
await Promise.all(Array.from({ length: Math.min(jobs, tests.length) }, async () => {
  while (queue.length && startFails < 3) { const r = await runOne(queue.shift()); results.push(r); console.log(r.text) }
}));
if (queue.length) console.log(`\nSTOPPED: Kiln failed to start 3 times in a row — ${queue.length} tests not run. Try fewer at a time (-j 1).`);
const failed = results.filter(r => !r.ok);
const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log(failed.length ? `\n${failed.length} test(s) failed (${mins} min):\n` + failed.map(r => "  " + r.label).join("\n") : `\nall passed (${mins} min)`);

/* on GitHub Actions: each failure as an annotation and a summary table, shown on the run's page (logs need admin rights) */
if (process.env.GITHUB_ACTIONS) {
  const esc = s => s.replace(/%/g, "%25").replace(/\r/g, "").replace(/\n/g, "%0A");
  for (const r of failed) console.log(`::error title=${esc(r.label)}::${esc(r.text.slice(0, 4000))}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### End-to-end tests: ${results.length - failed.length} of ${tests.length} passed (${mins} min)\n\n` +
    (failed.length ? failed.map(r => "```\n" + r.text + "\n```").join("\n") + "\n" : "") +
    (queue.length ? `\n**Stopped:** ${queue.length} tests not run (Kiln failed to start 3 times in a row).\n` : ""));
}
process.exit(failed.length || queue.length ? 1 : 0);
