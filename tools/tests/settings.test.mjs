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

// The skins: four offered, A–Z (Embers gone, Starscape hidden — still valid: its stars are Graphite's extra,
// DD-2026-11-12-16); a skin saved before comes back as the nearest one now, an unknown one as the first-run default.
export async function oldSkinsMigrate(k, t) {
  const skins = await k.ev(`[...$("sTheme").options].filter(o=>!o.hidden).map(o=>o.value).join(",")`);
  t.ok(skins === "aurora,clay,graphite,matrix", "four skins offered, A–Z: Aurora, Clay, Graphite, Matrix", skins);
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

// A plain theme's signature effect (Graphite's starfield): off until switched on, its switch named after it and shown only
// for a theme that has one, its value that theme's own (DD-2026-11-12-16).
export async function graphiteStarfield(k, t) {
  await k.theme("graphite");
  const sw = () => k.ev(`[$("lExtra").hidden,$("lExtra").textContent,$("sExtra").value,skin().bg].join(",")`);
  t.ok(
    (await sw()) === "false,Starfield,off,none",
    "Graphite: the Starfield switch shows, off, no background",
    await sw(),
  );
  await k.ev(`(()=>{const s=$("sExtra");s.value="on";s.dispatchEvent(new Event("change"));return 1})()`);
  t.ok((await sw()) === "false,Starfield,on,stars", "switched on: the starfield is Graphite's background", await sw());
  await k.theme("clay");
  t.ok(
    await k.ev(`$("lExtra").hidden&&$("sExtra").hidden&&skin().bg==="none"`),
    "Clay has no extra: no switch, no background",
  );
  await k.theme("graphite");
  t.ok((await sw()).endsWith("on,stars"), "back on Graphite: its switch kept its own value", await sw());
}
