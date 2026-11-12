// Settings layout and the offline promise.

export async function order(k, t) {
  const groups = await k.ev(`[...document.querySelectorAll("#modal .fgh")].map(e=>e.textContent).join(",")`);
  t.ok(
    groups === "Model,Output,Appearance,Effects,Cover,Privacy,About",
    "groups: Model, Output, Appearance, Effects, Cover, Privacy, About",
    groups,
  );
  const themes = await k.ev(`[...$("sTheme").options].map(o=>o.textContent)`);
  t.ok(JSON.stringify(themes) === JSON.stringify([...themes].sort((a, b) => a.localeCompare(b))), "themes A–Z", themes);
  t.ok(
    await k.ev(
      `!!(document.querySelector('[data-set="upscaler"]').compareDocumentPosition($("fghAp"))&Node.DOCUMENT_POSITION_FOLLOWING)`,
    ),
    "upscaler rows stay above Appearance",
  );
}

export async function offline(k, t) {
  t.ok(k.readyMs < 8000, "ready in under 8 s (the old font stall was 21 s)", k.readyMs + " ms");
  const ext = k.requests.filter(
    r =>
      ["Stylesheet", "Font"].includes(r.type) &&
      !r.url.startsWith(new URL(k.url).origin + "/") &&
      !r.url.startsWith("data:"), // Kiln's own address
  );
  t.ok(
    ext.length === 0,
    "no fonts or stylesheets from the internet",
    ext.map(r => r.url),
  );
  await k.until(`!!document.querySelector(".cm-editor")`, 5000);
  t.ok(
    k.requests.some(r => r.url.includes("/app/vendor/codemirror.js")),
    "the editor loads from app/vendor",
  );
  t.ok(!k.requests.some(r => r.url.includes("esm.sh")), "no CDN for the editor");
  t.ok(await k.ev(`!!document.querySelector(".cm-editor")`), "the CodeMirror editor is up");
  t.ok(await k.ev(`document.fonts.check('15px "Geist"')`), "Geist is available");
}

// The skins: five in the menu, A–Z (Embers hidden, DD-2026-11-12-10); a skin saved before comes back as the nearest one
// now, an unknown one as the first-run default (Graphite).
export async function oldSkinsMigrate(k, t) {
  const skins = await k.ev(`[...$("sTheme").options].map(o=>o.value).join(",")`);
  t.ok(
    skins === "aurora,clay,graphite,matrix,starscape",
    "five skins, A–Z: Aurora, Clay, Graphite, Matrix, Starscape",
    skins,
  );
  for (const [old, now] of [
    ["sunset", "starscape"],
    ["ember", "starscape"],
    ["embers", "starscape"],
    ["ice", "starscape"],
    ["emerald", "matrix"],
    ["no-such-skin", "graphite"],
  ]) {
    await k.ev(
      `(()=>{const s=JSON.parse(localStorage.getItem("kiln_state")||"{}");s.S=Object.assign(s.S||{},{theme:${JSON.stringify(old)}});localStorage.setItem("kiln_state",JSON.stringify(s));return 1})()`,
    );
    await k.reload();
    const got = await k.ev(`[S.theme,document.documentElement.dataset.skin,$("sTheme").value].join(",")`);
    t.ok(got === [now, now, now].join(","), `a saved "${old}" → ${now} (setting, page, menu)`, got);
  }
}

/* Settings → Privacy: the picture index (v0.7b) — how many pictures it holds, and Clear (it rebuilds from the pictures'
   own text, so nothing is lost) */
export async function pictureIndexInSettings(k, t) {
  await k.job("a cup", { steps: 1 });
  await k.until(`jobs.some(j=>j.status==="done")`, 20000);
  await k.sleep(500);
  await k.ev(`($("gear").click(),1)`);
  t.ok(
    await k.until(`/^1 picture indexed/.test($("libStat").textContent)`, 5000),
    "a render is in the index at once",
    await k.ev(`$("libStat").textContent`),
  );
  await k.ev(`($("libClear").click(),1)`);
  t.ok(await k.until(`/cleared/.test($("toastMsg").textContent)`, 3000), "Clear says it rebuilds");
  t.ok(
    await k.until(`/^1 picture indexed/.test($("libStat").textContent)`, 5000),
    "…and it does, from the picture itself",
  );
}
