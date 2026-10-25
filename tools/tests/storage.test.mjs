// LoRA names, stars and weights survive anything that saves early (the 2026-10-18 wipe).

export async function earlySaveKeepsNames(k, t) {
  const name = await k.ev(`LORAS.find(l=>l.folder==="style").name`);
  await k.ev(
    `(()=>{const l=LORAS.find(l=>l.name===${JSON.stringify(name)});l.display="My Favourite Style";l.fav=true;l.w=0.42;save();return 1})()`,
  );
  // an old setting that triggers a one-time conversion — and with it a save — at start-up, before Forge's LoRA list arrives
  await k.ev(
    `(()=>{const st=JSON.parse(localStorage.getItem("kiln_state"));st.S.set=st.S.set||{};st.S.set.privacy="off";localStorage.setItem("kiln_state",JSON.stringify(st));return 1})()`,
  );
  await k.send("Page.reload", {});
  await k.sleep(800);
  await k.until("!!(window.LIVE&&LORAS.length>5)", 15000);
  await k.sleep(800);
  const l = await k.ev(`(({display,fav,w})=>({display,fav,w}))(LORAS.find(l=>l.name===${JSON.stringify(name)}))`);
  t.ok(
    l.display === "My Favourite Style" && l.fav === true && l.w === 0.42,
    "a rename, a star and a weight survive the start-up save",
    l,
  );
}
