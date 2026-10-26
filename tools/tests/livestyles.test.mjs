// Live style reload (v0.7 step 7e): saving a file in app/styles/ swaps the styles in place — nothing reloads.
// The server's fingerprint has its unit test (test_server.py); here the page's half. The test doesn't touch the real
// style files: on CI other tests run at the same time against the same files, and their pages would swap too.

export async function swapsInPlace(k, t) {
  const sig = await k.ev(`fetch("/api/state").then(r=>r.json()).then(s=>s.styles||"")`);
  t.ok(/^\d+\.\d+$/.test(sig), "the state answer carries the styles' fingerprint", sig);
  await k.ev(`(window.__samePage = 1)`);
  const before = await k.ev(`document.querySelectorAll('link[rel="stylesheet"][href*="app/styles/"]').length`);
  await k.ev(`(checkStyles("${sig}"), checkStyles("test.1"), 1)`); // the page's own, then a "saved" one
  const swapped = await k.until(`document.documentElement.dataset.stylesV === "test.1"`, 8000, 100);
  t.ok(swapped, "a new fingerprint: the styles are swapped");
  const r = await k.ev(`(()=>{const ls=[...document.querySelectorAll('link[rel="stylesheet"][href*="app/styles/"]')];
    return {n:ls.length,fresh:ls.every(l=>l.href.includes("?v=test.1")),same:window.__samePage===1,
      gap:getComputedStyle(document.documentElement).getPropertyValue("--gap-area").trim(),
      box:getComputedStyle(document.getElementById("left")).borderRadius}})()`);
  t.ok(r.same, "nothing reloaded: the same page", r);
  t.ok(r.n === before && r.fresh, "each stylesheet once, all the fresh copies (the old ones gone)", { before, ...r });
  t.ok(r.gap === "20px" && r.box === "24px", "still styled", r);
}
