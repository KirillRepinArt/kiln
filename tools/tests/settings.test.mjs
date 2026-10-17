// Settings layout and the offline promise.

export async function order(k, t) {
  t.ok(await k.ev(`[...document.querySelectorAll(".mcard .fgh")].map(e=>e.textContent).join(",")`) === "Model,Output,Appearance,Effects,Cover",
    "groups: Model, Output, Appearance, Effects, Cover", await k.ev(`[...document.querySelectorAll(".mcard .fgh")].map(e=>e.textContent).join(",")`));
  const themes = await k.ev(`[...$("sTheme").options].map(o=>o.textContent)`);
  t.ok(JSON.stringify(themes) === JSON.stringify([...themes].sort((a, b) => a.localeCompare(b))), "themes A–Z", themes);
  t.ok(await k.ev(`!!(document.querySelector('[data-set="upscaler"]').compareDocumentPosition($("fghAp"))&Node.DOCUMENT_POSITION_FOLLOWING)`),
    "upscaler rows stay above Appearance");
}

export async function offline(k, t) {
  t.ok(k.readyMs < 5000, "ready in under 5 s", k.readyMs + " ms");
  const ext = k.requests.filter(r => ["Stylesheet", "Font"].includes(r.type) && !r.url.startsWith(k.url) && !r.url.startsWith("data:"));
  t.ok(ext.length === 0, "no fonts or stylesheets from the internet", ext.map(r => r.url));
  await k.until(`!!document.querySelector(".cm-editor")`, 5000);
  t.ok(k.requests.some(r => r.url.includes("/app/vendor/codemirror.js")), "the editor loads from app/vendor");
  t.ok(!k.requests.some(r => r.url.includes("esm.sh")), "no CDN for the editor");
  t.ok(await k.ev(`!!document.querySelector(".cm-editor")`), "the CodeMirror editor is up");
  t.ok(await k.ev(`document.fonts.check('15px "Geist"')`), "Geist is available");
}
