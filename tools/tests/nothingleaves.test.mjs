// Resilience + privacy (v0.7 step 8): nothing Kiln does reaches outside this machine. A tour of the whole app — a
// render, every tab, Settings, the viewer, a LoRA rescan, every skin — and every request Kiln made must go to its own
// address (or be data: / blob:). The server side: tools/tests/unit/test_server.py › NetworkCalls. The one request that
// may leave, the update check, only happens when you press its button (not part of the tour).
//
// Software on the machine can add its own: an antivirus that rewrites web pages in transit (Kaspersky does, even on
// 127.0.0.1) puts a script into the page, and that script makes requests. Those aren't Kiln's: they were started by
// HTML Kiln never served, or by code that didn't come from Kiln. They're listed in the report, not counted.

/** did Kiln start this request? (its own code or its own HTML) — judged by where the call chain STARTS: such software
 * also wraps the page's fetch(), so the frames on top are its own even when Kiln made the call */
function byKiln(r, own, served) {
  const i = r.initiator || {};
  if (i.type === "script") {
    const frames = [];
    for (let st = i.stack; st; st = st.parent) frames.push(...(st.callFrames || []));
    const origin = frames.length ? frames[frames.length - 1].url : "";
    return !origin || origin.startsWith(own); // "" = evaluated code (the test itself)
  }
  if (i.type === "parser")
    return !/^https?:/.test(r.url) || r.url.startsWith(own) || served.includes(r.url.split("?")[0]);
  return true;
}

export async function pageTour(k, t) {
  const tab = v => k.ev(`(document.querySelector('.tab[data-v="${v}"]').click(),1)`);
  await k.job("[fill:3a5a6a] a glass vase, morning", { steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="done")`, 30000);
  for (const v of ["gallery", "gen", "queue", "loras", "png", "gen"]) {
    await tab(v);
    await k.sleep(700);
  }
  await tab("loras");
  await k.ev(`($("lRefresh").click(),1)`);
  await k.sleep(800);
  await tab("gen");
  await k.ev(`($("gear").click(),1)`);
  await k.sleep(800);
  await k.ev(`(closePops(),1)`);
  await k.ev(`(openViewer(lastDone()),1)`);
  await k.sleep(800);
  await k.ev(`(closeViewer(),1)`);
  for (const s of ["aurora", "embers", "matrix", "starscape"]) {
    await k.theme(s);
    await k.sleep(900);
  }
  const own = new URL(k.url).origin + "/";
  const served = await (await fetch(k.url)).text(); // the page as Kiln serves it (before anything rewrites it)
  const outside = k.requests.filter(r => !r.url.startsWith(own) && !/^(data|blob|about):/.test(r.url));
  const kilns = outside.filter(r => byKiln(r, own, served));
  const injected = [...new Set(outside.filter(r => !byKiln(r, own, served)).map(r => new URL(r.url).host))];
  t.ok(k.requests.length > 20, "the tour made requests (the recorder works)", k.requests.length);
  t.ok(
    kilns.length === 0,
    "every request Kiln made stayed on this machine",
    kilns.slice(0, 10).map(r => r.url),
  );
  if (injected.length) t.note(`not Kiln's — injected into the page by other software: ${injected.join(", ")}`);
}
pageTour.opts = { width: 1600, height: 960, step: 0.05 };
